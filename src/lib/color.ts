const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** '#3A332B' + 0.5 → 'rgba(58, 51, 43, 0.5)'. Non-hex input is returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const match = color.trim().match(HEX);
  if (!match) return color;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  const value = Number.parseInt(hex, 16);
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${clamped})`;
}
