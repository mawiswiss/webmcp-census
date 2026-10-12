export function stripPage(page) {
  if (!page.smoke) return page;
  const runs = page.smoke.runs.map(({ result, args, ...rest }) => rest);
  return { ...page, smoke: { ...page.smoke, runs } };
}
