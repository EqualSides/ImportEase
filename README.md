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

- `app/api/parse` — accepts an uploaded `.zip`, unzips in memory, and for
  each `.xml` entry sniffs the *content* (not the filename — real exports
  aren't necessarily named `StandardChoiceModel.xml`) for a `StandardChoice`
  shape. Recognized files are parsed into JSON; everything else is passed
  through untouched as base64.
- Everything from that point lives in browser memory only (`app/page.tsx`
  state) — no database, no server-side session, per the brief's
  no-persistence requirement. The browser tab *is* the session.
- `components/StandardChoiceGrid.tsx` — two linked AG Grid Community grids
  (parent `standardChoice` rows, child `standardChoiceValue` rows for the
  selected parent). AG Grid's Range Selection/Clipboard and Master-Detail
  modules are Enterprise-only, so bulk Excel-style paste and the
  parent/child linkage are hand-rolled here instead.
- `app/api/export` — takes the (possibly edited) JSON back, re-serializes
  each `StandardChoice` entry to XML and re-zips everything with the
  original entry paths.
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
