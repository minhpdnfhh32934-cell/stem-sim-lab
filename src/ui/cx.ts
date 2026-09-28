/** Joins truthy class names. Tiny replacement for the `clsx` package. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
