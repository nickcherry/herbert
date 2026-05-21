export function clamp({
  value,
  min,
  max,
}: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
}): number {
  return Math.min(max, Math.max(min, value));
}
