# ADR 0002 — Keep PDF generation in the browser

**Status:** accepted
**Date:** 2026-10-14
**Spec:** [04-backend-convex](../specs/04-backend-convex.md)

## Decision

Keep the existing browser print path (`AuditResult` → `window.print()`). Do not add a
server-side PDF renderer in this conversion.

## Why

The cherished UI already prints the report. A server renderer (Snappy today, Puppeteer
in the Lighthouse image later) costs a Chrome dependency and changes the artifact the
user downloads. Parity is the requirement.

## Consequences

- `pdf_path` and Snappy go away with Laravel. The print stylesheet is the report.
- A downloadable server PDF is a later product decision, not part of the migration.
