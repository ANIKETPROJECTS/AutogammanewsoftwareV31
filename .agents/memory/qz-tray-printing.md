---
name: QZ Tray printing
description: Local Windows printer bridge and VPS signing boundary for POS receipts
---

QZ Tray must run on the same Windows computer as the installed printer queue. The VPS can authenticate the user and sign QZ messages, but it cannot directly reach the printer's private Wi-Fi IP.

**Why:** The printer IP belongs to the local network; browser-to-QZ communication is local to the cashier computer.

**How to apply:** Match QZ discovery to the exact Windows queue name (for example, POS80 Printer). Keep QZ certificate and private key server-side, never in frontend code.