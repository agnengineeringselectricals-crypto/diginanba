# DigiNanba Development Backlog

Last reviewed: 2026-11-09  
Repository: https://github.com/agnengineeringselectricals-crypto/diginanba  
Production branch: `main`

## Working rules
- Record every requested correction or feature before implementation.
- Inspect the current implementation and affected dependencies before editing.
- Group related changes into a coherent batch; avoid one deployment per small edit.
- Keep feature work on development branches. Do not push unfinished work directly to `main`.
- Run available formatting, lint, TypeScript, tests, and production build checks before release. Record checks that cannot be run and why.
- Review database migrations, API contracts, authentication/authorization, pricing, and customer-facing UI for each affected change.
- Use a preview deployment for an integrated batch when quota permits; do not create previews just to inspect trivial edits.
- Merge to `main` only after the batch passes checks and required product/owner acceptance.
- Verify the exact Vercel commit, deployment state, and production URL after release.
- Never claim a change is live until the production deployment is confirmed.
- Keep real-money payment activation and automatic product publication behind explicit approval.

## Open items

### DN-001 — Finish shop product CSV control layout
- **Status:** Implemented in GitHub; awaiting Vercel deployment.
- **Priority:** High
- **Request:** Remove the separate “Upload Product Database” section and place “Choose file” beside “Add a Product”.
- **Code commit:** `5421b7155c2fc6b3b6a912ccbb454b00b8e2681a`
- **Affected area:** `app/account/my-shops/MyShopsManager.tsx`
- **Deployment blocker:** Vercel Hobby team hit `api-deployments-free-per-day` (HTTP 402; retryAfter 86400 seconds) on 2026-11-09.
- **Next action:** After the team quota resets or the team plan is upgraded, deploy this exact commit; verify the shop dashboard and CSV import flow.
- **Acceptance:** The separate upload section is absent; file picker is aligned to the right of “Add a Product”; CSV import still works and validates input.

### DN-002 — Establish reliable batch release workflow
- **Status:** Process defined; apply to all future work.
- **Priority:** High
- **Acceptance:** Related corrections are grouped, validated together, and released in a single controlled production deployment where practical.

## Known release constraints
- Vercel team is currently on Hobby; deployment API limit was exceeded. Confirm the actual team quota/plan before retrying deployment.
- The production website remains on the last confirmed deployment until a newer production deployment is verified.
- Do not assume a successful GitHub push means Vercel deployed it.
