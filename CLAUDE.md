# ImportEase — Project Brief

**Project name:** ImportEase
**Site:** theperpetualhive.com (domain owned via Porkbun, not yet built out)
**Builder:** Solo, using Claude Code
**Budget:** Free tier only for now — every architectural choice below is picked with that constraint in mind.

**Infra already provisioned:**
- GitHub: `https://github.com/EqualSides/ImportEase.git` (empty, awaiting first push)
- Vercel: project `importease`, linked to the GitHub repo above, deploys from `main` on push (team: EqualSides)
- Supabase: project `importease`, region `us-east-2`, free tier, ref `kuriwvudktwrkexhrkwr`

## The problem

Accela Civic Platform's Configuration Manager exports agency configuration data
(record types, standard choices, ASI groups, shared drop-down lists, workflows,
fee schedules, etc.) as XML files packaged in a `.zip`. New and existing
customers hand over large Excel/data files of things they want loaded into
Accela. Today the only way to get that data in is manual entry through the
Accela UI — slow and expensive at scale (some categories run into the tens of
thousands of records).

## What this tool does

1. User logs in (subscription-gated).
2. User uploads a Configuration Manager export `.zip`.
3. Tool parses the XML file(s) inside it into an editable, spreadsheet-like
   grid — view, edit, add, delete rows/fields, and paste in bulk from Excel.
4. User exports: tool re-serializes the (possibly edited) data back into XML
   that exactly matches Accela's expected structure, and re-packages it into a
   `.zip` Accela's Configuration Manager import will accept.

## Explicit non-goals (do not build these)

- **No job history/tracking.** Accela's own Configuration Manager has named
  jobs, scheduling, and status tracking (On Hold / Complete, etc.). This tool
  does **not** replicate that. It's upload → edit → export, nothing more.
- **No persistence of session data.** The uploaded zip, parsed XML, grid
  edits, and exported zip live only in memory for the duration of the
  session. Nothing is written to a database or file storage. When the user
  logs out (or the session ends), it's gone. These are one-and-done sessions
  — if a user needs to revisit their work, they re-upload the file.
  - The **only** persisted state in the whole system is Agency/user account
    records and admin-controlled access status (see Auth model below).
- **No login for Milestone 1 (or for most of the build).** Login only gets
  added near the end, once the rest of the project/site is close to
  complete. Build and test the core parse/edit/export pipeline without an
  auth wall in front of it.
- **No self-service billing/subscriptions.** Customers are government
  agencies paying via PO, direct deposit/ACH — not credit cards. There is
  **no Stripe integration**. Access is granted manually by an admin, not
  purchased through the app.
- **No rejecting unsupported files.** If an uploaded zip contains XML files
  the tool doesn't know how to parse yet, ignore/pass them through
  untouched rather than rejecting the whole zip. This mirrors how Accela
  itself behaves — it ignores XML files whose name doesn't match what it
  expects.
- **No attempt to support every config category on day one.** See Milestone 1.

## Auth model (build near the end, not now)

Not subscription-based. Instead:

- Admin can add / edit / remove / disable **Agencies** (groups).
- Admin can add / edit / remove / disable **Users**, each belonging to an
  Agency.
- No self-service signup, no billing status to track — just admin-managed
  provisioning and an enabled/disabled flag.

## Milestone 1 scope: Standard Choices, end-to-end

Prove the whole pipeline on one manageable, real category before expanding.
`StandardChoiceModel.xml` is the target — see `docs/schema-standard-choice.md`
for the field-level reference, derived from real customer export samples.

Definition of done for Milestone 1:

1. Upload a `.zip` → detect and parse `StandardChoiceModel.xml` specifically
   (don't need to handle other files in the zip yet, but don't crash on them
   either — just pass them through untouched).
2. Render `standardChoice` records as rows in an editable grid, with each
   record's nested `standardChoiceValue` list as either an expandable
   sub-grid or a linked second grid (parent/child).
3. Support: edit a cell, add a row, delete a row, and paste a block of data
   from Excel/clipboard into the grid.
4. On export: re-serialize the grid state back to XML that matches Accela's
   structure exactly — including self-closing empty tags (e.g.
   `<standardChoiceValueI18NModels/>`), and re-zip with the original
   filename convention.
5. **Round-trip fidelity test**: export completely unmodified data and diff
   the output byte-for-byte (or structurally) against the original file. This
   is the real correctness bar — if this doesn't come back clean, don't move
   on to letting people edit real customer data with it. Accela's importer
   is very likely to reject anything structurally off.

Everything else (ASI Groups, workflows, fee schedules, the huge nested
categories) comes after Milestone 1 is solid and round-trip-verified.

## Stack (all free-tier)

- **Framework:** Next.js (React) — single framework for frontend + API
  routes, one deploy target.
- **Hosting:** Vercel free tier. Point theperpetualhive.com's DNS at Vercel;
  Porkbun stays as registrar only.
- **Grid:** AG Grid Community edition (free, open-source) — virtualized
  rendering (needed; some real categories run to tens of thousands of rows),
  built-in copy/paste from Excel.
- **XML parse/build:** `fast-xml-parser` (npm). Needs careful config to
  preserve attribute order and empty-element self-closing behavior on
  rebuild — this is the highest-risk technical piece, budget real time for
  the round-trip test in Milestone 1.
- **Auth + access control:** Supabase free tier (auth + a small Postgres DB
  for Agency/user/enabled-status records only — never for session config
  data). No billing integration needed. Confirm current free-tier limits
  when you get to this step, they change over time.
- **File handling:** process the uploaded zip entirely in-memory in a Next.js
  API route/server action. No object storage needed given the no-persistence
  requirement.

## Open decisions

Resolved: no login until near the end of the build, unsupported files are
passed through untouched, no Stripe/subscriptions (PO/ACH-based, admin-
provisioned access instead). Nothing outstanding is blocking Milestone 1.

## Reference data

Real sample exports (`ASIGroupModel`, `StandardChoiceModel`,
`SharedDropDownListModel`, `DataManagerVersionModel`, and others) and
Configuration Manager UI screenshots were used to derive the schema notes in
this repo. See `docs/schema-standard-choice.md`.
