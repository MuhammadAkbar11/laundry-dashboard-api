import { dateIndoWIB } from "../configs/date.config";

export interface AggregatedPeriodPoint {
  sortKey: string;
  label: string;
  value: number;
}

/**
 * Bucket payments into daily or monthly bins.
 *
 * Sort key is always ISO-format (YYYY-MM-DD or YYYY-MM) so that chronological
 * ordering is locale-independent. The display label is formatted separately and
 * must never be used as a sort key.
 */
export function aggregateByPeriod(
  payments: Array<{ createdAt: string | Date; totalPrice: bigint | number }>,
  granularity: "day" | "month",
): AggregatedPeriodPoint[] {
  const map = new Map<
    string,
    { sortKey: string; label: string; value: number }
  >();
  for (const p of payments) {
    const d = dateIndoWIB(new Date(p.createdAt));
    const sortKey =
      granularity === "month" ? d.format("YYYY-MM") : d.format("YYYY-MM-DD");
    const displayLabel =
      granularity === "month" ? d.format("MMM YYYY") : d.format("YYYY-MM-DD");
    const existing = map.get(sortKey);
    if (existing) {
      existing.value += Number(p.totalPrice);
    } else {
      map.set(sortKey, { sortKey, label: displayLabel, value: Number(p.totalPrice) });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);
}
