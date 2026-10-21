#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT

mkdir -p "${TEMP_DIR}/backend/scripts" "${TEMP_DIR}/bin"
cp "${SCRIPT_DIR}/sync-convex-env.sh" \
  "${SCRIPT_DIR}/convex-with-env.sh" \
  "${SCRIPT_DIR}/load-backend-env.sh" \
  "${TEMP_DIR}/backend/scripts/"

cat > "${TEMP_DIR}/bin/npx" <<EOF
#!/usr/bin/env bash
set -euo pipefail
value="\$(cat)"
printf '%s|%s|%s\\n' "\${CONVEX_DEPLOYMENT}" "\${4}" "\${value}" >> '${TEMP_DIR}/calls.log'
EOF
chmod +x "${TEMP_DIR}/bin/npx"

cat > "${TEMP_DIR}/backend/.env.local" <<'EOF'
CONVEX_DEPLOYMENT=dev:test-deployment
CONVEX_DEPLOY_KEY=dev-test-key
LIGHTHOUSE_WORKER_URL=https://dev.lambda-url.us-east-1.on.aws/
LIGHTHOUSE_AWS_ACCESS_KEY_ID=dev-access-key
LIGHTHOUSE_AWS_SECRET_ACCESS_KEY=dev-secret-key
LIGHTHOUSE_WORKER_SECRET=stale-legacy-secret
EOF

cat > "${TEMP_DIR}/backend/.env.production" <<'EOF'
CONVEX_DEPLOYMENT=prod:test-deployment
CONVEX_DEPLOY_KEY=prod-test-key
LIGHTHOUSE_WORKER_URL=https://prod.lambda-url.us-east-1.on.aws/
LIGHTHOUSE_AWS_ACCESS_KEY_ID=prod-access-key
LIGHTHOUSE_AWS_SECRET_ACCESS_KEY=prod-secret-key
EOF

PATH="${TEMP_DIR}/bin:${PATH}" \
LIGHTHOUSE_WORKER_URL=https://inherited.lambda-url.us-east-1.on.aws/ \
LIGHTHOUSE_AWS_ACCESS_KEY_ID=inherited-access \
LIGHTHOUSE_AWS_SECRET_ACCESS_KEY=inherited-secret \
bash "${TEMP_DIR}/backend/scripts/sync-convex-env.sh" >/dev/null

grep -Fq 'dev:test-deployment|LIGHTHOUSE_WORKER_URL|https://dev.lambda-url.us-east-1.on.aws/' "${TEMP_DIR}/calls.log"
grep -Fq 'dev:test-deployment|LIGHTHOUSE_AWS_ACCESS_KEY_ID|dev-access-key' "${TEMP_DIR}/calls.log"
grep -Fq 'dev:test-deployment|LIGHTHOUSE_AWS_SECRET_ACCESS_KEY|dev-secret-key' "${TEMP_DIR}/calls.log"
! grep -Fq 'inherited-' "${TEMP_DIR}/calls.log"
! grep -Fq 'LIGHTHOUSE_WORKER_SECRET' "${TEMP_DIR}/calls.log"
! grep -Fq 'stale-legacy-secret' "${TEMP_DIR}/calls.log"

: > "${TEMP_DIR}/calls.log"
PATH="${TEMP_DIR}/bin:${PATH}" \
bash "${TEMP_DIR}/backend/scripts/sync-convex-env.sh" --prod >/dev/null
grep -Fq 'prod:test-deployment|LIGHTHOUSE_WORKER_URL|https://prod.lambda-url.us-east-1.on.aws/' "${TEMP_DIR}/calls.log"
grep -Fq 'prod:test-deployment|LIGHTHOUSE_AWS_ACCESS_KEY_ID|prod-access-key' "${TEMP_DIR}/calls.log"
grep -Fq 'prod:test-deployment|LIGHTHOUSE_AWS_SECRET_ACCESS_KEY|prod-secret-key' "${TEMP_DIR}/calls.log"
! grep -Fq 'dev-' "${TEMP_DIR}/calls.log"

cat > "${TEMP_DIR}/backend/.env.local" <<'EOF'
CONVEX_DEPLOYMENT=dev:test-deployment
CONVEX_DEPLOY_KEY=dev-test-key
LIGHTHOUSE_WORKER_URL=https://dev.lambda-url.us-east-1.on.aws/
LIGHTHOUSE_AWS_ACCESS_KEY_ID=dev-access-key
EOF
: > "${TEMP_DIR}/calls.log"
if PATH="${TEMP_DIR}/bin:${PATH}" bash "${TEMP_DIR}/backend/scripts/sync-convex-env.sh" >/dev/null 2>&1; then
  echo "Expected incomplete worker settings to fail." >&2
  exit 1
fi
[[ ! -s "${TEMP_DIR}/calls.log" ]]

echo "sync-convex-env checks passed"
