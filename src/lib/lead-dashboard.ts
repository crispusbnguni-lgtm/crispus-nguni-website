export const LEADS_PER_PAGE = 10;

export function singleQueryValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export function parseLeadPage(value: string | string[] | undefined): number {
  const raw = singleQueryValue(value);
  if (!/^\d{1,8}$/.test(raw)) return 1;

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1
    ? Math.min(parsed, 100_000)
    : 1;
}

export function resolveLeadPage(requestedPage: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / LEADS_PER_PAGE));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), totalPages);

  return {
    page,
    totalPages,
    skip: (page - 1) * LEADS_PER_PAGE,
  };
}
