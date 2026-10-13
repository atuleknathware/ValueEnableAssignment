const db = require('../config/database');

/**
 * Saves a policy and its calculated illustration schedule in database
 */
async function saveIllustration(userId, illustrationData) {
  const { customer, policy, schedule, policyName = 'Traditional Benefit Policy' } = illustrationData;

  // 1. Insert Policy
  const policyQuery = `
    INSERT INTO policies (user_id, policy_name, sum_assured, modal_premium, premium_frequency, pt, ppt)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
  `;

  const policyRes = await db.query(policyQuery, [
    userId,
    policyName,
    policy.sumAssured,
    policy.modalPremium,
    policy.premiumFrequency,
    policy.pt,
    policy.ppt,
  ]);
  const policyId = policyRes.rows[0].id;

  // 2. Insert Illustration
  const illustrationQuery = `
    INSERT INTO illustrations (
      user_id, policy_id, customer_age, total_premiums_paid,
      maturity_benefit, total_bonus_accrued, irr_percentage, calculation_metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, created_at;
  `;

  const meta = {
    gender: customer.gender,
    bonusStrategy: policy.bonusStrategy,
    formulaBasis: 'assignment_reference_sample (1).xlsm',
  };

  const illRes = await db.query(illustrationQuery, [
    userId,
    policyId,
    customer.age,
    policy.totalPremiumsPaid,
    policy.maturityBenefit,
    policy.totalBonusAccrued,
    policy.irrPercentage,
    JSON.stringify(meta),
  ]);
  const illustrationId = illRes.rows[0].id;
  const createdAt = illRes.rows[0].created_at;

  // 3. Batch Insert Schedule Rows
  for (const row of schedule) {
    const scheduleQuery = `
      INSERT INTO illustration_schedules (
        illustration_id, policy_year, premium, sum_assured,
        bonus_rate, bonus_amount, total_benefit, net_cashflow
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `;
    await db.query(scheduleQuery, [
      illustrationId,
      row.policyYear,
      row.premium,
      row.sumAssured,
      row.bonusRate,
      row.bonusAmount,
      row.totalBenefit,
      row.netCashflow,
    ]);
  }

  return {
    id: illustrationId,
    policyId,
    userId,
    customer,
    policy,
    schedule,
    createdAt,
  };
}

/**
 * Gets paginated calculation history for a specific user
 */
async function getUserIllustrations(userId, page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const countQuery = `SELECT COUNT(*) FROM illustrations WHERE user_id = $1;`;
  const countRes = await db.query(countQuery, [userId]);
  const total = parseInt(countRes.rows[0].count, 10);

  const queryText = `
    SELECT 
      i.id, i.customer_age, i.total_premiums_paid, i.maturity_benefit, 
      i.total_bonus_accrued, i.irr_percentage, i.created_at,
      p.policy_name, p.sum_assured, p.modal_premium, p.premium_frequency, p.pt, p.ppt
    FROM illustrations i
    LEFT JOIN policies p ON i.policy_id = p.id
    WHERE i.user_id = $1
    ORDER BY i.created_at DESC
    LIMIT $2 OFFSET $3;
  `;

  const result = await db.query(queryText, [userId, limit, offset]);

  return {
    data: result.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Gets a single illustration by ID, scoped to user
 */
async function getIllustrationById(id, userId) {
  const illQuery = `
    SELECT 
      i.id, i.user_id, i.customer_age, i.total_premiums_paid, i.maturity_benefit, 
      i.total_bonus_accrued, i.irr_percentage, i.calculation_metadata, i.created_at,
      p.policy_name, p.sum_assured, p.modal_premium, p.premium_frequency, p.pt, p.ppt
    FROM illustrations i
    LEFT JOIN policies p ON i.policy_id = p.id
    WHERE i.id = $1 AND i.user_id = $2;
  `;

  const illRes = await db.query(illQuery, [id, userId]);
  if (illRes.rows.length === 0) return null;

  const ill = illRes.rows[0];

  // Fetch schedule
  const schedQuery = `
    SELECT policy_year, premium, sum_assured, bonus_rate, bonus_amount, total_benefit, net_cashflow
    FROM illustration_schedules
    WHERE illustration_id = $1
    ORDER BY policy_year ASC;
  `;
  const schedRes = await db.query(schedQuery, [id]);

  const meta = typeof ill.calculation_metadata === 'string'
    ? JSON.parse(ill.calculation_metadata || '{}')
    : (ill.calculation_metadata || {});

  return {
    id: ill.id,
    customer: {
      age: ill.customer_age,
      gender: meta.gender || 'M',
    },
    policy: {
      policyName: ill.policy_name,
      sumAssured: Number(ill.sum_assured),
      modalPremium: Number(ill.modal_premium),
      premiumFrequency: ill.premium_frequency,
      pt: ill.pt,
      ppt: ill.ppt,
      totalPremiumsPaid: Number(ill.total_premiums_paid),
      maturityBenefit: Number(ill.maturity_benefit),
      totalBonusAccrued: Number(ill.total_bonus_accrued),
      irrPercentage: ill.irr_percentage ? Number(ill.irr_percentage) : null,
    },
    schedule: schedRes.rows.map((r) => ({
      policyYear: r.policy_year,
      premium: Number(r.premium),
      sumAssured: Number(r.sum_assured),
      bonusRate: Number(r.bonus_rate),
      bonusAmount: Number(r.bonus_amount),
      totalBenefit: Number(r.total_benefit),
      netCashflow: Number(r.net_cashflow),
    })),
    createdAt: ill.created_at,
  };
}

/**
 * Creates bulk job
 */
async function createBulkJob(jobId, userId, fileName, totalRecords) {
  const queryText = `
    INSERT INTO bulk_jobs (id, user_id, file_name, status, total_records)
    VALUES ($1, $2, $3, 'PENDING', $4)
    RETURNING *;
  `;
  const res = await db.query(queryText, [jobId, userId, fileName, totalRecords]);
  return res.rows[0];
}

/**
 * Updates bulk job status and counts
 */
async function updateBulkJob(jobId, updates) {
  const { status, processed, successful, failed, errorMessage } = updates;
  const queryText = `
    UPDATE bulk_jobs
    SET 
      status = COALESCE($2, status),
      processed_records = COALESCE($3, processed_records),
      successful_records = COALESCE($4, successful_records),
      failed_records = COALESCE($5, failed_records),
      error_message = COALESCE($6, error_message),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;
  const res = await db.query(queryText, [jobId, status, processed, successful, failed, errorMessage]);
  return res.rows[0];
}

/**
 * Gets bulk job by ID
 */
async function getBulkJob(jobId, userId) {
  const queryText = `
    SELECT * FROM bulk_jobs WHERE id = $1 AND user_id = $2;
  `;
  const res = await db.query(queryText, [jobId, userId]);
  return res.rows[0] || null;
}

module.exports = {
  saveIllustration,
  getUserIllustrations,
  getIllustrationById,
  createBulkJob,
  updateBulkJob,
  getBulkJob,
};

