# ADR 0001 — Run Lighthouse on AWS Lambda

**Status:** accepted
**Date:** 2026-10-14
**Spec:** [04-backend-convex](../specs/04-backend-convex.md)

## Decision

Run Lighthouse in an AWS Lambda container image (arm64, about 2048 MB, 120 second
timeout), exposed with a Function URL, not attached to a VPC. `auditPipeline.run`
calls it with `LIGHTHOUSE_WORKER_URL` and `LIGHTHOUSE_WORKER_SECRET`. The response is
the four category scores the UI already stores.

## Why

Convex cannot launch Chrome. Lambda's always-free tier (1,000,000 requests and
400,000 GB-seconds per month, account-wide) covers on the order of 3,300 audits a
month at 2 GB for 60 seconds, and the 15 minute timeout fits a real Lighthouse run.

Cloudflare Workers cannot run the Lighthouse Node program (10 ms CPU on the free
plan). Browser Run only supplies a browser, capped at 10 minutes a day on the free
plan. Cloudflare Containers can run the image but require the $5/month Workers Paid
plan. Fargate has no free tier and a standing cost if the task is left running.

Evidence and sources: [d1-lighthouse-host](../research/d1-lighthouse-host.md).

## Consequences

- Confirm the account's other regional Lambda functions are not already consuming the
  400,000 GB-second allotment. Lambda@Edge does not draw it.
- Do not enable provisioned concurrency, and do not log the full Lighthouse JSON.
- Package Chromium in the container image (`@sparticuz/chromium` arm64). A zip is the
  wrong package for that binary.
