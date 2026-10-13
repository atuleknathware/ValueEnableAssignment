const config = require('../config');
const { calculateAge, validatePolicyInputs } = require('../validators/policyValidator');
const { round, multiply, sum } = require('../utils/currency');

/**
 * Standard 20-Year Bonus Rates from Excel Illustration Sheet (Column D, rows 4 to 23)
 * Sheet 'Illustration' (assignment_reference_sample (1).xlsm)
 */
const STANDARD_BONUS_RATES = [
  0.025, // Year 1: 2.5%
  0.030, // Year 2: 3.0%
  0.035, // Year 3: 3.5%
  0.035, // Year 4: 3.5%
  0.035, // Year 5: 3.5%
  0.035, // Year 6: 3.5%
  0.030, // Year 7: 3.0%
  0.030, // Year 8: 3.0%
  0.030, // Year 9: 3.0%
  0.030, // Year 10: 3.0%
  0.030, // Year 11: 3.0%
  0.025, // Year 12: 2.5%
  0.030, // Year 13: 3.0%
  0.030, // Year 14: 3.0%
  0.025, // Year 15: 2.5%
  0.050, // Year 16: 5.0%
  0.040, // Year 17: 4.0%
  0.045, // Year 18: 4.5%
  0.040, // Year 19: 4.0%
  0.250, // Year 20: 25.0%
];

/**
 * Calculates Net Present Value (NPV) for a given discount rate and cash flows
 * @param {number} rate
 * @param {number[]} cashflows
 * @returns {number}
 */
function calculateNPV(rate, cashflows) {
  return cashflows.reduce((acc, cf, t) => {
    return acc + cf / Math.pow(1 + rate, t);
  }, 0);
}

/**
 * Calculates Internal Rate of Return (IRR) using the Newton-Raphson method
 * with bisection fallback. Matches Excel IRR function behavior.
 *
 * @param {number[]} cashflows - Array of net cashflows [CF0, CF1, ..., CFn]
 * @param {number} [guess=0.1]
 * @param {number} [maxIterations=200]
 * @param {number} [tolerance=1e-8]
 * @returns {number|null} IRR as a decimal (e.g., 0.08415 for 8.415%), or null if invalid
 */
function calculateIRR(cashflows, guess = 0.1, maxIterations = 200, tolerance = 1e-8) {
  if (!cashflows || cashflows.length < 2) return null;

  // Check for at least one sign change; otherwise IRR is mathematically undefined
  const hasPositive = cashflows.some((cf) => cf > 0);
  const hasNegative = cashflows.some((cf) => cf < 0);
  if (!hasPositive || !hasNegative) {
    return null;
  }

  let rate = guess;

  // Newton-Raphson iteration
  for (let iter = 0; iter < maxIterations; iter++) {
    // Avoid rate <= -1 where 1 + rate is zero or negative
    if (rate <= -0.999) {
      rate = -0.99;
    }

    const npv = calculateNPV(rate, cashflows);

    // Calculate derivative d(NPV)/d(rate) = sum(-t * cf / (1+rate)^(t+1))
    let dNPV = 0;
    for (let t = 1; t < cashflows.length; t++) {
      dNPV += (-t * cashflows[t]) / Math.pow(1 + rate, t + 1);
    }

    if (Math.abs(dNPV) < 1e-12) {
      break; // Derivative too flat; fallback to bisection
    }

    const nextRate = rate - npv / dNPV;

    if (Math.abs(nextRate - rate) < tolerance) {
      return round(nextRate, 8);
    }

    // Keep rate in a plausible range
    if (nextRate > 10 || nextRate < -0.99) {
      break; // Diverging; fallback to bisection
    }

    rate = nextRate;
  }

  // Fallback: Bisection Method between -0.9 and 2.0
  let low = -0.9;
  let high = 2.0;
  let npvLow = calculateNPV(low, cashflows);
  let npvHigh = calculateNPV(high, cashflows);

  if (npvLow * npvHigh > 0) {
    // Try wider range
    high = 10.0;
    npvHigh = calculateNPV(high, cashflows);
  }

  if (npvLow * npvHigh <= 0) {
    for (let i = 0; i < 150; i++) {
      const mid = (low + high) / 2;
      const npvMid = calculateNPV(mid, cashflows);
      if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
        return round(mid, 8);
      }
      if (npvMid * npvLow > 0) {
        low = mid;
        npvLow = npvMid;
      } else {
        high = mid;
      }
    }
    return round((low + high) / 2, 8);
  }

  return null; // Could not converge to a valid IRR
}

