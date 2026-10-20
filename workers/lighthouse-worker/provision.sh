#!/usr/bin/env bash
# Provision the Lighthouse Lambda worker and its dedicated Convex caller.
# This script is idempotent. A second run changes nothing.
# This script never creates access keys and never stores secrets.
set -euo pipefail

ACCOUNT_ID="${ACCOUNT_ID:-319777330480}"
REGION="${REGION:-us-east-1}"
IMAGE_URI="${IMAGE_URI:-}"

FUNCTION_NAME="ezaudit-lighthouse-worker"
REPOSITORY_NAME="ezaudit-lighthouse-worker"
ROLE_NAME="ezaudit-lighthouse-worker"
CALLER_USER="ezaudit-convex-lighthouse"
CALLER_POLICY_NAME="ezaudit-lighthouse-invoke"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
CALLER_ARN="arn:aws:iam::${ACCOUNT_ID}:user/${CALLER_USER}"
FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

# Create a resource and tolerate a concurrent create on a second run.
create_if_needed() {
  local label="$1"
  shift
  local output
  if output="$("$@" 2>&1)"; then
    return 0
  fi
  if [[ "${output}" == *"already exists"* ||
        "${output}" == *AlreadyExistsException* ||
        "${output}" == *ResourceConflictException* ]]; then
    echo "${label} already exists. Skipping."
    return 0
  fi
  printf '%s\n' "${output}" >&2
  return 1
}

echo "Account: ${ACCOUNT_ID}"
echo "Region:  ${REGION}"

# 1. ECR repository with immutable image tags.
if ! aws ecr describe-repositories --region "${REGION}" \
    --repository-names "${REPOSITORY_NAME}" >/dev/null 2>&1; then
  create_if_needed "ECR repository ${REPOSITORY_NAME}" \
    aws ecr create-repository --region "${REGION}" \
    --repository-name "${REPOSITORY_NAME}" \
    --image-tag-mutability IMMUTABLE
fi

# 2. Lambda execution role with the basic logging policy.
cat > "${TMP_DIR}/lambda-trust.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

ROLE_CREATED=false
if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  create_if_needed "IAM role ${ROLE_NAME}" \
    aws iam create-role --role-name "${ROLE_NAME}" \
    --description "Execution role for the ezaudit Lighthouse worker" \
    --assume-role-policy-document "file://${TMP_DIR}/lambda-trust.json"
  ROLE_CREATED=true
fi

aws iam attach-role-policy --role-name "${ROLE_NAME}" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 3. Dedicated caller IAM user. Do not create access keys here.
if ! aws iam get-user --user-name "${CALLER_USER}" >/dev/null 2>&1; then
  create_if_needed "IAM user ${CALLER_USER}" \
    aws iam create-user --user-name "${CALLER_USER}"
fi

# 4. Caller identity policy. It allows only this function and only through its URL.
cat > "${TMP_DIR}/caller-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeOnlyThisFunctionUrl",
      "Effect": "Allow",
      "Action": "lambda:InvokeFunctionUrl",
      "Resource": "${FUNCTION_ARN}",
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
      "Resource": "${FUNCTION_ARN}",
      "Condition": {
        "Bool": {
          "lambda:InvokedViaFunctionUrl": "true"
        }
      }
    }
  ]
}
EOF

aws iam put-user-policy --user-name "${CALLER_USER}" \
  --policy-name "${CALLER_POLICY_NAME}" \
  --policy-document "file://${TMP_DIR}/caller-policy.json"

# 5. Lambda function.
FUNCTION_EXISTS=true
if ! aws lambda get-function --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" >/dev/null 2>&1; then
  FUNCTION_EXISTS=false
fi

if [[ "${FUNCTION_EXISTS}" == false ]]; then
  if [[ -z "${IMAGE_URI}" ]]; then
    echo "IMAGE_URI is empty. Set IMAGE_URI to the pushed image URI and run again." >&2
    exit 1
  fi
  if [[ "${ROLE_CREATED}" == true ]]; then
    echo "Waiting for the new execution role to propagate."
    sleep 10
  fi
  create_if_needed "Lambda function ${FUNCTION_NAME}" \
    aws lambda create-function --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --package-type Image \
    --code "ImageUri=${IMAGE_URI}" \
    --architectures arm64 \
    --role "${ROLE_ARN}" \
    --memory-size 2048 \
    --timeout 120 \
    --environment "Variables={LIGHTHOUSE_AUTH_MODE=iam,LIGHTHOUSE_ALLOWED_CALLER_ARN=${CALLER_ARN}}"
  aws lambda wait function-active-v2 --region "${REGION}" \
    --function-name "${FUNCTION_NAME}"
fi

CURRENT_CONCURRENCY="$(aws lambda get-function-concurrency --region "${REGION}" \
  --function-name "${FUNCTION_NAME}" \
  --query ReservedConcurrentExecutions --output text 2>/dev/null || true)"
if [[ "${CURRENT_CONCURRENCY}" != "4" ]]; then
  aws lambda put-function-concurrency --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --reserved-concurrent-executions 4 >/dev/null
fi

# 6. Function URL with AWS_IAM auth.
FUNCTION_URL="$(aws lambda get-function-url-config --region "${REGION}" \
  --function-name "${FUNCTION_NAME}" \
  --query FunctionUrl --output text 2>/dev/null || true)"
if [[ -z "${FUNCTION_URL}" || "${FUNCTION_URL}" == "None" ]]; then
  FUNCTION_URL="$(aws lambda create-function-url-config --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --auth-type AWS_IAM \
    --query FunctionUrl --output text)"
else
  CURRENT_AUTH_TYPE="$(aws lambda get-function-url-config --region "${REGION}" \
    --function-name "${FUNCTION_NAME}" \
    --query AuthType --output text)"
  if [[ "${CURRENT_AUTH_TYPE}" != "AWS_IAM" ]]; then
    echo "Setting Function URL auth type to AWS_IAM."
    aws lambda update-function-url-config --region "${REGION}" \
      --function-name "${FUNCTION_NAME}" \
      --auth-type AWS_IAM >/dev/null
  fi
fi

# 7. Function URL resource policy for the exact caller ARN.
# The CLI spells the two conditions as flags: --function-url-auth-type covers
# lambda:FunctionUrlAuthType, --invoked-via-function-url covers
# lambda:InvokedViaFunctionUrl.
add_function_permission() {
  local statement_id="$1"
  local action="$2"
  shift 2
  local output
  if output="$(aws lambda add-permission --region "${REGION}" \
      --function-name "${FUNCTION_NAME}" \
      --statement-id "${statement_id}" \
      --action "${action}" \
      --principal "${CALLER_ARN}" \
      "$@" 2>&1)"; then
    echo "Added resource policy statement ${statement_id}."
    return 0
  fi
  if [[ "${output}" == *ResourceConflictException* ]]; then
    echo "Resource policy statement ${statement_id} already exists. Skipping."
    return 0
  fi
  printf '%s\n' "${output}" >&2
  return 1
}

add_function_permission \
  "AllowConvexFunctionUrl" \
  "lambda:InvokeFunctionUrl" \
  --function-url-auth-type AWS_IAM

add_function_permission \
  "AllowConvexInvokeThroughUrlOnly" \
  "lambda:InvokeFunction" \
  --invoked-via-function-url

echo
echo "Function URL: ${FUNCTION_URL}"
echo "Caller ARN: ${CALLER_ARN}"
