// filename form: 2026-07-06T14-00-00Z.json  ->  ISO 2026-07-06T14:00:00Z
export function fileNameToDate(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.json$/);
  if (!m) return null;
  return new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
}

export function pruneRunFiles(files, startDate) {
  return files.filter((f) => {
    const d = fileNameToDate(f);
    return d && d < startDate;
  });
}
