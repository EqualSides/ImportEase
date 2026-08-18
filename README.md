# theperpetualhive — Accela Config Import/Export Tool

Starter scaffold, not a working app yet. Built without network access, so
nothing here has been installed or run — treat it as a brief + reference
data for Claude Code to build from, not working code.

## How to use this with Claude Code

1. Open this folder in Claude Code.
2. Point it at `CLAUDE.md` first — that's the project brief with scope,
   explicit non-goals, stack choices, and the Milestone 1 definition of
   done.
3. `docs/schema-standard-choice.md` has the field-by-field schema notes for
   the first target file type, derived from real export samples — use it
   instead of guessing at Accela's structure.
4. `fixtures/standard-choice-samples/` has three real `StandardChoiceModel.xml`
   files from actual customer exports. Use these for the round-trip fidelity
   test described in `CLAUDE.md` (export unmodified data, diff against the
   original — this is the pass/fail bar before editing real data with it).
5. `package.json` lists the intended dependencies (all free-tier tools) but
   versions are unpinned since this was built offline — let `npm install`
   resolve and pin real versions as the first step.

## What's deliberately not here

No auth, no database schema, no deployed hosting config — those come after
Milestone 1 (Standard Choices end-to-end) is working and round-trip-verified
on the fixtures above.
