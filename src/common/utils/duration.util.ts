export function parseDurationToSeconds(input: string): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(input.trim());
  if (!m) throw new Error(`Invalid duration: "${input}"`);

  const value = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();

  switch (unit) {
    case 'ms':
      return Math.floor(value / 1000);
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}