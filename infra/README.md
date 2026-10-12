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

The Lambda reads its token from SSM at `/factorio-calculator/feedback/github-token`. Terraform creates the parameter with a placeholder value and never overwrites it again (`lifecycle.ignore_changes`), so set the real value once:

```
aws ssm put-parameter --name /factorio-calculator/feedback/github-token --type SecureString --overwrite --value <token>
```

Use a fine-grained personal access token scoped to the `factorio-calculator` repository only, with the Issues permission set to Read and write.

The parameter uses the account's default `aws/ssm` KMS key, so no extra key policy or grant is needed for the Lambda's `kms:Decrypt` to work; the IAM policy only needs `ssm:GetParameter` on this one parameter.

## Smoke test

```
curl -i -X POST <function_url> \
  -H 'content-type: application/json' \
  -d '{"message":"test feedback"}'
```

A healthy response is `201` with a `number` and `url` for the new GitHub issue.

## Cost

Within the AWS free tier this runs at essentially $0/month: the Lambda free tier (1M requests, 400,000 GB-seconds) comfortably covers feedback-form traffic, the Function URL has no extra charge, and the SSM `SecureString` standard parameter and CloudWatch log group are free at this volume.
