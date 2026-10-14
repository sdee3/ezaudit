# ADR 0004 — Migrate legacy audit rows

**Status:** accepted
**Date:** 2026-10-14
**Spec:** [08-migration-plan](../specs/08-migration-plan.md)

## Decision

Migrate the Laravel `audits` rows. Do not discard them.

## Why

Those rows are the product's history. The import is a one-off, not a permanent API.

## Consequences

- Export the MySQL rows to JSON and import them with a temporary `internalMutation`
  (`audits.importLegacy`), then delete the mutation.
- Map `audit_result` JSON strings to objects and `is_public` 0/1 to booleans.
- Map legacy user ids to Clerk subjects where Identity has the same email. Rows with
  no matching email stay imported and ownerless until a manual match exists; they are
  not dropped.
