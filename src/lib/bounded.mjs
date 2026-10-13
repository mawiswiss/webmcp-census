export function boundedCall(call, limitMs) {
  const hung = new Set();
  return async (name, args) => {
    if (hung.has(name)) throw new Error(`skipped: "${name}" did not answer an earlier call within ${limitMs} ms`);
    const started = Date.now();
    let timer;
    const limit = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("limit")), limitMs);
    });
    try {
      return await Promise.race([call(name, args, { cancelAfter: limitMs }), limit]);
    } catch (err) {
      if (Date.now() - started < limitMs) throw err;
      hung.add(name);
      throw new Error(`call-timeout: "${name}" did not answer within ${limitMs} ms`);
    } finally {
      clearTimeout(timer);
    }
  };
}

export function withBudget(call, deadline, now = Date.now) {
  return (name, args, options) => {
    if (now() > deadline) return Promise.reject(new Error(`budget: host time budget used up before "${name}"`));
    return call(name, args, options);
  };
}

export function within(promise, ms) {
  let timer;
  const limit = new Promise((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  return Promise.race([promise.then(() => "done", () => "failed"), limit]).finally(() => clearTimeout(timer));
}

export function orFail(promise, ms, label) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not finish within ${ms} ms`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}
