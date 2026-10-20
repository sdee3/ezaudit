# Lighthouse worker deployment

The worker runs in `us-east-1` as an arm64 Lambda container. Set memory to 2048 MB,
timeout to 120 seconds, reserved concurrency to 4, and Function URL auth to `AWS_IAM`.
Do not attach a VPC. The user selected no VPC or network-level egress controls.

One deployed audit measured 11.9 seconds cold and 8.7 seconds warm at 2048 MB.
Peak memory was 949 MB.

## Environment settings

Set these Lambda environment variables:

| Name | Value |
|---|---|
| `LIGHTHOUSE_AUTH_MODE` | `iam` |
| `LIGHTHOUSE_ALLOWED_CALLER_ARN` | Exact IAM user ARN for the Convex caller |

Do not set `LIGHTHOUSE_WORKER_SECRET` in IAM mode. Local bearer proof uses
`LIGHTHOUSE_AUTH_MODE=bearer` and `LIGHTHOUSE_WORKER_SECRET` instead.

Set these Convex environment variables on each deployment that calls this worker:

| Name | Value |
|---|---|
| `LIGHTHOUSE_WORKER_URL` | The complete HTTPS Function URL in `us-east-1` |
| `LIGHTHOUSE_AWS_ACCESS_KEY_ID` | Dedicated IAM caller access key ID |
| `LIGHTHOUSE_AWS_SECRET_ACCESS_KEY` | Dedicated IAM caller secret key |
| `LIGHTHOUSE_AWS_SESSION_TOKEN` | Temporary credential token, only when applicable |

The first three settings are required. The session token is optional for long-lived
IAM user keys. Do not configure the bearer secret for production IAM calls.

## IAM permissions

Use a dedicated IAM user for the Convex caller. The policy grants only Function URL invocation.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeOnlyThisFunctionUrl",
      "Effect": "Allow",
      "Action": "lambda:InvokeFunctionUrl",
      "Resource": "arn:aws:lambda:us-east-1:319777330480:function:ezaudit-lighthouse-worker",
      "Condition": {
        "StringEquals": {
          "lambda:FunctionUrlAuthType": "AWS_IAM"
        }
      }
    },
    {
      "Sid": "InvokeFunctionOnlyThroughItsUrl",
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:319777330480:function:ezaudit-lighthouse-worker",
      "Condition": {
        "Bool": {
          "lambda:InvokedViaFunctionUrl": "true"
        }
      }
    }
  ]
}
```

Set the Function URL resource policy for the same account and exact caller ARN. Add
these two statements to the function resource policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowConvexFunctionUrl",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::319777330480:user/ezaudit-convex-lighthouse" },
      "Action": "lambda:InvokeFunctionUrl",
      "Resource": "arn:aws:lambda:us-east-1:319777330480:function:ezaudit-lighthouse-worker",
      "Condition": { "StringEquals": { "lambda:FunctionUrlAuthType": "AWS_IAM" } }
    },
    {
      "Sid": "AllowConvexInvokeThroughUrlOnly",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::319777330480:user/ezaudit-convex-lighthouse" },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-east-1:319777330480:function:ezaudit-lighthouse-worker",
      "Condition": { "Bool": { "lambda:InvokedViaFunctionUrl": "true" } }
    }
  ]
}
```

AWS requires both actions for `AWS_IAM` Function URLs. `lambda:InvokedViaFunctionUrl`
limits the second action to URL calls. The handler also compares the request's IAM
user ARN with `LIGHTHOUSE_ALLOWED_CALLER_ARN`.

## ECR to Lambda deployment

Run these commands from this directory. Set `AWS_ACCOUNT_ID` and `IMAGE_TAG` first.
Use an immutable tag for each release. The image repository must be in `us-east-1`.

```sh
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=319777330480
export IMAGE_TAG=$(git rev-parse --short HEAD)
export REPOSITORY=ezaudit-lighthouse-worker
export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY:$IMAGE_TAG"
aws ecr create-repository --region "$AWS_REGION" --repository-name "$REPOSITORY" --image-tag-mutability IMMUTABLE
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build --platform linux/arm64 -t "$IMAGE_URI" .
docker push "$IMAGE_URI"
```

Create the Lambda execution role before the first deployment. Its trust policy must
allow `lambda.amazonaws.com` to assume the role. Attach `AWSLambdaBasicExecutionRole`
for CloudWatch Logs. The function needs no AWS API permission at runtime.

`provision.sh` runs these steps and the later ones. Set `IMAGE_URI` to the pushed image
URI and run `bash provision.sh`. It creates the execution role, the caller user, the
caller policy, the function, the concurrency setting, and the Function URL. A second
run changes nothing. It never creates access keys.

Create the function with the pushed image and the required settings:

```sh
aws lambda create-function --region us-east-1 --function-name ezaudit-lighthouse-worker \
  --package-type Image --code ImageUri="$IMAGE_URI" --architectures arm64 \
  --role arn:aws:iam::319777330480:role/ezaudit-lighthouse-worker \
  --memory-size 2048 --timeout 120 \
  --environment 'Variables={LIGHTHOUSE_AUTH_MODE=iam,LIGHTHOUSE_ALLOWED_CALLER_ARN=arn:aws:iam::319777330480:user/ezaudit-convex-lighthouse}'
aws lambda put-function-concurrency --region us-east-1 \
  --function-name ezaudit-lighthouse-worker --reserved-concurrent-executions 4
aws lambda create-function-url-config --region us-east-1 \
  --function-name ezaudit-lighthouse-worker --auth-type AWS_IAM
```

