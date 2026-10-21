# Lambda and Convex security investigation

Research date: 2026-10-21

## Executive summary

The Lambda Function URL has a public internet address, but AWS_IAM requires signed requests from an authorized IAM principal. [6][7]

Browsers call Convex. The public audits.submit mutation accepts anonymous requests and schedules an internal action that signs a Lambda POST.

That action reads AWS caller credentials from Convex environment variables. It sends the requested URL in the signed JSON body.

The Lambda handler checks one allowed user ARN, validates target URLs, and launches Chromium through a local egress proxy.

Convex documentation publishes US East egress ranges. Both ezaudit deployments use aws-us-east-1 in repository Terraform. [1][17]

A caller IAM policy can deny both Function URL actions outside those ranges. AWS requires an explicit Deny because same-account identity and resource policies combine. [2][3][4]

Lambda AddPermission does not expose a SourceIp field. The source check belongs in the caller identity policy. [5]

The guard cannot identify this app's deployment. Convex shares the ranges across every deployment in a region. [1]

Hosted Convex has no direct private route into an AWS VPC endpoint. AWS's Lambda interface endpoint serves resources inside the VPC. [8]

Anonymous submissions can trigger public-site scans, retries, and emails. The four-slot Lambda cap limits concurrency, but it does not limit Convex queue entries.

Add a global and per-user or email quota, or require account verification and CAPTCHA. Preserve SigV4. Then add the IP Deny and monitor denials. [12][14][20]

Terraform and rotation fixes reduce policy drift. Network egress controls can contain browser compromise, with added cost and operations. [9]

Pass three corrected the earlier claim that source-IP filtering was impractical. The rule is feasible and remains defense in depth.

## Introduction

This report traces the browser, Convex, and AWS request path. It reviews ingress authentication, caller permissions, target validation, egress controls, and operations.

I inspected the ezaudit repository and its sibling infrastructure repository. I reviewed current AWS and Convex documentation. Three delegated passes traced the call path, built a threat model, and challenged each other's findings.

I did not query AWS or Convex. I did not run tests, provision infrastructure, or inspect secret values. Repository documentation reports an AWS read-only check on 2026-10-20. I did not repeat that check.

The source-IP analysis assumes both ezaudit Convex deployments use the configured aws-us-east-1 region. The sibling Terraform file records that region for dev and prod. [17]

## Main analysis

### Request path and access gates

1. The browser calls api.audits.submit through the Convex client. See [the form hook](../../frontend/src/components/AuditForm/hooks/index.tsx).
2. The public mutation accepts domain and email, allows signed-out callers, inserts a queued audit, then schedules the pipeline. See [audits.ts](../../backend/convex/audits.ts). Convex actions can call third-party services. [10]
3. The pipeline starts an internal action. It retries failures up to three total attempts, with five-second multiplied backoff. It emails the supplied address after success. See [auditPipeline.ts](../../backend/convex/auditPipeline.ts).
4. The Node action reads the worker URL and AWS access key from Convex environment variables. It requires an HTTPS Lambda URL in us-east-1. See [lighthouseWorker.ts](../../backend/convex/lighthouseWorker.ts).
5. The action signs a POST with SigV4. The signed JSON body contains the requested URL. The action accepts an optional AWS session token. See [lighthouseWorker.ts](../../backend/convex/lighthouseWorker.ts).
6. The AWS Function URL uses AWS_IAM. AWS requires SigV4 and both lambda:InvokeFunctionUrl and lambda:InvokeFunction permissions. [6][7]
7. The resource policy names the dedicated caller ARN. The handler also checks the exact ARN in the Function URL event. See [provision.sh](../../workers/lighthouse-worker/provision.sh) and [index.mjs](../../workers/lighthouse-worker/index.mjs).
8. The handler rejects credentials, non-web ports, localhost names, and DNS answers outside public IP ranges. The local proxy checks each connection and pins a checked public address. See [index.mjs](../../workers/lighthouse-worker/index.mjs) and [egress-proxy.mjs](../../workers/lighthouse-worker/egress-proxy.mjs).
9. The Function URL response returns to Convex. Convex checks response fields and score ranges, stores results, and sends the email.

