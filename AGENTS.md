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
deployment. This file (`AGENTS.md`) defines *how* agents work on the codebase;
`APP_OVERVIEW.md` defines *what* gets built.

**Key constraints (memorize these):**
- Membership cap: 350 households (admin-configurable per year).
- Membership term: Jan 1 – Dec 31 (calendar year).
- Renewal deadline: Jan 31; after that, unpaid → LAPSED.
- New-member sign-up: public form on `/signup-day`, creates auth account + auto-login.
- Pricing: tier-based. Defaults: $150 standard · $100 disabled veteran · $100 age ≥ 65.
- Membership = household-based (primary adult + children under 18).
- All prices stored in **cents** (integer). Never use floats for money.
- All timestamps stored in **UTC**. Display in **US Eastern (America/New_York)**.
- Sensitive data (DL numbers) encrypted at rest with AES-256-GCM.
- Self-hosted via Docker + Cloudflare Tunnel. No Vercel.

---

## 2  Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1 |
| UI | React | 19.2 |
| Language | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS | 4.x |
| Auth | Better Auth | 1.4 |
| Database | PostgreSQL (Docker) | 16 |
| ORM | Drizzle ORM | 0.45 |
| Payments | Stripe Checkout + Webhooks | 20.x |
| Email | Resend + Gmail SMTP (nodemailer) | 6.9 / 7.0 |
| Jobs | Inngest | 3.52 |
| Forms | React Hook Form + Zod | 7.71 / 4.3 |
| Testing | Vitest + Playwright | 4.0 / 1.58 |
| Package Manager | pnpm | latest |

---

## 3  Directory Structure

