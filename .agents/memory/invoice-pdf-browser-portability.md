---
name: Invoice PDF browser portability
description: The invoice PDF print flow requires a headless browser executable on the deployment host.
---

Resolve a configured Chrome/Chromium executable or a standard executable available on `PATH`; do not assume Replit's private browser path exists on an external VPS.

**Why:** Invoice PDFs are rendered by a child browser process, and a Replit-only binary path caused invoice sending to fail on Hostinger before WhatsApp could upload the document.

**How to apply:** For VPS deployments, verify Chrome/Chromium is installed and set `CHROMIUM_PATH` when its executable uses a nonstandard name or path.