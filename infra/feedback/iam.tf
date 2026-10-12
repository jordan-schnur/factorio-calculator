data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "feedback_lambda" {
  name = "factorio-calculator-feedback-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

# Scoped to the one log group instead of AWSLambdaBasicExecutionRole's account-wide grant.
resource "aws_iam_role_policy" "feedback_lambda_logging" {
  name = "feedback-lambda-logging"
  role = aws_iam_role.feedback_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.feedback.arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "feedback_lambda_ssm" {
  name = "feedback-lambda-ssm"
  role = aws_iam_role.feedback_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "ssm:GetParameter"
      Resource = "arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter/factorio-calculator/feedback/github-token"
    }]
  })
}
