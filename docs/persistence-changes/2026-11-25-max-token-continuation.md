---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-25-max-token-continuation

English | [中文](2026-11-25-max-token-continuation.zh.md)

## Summary

Retains the product's max-token-continuation producer attribution using the existing notice form and text content after synchronizing the official code.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-25-max-token-continuation
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-11-19-cua-input-notices"
    after: "6b7788da60240e8493d8f04df1ecce184cba85acbfed0eeb511ffd9cdefadb80"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-11-19-cua-input-notices"
    after: "eeaaff235e780833131e89afa5760148b386a1b693964fe0863d8b35049ba64c"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-11-19-cua-input-notices"
    after: "a99ea0b95bbebb849da2f940333e8cd97c19a17d34b19b791c45dc62f98ad398"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-11-19-cua-input-notices"
    after: "5cd56d77bf16cac71cdf5cb2f3de2e285c4181b3e40822bc38d0aad8b1b57c1f"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

This remains Session format V4. The added source kind carries the existing notice form, summary and text content. V4 source admission accepts nonempty producer-owned kinds and preserves unknown metadata; no existing kind or event field changes. Queued inbox and title-request messages carry the same source object. Restoring messages does not run the continuation listener: that listener requires a current-turn assistant max-tokens finish and has an explicit per-turn bound. Existing readers can retain and display the notice without loading this plugin.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/session/session-format-v3-to-v4/tests/attribution.spec.ts packages/session/session-format-v3-to-v4/tests/message-sources.spec.ts packages/guard/max-token-continuation/tests: 23 tests passed. Coverage includes unknown producer preservation, strict V4 source admission, continuation attribution and summary, current-turn finish selection, bounded retries and disabled continuation.

<a id="dev-note"></a>
## Dev Note

None.
