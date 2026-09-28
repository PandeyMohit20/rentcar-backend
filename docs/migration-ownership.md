# Migration ownership: Model C

Model C is the approved project policy. `rentcar-backend/prisma/migrations`
is the canonical executable migration chain for application deployments.
Future application migrations belong here unless this policy is explicitly
changed. This policy supersedes earlier documentation assigning application
migration ownership to `rentcar-database`.

## Foundation and legacy history

`00000000000000_baseline` consolidates the August foundation for a fresh
database. Existing databases may retain these legacy records originating in
`rentcar-database`:

- `20260808102136_initial_schema`
- `20260808105511_hardening`

Preserve those records without deleting or rewriting them. Do not copy the
August migrations into the backend executable chain: running them together
with the baseline would duplicate foundation DDL. Historical source SQL may
remain in its original repository for provenance.

The established historical baseline representation is UTF-8 with BOM, CRLF,
and two trailing CRLF sequences. Its SHA-256 is
`29becca0b34b90d1a87c5cfd2cceaed9cda09a266a3ac1e6ad74267ae6a35ae7`.
Any byte restoration must preserve SQL content and achieve that exact hash.
Check Git attributes, clean filters, line-ending settings, and editor settings
before restoring it. Stop if tooling cannot safely preserve the bytes.
This one historical migration is intentionally byte-sensitive. The
path-specific `-text` rule in `.gitattributes` disables Git line-ending
normalization for it, including when `core.autocrlf=true`. Future migrations
retain their existing behavior. There is no repository `.editorconfig`;
editors must preserve UTF-8 BOM, CRLF, and both trailing CRLF sequences for
this file. Avoid formatting or resaving it; verify its SHA-256 after any
tool touches it. Git attributes do not prevent an editor from rewriting bytes.

## Deployment process

1. Confirm the intended environment, host, database name, and effective
   connection fingerprint without logging credentials. Production deployment
   requires its own explicit authorization and recovery arrangements.
2. Read migration history and schema evidence. Investigate failed migrations,
   unexpected pending migrations, and unexpected schema state before proceeding.
3. Validate the canonical chain on an isolated empty database and, where
   applicable, validate the upgrade against an isolated representative copy.
   Never reset a shared database to test a bootstrap.
4. Review the exact pending SQL and confirm only intended migrations will run.
5. Use `npx prisma migrate deploy` for authorized development and production
   deployments. Stop on errors; do not rewrite history to bypass them.
6. Verify successful migration records, columns, indexes, foreign keys, and
   application smoke checks. Run `npx prisma generate`, targeted tests, and the
   full regression suite before treating the foundation as ready.

Forbidden shortcuts include `prisma migrate dev` on shared databases,
`prisma migrate reset`, `prisma db push`, and casual `prisma migrate resolve`.
Do not use resolve merely to make migration status green.

## Clean bootstrap

Use a positively identified empty isolated database and the backend chain:
baseline, then the September migrations in directory order. Do not add the
legacy August migrations. Run `npx prisma migrate deploy` with the isolated
connection, verify the resulting schema, and run `npx prisma migrate status`.
A disposable validation database may be dropped only when it was created by
the current task and its identity has been positively verified. Never drop
the existing `rentcar` database as part of validation.

## Legacy migration status

On legacy databases, `prisma migrate status` may report the two August
migrations as present in the database but absent locally. That specific
divergence is accepted under Model C; it does not authorize ignoring other
history or schema discrepancies. Preserve the legacy records and assess
pending migrations and schema evidence separately. Do not silence this
accepted divergence by editing `_prisma_migrations` or using resolve.

## Current reconciliation validation

The intended development target is `localhost/rentcar`. Byte restoration and
Git round-trip verification precede isolated bootstrap validation. Deployment
to that existing database remains conditional on the isolated bootstrap and
the authorized legacy history/schema prechecks passing.
