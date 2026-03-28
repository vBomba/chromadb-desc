/** Cosine distance = 1 - cos; lower is more similar. */
export function cosineDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  na = Math.sqrt(na);
  nb = Math.sqrt(nb);
  if (na < 1e-12 || nb < 1e-12) return 1;
  const cos = Math.max(-1, Math.min(1, dot / (na * nb)));
  return 1 - cos;
}
