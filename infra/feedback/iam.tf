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

resource "aws_iam_role_policy_attachment" "feedback_lambda_logging" {
  role       = aws_iam_role.feedback_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "feedback_lambda_ssm" {
  name = "feedback-lambda-ssm"
  role = aws_iam_role.feedback_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "ssm:GetParameter"
      Resource = aws_ssm_parameter.github_token.arn
    }]
  })
}
