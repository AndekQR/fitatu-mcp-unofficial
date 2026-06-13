export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
