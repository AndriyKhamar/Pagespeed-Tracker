export function validateConfig(cfg) {
  const errs = [];
  if (!cfg || !Array.isArray(cfg.urls) || cfg.urls.length === 0) {
    errs.push('config.urls must be a non-empty array');
  } else {
    for (const [i, entry] of cfg.urls.entries()) {
      try { new URL(entry.url); } catch { errs.push(`urls[${i}].url is not a valid URL: ${entry?.url}`); }
    }
  }
  for (const k of ['mobile', 'desktop']) {
    if (typeof cfg?.thresholds?.[k] !== 'number') errs.push(`thresholds.${k} must be a number`);
  }
  return errs;
}