Add the caller identity policy and Function URL resource policy above. Save the
returned Function URL. Add its value and caller credentials to the correct Convex
deployment. Invoke a test audit and confirm one successful Lambda log entry. Keep the
previous image URI for rollback.

For later releases, push the new immutable image and update the function:

```sh
aws lambda update-function-code --region us-east-1 \
  --function-name ezaudit-lighthouse-worker --image-uri "$IMAGE_URI"
aws lambda wait function-updated-v2 --region us-east-1 \
  --function-name ezaudit-lighthouse-worker
```

## IAM denial proof

Run both negative checks after deployment. Each check must return HTTP 403.

Set `LIGHTHOUSE_WORKER_URL` in the shell to the deployed Function URL. Send an
unsigned request first:

```sh
curl -i -X POST "$LIGHTHOUSE_WORKER_URL" \
  -H 'content-type: application/json' \
  -d '{"url":"https://ezaudit.sdee3.com"}'
```

Confirm the response status is 403. This check proves the Function URL resource
policy. The policy allows only the listed principal.

Next, use an IAM user that has no invoke policy. Sign and send the same request:

```sh
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
curl -i --aws-sigv4 "aws:amz:us-east-1:lambda" -X POST "$LIGHTHOUSE_WORKER_URL" \
  -H 'content-type: application/json' \
  -d '{"url":"https://ezaudit.sdee3.com"}'
```

Confirm the response status is 403. This check proves the principal allow list.
It rejects an IAM user outside the list.

The negative checks do not prove the handler ARN comparison. A bearer call proves
the handler. See [Local proof](#local-proof).

On the deployed function, the unsigned request returned 403. A signed request from
the dedicated caller returned 200 and four scores. A signed request from a user
outside the policy was not run.

## Credential rotation

Create a second access key for the dedicated IAM user. Keep the first key active.
Set the new access key ID and secret in the Convex deployment. Run a test audit.
After success, deactivate and delete the old key. Do not store either secret in git,
an image, a command history, or Lambda environment variables. Rotate at least every
90 days and after suspected exposure.

## Rollback

Set `IMAGE_TAG` to the last known good tag and update the function code with that
image URI. Wait for `function-updated-v2`, then run a test audit. If the failure comes
from IAM or environment configuration, restore the previous policy or Convex values.
Do not roll back the Function URL auth type from `AWS_IAM`.

## Cost estimate

At 100 audits per month and the measured 11.9-second deployment duration, Lambda uses
about 2,380 GB-seconds: `100 × 2 GB × 11.9 seconds`. At the published `us-east-1` rate
of `$0.0000166667` per GB-second, compute costs about `$0.04` before the account-wide
free tier ([Lambda pricing](https://aws.amazon.com/lambda/pricing/)). One hundred
requests cost `$0.00002` at `$0.20` per million. If all 100 audits take the full 120
seconds, compute costs `$0.40` before the free tier.

Private ECR storage costs `$0.10` per GB-month in AWS's published example. A 1 GB image
therefore adds about `$0.10` per month ([ECR pricing](https://aws.amazon.com/ecr/pricing/)).
In-region image transfer to Lambda is free.
This estimate excludes taxes, internet data transfer, CloudWatch log ingestion and
storage, and ECR storage above 1 GB. Actual browser traffic and image size can change
the bill. Lambda's free tier is account-wide and may already be consumed.

## Chromium flags

Keep `--no-zygote` and remove only `--single-process`. A zygote-spawned renderer
hangs the invocation until the function timeout. `--single-process` makes Lighthouse
report `NO_SCREENSHOTS`, so the performance score cannot be computed. Both behaviors
reproduced on Lambda and in the local arm64 container.

The handler fails the run after 100 seconds with a logged reason. A hung Chrome
otherwise dies at the function timeout with no error in the log.

## Egress limits

The proxy checks each HTTP request and HTTPS tunnel, rejects non-public DNS answers,
and connects to one checked IP. It allows only HTTP port 80 and HTTPS port 443.
Redirects and page resources pass through Chromium's proxy configuration. Chromium
disables QUIC and non-proxied WebRTC UDP.

These controls are application-level checks. The Lambda has public internet access.
They do not provide network isolation or block every possible direct browser network
path. DNS prefetch, browser changes, runtime paths, and other code can bypass these
proxy checks. No VPC or network-level egress control is configured.

## Local proof

Build and start the arm64 container:

```sh
docker build --platform linux/arm64 -t ezaudit-lighthouse-proof .
docker run --rm --platform linux/arm64 --memory=2048m -p 9000:8080 \
  -e AWS_LAMBDA_FUNCTION_MEMORY_SIZE=2048 \
  -e LIGHTHOUSE_AUTH_MODE=bearer \
  -e LIGHTHOUSE_WORKER_SECRET=local-proof-secret ezaudit-lighthouse-proof
```

In another terminal, run `LIGHTHOUSE_WORKER_SECRET=local-proof-secret npm run proof`.
Set `TARGET_URL` to a public page on port 80 or 443. The proof checks blocked
loopback, reserved and private address classes, blocked ports, bearer rejection, and
the four returned scores. It does not test deployed AWS IAM policy behavior.
