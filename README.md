# ImportEase — Accela Config Import/Export Tool

Milestone 1 (Standard Choices, end-to-end) is implemented: upload a
Configuration Manager export `.zip`, edit `StandardChoice` records and their
nested values in a grid, export a `.zip` back out. See `CLAUDE.md` for the
full project brief and `docs/schema-standard-choice.md` for the field-level
schema notes this was built against.

## Local dev

```
npm install
npm run dev
```

`npm run build` runs the round-trip fidelity test suite (`vitest run`)
before `next build` — a broken round-trip fails the build, including on
Vercel, since this environment has no local Node.js to verify with directly.

## How it works

Everything — zip upload, unzip, XML parse, grid edit, XML re-serialize,
re-zip — happens **entirely client-side**, in a Web Worker. There is no
server involved in the file-processing path at all:

- Vercel serverless functions have a hard 4.5MB request body limit that
  cannot be raised, and real full-agency exports run well past that (a
  47.8MB `ASIGroupModel.xml` has been seen in a real sample). Any upload
  flow that sends the file to a Next.js API route breaks on real customer
  data even though it works fine on small test fixtures. The original
  Milestone 1 build did route through `app/api/parse`/`app/api/export`;
  those are gone now, replaced by the worker.
- `lib/worker/importWorker.ts` runs the parse/zip/serialize work off the
  main thread — the whole reason for a worker rather than doing this
  directly in `app/page.tsx` is that this work can take real time on a
  40MB+ file, and a fixed 4.5MB-safe UI would otherwise freeze for that
  duration. `lib/worker/client.ts` wraps it in a small promise-based API
  (`parseZipInWorker`, `exportZipInWorker`) so the rest of the app doesn't
  deal with `postMessage` directly.
- Everything from that point lives in browser memory only (`app/page.tsx`
  state) — no database, no server-side session, per the brief's
  no-persistence requirement, and now genuinely reinforced by architecture
  rather than just policy: the file never leaves the browser, so there's
  nothing to accidentally persist server-side in the first place.
- `lib/zip/zip.ts` sniffs each `.xml` entry's *content* (not filename —
  real exports aren't necessarily named `StandardChoiceModel.xml`) for a
  `StandardChoice` shape. Recognized files are parsed into JSON;
  everything else (including `WorkflowModel.xml` — its mxGraph/drawio-style
  embedded diagram is confirmed out of scope for grid-editing) is passed
  through untouched as raw bytes, not base64 — base64 would add ~33%
  overhead on large files with nothing to gain now that there's no
  JSON-over-HTTP boundary requiring a text-safe encoding.
- `lib/sensitiveFiles.ts` + the confirmation panel in `app/page.tsx` —
  before export, any detected `UserModel.xml`/`UserProfilesModel.xml`/
  `AgencyGroupModel.xml` (the list is meant to grow) blocks export until
  the user explicitly chooses Keep or Remove for each one. Recomputed
  fresh from the current entries at export time, not a one-time flag from
  upload, so it also covers the blank-file flow.
- `components/StandardChoiceGrid.tsx` — two linked AG Grid Community grids
  (parent `standardChoice` rows, child `standardChoiceValue` rows for the
  selected parent). AG Grid's Range Selection/Clipboard and Master-Detail
  modules are Enterprise-only, so bulk Excel-style paste and the
  parent/child linkage are hand-rolled here instead.
- `lib/xml/standardChoice.ts` — the parse/serialize core. Parses in
  fast-xml-parser's order-preserving mode so every record's original field
  order and any undocumented fields (e.g. `valueSize` on a `standardChoice`,
  present in real exports but not in the schema doc) survive untouched.
  Text content is kept as raw source bytes (entities un-decoded) for fields
  the user never edits, so there's no decode/re-encode risk on pass-through
  data. A static tag classification (`COLLECTION_TAGS`) decides self-closing
  (`<tag/>`) vs. open/close (`<tag></tag>`) for empty elements, since both
  forms parse to an identical shape and can't be told apart after the fact.

## Round-trip fidelity

`tests/roundtrip.test.ts` runs against the three real sample files in
`fixtures/standard-choice-samples/`. It's a **structural** diff, not a raw
byte diff, because two things are intentionally not byte-identical on
export: `exportUser`/`exportDateTime` are rewritten to reflect the tool
producing the package (per the schema doc), and Accela's own exporter is
inconsistent about insignificant inter-element whitespace, which has no
bearing on how an XML parser reads the file back.

## Known gaps / next steps

- New rows get placeholder `auditModel`/`sequenceNBR` values — flagged for
  review rather than guessed at, since the brief has no guidance here.
- Only `StandardChoiceModel`-shaped XML is recognized; everything else
  (ASI Groups, workflows, fee schedules, …) is explicitly out of scope for
  Milestone 1 and passes through untouched.
- No auth, no database — by design, see `CLAUDE.md`.
