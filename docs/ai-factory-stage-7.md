# DigiNanba Stage 7 — private AI factory foundation

## Included in this branch

- Additive migration: `db/migrations/20261012_private_ai_factory.sql`
- Authenticated job queue API: `GET/POST /api/admin/ai-factory/jobs`
- Authenticated review queue: `GET /api/admin/ai-factory/drafts?status=pending`
- Human review endpoint: `POST /api/admin/ai-factory/drafts/{draftId}/review`
- Protected worker: `POST /api/internal/ai-factory/worker` (or GET for a scheduler)
- OpenAI provider integration with JSON output validation and bounded retries
- GitHub Actions workflow for type checking and production build validation

All admin APIs require an authenticated session with the database role `AI Factory Manager` or `Super Admin`. Do not expose these APIs in the customer navigation.

## Required runtime configuration

Configure these as encrypted Vercel environment variables for the intended deployment only:

- `OPENAI_API_KEY`: API key from the AI provider account owner. Never commit it or paste it into chat.
- `OPENAI_MODEL`: optional; defaults to `gpt-4.1-mini`.
- `FACTORY_WORKER_SECRET`: a cryptographically random secret of at least 32 characters.

No secrets are included in the repository. Without `FACTORY_WORKER_SECRET`, the worker fails closed. Without `OPENAI_API_KEY`, no job is claimed or processed.

## Safe activation order

1. Review and merge the pull request only after its checks pass.
2. Back up the target hosted PostgreSQL database and confirm the current schema/version.
3. Apply only `db/migrations/20261012_private_ai_factory.sql` using the project's approved migration procedure. Do not re-run `db/schema.sql` wholesale against production.
4. Verify both `ai_factory_jobs` and `ai_factory_drafts` exist, then verify the role assignments for the intended operators.
5. Add the encrypted runtime secrets in Vercel. Redeploy the intended environment.
6. Trigger one test job with non-sensitive input, invoke the worker using `Authorization: Bearer <FACTORY_WORKER_SECRET>`, and verify the resulting status/output and audit record.
7. Review generated drafts through the private review API. Approval records review only; it does not publish a product or create a customer download.
8. Configure a scheduler only after the manual worker test succeeds. Keep its invocation authenticated and limited to one job per invocation.

## Security and launch boundaries

- AI output is untrusted draft content and must be reviewed by a human.
- The worker does not publish products, charge customers, create downloadable assets, or fulfill orders.
- Do not use real customer data as prompt input unless a separate privacy review approves it.
- Payments remain in demo mode. Do not enable public launch on the basis of this foundation alone.
- Migration application and runtime-secret configuration are environment operations; a Git commit does not perform them.
