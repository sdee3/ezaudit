#!/usr/bin/env bash
# Build the production frontend and publish it to the ezaudit.sdee3.com
# S3/CloudFront distribution. Does not create AWS resources.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-frontend.sh [--force] [--clean]

Build the production frontend, upload to S3, upsert the security-headers
policy, and invalidate CloudFront.

  --force   Sync static/** (immutable). Skipped by default.
  --clean   Empty the S3 bucket before upload.
  -h, --help
EOF
}

CLEAN_BUCKET=false
FORCE_STATIC=false
for arg in "$@"; do
  case "${arg}" in
    --clean) CLEAN_BUCKET=true ;;
    --force) FORCE_STATIC=true ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      usage >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
  echo "Missing ${SCRIPT_DIR}/.env. Copy scripts/.env.example and fill it in." >&2
  exit 1
fi
# shellcheck source=.env
source "${SCRIPT_DIR}/.env"

: "${BUCKET:?BUCKET is required in scripts/.env}"
: "${REGION:?REGION is required in scripts/.env}"
: "${DISTRIBUTION_ID:?DISTRIBUTION_ID is required in scripts/.env}"
: "${VITE_CONVEX_URL:?VITE_CONVEX_URL is required in scripts/.env}"
: "${VITE_CLERK_PUBLISHABLE_KEY:?VITE_CLERK_PUBLISHABLE_KEY is required in scripts/.env}"

DIST_DIR="${DIST_DIR:-frontend/dist}"
if [[ "${DIST_DIR}" != /* ]]; then
  DIST_DIR="${REPO_ROOT}/${DIST_DIR#./}"
fi

# Canonical CSP lives in the identity repo. Prefer shared/clerk-csp.sh.
CSP_SOURCE=""
for candidate in \
  "${REPO_ROOT}/../identity/shared/clerk-csp.sh" \
  "${REPO_ROOT}/../identity/clerk-csp.sh"
do
  if [[ -f "${candidate}" ]]; then
    CSP_SOURCE="${candidate}"
    break
  fi
done
if [[ -n "${CSP_SOURCE}" ]]; then
  # shellcheck disable=SC1090
  source "${CSP_SOURCE}"
else
  SDEE3_CLERK_CONTENT_SECURITY_POLICY="default-src 'self'; base-uri 'self'; connect-src 'self' https: wss:; font-src 'self' data:; form-action 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.sdee3.com https://identity.sdee3.com; frame-ancestors 'none'; frame-src 'self' https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.sdee3.com https://identity.sdee3.com; img-src 'self' data: blob: https:; object-src 'none'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.sdee3.com; style-src 'self' 'unsafe-inline' https://*.clerk.com https://clerk.sdee3.com; worker-src 'self' blob:; upgrade-insecure-requests"
fi
CONTENT_SECURITY_POLICY="${CONTENT_SECURITY_POLICY:-${SDEE3_CLERK_CONTENT_SECURITY_POLICY:?CSP is empty}}"

json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  printf '%s' "${s}"
}

POLICY_CONFIG_FILE=""
cleanup_tmp() {
  rm -f "${POLICY_CONFIG_FILE:-}"
}
trap cleanup_tmp EXIT

write_production_env() {
  local env_file="${REPO_ROOT}/frontend/.env.production"
  {
    printf 'VITE_APP_ORIGIN=%s\n' "https://ezaudit.sdee3.com"
    printf 'VITE_CONVEX_URL=%s\n' "${VITE_CONVEX_URL}"
    printf 'VITE_CLERK_PUBLISHABLE_KEY=%s\n' "${VITE_CLERK_PUBLISHABLE_KEY}"
    printf 'VITE_CLERK_SIGN_IN_URL=%s\n' "https://identity.sdee3.com/sign-in"
    printf 'VITE_CLERK_SIGN_UP_URL=%s\n' "https://identity.sdee3.com/sign-up"
  } > "${env_file}"
}

# ponytail: lists only the first page of custom policies; paginate if this account exceeds CloudFront's page size.
upsert_security_headers_policy() {
  local policy_name="ezaudit-security-headers"
  local csp_json
  csp_json="$(json_escape "${CONTENT_SECURITY_POLICY}")"
  POLICY_CONFIG_FILE="$(mktemp)"
  cat > "${POLICY_CONFIG_FILE}" <<EOF
{
  "Name": "${policy_name}",
  "Comment": "EZ Audit frontend security headers",
  "SecurityHeadersConfig": {
    "ContentSecurityPolicy": {
      "Override": true,
      "ContentSecurityPolicy": "${csp_json}"
    },
    "StrictTransportSecurity": {
      "AccessControlMaxAgeSec": 63072000,
      "IncludeSubdomains": true,
      "Preload": true,
      "Override": true
    },
    "ContentTypeOptions": { "Override": true },
    "FrameOptions": { "FrameOption": "DENY", "Override": true },
    "ReferrerPolicy": {
      "ReferrerPolicy": "strict-origin-when-cross-origin",
      "Override": true
    }
  },
  "CustomHeadersConfig": {
    "Quantity": 4,
    "Items": [
      { "Header": "Permissions-Policy", "Value": "camera=(), microphone=(), geolocation=(self)", "Override": true },
      { "Header": "X-DNS-Prefetch-Control", "Value": "on", "Override": true },
      { "Header": "Cross-Origin-Opener-Policy", "Value": "same-origin", "Override": true },
      { "Header": "Cross-Origin-Resource-Policy", "Value": "same-site", "Override": true }
    ]
  }
}
EOF

  local policy_id
  policy_id="$(aws cloudfront list-response-headers-policies \
    --type custom \
    --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='${policy_name}'].ResponseHeadersPolicy.Id | [0]" \
    --output text)"

  if [[ "${policy_id}" == "None" || -z "${policy_id}" ]]; then
    aws cloudfront create-response-headers-policy \
      --response-headers-policy-config "file://${POLICY_CONFIG_FILE}" \
      --query "ResponseHeadersPolicy.Id" \
      --output text
  else
    local policy_etag
    policy_etag="$(aws cloudfront get-response-headers-policy-config \
      --id "${policy_id}" \
      --query "ETag" \
      --output text)"
    aws cloudfront update-response-headers-policy \
      --id "${policy_id}" \
      --if-match "${policy_etag}" \
      --response-headers-policy-config "file://${POLICY_CONFIG_FILE}" >/dev/null
    printf '%s\n' "${policy_id}"
  fi
}

# Optional. Infra may attach a per-app viewer-response function instead of the
# response-headers policy. Publish it only when the file is present.
publish_viewer_response_function() {
  local function_name="ezaudit-viewer-response"
  local function_code="${SCRIPT_DIR}/cloudfront/ezaudit-viewer-response.js"
  if [[ ! -f "${function_code}" ]]; then
    return 0
  fi

  local function_config='{"Comment":"EZ Audit viewer-response security headers","Runtime":"cloudfront-js-2.0"}'
  local etag
  if aws cloudfront describe-function --name "${function_name}" >/dev/null 2>&1; then
    etag="$(aws cloudfront describe-function --name "${function_name}" --query ETag --output text)"
    etag="$(aws cloudfront update-function \
      --name "${function_name}" \
      --if-match "${etag}" \
      --function-config "${function_config}" \
      --function-code "fileb://${function_code}" \
      --query ETag \
      --output text)"
  else
    etag="$(aws cloudfront create-function \
      --name "${function_name}" \
      --function-config "${function_config}" \
      --function-code "fileb://${function_code}" \
      --query ETag \
      --output text)"
  fi
  aws cloudfront publish-function \
    --name "${function_name}" \
    --if-match "${etag}" \
    --query "FunctionSummary.FunctionMetadata.FunctionARN" \
    --output text >/dev/null
  echo "Published CloudFront function ${function_name}"
}

cd "${REPO_ROOT}"

echo "=== Writing frontend/.env.production ==="
write_production_env

echo "=== Building frontend ==="
pnpm --dir ./frontend build --mode production

if [[ ! -f "${DIST_DIR}/index.html" ]]; then
  echo "Missing ${DIST_DIR}/index.html" >&2
  exit 1
fi

if [[ "${CLEAN_BUCKET}" == "true" ]]; then
  echo ""
  echo "=== Emptying S3 bucket: s3://${BUCKET} ==="
  aws s3 rm "s3://${BUCKET}" --recursive --region "${REGION}"
fi

if [[ -d "${DIST_DIR}/assets" ]]; then
  echo ""
  echo "=== Uploading hashed assets (no --delete) ==="
  aws s3 sync "${DIST_DIR}/assets" "s3://${BUCKET}/assets" \
    --size-only \
    --region "${REGION}" \
    --exclude ".DS_Store" \
    --exclude "*/.DS_Store" \
    --cache-control "public, max-age=31536000, immutable"
