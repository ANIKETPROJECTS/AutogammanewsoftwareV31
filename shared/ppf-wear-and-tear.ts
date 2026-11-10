type PpfServiceItem = {
  wearAndTearFree?: boolean;
  price?: number | string | null;
};

export function isFreePpfWearAndTearService(
  ppfs?: readonly PpfServiceItem[] | null,
): boolean {
  if (!ppfs?.length) return false;
  return ppfs.some(ppf => ppf.wearAndTearFree) ||
    ppfs.every(ppf => Number(ppf.price ?? 0) <= 0);
}
