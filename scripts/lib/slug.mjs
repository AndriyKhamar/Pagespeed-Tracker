export function slugify(url) {
  return url
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
