declare module "qz-tray" {
  type Resolver = (value?: string) => void;
  type Rejecter = (reason?: unknown) => void;
  type QzConfig = unknown;

  interface QzApi {
    websocket: {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      isActive: () => boolean;
    };
    printers: {
      find: (query?: string) => Promise<string | string[]>;
      getDefault: () => Promise<string>;
    };
    configs: {
      create: (printer: string, options?: Record<string, unknown>) => QzConfig;
    };
    print: (
      config: QzConfig,
      data: Array<{ type: "raw"; format: "plain"; data: string }>,
    ) => Promise<unknown>;
    security: {
      setCertificatePromise: (
        handler: (resolve: Resolver, reject: Rejecter) => void,
      ) => void;
      setSignaturePromise: (
        factory: (dataToSign: string) => (resolve: Resolver, reject: Rejecter) => void,
      ) => void;
    };
  }

  const qz: QzApi;
  export default qz;
}