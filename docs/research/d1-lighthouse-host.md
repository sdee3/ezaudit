# D1 — Where Lighthouse can run, and what it costs

Question: Convex actions cannot launch Chrome. What is the cheapest AWS or Cloudflare
place to run a real Lighthouse audit (Node + Chromium), preferably at $0?

Date: 2026-10-14. Prices below are the published on-demand rates, not a quote.

## What the worker has to do

`ProcessAuditJob` POSTs `{ url }` and reads four Lighthouse category scores
(`accessibility`, `best-practices`, `performance`, `seo`). The UI stores only those
four numbers. The runner still has to be Lighthouse itself: a Node process attached to
Chromium. A screenshot or HTML-fetch API is not a substitute.

## Chosen host

**AWS Lambda, container image, arm64, Lambda Function URL, not in a VPC.**

Convex calls it through a Node action that signs the Function URL with SigV4. The
action reads a dedicated IAM access key from Convex environment variables. Suggested
size: 2048 MB, timeout 120 seconds. 1769 MB is
one vCPU; Lighthouse plus Chromium wants at least that. Return the four category
scores, not screenshots or the trace, so the body stays under Lambda's synchronous
payload limit and Convex documents stay small.

This stays inside Lambda's always-free monthly allotment for a few thousand audits.
Nothing else on AWS or Cloudflare does, once the requirement is "actually run
Lighthouse."

### Why the bill can be $0

Lambda's always-free offer, shared by every regional function in the account (x86 and
Graviton together), is:

- 1,000,000 requests per month
- 400,000 GB-seconds per month

Source: [AWS Lambda on the Free Tier](https://aws.amazon.com/pm/lambda/) ("always free")
and [Lambda pricing](https://aws.amazon.com/lambda/pricing/) (same two limits; 512 MB
of ephemeral storage included; duration examples use **$0.0000166667 per GB-second on
x86** and **$0.0000133334 per GB-second on Arm**).

A 2048 MB function billed for 60 seconds is 120 GB-seconds. 400,000 / 120 ≈ **3,300
audits per month** before any compute charge. Requests are not the limit. Past the
allotment, that same audit is about $0.002 on x86 (120 × $0.0000166667) and less on
Arm.

Hard limits that fit this job, from
[Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html):

- Timeout up to 900 seconds ([timeout docs](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html)).
- Memory 128–10,240 MB. At 1,769 MB the function gets one vCPU.
- Provisioned concurrency is excluded from the free tier (pricing page). Do not turn
  it on.
- Do not put the function in a VPC. A NAT gateway is a standing hourly charge and is
  unnecessary for crawling public URLs.

Packaging: use a container image. `@sparticuz/chromium` ships arm64 builds; the brotli
binary is about 51 MB and Chromium uncompressed is about 152 MB, which misses the
50 MB zip upload cap many hosts enforce
([Sparticuz/chromium#8](https://github.com/Sparticuz/chromium/issues/8),
[Sparticuz/chromium](https://github.com/Sparticuz/chromium)).

The free tier is **per account**, not per function. Sibling apps today use
Lambda@Edge, which is priced separately and does not draw this allotment. Before
relying on $0, check that no other regional Lambda in the account is already using
the 400,000 GB-seconds. Keep CloudWatch logs small; a full Lighthouse JSON log line
would be the first thing to create a real charge.

## Rejected

### Cloudflare Workers + Browser Run

Workers Free allows **10 milliseconds of CPU time per invocation**
([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
Lighthouse cannot run there. Browser Run provides the browser, not the Node host.

Browser Run on the free plan is **10 minutes of browser time per day**, 3 concurrent
browsers, and a new browser at most once every 20 seconds
([limits](https://developers.cloudflare.com/browser-run/limits/),
[pricing](https://developers.cloudflare.com/browser-run/pricing/)). That is on the
order of ten audits a day, and only if something else runs Lighthouse. Workers Paid
includes 10 browser-hours a month, then **$0.09 per browser hour**, and still does
not give you a place to execute the Lighthouse CLI.

### Cloudflare Containers

Containers can run the same image, and they scale to zero. The pricing table's free
column is N/A. They bill only on the **$5/month Workers Paid** plan, which then
includes 25 GiB-hours, 375 vCPU-minutes, and 200 GB-hours
([Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)).
That is the cheapest Cloudflare option that can actually run Lighthouse, and it has
a $5 floor Lambda does not.

### Fargate

Fargate has no free tier. Billing starts when the image pull starts, with a **1
minute minimum**, and a task with a public IPv4 address is billed for that address
too ([Fargate pricing](https://aws.amazon.com/fargate/pricing/)).

Linux/x86 in US East (Ohio) on that page: **$0.04048 per vCPU-hour** and **$0.004445
per GB-hour**. An always-on 1 vCPU / 2 GB task is about $36/month before the IPv4
charge and before any load balancer. A per-audit task avoids the idle cost but still
needs an HTTPS front door. A Lambda Function URL does not.

### Google PageSpeed Insights

Out of scope for this decision (not AWS or Cloudflare). It returns a
`lighthouseResult` and would be enough for the four scores, but the crawl runs on
Google's quota, not ours. Not chosen.

## Capacity sketch

| Host | Standing cost | Can run Lighthouse? | Rough free capacity |
|---|---|---|---|
| Lambda container + Function URL | $0 inside the account free tier | Yes (up to 15 min) | ~3,300 audits/month at 2 GB × 60 s |
| Fargate | None, but no free tier; ~$36/month if left running | Yes | None |
| Workers + Browser Run | $0 on the free plan | No | ~10 min of browser time/day, and no Node runner |
| Cloudflare Containers | $5/month Workers Paid | Yes | Included GiB-hours / vCPU-minutes after the $5 |
