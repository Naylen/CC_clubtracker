# AGENTS.md — MCFGC Club Manager

> Guide for AI agents (and human contributors) working on this codebase.
> Read this file in full before making any changes.

---

## 1  Project Context

**Application:** MCFGC Club Manager — a web app for the Montgomery County Fish
& Game Club (Mt. Sterling, KY) to manage annual memberships, collect dues, and
communicate with members.

**Primary document:** [`docs/APP_OVERVIEW.md`](docs/APP_OVERVIEW.md) is the
single source of truth for architecture, data model, business rules, and
milestones. This file (`AGENTS.md`) defines *how* agents work on the codebase;
`APP_OVERVIEW.md` defines *what* gets built.

**Key constraints (memorize these):**
- Membership cap: 350 households (admin-configurable per year).
- Membership term: Jan 1 – Dec 31 (calendar year).
- Renewal deadline: Jan 31; after that, unpaid → LAPSED.
- New-member sign-up: annual in-person event, first-come/first-served, no
  waiting list.
- Pricing: $150 standard · $100 disabled veteran · $100 age ≥ 65.
- Membership = household-based (primary adult + children under 18).
- All prices stored in **cents** (integer). Never use floats for money.
- All timestamps stored in **UTC**. Display in **US Eastern (America/New_York)**.

---

## 2  Directory Structure

```
mcfgc-club-manager/
├── AGENTS.md                       ← you are here
├── docs/
│   └── APP_OVERVIEW.md             ← architecture & requirements
├── public/                         ← static assets
├── src/
│   ├── app/
│   │   ├── (admin)/                ← Admin UI route group
│   │   │   ├── layout.tsx          ← Admin shell (sidebar, nav)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        ← Admin dashboard (capacity gauge, stats)
│   │   │   ├── households/
│   │   │   │   ├── page.tsx        ← Household list + data table
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx    ← Household detail (members, payments)
│   │   │   │   └── new/
│   │   │   │       └── page.tsx    ← New household form
│   │   │   ├── membership-years/
│   │   │   │   ├── page.tsx        ← Membership year list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    ← Year detail (config, sign-up event)
│   │   │   ├── payments/
│   │   │   │   └── page.tsx        ← Payment log + record payment
│   │   │   ├── broadcasts/
│   │   │   │   ├── page.tsx        ← Communications log
│   │   │   │   └── new/
│   │   │   │       └── page.tsx    ← Compose broadcast
│   │   │   └── audit-log/
│   │   │       └── page.tsx        ← Audit log viewer
│   │   ├── (member)/               ← Member portal route group
│   │   │   ├── layout.tsx          ← Member shell
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        ← Member status + household info
│   │   │   └── renew/
│   │   │       └── page.tsx        ← Initiate renewal payment
│   │   ├── (auth)/                 ← Auth pages route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx        ← Admin login form
│   │   │   └── magic-link/
│   │   │       └── page.tsx        ← Member magic link request
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...all]/
│   │   │   │       └── route.ts    ← Better Auth catch-all handler
│   │   │   ├── webhooks/
│   │   │   │   └── stripe/
│   │   │   │       └── route.ts    ← Stripe webhook endpoint
│   │   │   └── inngest/
│   │   │       └── route.ts        ← Inngest serve endpoint
│   │   ├── layout.tsx              ← Root layout
│   │   ├── page.tsx                ← Landing / redirect
│   │   └── globals.css             ← Tailwind directives
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui primitives (button, input, etc.)
│   │   ├── admin/                  ← Admin-specific composed components
│   │   ├── member/                 ← Member-specific composed components
│   │   └── shared/                 ← Cross-cutting components (header, footer)
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts            ← Drizzle client instance
│   │   │   ├── schema/
│   │   │   │   ├── index.ts        ← Barrel export for all tables
│   │   │   │   ├── household.ts
│   │   │   │   ├── member.ts
│   │   │   │   ├── membership-year.ts
│   │   │   │   ├── membership.ts
│   │   │   │   ├── payment.ts
│   │   │   │   ├── signup-event-config.ts
│   │   │   │   ├── communications-log.ts
│   │   │   │   └── audit-log.ts
│   │   │   └── migrations/         ← Drizzle Kit generated migrations
│   │   ├── auth.ts                 ← Better Auth server config
│   │   ├── auth-client.ts          ← Better Auth client helpers
│   │   ├── stripe.ts               ← Stripe client + Checkout helpers
│   │   ├── email.ts                ← Resend client + send helpers
│   │   ├── inngest/
│   │   │   ├── client.ts           ← Inngest client instance
│   │   │   └── functions/
│   │   │       ├── lapse-check.ts  ← Feb 1 cron: PENDING_RENEWAL → LAPSED
│   │   │       ├── email-batch.ts  ← Broadcast email dispatch
│   │   │       └── seed-renewals.ts ← Seed PENDING_RENEWAL for new year
│   │   ├── utils/
│   │   │   ├── capacity.ts         ← checkCapacity() with FOR UPDATE
│   │   │   ├── pricing.ts          ← calculatePrice() with discount logic
│   │   │   ├── audit.ts            ← auditLog.record() helper
│   │   │   └── dates.ts            ← UTC ↔ Eastern helpers
│   │   └── validators/
│   │       ├── household.ts        ← Zod schemas for household CRUD
│   │       ├── member.ts
│   │       ├── membership.ts
│   │       ├── payment.ts
│   │       └── broadcast.ts
│   ├── actions/                    ← Server Actions (grouped by domain)
│   │   ├── households.ts
│   │   ├── members.ts
│   │   ├── membership-years.ts
│   │   ├── memberships.ts
│   │   ├── payments.ts
│   │   ├── broadcasts.ts
│   │   └── signup-events.ts
│   ├── hooks/                      ← Custom React hooks
│   └── types/                      ← Shared TypeScript types & enums
│       └── index.ts
├── tests/
│   ├── unit/                       ← Vitest unit tests
│   │   ├── pricing.test.ts
│   │   ├── capacity.test.ts
│   │   ├── dates.test.ts
│   │   └── audit.test.ts
│   ├── integration/                ← Vitest integration (with test DB)
│   │   ├── households.test.ts
│   │   ├── memberships.test.ts
│   │   ├── payments.test.ts
│   │   └── webhooks.test.ts
│   ├── e2e/                        ← Playwright E2E tests
│   │   ├── admin-roster.spec.ts
│   │   ├── renewal-flow.spec.ts
│   │   ├── signup-day.spec.ts
│   │   └── member-portal.spec.ts
│   └── fixtures/                   ← Shared test data and helpers
│       ├── seed.ts
│       └── helpers.ts
├── emails/                         ← React Email templates
│   ├── renewal-reminder.tsx
│   ├── magic-link.tsx
│   └── broadcast.tsx
├── drizzle.config.ts               ← Drizzle Kit configuration
├── next.config.ts                  ← Next.js configuration
├── tailwind.config.ts              ← Tailwind configuration
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── pnpm-lock.yaml
├── .env.example                    ← Documented env vars (no values)
├── .env.local                      ← Local secrets (gitignored)
├── .gitignore
└── .eslintrc.json
```

