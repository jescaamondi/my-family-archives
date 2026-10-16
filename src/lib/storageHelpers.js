export function mapStorageError(err) {
  const msg = (err && (err.message || err.msg)) || String(err || "");
  if (/row-level security|violates row-level security/i.test(msg))
    return "Upload blocked by storage permissions. Sign in or contact the family administrator to enable uploads.";
  if (/permission|permission denied|forbidden|unauthorized|401|403/i.test(msg))
    return "Upload blocked by permissions. Please sign in and try again, or ask the family administrator for access.";
  return msg;
}

export default mapStorageError;
