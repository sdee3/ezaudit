# ADR 0003 — Send audit email through Resend

**Status:** accepted
**Date:** 2026-10-14
**Spec:** [04-backend-convex](../specs/04-backend-convex.md)

## Decision

Send the audit-ready email from the Convex action with Resend, the same way
`../astro-mate` does: `fetch("https://api.resend.com/emails")` using `RESEND_API_KEY`
and `RESEND_FROM_EMAIL`. Do not call the sibling `../mailer` service.

## Why

Astro Mate already runs this from Convex actions (`consultationEmails.ts`,
`moderationEmails.ts`). One HTTPS call, secrets on the Convex deployment, no extra
service to deploy or authenticate for a single notification.

## Consequences

- Convex env, per deployment: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (an EZ Audit
  sender on the existing Resend domain).
- If the key is missing, log and skip. A failed email must not fail the audit.
