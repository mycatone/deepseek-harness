# Agent Note: Bounded automatic continuation owns output-limit recovery

Status: implemented

English | [中文](2026-08-25-bounded-max-token-continuation.zh.md)

## Problem

A provider can finish a valid response with `max-tokens` after emitting only a prefix. The session preserves that prefix and the Web client identifies the truncation, but recovery requires the user to send “continue” manually. Raising a model's output-token setting reduces the frequency without removing the failure mode, and an unbounded automatic retry could consume provider calls forever when a gateway repeatedly enforces a smaller limit.

## Decision

`@deepseek-ai/dsh-max-token-continuation` is an independent guard policy installed by the base bundle. On `agent/turn-stopping`, it inspects the current turn's final provider finish. A `max-tokens` finish steers a logged plugin notice into the next step of the same turn; other finishes do nothing. The instruction asks the model to continue at the cutoff without repeating completed content and to reissue a complete tool call when truncation discarded an incomplete call.

The policy defaults to three automatic continuations per turn. `maxContinuations: 0` disables it, and load-time validation rejects negative or fractional limits and empty instructions. Per-agent counters live in a `WeakMap` and reset by turn identity. This state is intentionally not durable: the active turn and its process own retry execution.

The agent loop assigns the turn outcome from the last attempted step. A successful continuation therefore produces `completed`; if the final permitted attempt also reaches the ceiling, the turn remains `max-tokens` and the existing durable warning tells the user that manual continuation is available. Each truncated provider call still has its own `assistant/message` anchor, so every emitted prefix and injected instruction remains reconstructable from the session log.

## Alternatives considered

**Only increase each model's `maxTokens`.** This is useful configuration but cannot guarantee completion: gateways may impose lower limits, model output length varies, and a larger single response still has a finite ceiling.

**Continue without a retry cap.** Rejected because a provider that returns `max-tokens` for every request would create an unbounded same-turn loop and unbounded cost.

**Build continuation directly into the agent loop.** Rejected because automatic retry count and instruction text are deployment policy. The loop owns step sequencing and final outcome semantics; a guard plugin owns whether another step is requested.

**Keep `max-tokens` sticky after a successful continuation.** Rejected because clients would display a truncation warning after the response had already been completed. Individual truncated calls remain durable facts; the turn outcome describes the final unresolved state.

## Consequences

Ordinary base-bundle sessions recover from up to three consecutive output-limit truncations without user action. Successful recovery removes the manual-continue warning, while cap exhaustion preserves it. Continuations add model calls and retained prompt text, and the model may repeat a small overlap because the runtime does not splice generated text. The [max-tokens notice decision](../bug-fix/2026-08-12-max-tokens-turn-end-notice.md) remains active authority for exhausted retries, and the [replay-state alignment decision](../bug-fix/2026-08-15-max-token-replay-state-alignment.md) continues to own safe reconstruction of truncated tool-call responses; neither is fully superseded.

Automatic continuation relies on pressure compaction to make room for the next step. Auxiliary summarization calls therefore apply the routed provider retry policy directly: a retryable terminal transport failure starts a fresh summary stream after the resolved delay, while cancellation, exhausted retries, and non-retryable failures preserve the existing compaction failure behavior. This prevents a transient summary connection failure from consuming continuation attempts against an unchanged full context.
