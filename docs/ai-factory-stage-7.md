# DigiNanba Stage 7 — private AI Factory foundation

## Included in this branch

- Additive migration: `db/migrations/20261012_private_ai_factory.sql`
- Authenticated job queue API: `GET/POST /api/admin/ai-factory/jobs`
- Authenticated review queue: `GET /api/admin/ai-factory/drafts?status=pending`
- Human review endpoint: `POST /api/admin/ai-factory/drafts/{draftId}/review`
- Protected worker: `POST /api/internal/ai-factory/worker` only
- OpenAI provider integration with JSON output validation and bounded retries
- Explicit legacy queue cleanup migration: `db/migrations/20261013_remove_legacy_product_factory.sql`
- GitHub Actions workflow for type checking and production build validation

All admin APIs require an authenticated session with the database role `AI Factory Manager` or `Super Admin`. Do not expose these APIs in customer navigation. There is one active queue: `ai_factory_jobs`; legacy `product_factory_jobs` endpoints and helpers have been removed from the application.

## Required runtime configuration

Configure these as encrypted Vercel environment variables for the intended deployment only:

- `OPENAI_API_KEY`: API key from the AI provider account owner. Never commit it or paste it into chat.
- `OPENAI_MODEL`: optional; defaults to `gpt-4.1-mini`.
- `FACTORY_WORKER_SECRET`: a cryptographically random secret of at least 32 characters.

No secrets are included in the repository. Without `FACTORY_WORKER_SECRET`, the worker fails closed. Without `OPENAI_API_KEY`, no job is claimed or processed. The worker accepts POST only; each authenticated invocation processes at most one job.

## Safe activation order

1. Keep this pull request unmerged until the branch checks and code review are complete.
2. Back up the intended database and confirm its current schema/version before any destructive operation.
3. Apply `db/migrations/20261012_private_ai_factory.sql` using the approved migration procedure.
4. Verify `ai_factory_jobs` and `ai_factory_drafts` exist and confirm role assignments for intended operators.
5. Only after confirming the new queue works and the legacy queue is no longer needed, review and separately approve `db/migrations/20261013_remove_legacy_product_factory.sql`. It drops `product_factory_jobs` and `product_factory_job_events` and removes the legacy permission. Do not apply this destructive migration automatically or against production without explicit authorization.
6. Add encrypted runtime secrets in the intended Vercel environment and redeploy that environment.
7. Trigger one test job with non-sensitive input, invoke the worker with `Authorization: Bearer <FACTORY_WORKER_SECRET>`, and verify status/output and audit record.
8. Review generated drafts through the private review API. Approval records review only; it does not publish a product or create a customer download.
9. Configure a scheduler only after the manual worker test succeeds. It must send an authenticated POST request.

The old migration `db/migrations/20261011_stage7_product_factory_jobs.sql` is retained as historical migration history. The cleanup migration is a separate follow-up; committing it does not execute it.

## Security and launch boundaries

- AI output is untrusted draft content and must be reviewed by a human.
- The worker does not publish products, charge customers, create downloadable assets, or fulfill orders.
- Do not use real customer data as prompt input unless a separate privacy review approves it.
- Payments remain in demo mode. This foundation alone is not sufficient for public launch.
- Git commits do not apply database migrations or configure runtime secrets.
