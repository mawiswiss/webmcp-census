export const median = (xs) => {
  const s = xs.filter((x) => typeof x === "number" && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const mean = (xs) => {
  const s = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return s.length ? Math.round((100 * s.reduce((a, b) => a + b, 0)) / s.length) / 100 : null;
};

export const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);

const ranks = (xs) => {
  const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const out = Array(xs.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) out[order[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
};

export const spearman = (xs, ys) => {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const a = ranks(xs), b = ranks(ys);
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  const cov = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
  const sa = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0)), sb = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
  return sa && sb ? Math.round((100 * cov) / sa / sb) / 100 : null;
};
