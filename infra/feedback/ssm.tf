resource "aws_ssm_parameter" "github_token" {
  name  = "/factorio-calculator/feedback/github-token"
  type  = "SecureString"
  value = "set-me"

  lifecycle {
    ignore_changes = [value]
  }

  tags = local.tags
}
