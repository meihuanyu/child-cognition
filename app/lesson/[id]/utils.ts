export function extractS3KeyFromUrl(input: string | null): string | null {
  if (!input) return null;

  try {
    const parsed = new URL(input);
    const key = parsed.pathname.replace(/^\/+/, '');
    return key || null;
  } catch {
    const normalized = input.replace(/^\/+/, '');
    return normalized || null;
  }
}

export function buildFileProxyPath(key: string): string {
  const encoded = key
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment));

  return `/api/files/${encoded.join('/')}`;
}

