# Batch 6 timezone source overlay

Extract this archive into the project root, preserving folders and allowing these files to replace their matching project files. Review the diff before keeping the changes.

Included changes:
- Portfolio timezone authority and review flag in Prisma schema.
- Migration that preserves a single legacy timezone only when PostgreSQL recognizes it; conflicts/invalid zones are flagged for review.
- Portfolio editor timezone setting and server-side IANA validation.
- Availability engine and booking API updates from the coordinated source patch.
- Portfolio-level timezone presentation in AvailabilityManager (no per-rule timezone selector).
- Public booking page passes the portfolio timezone and blocks display while review is required.

Safety: the migration has not been applied. This overlay has not been verified with the user's local TypeScript compiler, lint, tests, or production build. Do not run a database migration until those checks pass and the SQL is reviewed.
