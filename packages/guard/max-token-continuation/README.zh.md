---
description: "在每回合次数限制内，自动续写因输出 token 上限而截断的回答。"
kind: "package-reference"
---

# @deepseek-ai/dsh-max-token-continuation

[English](README.md) | 中文

## 概述

补全因模型输出 token 上限而截断的回答。每次自动续写会保留一条提示，并增加一次模型请求。每回合的次数预算限制额外工作；因其他原因停止的回答保持原样。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

基础 bundle 已挂载此插件，每回合最多自动续写八次。覆盖对应行即可调整预算或提示：

```yaml
- id: max-token-continuation
  name: '@deepseek-ai/dsh-max-token-continuation'
  config:
    maxContinuations: 8
    prompt: Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.
```

插件自身默认最多续写三次。零可禁用续写。负数或非整数预算，以及空提示，都会使配置失败。后续每个回合获得新的预算。

-----

<a id="understand-the-implementation"></a>
## 理解实现

插件读取持久化 `assistant/message` 事件中的终止记录。只有记录属于即将停止的当前回合，且原因为 `max-tokens`，才会追加续写。缺少终止记录或其他终止原因均不触发。追加的 `user/message` 使用来源类型 `max-token-continuation`，摘要为 `Automatic continuation N/M`。已有消息和回合结果均不重写。

[行为测试](tests/max-token-continuation.spec.ts)使用脚本化模型适配器驱动真实 Agent 循环，覆盖预算耗尽、新回合、禁用续写、配置失败和没有终止记录的消息。

-----

<a id="model-experience"></a>
## 模型体验

### 续写上下文消息

#### 模型看到什么

每次续写增加一条包含配置提示的用户消息，不增加工具 schema。

##### 默认续写消息

```markdown
Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.
```

#### Token 影响

每次续写保留其提示，并请求一次模型回答。预算限制新增提示和请求的次数；实际 token 成本取决于生成的输出。

#### KV Cache 影响

续写追加到已记录的历史末尾，不修改前面的消息。未变化的前缀能否命中缓存由提供方决定。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 续写无法缩小过大的保留输入，也不能代替上下文窗口压缩。
- 计数器属于插件实例，不会跨 Host 重启持久化。
- 此插件不会移除会话客户端的输出上限提示；该呈现由客户端拥有。

-----

<a id="dev-note"></a>
### 开发备注

无。
