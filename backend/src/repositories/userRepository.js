const db = require('../config/database');
const { encrypt, decrypt, maskMobile, maskDob, maskName } = require('../utils/crypto');

/**
 * Creates a new user with encrypted PII (name, DOB, mobile)
 */
async function createUser({ fullName, dob, mobile, email, passwordHash }) {
  const nameEncrypted = encrypt(fullName);
  const dobEncrypted = encrypt(dob);
  const mobileEncrypted = encrypt(mobile);

  const queryText = `
    INSERT INTO users (full_name, dob_encrypted, mobile_encrypted, email, password_hash)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, full_name, email, created_at;
  `;

  const result = await db.query(queryText, [
    nameEncrypted,
    dobEncrypted,
    mobileEncrypted,
    email.toLowerCase().trim(),
    passwordHash,
  ]);

  return result.rows[0];
}

/**
 * Finds user by email (for authentication)
 */
async function findUserByEmail(email) {
  const queryText = `
    SELECT id, full_name, dob_encrypted, mobile_encrypted, email, password_hash, created_at
    FROM users
    WHERE email = $1;
  `;

  const result = await db.query(queryText, [email.toLowerCase().trim()]);
  if (result.rows.length === 0) return null;

  return result.rows[0];
}

/**
 * Finds user by ID and decrypts/masks PII (name, DOB, mobile)
 */
async function findUserById(id, { unmask = false } = {}) {
  const queryText = `
    SELECT id, full_name, dob_encrypted, mobile_encrypted, email, created_at
    FROM users
    WHERE id = $1;
  `;

  const result = await db.query(queryText, [id]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const nameDecrypted = decrypt(row.full_name) || row.full_name;
  const dobDecrypted = decrypt(row.dob_encrypted);
  const mobileDecrypted = decrypt(row.mobile_encrypted);

  return {
    id: row.id,
    fullName: unmask ? nameDecrypted : maskName(nameDecrypted),
    rawFullName: nameDecrypted,
    email: row.email,
    dob: unmask ? dobDecrypted : maskDob(dobDecrypted),
    rawDob: dobDecrypted, // For internal calculations
    mobile: unmask ? mobileDecrypted : maskMobile(mobileDecrypted),
    createdAt: row.created_at,
  };
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
};

