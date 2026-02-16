# MCFGC Club Manager — Application Overview

> Montgomery County Fish & Game Club · 6701 Old Nest Egg Rd, Mt Sterling, KY 40353
>
> This document is the single source of truth for the MVP of the MCFGC Club
> Manager web application. Every architectural choice, data model decision, and
> business rule referenced during development should trace back here.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Primary Workflows](#2-primary-workflows)
3. [Framework & Stack](#3-framework--stack)
4. [High-Level Architecture Diagram](#4-high-level-architecture-diagram)
5. [Data Model Overview](#5-data-model-overview)
6. [Business Rules](#6-business-rules)
7. [Security & Privacy Baseline](#7-security--privacy-baseline)
8. [MVP Milestones](#8-mvp-milestones)
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

The application serves two distinct audiences:

**Admin (Club Officers)**
- Manage the membership roster (households, members, dependents).
- Create and configure each membership year (capacity cap, renewal deadline,
  sign-up day date/time).
- Record in-person payments (cash / check).
- Send mass email broadcasts and review the communications log.
- View audit history for all administrative actions.

**Member (Dues-Paying Household)**
- Log in via magic link (email) to view their own membership status.
- Pay annual renewal online through Stripe Checkout.
- See payment history and household details.

### Core Value Proposition

Replace the manual, error-prone membership workflow with a lightweight web app
that:

1. **Enforces the 350-household cap** automatically, with real-time capacity
   visibility for officers and concurrency-safe enrollment.
2. **Accepts online payments** via Stripe Checkout so members can renew from
   home, while still supporting in-person cash/check recorded by an admin.
3. **Automates the renewal cycle** — open renewals on Jan 1, enforce the Jan 31
   cutoff, lapse unpaid memberships, and free those slots for new applicants.
4. **Provides an auditable communications log** so every mass email is recorded
   with subject, body, recipient list, and timestamp.
5. **Gives members self-service access** to check status and pay dues without
   calling an officer.

### Membership Model

Membership is **household-based**. A single annual membership covers:

- One **primary member** (the paying adult, age 18+).
- All **dependents** (children under 18 living in the household).

The capacity cap (default 350) counts **households**, not individuals. A
household with one adult and three children occupies exactly one slot.

### Scope & Non-Goals

| In Scope (MVP) | Out of Scope |
|-----------------|-------------|
| Admin login (email / password) | Division budgets — Phase 2 |
| Member portal (magic link auth) | Multi-club / multi-tenant |
| Household + member roster CRUD | Complex CRM features |
| Membership year configuration | Waiting list (explicitly none) |
| Capacity cap enforcement | Event calendar / scheduling |
| Renewal flow with Jan 31 cutoff | Online new-member applications (sign-up is in-person) |
| Stripe Checkout + webhook handling | Recurring / auto-pay subscriptions |
| Admin-recorded cash/check payments | Division-level financial tracking |
| Email broadcast + communications log | SMS notifications |
| Audit log for admin actions | Document / file uploads |

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
4. **Members pay online** (Stripe Checkout → webhook confirms payment →
   status transitions to `ACTIVE`) **or in person** (admin records cash/check →
   status transitions to `ACTIVE`).
5. **Jan 31 cutoff.** An Inngest cron job fires at midnight ET on Feb 1. All
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
   - Admin can reschedule (override) the date at any time; the change is logged
     in the audit log.
2. **Day of the event.** New applicants arrive in person. An officer uses the
   admin UI to:
   - Create a new household + primary member record.
   - Add any dependents (children under 18).
   - Confirm application, payment, rules review, and range safety orientation
     are complete.
   - Record payment (Stripe terminal, cash, or check).
3. **Capacity is checked in real time.** Before each new enrollment is saved,
   the system runs a capacity check (`SELECT COUNT ... FOR UPDATE`). If the cap
   is reached, enrollment is rejected with a clear message.
4. **New membership created** with status = `ACTIVE` (or `NEW_PENDING` until
   payment clears if paying by Stripe).

```
NEW_PENDING ──pay confirmed──▶ ACTIVE
     │
     │ (payment fails / timeout)
     ▼
   [row deleted or LAPSED — admin discretion]
```

### 2.3  Payments

The app supports two payment channels:

**Online (Stripe Checkout)**
- Member clicks "Pay Renewal" in the portal (or admin generates a checkout link
  for a specific household).
- Redirect to Stripe-hosted Checkout with the correct amount pre-filled:
  - $150.00 standard
  - $100.00 disabled veteran discount
  - $100.00 senior discount (age ≥ 65)
- On success, Stripe sends a `checkout.session.completed` webhook.
- Webhook handler verifies signature, finds the matching membership, records a
  `payment` row with `method = STRIPE`, and transitions membership to `ACTIVE`.
- **Idempotency**: If a webhook with the same `stripeSessionId` has already been
  processed, return 200 OK with no side effects.

**In-Person (Cash / Check)**
- Admin selects the household in the admin roster UI.
- Admin clicks "Record Payment," selects method (CASH or CHECK), confirms
  amount.
- System creates a `payment` row with `recordedByAdminId` set to the current
  admin and transitions membership to `ACTIVE`.
- Action logged in audit log.

### 2.4  Mass Email Broadcast

1. Admin navigates to the "Broadcast" section of the admin UI.
2. Admin composes a message: subject line + rich-text body.
3. Admin selects a recipient filter:
   - **All members** (all households with email on file).
   - **Active only** (status = ACTIVE for the current year).
   - **Lapsed only** (status = LAPSED for the current year).
   - **Pending renewal** (status = PENDING_RENEWAL).
4. Admin previews the recipient count and sends.
5. System dispatches the email via Resend's batch API (queued through Inngest
   for reliability and rate-limit management).
6. A `communications_log` entry is created with subject, body, recipient filter,
   recipient count, sending admin, timestamp, and Resend batch ID.

---

## 3  Framework & Stack

### Technology Choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 15 (App Router) + React 19 | Single framework for UI and API; React Server Components minimize client-side JavaScript; App Router provides layouts, loading states, and streaming out of the box. |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Utility-first CSS for rapid iteration; shadcn/ui provides accessible, copy-paste component primitives (data tables, dialogs, forms) with no vendor lock-in. |
| **Language** | TypeScript (strict mode) | End-to-end type safety from database schema to UI props; catches entire classes of bugs at compile time. |
| **Authentication** | Better Auth v1 | Stable 1.x release with first-class Drizzle adapter, built-in email/password provider (for admins), and a magic-link plugin (for members). Chosen over NextAuth v5, which has not reached a stable release. |
| **Database** | PostgreSQL on Neon | Serverless Postgres with instant provisioning, database branching for preview deployments, and a native Vercel integration. The free tier is generous enough for MVP. |
| **ORM / Migrations** | Drizzle ORM | Type-safe schema definitions in TypeScript, lightweight runtime (no heavy query engine), push-based migrations (`drizzle-kit push`), and excellent PostgreSQL dialect support. |
| **Payments** | Stripe Checkout + Webhooks | Industry-standard hosted checkout minimizes PCI scope; webhook-driven architecture ensures payment state is always authoritative from Stripe. |
| **Email** | Resend | Developer-focused API, React Email for template authoring, batch endpoint for broadcasts, generous free tier (100 emails/day, 3 000/month). |
| **Hosting** | Vercel | Zero-config deployment for Next.js; automatic preview deploys per PR; serverless functions for API routes; built-in analytics and logging. |
| **Background Jobs** | Inngest | Serverless-native job runner with cron scheduling, event-driven functions, automatic retries, and a Vercel integration. Used for: renewal lapse cron, email batch dispatch, and future scheduled tasks. |
| **Logging / Monitoring** | Vercel Logs + structured `console.log` | Sufficient for MVP. All log entries use structured JSON format. Upgrade path to Axiom or Sentry when needed. |
| **File Storage** | None (MVP) | No file uploads are required for MVP. If needed later, Vercel Blob or S3 can be added. |

### Key Decision: Better Auth over NextAuth v5

NextAuth (now Auth.js) v5 has remained in beta/RC status without reaching a
stable 1.0 release, creating uncertainty for production use. Better Auth shipped
a stable v1 with:

- Native Drizzle ORM adapter (no extra packages).
- Built-in email/password provider with password hashing.
- Magic-link plugin for passwordless member login.
- Role-based session data (we store `isAdmin` in the session).
- Active maintenance and clear documentation.

### Key Decision: Neon over Supabase

While Supabase bundles auth, storage, and real-time features, we only need a
database. Neon provides pure serverless PostgreSQL with:

- Database branching (one branch per Vercel preview deploy).
- No idle-timeout cold starts on the free tier (scale-to-zero with fast resume).
- A Vercel Marketplace integration for automatic env var injection.

### Key Decision: Drizzle over Prisma

Drizzle ORM is lighter-weight than Prisma, which matters on serverless:

- No generated client or query engine binary — faster cold starts.
- Schema is plain TypeScript — no `.prisma` DSL file.
- Push-based migrations with `drizzle-kit push` simplify the dev workflow.
- Stronger TypeScript inference for complex queries (joins, subqueries).

---

## 4  High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Vercel Platform                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Next.js 15 (App Router)                   │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │  (admin)/*   │  │  (member)/*  │  │  /api/*         │  │  │
│  │  │  Admin UI    │  │  Member      │  │                 │  │  │
│  │  │  (RSC +      │  │  Portal      │  │  /api/auth/**   │  │  │
│  │  │   Server     │  │  (RSC +      │  │  (Better Auth)  │  │  │
│  │  │   Actions)   │  │   Server     │  │                 │  │  │
│  │  │              │  │   Actions)   │  │  /api/webhooks/ │  │  │
│  │  │              │  │              │  │   stripe        │  │  │
│  │  │              │  │              │  │  (Stripe WH)    │  │  │
│  │  │              │  │              │  │                 │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  │  /api/inngest  │  │  │
│  │         │                 │          │  (Inngest serve)│  │  │
│  │         └────────┬────────┘          └────────┬────────┘  │  │
│  │                  │                            │           │  │
│  │                  ▼                            ▼           │  │
│  │         ┌──────────────────────────────────────────┐      │  │
│  │         │            Drizzle ORM                   │      │  │
│  │         │     (Type-safe query builder)            │      │  │
│  │         └──────────────────┬───────────────────────┘      │  │
│  └────────────────────────────┼───────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────┼───────────────────────────────┐  │
│  │  Inngest Functions                                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ lapse-check  │  │ email-batch  │  │ seed-renewals   │  │  │
│  │  │ (cron: Feb 1)│  │ (event)      │  │ (event)         │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼───────┐ ┌────▼────┐  ┌───────▼───────┐
        │     Neon      │ │  Resend │  │    Stripe     │
        │  PostgreSQL   │ │  Email  │  │   Payments    │
        │  (Database)   │ │  API    │  │   + Checkout  │
        └───────────────┘ └─────────┘  └───────────────┘

External Actors:
  ┌─────────┐                              ┌──────────┐
  │  Admin   │──browser──▶ /admin/*        │  Member  │──browser──▶ /member/*
  │ (Officer)│                              │          │
  └─────────┘                              └──────────┘

  ┌─────────┐                              ┌──────────┐
  │  Stripe  │──webhook──▶ /api/webhooks/  │  Inngest │──invoke──▶ /api/inngest
  │          │             stripe           │  Cloud   │
  └─────────┘                              └──────────┘
```

### Data Flow Summary

| Flow | Path |
|------|------|
| Admin manages roster | Browser → `/admin/*` → Server Action → Drizzle → Neon |
| Member pays renewal | Browser → `/member/renew` → Stripe Checkout → Stripe webhook → `/api/webhooks/stripe` → Drizzle → Neon |
| Admin records cash payment | Browser → `/admin/payments` → Server Action → Drizzle → Neon |
| Renewal lapse cron | Inngest Cloud → `/api/inngest` → `lapse-check` function → Drizzle → Neon |
| Mass email broadcast | Admin → Server Action → Inngest event → `email-batch` function → Resend API |
| Auth (admin) | Browser → `/api/auth/**` → Better Auth → Drizzle → Neon |
| Auth (member) | Browser → magic-link email → `/api/auth/**` → Better Auth → Drizzle → Neon |

---

## 5  Data Model Overview

### Entity Relationship Summary

```
household 1──* member
household 1──* membership
membership *──1 membership_year
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
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Constraints:**
- Each household must have exactly one member with `role = 'PRIMARY'`.
  (Enforced at application layer in MVP; consider a partial unique index later.)
- `is_admin` may only be `true` when `role = 'PRIMARY'`.

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

#### 5.4  `membership`

A household's membership record for a specific year. This is the central table
for status tracking and capacity enforcement.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `household_id` | `uuid` | FK → `household.id`, NOT NULL | |
| `membership_year_id` | `uuid` | FK → `membership_year.id`, NOT NULL | |
| `status` | `enum('PENDING_RENEWAL','ACTIVE','LAPSED','NEW_PENDING')` | NOT NULL | |
| `price_cents` | `integer` | NOT NULL | Amount owed (15000, 10000) |
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

[sign-up day]  ──▶  NEW_PENDING  ──pay confirmed──▶  ACTIVE
```

#### 5.5  `payment`

Records every payment attempt and outcome.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `membership_id` | `uuid` | FK → `membership.id`, NOT NULL | |
| `amount_cents` | `integer` | NOT NULL | Actual amount paid |
| `method` | `enum('STRIPE','CASH','CHECK')` | NOT NULL | |
| `stripe_session_id` | `text` | UNIQUE, nullable | Stripe Checkout session ID |
| `stripe_payment_intent_id` | `text` | nullable | For refund lookups |
| `recorded_by_admin_id` | `uuid` | FK → `member.id`, nullable | Non-null for in-person payments |
| `status` | `enum('PENDING','SUCCEEDED','FAILED','REFUNDED')` | NOT NULL | |
| `paid_at` | `timestamptz` | nullable | When payment succeeded |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**CHECK constraints (application-layer in MVP, DB-layer later):**
- If `method = 'STRIPE'` then `stripe_session_id` must be NOT NULL.
- If `method IN ('CASH','CHECK')` then `recorded_by_admin_id` must be NOT NULL.

#### 5.6  `signup_event_config`

Stores the annual sign-up day configuration for each membership year.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `membership_year_id` | `uuid` | FK → `membership_year.id`, UNIQUE, NOT NULL | One event per year |
| `event_date` | `date` | NOT NULL | |
| `event_start_time` | `time` | NOT NULL | |
| `event_end_time` | `time` | NOT NULL | |
| `location` | `text` | NOT NULL, default `'6701 Old Nest Egg Rd, Mt Sterling, KY 40353'` | |
| `notes` | `text` | nullable | Admin notes (e.g., "Rescheduled due to weather") |
| `updated_by_admin_id` | `uuid` | FK → `member.id`, NOT NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.7  `communications_log`

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
| `resend_batch_id` | `text` | nullable | Resend API batch ID for tracking |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### 5.8  `audit_log`

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

**Indexes:** `(entity_type, entity_id)`, `(actor_id)`, `(created_at)`.

#### 5.9  Auth Tables (Managed by Better Auth)

Better Auth with the Drizzle adapter creates and manages:

- `user` — auth identity (maps 1:1 to a `member` row via email match).
- `session` — active sessions.
- `account` — provider accounts (email/password, magic-link).
- `verification` — magic-link tokens and email verification codes.

These tables are auto-migrated by Better Auth. Do not modify them directly
in Drizzle schema files.

### Family Modeling Example

```
household: { id: "h1", name: "Smith Family", email: "jsmith@example.com" }
  └─ member: { id: "m1", household_id: "h1", role: PRIMARY,
               first_name: "John", last_name: "Smith",
               date_of_birth: "1975-03-15", is_veteran_disabled: true }
  └─ member: { id: "m2", household_id: "h1", role: DEPENDENT,
               first_name: "Emma", last_name: "Smith",
               date_of_birth: "2012-07-22", email: null }
  └─ member: { id: "m3", household_id: "h1", role: DEPENDENT,
               first_name: "Liam", last_name: "Smith",
               date_of_birth: "2015-01-10", email: null }

membership: { household_id: "h1", membership_year_id: "y2027",
              status: ACTIVE, price_cents: 10000,
              discount_type: VETERAN }
```

This household occupies **one slot** toward the 350 cap. John qualifies for the
disabled veteran discount ($100). Emma and Liam are included as dependents at no
extra charge.

### Capacity Enforcement Query

```sql
-- Run inside a transaction with row-level locking
BEGIN;

SELECT COUNT(*) AS occupied
FROM membership
WHERE membership_year_id = :yearId
  AND status IN ('ACTIVE', 'PENDING_RENEWAL', 'NEW_PENDING')
FOR UPDATE;

-- Application code checks: occupied < capacity_cap
-- If yes: INSERT new membership
-- If no: ROLLBACK and return capacity-full error

COMMIT;
```

The `FOR UPDATE` clause acquires row-level locks, preventing two concurrent
enrollments from both reading the same count and both succeeding past the cap.

---

## 6  Business Rules

Each rule is stated as a testable assertion with its enforcement mechanism.

### BR-1  Capacity Enforcement

> **The number of memberships with status IN (ACTIVE, PENDING_RENEWAL,
> NEW_PENDING) for a given membership year must never exceed that year's
> `capacity_cap`.**

**Enforcement:** `SELECT COUNT(*) ... FOR UPDATE` inside a serialized
transaction before any new enrollment is committed.

**Test cases:**
- Insert memberships up to cap → next insert rejected with `CAPACITY_FULL`.
- Two concurrent inserts at cap − 1 → exactly one succeeds, one fails.
- Lapsing a membership reduces count → next insert succeeds.

### BR-2  Renewal Deadline

> **Any membership with status = PENDING_RENEWAL after the membership year's
> `renewal_deadline` must transition to LAPSED.**

**Enforcement:** Inngest cron function `lapse-check` scheduled for
`0 5 1 2 *` (Feb 1 00:00 ET = 05:00 UTC). Runs a batch UPDATE:

```sql
UPDATE membership
SET status = 'LAPSED', lapsed_at = NOW(), updated_at = NOW()
WHERE membership_year_id = :currentYearId
  AND status = 'PENDING_RENEWAL';
```

**Test cases:**
- Member with PENDING_RENEWAL after Jan 31 → status becomes LAPSED.
- Member who paid on Jan 31 at 23:58 ET → status remains ACTIVE (not lapsed).
- Cron runs twice (idempotent) → no error, no duplicate transitions.

### BR-3  Slot Release on Lapse

> **When a membership transitions from PENDING_RENEWAL to LAPSED, the slot is
> immediately freed for new enrollment.**

**Enforcement:** The capacity count query only includes statuses (ACTIVE,
PENDING_RENEWAL, NEW_PENDING). LAPSED is excluded by definition.

**Test cases:**
- Cap is 350, 350 are PENDING_RENEWAL, 1 lapses → count = 349 → new
  enrollment succeeds.

### BR-4  Pricing

> **Standard annual dues are $150.00 (15000 cents). Disabled veterans pay
> $100.00 (10000 cents). Members age 65 or older on Jan 1 of the membership
> year pay $100.00 (10000 cents).**

**Enforcement:** `calculatePrice(member, membershipYear)` utility function.
Age is computed as of Jan 1 of the membership year, not the payment date.

**Test cases:**
- Member born 1960-06-15, year 2026 → age 65 on Jan 1, 2026 → $100.
- Member born 1961-01-02, year 2026 → age 64 on Jan 1, 2026 → $150.
- Member born 1961-01-01, year 2026 → age 65 on Jan 1, 2026 → $100.
- Disabled veteran regardless of age → $100.
- Non-veteran under 65 → $150.

### BR-5  Discount Priority

> **If a member qualifies for both the disabled veteran discount and the senior
> discount, the veteran discount takes precedence for tracking purposes.**

**Enforcement:** `calculatePrice` checks `is_veteran_disabled` first. If true,
`discount_type = 'VETERAN'`. Else if age ≥ 65, `discount_type = 'SENIOR'`.

Both discounts result in the same price ($100), but the `discount_type` field
preserves which reason applied for reporting purposes.

**Test cases:**
- Disabled veteran age 70 → discount_type = VETERAN, price = 10000.
- Non-veteran age 70 → discount_type = SENIOR, price = 10000.
- Non-veteran age 40 → discount_type = NONE, price = 15000.

### BR-6  Family Inclusion

> **A membership includes the primary member and all dependents under age 18.
> No additional charge applies for dependents.**

**Enforcement:** Dependents are `member` rows with `role = 'DEPENDENT'` linked
to the same `household_id`. The membership and payment are tied to the
household, not individual members.

**Note:** Dependents who turn 18 during the year are not auto-removed in MVP.
A future enhancement may flag aging-out dependents for admin review.

**Test cases:**
- Household with 1 adult + 3 kids → 1 membership, 1 payment, price = standard
  or discounted based on adult's eligibility.
- Adding a 4th child does not change the price.

### BR-7  Sign-Up Day Override

> **An admin may change the sign-up event date and time at any point before or
> after the originally configured date. Every change is recorded in the audit
> log.**

**Enforcement:** `signup_event_config` UPDATE triggers an audit_log INSERT
with `action = 'signup_event.reschedule'` and metadata containing old and new
date/time values.

**Test cases:**
- Admin changes date from Feb 14 to Feb 21 → audit log contains both dates.
- Non-admin attempt to change date → 403 Forbidden.

### BR-8  First-Come / First-Served

> **New member registrations on sign-up day are ordered by `enrolled_at`
> timestamp. There is no reservation system and no waiting list.**

**Enforcement:** `enrolled_at` is set to `NOW()` at the time the enrollment
transaction commits. Capacity is checked inside the same transaction (see
BR-1).

**Test cases:**
- 349 members enrolled, 2 applicants submit simultaneously → only 1 succeeds
  (the one whose transaction commits first).
- After cap is reached, subsequent attempts receive a `CAPACITY_FULL` error.

### BR-9  Admin Audit Trail

> **Every state-changing action performed by an admin must be recorded in the
> `audit_log` with the admin's ID, the action name, the affected entity, and
> a timestamp.**

**Enforcement:** A shared `auditLog.record(...)` utility called in every admin
server action. The function is tested to ensure it writes correct data.

**Audited actions include:**
- `household.create`, `household.update`, `household.delete`
- `member.create`, `member.update`, `member.delete`
- `membership.activate`, `membership.lapse` (system)
- `payment.record` (admin cash/check)
- `signup_event.create`, `signup_event.reschedule`
- `membership_year.create`, `membership_year.update`
- `broadcast.send`

**Test cases:**
- Admin creates a household → audit_log row with action = `household.create`.
- System lapse cron → audit_log row with actor_type = `SYSTEM`.

### BR-10  Webhook Idempotency

> **Processing a Stripe webhook event that has already been handled must return
> HTTP 200 with no side effects.**

**Enforcement:** Before processing `checkout.session.completed`, check if a
`payment` row with the same `stripe_session_id` already exists. If so, return
200 immediately.

**Test cases:**
- Send the same webhook payload twice → second call returns 200, no duplicate
  payment row, membership status unchanged.
- Send webhook with invalid signature → 400 response, no processing.

---

## 7  Security & Privacy Baseline

### 7.1  Authentication

| Audience | Method | Provider |
|----------|--------|----------|
| Admin (club officer) | Email + password | Better Auth email/password provider |
| Member | Magic link (email) | Better Auth magic-link plugin |

- Admin accounts are created manually (seed script or admin-creates-admin flow).
  There is no public admin registration.
- Member magic links expire after 10 minutes (configurable).
- Sessions are stored in the database via Better Auth's Drizzle adapter.

### 7.2  Authorization

| Role | Access |
|------|--------|
| `ADMIN` | Full CRUD on all resources; send broadcasts; view audit log; record payments |
| `MEMBER` | Read own household and membership data; initiate own renewal payment |
| `UNAUTHENTICATED` | Login page only; no data access |

**Enforcement layers:**
1. **Middleware** (`src/middleware.ts`): Redirect unauthenticated users away from
   `/admin/*` and `/member/*`. Redirect non-admin authenticated users away from
   `/admin/*`.
2. **Server Actions**: Every server action re-validates the session and checks
   the user's role before executing. Middleware alone is not sufficient because
   server actions can be called directly.
3. **Database queries**: Member-facing queries always include
   `WHERE household_id = :currentUserHouseholdId` to prevent cross-household
   data access.

### 7.3  Stripe Webhook Verification

All incoming requests to `/api/webhooks/stripe` must:

1. Read the raw request body (not parsed JSON).
2. Verify the `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`.
3. Reject with 400 if verification fails.
4. Only then parse the event and process it.

### 7.4  Secrets Management

No secrets are committed to the repository. All sensitive values live in
environment variables:

| Variable | Purpose | Where Set |
|----------|---------|-----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Vercel env / `.env.local` |
| `BETTER_AUTH_SECRET` | Session signing secret | Vercel env / `.env.local` |
| `BETTER_AUTH_URL` | App base URL for auth callbacks | Vercel env / `.env.local` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Vercel env / `.env.local` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Vercel env / `.env.local` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side key | Vercel env / `.env.local` |
| `RESEND_API_KEY` | Resend email API key | Vercel env / `.env.local` |
| `INNGEST_SIGNING_KEY` | Inngest function signing key | Vercel env / `.env.local` |

**`.env.local`** is in `.gitignore`. A `.env.example` file documents all
required variables without values.

### 7.5  Input Validation

- All server actions and API routes validate input with **Zod schemas** before
  any database interaction.
- All database queries use **parameterized statements** via Drizzle (no string
  concatenation).
- HTML email body content is sanitized before storage and rendering.

### 7.6  Data Protection

- **Encryption at rest**: Neon encrypts all data at rest by default (AES-256).
- **Encryption in transit**: All connections use TLS (Vercel enforces HTTPS;
  Neon requires SSL).
- **PII inventory**: Names, emails, addresses, phone numbers, dates of birth,
  veteran disability status. All stored in PostgreSQL; no PII in logs or
  client-side analytics.
- **Data retention**: Audit logs and communications logs are retained
  indefinitely. Member data is retained as long as the household exists; soft
  delete may be added post-MVP for GDPR-like requests.

### 7.7  Principle of Least Privilege

- The Neon database role used by the application has only the permissions
  needed (SELECT, INSERT, UPDATE, DELETE on application tables). No
  SUPERUSER or DDL permissions at runtime.
- Stripe API keys use restricted keys scoped to Checkout Sessions and
  Webhooks where possible.
- Inngest functions run with the same database role as the application (no
  elevated privileges).

---

## 8  MVP Milestones

Six iterative milestones, each producing a deployable increment.

### Milestone 1 — Project Bootstrap (~1 week)

**Goal:** Establish the project skeleton with all tooling configured.

**Deliverables:**
- `create-next-app` with App Router, TypeScript, Tailwind CSS, ESLint.
- Drizzle ORM configured with Neon PostgreSQL connection.
- Better Auth configured with email/password provider (admin-only initially).
- shadcn/ui initialized with base components (button, input, card, table).
- Vitest configured for unit tests.
- Playwright configured for E2E tests.
- CI pipeline: lint → type-check → test on PR.
- `.env.example` with all required variables documented.
- `docs/APP_OVERVIEW.md` (this document) committed.

**Exit criteria:**
- `pnpm dev` starts without errors.
- `pnpm lint` passes with zero warnings.
- `pnpm test` runs (even if no tests yet) without config errors.
- Admin can log in with seeded credentials on local dev.

### Milestone 2 — Admin Roster & Membership Year (~1.5 weeks)

**Goal:** Admin can manage households, members, and membership years.

**Deliverables:**
- Drizzle schema for `household`, `member`, `membership_year`,
  `signup_event_config`, `audit_log`.
- Admin UI pages:
  - Household list with search/filter and data table.
  - Household detail: view/edit household info, add/remove members.
  - Create/edit membership year with capacity cap and dates.
  - Configure sign-up day event (date, time, location).
- Server actions for all CRUD operations with Zod validation.
- Audit log writes for every admin action.
- Unit tests for data validation and business logic.

**Exit criteria:**
- Admin can create a household with a primary member and dependents.
- Admin can create a membership year with custom capacity cap.
- Admin can configure and reschedule sign-up day.
- All admin actions appear in the audit log.
- Vitest coverage ≥ 60% on `src/lib/`.

### Milestone 3 — Renewal Flow + Stripe Payments (~1.5 weeks)

**Goal:** Members can pay renewals online; admins can record in-person payments.

**Deliverables:**
- Drizzle schema for `membership` and `payment`.
- Renewal seeding logic: when a new membership year is created, seed
  PENDING_RENEWAL memberships for all ACTIVE households from the prior year.
- Stripe Checkout integration:
  - Create Checkout Session with correct line item (standard or discounted).
  - Success and cancel redirect URLs.
- Stripe webhook handler (`/api/webhooks/stripe`):
  - Signature verification.
  - `checkout.session.completed` → create payment + activate membership.
  - Idempotency check.
- Admin "Record Payment" flow for cash/check.
- Price calculation utility with discount logic.
- Inngest `lapse-check` cron function (Feb 1).

**Exit criteria:**
- Member can complete Stripe Checkout and see ACTIVE status.
- Duplicate webhook does not create duplicate payment.
- Admin can record a cash payment and activate membership.
- Price is $100 for veteran, $100 for senior (age ≥ 65 on Jan 1), $150 otherwise.
- After simulated Feb 1 cron run, PENDING_RENEWAL → LAPSED.

### Milestone 4 — Sign-Up Day & Capacity Enforcement (~1 week)

**Goal:** New members can be enrolled on sign-up day with real-time capacity
enforcement.

**Deliverables:**
- New-member enrollment flow in admin UI:
  - Create household + primary member + dependents.
  - Capacity check before commit.
  - Record payment and activate membership.
- Real-time capacity display on admin dashboard (X / 350 slots filled).
- Capacity enforcement with `FOR UPDATE` locking.
- Sign-up day event details display.

**Exit criteria:**
- Enrollment at capacity − 1 succeeds; enrollment at capacity fails.
- Concurrent enrollment test: 2 simultaneous requests at cap − 1 → exactly 1
  succeeds.
- Admin sees accurate live count.

### Milestone 5 — Email Broadcast & Communications Log (~1 week)

**Goal:** Admin can send mass emails and review history.

**Deliverables:**
- Resend integration with React Email templates.
- Broadcast compose page: subject, body (rich text), recipient filter.
- Preview recipient count before sending.
- Inngest `email-batch` function for reliable delivery.
- Communications log page with filters and search.
- Renewal reminder email template.

**Exit criteria:**
- Admin sends a broadcast to "Active" members → emails delivered via Resend.
- Communications log shows subject, date, recipient count, admin who sent.
- Resend batch ID stored for delivery tracking.

### Milestone 6 — Member Portal & Polish (~1.5 weeks)

**Goal:** Members can self-serve; app is ready for production UAT.

**Deliverables:**
- Better Auth magic-link plugin configured for member login.
- Member portal pages:
  - Dashboard: household info, membership status, payment history.
  - Renew: initiate Stripe Checkout for current year renewal.
- Responsive design audit (admin + member).
- Error and empty state handling across all pages.
- Playwright E2E tests for critical paths:
  - Admin: create household → create year → record payment.
  - Member: login → view status → pay renewal.
  - Capacity: fill to cap → verify rejection.
- Performance audit (Core Web Vitals).
- Production deployment checklist and Vercel configuration.

**Exit criteria:**
- Member receives magic link, logs in, sees their status, pays renewal.
- All E2E tests pass.
- Lighthouse performance score ≥ 80 on key pages.
- App deployed to Vercel preview; club officers complete UAT walkthrough.

---

## 9  Validation Plan

### Developer Commands

| Command | Purpose | Expected Result |
|---------|---------|-----------------|
| `pnpm install` | Install dependencies | Clean install, no warnings |
| `pnpm dev` | Start local dev server | App running at `localhost:3000` |
| `pnpm lint` | ESLint + Prettier check | Zero errors, zero warnings |
| `pnpm typecheck` | `tsc --noEmit` | Zero type errors |
| `pnpm test` | Vitest unit + integration | All tests pass, coverage ≥ 80% on business rules |
| `pnpm test:e2e` | Playwright end-to-end | All scenarios pass |
| `pnpm db:push` | Drizzle schema push to Neon | Schema applied without errors |
| `pnpm db:studio` | Drizzle Studio (DB browser) | Opens at `localhost:4983` |
| `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | Local webhook testing | Webhooks forwarded and processed |

### Test Layers

| Layer | Tool | Scope |
|-------|------|-------|
| **Unit** | Vitest | Business logic: `calculatePrice`, `checkCapacity`, discount eligibility, date computations |
| **Integration** | Vitest + test DB | Server actions with real database: CRUD, status transitions, audit log writes |
| **E2E** | Playwright | Full browser flows: login, roster management, payment, renewal, broadcast |
| **Webhook** | Stripe CLI + Vitest | Webhook signature verification, idempotency, status transitions |
| **Load** | k6 or Artillery (post-MVP) | Concurrent enrollment on sign-up day; renewal rush simulation |

### Definition of Done

The MVP is complete when:

1. All six milestones have been delivered and their exit criteria met.
2. `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` all pass in CI.
3. Business rules BR-1 through BR-10 each have at least one passing test.
4. The app is deployed to Vercel and accessible via a custom domain or preview
   URL.
5. Club officers have completed a UAT walkthrough covering:
   - Create a membership year.
   - Enroll a new household with dependents.
   - Process a Stripe payment.
   - Record a cash payment.
   - Run a broadcast email.
   - Log in as a member and view status.
6. No critical or high-severity bugs remain open.
7. `.env.example` is complete and accurate.
8. This document (`APP_OVERVIEW.md`) reflects the final state of the shipped
   product.

---

*Last updated: 2025 · MCFGC Club Manager MVP*
