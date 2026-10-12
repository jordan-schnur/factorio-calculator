locals {
  function_name = "factorio-calculator-feedback"
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
  excludes    = ["feedback.test.mjs"]
}

resource "aws_cloudwatch_log_group" "feedback" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14

  tags = local.tags
}

resource "aws_lambda_function" "feedback" {
  function_name    = local.function_name
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  memory_size      = 128
  timeout          = 10
  role             = aws_iam_role.feedback_lambda.arn

  reserved_concurrent_executions = var.reserved_concurrency

  depends_on = [aws_cloudwatch_log_group.feedback, aws_iam_role_policy.feedback_lambda_logging]

  tags = local.tags
}
