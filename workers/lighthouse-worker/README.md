# Lighthouse worker deployment

Terraform manages the worker, caller users, Function URLs, VPC, and Squid proxy in the
[infrastructure stack](../../../infrastructure/aws/ezaudit). The worker runs in `us-east-1` as an arm64 Lambda
container. It uses 2048 MB, a 120-second timeout, reserved concurrency of 4, and
`AWS_IAM`. Its execution role needs `AWSLambdaVPCAccessExecutionRole`.

Terraform sets `LIGHTHOUSE_EGRESS_PROXY_URL` to the proxy's private address. The
worker's local proxy sends checked HTTP requests and HTTPS tunnels to Squid.

One deployed audit measured 11.9 seconds cold and 8.7 seconds warm at 2048 MB.
Peak memory was 949 MB.

## Environment settings

Set these Lambda environment variables:

| Name | Value |
|---|---|
| `LIGHTHOUSE_AUTH_MODE` | `iam` |
| `LIGHTHOUSE_ALLOWED_CALLER_ARN` | Exact IAM user ARN for the Convex caller |
| `LIGHTHOUSE_EGRESS_PROXY_URL` | `http://<proxy-private-ip>:3128` from Terraform |

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

Use one dedicated IAM user for each Convex deployment. Each policy grants only
Function URL invocation. Terraform manages the production and development users.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInvokeOutsideConvexRanges",
      "Effect": "Deny",
      "Action": [
        "lambda:InvokeFunctionUrl",
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:us-east-1:319777330480:function:ezaudit-lighthouse-worker",
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": [
            "216.235.222.0/24",
            "2600:1f18:77e:2300::/56",
            "2600:1f10:4a09:7c00::/56"
          ]
        },
        "Bool": {
          "aws:PrincipalIsAWSService": "false"
        }
      }
    },
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

The Deny limits caller requests to Convex's shared ranges: `216.235.222.0/24`,
`2600:1f18:77e:2300::/56`, and `2600:1f10:4a09:7c00::/56`. These ranges do not
identify one Convex deployment. If Convex changes its ranges, calls from new
addresses will fail until this policy is updated.

Terraform adds these two statements to the Function URL resource policy for the
production caller. It adds matching statements for the development caller.

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
user ARN with `LIGHTHOUSE_ALLOWED_CALLER_ARN`. Terraform creates a matching policy
for the development user and Function URL.

## ECR image release

Build and push the arm64 image. Terraform creates the immutable ECR repository.
Run these commands from this directory. Use a new tag for each release.

```sh
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=319777330480
export IMAGE_TAG=$(git rev-parse --short HEAD)
export REPOSITORY=ezaudit-lighthouse-worker
export IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY:$IMAGE_TAG"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build --platform linux/arm64 -t "$IMAGE_URI" .
docker push "$IMAGE_URI"
```

## Terraform deployment

The Terraform stack imports the existing production worker. It creates the development
worker, separate caller users, the private Lambda subnet, and the proxy instance. Build
and push the new image before the first apply. The image must include `auditId` request
and response handling.

Run Terraform from the infrastructure repo:

```sh
cd ../../../infrastructure/aws/ezaudit
./tf.sh plan -var="lighthouse_image_uri=$IMAGE_URI"
./tf.sh apply -var="lighthouse_image_uri=$IMAGE_URI"
```

The import blocks adopt the production ECR repository, role, caller user, function,
Function URL, and permissions. The apply also moves both functions into the private
subnet and points them to Squid. The stack needs the infrastructure repo's `.env` file
with AWS access and `CLOUDFLARE_API_TOKEN`.

Terraform creates IAM users but no access keys. Create one key pair per user and store
each pair in its matching `backend/.env.local` or `backend/.env.production` file. Run
the matching Convex environment sync command from the ezaudit repo. Read the URLs with:

```sh
./tf.sh output -raw lighthouse_worker_dev_url
./tf.sh output -raw lighthouse_worker_url
```

Deploy the updated Lambda image before the Convex action. The new action requires the
worker to echo the submitted `auditId`. Keep the previous immutable image for rollback.
Do not use `provision.sh` for Terraform-managed resources.

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

Create a second access key for one environment's caller user. Keep the first key active.
Set the new access key ID and secret in that Convex deployment. Run a test audit.
After success, deactivate and delete the old key. Do not store either secret in git,
an image, a command history, or Lambda environment variables. Rotate at least every
90 days and after suspected exposure.

## Rollback

Set `lighthouse_image_uri` to the last known good image URI. Run Terraform plan and
apply. Then run a test audit. If the failure comes from IAM or environment settings,
restore the previous policy or Convex values. Keep Function URL auth at `AWS_IAM`.

## Cost estimate

The Squid proxy is an always-on `t4g.micro` EC2 instance with an 8 GB `gp3` volume.
At `$0.0084` per hour, the instance costs about `$6.05` for 30 days. The volume and
internet data transfer cost extra. AWS charges `$0.005` per hour for the public IPv4
address, or `$3.60` for 30 days. The total starts near `$9.65` per 30 days. See [VPC
pricing](https://aws.amazon.com/vpc/pricing/) and [EC2 On-Demand
pricing](https://aws.amazon.com/ec2/pricing/on-demand/). This path has no NAT gateway.

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

Keep Chromium's `--no-sandbox` flag while the current Lambda runtime lacks sandbox
support. Remove the flag only after the deployed runtime supports the Chromium sandbox.

## Egress limits

The Lambda security group permits TCP port 3128 only to the proxy security group.
Squid accepts port 3128 only from the Lambda security group. The proxy security group
permits outbound TCP ports 80 and 443 only. Squid allows those ports and blocks
private and reserved IPv4 destination ranges.

The Lambda subnet has no internet route. The internet gateway route belongs only to
the proxy subnet. Redirects and page resources pass through Chromium's local proxy,
then Squid. Chromium disables QUIC and non-proxied WebRTC UDP.

Terraform sets the private subnet, Lambda security group, and proxy URL. The handler
returns HTTP 503 in IAM mode when the proxy URL is missing. Proxy failure stops worker
egress until the instance recovers.

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
