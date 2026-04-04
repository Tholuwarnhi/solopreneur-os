/**
 * Read a fetch Response as JSON. If the body is HTML/plain text (common when
 * the API route crashes or the proxy returns an error page), parsing fails — we return null and the raw text.
 */
export async function readResponseJson<T extends Record<string, unknown>>(
  resp: Response
): Promise<{ data: T | null; raw: string }> {
  const raw = await resp.text();
  const trimmed = raw.trim();
  if (!trimmed) return { data: null, raw: "" };
  try {
    return { data: JSON.parse(trimmed) as T, raw };
  } catch {
    return { data: null, raw };
  }
}

export function apiErrorMessage(
  data: { error?: string } | null,
  raw: string,
  fallback: string
): string {
  if (data?.error && typeof data.error === "string") return data.error;
  const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 280);
  if (snippet) return snippet;
  return fallback;
}
