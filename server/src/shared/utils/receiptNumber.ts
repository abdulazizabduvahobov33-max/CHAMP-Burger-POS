/** Human-friendly receipt number derived from a Sale's cuid — last 6 characters, uppercased.
 * Used by both sale.service.ts (a seller's own order history) and report.service.ts (admin-wide
 * sales list/detail), which previously each defined an identical copy of this function. */
export function shortReceiptNumber(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}