---

## 3  Agent Roles & File Ownership

Each agent has a **primary zone** (files it owns and creates) and a
**read-only zone** (files it reads but must not modify without coordination).

### 3.1  Backend Agent

**Owns:**
- `src/lib/` — all database, auth, Stripe, email, Inngest, utility, and
  validator code.
- `src/actions/` — all server actions.
- `src/app/api/` — all API route handlers.
- `src/types/` — shared TypeScript types.
- `drizzle.config.ts`

**Read-only:** `src/app/(admin)/`, `src/app/(member)/`, `src/components/`

**Responsibilities:**
- Define and evolve the Drizzle schema.
- Implement server actions with Zod validation and audit logging.
- Implement Stripe Checkout session creation and webhook processing.
- Implement Resend email sending and Inngest background functions.
- Implement capacity checking, pricing, and discount logic.
- Ensure every state-changing action writes to the audit log.
- Write unit tests for all business logic in `tests/unit/`.
- Write integration tests for server actions in `tests/integration/`.

**Rules:**
- All money values in cents (integer). Never use `number` for money display;
  format only at the UI boundary.
- All timestamps in UTC. Use `dates.ts` helpers for display conversion.
- Use Drizzle query builder. No raw SQL except the `FOR UPDATE` capacity check.
- Every server action must: (1) validate session, (2) check role, (3) validate
  input with Zod, (4) execute logic, (5) write audit log.
- Stripe webhook handler must verify signature before any processing.
- Inngest functions must be idempotent.

### 3.2  Frontend Agent

