export const VINTED_SERVICE_URL = process.env.VINTED_SERVICE_URL || "http://localhost:4000";

export function createVintedServiceHeaders(userId: string, includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    "X-User-ID": userId,
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  if (process.env.API_KEY) {
    headers["X-API-Key"] = process.env.API_KEY;
  }

  return headers;
}
