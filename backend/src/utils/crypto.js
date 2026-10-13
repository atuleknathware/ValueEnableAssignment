const crypto = require('crypto');
const config = require('../config');

// Derive consistent 32-byte (256-bit) buffer from configured key
function getDerivedKey() {
  const rawKey = config.encryption.key;
  if (typeof rawKey === 'string' && rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  // Fallback to SHA-256 hash to ensure exact 32 bytes
  return crypto.createHash('sha256').update(String(rawKey)).digest();
}

/**
 * Encrypt sensitive customer data using AES-256-GCM
 * @param {string|number} plaintext
 * @returns {string} iv:authTag:ciphertext (hex-encoded)
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const text = String(plaintext);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * @param {string} payload - iv:authTag:ciphertext
 * @returns {string} plaintext
 */
function decrypt(payload) {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) {
    return payload;
  }
  try {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      return payload;
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    // Return masked or null on decryption failure to prevent leaking errors
    return null;
  }
}

/**
 * Mask mobile number, showing only the last 4 digits
 * e.g., "9876543210" -> "******3210"
 */
function maskMobile(mobile) {
  if (!mobile) return '';
  const str = String(mobile).replace(/\D/g, '');
  if (str.length <= 4) return str;
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

/**
 * Mask date of birth, showing only the day or masked year/month
 * e.g., "1999-12-12" -> "****-**-12"
 */
function maskDob(dob) {
  if (!dob) return '';
  const str = String(dob);
  const parts = str.split('-');
  if (parts.length === 3) {
    return `****-**-${parts[2]}`;
  }
  return '****-**-**';
}

/**
 * Mask email address
 * e.g., "johndoe@example.com" -> "j***e@example.com"
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  return `${user[0]}${'*'.repeat(user.length - 2)}${user.slice(-1)}@${domain}`;
}

module.exports = {
  encrypt,
  decrypt,
  maskMobile,
  maskDob,
  maskEmail,
};

