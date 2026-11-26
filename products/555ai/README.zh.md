---
description: "使用可修改的名称、独立的数据目录与 hiAi 账号集成，构建并启动 555AI。"
kind: "package-reference"
---

# 555AI

[English](README.md) | 中文

## 概述

使用自有账号部署与数据目录构建并启动 555AI。在 `product.json` 中修改显示名称时，保持稳定的 `slug` 与 `appId` 不变。默认数据目录为 `~/.555ai`；`AI555_HOME` 可指定另一个专用目录。

## 目录

- [使用此包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

在仓库根目录使用 Node.js `^24.22.3 || >=26.13.1`。启动器使用当前兼容版本，或已经校验的项目缓存 `.dsh-build/product-node/node.exe`，不会修改系统安装。

```powershell
node products/555ai/run.mjs check
node products/555ai/run.mjs build
node products/555ai/run.mjs web --no-open
node products/555ai/run.mjs package win-x64
```

编辑 `product.json`，或将 `node products/555ai/run.mjs rename "555AI"` 中的名称换成目标名称后执行，再重新构建。侧栏、账号提示、网页标题、PWA 标识、桌面文案与安装名称均来自产品配置。桌面数据使用稳定的 `desktop` 子目录，不随显示名称变化。

将 `defaultModel` 设为 `{ "provider": "deepseek-account", "model": "YOUR_GATEWAY_MODEL_ID" }`，可选填 `reasoningEffort`；也可以执行 `node products/555ai/run.mjs model deepseek-account YOUR_GATEWAY_MODEL_ID`。模型 id 必须来自已部署网关的实际目录。`null` 表示沿用标准配置中的选择。修改这些部署默认值后重新构建；已有会话保留自己的模型选择。

黑白狗狗标志以用户提供的插画为原型，使用白色背景，保存在 `assets/dog-mark.png`；`assets/wordmark.svg` 提供重新设计的 555AI 字标。先执行 `node --import tsx/esm products/555ai/render-icons.ts --preview` 检查单个 512px 图标，再去掉 `--preview` 生成应用、PWA、触屏、多尺寸托盘图片及 SVG 包装。Windows 无签名打包命令携带这些资源及品牌包；不发布更新，也不需要签名凭据。可信签名发行仍是独立的发布步骤。

[下载网站](site/README.zh.md)构建独立的介绍页与安装包目录，供人工部署到 `https://hiai.chainlife.net/555ai/`。构建时要求真实 Windows 安装包，生成相对下载链接及 SHA-256 元数据，并从 `product.json` 读取产品名称。生成文件保存在源码树外的 `.dsh-build/555ai-site`。

启动器在专用 home 中创建自己的 `cordis.patch.yml`，配置 hiAi 账号与推理来源，禁用官方品牌占位，并挂载 `@555ai/brand`。已有用户编写的同名文件不会被覆盖。品牌桌面构建也会在启动时初始化这份产品配置。

桌面欢迎页将产品图标与配置中的显示名称组合展示。打包时在 `.dsh-build/555ai-installer-assets` 生成配套的浅色、深色、1x 和 2x 安装器画面以及卸载页侧图，保留上游原图。改名并重新构建后，这些页面也会更新。

账号登录需要 `POST /auth-api/v0/dsh/auth_init` 返回有效授权信息后才会打开浏览器；此接口返回 HTTP 500 时，账号、密码输入页无法打开。桌面端会针对服务请求、协议数据或凭证保存失败，显示本地化的处理建议。部署人员应检查承载服务日志、管理端配置中心已有的 DSH 配置、Redis 连接和反向代理路由，再运行后端 `scripts/dsh-smoke.mjs` 核验。客户端改动不代表线上登录验收已通过。

产品开发保留在 `product/555ai`，通过 `upstream` 跟进官方更新。每次升级前保存源码与 Git 状态备份，在独立升级分支更新官方基线，适配产品提交，并在产品分支前移前运行定向测试与 `build`。验证失败时恢复已知且经过验证的产品提交或备份。

-----

<a id="model-experience"></a>
## 模型体验

无；此包提供产品身份与部署配置，不提供面向模型的指令。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 内置图标采用狗狗标志与独立的 555AI 字标。修改 `icons` 可选择另一个包含相同生成文件名及 `wordmark.svg` 的相对资源目录。
- 真实登录、推理、充值及退款验收，需要部署兼容的 `hiai-dsh-module` 服务及反向代理路径。源码检查不代表这些部署结果已通过。
- 桌面启动、签名、安装以及产品自有的更新分发，仍需在目标系统完成发行验收。保留原版权、MIT 许可和第三方声明。

-----

<a id="dev-note"></a>
### 开发备注

无。