```
mcfgc-club-manager/
├── AGENTS.md                       ← you are here
├── README.md                       ← setup instructions
├── docs/
│   └── APP_OVERVIEW.md             ← architecture & requirements
├── setup.sh                        ← production setup (generates .env.production)
├── docker-compose.yml              ← development Docker Compose
├── docker-compose.prod.yml         ← production Docker Compose (isolated network)
├── Dockerfile                      ← multi-stage: base → dev | base → builder → runner
├── public/                         ← static assets
├── emails/                         ← React Email templates (preview only)
│   ├── renewal-reminder.tsx
│   ├── magic-link.tsx
│   └── broadcast.tsx
├── src/
│   ├── instrumentation.ts          ← startup: schema push + admin seed + tier seed
│   ├── middleware.ts               ← auth redirect rules
│   ├── app/
│   │   ├── layout.tsx              ← root layout
│   │   ├── page.tsx                ← landing / redirect
│   │   ├── globals.css             ← Tailwind directives
│   │   ├── (admin)/                ← Admin UI route group
│   │   │   ├── layout.tsx          ← admin shell (sidebar, nav, auth gate)
│   │   │   └── admin/
│   │   │       ├── dashboard/page.tsx        ← capacity gauge, stats
│   │   │       ├── households/page.tsx       ← household list + data table
│   │   │       ├── households/new/page.tsx   ← new household form
│   │   │       ├── households/[id]/page.tsx  ← household detail (members, payments)
│   │   │       ├── members/page.tsx          ← member list
│   │   │       ├── members/new/page.tsx      ← new member form
│   │   │       ├── members/[id]/page.tsx     ← member detail
│   │   │       ├── membership-years/page.tsx       ← year list
│   │   │       ├── membership-years/new/page.tsx   ← create year
│   │   │       ├── membership-years/[id]/page.tsx  ← year detail + signup event
│   │   │       ├── membership-tiers/page.tsx       ← tier list
│   │   │       ├── membership-tiers/new/page.tsx   ← create tier
│   │   │       ├── membership-tiers/[id]/page.tsx  ← edit tier
│   │   │       ├── applications/page.tsx     ← pending + approved application queues
│   │   │       ├── payments/page.tsx         ← payment log + record payment
│   │   │       ├── broadcasts/page.tsx       ← communications log
│   │   │       ├── broadcasts/new/page.tsx   ← compose broadcast (provider select)
│   │   │       ├── admin-management/page.tsx ← promote/demote admins
│   │   │       └── audit-log/page.tsx        ← audit log viewer
│   │   ├── (member)/               ← member portal route group
│   │   │   ├── layout.tsx          ← member shell
│   │   │   └── member/
│   │   │       ├── dashboard/page.tsx  ← status card, household info, payment history
│   │   │       └── renew/page.tsx      ← renewal payment
│   │   ├── (auth)/                 ← auth pages route group
│   │   │   ├── login/page.tsx      ← email/password login
│   │   │   ├── magic-link/page.tsx ← magic link request
│   │   │   └── change-password/page.tsx ← forced password change
│   │   ├── (public)/               ← public pages route group
│   │   │   ├── layout.tsx          ← public layout
│   │   │   └── signup-day/page.tsx ← new member application form
│   │   └── api/
│   │       ├── auth/[...all]/route.ts          ← Better Auth handler
│   │       ├── webhooks/stripe/route.ts        ← Stripe webhook
│   │       ├── inngest/route.ts                ← Inngest serve endpoint
│   │       └── admin/veteran-doc/[memberId]/route.ts ← vet doc download (admin only)
│   ├── components/
│   │   ├── shared/                 ← header, sidebar
│   │   ├── auth/                   ← LoginForm, SignupDayLink
│   │   ├── admin/                  ← admin-specific components
│   │   │   ├── ApplicationQueue.tsx       ← pending apps with vet doc viewing
│   │   │   ├── ApprovedApplications.tsx   ← approved apps list
│   │   │   ├── AdminManagementPanel.tsx   ← promote/demote officers
│   │   │   ├── BroadcastForm.tsx          ← compose + provider select
│   │   │   ├── CapacityGauge.tsx          ← visual capacity meter
│   │   │   ├── DriverLicenseReveal.tsx    ← decrypt + show DL
│   │   │   ├── HouseholdForm.tsx          ← create/edit household
│   │   │   ├── HouseholdTable.tsx         ← data table
│   │   │   ├── AddHouseholdMemberForm.tsx ← add member to household
│   │   │   ├── MembershipTierForm.tsx     ← create/edit tier
│   │   │   ├── MembershipTierTable.tsx    ← tier list
│   │   │   ├── MembershipYearForm.tsx     ← create/edit year
│   │   │   ├── MemberTable.tsx            ← member data table
│   │   │   ├── NewMemberForm.tsx          ← admin-side new member
│   │   │   ├── PaymentRecordForm.tsx      ← record cash/check
│   │   │   ├── SetTempPasswordForm.tsx    ← set temp password for member
│   │   │   ├── SignupEventForm.tsx         ← configure signup event
│   │   │   ├── SignupEventToggle.tsx       ← toggle public visibility
│   │   │   └── VeteranDocViewer.tsx        ← view uploaded vet doc
│   │   ├── member/                 ← member-specific components
│   │   │   ├── ApplicationStatusCard.tsx  ← review/approved/active status
│   │   │   └── RenewalCard.tsx            ← renewal payment card
│   │   └── public/                 ← public-facing components
│   │       └── NewMemberSignupForm.tsx    ← signup form with password + DL + vet doc
│   ├── lib/
│   │   ├── auth.ts                 ← Better Auth server config
│   │   ├── auth-client.ts          ← Better Auth client helpers
│   │   ├── stripe.ts               ← Stripe client + checkout + retrieve
│   │   ├── email.ts                ← Resend + Gmail SMTP, dual-provider routing
│   │   ├── db/
│   │   │   ├── index.ts            ← Drizzle client (postgres.js driver)
│   │   │   ├── seed-admin.ts       ← initial admin seeding from env vars
│   │   │   ├── seed-membership-tiers.ts ← default tier seeding
│   │   │   └── schema/             ← Drizzle schema definitions
│   │   │       ├── index.ts        ← barrel export
│   │   │       ├── auth.ts         ← Better Auth tables
│   │   │       ├── household.ts
│   │   │       ├── member.ts
│   │   │       ├── membership.ts
│   │   │       ├── membership-tier.ts
│   │   │       ├── membership-year.ts
│   │   │       ├── payment.ts
│   │   │       ├── signup-event-config.ts
│   │   │       ├── communications-log.ts
│   │   │       └── audit-log.ts
│   │   ├── inngest/
│   │   │   ├── client.ts           ← Inngest client instance
│   │   │   └── functions/
│   │   │       ├── lapse-check.ts  ← Feb 1 cron: PENDING_RENEWAL → LAPSED
│   │   │       ├── email-batch.ts  ← broadcast dispatch (Resend or Gmail)
│   │   │       └── seed-renewals.ts ← seed PENDING_RENEWAL for new year
│   │   ├── utils/
│   │   │   ├── audit.ts            ← recordAudit() helper
│   │   │   ├── capacity.ts         ← checkCapacity() with FOR UPDATE
│   │   │   ├── dates.ts            ← UTC ↔ Eastern + formatCurrency
│   │   │   ├── encryption.ts       ← AES-256-GCM encrypt/decrypt
│   │   │   ├── pricing.ts          ← calculatePrice() with discount logic
│   │   │   └── rbac.ts             ← role-based access control helpers
│   │   └── validators/
│   │       ├── broadcast.ts        ← broadcast Zod schema (+ emailProvider)
│   │       ├── household.ts
│   │       ├── member.ts
│   │       ├── membership.ts
│   │       └── payment.ts
│   ├── actions/                    ← Server Actions (grouped by domain)
│   │   ├── admin.ts                ← admin management, temp passwords
│   │   ├── auth.ts                 ← auth helpers
│   │   ├── broadcasts.ts           ← send broadcast with provider routing
│   │   ├── encrypted-data.ts       ← DL encryption/decryption
│   │   ├── households.ts
│   │   ├── members.ts
│   │   ├── membership-tiers.ts
│   │   ├── membership-years.ts
│   │   ├── memberships.ts          ← includes getCurrentMembershipForPortal()
│   │   ├── payments.ts             ← record, Stripe checkout, verifyAndActivate
│   │   └── signup-events.ts        ← signup + auth account creation
│   ├── hooks/                      ← custom React hooks
│   └── types/
│       └── index.ts                ← shared TypeScript types (ActionResult, etc.)
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── .env.example                    ← all env vars documented (no values)
├── .env.local                      ← local secrets (gitignored)
├── drizzle.config.ts
├── next.config.ts                  ← output: "standalone" for Docker
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── pnpm-lock.yaml
└── eslint.config.mjs
```