/**
 * Distinguishes modal vs annualized premium based on payment frequency
 * @param {number} modalPremium
 * @param {string} frequency
 * @returns {number}
 */
function calculateAnnualPremium(modalPremium, frequency) {
  const modal = Number(modalPremium);
  switch (frequency) {
    case 'Half-Yearly':
      return multiply(modal, 2);
    case 'Monthly':
      return multiply(modal, 12);
    case 'Yearly':
    default:
      return modal;
  }
}

/**
 * Generates the full benefit illustration schedule
 *
 * @param {object} policyParams
 * @param {object} [options]
 * @returns {object} structured illustration output
 */
function generateIllustration(policyParams, options = {}) {
  // 1. Validation
  const validationResult = validatePolicyInputs(policyParams, options);
  if (!validationResult.isValid) {
    const error = new Error('Policy validation failed');
    error.status = 400;
    error.validationErrors = validationResult.errors;
    throw error;
  }

  const {
    dob,
    gender = 'M',
    sumAssured,
    modalPremium,
    premiumFrequency = 'Yearly',
    pt,
    ppt,
  } = policyParams;

  const numPT = parseInt(pt, 10);
  const numPPT = parseInt(ppt, 10);
  const numSA = Number(sumAssured);
  const numModalPrem = Number(modalPremium);
  const annualPrem = calculateAnnualPremium(numModalPrem, premiumFrequency);

  const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
  const customerAge = calculateAge(dob, asOfDate);

  // Determine bonus accumulation strategy
  // 'EXCEL_STRICT': Matches Excel formula `=C{r}+SUM(E$1:E$23)` summing all 20 rows
  // 'ACTUARIAL_TERM_BOUND': Accrues bonuses up to the policy term PT
  const bonusStrategy = options.bonusStrategy || config.illustration.bonusStrategy;

  // Total rows to generate: 20 rows to match the reference Excel template,
  // or bounded by PT if specified
  const totalScheduleYears = options.fixed20Rows !== false ? 20 : numPT;

  // Step 1: Precompute bonus rates and bonus amounts for all years
  const bonusRows = [];
  for (let year = 1; year <= totalScheduleYears; year++) {
    const rateIndex = year - 1;
    const bonusRate = rateIndex < STANDARD_BONUS_RATES.length ? STANDARD_BONUS_RATES[rateIndex] : 0.03;
    const bonusAmount = multiply(numSA, bonusRate);
    bonusRows.push({ year, bonusRate, bonusAmount });
  }

  // Step 2: Calculate total bonus pool for maturity benefit
  let totalBonusForMaturity = 0;
  if (bonusStrategy === 'EXCEL_STRICT') {
    // Exactly matches Excel SUM(E$1:E$23)
    totalBonusForMaturity = sum(bonusRows.map((r) => r.bonusAmount));
  } else {
    // Actuarial standard: sum up to PT
    totalBonusForMaturity = sum(bonusRows.filter((r) => r.year <= numPT).map((r) => r.bonusAmount));
  }

  // Step 3: Generate year-by-year schedule following Excel formulas
  const schedule = [];
  let cumulativePremiumPaid = 0;

  for (let year = 1; year <= totalScheduleYears; year++) {
    const bonusRate = bonusRows[year - 1].bonusRate;
    const bonusAmount = bonusRows[year - 1].bonusAmount;

    // Excel Column B: =IF(A_r <= PPT, Modal_Premium, 0)
    // Note: In Excel sample, Yearly Modal Premium = Annual Premium
    const isPayingYear = year <= numPPT;
    const premium = isPayingYear ? numModalPrem : 0;
    if (isPayingYear) {
      cumulativePremiumPaid = sum([cumulativePremiumPaid, premium]);
    }

    // Excel Column C: =IF(PT = A_r, Sum_Assured, 0)
    const isMaturityYear = year === numPT;
    const sumAssuredBenefit = isMaturityYear ? numSA : 0;

    // Excel Column F: =IF(PT = A_r, C_r + SUM(E$1:E$23), 0)
    const totalBenefit = isMaturityYear ? sum([sumAssuredBenefit, totalBonusForMaturity]) : 0;

    // Excel Column G: =IF(PT = A_r, F_r, C_r - B_r)
    let netCashflow = 0;
    if (isMaturityYear) {
      netCashflow = totalBenefit;
    } else {
      netCashflow = round(sumAssuredBenefit - premium, 2);
    }

    schedule.push({
      policyYear: year,
      premium,
      sumAssured: sumAssuredBenefit,
      bonusRate,
      bonusAmount,
      totalBenefit,
      netCashflow,
    });
  }

  // Step 4: Calculate IRR
  // Excel formula in G2: =IRR(G4:G23)
  const cashflowsForIRR = schedule.map((row) => row.netCashflow);
  const irrDecimal = calculateIRR(cashflowsForIRR);
  const irrPercentage = irrDecimal !== null ? round(irrDecimal * 100, 4) : null;

  // Step 5: Summary metrics
  const totalPremiumsPaid = cumulativePremiumPaid;
  const maturityBenefit = schedule.find((r) => r.policyYear === numPT)?.totalBenefit || 0;
  const totalBonusAccrued = totalBonusForMaturity;

  return {
    customer: {
      dob,
      age: customerAge,
      gender,
    },
    policy: {
      sumAssured: numSA,
      modalPremium: numModalPrem,
      annualPremium: annualPrem,
      premiumFrequency,
      pt: numPT,
      ppt: numPPT,
      totalPremiumsPaid,
      maturityBenefit,
      totalBonusAccrued,
      irrDecimal,
      irrPercentage,
      bonusStrategy,
    },
    schedule,
    metadata: {
      calculatedAt: new Date().toISOString(),
      formulaBasis: 'assignment_reference_sample (1).xlsm (Sheet: Illustration)',
    },
  };
}

