# MCFGC Club Manager — Application Overview

> Montgomery County Fish & Game Club · 6701 Old Nest Egg Rd, Mt Sterling, KY 40353
>
> This document is the single source of truth for the MCFGC Club Manager web
> application. Every architectural choice, data model decision, and business rule
> referenced during development should trace back here.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Primary Workflows](#2-primary-workflows)
3. [Framework & Stack](#3-framework--stack)
4. [High-Level Architecture Diagram](#4-high-level-architecture-diagram)
5. [Data Model Overview](#5-data-model-overview)
6. [Business Rules](#6-business-rules)
7. [Security & Privacy Baseline](#7-security--privacy-baseline)
8. [Deployment](#8-deployment)
9. [Validation Plan](#9-validation-plan)

---

## 1  Product Overview

### What Is This?

MCFGC Club Manager is a purpose-built web application for the Montgomery County
Fish & Game Club (MCFGC), a non-profit sportsman's club founded in 1976 in
Mt. Sterling, Kentucky. The club operates four shooting divisions — Archery,
Pistol, Rifle, and Trap — and caps total membership at **350 households** per
calendar year.

Today the club manages membership renewals, new-member sign-up days, dues
collection, and member communications through a mix of paper forms, spreadsheets,
cash payments, and social media posts. This creates several pain points:

| Problem | Impact |
|---------|--------|
| No live roster count | Officers cannot tell in real time how many slots remain open. |
| Paper-and-cash renewals | Members must pay in person or mail a check; officers must reconcile manually. |
| No renewal deadline enforcement | Lapsed members may occupy slots that could go to new applicants. |
| No communication audit trail | Mass emails sent from personal accounts leave no searchable history. |
| No self-service for members | Members call or visit to check their own status. |

### Who Uses It?

The application serves three distinct audiences:

**Admin (Club Officers)**
- Manage the membership roster (households, members, dependents).
- Create and configure each membership year (capacity cap, renewal deadline,
  sign-up day date/time).
- Configure membership tiers with pricing and discount rules.
- Record in-person payments (cash / check).
- Review and approve new-member applications from sign-up day.
- Send mass email broadcasts (via Resend or Gmail SMTP) and review the
  communications log.
- Manage admin accounts (promote/demote officers).
- View audit history for all administrative actions.

**Member (Dues-Paying Household)**
- Sign up on sign-up day with password creation (instant account).
- Log in via email/password or magic link to view their membership status.
- See application progress (under review, approved, active).
- Pay annual dues online through Stripe Checkout when approved.
- View payment history and household details.

**Public (Unauthenticated)**
- View the public sign-up day page (when admin makes it visible).
- Submit a new-member application with driver's license and optional veteran
  documentation.

### Core Value Proposition

Replace the manual, error-prone membership workflow with a lightweight web app
that:

1. **Enforces the 350-household cap** automatically, with real-time capacity
   visibility for officers and concurrency-safe enrollment.
2. **Accepts online payments** via Stripe Checkout so members can pay from
   home, while still supporting in-person cash/check recorded by an admin.
3. **Automates the renewal cycle** — open renewals on Jan 1, enforce the Jan 31
   cutoff, lapse unpaid memberships, and free those slots for new applicants.
4. **Provides an auditable communications log** so every mass email is recorded
   with subject, body, recipient list, timestamp, and sending provider.
5. **Gives members self-service access** to check status, see application
   progress, and pay dues without calling an officer.
6. **Handles new-member applications** with online sign-up, document upload
   (driver's license, veteran documentation), password creation, and auto-login.

### Membership Model

Membership is **household-based**. A single annual membership covers:

- One **primary member** (the paying adult, age 18+).
- All **dependents** (children under 18 living in the household).

The capacity cap (default 350) counts **households**, not individuals. A
household with one adult and three children occupies exactly one slot.

### Membership Tiers

Membership pricing is configured via **membership tiers** managed by admins.
Each tier has a name, base price, and optional discount:

| Tier | Price | Discount |
|------|-------|----------|
| Standard | $150.00 | None |
| Veteran | $100.00 | Disabled veteran |
| Senior | $100.00 | Age 65+ on Jan 1 |

Admins can create, edit, and deactivate tiers. Tiers are assigned to members
during the application approval process.

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| Admin login (email / password) | Division budgets |
| Member portal (email/password + magic link) | Multi-club / multi-tenant |
| Household + member roster CRUD | Complex CRM features |
| Membership year configuration | Waiting list (explicitly none) |
| Membership tier management | Event calendar / scheduling |
| Capacity cap enforcement | Recurring / auto-pay subscriptions |
| Renewal flow with Jan 31 cutoff | Division-level financial tracking |
| Public sign-up day with online applications | SMS notifications |
| Driver's license + veteran doc upload (encrypted) | |
| Stripe Checkout + webhook + server-side verification | |
| Admin-recorded cash/check payments | |
| Email broadcast (Resend + Gmail SMTP) + log | |
| Audit log for admin actions | |
| Application review queue with veteran doc viewing | |
| Auto-login after signup | |

---

## 2  Primary Workflows

### 2.1  Renewal Cycle (Jan 1 → Jan 31)

Every membership runs on a **calendar-year term** (Jan 1 – Dec 31). Renewal for
the upcoming year proceeds as follows:

1. **Admin creates the new membership year** (e.g., 2027) with:
   - `opensAt` = Jan 1, 2027 00:00 ET
   - `renewalDeadline` = Jan 31, 2027 23:59 ET
   - `capacityCap` = 350 (or admin-adjusted value)
2. **System seeds renewal records.** On Jan 1 (or when the year is created,
   whichever is later) every household that was ACTIVE in the prior year
   receives a new `membership` row with status = `PENDING_RENEWAL`.
3. **Members receive a renewal email** with a link to the member portal where
   they can pay via Stripe Checkout.
4. **Members pay online** (Stripe Checkout → webhook or server-side verification
   confirms payment → status transitions to `ACTIVE`) **or in person** (admin
   records cash/check → status transitions to `ACTIVE`).
5. **Jan 31 cutoff.** A host cron job fires at midnight ET on Feb 1. All
   memberships still in `PENDING_RENEWAL` transition to `LAPSED`.
6. **Slots freed.** Each lapsed household no longer counts toward the capacity
   cap, making room for new members on sign-up day.

```
PENDING_RENEWAL ──pay──▶ ACTIVE
       │
       │ (Feb 1 cron)
       ▼
     LAPSED
```

### 2.2  New-Member Sign-Up Day

MCFGC holds an annual in-person sign-up day for new members. The event is
first-come, first-served with no waiting list.

1. **Admin configures the sign-up event** for the membership year:
   - Date, start time, end time, location, optional notes.
   - Admin can toggle public visibility (shows/hides the `/signup-day` page).
   - Admin can reschedule the date at any time; changes are audit-logged.
2. **Public sign-up page** (`/signup-day`): When visible, applicants fill out
   the online form with:
   - Personal information (name, DOB, address, phone, email)
   - Driver's license number (encrypted at rest with AES-256-GCM)
   - Password creation (min 8 characters) for immediate account access
   - Optional: veteran disabled status with supporting document upload
3. **On submit**: The system creates the household, primary member, and
   membership record with status `NEW_PENDING`. A Better Auth user account is
   created with the provided password. The applicant is auto-logged in and
   redirected to the member dashboard.
4. **Admin reviews applications** in `/admin/applications`:
   - Pending queue shows applicant details with veteran doc "View Doc" button.
   - Admin assigns a membership tier (which sets pricing and discount).
   - Admin approves the application.
5. **Member sees updated status** on their dashboard:
   - Before approval: yellow "Application Under Review" card.
   - After approval: green "Approved — Awaiting Payment" card with tier, price,
     and "Pay with Card" button.
6. **Payment**: Member clicks "Pay with Card" → Stripe Checkout → payment
   confirmed → membership activated to `ACTIVE`.

```
NEW_PENDING ──approved + paid──▶ ACTIVE
     │
     │ (admin approves → tier assigned → member pays)
     ▼
   [status stays NEW_PENDING until payment]
```

### 2.3  Payments

The app supports two payment channels with belt-and-suspenders verification:

**Online (Stripe Checkout)**
- Member clicks "Pay with Card" in the portal (for new-member or renewal).
- Redirect to Stripe-hosted Checkout with the correct amount pre-filled.
- On success, two verification paths:
  1. **Stripe webhook** (`checkout.session.completed`) — fires asynchronously,
     finds matching payment by `stripeSessionId`, activates membership.
  2. **Server-side verification** — on redirect back to dashboard with
     `?payment=success&session_id=...`, the server calls
     `stripe.checkout.sessions.retrieve()` to verify payment status and
     activate membership immediately.
- Both paths are idempotent — safe to run multiple times.

**In-Person (Cash / Check)**
- Admin selects the household/membership in the admin UI.
- Admin clicks "Record Payment," selects method (CASH or CHECK), confirms
  amount, optionally enters check number.
- System creates a `payment` row with `recordedByAdminId` and activates the
  membership.
- Action logged in audit log.

### 2.4  Mass Email Broadcast

1. Admin navigates to "Broadcasts" → "New Broadcast".
2. Admin selects email provider (Resend or Gmail SMTP).
3. Admin composes a message: subject line + rich-text body.
4. Admin selects a recipient filter:
   - **All members** (all households with email on file).
   - **Active only** (status = ACTIVE for the current year).
   - **Lapsed only** (status = LAPSED for the current year).
   - **Pending renewal** (status = PENDING_RENEWAL).
5. Admin previews the recipient count and sends.
6. System dispatches the email via the selected provider:
   - **Resend**: Uses batch API for delivery.
   - **Gmail SMTP**: Sends individually via nodemailer with 200ms delay between
     emails to avoid rate limits (~500/day personal, ~2000/day Workspace).
7. A `communications_log` entry records subject, body, recipient filter,
   recipient count, sending admin, provider used, and batch ID.

---

## 3  Framework & Stack

### Technology Choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 16 (App Router) + React 19 | Single framework for UI and API; React Server Components minimize client-side JavaScript; App Router provides layouts, loading states, and streaming. |
| **Styling** | Tailwind CSS 4 | Utility-first CSS for rapid iteration with minimal bundle size. |
| **Language** | TypeScript (strict mode) | End-to-end type safety from database schema to UI props. |
| **Authentication** | Better Auth v1.4 | Stable 1.x release with native Drizzle adapter, email/password provider, and magic-link plugin. |
| **Database** | PostgreSQL 16 (Docker) | Self-hosted via Docker Compose with isolated network. Production uses the same container image. |
| **ORM** | Drizzle ORM 0.45 | Type-safe schema in TypeScript, lightweight runtime, push-based migrations. |
| **Payments** | Stripe Checkout + Webhooks | Hosted checkout minimizes PCI scope; dual verification (webhook + server-side retrieve) ensures reliability. |
| **Email** | Resend + Gmail SMTP (nodemailer) | Dual-provider support. Resend for batch API; Gmail for clubs that prefer their own email address. Selectable per broadcast. |
| **Hosting** | Docker + Cloudflare Tunnel | Self-hosted Docker containers; Cloudflare Tunnel provides HTTPS frontend with no exposed ports. |
| **Background Jobs** | Host cron + internal API routes | Lightweight cron endpoints protected by `CRON_SECRET`, triggered by host crontab entries. |
| **Encryption** | AES-256-GCM | Sensitive data (driver's license numbers) encrypted at rest using `ENCRYPTION_KEY`. |
| **File Storage** | Local filesystem (Docker volume) | Veteran documentation stored on disk, served via authenticated API route with audit logging. |

### Key Decisions

**Docker + Cloudflare Tunnel over Vercel**: Self-hosted for full control over
data, no serverless cold starts, and simpler ops for a small club. Cloudflare
Tunnel provides free HTTPS with no port forwarding. The tunnel terminates TLS
and forwards plain HTTP to the container; Better Auth is configured with
`useSecureCookies` and `trustedOrigins` to handle this correctly.

**Better Auth over NextAuth v5**: NextAuth v5 remained in beta; Better Auth
shipped a stable v1 with native Drizzle adapter, built-in email/password +
magic-link, and active maintenance.

**Drizzle over Prisma**: Lighter weight (no generated client), faster cold
starts, schema-as-code in TypeScript, and stronger type inference for joins.

**Dual Email Providers**: Resend for reliable batch delivery; Gmail SMTP as a
zero-cost option using the club's existing email account.

**Schema Push over Migrations**: `drizzle-kit push --force` runs on every
startup via `instrumentation.ts`. Simple and reliable for a single-instance
deployment.

---

## 4  High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Docker Host (Production)                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Next.js 16 (App Router)                       │  │
│  │                  Port 3001 → Cloudflare Tunnel                 │  │
│  │                                                                │  │
│  │  ┌─────────────┐  ┌────────────┐  ┌────────────────────────┐  │  │
│  │  │  (admin)/*  │  │ (member)/* │  │  /api/*                │  │  │
│  │  │  Admin UI   │  │ Member     │  │                        │  │  │
│  │  │  (RSC +     │  │ Portal     │  │  /api/auth/**          │  │  │
│  │  │   Server    │  │ (RSC +     │  │  (Better Auth)         │  │  │
│  │  │   Actions)  │  │  Server    │  │                        │  │  │
│  │  │             │  │  Actions)  │  │  /api/webhooks/stripe  │  │  │
│  │  ├─────────────┤  ├────────────┤  │  /api/cron/*           │  │  │
│  │  │  (public)/* │  │  (auth)/*  │  │  /api/admin/veteran-doc│  │  │
│  │  │  Signup Day │  │  Login     │  │                        │  │  │
│  │  └──────┬──────┘  └─────┬──────┘  └───────────┬────────────┘  │  │
│  │         └───────┬───────┘                     │               │  │
│  │                 ▼                             ▼               │  │
│  │        ┌──────────────────────────────────────────┐           │  │
│  │        │            Drizzle ORM 0.45              │           │  │
│  │        │     (Type-safe query builder)            │           │  │
│  │        └──────────────────┬───────────────────────┘           │  │
│  └───────────────────────────┼────────────────────────────────────┘  │
│                              │                                       │
│  ┌───────────────────────────┼────────────────────────────────────┐  │
│  │  mcfgc-internal network (bridge, isolated)                     │  │
│  │                           │                                    │  │
│  │          ┌────────────────▼────────────────┐                   │  │
│  │          │    PostgreSQL 16 (Alpine)       │                   │  │
│  │          │    No exposed ports             │                   │  │
│  │          │    pgdata volume                │                   │  │
│  │          └─────────────────────────────────┘                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Host Cron (crontab)                                          │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐      │  │
│  │  │ lapse-check (Feb 1)  │  │ db-backup (daily 2am ET) │      │  │
│  │  │ → POST /api/cron/... │  │ → POST /api/cron/...     │      │  │
│  │  └──────────────────────┘  └──────────────────────────┘      │  │
│  └────────────────────────────────────────────────────────────────┘  │
└────────────────────────┬──────────────────────────────────────────────┘
                         │ Cloudflare Tunnel (HTTPS)
                         ▼
                    ┌──────────┐
                    │  Users   │
                    │ (Browser)│
                    └──────────┘

External Services:
  ┌─────────┐   ┌─────────┐   ┌──────────┐
  │  Stripe  │   │ Resend  │   │  Gmail   │
  │ Payments │   │  Email  │   │  SMTP    │
  └─────────┘   └─────────┘   └──────────┘
```

### Data Flow Summary

| Flow | Path |
|------|------|
| Admin manages roster | Browser → `/admin/*` → Server Action → Drizzle → PostgreSQL |
| Member pays dues | Browser → "Pay with Card" → Stripe Checkout → webhook + server-side verify → Drizzle → PostgreSQL |
| Admin records cash payment | Browser → `/admin/payments` → Server Action → Drizzle → PostgreSQL |
| New member signs up | Browser → `/signup-day` → Server Action → create household + member + auth account → auto-login → redirect to dashboard |
| Admin reviews application | Browser → `/admin/applications` → assign tier → approve → member sees "Pay with Card" |
| Renewal lapse cron | Host cron → `POST /api/cron/lapse-check` → lapse-check logic → Drizzle → PostgreSQL |
| Mass email broadcast | Admin → compose → server action → `sendBroadcastEmail()` → Resend or Gmail SMTP |
| Auth (admin) | Browser → `/login` → Better Auth email/password → session |
| Auth (member) | Browser → `/login` or `/magic-link` → Better Auth → session |
| Veteran doc view | Admin → `/admin/applications` → "View Doc" → `/api/admin/veteran-doc/[memberId]` (audit-logged) |

---

## 5  Data Model Overview

### Entity Relationship Summary

```
household 1──* member
household 1──* membership
membership *──1 membership_year
membership *──1 membership_tier (nullable, assigned on approval)
membership 1──* payment
membership_year 1──1 signup_event_config
communications_log *──1 member (sentByAdminId)
audit_log *──1 member (actorId, nullable)
payment *──1 member (recordedByAdminId, nullable)
```

### Entity Definitions

#### 5.1  `household`

The billable unit. One household = one membership slot toward the capacity cap.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | Family / household display name |
| `address_line1` | `text` | NOT NULL | |
| `address_line2` | `text` | nullable | |
| `city` | `text` | NOT NULL | |
| `state` | `text` | NOT NULL, default `'KY'` | |
| `zip` | `text` | NOT NULL | |
| `phone` | `text` | nullable | |
| `email` | `text` | NOT NULL, UNIQUE | Primary contact email for the household |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.2  `member`

An individual person within a household. One member is PRIMARY (the paying
adult); others are DEPENDENT (children under 18).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `household_id` | `uuid` | FK → `household.id`, NOT NULL | |
| `first_name` | `text` | NOT NULL | |
| `last_name` | `text` | NOT NULL | |
| `email` | `text` | UNIQUE, nullable | Null for minors without email |
| `date_of_birth` | `date` | NOT NULL | Used for senior discount calculation |
| `role` | `enum('PRIMARY','DEPENDENT')` | NOT NULL | |
| `is_veteran_disabled` | `boolean` | NOT NULL, default `false` | Disabled veteran flag for discount |
| `is_admin` | `boolean` | NOT NULL, default `false` | Club officer / admin access |
| `admin_role` | `enum('SUPER_ADMIN','ADMIN')` | nullable | Admin privilege level |
| `driver_license_encrypted` | `text` | nullable | AES-256-GCM encrypted DL number |
| `veteran_doc_filename` | `text` | nullable | Filename of uploaded veteran documentation |
| `must_change_password` | `boolean` | NOT NULL, default `false` | Forces password change on next login |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.3  `membership_year`

Configuration for a single calendar-year membership period.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `year` | `integer` | NOT NULL, UNIQUE | e.g., 2027 |
| `opens_at` | `timestamptz` | NOT NULL | When renewals open (typically Jan 1) |
| `renewal_deadline` | `timestamptz` | NOT NULL | Cutoff (typically Jan 31 23:59 ET) |
| `capacity_cap` | `integer` | NOT NULL, default `350` | Max households for this year |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.4  `membership_tier`

Configurable membership pricing tiers.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | e.g., "Standard", "Veteran", "Senior" |
| `price_cents` | `integer` | NOT NULL | Tier price in cents |
| `discount_type` | `enum('NONE','VETERAN','SENIOR')` | NOT NULL, default `'NONE'` | |
| `is_active` | `boolean` | NOT NULL, default `true` | Soft-disable without deleting |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

Default tiers are seeded on first startup via `instrumentation.ts`.

#### 5.5  `membership`

A household's membership record for a specific year. Central table for status
tracking and capacity enforcement.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `household_id` | `uuid` | FK → `household.id`, NOT NULL | |
| `membership_year_id` | `uuid` | FK → `membership_year.id`, NOT NULL | |
| `membership_tier_id` | `uuid` | FK → `membership_tier.id`, nullable | Assigned on approval |
| `status` | `enum('PENDING_RENEWAL','ACTIVE','LAPSED','NEW_PENDING')` | NOT NULL | |
| `price_cents` | `integer` | NOT NULL | Amount owed (set from tier on approval) |
| `discount_type` | `enum('NONE','VETERAN','SENIOR')` | NOT NULL, default `'NONE'` | |
| `enrolled_at` | `timestamptz` | nullable | When membership became ACTIVE |
| `lapsed_at` | `timestamptz` | nullable | When membership transitioned to LAPSED |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Constraints:**
- `UNIQUE (household_id, membership_year_id)` — one membership per household
  per year.

**Status Transitions:**
```
[new year created]  ──▶  PENDING_RENEWAL  ──pay──▶  ACTIVE
                              │
                              │ (Feb 1 cron)
                              ▼
                           LAPSED

[sign-up day]  ──▶  NEW_PENDING  ──tier assigned + paid──▶  ACTIVE
```

#### 5.6  `payment`

Records every payment attempt and outcome.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `membership_id` | `uuid` | FK → `membership.id`, NOT NULL | |
| `amount_cents` | `integer` | NOT NULL | Actual amount paid |
| `method` | `enum('STRIPE','CASH','CHECK')` | NOT NULL | |
| `check_number` | `text` | nullable | For CHECK payments |
| `stripe_session_id` | `text` | UNIQUE, nullable | Stripe Checkout session ID |
| `stripe_payment_intent_id` | `text` | nullable | For refund lookups |
| `recorded_by_admin_id` | `uuid` | FK → `member.id`, nullable | Non-null for in-person payments |
| `status` | `enum('PENDING','SUCCEEDED','FAILED','REFUNDED')` | NOT NULL | |
| `paid_at` | `timestamptz` | nullable | When payment succeeded |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.7  `signup_event_config`

Stores the annual sign-up day configuration for each membership year.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `membership_year_id` | `uuid` | FK → `membership_year.id`, UNIQUE, NOT NULL | One event per year |
| `event_date` | `date` | NOT NULL | |
| `event_start_time` | `time` | NOT NULL | |
| `event_end_time` | `time` | NOT NULL | |
| `location` | `text` | NOT NULL, default `'6701 Old Nest Egg Rd, Mt Sterling, KY 40353'` | |
| `notes` | `text` | nullable | |
| `is_public` | `boolean` | NOT NULL, default `false` | Controls visibility of `/signup-day` |
| `updated_by_admin_id` | `uuid` | FK → `member.id`, NOT NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.8  `communications_log`

Immutable record of every mass email broadcast sent by an admin.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `subject` | `text` | NOT NULL | Email subject line |
| `body` | `text` | NOT NULL | Email body (HTML) |
| `recipient_filter` | `jsonb` | NOT NULL | e.g., `{"status": "ACTIVE", "year": 2027}` |
| `recipient_count` | `integer` | NOT NULL | Number of recipients at send time |
| `sent_by_admin_id` | `uuid` | FK → `member.id`, NOT NULL | |
| `sent_at` | `timestamptz` | NOT NULL | |
| `resend_batch_id` | `text` | nullable | Provider batch/tracking ID |
| `email_provider` | `text` | nullable | "resend" or "gmail" |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.9  `audit_log`

Append-only log of all state-changing operations for accountability.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `actor_id` | `uuid` | FK → `member.id`, nullable | Null for SYSTEM actions |
| `actor_type` | `enum('ADMIN','SYSTEM','MEMBER')` | NOT NULL | |
| `action` | `text` | NOT NULL | e.g., `membership.activate`, `payment.record` |
| `entity_type` | `text` | NOT NULL | e.g., `membership`, `household` |
| `entity_id` | `uuid` | NOT NULL | PK of the affected row |
| `metadata` | `jsonb` | nullable | Arbitrary context (old/new values, etc.) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.10  Auth Tables (Managed by Better Auth)

Better Auth with the Drizzle adapter creates and manages:

- `user` — auth identity (maps 1:1 to a `member` row via email match).
- `session` — active sessions.
- `account` — provider accounts (email/password, magic-link).
- `verification` — magic-link tokens and email verification codes.

These tables are auto-migrated by Better Auth. Do not modify them directly
in Drizzle schema files.

---

## 6  Business Rules

Each rule is stated as a testable assertion with its enforcement mechanism.

### BR-1  Capacity Enforcement

> **The number of memberships with status IN (ACTIVE, PENDING_RENEWAL,
> NEW_PENDING) for a given membership year must never exceed that year's
> `capacity_cap`.**

**Enforcement:** `SELECT COUNT(*) ... FOR UPDATE` inside a serialized
transaction before any new enrollment is committed.

### BR-2  Renewal Deadline

> **Any membership with status = PENDING_RENEWAL after the membership year's
> `renewal_deadline` must transition to LAPSED.**

**Enforcement:** Host cron triggers `POST /api/cron/lapse-check` at
`0 5 1 2 *` (Feb 1 00:00 ET = 05:00 UTC). Endpoint protected by `CRON_SECRET` header.

### BR-3  Slot Release on Lapse

> **When a membership transitions from PENDING_RENEWAL to LAPSED, the slot is
> immediately freed for new enrollment.**

**Enforcement:** The capacity count query only includes statuses (ACTIVE,
PENDING_RENEWAL, NEW_PENDING). LAPSED is excluded by definition.

### BR-4  Pricing (Tier-Based)

> **Membership pricing is determined by admin-configured tiers. Default tiers:
> $150.00 standard, $100.00 disabled veteran, $100.00 senior (age ≥ 65 on
> Jan 1 of the membership year).**

**Enforcement:** Tiers are managed in the `membership_tier` table. Price is
set on the membership record when a tier is assigned during approval.

### BR-5  Discount Priority

> **If a member qualifies for both the disabled veteran discount and the senior
> discount, the veteran discount takes precedence for tracking purposes.**

Both discounts result in the same price ($100), but the `discount_type` field
preserves which reason applied for reporting purposes.

### BR-6  Family Inclusion

> **A membership includes the primary member and all dependents under age 18.
> No additional charge applies for dependents.**

### BR-7  Sign-Up Day Override

> **An admin may change the sign-up event date and time at any point. Every
> change is recorded in the audit log.**

### BR-8  First-Come / First-Served

> **New member registrations on sign-up day are ordered by `enrolled_at`
> timestamp. There is no reservation system and no waiting list.**

### BR-9  Admin Audit Trail

> **Every state-changing action performed by an admin must be recorded in the
> `audit_log` with the admin's ID, the action name, the affected entity, and
> a timestamp.**

### BR-10  Payment Idempotency

> **Processing a Stripe webhook event or server-side verification that has
> already been handled must complete with no side effects.**

**Enforcement:** Check for existing payment by `stripe_session_id` before
processing. Both webhook and server-side verification paths are idempotent.

### BR-11  Encrypted Sensitive Data

> **Driver's license numbers must be encrypted at rest using AES-256-GCM.
> They are only decrypted on-demand by authorized admin users.**

**Enforcement:** `encryption.ts` utility encrypts on write, decrypts on read.
`ENCRYPTION_KEY` env var (64-char hex = 32 bytes) is required.

---

## 7  Security & Privacy Baseline

### 7.1  Authentication

| Audience | Method | Provider |
|----------|--------|----------|
| Admin (club officer) | Email + password | Better Auth email/password |
| Member | Email + password (set at signup) or magic link | Better Auth email/password + magic-link plugin |

- Admin accounts are seeded from env vars on first startup. Additional admins
  are promoted via the admin management panel.
- Members create their password during the sign-up day application. They can
  also use magic link for passwordless login.
- Sessions are stored in the database via Better Auth's Drizzle adapter.

**Reverse Proxy (Cloudflare Tunnel) Configuration:**

Production runs behind Cloudflare Tunnel, which terminates TLS and forwards
plain HTTP to the Docker container. This requires explicit Better Auth
configuration:

- `baseURL` and `trustedOrigins` set from `BETTER_AUTH_URL` env var so the
  server knows its external-facing origin.
- `advanced.useSecureCookies: true` in production — sets `__Secure-` prefixed
  cookies even though internal traffic is HTTP.
- `advanced.defaultCookieAttributes` with `secure: true`, `httpOnly: true`,
  `sameSite: "lax"` for proper cookie behavior behind the tunnel.
- Middleware checks both `__Secure-better-auth.session_token` and the plain
  `better-auth.session_token` cookie name.
- Client-side auth uses `window.location.origin` as the base URL (not a
  build-time env var) so it works on any domain without Docker build args.

### 7.2  Authorization

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | Full access + admin management (promote/demote) |
| `ADMIN` | Full CRUD on roster, payments, broadcasts, audit log |
| `MEMBER` | Read own household/membership; initiate own payment |
| `UNAUTHENTICATED` | Login page + public sign-up day page only |

**Enforcement layers:**
1. **Middleware** (`src/middleware.ts`): Redirects based on auth state and role.
2. **Server Actions**: Re-validates session and checks role before executing.
3. **Database queries**: Member-facing queries scope to authenticated user's
   household ID.

### 7.3  Encryption at Rest

- **Driver's license numbers**: AES-256-GCM encrypted using `ENCRYPTION_KEY`.
  Stored as ciphertext in `member.driver_license_encrypted`.
- **Veteran documents**: Stored as files on disk, served through authenticated
  API route with admin-only access and audit logging.
- **Database**: PostgreSQL data stored in Docker volume.
- **Secrets**: All API keys and passwords in environment variables, never in
  the repository.

### 7.4  Secrets Management

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (composed from DB_USER/PASSWORD/NAME in prod) |
| `BETTER_AUTH_URL` | External app URL (e.g., `https://mcfgc.marcle.ai`). Sets baseURL + trustedOrigins for Better Auth. |
| `BETTER_AUTH_SECRET` | Session signing (auto-generated by `setup.sh`) |
| `ENCRYPTION_KEY` | AES-256-GCM key for DL encryption (auto-generated by `setup.sh`) |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend email API key (optional) |
| `GMAIL_APP_PASSWORD` | Gmail App Password for SMTP (optional) |
| `CRON_SECRET` | Secret for authenticating cron HTTP requests |

`.env.local` (dev) and `.env.production` (prod) are both gitignored.
`setup.sh` auto-generates cryptographic secrets on first run.

### 7.5  Input Validation

- All server actions validate input with **Zod schemas** before any database
  interaction.
- All database queries use **parameterized statements** via Drizzle.
- HTML email body content is sanitized before storage and rendering.

---

## 8  Deployment

### Development

```bash
# Prerequisites: Docker Desktop
docker compose up -d --build
# App runs at http://localhost:3001
```

Uses `docker-compose.yml` (dev target with hot reload, DB port exposed for
Drizzle Studio).

### Production

```bash
# 1. Run setup script (generates .env.production with auto-generated secrets)
chmod +x setup.sh
./setup.sh

# 2. Edit .env.production — add Stripe keys, optionally Resend/Gmail creds

# 3. Start production containers
docker compose -f docker-compose.prod.yml up -d --build

# 4. Point Cloudflare Tunnel to http://localhost:3001
```

**Production architecture:**
- `docker-compose.prod.yml` with isolated `mcfgc-internal` bridge network.
- PostgreSQL has **no exposed ports** — only accessible on the Docker network.
- App container uses the `runner` multi-stage build target (`output: standalone`).
- `APP_DOMAIN` env var drives all URL-based configuration.
- `setup.sh` auto-generates: `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`,
  `DB_PASSWORD`.
- Schema push runs automatically on startup via `instrumentation.ts`.
- Admin account seeded from env vars on first startup.
- Default membership tiers seeded on first startup.

### Environment Variables

See `.env.example` for the complete reference with all variables documented.

---

## 9  Validation Plan

### Developer Commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d --build` | Start dev environment |
| `docker compose -f docker-compose.prod.yml up -d --build` | Start production |
| `pnpm lint` | ESLint check |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit + integration |
| `pnpm test:e2e` | Playwright end-to-end |

### Test Layers

| Layer | Tool | Scope |
|-------|------|-------|
| **Unit** | Vitest | Business logic: pricing, capacity, dates, audit |
| **Integration** | Vitest + test DB | Server actions with real database |
| **E2E** | Playwright | Full browser flows |

---

*Last updated: 2026 · MCFGC Club Manager v1.2.0*