The caller credentials stay inside Convex. The browser does not call AWS directly. The central exposure is the public mutation's ability to trigger the authenticated worker.

### Secondary findings

An owner must enable public visibility before a report becomes public. The public query then returns every audit field except the guest token hash and expiry. This includes email and userId. Return only report fields from the public query. See [audits.ts](../../backend/convex/audits.ts).

The handler defaults to bearer mode if LIGHTHOUSE_AUTH_MODE is absent. It returns 503 when the bearer secret is missing. The provisioning script sets IAM mode only when it creates the function. Keep IAM mode explicit and remove unused bearer secrets. See [index.mjs](../../workers/lighthouse-worker/index.mjs).

The Chromium package supplies the --no-sandbox flag. The handler removes only --single-process. This weakens Chromium process isolation while it loads user-selected public websites. See [the package flags](https://www.npmjs.com/package/@sparticuz/chromium-min/v/153.0.0) and [the launch code](../../workers/lighthouse-worker/index.mjs).

The Lambda execution role receives the basic logging policy. The worker still has unrestricted internet routing outside its application proxy. See [provision.sh](../../workers/lighthouse-worker/provision.sh) and [the runbook](../../workers/lighthouse-worker/README.md).

### Source-IP filtering is feasible

Convex documents outbound IP ranges for each region. Its US East ranges are 216.235.222.0/24, 2600:1f18:77e:2300::/56, and 2600:1f10:4a09:7c00::/56. [1]

Both ezaudit deployments use aws-us-east-1 in the sibling Terraform file. AWS maps that region to Convex's US East range. [17]

AWS exposes aws:SourceIp as a global IAM condition key for public source ranges. It supports IPv4 and IPv6. It is absent when a requester uses a VPC endpoint. [3]

The ezaudit caller already has an identity policy and a separate Lambda resource policy. Both policies grant invocation in the same AWS account. AWS combines those grants as a union. An Allow-only source condition in the identity policy would leave the resource grant intact. An explicit Deny overrides both grants. [2]

Add one Deny statement to the caller policy in [provision.sh](../../workers/lighthouse-worker/provision.sh). Set its actions to lambda:InvokeFunctionUrl and lambda:InvokeFunction. Set its resource to the exact function ARN.

Use NotIpAddress on aws:SourceIp with all three Convex ranges. Add Bool aws:PrincipalIsAWSService equal to false. AWS advises this condition for Deny policies that use aws:SourceIp. [3][4]

Negated conditions evaluate true when the request context lacks the key. Therefore, the rule denies a request if AWS supplies no source IP. The public Function URL request uses the public network path. [3][4][7]

Lambda AddPermission has no SourceIp input. It supports the FunctionUrlAuthType and InvokedViaFunctionUrl conditions. Put the source rule in the caller identity policy, not the Lambda permission statement. [5]

This rule blocks the dedicated key from ordinary internet hosts outside Convex's published ranges. It does not identify one ezaudit deployment. Convex says each regional range is shared across all deployments in that region. A stolen key used by another Convex deployment in US East still matches. [1]

This rule adds a dependency on Convex's published ranges. Update the policy when those ranges change. Before enforcement, record the source address from a successful signed request. Then test a request from an address outside the ranges. Keep a rollback that removes only the Deny statement.

The first review pass said source-IP filtering was impractical because the repository lacked Convex network documentation. The third pass found Convex's published ranges and corrected that conclusion. The second limitation remains valid. The ranges are regional, shared, and not deployment-specific. [1]

### Hosted Convex has no direct private Lambda route

The current action calls an internet-routable Function URL. AWS documents that Function URLs accept HTTP(S) requests and that AWS_IAM protects requests with SigV4. [6][7]

AWS PrivateLink can expose Lambda APIs to resources inside an AWS VPC. It does not create a route from a managed Convex deployment into this account's VPC. [8]

This is an architecture inference. The repository configures hosted Convex deployments and a public Function URL. It has no VPC connection, private endpoint, or relay between Convex and AWS. [17]

A private network path would require another design. Options include self-hosting Convex inside a reachable network or adding an AWS relay with a private leg to Lambda. An AWS relay still needs a protected public-facing entry for hosted Convex.

The worker's outbound target path is separate. The worker has public internet access and no VPC egress rule. Its local proxy provides application checks, not network isolation. See [the runbook](../../workers/lighthouse-worker/README.md). [9]

A VPC egress design could force browser traffic through a controlled proxy or firewall. Lambda then needs a route to public websites through that service. AWS's normal VPC internet path uses NAT resources. This adds cost and operations. [9]

### Public intake is the main abuse path

The public submit mutation accepts an email and domain without authentication. It inserts an audit and schedules work immediately. I found no rate-limit check in this function or its pipeline. See [audits.ts](../../backend/convex/audits.ts). Convex documents rate-limiter components for per-key and global limits inside a mutation. [12][13][16]

The URL checks block private and special-use addresses. They still allow any public host on HTTP port 80 or HTTPS port 443. The worker can therefore scan public sites through a trusted AWS account. It is not an unrestricted private-network SSRF path. See [index.mjs](../../workers/lighthouse-worker/index.mjs) and [egress-proxy.mjs](../../workers/lighthouse-worker/egress-proxy.mjs).

The audit pipeline sends a result email to the submitted address. The public caller can select that address. The code does not verify mailbox ownership before the send. See [auditPipeline.ts](../../backend/convex/auditPipeline.ts).

Lambda reserved concurrency is four. This limits active Lambda invocations. Excess requests receive 429 responses. It does not stop Convex from storing more public audit submissions. [14]

Three attempts per audit cap retry count. They still multiply worker use for failing targets. Per-user and per-email limits can reduce repeat submissions. A global limit or CAPTCHA can reduce guest abuse. Verify email ownership before sending results. [12]

Convex usage limits can cap Convex deployment resource use. They do not directly cap AWS Lambda cost. Add an AWS cost budget for spend alerts. CloudTrail does not log Function URL invocations by default. Enable Lambda data events if invocation attribution is required. [15][19][20]

### Provisioning and credential gaps

The Lambda worker is provisioned by a shell script. The ezaudit Terraform stack contains frontend resources, while the backend specification says there is no Lambda Terraform stack or image publish workflow. See [the backend specification](../../docs/specs/04-backend-convex.md).

The script manages one IAM caller user and one allowed caller ARN. It sets the handler's IAM environment values only when it creates the function. It does reconcile reserved concurrency and Function URL auth on later runs. See [provision.sh](../../workers/lighthouse-worker/provision.sh).

The script uses fixed resource statement IDs. If a statement already exists, it skips the new permission. Changing the caller principal does not safely replace the old principal or update the handler ARN. The current runbook rotates keys for the same IAM user, which preserves the ARN. See [provision.sh](../../workers/lighthouse-worker/provision.sh).

The Convex action uses long-lived IAM access keys unless an operator supplies a session token. The code accepts a session token, but it has no credential exchange or refresh flow. AWS recommends temporary credentials for workloads. [18]

Convex allows different environment values for dev and prod. The repository does not prove whether both deployments hold the same key. The worker accepts one ARN, so a dev credential with that ARN can invoke the same worker as prod. Separate the worker identities and endpoints if you need environment isolation. [11]

The handler defaults to bearer mode when LIGHTHOUSE_AUTH_MODE is absent. It returns 503 when the bearer secret is missing. The provisioning script sets IAM mode only on function creation. Keep IAM mode explicit in managed configuration and remove unused bearer secrets. See [index.mjs](../../workers/lighthouse-worker/index.mjs).

### Request and image integrity

The signed request body contains the target URL, but no audit ID or unique job token. The Lambda response includes a request ID, but Convex does not compare it with a value generated for the audit. See [lighthouseWorker.ts](../../backend/convex/lighthouseWorker.ts) and [index.mjs](../../workers/lighthouse-worker/index.mjs).

Add a Convex-generated audit ID and nonce to the signed body. Echo the audit ID in the response and compare it before persistence. This binds stored results to the request.

The Dockerfile pins the Chromium release version in its URL, but it checks no archive hash. It also copies proof.mjs into the production image. See [Dockerfile](../../workers/lighthouse-worker/Dockerfile).

Pin the base image by digest, verify the Chromium archive checksum, and omit proof.mjs from the production image. These controls reduce build supply-chain and image-content risk.

## Synthesis

The AWS ingress control is stronger than a public endpoint label suggests. The Function URL is public by address, but AWS_IAM, SigV4, an exact IAM identity policy, and a resource policy restrict invocation.

The application layer remains the easiest path to abuse. A public Convex mutation can request work through the privileged Lambda identity without exposing AWS credentials to the browser.

The Convex CIDR Deny is the most direct network-source control. It needs no new endpoint or secret. Its shared ranges make it a second factor for network origin, not a deployment identity.

Private connectivity and browser egress are separate problems. AWS PrivateLink does not connect hosted Convex to the account VPC. A VPC around Lambda can control the worker's outbound path, but it adds infrastructure.

The lowest-cost sequence is application rate limiting, an IAM source-IP Deny, then infrastructure-as-code and rotation fixes. Add private egress controls only if browser compromise warrants their cost.

## Limitations

The repository documents a read-only AWS check on 2026-10-20. It reports an active arm64 worker, 2048 MB memory, 120-second timeout, and AWS_IAM auth. It also reports a successful prod audit that day. I did not repeat the check. See [the backend specification](../../docs/specs/04-backend-convex.md).

The deployed IAM identity policy, Lambda resource policy, handler environment, CloudTrail selectors, alarms, and Convex environment values remain unverified. The runbook says a signed request from an unauthorized IAM user was not tested. See [the runbook](../../workers/lighthouse-worker/README.md).

The source-IP Deny has not been applied or tested. A mistaken CIDR list can reject every audit. Test both an allowed Convex request and a denied external request before enabling the rule in production.

The source-IP list came from Convex documentation retrieved on 2026-10-21. The documentation does not make it a per-deployment identity or a guaranteed unchanged range. [1]

## Recommendations

1. Add a global and per-user or email rate limit to audits.submit. Require CAPTCHA or sign-in for guest traffic, and verify email before sending results. [12][13]
2. Add an explicit NotIpAddress Deny to the caller identity policy. Include both Lambda actions, the exact function ARN, all three US East CIDRs, and the AWS service-principal condition. [1][2][3][4]
3. Confirm the Function URL source address before enforcement. Enable CloudTrail Lambda data events and alert on unexpected invocation volume or denied requests. [19]
4. Move the function, URL, caller policy, resource policy, role, ECR settings, and concurrency into Terraform. Make principal rotation replace both resource statements and the handler's allowed ARN. [5]
5. Split dev and prod worker identities. Consider a short-lived credential exchange if Convex can present a trusted workload identity. [11][18]
6. Add a Convex usage limit and an AWS cost budget. Keep the Lambda concurrency cap at four. These controls limit different costs. [14][15][20]
7. Bind each result to an audit ID and nonce. Add a Chromium checksum and pin the container base image by digest.
8. Add VPC egress control only after a cost review. Route browser traffic through a controlled proxy or firewall. [9]

## Counterevidence register

| Claim | Evidence-based correction |
|---|---|
| A public Function URL accepts anonymous requests. | AWS_IAM requires SigV4 and IAM permissions. The repository names one caller ARN. [6][7] |
| Convex source-IP filtering is impractical. | Convex publishes US East IPv4 and IPv6 ranges. The ranges are shared across regional deployments. [1] |
| The proxy makes the worker safe from SSRF. | The proxy rejects private addresses, but it permits any public web host on ports 80 and 443. |
| Reserved concurrency stops submission abuse. | It caps simultaneous Lambda runs. It does not stop public Convex submissions from entering the queue. [14] |
| Dev and prod definitely share one secret. | The code accepts one principal. The live values were not inspected. [11] |
| The report confirms live policy state. | It uses repository code and a prior dated status note. I did not query AWS or Convex. |

## Claims-Evidence Table

| Claim | Repository evidence | Official evidence | Confidence |
|---|---|---|---|
| Convex signs the Lambda request with SigV4. | [lighthouseWorker.ts](../../backend/convex/lighthouseWorker.ts) | [6], [7] | High |
| An explicit Deny is required for the source-IP rule. | [provision.sh](../../workers/lighthouse-worker/provision.sh) | [2], [3], [4] | High |
| Convex US East ranges match both configured ezaudit regions. | [deployments.tf](https://github.com/sdee3/infrastructure/blob/main/convex/deployments.tf) | [1], [17] | High |
| The worker can reach arbitrary public web hosts. | [index.mjs](../../workers/lighthouse-worker/index.mjs), [egress-proxy.mjs](../../workers/lighthouse-worker/egress-proxy.mjs) | [9] | High |
| Anonymous intake can trigger worker use and email. | [audits.ts](../../backend/convex/audits.ts), [auditPipeline.ts](../../backend/convex/auditPipeline.ts) | [12], [13], [16] | High |
| Hosted Convex has no direct private Lambda VPC route in this design. | [deployments.tf](https://github.com/sdee3/infrastructure/blob/main/convex/deployments.tf), [lighthouseWorker.ts](../../backend/convex/lighthouseWorker.ts) | [7], [8] | Medium. This is an architecture inference. |

## Bibliography

[1] Convex. “Networking.” Convex Developer Hub. [Networking](https://docs.convex.dev/production/networking) Retrieved 2026-10-21.

[2] Amazon Web Services. “Policy evaluation logic.” AWS Identity and Access Management. [Policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html) Retrieved 2026-10-21.

[3] Amazon Web Services. “AWS global condition context keys.” AWS Identity and Access Management. [AWS global condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html) Retrieved 2026-10-21.

[4] Amazon Web Services. “IAM JSON policy elements: Condition operators.” AWS Identity and Access Management. [IAM JSON policy elements: Condition operators](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html) Retrieved 2026-10-21.

[5] Amazon Web Services. “AddPermission.” AWS Lambda API Reference. [AddPermission](https://docs.aws.amazon.com/lambda/latest/api/API_AddPermission.html) Retrieved 2026-10-21.

[6] Amazon Web Services. “Control access to Lambda function URLs.” AWS Lambda Developer Guide. [Control access to Lambda function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html) Retrieved 2026-10-21.

[7] Amazon Web Services. “Invoking Lambda function URLs.” AWS Lambda Developer Guide. [Invoking Lambda function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html) Retrieved 2026-10-21.

[8] Amazon Web Services. “Connecting inbound interface VPC endpoints for Lambda.” AWS Lambda Developer Guide. [Connecting inbound interface VPC endpoints for Lambda](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-endpoints.html) Retrieved 2026-10-21.

[9] Amazon Web Services. “Enable internet access for VPC-connected Lambda Event Functions.” AWS Lambda Developer Guide. [Enable internet access for VPC-connected Lambda Event Functions](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-internet.html) Retrieved 2026-10-21.

[10] Convex. “Actions.” Convex Developer Hub. [Actions](https://docs.convex.dev/functions/actions) Retrieved 2026-10-21.

[11] Convex. “Environment Variables.” Convex Developer Hub. [Environment Variables](https://docs.convex.dev/production/environment-variables) Retrieved 2026-10-21.

[12] Convex. “Rate Limiting.” Convex Developer Hub. [Rate Limiting](https://docs.convex.dev/agents/rate-limiting) Retrieved 2026-10-21.

[13] Convex. “Scheduled Functions.” Convex Developer Hub. [Scheduled Functions](https://docs.convex.dev/scheduling/scheduled-functions) Retrieved 2026-10-21.

[14] Amazon Web Services. “Creating and managing Lambda function URLs.” AWS Lambda Developer Guide. [Creating and managing Lambda function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html) Retrieved 2026-10-21.

[15] Convex. “Usage Limits.” Convex Developer Hub. [Usage Limits](https://docs.convex.dev/production/usage-limits) Retrieved 2026-10-21.

[16] Convex. “Internal Functions.” Convex Developer Hub. [Internal Functions](https://docs.convex.dev/functions/internal-functions) Retrieved 2026-10-21.

[17] Convex. “Regions.” Convex Developer Hub. [Regions](https://docs.convex.dev/production/regions) Retrieved 2026-10-21.

[18] Amazon Web Services. “Security best practices in IAM.” AWS Identity and Access Management. [Security best practices in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html) Retrieved 2026-10-21.

[19] Amazon Web Services. “Monitoring Lambda function URLs.” AWS Lambda Developer Guide. [Monitoring Lambda function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-monitoring.html) Retrieved 2026-10-21.

[20] Amazon Web Services. “Managing your costs with AWS Budgets.” AWS Cost Management. [Managing your costs with AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) Retrieved 2026-10-21.

## Methodology appendix

### Review passes

1. Pass 1 traced the browser submission, Convex functions, SigV4 request, Lambda handler, and response.
2. Pass 2 threat-modeled abuse, credentials, egress, IAM, and provisioning risks.
3. Pass 3 challenged the first two results and reconciled the source-IP question, policy evaluation, and dev/prod uncertainty.

The final report accepts the Convex source-IP control as feasible. It rejects the claim that the source ranges are deployment-specific. It treats current environment and policy values as unknown.

### Evidence method

The review used local code, infrastructure definitions, deployment notes, and official AWS and Convex documentation. The evidence folder contains the source registry, excerpt ledger, and claim ledger.

Code claims cite repository paths and line numbers. Platform claims cite current vendor documentation. The source-IP finding uses Convex networking and region documentation, AWS condition-key rules, IAM policy evaluation, and Lambda permission API fields.

The review used three delegated passes. It did not query live AWS or Convex control planes. It did not run tests or change application code.

### Source coverage

The bibliography contains 20 official AWS and Convex sources. The local evidence records cover the browser caller, public mutation, internal pipeline, Lambda handler, egress proxy, provisioning script, runbook, and deployment files.

The investigation used primary platform documentation because the findings depend on current AWS IAM and Convex networking behavior. The report marks architecture conclusions as inferences where vendor documentation does not define this exact deployment.

### Report metadata

Research mode: Standard summary.

Validation: The report passed structure and citation checks. Twenty official source URLs returned successfully.

Claim support: All 22 tracked claims received supported status. No factual claim received an unsupported status.

Source count: 20 official documents plus 14 local repository files.

Generated: 2026-10-21.

Live AWS and Convex checks: Not performed.

## Implementation status, 2026-10-21

The report records the pre-change state. The local tree now contains all six planned
controls. Focused tests pass. Terraform has not been applied.

1. `audits.submit` requires a signed-in user with a verified matching email. It applies
   global, user, and email hourly limits.
2. The Lambda caller policy denies invocation outside Convex's shared `us-east-1` ranges.
3. Terraform declares both Lambda workers, their callers, Function URLs, and imports for
   the existing production resources.
4. The Convex sync script reads separate development and production worker settings.
5. The worker request and response carry the audit ID. Public reports omit owner email
   and user ID.
6. The worker VPC permits egress through a restricted Squid proxy. The Lambda handler
   fails closed when IAM mode lacks the proxy URL.

The shared Clerk `convex` JWT template must include `email` and `email_verified` claims.
See [identity auth](../specs/03-identity-auth.md). Deploy the Lambda image before the
Convex action. Review the Terraform plan before apply.

Focused checks passed: 24 backend tests, 9 frontend tests, 20 worker tests, the
Convex sync script test, and the Terraform mock-provider test. Backend and frontend
TypeScript checks passed. No AWS or Convex operation ran.
