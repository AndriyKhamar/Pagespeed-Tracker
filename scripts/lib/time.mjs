export function isoStamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function fileStamp(date) {
  return isoStamp(date).replace(/:/g, '-');
}

export function windowStart(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
}
