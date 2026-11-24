---
description: "Build and launch 555AI with an editable name, a dedicated data directory, and hiAi account integration."
kind: "package-reference"
---

# 555AI

English | [中文](README.zh.md)

## Summary

Build and launch 555AI with its own account deployment and data directory. Edit the display name in `product.json` without changing the stable `slug` or `appId`. The default data directory is `~/.555ai`; `AI555_HOME` selects another dedicated directory.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

From the repository root, use Node.js `^24.22.3 || >=26.13.1`. The launcher uses the current compatible runtime or the verified project cache at `.dsh-build/product-node/node.exe`, without changing the system installation.

```powershell
node products/555ai/run.mjs check
node products/555ai/run.mjs build
node products/555ai/run.mjs web --no-open
```

Edit `product.json` or run `node products/555ai/run.mjs rename "555AI"` with the desired name, then rebuild. The sidebar, account prompts, Web title, PWA identity, desktop copy, and installer name derive from the product configuration. Desktop data uses the stable `desktop` subdirectory rather than the display name.

The launcher creates its own `cordis.patch.yml` in the dedicated home, configures hiAi account and inference origins, disables official brand occupants, and mounts `@555ai/brand`. It refuses to overwrite an existing user-authored patch. Branded desktop builds also initialize that product-owned patch at startup.

Keep product development on `product/555ai` and follow official changes through `upstream`. Before each upgrade, save source and Git-state backups, update the official baseline on an isolated upgrade branch, adapt product commits, and run focused tests plus `build` before advancing the product branch. Recover from a known verified product commit or backup if validation fails.

-----

<a id="model-experience"></a>
## Model Experience

None; this package supplies product identity and deployment configuration, not model-facing instructions.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Artwork is pending and `icons` remains `null`. The sidebar and home omit the official mark; favicon, taskbar, tray, and installer artwork still require replacement before a final release.
- Live login, inference, recharge, and refund acceptance require deployment of the compatible `hiai-dsh-module` service and reverse-proxy routes. Source checks do not establish those deployment results.
- Desktop launch, signing, installation, and the product's own update distribution require target-system release qualification. Keep the original copyright, MIT license, and third-party notices.

-----

<a id="dev-note"></a>
### Dev Note

None.
