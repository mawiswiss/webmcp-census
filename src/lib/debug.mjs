export const debug = process.env.CENSUS_DEBUG
  ? (...parts) => console.error(`[census ${new Date().toISOString().slice(11, 23)}]`, ...parts)
  : () => {};
