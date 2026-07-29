export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/iphone|android|mobile/i.test(userAgent)) return "Mobile browser";
  if (/ipad|tablet/i.test(userAgent)) return "Tablet browser";
  return "Desktop browser";
}