/**
 * Converts illustration schedule to CSV format for download
 * @param {object} illustrationResult
 * @returns {string} CSV content
 */
function exportIllustrationToCSV(illustrationResult) {
  const { customer, policy, schedule } = illustrationResult;

  const metaRows = [
    ['Benefit Illustration Report'],
    ['Generated On', new Date().toISOString()],
    ['Customer Age', customer.age],
    ['Gender', customer.gender],
    ['Sum Assured', policy.sumAssured],
    ['Modal Premium', policy.modalPremium],
    ['Frequency', policy.premiumFrequency],
    ['Policy Term (PT)', policy.pt],
    ['Premium Paying Term (PPT)', policy.ppt],
    ['Total Premiums Paid', policy.totalPremiumsPaid],
    ['Maturity Benefit', policy.maturityBenefit],
    ['Internal Rate of Return (IRR)', policy.irrPercentage ? `${policy.irrPercentage}%` : 'N/A'],
    [],
    ['Policy Year', 'Premium (INR)', 'Sum Assured (INR)', 'Bonus Rate', 'Bonus Amount (INR)', 'Total Benefit (INR)', 'Net Cashflow (INR)'],
  ];

  const tableRows = schedule.map((r) => [
    r.policyYear,
    r.premium,
    r.sumAssured,
    `${(r.bonusRate * 100).toFixed(2)}%`,
    r.bonusAmount,
    r.totalBenefit,
    r.netCashflow,
  ]);

  return [...metaRows, ...tableRows].map((row) => row.join(',')).join('\n');
}

module.exports = {
  STANDARD_BONUS_RATES,
  calculateIRR,
  calculateNPV,
  calculateAnnualPremium,
  generateIllustration,
  exportIllustrationToCSV,
};

