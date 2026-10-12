# Feedback infrastructure

A small AWS backend that turns site feedback into GitHub issues, so players never need to log in.

## Bootstrap (once per AWS account)

```
cd infra/bootstrap
terraform init
terraform apply
```

This creates the `factoriocalculator-tfstate` S3 bucket that holds the state for `infra/feedback`. It uses local state itself, so run it once and keep its `terraform.tfstate` safe.

## Deploy the feedback stack

```
cd infra/feedback
terraform init
terraform apply
```

## Set the GitHub token

The Lambda reads its token from SSM at `/factorio-calculator/feedback/github-token`. Terraform never manages this parameter, so the real token never touches Terraform state; create it by hand once:

```
aws ssm put-parameter --name /factorio-calculator/feedback/github-token --type SecureString --value <token>
```

To rotate the token later, add `--overwrite`:

```
aws ssm put-parameter --name /factorio-calculator/feedback/github-token --type SecureString --overwrite --value <token>
```

Use a fine-grained personal access token scoped to the `factorio-calculator` repository only, with the Issues permission set to Read and write.

The parameter uses the account's default `aws/ssm` KMS key, so no extra key policy or grant is needed for the Lambda's `kms:Decrypt` to work; the IAM policy only needs `ssm:GetParameter` on this one parameter.

Since October 2025, public function URLs need both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` permissions, or every call gets a 403; both are granted in `function-url.tf` (see https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html).

Reserved concurrency defaults to 2 (`var.reserved_concurrency` in `infra/feedback/variables.tf`); new AWS accounts often have an account-wide concurrency limit as low as 10, so check `aws lambda get-account-settings` before raising it, or set the variable to `null` to deploy without a reservation.

## Smoke test

```
curl -i -X POST <function_url> \
  -H 'content-type: application/json' \
  -d '{"message":"test feedback"}'
```

A healthy response is `201` with a `number` and `url` for the new GitHub issue.

## Security scan

CI runs `trivy config --severity HIGH,CRITICAL --exit-code 1 infra/` on every push; run the same command locally with [Trivy](https://github.com/aquasecurity/trivy) installed to check changes before pushing.

## Cost

Within the AWS free tier this runs at essentially $0/month: the Lambda free tier (1M requests, 400,000 GB-seconds) comfortably covers feedback-form traffic, the Function URL has no extra charge, and the SSM `SecureString` standard parameter and CloudWatch log group are free at this volume.