**Owns:**
- `src/app/(admin)/` — all admin UI pages and layouts.
- `src/app/(member)/` — all member portal pages and layouts.
- `src/app/(auth)/` — auth pages.
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/components/` — all React components.
- `src/hooks/` — custom React hooks.
- `emails/` — React Email templates.

**Read-only:** `src/lib/`, `src/actions/`, `src/types/`

**Responsibilities:**
- Build admin UI pages: dashboard, household CRUD, membership year config,
  payment recording, broadcast compose, audit log viewer.
- Build member portal: dashboard, renewal payment page.
- Build auth pages: admin login, member magic link request.
- Use shadcn/ui primitives for all interactive elements.
- Implement responsive design (mobile-first for member portal).
- Handle loading, error, and empty states for every page.
- Call server actions from form submissions and button clicks.

**Rules:**
- Default to React Server Components. Add `'use client'` only when the
  component needs interactivity (event handlers, hooks, browser APIs).
- Use `react-hook-form` + `zod` for all client-side forms. The Zod schema
  should be imported from `src/lib/validators/` (shared with backend).
- Use shadcn/ui `DataTable` pattern for all list views.
- Never fetch data in client components. Pass data from server components as
  props or use server actions.
- Never render money values as raw cents. Use a `formatCurrency(cents)` utility.
- Never render timestamps as raw UTC. Use a `formatDate(utcDate)` utility.
- Component file naming: `PascalCase.tsx` for components, `kebab-case.ts` for
  utilities.

### 3.3  Testing Agent

**Owns:**
- `tests/` — all test files, fixtures, and helpers.
- `vitest.config.ts`
- `playwright.config.ts`

**Read-only:** Everything in `src/`

**Responsibilities:**
- Write and maintain unit tests for business logic (pricing, capacity, dates,
  audit).
- Write integration tests for server actions with a test database.
- Write Playwright E2E tests for all critical user flows.
- Maintain test fixtures and seed data.
- Enforce coverage thresholds (≥ 80% on `src/lib/utils/`, ≥ 60% on
  `src/actions/`).
- Write concurrency tests for capacity enforcement (BR-1, BR-8).
- Write idempotency tests for webhook processing (BR-10).

**Rules:**
- Unit tests must be deterministic — no external service calls. Mock Stripe,
  Resend, and Inngest at the module level.
- Integration tests use a real Neon branch (test database). Clean up after each
  test suite.
- E2E tests use a seeded database state. Do not depend on test ordering.
- Test file naming mirrors source: `src/lib/utils/pricing.ts` →
  `tests/unit/pricing.test.ts`.
- Every business rule (BR-1 through BR-10) must have at least one dedicated
  test.

### 3.4  DevOps Agent

**Owns:**
- `.github/workflows/` — CI/CD pipeline definitions.
- `next.config.ts`
- `tailwind.config.ts`
- `.eslintrc.json`
- `.gitignore`
- `.env.example`
- `package.json` (dependency management)

**Read-only:** Everything in `src/`, `tests/`, `docs/`

**Responsibilities:**
- Configure and maintain the CI pipeline (lint → typecheck → test → build).
- Manage Vercel deployment settings and preview deploy configuration.
- Manage Neon database branching for preview deploys.
- Keep dependencies up to date and resolve security advisories.
- Configure Inngest deployment (Vercel integration).
- Maintain `.env.example` whenever new env vars are added.
- Set up Stripe CLI for local webhook testing.

**Rules:**
- CI must run on every PR. No merging with failing checks.
- Preview deploys must use a dedicated Neon branch (not production).
- Never commit secrets, API keys, or connection strings.
- Pin major versions in `package.json`; allow patch updates.
- `pnpm` is the only package manager. No `npm` or `yarn`.

---

## 4  Coding Standards

### 4.1  TypeScript

- Strict mode enabled (`"strict": true` in `tsconfig.json`).
- No `any` type. Use `unknown` and narrow with type guards.
- Prefer `interface` for object shapes; use `type` for unions and intersections.
- Export types from `src/types/index.ts` or co-locate with their module.

### 4.2  Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Variables, functions | `camelCase` | `calculatePrice`, `householdId` |
| React components | `PascalCase` | `HouseholdTable`, `RenewalButton` |
| Files (components) | `PascalCase.tsx` | `HouseholdTable.tsx` |
| Files (utilities) | `kebab-case.ts` | `pricing.ts`, `capacity.ts` |
| Database columns | `snake_case` | `household_id`, `created_at` |
| Drizzle table vars | `camelCase` | `membershipYear`, `auditLog` |
| Environment variables | `SCREAMING_SNAKE` | `STRIPE_SECRET_KEY` |
| Enum values | `SCREAMING_SNAKE` | `PENDING_RENEWAL`, `ACTIVE` |
| CSS classes | Tailwind utilities | `className="flex items-center gap-2"` |

### 4.3  React Patterns

- **Server Components by default.** Only add `'use client'` when the component
  truly needs client-side interactivity.
- **Data fetching in server components** — fetch data at the page level, pass as
  props.
- **Server Actions for mutations** — forms submit via `action={serverAction}` or
  `useActionState`.
- **Composition over inheritance** — use `children` props and compound
  components.
- **No prop drilling beyond 2 levels** — use composition or context.

### 4.4  Forms

- All forms use `react-hook-form` with `@hookform/resolvers/zod`.
- Zod schemas live in `src/lib/validators/` and are shared between client
  validation and server action validation.
- Submitting a form calls a server action. Optimistic updates are optional for
  MVP.
- Show field-level errors below each input. Show action-level errors in a toast
  or alert.

### 4.5  Data Tables

- Use the shadcn/ui `DataTable` pattern (TanStack Table wrapper).
- Server-side pagination and sorting for lists that may exceed 50 rows.
- Searchable columns where appropriate (household name, member name).
- Row actions (edit, delete, view) via dropdown menu or inline buttons.

### 4.6  Database

- **Drizzle query builder only.** No raw SQL except the `FOR UPDATE` capacity
  lock query (wrap it in a `db.execute(sql\`...\`)` call).
