output "readings_table" {
  value = aws_dynamodb_table.readings.name
}

output "platform_table" {
  value = aws_dynamodb_table.platform.name
}

output "audit_table" {
  value = aws_dynamodb_table.audit.name
}
