export function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isValidSlug(slug) {
  return /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug || "");
}
