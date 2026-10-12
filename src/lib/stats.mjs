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
