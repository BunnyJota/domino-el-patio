export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function genCode(
  len = 4,
  chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
): string {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function nowStr(): string {
  return new Date().toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