fi

if [[ "${FORCE_STATIC}" == "true" && -d "${DIST_DIR}/static" ]]; then
  echo ""
  echo "=== Uploading static/** (--force) ==="
  aws s3 sync "${DIST_DIR}/static" "s3://${BUCKET}/static" \
    --size-only \
    --region "${REGION}" \
    --exclude ".DS_Store" \
    --exclude "*/.DS_Store" \
    --cache-control "public, max-age=31536000, immutable"
elif [[ "${FORCE_STATIC}" == "true" ]]; then
  echo "No ${DIST_DIR}/static directory; nothing to sync."
else
  echo ""
  echo "=== Skipping static/** (pass --force to sync) ==="
fi

echo ""
echo "=== Uploading index.html (no edge cache) ==="
aws s3 cp "${DIST_DIR}/index.html" "s3://${BUCKET}/index.html" \
  --region "${REGION}" \
  --content-type "text/html" \
  --cache-control "no-cache, no-store, must-revalidate"

echo ""
echo "=== Security headers ==="
upsert_security_headers_policy >/dev/null
publish_viewer_response_function

echo ""
echo "=== Invalidating CloudFront ==="
INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)"
echo "Invalidation created: ${INVALIDATION_ID}"

echo ""
echo "=== Deploy complete ==="
echo "index.html: no-cache, no-store, must-revalidate"
echo "/assets/*: public, max-age=31536000, immutable (no --delete)"
if [[ "${FORCE_STATIC}" == "true" ]]; then
  echo "static/**: public, max-age=31536000, immutable"
else
  echo "static/**: skipped (no --force)"
fi
if [[ "${CLEAN_BUCKET}" == "true" ]]; then
  echo "bucket: emptied before upload (--clean)"
fi
