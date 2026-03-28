/**
 * Linear PCA scores in 2D for row-wise samples (each row = one embedding).
 * Uses the Gram matrix Xc Xc^T (n×n) so it stays feasible when embedding dim d ≫ n.
 */

function dotRows(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let s = 0;
  for (let k = 0; k < len; k++) s += a[k] * b[k];
  return s;
}

function centerRows(rows: number[][]): number[][] {
  if (!rows.length) return [];
  const d = rows[0].length;
  const means = new Array(d).fill(0);
  for (const r of rows) {
    for (let j = 0; j < d; j++) means[j] += r[j];
  }
  for (let j = 0; j < d; j++) means[j] /= rows.length;
  return rows.map((r) => r.map((v, j) => v - means[j]));
}

function symMatVec(S: number[][], v: number[]): number[] {
  const n = v.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += S[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

function vecNorm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function vecNormalizeInPlace(v: number[]): void {
  const n = vecNorm(v) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
}

/** Largest eigenpair of symmetric S (power iteration). */
function dominantEigenpair(S: number[][]): { lambda: number; v: number[] } {
  const n = S.length;
  const v = new Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.sin(i * 1.732 + 0.41);
  vecNormalizeInPlace(v);
  for (let iter = 0; iter < 120; iter++) {
    const w = symMatVec(S, v);
    const nw = vecNorm(w) || 1;
    for (let i = 0; i < n; i++) v[i] = w[i] / nw;
  }
  const Sv = symMatVec(S, v);
  const lambda = v.reduce((s, vi, i) => s + vi * Sv[i], 0);
  return { lambda: Math.max(lambda, 0), v: [...v] };
}

function deflateSymmetric(S: number[][], lambda: number, v: number[]): number[][] {
  const n = S.length;
  return S.map((row, i) => row.map((_, j) => S[i][j] - lambda * v[i] * v[j]));
}

function gramMatrix(X: number[][]): number[][] {
  const n = X.length;
  const S: number[][] = Array(n)
    .fill(0)
    .map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const g = dotRows(X[i], X[j]);
      S[i][j] = g;
      S[j][i] = g;
    }
  }
  return S;
}

/**
 * Returns n points in 2D (PCA scores). Row order matches `rows`.
 */
export function pca2DScores(rows: number[][]): [number, number][] {
  if (rows.length === 0) return [];
  if (rows.length === 1) return [[0, 0]];

  const d0 = rows[0].length;
  if (!d0 || rows.some((r) => r.length !== d0)) {
    return rows.map(() => [0, 0]);
  }

  const X = centerRows(rows);
  const S = gramMatrix(X);
  const { lambda: lam1, v: v1 } = dominantEigenpair(S);
  const S2 = deflateSymmetric(S, lam1, v1);

  let v2 = new Array(X.length);
  for (let i = 0; i < v2.length; i++) v2[i] = Math.cos(i * 1.414 + 0.73);
  let dot = v2.reduce((s, x, i) => s + x * v1[i], 0);
  for (let i = 0; i < v2.length; i++) v2[i] -= dot * v1[i];
  vecNormalizeInPlace(v2);
  for (let iter = 0; iter < 80; iter++) {
    const w = symMatVec(S2, v2);
    dot = w.reduce((s, x, i) => s + x * v1[i], 0);
    for (let i = 0; i < v2.length; i++) w[i] -= dot * v1[i];
    vecNormalizeInPlace(w);
    v2 = w;
  }
  const Sv2 = symMatVec(S2, v2);
  let lam2 = v2.reduce((s, vi, i) => s + vi * Sv2[i], 0);
  lam2 = Math.max(lam2, 0);

  const eps = 1e-12;
  const s1 = Math.sqrt(Math.max(lam1, eps));
  const s2 = Math.sqrt(Math.max(lam2, eps));

  return X.map((_, i) => [s1 * v1[i], s2 * v2[i]]);
}
