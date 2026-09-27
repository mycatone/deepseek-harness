# 本地 Windows 未签名打包、登录域名与配置差异

面向本机打出的 **未签名** 安装包操作说明。正式签名发布仍以 [README.zh.md](README.zh.md) 的打包与上传章节为准。

## 1. 本次打包用到的配置与命令

### 1.1 配置文件

路径：`apps/desktop/.env.windows`（Git 忽略，从 [`.env.windows.example`](.env.windows.example) 复制）。

本机实际用过的字段（不含签名密钥）：

| 字段 | 本次取值 | 作用 |
| --- | --- | --- |
| `DSH_DESKTOP_APP_ID` | `com.deepseek.harness` | 包身份；必填 |
| `DSH_DESKTOP_AUTO_UPDATE_ENV` | `test` | 更新环境；未签名包会省略 updater 配置 |
| `DOWNLOAD_TEST_ORIGIN` | `https://download-test.deepseek.com` | test 更新 HTTPS origin |
| `DOWNLOAD_TEST_RELEASE_ID` | 32 位小写 hex | test 发布批次路径；同批升级需复用 |
| `DSH_DESKTOP_NPM_REGISTRY` | `https://registry.npmmirror.com` | 捆绑 dsh 运行时安装用镜像（可选） |
| `DSH_DESKTOP_MANDATORY_UPDATE_TEST_ORIGIN` | `https://harness-test.deepseek.com` | 强制更新策略服务 origin（含未签名构建） |
| `DSH_DESKTOP_MANDATORY_UPDATE_CONFIG` | `{"allowedAuthOrigins":["https://login.example.com"]}` | 强制更新 **飞书测试鉴权** 允许的登录页 origin；**不是** DeepSeek 账号 `platformOrigin` |
| Windows 签名四项 | 空 | 未签名模式不需要 EV Token |

说明：

- `.env.windows` **不会**打进安装包，也不会成为运行时账号/模型配置。
- Electron 二进制若从 GitHub 拉取过慢，可在打包前设置：`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。
- Electron 版本须与仓库锁定的 `44.0.0` 一致；脏 `node_modules` / 双份 zod 解析会导致 TypeScript 失败，应用干净 lock 重装后再打。

### 1.2 命令

仓库根目录：

```sh
# 推荐：根目录别名（与 package:desktop:win:x64:unsigned 等价）
pnpm run package:win:x64:unsigned

# 或
pnpm run package:desktop:win:x64:unsigned
```

仅校验配置、不打包：

```sh
pnpm --dir apps/desktop run check:package -- --target win-x64 --unsigned
```

### 1.3 产物路径

成功后安装包在：

```text
apps/desktop/.desktop-build/targets/win-x64/unsigned-artifacts/deepseek-harness-<版本>-win-x64-unsigned.exe
```

本次实际产物示例：

```text
E:\code\ds\deepseek-harness\apps\desktop\.desktop-build\targets\win-x64\unsigned-artifacts\deepseek-harness-0.1.7-rc.2-win-x64-unsigned.exe
```

未签名包特点：文件名带 `-unsigned`、省略自动更新配置、不写发布完成记录、不要求 EV。冒烟里 LibreOffice 转换失败时，命令可能以非 0 退出，但 NSIS 安装包若已写出，仍可安装验证壳与 Host。

---

## 2. 注册 / 登录域名怎么调；网页登录成功后打开桌面

这里有两套 **不同** 的「域名」配置，不要混用。

### 2.1 DeepSeek 账号登录（注册页 / 授权页 / 完成页）

由 Host 插件 `deepseek-account`（`@deepseek-ai/dsh-deepseek-account-platform`）的 **`platformOrigin`** 决定。默认：

```text
https://platform.deepseek.com
```

**不要**写进 `.env.windows`。应写在运行时私有 patch（不进仓库）：

- 开发：`apps/desktop/.desktop-build/development/home/profiles/desktop/cordis.patch.yml`（或该次 `DSH_HOME` 下的同路径）
- 已安装包：用户主目录 `~/.dsh/profiles/desktop/cordis.patch.yml`（可被 `DSH_HOME` 覆盖）

示例：

```yaml
- id: deepseek-account
  config:
    platformOrigin: https://platform.example.com
    # 仅本机 HTTP 开发：
    # allowLoopbackHttp: true
    # 私有代理把授权/完成页映射到 platformOrigin（保留路径与 query）：
    # rewriteBrowserOrigin: true
    # 推理/文件 token 允许的来源（默认 https://api.deepseek.com）：
    # inferenceOrigin: https://api.example.com
    # 开发 Cookie 等 Host 专用头（不会进 UI）：
    # requestHeaders:
    #   Cookie: gate=...
