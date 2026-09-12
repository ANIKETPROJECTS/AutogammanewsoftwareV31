# BUNGLE POS Printing Setup Guide

This guide documents the printer setup used by the BUNGLE POS so the same
printing configuration can be repeated in another project.

## Printing architecture

The setup has two parts:

1. **Windows Printers & scanners**
   - Installs the printer and its Windows driver.
   - Gives the printer the exact local Windows printer name.
   - Lets Windows print a test page.

2. **POS printer configuration**
   - Stores the exact Windows printer name.
   - Stores the printer's network IP address.
   - Stores the raw TCP printing port, normally `9100`.
   - Identifies whether the printer is for KOTs, bills, or labels.
   - Controls whether the printer receives automatic print jobs.

QZ Tray prints to the printer installed on the local Windows computer. The
stored IP address and port are also used for printer reachability checks and
the server-side/fallback print-agent path.

## Part 1: Add the printer in Windows

Perform these steps on the Windows computer that will physically print the
receipts.

### 1. Give the printer a stable network address

For a network thermal printer:

1. Connect the printer to the same network as the Windows computer.
2. Find its current IP address from the printer's network report, router, or
   printer configuration page.
3. Reserve that IP address in the router, or configure a static IP on the
   printer.
4. Record the address, for example:

   ```text
   Printer IP: 192.168.1.100
   Raw print port: 9100
   ```

Do not use a temporary DHCP address if the printer will be used permanently.
The IP can change after a router restart unless it is reserved or static.

### 2. Open Windows Printers & scanners

On Windows 10 or Windows 11:

1. Open **Settings**.
2. Go to **Bluetooth & devices**.
3. Open **Printers & scanners**.
4. Select **Add device**.
5. If Windows does not find the printer automatically, choose the option to
   add it manually.

### 3. Add the printer by IP address

When Windows asks how to find the printer, use the network/TCP-IP option:

1. Select **Add a printer using an IP address or hostname**.
2. Choose **TCP/IP Device**.
3. Enter the printer IP address.
4. Keep the device type as automatic if Windows detects it correctly.
5. If Windows asks for a port, use the printer's raw port, normally `9100`.
6. Install the correct printer driver.
7. Give the Windows printer a clear name, for example:

   ```text
   BUNGLE Kitchen Printer
   ```

The name must be copied exactly later into the POS printer configuration.
Avoid changing the name after adding it to the POS.

### 4. Print a Windows test page

1. Open the printer from **Printers & scanners**.
2. Open **Printer properties**.
3. Use **Print Test Page**.
4. Confirm that the thermal printer produces a readable receipt.

Do not continue with POS configuration until the Windows test page works.

## Part 2: Add the printer in the POS

Log in to the POS and open:

```text
/printer-config
```

In the application this page is labelled **Printer Configuration**.

Choose **Add Printer** and enter:

| POS field | What to enter | Example |
|---|---|---|
| Printer Name | Exact Windows printer name | `BUNGLE Kitchen Printer` |
| IP Address | Stable network IP of the printer | `192.168.1.100` |
| Port | Raw TCP print port | `9100` |
| Printer Type | What the printer should print | `KOT` or `Bill` |
| Auto-print | Enable automatic jobs | On |

### Printer types

#### KOT printer

Use `KOT` for kitchen order tickets. Enable **Auto-print** if new KOTs should
print automatically.

#### Bill printer

Use `Bill` for customer invoices and receipts. Enable **Auto-print** if
completed bills should print automatically.

#### Label printer

Use `Label` only for label-specific printing. It is not selected for normal
KOT or bill jobs.

### One printer for both KOT and bills

If the restaurant uses one thermal printer for both jobs, configure the same
Windows printer name and IP in the POS as needed for the applicable print
type.

The current POS also falls back to an enabled `KOT` printer for queued bill
printing when no enabled `Bill` printer is configured. It is still clearer to
add a separate `Bill` entry when the restaurant has separate printers.

## Part 3: Install and prepare QZ Tray

QZ Tray must be installed on the same Windows computer where the printer was
added.

1. Install QZ Tray.
2. Start QZ Tray.
3. Confirm its tray icon is visible.
4. Keep it running while the POS is expected to print.
5. Open the POS in a supported browser.
6. Allow the application to connect to QZ Tray if prompted.

The POS discovers the printers installed on that computer through QZ Tray. It
compares the discovered local printer names with the names configured in the
POS. The comparison is case-insensitive, but the name should still be kept
exactly the same.

