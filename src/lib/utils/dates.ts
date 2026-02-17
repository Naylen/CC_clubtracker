/**
 * Format a UTC Date for display in US Eastern timezone.
 */
export function formatDateET(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a UTC Date with time for display in US Eastern timezone.
 */
export function formatDateTimeET(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format cents as US currency string.
 * 15000 → "$150.00"
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Format a time string (HH:MM or HH:MM:SS) for human display.
 * "08:00:00" → "8:00 AM", "13:30" → "1:30 PM"
 */
export function formatTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Get Jan 1 of a given year at midnight UTC.
 */
export function janFirst(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

/**
 * Get Jan 31 at 23:59:59 ET (converted to UTC) for a given year.
 * ET is UTC-5 in winter, so 23:59 ET = 04:59 UTC next day.
 */
export function janThirtyFirstDeadline(year: number): Date {
  // Jan 31 23:59:59 ET = Feb 1 04:59:59 UTC (EST offset)
  return new Date(Date.UTC(year, 1, 1, 4, 59, 59));
}
