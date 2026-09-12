declare module "qz-tray" {
  type Resolver = (value?: string) => void;
  type Rejecter = (reason?: unknown) => void;

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