# Customer Data Security & Privacy Architecture

**Module:** Benefit Illustration Engine  
**Standard:** Enterprise Financial / Actuarial Grade Security  

---

## 1. Overview & Threat Model

Benefit Illustration systems handle Personally Identifiable Information (PII) including customer full name, date of birth (DOB), and mobile phone numbers, alongside financial data (premiums and sum assured).

### Primary Security Objectives:
1. **Confidentiality:** Prevent unauthorized exposure of customer PII and credentials both in transit and at rest.
2. **Integrity:** Ensure calculation parameters and illustration outputs cannot be tampered with.
3. **Multi-Tenant Isolation:** Enforce strict access control ensuring users can only access their own policies and illustrations.
4. **Resilience:** Protect the backend API against brute-force authentication attacks, DoS, and memory exhaustion.

---

## 2. Cryptographic Implementation Details

### 2.1 Passwords: Salted bcrypt Hashing
- **Algorithm:** `bcrypt` with salt rounds = 10 (`2^10` iterations).
- **Protection:** Protects against rainbow tables and offline dictionary attacks.
- **Handling:** Plaintext passwords are never logged, never cached, and never returned in API responses or user models.

### 2.2 Application-Layer Field Encryption: AES-256-GCM
- **Encrypted Fields:**
  - Date of Birth (`dob_encrypted`)
  - Mobile Number (`mobile_encrypted`)
- **Cipher:** `aes-256-gcm` (Advanced Encryption Standard in Galois/Counter Mode).
- **Key Derivation:** 256-bit symmetric key (`ENCRYPTION_KEY`) sourced exclusively from environment variables or a secrets manager. If a non-64-hex string is provided, a deterministic SHA-256 digest derives the required 32-byte key buffer.
- **Initialization Vector (IV):** Cryptographically secure pseudo-random 12-byte (96-bit) IV generated per encryption invocation using `crypto.randomBytes(12)`. IV is never reused.
- **Authentication Tag:** 16-byte (128-bit) GCM authentication tag verifying ciphertext authenticity and preventing ciphertext manipulation or bit-flipping attacks.
- **Storage Format:** Stored in PostgreSQL columns as `iv:authTag:ciphertext` in hex encoding.

```
+-----------------------------------------------------------+
| Application Layer Encryption (AES-256-GCM)                |
| +----------------+   +------------------+   +-----------+ |
| | Plaintext DOB  | + | 96-bit Random IV | + | 256-bit K | |
| +----------------+   +------------------+   +-----------+ |
|                           |                               |
|                     [AES-256-GCM]                         |
|                           |                               |
|        Payload: "ivHex : authTagHex : cipherHex"          |
|                           |                               |
|            Stored into PostgreSQL column                  |
+-----------------------------------------------------------+
```

---

## 3. Data Masking Policy

To comply with data privacy regulations (e.g., GDPR, Digital Personal Data Protection Act):
1. **Mobile Numbers:** Displayed in UI and API responses with only the last 4 digits visible:
   - Example: `9876543210` $\rightarrow$ `******3210`.
2. **Date of Birth:** Year and month are masked in public displays:
   - Example: `1999-12-12` $\rightarrow$ `****-**-12`.
3. **Email Addresses:** Masked where appropriate:
   - Example: `rahul.sharma@example.com` $\rightarrow$ `r***a@example.com`.
4. **Logs & Audit Trails:** Raw request bodies containing sensitive fields are never printed to console logs or log files.

---

## 4. Authentication & Authorization

### 4.1 JWT (JSON Web Tokens)
- **Signature Algorithm:** HMAC-SHA256 (`HS256`).
- **Secret:** `JWT_SECRET` loaded from environment variables.
- **Expiration:** Default `24h` token lifetime.
- **Payload:** Contains only non-sensitive identifiers (`userId`, `email`). Does not embed passwords, keys, or raw PII.

### 4.2 Multi-Tenant Data Isolation
- All query endpoints (`GET /api/illustrations`, `GET /api/illustrations/:id`, `GET /api/illustrations/:id/export`) scope queries strictly to the authenticated `req.user.id`:
  ```sql
  SELECT * FROM illustrations WHERE id = $1 AND user_id = $2;
  ```
- Attempting to access an illustration belonging to another user returns a `404 Not Found / Access Denied` response, preventing horizontal privilege escalation.

---

## 5. Network & API Protection

1. **Helmet HTTP Headers:** Sets `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security`.
2. **Rate Limiting:**
   - General API: Max 300 requests per 15-minute window per IP.
   - Authentication Endpoints (`/api/auth/login`, `/api/auth/register`): Max 50 requests per 15 minutes to defeat credential-stuffing attacks.
3. **Payload Size Guard:** Request body size is capped at 1MB to prevent memory exhaustion attacks.
4. **CORS:** Restricted to allowed origins.
5. **SQL Injection Defense:** All queries use parameterized placeholders (`$1, $2, ...`), preventing SQL injection.

