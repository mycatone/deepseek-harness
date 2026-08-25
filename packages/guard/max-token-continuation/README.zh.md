# @deepseek-ai/dsh-max-token-continuation

[English](README.md) | 中文

此策略插件会自动续写因输出 token 上限而中断的模型回答。它通过 `agent/turn-stopping` 注入一条已记录且标明插件来源的续写指令，因此下一次提供方调用仍属于同一轮，并能看到已输出的 assistant 前缀。续写成功后，该轮以 `completed` 结束；如果允许的续写全部再次被截断，最终状态仍为 `max-tokens`，客户端会继续显示手动“继续”提示。

## 配置

```yaml
- id: max-token-continuation
  name: '@deepseek-ai/dsh-max-token-continuation'
  config:
    maxContinuations: 3
    prompt: Continue the interrupted response from exactly where it stopped. Do not repeat completed content. If a tool call was cut off, issue the complete tool call again.
```

`maxContinuations` 默认为 `3`；设为 `0` 可关闭自动续写。插件会在加载时拒绝负数、小数、非数字值以及空白 `prompt`。base bundle（基础组合包）会安装默认配置。

## 模型体验

### 续写上下文消息

#### 模型看到的内容

提供方以 `max-tokens` 结束后，模型会收到配置的插件通知。默认指令如下：

##### 默认续写指令

```markdown
Continue the interrupted response from exactly where it stopped. Do not repeat completed content. If a tool call was cut off, issue the complete tool call again.
```

#### Token 影响

每次重试会增加这条短指令，并在历史中保留已截断的 assistant 前缀。每轮最多增加 `maxContinuations` 次提供方调用和续写指令。

#### KV Cache 影响

仅追加。续写指令位于可复用请求前缀之后，不会使已有 KV Cache 条目失效。

## 已知限制与暂缓事项

- 续写依赖模型避免重复上一段输出的末尾；运行时不会拼接或去重文本。
- 如果提供方反复达到输出上限，在配置次数耗尽后，该轮仍以 `max-tokens` 结束。
- 重试计数仅驻留于当前进程。进程中断会先结束活动轮次，恢复会话时不会继续该轮计数。
