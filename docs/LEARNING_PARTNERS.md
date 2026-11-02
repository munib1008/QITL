# Learning Partners

A registration, directory and inquiry platform for Quran, Arabic and Islamic-education providers (institutions, centres,
independent teachers). Branch `feat/learning-partners`, migrations `20261031002800` and `20261031002801` (storage).
**Nothing here has been applied to the live Supabase project, deployed, or checked signed-in.** See "Status" for what is and
is not verified.

## Principles (these are tested, not just written)

- **QITL is not a payment platform.** No checkout, no payment provider, no escrow, no commission, no invoicing, no payout. A
  price is a statement the provider makes. Every page of the module shows: *"QITL helps learners discover educational
  providers. Course arrangements, fees and payments are handled directly with the provider. QITL does not process course
  payments."* (EN exact; AR and UR drafts). `tests/unit/partners.test.ts` fails if the module's code or schema names a payment
  processor, checkout, escrow, commission or invoice.
- **Verification is a separate statement** (`notices.verification`): it says what a verification is (one named thing checked
  against evidence, on a date) and what it does not guarantee (teaching quality, conduct, prices, suitability). Three kinds,
  decided separately: **identity**, **qualifications**, **religious/scholarly**. None implies another; the public page shows
  only kinds that are `verified`, with the scope staff recorded.
- **Provider claims are the provider's** unless verified: descriptions, experience, qualifications and prices carry
  "stated by the provider"; an unverified qualification reads "Stated by the provider, not verified".
- **Religious instruction is not a fatwa** (`notices.instruction`), shown on the directory and every provider page.
- **No fabricated ratings, reviews or statistics.** The schema has no rating/review/count column; the directory shows a course
  count computed from published rows and nothing else. A test greps the schema and the page text.
- **Children**: no public identification of learners; an inquiry has an optional alias (not a surname), a "writing for a child"
  flag and the safeguarding notice; the learner's message is visible only to the learner, the provider's inquiry-authorised
  members and staff.

## Data model (`supabase/migrations/20261031002800_learning_partners.sql`)

| Table | Purpose | Public (anon) reads |
|---|---|---|
| `partner_service_categories` | Admin-managed taxonomy, EN/AR/UR names, `active`, `merged_into`; seeded with 24 Quran / Arabic / Islamic subjects (see "Seed taxonomy") | all rows (names only) |
| `learning_partners` | The listing: type, slug, name, country (ISO), city, area, languages, descriptions, years, `listing_status`. No owner column (ownership is the `owner` row of `partner_members`) | only `listing_status = 'approved'` |
| `partner_members` | owner / admin / instructor / inquiry_manager | none |
| `partner_contact_methods` | per method `is_public`, **private by default** | only `is_public` rows of approved listings |
| `partner_services` | course: category, level, audience, mode, group/individual, duration, language, status | only `published` of approved listings |
| `partner_service_pricing` | free / per_class / hourly / monthly / course / package / donation / on_request, currency, amount, unit, classes, optional fees | those of public services |
| `partner_service_availability` | weekday, from/until, time zone | those of public services |
| `partner_qualifications` | claim + `status` unverified/verified/rejected + `show_publicly` | only `show_publicly` rows of approved listings |
| `partner_qualification_files` | evidence path in the PRIVATE bucket `partner-docs` (+ mime, size) | none, ever |
| `partner_verifications` | the three kinds, status, `scope_statement` | only `verified` rows of approved listings |
| `partner_review_notes` | staff messages to the provider about a decision | none |
| `partner_inquiries`, `partner_inquiry_messages` | learner inquiry (consent required, version stored) and thread | none |
| `partner_reports` | learner reports of a provider | none |
| `partner_audit_logs` | staff decisions and staff access to private data | none (admin reads) |
| view `partner_directory` | approved listings + what filters need (category ids, modes, levels, free/paid); no contact, owner, address | yes (`security_invoker`) |

Private columns are kept out of public tables on purpose (notes, evidence, verdict text live in their own tables), so a
column grant never has to tell one reader from another.

### Roles

| | owner | admin | instructor | inquiry_manager | learner | moderator | administrator |
|---|---|---|---|---|---|---|---|
| edit profile, contacts, qualifications, documents | yes | yes | no | no | | | |
| edit courses, prices, times | yes | yes | yes | no | | | |
| read private contacts | yes | yes | no | yes | | read (audited) | read (audited) |
| read / answer inquiries | yes | yes | no | yes | own only | read | read |
| manage team | yes | no | no | no | | | |
| submit / take offline | yes | yes | | | | | |
| start review, request info/changes, suspend | | | | | | yes | yes |
| approve / reject / reinstate | | | | | | **no** | **yes** |
| identity / qualification verification | | | | | | yes | yes |
| religious/scholarly verification, taxonomy | | | | | | no | yes |

`listing_status` has **no column grant**: it moves only through `partner_transition(partner, to, note)`, which authorises the
caller, enforces the path, requires a reason for request/reject/suspend, requires a complete profile to submit (description, a
contact method, a course), refuses staff who are members of the listing, audits, notifies the owner (in-app, path only).
Editing the name, type, location, descriptions or years of an **approved** listing sends it back to `submitted` (it leaves the
directory until an administrator approves again); slugs freeze once a listing has been approved.

