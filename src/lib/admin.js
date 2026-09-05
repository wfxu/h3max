// Operators are identified by e-mail via the ADMIN_EMAILS env var (comma separated).
export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email) {
  if (!email || typeof email !== "string") return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
