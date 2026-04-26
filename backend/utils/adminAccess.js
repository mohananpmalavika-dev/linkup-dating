const DEFAULT_ADMIN_EMAILS = ['mgdhanyamohan@gmail.com'];

const normalizeAdminEmail = (value = '') => String(value || '').trim().toLowerCase();

const getConfiguredAdminEmails = () => {
  const envEmails = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeAdminEmail)
    .filter(Boolean);

  return new Set(
    [...DEFAULT_ADMIN_EMAILS, ...envEmails]
      .map(normalizeAdminEmail)
      .filter(Boolean)
  );
};

const isConfiguredAdminEmail = (email = '') =>
  getConfiguredAdminEmails().has(normalizeAdminEmail(email));

const syncConfiguredAdminForEmail = async (db, email = '') => {
  const normalizedEmail = normalizeAdminEmail(email);

  if (!normalizedEmail || !isConfiguredAdminEmail(normalizedEmail)) {
    return null;
  }

  return db.query(
    `UPDATE users
     SET is_admin = TRUE,
         updated_at = CURRENT_TIMESTAMP
     WHERE LOWER(email) = LOWER($1)
     RETURNING id, email, is_admin`,
    [normalizedEmail]
  );
};

module.exports = {
  DEFAULT_ADMIN_EMAILS,
  getConfiguredAdminEmails,
  isConfiguredAdminEmail,
  normalizeAdminEmail,
  syncConfiguredAdminForEmail
};