- **Transactions** for any operation that modifies more than one table or needs
  atomicity.
- **Schema changes** go through `drizzle-kit push` during development and
  `drizzle-kit generate` + `drizzle-kit migrate` for production.
- **Indexes**: Add indexes for frequently queried columns (foreign keys,
  status, year).
- **Soft deletes**: Not used in MVP. Hard delete with audit log entry.

### 4.7  Error Handling

- **Business logic**: Return a `Result<T, E>` type
  (`{ success: true, data: T } | { success: false, error: E }`).
  Never throw for expected business errors (capacity full, invalid input).
- **Unexpected errors**: Let them throw. Catch at the boundary (server action
  wrapper, API route handler) and return a generic error response.
- **Server Actions**: Always return `{ success, data?, error? }` — never throw
  from a server action.
- **API routes**: Return proper HTTP status codes (400 for bad input, 401 for
  auth, 403 for authz, 500 for unexpected).

### 4.8  Logging

- Use structured `console.log` / `console.error` with JSON payloads.
- Include `action`, `entityType`, `entityId`, and `durationMs` in log entries.
- Never log PII (email, name, address) at INFO level. Only at DEBUG level in
  development.
- Log all webhook events (type, ID, processing result).

### 4.9  Git Conventions

- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`.
- **Branch naming**: `milestone-N/short-description`
  (e.g., `milestone-2/household-crud`).
- **One PR per logical unit of work** within a milestone.
- **No force-pushes to `main`.** Squash-merge PRs.
- **PR description** must reference the relevant milestone and business rules.

---

## 5  Cross-Agent Coordination

### Dependency Ordering

Some work must happen in a specific order. Follow this dependency graph:

```
Backend: Drizzle Schema
    │
    ├──▶ Backend: Server Actions (depends on schema)
    │       │
    │       ├──▶ Frontend: Admin UI Pages (depends on actions)
    │       │
    │       └──▶ Frontend: Member Portal Pages (depends on actions)
    │
    ├──▶ Backend: Stripe Webhook Handler (depends on schema + actions)
    │
    ├──▶ Backend: Inngest Functions (depends on schema + actions)
    │
    └──▶ Testing: Unit Tests (depends on utils being implemented)

Testing: Integration Tests (depends on schema + actions)
Testing: E2E Tests (depends on frontend pages being built)

DevOps: CI Pipeline (can run in parallel from Milestone 1)
```

### Handoff Protocol

1. **Backend → Frontend**: When a server action is ready, the Backend Agent
   must document its signature (parameters, return type) in a JSDoc comment
   at the top of the function. The Frontend Agent can then import and use it.

2. **Backend → Testing**: When a business logic utility is implemented, the
   Backend Agent adds a brief `// TEST:` comment describing expected behaviors.
   The Testing Agent uses this as a spec.

