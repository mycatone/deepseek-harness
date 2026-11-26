---
description: "构建 555AI 介绍页及 Windows 安装包下载目录，并人工部署到服务器。"
kind: "package-reference"
---

# 555AI 下载网站

[English](README.md) | 中文

## 构建

在产品打包后，从仓库根目录运行。构建器要求已有 Windows 可执行文件，会复制安装包、品牌资源及上游 MIT 许可，计算 SHA-256，生成静态 HTML、`release.json` 和校验文件。下载链接相对于页面生成，可以挂载到 `/555ai/`，无需经过账号服务。构建器不上传文件，也不部署服务。

```powershell
node products/555ai/run.mjs package win-x64
node products/555ai/build-site.mjs --installer "apps/desktop/.desktop-build/targets/win-x64/unsigned-artifacts/555ai-0.2.3-alpha.2-win-x64-unsigned.exe"
```

默认输出到 `.dsh-build/555ai-site`；`--output PATH` 可选择专用输出目录。安装包文件名包含摘要，不会覆盖浏览器缓存中的其他发行文件。页面名称和账号链接来自 [product.json](../product.json)，上游版本来自根包清单。当前打包配置生成未签名预览版，页面会明确说明。实际安装、升级与签名验收仍是独立发行检查。

## 人工部署

把完整输出目录（包括 `downloads/`）上传至 Web 服务器的 `/opt/555ai-site/`。在现有 HTTPS server 块加入以下 location；部署目录不同则替换该绝对路径。保留现有账号、授权、推理和支付的 location。

```nginx
location = /555ai { return 301 /555ai/; }
location ^~ /555ai/downloads/ {
    alias /opt/555ai-site/downloads/;
    default_type application/octet-stream;
    add_header Content-Disposition "attachment" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    sendfile on;
    max_ranges 1;
}
location ^~ /555ai/ {
    alias /opt/555ai-site/;
    index index.html;
    add_header Cache-Control "no-cache" always;
    add_header X-Content-Type-Options nosniff always;
}
```

执行 `nginx -t`，通过现有服务流程重新加载配置。打开 `https://hiai.chainlife.net/555ai/`，点击页面实际安装包链接，核对下载文件的 SHA-256 与 `release.json` 一致，并请求字节范围验证 HTTP 206。静态文件及断点续传由 Nginx 处理，不经过 Spring，也不要求登录。客户仍可能使用旧链接时，保留旧版本安装包。

回滚时恢复上一版完整网站目录及发行元数据；若移除网站路由，同时恢复原 Nginx 配置。不涉及数据库变更。

## 验证

```powershell
node --test products/555ai/tests/site.test.mjs
```

网站展示的是功能场景示意，不是模型真实输出。不包含遥测、外部字体或远程图片。可键盘操作的场景标签与校验值复制属于渐进增强；关闭 JavaScript 仍能直接下载安装包。剪贴板权限被拒绝时，仍可选中校验值或下载校验文件。
