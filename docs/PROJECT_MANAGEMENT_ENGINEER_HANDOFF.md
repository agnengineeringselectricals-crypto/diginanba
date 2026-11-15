# DigiNanba Project Management SaaS — Engineer Handoff

Product owner: AGN Engineering
Repository: agnengineeringselectricals-crypto/diginanba
Application: DigiNanba; shared identity, organizations and authentication
Implementation branch: feature/project-management-saas-mvp
Status: Foundation and initial workspace screen only. Not production-ready.

## Product intent
Build Project Management as a first-class SaaS product inside DigiNanba, not a separate app or duplicate identity system. Support companies, engineering firms, contractors, societies, associations, schools/agencies and individuals. Initial industry template is engineering and construction; the engine must remain configurable for other industries.

## Non-negotiable architecture
- Reuse users, organization_accounts, organization_memberships, existing Auth.js session and Neon/Postgres connection.
- Do not create a second users, login, organization or billing identity.
- Every operational record is tenant-scoped by organization_id. Enforce cross-organization integrity with composite foreign keys wherever practical.
- Enforce membership and permission checks on every server API. Hiding UI controls is not authorization.
- Keep business modules additive and modular. Version every migration. Test on staging before production.
- Do not enable live billing or collect real money as part of foundation work. Existing organization subscription flow is gated by ORGANIZATION_SUBSCRIPTIONS_ENABLED.
- Never expose private files through public URLs. Use authenticated storage access and audit download/share events.
- Audit approvals, role changes, status changes, financial postings and external portal access.

## Core operating model
Every measurable activity uses the shared performance model instead of duplicating fields in each module:
- baseline target and current target;
- actual measured value and unit;
- current status (status never substitutes for a numeric actual);
- variance;
- planned and actual start/finish;
- forecast finish;
- responsible person;
- deviation reason, corrective action and next follow-up.
Keep dated measurement and status history. Example: a task may be in_progress while actual quantity remains zero.

## Product modules
1. Organization configuration: organization type, industry template, timezone, currency, fiscal year, departments, designations, reporting hierarchy.
2. Identity, workforce and access: invitations, memberships, role/permission matrix, project assignment, client/supplier external identities.
3. Portfolio and project setup: project codes, client, contract, baseline dates, budgets, project manager, status.
4. WBS and task control: hierarchical work packages/tasks, dependencies, quantities, dates, owners, approvals.
5. Performance ledger: target/actual/status/variance history, follow-ups, corrective actions and dashboards.
6. Manpower/resources: employee/contract workforce, equipment/resource register, allocation, availability and utilization.
7. Materials/procurement: material master, indents, supplier quotations/bids, approvals, purchase orders, receipts and returns.
8. Quality/standards: configurable standards register, inspection/test plans, checklists, nonconformities, corrective/preventive actions.
9. Finance: estimates, budgets, commitments, income, expenses, receipts/payments, tax fields, cost codes, approval and audit trail. Do not imply statutory accounting compliance without a separate compliance design.
10. Documents/quotations: controlled document register, revisions, templates, quotations, letterheads, approval and secure file storage.
11. CRM and communications: client/supplier registers, department coordination, project chat, decisions and action tracking.
12. External portals: scoped client and supplier views; only explicitly shared project data, documents, RFQs, submissions and messages.
13. SaaS commercial control: monthly and annual subscriptions, usage meters (active users/projects/storage/API when defined), optional paid modules. These are combined revenue dimensions, not mutually exclusive plans.
14. Analytics, notifications, audit, security and configurable workflows.

## Current database foundation
Migration 20261115_project_management_foundation.sql creates:
- pm_organization_settings, pm_departments, pm_designations;
- pm_roles, pm_permissions, pm_role_permissions, pm_memberships;
- pm_projects, pm_project_members, pm_work_packages, pm_tasks, pm_task_dependencies;
- pm_performance_metrics, pm_performance_measurements, pm_status_history, pm_follow_up_actions, pm_audit_events.

Migration 20261115_project_management_modules.sql adds normalized foundations for resources, materials, procurement, suppliers, quality, finance, documents, clients, communications, module entitlements and usage events.

Existing organization_subscriptions is reused. It currently stores one subscription row per organization and recurring interval/provider metadata. Extend deliberately for entitlements and usage billing; do not create a second subscription table without a reviewed migration.

## Current application work
- Existing organization workspace: /organizations and /api/organizations.
- New PM dashboard: /project-management.
- New organization-scoped PM API: /api/project-management (list organizations/projects and create a project).
- New task API: /api/project-management/[projectId]/tasks (list/create).
- Current branch: feature/project-management-saas-mvp.
- Foundation only. Task update/delete, work package CRUD, permission UI/enforcement, invitations, module pages, external portals, secure storage, billing metering, notifications and automated tests remain to be implemented.

## Delivery sequence
Phase A — safe working MVP:
- Organization/project workspace, role/membership bootstrap, project create/list/detail.
- WBS/tasks/dependencies and task assignment.
- Shared target/actual/status measurement entry and history.
- Organization/department/role permission enforcement.
- Audit trail and responsive UI.
- Automated tests for tenant isolation and unauthorized access.

Phase B — AGN engineering operations:
- Manpower, resource register and allocations.
- Material catalog, indent, supplier RFQ/bids, PO and receipt.
- Quality plans, inspections and corrective actions.
- Budget, commitments, income/expense and project cost reports.
- Quotations, letterhead templates and controlled document revisions.

Phase C — collaboration and SaaS:
- Client/supplier portals with strict per-project sharing.
- CRM, internal chat, decisions, notifications and approvals.
- Monthly/annual subscription lifecycle, usage metering, optional module entitlements and billing reports.
- Industry templates, configuration and analytics.

## Definition of done / release gates
- TypeScript, lint and production build pass.
- Migration tested against a clean staging branch and representative existing data.
- Every API has authentication, organization membership and permission checks.
- Tests prove user A cannot read/write user B's organization/project, including guessed UUIDs.
- Inputs validated server-side; dates, amounts, quantities and status transitions checked.
- DB transactions used for multi-row writes; idempotency used for webhook/usage events.
- No accidental live payments, public product publication or production migration without explicit release approval.
- Verify deployed routes and critical workflows after deployment; maintain rollback path.

## First tasks for incoming engineer
1. Read this handoff and inspect both PM migrations, dashboard and APIs.
2. Run the existing application build locally and report pre-existing errors before changing code.
3. Add a migration runner/checksum and CI checks; do not run the postponed location-search backfill.
4. Implement project detail, WBS/task CRUD, task dependency validation and project membership access.
5. Add integration tests for tenant isolation and role permissions before expanding modules.
6. Do not resume location-search work unless the product owner re-prioritizes it.
