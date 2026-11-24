---
description: "Continue responses cut off by the output-token limit within a bounded per-turn budget."
kind: "package-reference"
---

# @deepseek-ai/dsh-max-token-continuation

English | [中文](README.zh.md)

## Summary

Complete the missing tail of a response cut off by the model's output-token limit. Each automatic continuation adds a retained prompt and another model request. A per-turn budget limits the extra work; responses that stop for another reason are left unchanged.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The base bundle mounts this plugin with eight automatic continuations per turn. Override its row to change the budget or instruction:

```yaml
- id: max-token-continuation
  name: '@deepseek-ai/dsh-max-token-continuation'
  config:
    maxContinuations: 8
    prompt: Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.
```

The plugin's own default is three continuations. Zero disables steering. Negative or noninteger budgets and empty instructions fail configuration. Each later turn receives a new budget.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The plugin reads the terminal finish in durable `assistant/message` events. It steers only when that record belongs to the stopping turn and reports `max-tokens`. Missing finishes and other finish reasons do not trigger continuation. Its injected `user/message` uses source kind `max-token-continuation` and summary `Automatic continuation N/M`. Existing messages and turn outcomes are not rewritten.

The [behavior tests](tests/max-token-continuation.spec.ts) exercise the real agent loop with a scripted model adapter, including exhausted budgets, fresh turns, disabled continuation, configuration failures, and messages without a terminal finish.

-----

<a id="model-experience"></a>
## Model Experience

### Continuation context message

#### What the model sees

Each continuation adds one user message containing the configured instruction; no tool schema is added.

##### Default continuation message

```markdown
Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.
```

#### Token effect

Each continuation retains its instruction and requests another model response. The budget bounds the number of extra instructions and requests; generated output determines their actual token cost.

#### KV Cache effect

The continuation appends to the recorded history without editing preceding messages. The provider determines whether the unchanged prefix receives a cache hit.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Continuation cannot reduce an oversized retained input or replace context-window compaction.
- Counters live in the plugin instance and do not persist across Host restarts.
- This plugin does not remove the conversation client's max-token notice; the client owns that presentation.

-----

<a id="dev-note"></a>
### Dev Note

None.
