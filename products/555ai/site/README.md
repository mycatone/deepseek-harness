---
description: "Build and manually deploy the 555AI introduction page with its Windows installer."
kind: "package-reference"
---

# 555AI download site

English | [中文](README.zh.md)

## Build

Run from the repository root after packaging the product. The builder requires an existing Windows executable; it copies the installer, brand assets and upstream MIT license, computes SHA-256, and writes static HTML, `release.json` and a checksum file. Download links are relative to the page, so the directory can be mounted at `/555ai/` without routing through the account service. The builder does not upload files or deploy the service.

```powershell
node products/555ai/run.mjs package win-x64
node products/555ai/build-site.mjs --installer "apps/desktop/.desktop-build/targets/win-x64/unsigned-artifacts/555ai-0.2.3-alpha.2-win-x64-unsigned.exe"
```

Output defaults to `.dsh-build/555ai-site`; `--output PATH` selects a dedicated output directory. The installer filename includes its digest, so releases do not overwrite cached installer bytes. Page names and account links come from [product.json](../product.json); the upstream version comes from the root package manifest. The supplied packaging profile produces an unsigned preview, disclosed on the page. Actual installation, upgrade and signing acceptance remain separate release checks.

## Manual deployment

Upload the complete output directory, including `downloads/`, to `/opt/555ai-site/` on the web server. Add the following locations to the existing HTTPS server block. Replace that absolute directory if the deployed directory differs. Keep existing account, authorization, inference and payment locations intact.

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

Run `nginx -t`, then reload through the existing service procedure. Check `https://hiai.chainlife.net/555ai/`, follow its actual installer link, compare the downloaded file's SHA-256 with `release.json`, and request a byte range to verify HTTP 206. Static downloads are served by Nginx, including range requests; they do not pass through Spring or require login. Keep old versioned installer files while clients may still hold their links.

To roll back, restore the previous complete site directory and its release metadata. Restore the prior Nginx configuration if removing the site route; no database changes are involved.

## Verification

```powershell
node --test products/555ai/tests/site.test.mjs
```

The site contains illustrative scenarios, not recorded model output. It has no telemetry, external fonts or remote artwork. Keyboard-accessible tabs and checksum copying are optional enhancements; direct installer links remain available without JavaScript. A denied clipboard permission leaves the checksum selectable and its download link available.
