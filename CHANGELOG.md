# DigiNanba Changelog

This file records verified repository changes and deployment outcomes. A GitHub commit is not considered a production release until Vercel confirms it.

## 2026-11-09

### Pending deployment
- **Commit:** `5421b7155c2fc6b3b6a912ccbb454b00b8e2681a`
- **Change:** Move the CSV file picker beside “Add a Product” and remove the separate “Upload Product Database” section.
- **GitHub:** Present on `main`.
- **Vercel:** Not deployed as of 2026-11-09. Deployment request was rejected with HTTP 402 because the Hobby team's daily deployment API quota was exceeded (`api-deployments-free-per-day`; retry after 86400 seconds).
- **Status:** Pending.

### Previously confirmed production deployments
- **Commit:** `b8a3b34f9518f9d51c4b8ee492168110ffaad8e2` — Remove discount helper text from shop product form. Vercel deployment `dpl_U11NSCCuRNG7RQTVWKF2MLo4QRWr` was reported READY.
- **Commit:** `85fc769b963ce0655a8d51392895702943f56985` — Remove pricing explanation from shop product entry form. Vercel deployment `dpl_Aj5AjWnMhBnpxBC7bqv5GjhJ3ggL` was reported READY.
- **Commit:** `3377f38f9dc03a6f534bf473abbbcf111cc7523f` — Show maximum discount and product database upload in shop dashboard. Vercel deployment `dpl_Du8JPL8r2StXFtmhxQ4HYzWZ6au6` was reported READY.

## Changelog policy
For each completed batch, add date, summary, commit SHA, validation performed, Vercel deployment ID, URL, state, and any outstanding caveats. Do not label a commit as deployed without Vercel confirmation.
