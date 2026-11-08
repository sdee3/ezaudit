import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("provision.sh applies an exact-function deny outside Convex ranges", () => {
  const directory = mkdtempSync(join(tmpdir(), "ezaudit-provision-test-"))
  const binDirectory = join(directory, "bin")
  const policyPath = join(directory, "caller-policy.json")
  const awsPath = join(binDirectory, "aws")
  const provisionPath = new URL("./provision.sh", import.meta.url)
  const awsStub = `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1 $2" == "iam put-user-policy" ]]; then
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--policy-document" ]]; then
      cp "\${2#file://}" "$AWS_POLICY_CAPTURE"
      exit 0
    fi
    shift
  done
fi
if [[ "$1 $2" == "lambda get-function-concurrency" ]]; then
  echo 4
elif [[ "$1 $2" == "lambda get-function-url-config" ]]; then
  if [[ "$*" == *"--query FunctionUrl"* ]]; then
    echo https://worker.lambda-url.us-east-1.on.aws/
  else
    echo AWS_IAM
  fi
fi
exit 0
`

  try {
    mkdirSync(binDirectory)
    writeFileSync(awsPath, awsStub)
    chmodSync(awsPath, 0o755)
    execFileSync("bash", [provisionPath.pathname], {
      env: {
        ...process.env,
        PATH: `${binDirectory}:${process.env.PATH}`,
        AWS_POLICY_CAPTURE: policyPath,
      },
      stdio: "ignore",
    })

    const policy = JSON.parse(readFileSync(policyPath, "utf8"))
    const deny = policy.Statement.find((statement) => statement.Sid === "DenyInvokeOutsideConvexRanges")
    assert.equal(deny.Effect, "Deny")
    assert.deepEqual(deny.Action, ["lambda:InvokeFunctionUrl", "lambda:InvokeFunction"])
    assert.equal(deny.Resource, "arn:aws:lambda:us-east-1:319777330480:function:ezaudit-lighthouse-worker")
    assert.deepEqual(deny.Condition.NotIpAddress["aws:SourceIp"], [
      "216.235.222.0/24",
      "2600:1f18:77e:2300::/56",
      "2600:1f10:4a09:7c00::/56",
    ])
    assert.equal(deny.Condition.Bool["aws:PrincipalIsAWSService"], "false")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