---

## 4  Coding Standards

### 4.1  TypeScript

- Strict mode enabled (`"strict": true`).
- No `any` type. Use `unknown` and narrow with type guards.
- Prefer `interface` for object shapes; use `type` for unions and intersections.
- Export types from `src/types/index.ts` or co-locate with their module.

### 4.2  Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Variables, functions | `camelCase` | `calculatePrice`, `householdId` |
| React components | `PascalCase` | `HouseholdTable`, `ApplicationStatusCard` |
| Files (components) | `PascalCase.tsx` | `ApplicationQueue.tsx` |
| Files (utilities) | `kebab-case.ts` | `pricing.ts`, `encryption.ts` |
| Database columns | `snake_case` | `household_id`, `created_at` |
| Drizzle table vars | `camelCase` | `membershipYear`, `membershipTier` |
| Environment variables | `SCREAMING_SNAKE` | `STRIPE_SECRET_KEY`, `APP_DOMAIN` |
| Enum values | `SCREAMING_SNAKE` | `PENDING_RENEWAL`, `ACTIVE` |

### 4.3  React Patterns

- **Server Components by default.** Only add `'use client'` when the component
  truly needs client-side interactivity.
- **Data fetching in server components** — fetch at the page level, pass as props.
- **Server Actions for mutations** — forms submit via `action={serverAction}` or
  call server actions from client components.
- **Composition over inheritance** — use `children` props and compound components.

### 4.4  Forms

- All forms use `react-hook-form` with `@hookform/resolvers/zod`.
- Zod schemas live in `src/lib/validators/` and are shared between client
  validation and server action validation.
- Show field-level errors below each input. Show action-level errors in alerts.

### 4.5  Database

- **Drizzle query builder only.** No raw SQL except the `FOR UPDATE` capacity
  lock query.
- **Transactions** for operations that modify multiple tables.
- **Schema push** (`drizzle-kit push --force`) runs on every startup via
  `instrumentation.ts`. No migration files in production.
- **All prices in cents** (integer). Format only at the UI boundary with
  `formatCurrency()`.
- **All timestamps in UTC.** Display with `formatDateET()`.

### 4.6  Error Handling

- **Server Actions**: Always return `{ success: true, data } | { success: false, error }`.
  Never throw from a server action.
- **API routes**: Return proper HTTP status codes (400, 401, 403, 500).
- Business errors (capacity full, invalid input) are returned, not thrown.

### 4.7  Git Conventions

- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- **`pnpm` only.** No `npm`, no `yarn`.
- Never commit secrets, API keys, or connection strings.

---