```

也可用环境表达式（仍放在私有 patch）：

```yaml
- id: deepseek-account
  config:
    platformOrigin: !!js process.env.DSH_PLATFORM_ORIGIN
    allowLoopbackHttp: !!js process.env.DSH_PLATFORM_ALLOW_LOOPBACK_HTTP === '1'
```

浏览器地址默认必须与 `platformOrigin` **同源**，路径固定为：

| 阶段 | 路径 |
| --- | --- |
| 授权页 | `/dsh/authorize` |
| 完成页 | `/dsh/authorized` |

`rewriteBrowserOrigin: true` 时可将远端返回的 HTTPS 授权/完成 URL 改写到配置的 `platformOrigin`（路径与 query 保留）。发布 profile 应保持同源校验。

详细行为见 [deepseek-account-platform README](../../packages/credentials/deepseek-account-platform/README.zh.md)。

### 2.2 强制更新策略里的「登录 origin」

`.env.windows` 的 `DSH_DESKTOP_MANDATORY_UPDATE_CONFIG.allowedAuthOrigins` **只**用于强制更新策略在 `authentication: feishu-test` 时允许导航的登录文档 origin，与 DeepSeek 账号 `platformOrigin` 无关。生产强制更新用 `anonymous` 时不应配置 `allowedAuthOrigins`。

### 2.3 登录相关 Platform 接口（Host ↔ Platform）

基址：`{platformOrigin}`。账号 token 使用请求头 `x-dsh-auth-token`（无 `Bearer` 前缀）。外层信封形如 `{ code: 0, data: { biz_code, biz_data } }`，业务成功时 `code === 0` 且 `biz_code` 按接口约定。

#### 授权流程（浏览器 PKCE）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/auth-api/v0/dsh/auth_init` | 初始化。Body 含 `code_challenge`、`code_challenge_method: S256`、`state`、`redirect_uri`、`locale`、`login_source`（`desktop` \| `web`）等。成功 `biz_data`：`authorize_url`、`authorize_id`、`expires_in` |
| `POST` | `/auth-api/v0/dsh/auth_exchange` | 用授权码兑换。Body：`code`、`code_verifier`、`redirect_uri`。成功 `biz_data`：`token`、`authorized_url`、可选 `user` |
| `POST` | `/auth-api/v0/dsh/auth_cancel` | 取消。Body：`authorize_id`、`code_verifier`。本地取消不等待该请求 |

Host 在本机 `webServer` 注册临时 `GET /oauth/callback`（仅 localhost / 127.0.0.1 / `[::1]`，可带显式端口，支持 SSH 本地转发）。校验 `state` 与 PKCE 后兑换；**凭证写入本地后**才跳转 `authorized_url`。失败时 Desktop 聚焦已有登录 UI；Web 侧关闭授权标签并提示重试。

完成页 URL 会由 Host 补上 `login_source=desktop` 或 `web`，并保留平台返回的其他 query。

#### 资料 / 余额 / 退登 / 赠金

| 方法 | 路径 | 鉴权 |
| --- | --- | --- |
| `GET` | `/auth-api/v0/users/current` | `x-dsh-auth-token` |
| `GET` | `/api/v0/users/get_user_summary` | 同上 |
| `POST` | `/auth-api/v0/users/logout` | 同上（先删本地授权再调远端） |
| `GET` | `/api/v0/users/get_unnotified_bonuses` | 同上 |
| `POST` | `/api/v0/users/ack_bonus_notified` | 同上；JSON `{ "order_id": "..." }` |

HTTP `401` 或业务码 `40003` 会清除本地凭据。推理与文件请求只允许发往配置的 `inferenceOrigin`（默认 `https://api.deepseek.com`），且授权签发来源须匹配当前 `platformOrigin`；本机开发授权不能认证生产 API。

每个 Platform 请求还带五个客户端身份头（由调用方 UI 元数据推导，部署 `requestHeaders` 不能覆盖）：含 `x-client-platform`（Desktop 为 `desktop-mac` / `desktop-win`，否则 `web`）、locale、版本等。详见包 README。

