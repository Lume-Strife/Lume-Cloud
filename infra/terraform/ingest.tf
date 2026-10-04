# Ingest path: API Gateway -> receiver Lambda -> SQS -> writer Lambda -> DynamoDB.
# Build the package first:  python scripts/build_lambda.py
# Create the API key once (it is never stored in Terraform state):
#   aws ssm put-parameter --name /nesi-powertech/ingest-api-key --type SecureString --value <key>

variable "ingest_key_parameter" {
  type    = string
  default = "/nesi-powertech/ingest-api-key"
}

locals {
  lambda_zip           = "${path.module}/../../build/lambda.zip"
  ingest_key_param_arn = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${var.ingest_key_parameter}"
}

# ---- Queue (with a dead-letter queue for messages that keep failing) ----

resource "aws_sqs_queue" "ingest_dlq" {
  name                      = "${var.project}-ingest-dlq"
  message_retention_seconds = 1209600 # 14 days to investigate
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "ingest" {
  name                       = "${var.project}-ingest"
  visibility_timeout_seconds = 180 # six times the writer timeout, as AWS recommends for Lambda
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ingest_dlq.arn
    maxReceiveCount     = 5
  })
}

# ---- Logs (kept 14 days so they never grow without bound) ----

resource "aws_cloudwatch_log_group" "receiver" {
  name              = "/aws/lambda/${var.project}-ingest-receiver"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "writer" {
  name              = "/aws/lambda/${var.project}-ingest-writer"
  retention_in_days = 14
}

# ---- Receiver: checks the key, validates, queues ----

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "receiver" {
  name               = "${var.project}-ingest-receiver"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "receiver" {
  name = "receiver"
  role = aws_iam_role.receiver.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.receiver.arn}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.ingest.arn
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = local.ingest_key_param_arn
      },
      {
        # Reading a SecureString decrypts it. Allowed only when the request comes through SSM.
        Effect    = "Allow"
        Action    = ["kms:Decrypt"]
        Resource  = "arn:aws:kms:${var.region}:${data.aws_caller_identity.current.account_id}:key/*"
        Condition = { StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" } }
      },
    ]
  })
}

resource "aws_lambda_function" "receiver" {
  function_name    = "${var.project}-ingest-receiver"
  role             = aws_iam_role.receiver.arn
  runtime          = "python3.12"
  architectures    = ["arm64"]
  handler          = "src.ingest.lambda_handlers.receive"
  filename         = local.lambda_zip
  source_code_hash = filebase64sha256(local.lambda_zip)
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      QUEUE_URL        = aws_sqs_queue.ingest.url
      INGEST_KEY_PARAM = var.ingest_key_parameter
    }
  }

  depends_on = [aws_cloudwatch_log_group.receiver, aws_iam_role_policy.receiver]
}

# ---- Writer: queue -> DynamoDB, with only the permissions DynamoDBStore.save() uses ----

resource "aws_iam_role" "writer" {
  name               = "${var.project}-ingest-writer"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "writer" {
  name = "writer"
  role = aws_iam_role.writer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.writer.arn}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.ingest.arn
      },
      {
        # readings: write each reading, read back the existing one on a duplicate, record conflicts
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem"]
        Resource = aws_dynamodb_table.readings.arn
      },
      {
        # platform: the conflict counter and the earliest/latest reading marker only
        Effect   = "Allow"
        Action   = ["dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.platform.arn
      },
    ]
  })
}

resource "aws_lambda_function" "writer" {
  function_name    = "${var.project}-ingest-writer"
  role             = aws_iam_role.writer.arn
  runtime          = "python3.12"
  architectures    = ["arm64"]
  handler          = "src.ingest.lambda_handlers.write"
  filename         = local.lambda_zip
  source_code_hash = filebase64sha256(local.lambda_zip)
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      READINGS_TABLE = aws_dynamodb_table.readings.name
      PLATFORM_TABLE = aws_dynamodb_table.platform.name
      AUDIT_TABLE    = aws_dynamodb_table.audit.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.writer, aws_iam_role_policy.writer]
}

resource "aws_lambda_event_source_mapping" "writer" {
  event_source_arn                   = aws_sqs_queue.ingest.arn
  function_name                      = aws_lambda_function.writer.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  function_response_types            = ["ReportBatchItemFailures"] # retry only the messages that failed

  scaling_config {
    maximum_concurrency = 3 # caps parallel writers, and with them the DynamoDB load and the bill
  }
}

# ---- Public endpoint ----

resource "aws_apigatewayv2_api" "ingest" {
  name          = "${var.project}-ingest"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "receiver" {
  api_id                 = aws_apigatewayv2_api.ingest.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.receiver.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "ingest" {
  api_id    = aws_apigatewayv2_api.ingest.id
  route_key = "POST /ingest"
  target    = "integrations/${aws_apigatewayv2_integration.receiver.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.ingest.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 10 # requests per second, so a leaked key cannot run up a bill
    throttling_burst_limit = 20
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.receiver.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.ingest.execution_arn}/*/*"
}

output "ingest_url" {
  value = "${aws_apigatewayv2_api.ingest.api_endpoint}/ingest"
}

output "ingest_dlq_url" {
  value = aws_sqs_queue.ingest_dlq.url
}