Status path: `draft → submitted → under_verification → approved | rejected`; staff may answer `information_requested` /
`changes_requested` (the provider resubmits); `approved → suspended` (moderator or administrator); `suspended → approved`
(administrator); `approved → draft` (provider takes it offline).

### Inquiries and spam

Consent is a column (`consent boolean check (consent)`) plus `consent_version`. The guard trigger refuses: an inquiry to an
unapproved listing, to your own listing, to a service the provider does not offer, more than two links, a repeated message
within a day, more than 2 per minute / 6 per hour (the existing `throttle()` / `rate_limit_events` pattern), and more than 3 open
inquiries with one provider. Messages are throttled 10/min and 60/h and refused on closed or spam inquiries.

## Routes

Public: `/partners` (search + filters + list), `/partners/[slug]`, `/partners/register`, `/partners/dashboard[/tab]`
(overview, profile, services, pricing, availability, inquiries, documents, settings), `/partners/inquiries` (learner),
`/admin/partners` (review queue, subjects, reports, audit log). API: `/api/partners/**`, `/api/admin/partners/**` (zod
validation in `src/lib/partners/validation.ts`, then RLS and triggers again). Without Supabase every page shows the designed
"not connected" state.

## Status (honest)

| Area | State |
|---|---|
| Migration, RLS, guards, functions | Built. `tests/db/partners.test.ts`: 34 tests pass on PGlite. Not applied to the live project. |
| Storage bucket `partner-docs` (private) and its policies | Written (`…002801`, `@supabase-only`); **not run anywhere, not testable in PGlite**. Needs a manual check on a Supabase project (see checklist). |
| `lib/partners` (types, validation, pricing, taxonomy, directory filter) | Built; `tests/unit/partners.test.ts` (31 tests). |
| API routes | Built, type-checked; **not exercised against a live database** (no route-level tests). |
| Directory, provider page, wizard, dashboard, learner inbox, admin console | Built, type-checked, linted. Only the **not-connected** states are browser-tested. Signed-in flows, document upload/download (Storage), signed URLs and every form were **not run in a browser**. |
| EN / AR / UR | Complete key parity (tests). AR and UR are first drafts awaiting a qualified translator; no real-device RTL check. |
| Playwright | Not-connected states, axe (desktop and mobile projects), RTL for `/ar` and `/ur`, plus the responsive and i18n sweeps for the five new routes. Run on a build with the three Supabase variables blanked: `tests/e2e/partners.spec.ts` 24 passed (desktop and mobile); responsive + i18n sweeps for the new routes 25 passed on the desktop project (the mobile project skips those sweeps by design). The rest of the e2e suite was not re-run. |
| Seed taxonomy | 24 subjects I chose (the brief was not available to this session): replace or edit them in `/admin/partners` → Subjects; no code change needed. |

### Not built

- Email or push delivery (in-app notifications only; links carry no locale prefix, as in the mufti module).
- Invitation of team members by email (the owner adds an existing account by its id).
- Map view, geographic search, saved providers, comparison.
- Admin tools to edit a provider's content or to remove a member (staff can only request changes or suspend).
- Staff-internal notes (every note on a decision is visible to the provider by design).
- Server-side pagination of the directory: it loads up to 500 approved listings from the view and filters in memory
  (`MAX_DIRECTORY_ROWS`); move the filters into SQL before the directory grows past that.
- API route tests; signed-in Playwright; document virus scanning (the existing optional `MALWARE_SCAN_URL` is not wired in).
- Approval does not require any verification (an administrator may approve an unverified provider; the page then simply shows
  no verification). Say so if you want identity verification to be a precondition.

### Known database caveats

- A listing is created without `RETURNING` (the owner row is written by an AFTER trigger); `POST /api/partners` re-selects by slug.
- A provider's authorised members can see the learner's account id on an inquiry (needed for the thread); the learner's public
  profile name, if any, is therefore reachable by id. Learners are told to use an alias; nothing else about them is exposed.
- `tests/db/security.test.ts` has one failing assertion on this base (`fa1cca7`) from the AI-draft migration (`…002700`:
  `public_ai_drafts`, `public_ai_draft` are anon-callable definer functions returning non-boolean). It is not caused by this
  module (the module's own anon-callable functions are boolean visibility helpers only) and was left alone.

## Deployment checklist (owner / main session; not done)

1. Apply `20261031002800_learning_partners.sql`, then `20261031002801_partners_storage.sql` (creates the private `partner-docs`
   bucket and four `storage.objects` policies).
2. Check in the dashboard: bucket `partner-docs` is **not public**; as anon, listing it returns nothing; as a signed-in non-member,
   `createSignedUrl` on another provider's path fails.
3. Grant the first `admin`/`moderator` (owner action); decide whether the seed subjects stand.
4. Counsel review of the consent text (`inquiry.consent`), the verification statement and the safeguarding wording.
5. Qualified translator review of the Arabic and Urdu drafts.
6. Run `npx vitest run tests/db --no-file-parallelism` and the Playwright suite built with the three Supabase variables blanked.
