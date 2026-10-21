# ADR 0001 — Run Lighthouse on AWS Lambda

**Status:** accepted
**Date:** 2026-10-14
**Spec:** [04-backend-convex](../specs/04-backend-convex.md)

## Decision

Run Lighthouse in an AWS Lambda arm64 container image with 2048 MB and a 120 second
timeout. Expose an `AWS_IAM` Function URL. Place the function in a private VPC subnet
with access only to an in-VPC Squid proxy. `auditPipeline.run` calls a Node action that
signs the request with SigV4. The action reads a dedicated IAM access key from Convex
environment variables. The worker returns the four category scores the UI already stores.

## Why

Convex cannot launch Chrome. At 100 audits per month and 11.3 seconds each, the
estimated Lambda compute charge is about $0.04 before any account-wide free tier.
See the worker runbook for the full monthly estimate and its assumptions.

Cloudflare Workers cannot run the Lighthouse Node program (10 ms CPU on the free
plan). Browser Run only supplies a browser, capped at 10 minutes a day on the free
plan. Cloudflare Containers can run the image but require the $5/month Workers Paid
plan. Fargate has no free tier and a standing cost if the task is left running.

Evidence and sources: [d1-lighthouse-host](../research/d1-lighthouse-host.md).

## Consequences

- Confirm the account's other regional Lambda functions are not already consuming the
  400,000 GB-second allotment. Lambda@Edge does not draw it.
- Do not enable provisioned concurrency, and do not log the full Lighthouse JSON.
- Package Chromium in the container image. The image uses `@sparticuz/chromium-min` 153.0.0
  and downloads the arm64 Chromium 153.0.0 pack in the Dockerfile. A zip is the wrong
  package for that binary.
- Restrict the IAM principal to this Function URL. Rotate its credentials.
- Reserve concurrency at four audits.
- Terraform manages the Lambda, Function URLs, IAM policies, private subnet, and proxy.
- The proxy allows outbound TCP ports 80 and 443. The Lambda security group allows only
  traffic to the proxy on TCP port 3128. This path has no NAT gateway.
- The proxy adds an always-on instance and public IPv4 cost. The worker runbook records
  the estimate and cost limits.

## Update 2026-10-21

The original choice to run outside a VPC changed after the threat review. The private
subnet and proxy limit worker egress if Chromium or page content compromises the process.
This adds a standing cost and a single proxy failure point. Terraform declares these
resources, but no apply occurred during this change.