QZ Tray does not use the VPS to reach a Windows printer. Installing QZ Tray
on the VPS will not make a printer connected to a restaurant computer
available to the browser.

## Part 4: Configure QZ signing on the backend

For silent QZ printing, the backend needs a matching certificate and private
key:

```text
QZ_CERTIFICATE
QZ_PRIVATE_KEY
```

Store them as backend secrets/environment variables. Never put the private
key in frontend code or commit it to the repository.

The backend exposes:

```text
GET  /api/qz-certificate
POST /api/sign-message
```

The certificate endpoint returns the public certificate. The signing endpoint
signs the exact QZ message with the private key. The frontend configures QZ
Tray with those endpoints before opening the QZ WebSocket.

After changing the secrets, restart the backend so it loads the new values.

## Part 5: Test the complete setup

Run the checks in this order:

1. The printer is powered on.
2. The Windows computer and printer are on the same network.
3. Windows can print a test page.
4. The printer IP is stable.
5. The POS printer name exactly matches the Windows printer name.
6. The POS IP and port are correct.
7. The printer type is correct: `KOT` or `Bill`.
8. **Auto-print** is enabled.
9. QZ Tray is running.
10. In POS **Printer Configuration**, click **Check QZ Tray**.
11. Click **Check** beside the configured printer.
12. Click **Test Print**.
13. Create a test KOT.
14. Complete a test bill/invoice.
15. Confirm the correct printer receives the correct document.

The test print should be performed before testing a real customer order.

## Which path is being used?

### QZ Tray path

Used when the POS browser is running on the Windows computer connected to the
printer:

```text
POS browser
  → QZ Tray on the same Windows computer
  → Windows-installed printer
  → thermal printer
```

This path uses the configured local printer **name**.

### Queued print-worker path

The POS can also create a server-side print job. A designated authenticated
browser session with QZ Tray running polls the job queue and prints it.

```text
POS action
  → server print job
  → local print-worker browser
  → QZ Tray
  → configured Windows printer
```

The worker selects only configured printer names and prevents random virtual
printers from being selected.

### Direct network/fallback path

The server-side print agent can send raw ESC/POS data to a network printer
using:

```text
Printer IP + TCP port
```

This is why the POS stores both the printer name and the IP/port. The normal
QZ path primarily needs the local Windows printer name, while the network
path needs the IP and port.

## Troubleshooting

### Windows test page fails

- Check the printer power and cable/network connection.
- Confirm the IP address.
- Confirm the printer driver.
- Confirm the printer is not paused or offline in Windows.
- Recheck the router IP reservation.

### POS says the printer is offline

- Confirm the saved IP and port.
- Confirm the printer is on the same network.
- Check whether the printer accepts raw TCP connections on port `9100`.
- Try the Windows test page again.

### QZ Tray says no printer was found

- Start QZ Tray.
- Confirm the Windows printer is installed on the same computer.
- Compare the exact printer name in Windows and POS.
- Remove extra spaces from the configured POS name.
- Check that the browser is allowed to connect to QZ Tray.

### The wrong printer receives the job

- Give each printer a unique Windows name.
- Configure the exact intended name in the POS.
- Do not rely on the first printer returned by discovery when a preferred
  printer name is available.
- Turn off **Auto-print** on printers that should not receive that document
  type.

### QZ Tray is unavailable but the printer is installed

- Check that QZ Tray is running.
- Check the QZ certificate and private key configuration.
- Restart QZ Tray.
- Restart the application after changing backend secrets.
- Check the browser console for certificate or WebSocket errors.

## Configuration checklist for another project

Copy this checklist when setting up the other POS:

- [ ] Printer has a stable IP address.
- [ ] Printer is added in Windows **Printers & scanners**.
- [ ] Correct Windows printer driver is installed.
- [ ] Windows test page works.
- [ ] Exact Windows printer name recorded.
- [ ] Printer name added to the application's printer configuration.
- [ ] Printer IP added to the application.
- [ ] Printer port added, usually `9100`.
- [ ] Printer type selected: KOT, Bill, or Label.
- [ ] Auto-print enabled where required.
- [ ] QZ Tray installed on the printing computer.
- [ ] QZ Tray is running.
- [ ] QZ certificate configured in the backend.
- [ ] QZ private key configured only in the backend.
- [ ] QZ Tray connection check passes.
- [ ] POS test print passes.
- [ ] KOT test passes.
- [ ] Bill/invoice test passes.