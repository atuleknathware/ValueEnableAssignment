require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'benefit_illustration_jwt_super_secret_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Encryption (AES-256-GCM)
  encryption: {
    // 32-byte hex key (64 hex characters) or passphrase
    key: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },

  // Database
  db: {
    type: process.env.DB_TYPE || 'mysql',
    connectionString: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || process.env.PGPORT, 10) || 3306,
    database: process.env.DB_NAME || process.env.PGDATABASE || 'benefit_illustration_db',
    user: process.env.DB_USER || process.env.PGUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    ssl: process.env.DB_SSL === 'true' || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    useMemoryDb: process.env.USE_MEMORY_DB === 'true' || (process.env.NODE_ENV === 'test' && !process.env.USE_REAL_DB),
  },

  // Actuarial Validation Rules
  validation: {
    ppt: {
      min: parseInt(process.env.VALIDATION_PPT_MIN, 10) || 5,
      max: parseInt(process.env.VALIDATION_PPT_MAX, 10) || 10,
    },
    pt: {
      min: parseInt(process.env.VALIDATION_PT_MIN, 10) || 10,
      max: parseInt(process.env.VALIDATION_PT_MAX, 10) || 20,
    },
    premium: {
      min: process.env.VALIDATION_PREMIUM_MIN ? parseInt(process.env.VALIDATION_PREMIUM_MIN, 10) : 0,
      max: process.env.VALIDATION_PREMIUM_MAX ? parseInt(process.env.VALIDATION_PREMIUM_MAX, 10) : null,
    },
    sumAssured: {
      minMultiplier: parseInt(process.env.VALIDATION_SA_MULTIPLIER, 10) || 10,
      maxLimit: parseInt(process.env.VALIDATION_SA_MAX, 10) || 5000000,
      // Interpretation strategy: 'IRDAI_STANDARD' or 'EXCEL_LITERAL_MIN'
      strategy: process.env.VALIDATION_SA_STRATEGY || 'IRDAI_STANDARD',
    },
    age: {
      min: parseInt(process.env.VALIDATION_AGE_MIN, 10) || 23,
      max: parseInt(process.env.VALIDATION_AGE_MAX, 10) || 56,
    },
    frequencies: ['Yearly', 'Half-Yearly', 'Monthly'],
    genders: ['M', 'F', 'Other'],
  },

  // Illustration Calculation Engine Settings
  illustration: {
    // 'EXCEL_STRICT' (sums all 20 years of bonus like formula C+SUM(E1:E23))
    // 'ACTUARIAL_TERM_BOUND' (sums bonuses accrued up to PT)
    bonusStrategy: process.env.BONUS_ACCUMULATION_STRATEGY || 'EXCEL_STRICT',
  },
};