## 5  Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_DOMAIN` | Prod | Public domain (e.g., `club.mcfgcinc.com`). Drives all URL config. |
| `DATABASE_URL` | Dev | PostgreSQL connection string (prod is composed from DB_* vars) |
| `DB_USER` | Prod | PostgreSQL user (default: `mcfgc`) |
| `DB_PASSWORD` | Prod | PostgreSQL password (auto-generated by `setup.sh`) |
| `DB_NAME` | Prod | PostgreSQL database (default: `mcfgc`) |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (≥ 32 chars, auto-generated by `setup.sh`) |
| `BETTER_AUTH_URL` | Yes | App base URL, server-side |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Yes | App base URL, client-side |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key, 64-char hex (auto-generated by `setup.sh`) |
| `ADMIN_EMAIL` | Yes | Initial admin email (seed, first startup only) |
| `ADMIN_PASSWORD` | Yes | Initial admin password (seed, first startup only) |
| `ADMIN_NAME` | No | Initial admin display name (default: "Club Administrator") |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `RESEND_API_KEY` | No | Resend email API key (optional if using Gmail) |
| `GMAIL_USER` | No | Gmail address for SMTP sending |
| `GMAIL_APP_PASSWORD` | No | Gmail App Password (requires 2FA) |
| `INNGEST_SIGNING_KEY` | Prod | Inngest function signing key |
| `APP_PORT` | No | Host port (default: 3001) |

---

## 6  Common Commands

```bash
# ── Development ──────────────────────────────────────────────
docker compose up -d --build          # Start dev (hot reload)
docker compose down -v                # Stop + wipe DB
docker compose logs app -f            # Stream app logs

# ── Production ───────────────────────────────────────────────
./setup.sh                            # Generate .env.production
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs app -f

# ── Code Quality ─────────────────────────────────────────────
pnpm lint                             # ESLint
pnpm typecheck                        # tsc --noEmit
pnpm test                             # Vitest
pnpm test:e2e                         # Playwright

# ── Stripe (local dev) ──────────────────────────────────────
stripe listen --forward-to localhost:3001/api/webhooks/stripe
stripe trigger checkout.session.completed

# ── Inngest (local dev) ─────────────────────────────────────
npx inngest-cli@latest dev
```

---

## 7  Non-Negotiable Constraints

These rules are absolute. No agent may bypass them.

1. **Capacity enforcement uses row-level locking (`FOR UPDATE`).** The database
   is the source of truth for concurrency.

2. **All prices in cents (integer).** `15000` not `150.00`. Never use
   floating-point for money.

3. **All timestamps stored in UTC.** Display in US Eastern. No other timezone
   assumptions.

4. **No secrets in the repository.** All keys and passwords go in env vars.
   `.env.local` and `.env.production` are gitignored.

5. **Stripe webhooks must verify signatures.** Never process an unverified
   webhook payload.

6. **Every admin write action must produce an audit log entry.** No exceptions.

7. **Server actions must validate auth + role + input before executing.**
   Three checks, in that order, every time.

8. **No `any` types.** Use `unknown` and narrow.

9. **`pnpm` only.** No `npm`, no `yarn`.

10. **Zod schemas are the single source of truth for input validation.** Shared
    between client and server.

11. **Member portal queries must scope to the authenticated user's household.**
    No cross-household data leakage.

12. **No waiting list.** First-come, first-served only.

13. **Household-based capacity counting.** The cap counts households, not
    individual members.

14. **Senior discount age calculated as of Jan 1 of the membership year.**

15. **Inngest functions must be idempotent.**

16. **Driver's license numbers encrypted at rest with AES-256-GCM.** Never
    store plaintext.

17. **Stripe payment verification is dual-path.** Both webhook and server-side
    `stripe.checkout.sessions.retrieve()` are used for reliability.

---

## 8  Adding New Features Checklist

- [ ] Check `APP_OVERVIEW.md` for relevant business rules.
- [ ] Create/update Drizzle schema if new tables or columns needed.
- [ ] Create Zod validator in `src/lib/validators/`.
- [ ] Implement server action in `src/actions/` with auth + validation + audit.
- [ ] Build UI page(s) in the appropriate route group.
- [ ] Add unit tests for any new business logic.
- [ ] Add integration tests for new server actions.
- [ ] Update E2E tests if a user flow changed.
- [ ] Add any new env vars to `.env.example`.
- [ ] Update `APP_OVERVIEW.md` if architecture or rules change.

---

*This file should be updated whenever project conventions change.*
