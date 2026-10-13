-- Initial Relational Schema for Benefit Illustration Module
-- Compatible with PostgreSQL 12+

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    dob_encrypted TEXT NOT NULL,
    mobile_encrypted TEXT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS policies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_name VARCHAR(255) DEFAULT 'Traditional Endowment Benefit Policy',
    sum_assured NUMERIC(15, 2) NOT NULL,
    modal_premium NUMERIC(15, 2) NOT NULL,
    premium_frequency VARCHAR(20) NOT NULL DEFAULT 'Yearly',
    pt INTEGER NOT NULL,
    ppt INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pt_ppt CHECK (pt > ppt)
);

CREATE INDEX IF NOT EXISTS idx_policies_user_id ON policies(user_id);

CREATE TABLE IF NOT EXISTS illustrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_id INTEGER REFERENCES policies(id) ON DELETE SET NULL,
    customer_age INTEGER NOT NULL,
    total_premiums_paid NUMERIC(15, 2) NOT NULL,
    maturity_benefit NUMERIC(15, 2) NOT NULL,
    total_bonus_accrued NUMERIC(15, 2) NOT NULL,
    irr_percentage NUMERIC(8, 4),
    calculation_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_illustrations_user_id ON illustrations(user_id);
CREATE INDEX IF NOT EXISTS idx_illustrations_policy_id ON illustrations(policy_id);

CREATE TABLE IF NOT EXISTS illustration_schedules (
    id SERIAL PRIMARY KEY,
    illustration_id INTEGER NOT NULL REFERENCES illustrations(id) ON DELETE CASCADE,
    policy_year INTEGER NOT NULL,
    premium NUMERIC(15, 2) NOT NULL,
    sum_assured NUMERIC(15, 2) NOT NULL,
    bonus_rate NUMERIC(8, 4) NOT NULL,
    bonus_amount NUMERIC(15, 2) NOT NULL,
    total_benefit NUMERIC(15, 2) NOT NULL,
    net_cashflow NUMERIC(15, 2) NOT NULL,
    CONSTRAINT uq_illustration_year UNIQUE (illustration_id, policy_year)
);

CREATE INDEX IF NOT EXISTS idx_illustration_schedules_ill_year ON illustration_schedules(illustration_id, policy_year);

CREATE TABLE IF NOT EXISTS bulk_jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_user_id ON bulk_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_jobs(status);

CREATE TABLE IF NOT EXISTS bulk_job_records (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL REFERENCES bulk_jobs(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_job_records_job_id ON bulk_job_records(job_id, status);

