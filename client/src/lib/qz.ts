import qz from "qz-tray";

type QzPrinterCheck = {
  printers: string[];
  defaultPrinter: string | null;
};

let securityConfigured = false;

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