### 2.4 网页登录成功后自动打开 / 置前桌面版

流程约定：

1. Desktop 在系统浏览器打开授权页；Host 在本机回调收下 code 并兑换。
2. 凭证落盘后，Welcome **切到工作区但不激活应用**。
3. 平台 **完成页** 提供打开客户端的深链；Desktop 收到后只 **显示并聚焦窗口**，**不**通过 URL 传凭证。

| 项 | 约定 |
| --- | --- |
| Scheme | `dsh`（安装包 / 打包应用注册为默认处理程序） |
| 打开 / 置前 | **仅** `dsh://open` 或 `dsh://open/` |
| 行为 | `focusPrimaryWindow()`：显示欢迎窗或主窗；强制更新遮罩时改聚焦策略 UI |
| Windows 二次启动 | 单实例认领后聚焦已有进程（等价于置前） |
| 开发版（macOS） | `.desktop-build/development` 下临时签名的 `Harness Dev.app` 注册 `dsh`；最近启动的开发版或打包版会成为默认处理程序 |

网页 / 平台完成页应在登录成功后引导用户打开：

```html
<a href="dsh://open">打开 DeepSeek Harness</a>
```

或在脚本中：

```js
location.href = 'dsh://open'
```

**不要**把 token、code、PKCE verifier 放进 `dsh://` URL。凭证只走本机 HTTP 回调与 Host 存储。

相关说明：[桌面登录决策](../../.agents/notes/implemented/architecture/2026-09-14-deepseek-account-login.zh.md)、[README 账号章节](README.zh.md)。

---

## 3. 为什么开发版有自定义大模型 / 登录改配，正式未签名包没有

这是 **预期行为**，不是未签名打包漏拷文件。

| 维度 | 开发启动 `pnpm run start:desktop` / `dev:desktop` | 安装未签名正式包 |
| --- | --- | --- |
| `DSH_HOME` | 默认 `apps/desktop/.desktop-build/development/home` | 默认用户目录下的 `~/.dsh`（与开发 home **隔离**） |
| Electron userData | `.desktop-build/development/electron-user-data` | 安装身份下的 AppData |
| Profile patch | 可在开发 home 的 `profiles/desktop/cordis.patch.yml` 改 `platformOrigin`、Cookie、自定义插件等 | 安装后是 **空/新** profile；不会带上开发 home 里的 patch |
| 自定义大模型（`llm-pi-ai`） | 基础 bundle 已挂载适配器，但默认 **休眠**；Models 页或 settings 写入 `llm-pi-ai.providers` 后才出现路由 | 同样挂载且默认休眠；须在 **本安装** 的设置里重新配置，不会继承开发环境 settings |
| `.env.windows` | 仅打包/上传用 | **不**注入运行时 |

要点：

1. **打包嵌入的是官方 runtime profile / base bundle**，不含你本机开发目录里的 `cordis.patch.yml`、`.credentials.yaml`、Models 自定义提供方。
2. **`llm-pi-ai` 在发布组合里是「有适配器、无路由」**：没有用户 settings 里的 `providers`，选择器就不会出现自定义网关。开发时你在 Models 页加过 OpenAI 兼容接口，那份配置写在 **开发 DSH_HOME**；装包后读的是另一套 home，所以「没了」。
3. **登录域名同理**：开发 patch 里的 `platformOrigin: https://你的测试域` 不会进安装包；未签名正式包默认仍是 `https://platform.deepseek.com`，除非在安装后的 `~/.dsh/profiles/desktop/cordis.patch.yml` 再写一份。
4. **强制更新 origin / `allowedAuthOrigins`** 在打包时写入策略清单，与账号登录域名、自定义模型无关。

若要在未签名安装包上继续测自定义模型或测试登录域：

1. 安装并启动该包。
2. 编辑安装所用 `DSH_HOME`（默认 `~/.dsh`）下 `profiles/desktop/cordis.patch.yml`，按第 2 节改 `platformOrigin` 等。
3. 在应用内 **设置 → Models** 重新添加自定义提供方（或写入对应 settings 文档中的 `llm-pi-ai` 段），并配置 `apiKeyEnv` 指向凭证存储中的引用。
4. 需要与开发数据共用时，只能显式把 `DSH_HOME` 指到同一目录（不推荐与日常开发混用同一 home）。

自定义提供方字段说明见 [llm-pi-ai README](../../packages/llm/llm-pi-ai/README.zh.md)。
