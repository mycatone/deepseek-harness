# @deepseek-ai/dsh-max-token-continuation

English | [中文](README.zh.md)

This policy plugin automatically resumes a model response that ends at its output-token limit. It injects a logged, plugin-sourced continuation instruction through `agent/turn-stopping`, so the next provider call remains in the same turn and receives the already emitted assistant prefix. A successful continuation makes the turn `completed`; if every permitted continuation is also truncated, the final turn remains `max-tokens` and clients retain their manual-continue warning.

## Config

```yaml
- id: max-token-continuation
  name: '@deepseek-ai/dsh-max-token-continuation'
  config:
    maxContinuations: 3
    prompt: Continue the interrupted response from exactly where it stopped. Do not repeat completed content. If a tool call was cut off, issue the complete tool call again.
```

`maxContinuations` defaults to `3`; `0` disables automatic continuation. The plugin rejects negative, fractional, or non-numeric values and rejects an empty `prompt` at load time. The base bundle installs the default configuration.

## Model Experience

### Continuation context message

#### What the model sees

After a provider finishes with `max-tokens`, the model receives the configured instruction as a plugin notice. The default is:

##### Default continuation instruction

```markdown
Continue the interrupted response from exactly where it stopped. Do not repeat completed content. If a tool call was cut off, issue the complete tool call again.
```

#### Token effect

Each retry adds the short instruction and preserves the truncated assistant prefix in history. At most `maxContinuations` extra provider calls and instructions are added per turn.

#### KV Cache effect

Append-only. The continuation instruction follows the reusable request prefix and does not invalidate earlier KV-cache entries.

## Known Limitations and Deferred Work

- Continuation relies on the model to avoid repeating the end of its preceding output; the runtime does not splice or deduplicate text.
- A provider that repeatedly reaches its output limit still ends with `max-tokens` after the configured cap.
- The retry counter is process-local. A process interruption ends the active turn before session resumption can continue it.
