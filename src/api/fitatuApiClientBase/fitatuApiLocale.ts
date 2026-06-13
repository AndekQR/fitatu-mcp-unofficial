export function toLocaleSegment(locale: string): string {
  return locale.replaceAll("_", "-").toLowerCase();
}

export function nonEmptyString(
  value: string | null | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
