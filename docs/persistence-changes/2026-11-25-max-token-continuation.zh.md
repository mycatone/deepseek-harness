---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-25-max-token-continuation

[English](2026-11-25-max-token-continuation.md) | 中文

## 概述

同步官方代码后，保留产品的 max-token-continuation 生产者归属，继续使用现有 notice 形式与文本内容。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

继续使用 Session 格式 V4。新增来源种类携带已有的 notice 形式、summary 与文本内容。V4 来源准入接受非空且由生产者持有的种类，并保留未知元数据；已有种类和事件字段均不改变。收件箱队列与标题请求中的消息携带相同来源对象。恢复消息不会运行续写监听器：该监听器要求当前轮次助手以 max-tokens 结束，并设置明确的单轮上限。已有读取器无需加载此插件，也能保留并呈现该通知。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/session/session-format-v3-to-v4/tests/attribution.spec.ts packages/session/session-format-v3-to-v4/tests/message-sources.spec.ts packages/guard/max-token-continuation/tests：23 个测试通过。覆盖未知生产者信息保留、严格 V4 来源准入、续写归属与摘要、当前轮次结束原因选择、重试上限及禁用续写。

<a id="dev-note"></a>
## 开发备注

无。
