import qz from "qz-tray";

type QzPrinterCheck = {
  printers: string[];
  defaultPrinter: string | null;
};

let securityConfigured = false;

const ESC = "\x1b";
const GS = "\x1d";

function configureQzSecurity() {
  if (securityConfigured) return;

  qz.security.setCertificatePromise((resolve, reject) => {
    fetch("/api/qz-certificate", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || "QZ certificate is not configured.");
        }
        return response.text();
      })
      .then(resolve)
      .catch(reject);
  });

  qz.security.setSignaturePromise((dataToSign) => (resolve, reject) => {
    fetch("/api/sign-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ request: dataToSign }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || "QZ message signing failed.");
        }
        const body = await response.json();
        if (!body.signature) throw new Error("QZ signing response was empty.");
        return body.signature;
      })
      .then(resolve)
      .catch(reject);
  });

  securityConfigured = true;
}

export async function checkQzTray(): Promise<QzPrinterCheck> {
  configureQzSecurity();

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  const [printerResult, defaultPrinter] = await Promise.all([
    qz.printers.find(),
    qz.printers.getDefault(),
  ]);

  const printers = Array.isArray(printerResult)
    ? printerResult
    : printerResult
      ? [printerResult]
      : [];

  return {
    printers,
    defaultPrinter: defaultPrinter || null,
  };
}

export async function printRawReceipt(receipt: string, printerName?: string) {
  configureQzSecurity();

  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  const printer = printerName || (await qz.printers.getDefault());
  if (!printer) {
    throw new Error("No default Windows printer is configured.");
  }

  const config = qz.configs.create(printer, {
    colorType: "blackwhite",
    copies: 1,
    density: "default",
    margins: 0,
    units: "mm",
    size: { width: 80, height: 0 },
  });

  await qz.print(config, [
    {
      type: "raw",
      format: "plain",
      data: `${ESC}@${receipt}${GS}V\x00`,
    },
  ]);

  return printer;
}