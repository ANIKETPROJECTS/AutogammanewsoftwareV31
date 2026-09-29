---
name: Invoice PDF browser portability
description: The invoice PDF print flow requires a headless browser executable on the deployment host.
---

Resolve a configured Chrome/Chromium executable or a standard executable available on `PATH`; do not assume Replit's private browser path exists on an external VPS. Also verify the generated PDF exists and is valid: Chromium can exit successfully without writing the requested file, so keep the server-side invoice renderer as a fallback.

**Why:** Invoice PDFs are rendered by a child browser process. A Replit-only binary path caused invoice sending to fail on Hostinger, and a separate Replit run returned exit code zero while leaving no PDF file, both before WhatsApp could upload the document.

**How to apply:** For VPS deployments, verify Chrome/Chromium is installed and set `CHROMIUM_PATH` when its executable uses a nonstandard name or path. On every host, treat a missing or invalid output file as a render failure and fall back to `createInvoicePdf` when possible.