# Dashboard API: API Gateway -> Lambda (FastAPI through Mangum) -> DynamoDB.
# Build the package first:  python scripts/build_api_lambda.py

locals {
  api_zip = "${path.module}/../../build/api.zip"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${var.project}-api"
  retention_in_days = 14
}

resource "aws_iam_role" "api" {
  name               = "${var.project}-api"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "api" {
  name = "api"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.api.arn}:*"
      },
      {
        # readings: the API only ever reads them (devices write through the ingest path)
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query"]
        Resource = aws_dynamodb_table.readings.arn
      },
      {
        # platform: sessions, flags, registry, markers. Query on the flag index needs the index ARN too.
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
        Resource = [aws_dynamodb_table.platform.arn, "${aws_dynamodb_table.platform.arn}/index/gsi1"]
      },
      {
        # audit: append entries (a transaction of two Puts) and read them back. No update, no delete.
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem"]
        Resource = aws_dynamodb_table.audit.arn
      },
    ]
  })
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.project}-api"
  role             = aws_iam_role.api.arn
  runtime          = "python3.12"
  architectures    = ["x86_64"] # the bundled pydantic is the x86_64 Linux build
  handler          = "src.api.lambda_handler.handler"
  filename         = local.api_zip
  source_code_hash = filebase64sha256(local.api_zip)
  timeout          = 29 # API Gateway gives up at 30 seconds
  memory_size      = 1024 # password hashing is CPU-heavy, and Lambda CPU scales with memory

  environment {
    variables = {
      READINGS_TABLE = aws_dynamodb_table.readings.name
      PLATFORM_TABLE = aws_dynamodb_table.platform.name
      AUDIT_TABLE    = aws_dynamodb_table.audit.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.api, aws_iam_role_policy.api]
}

resource "aws_apigatewayv2_api" "app" {
  name          = "${var.project}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "app" {
  api_id                 = aws_apigatewayv2_api.app.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "app" {
  api_id    = aws_apigatewayv2_api.app.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.app.id}"
}

resource "aws_apigatewayv2_stage" "app" {
  api_id      = aws_apigatewayv2_api.app.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 20 # requests per second across the whole API, which also slows password guessing
    throttling_burst_limit = 40
  }
}

resource "aws_lambda_permission" "app_gateway" {
  statement_id  = "AllowApiGatewayInvokeApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.app.execution_arn}/*/*"
}

output "api_url" {
  value = aws_apigatewayv2_api.app.api_endpoint
}
