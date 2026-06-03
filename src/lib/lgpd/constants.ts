export const LGPD_POLICY_VERSION = "2026-06-01";

export function hashUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  let h = 0;
  for (let i = 0; i < ua.length; i++) {
    h = (Math.imul(31, h) + ua.charCodeAt(i)) | 0;
  }
  return `ua-${Math.abs(h).toString(16)}`;
}
