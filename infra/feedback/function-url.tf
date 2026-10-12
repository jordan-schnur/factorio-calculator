resource "aws_lambda_function_url" "feedback" {
  function_name      = aws_lambda_function.feedback.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["https://factoriocalculator.app"]
    allow_methods = ["POST"]
    allow_headers = ["content-type"]
    max_age       = 86400
  }
}

# A public function URL needs a resource policy granting InvokeFunctionUrl to anyone.
resource "aws_lambda_permission" "feedback_url_invoke" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.feedback.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

output "function_url" {
  value = aws_lambda_function_url.feedback.function_url
}
