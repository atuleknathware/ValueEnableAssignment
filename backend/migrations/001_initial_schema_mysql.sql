-- Initial Relational Schema for Benefit Illustration Module
-- Compatible with MySQL 8.0+

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    dob_encrypted TEXT NOT NULL,
    mobile_encrypted TEXT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    policy_name VARCHAR(255) DEFAULT 'Traditional Endowment Benefit Policy',
    sum_assured DECIMAL(15, 2) NOT NULL,
    modal_premium DECIMAL(15, 2) NOT NULL,
    premium_frequency VARCHAR(20) NOT NULL DEFAULT 'Yearly',
    pt INT NOT NULL,
    ppt INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_policies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_pt_ppt CHECK (pt > ppt),
    INDEX idx_policies_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS illustrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    policy_id INT NULL,
    customer_age INT NOT NULL,
    total_premiums_paid DECIMAL(15, 2) NOT NULL,
    maturity_benefit DECIMAL(15, 2) NOT NULL,
    total_bonus_accrued DECIMAL(15, 2) NOT NULL,
    irr_percentage DECIMAL(8, 4) NULL,
    calculation_metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_illustrations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_illustrations_policy FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL,
    INDEX idx_illustrations_user_id (user_id),
    INDEX idx_illustrations_policy_id (policy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS illustration_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    illustration_id INT NOT NULL,
    policy_year INT NOT NULL,
    premium DECIMAL(15, 2) NOT NULL,
    sum_assured DECIMAL(15, 2) NOT NULL,
    bonus_rate DECIMAL(8, 4) NOT NULL,
    bonus_amount DECIMAL(15, 2) NOT NULL,
    total_benefit DECIMAL(15, 2) NOT NULL,
    net_cashflow DECIMAL(15, 2) NOT NULL,
    CONSTRAINT fk_schedules_illustration FOREIGN KEY (illustration_id) REFERENCES illustrations(id) ON DELETE CASCADE,
    CONSTRAINT uq_illustration_year UNIQUE (illustration_id, policy_year),
    INDEX idx_illustration_schedules_ill_year (illustration_id, policy_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bulk_jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_records INT DEFAULT 0,
    processed_records INT DEFAULT 0,
    successful_records INT DEFAULT 0,
    failed_records INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bulk_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_bulk_jobs_user_id (user_id),
    INDEX idx_bulk_jobs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bulk_job_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL,
    row_index INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    input_data JSON NULL,
    output_data JSON NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bulk_records_job FOREIGN KEY (job_id) REFERENCES bulk_jobs(id) ON DELETE CASCADE,
    INDEX idx_bulk_job_records_job_id (job_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

