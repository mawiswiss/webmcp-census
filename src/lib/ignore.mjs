const COMMENTS = /#[^\n]*/g;

function isReadDocument(op) {
  if (typeof op?.query !== "string") return false;
  const doc = op.query.replace(COMMENTS, "").trim();
  return /^(query\b|fragment\b|\{)/.test(doc) && !/(^|\})\s*(mutation|subscription)\b/.test(doc);
}

export function isGraphqlRead(request) {
  if (request.method.toUpperCase() !== "POST" || typeof request.body !== "string") return false;
  let parsed;
  try {
    parsed = JSON.parse(request.body);
  } catch {
    return false;
  }
  const ops = Array.isArray(parsed) ? parsed : [parsed];
  return ops.length > 0 && ops.every(isReadDocument);
}
