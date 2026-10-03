# @deepseek-ai/dsh-max-token-continuation

## Summary

Continues a model response that the provider cut off at its per-request output-token
ceiling, so a long answer arrives whole instead of stopping mid-sentence. The turn's
outcome stays `max-tokens` — this package supplies the missing tail and nothing else.

## Table of Contents

- [Use this package](#use-this-package)
  - [When to choose it](#when-to-choose-it)
  - [Setting the continuation budget](#setting-the-continuation-budget)
  - [What you get](#what-you-get)
- [Understand the implementation](#understand-the-implementation)
  - [Design philosophy](#design-philosophy)
  - [Detection: the durable stream finish](#detection-the-durable-stream-finish)
  - [Continuation delivery](#continuation-delivery)
  - [Source map](#source-map)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
  - [Continuation context message](#continuation-context-message)
    - [What the model sees](#what-the-model-sees)
      - [Default continuation message](#default-continuation-message)
    - [Token effect](#token-effect)
    - [KV Cache effect](#kv-cache-effect)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
  - [No runtime invariant is published](#no-runtime-invariant-is-published)
  - [A single oversized unit defeats the budget](#a-single-oversized-unit-defeats-the-budget)
  - [The turn-max-tokens notice is unconditional](#the-turn-max-tokens-notice-is-unconditional)

## Use this package

### When to choose it

Choose it when a task produces an answer long enough to hit the provider's
output-token ceiling, and stopping mid-answer costs more than the extra requests.
It composes with context-window compaction rather than replacing it: compaction lowers
the *input* budget, this package supplies the *output* tail.

### Setting the continuation budget

```yaml
- id: max-token-continuation
  name: '@deepseek-ai/dsh-max-token-continuation'
  config:
    maxContinuations: 8
    prompt: Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.
```

`maxContinuations` bounds the continuations **within one turn**; `0` disables
continuation and installs no turn listener. The shipped base bundle sets `8`. The bound
is per turn, so a later turn in the same session receives the full budget again.

### What you get

Each continuation is a durable `user/message` carrying a `notice`-form source named
`Automatic continuation N/M`, so the transcript shows that the tail was supplied
automatically rather than lost.

## Understand the implementation

### Design philosophy

The package observes durable state and never alters the turn's outcome. It reads the
finish the session log already recorded and steers only on a truncation it can prove,
so a turn that ended for any other reason is never continued.

### Detection: the durable stream finish

`session/event` carries `assistant/message` with the assistant's persisted stream. The
terminal `finish` record names the reason; only `max-tokens` triggers continuation. A
stream with no terminal finish records no known reason and is left alone, as is a
finish cached from an earlier turn — the cached turn number must equal the stopping
turn.

### Continuation delivery

On `agent/turn-stopping` with a matching `(turn, max-tokens)` pair, `agent.steer()`
injects the continuation message. The per-agent counter increments only on an actual
steer, and a turn whose budget is exhausted returns without steering so the turn ends
normally.

### Source map

| Concern | Location |
|---|---|
| Plugin entry, `Config`, detection, steering | `src/index.ts` |
| Behavior suite | `tests/max-token-continuation.spec.ts` |

## Further Exploration

- `tests/max-token-continuation.spec.ts` drives every case through a real `AgentLoop`
  against a scripted `MockAdapter`, asserting the injected messages and their durable
  sources.
- `packages/client/ui-chat/src/client/conversation-nodes/turn-max-tokens.ts` owns the
  user-visible turn-end notice.

## Model Experience

### Continuation context message

#### What the model sees

At each continuation the agent receives the message below. No tool schema and no
normal-call text is added.

##### Default continuation message

```markdown
Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.
```

#### Token effect

One retained user message per continuation. `maxContinuations` therefore bounds the
worst-case added context at `maxContinuations × prompt length`; the default prompt is
roughly 94 characters.

#### KV Cache effect

Append-only; the continuation follows the reusable request prefix and does not
invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

### No runtime invariant is published

Continuation state is private to one turn, and the session log already validates its
message sources and turn sequence, so no independent observation can diverge and this
package publishes no `./invariant` companion.

### A single oversized unit defeats the budget

A retained unit larger than the compaction threshold cannot be reduced by surface
compaction, so a turn holding one still reaches the context ceiling with no room to
generate. Bound the size of individual tool results rather than raising
`contextWindow` past the provider's real limit.

### The turn-max-tokens notice is unconditional

The conversation client materializes its turn-end notice from `turn/end` carrying
`reason.kind === 'max-tokens'`, so it appears after successful automatic continuation
as well as after an uncontinued truncation. Its copy still reads as manual recovery is
needed.