3. **Frontend → Testing**: When a page is feature-complete, the Frontend Agent
   updates the relevant E2E test file with a `// READY FOR E2E` comment.

4. **Any Agent → DevOps**: When a new env var is needed, the requesting agent
   adds it to `.env.example` with a comment. The DevOps Agent mirrors it in
   Vercel settings.

### Conflict Resolution

- If two agents need to modify the same file, the agent whose primary zone
  contains the file has priority.
- Schema changes (`src/lib/db/schema/`) always require Backend Agent sign-off.
- If unsure, check this file's ownership map (Section 3) and
  `APP_OVERVIEW.md` for the authoritative business rule.

---

## 6  Non-Negotiable Constraints

These rules are absolute. No agent may bypass them without explicit approval
from the project maintainer.

1. **Capacity enforcement uses row-level locking (`FOR UPDATE`).** No optimistic
   checks, no application-level counters, no Redis. The database is the source
   of truth.

2. **All prices in cents (integer).** `15000` not `150.00`. Never use
   floating-point for money.

3. **All timestamps stored in UTC.** Display in US Eastern
   (`America/New_York`). No other timezone assumptions.

4. **No secrets in the repository.** All keys, passwords, and connection strings
   go in environment variables. `.env.local` is gitignored.

5. **Stripe webhooks must verify signatures.** Never process an unverified
   webhook payload. Use `STRIPE_WEBHOOK_SECRET` and the raw body.

6. **Every admin write action must produce an audit log entry.** No exceptions.

7. **Server actions must validate auth + role + input before executing logic.**
   Three checks, in that order, every time.

8. **No `any` types.** Use `unknown` and narrow.

9. **`pnpm` only.** No `npm`, no `yarn`. Delete `package-lock.json` or
   `yarn.lock` if they appear.

10. **Zod schemas are the single source of truth for input validation.** Shared
    between client and server. Do not duplicate validation logic.

11. **Member portal queries must scope to the authenticated user's household.**
    No cross-household data leakage.

12. **No waiting list.** The app must not implement any form of reservation
    queue or waiting list for new memberships. First-come, first-served only.

13. **Household-based capacity counting.** The cap counts households, not
    individual members.

14. **Senior discount age calculated as of Jan 1 of the membership year,** not
    the payment date or current date.

15. **Inngest functions must be idempotent.** Re-running any function with the
    same input must produce the same result with no side effects.

---

## 7  Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string (`postgresql://...`) |
| `BETTER_AUTH_SECRET` | Yes | Random string for session signing (≥ 32 chars) |
| `BETTER_AUTH_URL` | Yes | App base URL (e.g., `http://localhost:3000` or production URL) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (`pk_test_...` or `pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `RESEND_API_KEY` | Yes | Resend API key (`re_...`) |
| `INNGEST_SIGNING_KEY` | Prod | Inngest function signing key (optional in dev) |

Local development: copy `.env.example` to `.env.local` and fill in values.

---

## 8  Common Commands

```bash
# Install dependencies
pnpm install

# Start local development server
pnpm dev

# Run linter
pnpm lint

# Run type checker
pnpm typecheck

# Run unit + integration tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run E2E tests
pnpm test:e2e

# Push schema changes to Neon
pnpm db:push

# Open Drizzle Studio (database browser)
pnpm db:studio

# Generate migration files
pnpm db:generate

# Forward Stripe webhooks to local dev
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger Stripe test webhook
stripe trigger checkout.session.completed

# Run Inngest dev server
npx inngest-cli@latest dev
```

---

## 9  Adding New Features Checklist

When adding a new feature, follow this checklist:

- [ ] Check `APP_OVERVIEW.md` for the relevant business rules.
- [ ] Create/update Drizzle schema if new tables or columns are needed.
- [ ] Create Zod validator in `src/lib/validators/`.
- [ ] Implement server action in `src/actions/` with auth + validation + audit.
- [ ] Build UI page(s) in the appropriate route group.
- [ ] Add unit tests for any new business logic.
- [ ] Add integration tests for new server actions.
- [ ] Update E2E tests if a user flow changed.
- [ ] Add any new env vars to `.env.example`.
- [ ] Update `APP_OVERVIEW.md` if the feature changes architecture or rules.

---

*This file should be updated whenever project conventions change.*
