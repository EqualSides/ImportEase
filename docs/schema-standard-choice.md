# StandardChoiceModel.xml — schema reference

Derived from three real customer export samples. Field presence/frequency
noted where it varied across samples — treat anything marked "optional" as
something your parser/grid must tolerate being absent, and your serializer
must not invent when it wasn't there originally.

## File-level structure

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<list version="9.0.0" minorVersion="26" exportUser="DSAMPSON"
      exportDateTime="06/27/2026 06:28 PM" description="null">
  <standardChoice refId="1@StandardChoiceModel">
    ...
  </standardChoice>
  <standardChoice refId="2@StandardChoiceModel">
    ...
  </standardChoice>
</list>
```

- Root is always `<list>` with attributes `version`, `minorVersion`,
  `exportUser`, `exportDateTime`, `description`.
  - `exportUser` / `exportDateTime` reflect who ran the export and when —
    **do not just copy these through on re-export**; they should reflect
    the tool/user producing the new package (or a sensible default. Flag
    this for review).
  - `description` can literally be the string `"null"` in real exports —
    don't treat that as a sentinel meaning "empty," it's Accela's own
    output when no description was set.
- `refId` values (e.g. `"1@StandardChoiceModel"`) are **local to the file**
  — numbering restarts at 1 in every export, it is not a stable global ID
  across exports or across environments. Don't treat matching refIds across
  two different zips as meaning "the same record."

## `<standardChoice>` record fields

| Field | Required? | Notes |
|---|---|---|
| `refId` (attribute) | always present | local sequence id, see above |
| `name` | always | the choice list's identifying name, e.g. `LICENSED PROFESSIONAL TYPE` |
| `serviceProviderCode` | always | agency code, e.g. `CLARKCO` |
| `auditModel` | always | nested: `auditDate`, `auditID`, `auditStatus` (see below) |
| `type` | optional, rare (seen once in sample) | |
| `defaultValue` | optional | often present but empty (`<defaultValue></defaultValue>`) |
| `description` | optional | often present but empty |
| `pageStatusModels` | optional | nested `pageStatus` list — seen with `importSubItemDisableFlag`, `modelProperty`, `propertyName`, `selectFlag`, `skipFlag` |
| `standardChoiceValueModels` | always | wraps the child `standardChoiceValue` list, see below |

## `<standardChoiceValue>` (nested child record)

| Field | Required? | Notes |
|---|---|---|
| `refId` (attribute) | always | local sequence id, e.g. `"2@StandardChoiceValueModel"` — separate numbering space from the parent's refId sequence |
| `sequenceNBR` | always | numeric id, distinct from refId |
| `serviceProviderCode` | always | |
| `auditModel` | always | see below |
| `description` | usually | can be empty string |
| `parentSequenceNBR` | optional | present when the value has a parent choice value (hierarchical choice lists) |
| `resId` | optional | seen in ~1 in 25 sample records — appears tied to `xDocEntityTypeModel` presence |
| `sortOrder` | optional | integer |
| `standardChoiceName` | always | back-reference to the parent's `name` — **must stay in sync if the parent name is edited** |
| `standardChoiceValueI18NModels` | always | almost always empty — serializes as self-closing `<standardChoiceValueI18NModels/>` |
| `value` | always | the actual choice value shown in Accela's UI |
| `valueSize` | optional | integer, seen intermittently |
| `xDocEntityTypeModel` | optional, rare | only seen on professional-license-type choice lists; nested: `resID`, `serviceProviderCode`, `auditModel`, `docGroup`, `entType`, `entValue`, `licType` |

## `auditModel` (reused nested structure — appears at multiple levels)

```xml
<auditModel>
  <auditDate>2018-08-24T09:53:27.950-05:00</auditDate>
  <auditID>KMORSE</auditID>
  <auditStatus>A</auditStatus>
</auditModel>
```

Always three fields: `auditDate` (ISO 8601 with offset), `auditID`
(username), `auditStatus` (single letter, `A` seen = Active).

## Empty-collection serialization

Empty nested collections must round-trip as **self-closing tags**, not
`<tag></tag>`:

```xml
<standardChoiceValueI18NModels/>
```

This is a common source of round-trip failures if your XML builder doesn't
distinguish "empty array" from "empty string field" — get this right before
trusting the serializer with real data.

## Cross-file relationships (for later milestones, not Milestone 1)

`standardChoiceName` on each value record duplicates the parent's `name` by
string, not by ID reference — so within this one file there's no ID-based
foreign key to preserve, just a string that must stay consistent if a parent
choice list is renamed. Other model files (not covered here) do use
`refId="N@ModelType"`-style attributes that point across files; that
cross-file linking is out of scope until a milestone that touches more than
one file at a time.
