const config = require('../config');

/**
 * Calculates completed age in years as of evaluation date
 * @param {string|Date} dob - Date of Birth (YYYY-MM-DD or Date object)
 * @param {Date} [asOfDate=new Date()] - Evaluation date
 * @returns {number} Completed years of age
 */
function calculateAge(dob, asOfDate = new Date()) {
  if (!dob) return NaN;
  let birthDate = new Date(dob);

  // If standard parse failed, check for DD/MM/YYYY or DD-MM-YYYY format
  if (isNaN(birthDate.getTime()) && typeof dob === 'string') {
    const match = dob.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      birthDate = new Date(year, month, day);
    }
  }

  if (isNaN(birthDate.getTime())) return NaN;

  const targetDate = new Date(asOfDate);
  let age = targetDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = targetDate.getMonth() - birthDate.getMonth();
  const dayDiff = targetDate.getDate() - birthDate.getDate();

  // If birthday has not occurred yet this year, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  return age;
}

/**
 * Validates Sum Assured according to clarified business rules
 * Text in workbook: "Minimum of 10 times Sum assured or 5000000"
 * Interpreted as: Sum Assured must be at least 10x Annual Premium AND capped at 50,00,000.
 *
 * @param {number} sumAssured
 * @param {number} annualPremium
 * @param {object} [options]
 * @returns {{ valid: boolean, message?: string }}
 */
function validateSumAssured(sumAssured, annualPremium, options = {}) {
  const sa = Number(sumAssured);
  const prem = Number(annualPremium);
  const minMultiple = options.minMultiplier || config.validation.sumAssured.minMultiplier;
  const maxLimit = options.maxLimit || config.validation.sumAssured.maxLimit;
  const strategy = options.strategy || config.validation.sumAssured.strategy;

  if (isNaN(sa) || sa <= 0) {
    return { valid: false, message: 'Sum Assured must be a positive number.' };
  }

  const minRequiredSA = prem * minMultiple;

  if (strategy === 'EXCEL_LITERAL_MIN') {
    // Under strict minimum cap interpretation: sa >= min(10 * prem, maxLimit)
    const requiredFloor = Math.min(minRequiredSA, maxLimit);
    if (sa < requiredFloor) {
      return {
        valid: false,
        message: `Sum Assured (₹${sa.toLocaleString('en-IN')}) must be at least ₹${requiredFloor.toLocaleString('en-IN')} (minimum of ${minMultiple}x premium or ₹${maxLimit.toLocaleString('en-IN')}).`,
      };
    }
  } else {
    // Standard IRDAI & Industry Rule: SA >= 10 * Premium AND SA <= 50,00,000
    if (sa < minRequiredSA) {
      return {
        valid: false,
        message: `Sum Assured (₹${sa.toLocaleString('en-IN')}) must be at least ${minMultiple} times the annual premium (₹${minRequiredSA.toLocaleString('en-IN')}).`,
      };
    }
    if (sa > maxLimit) {
      return {
        valid: false,
        message: `Sum Assured (₹${sa.toLocaleString('en-IN')}) cannot exceed the maximum limit of ₹${maxLimit.toLocaleString('en-IN')}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates all 5 mandatory policy parameters from the assignment
 *
 * @param {object} input
 * @param {object} [options]
 * @returns {{ isValid: boolean, errors: string[], calculatedAge?: number }}
 */
function validatePolicyInputs(input, options = {}) {
  const errors = [];
  const { dob, gender, sumAssured, modalPremium, premiumFrequency, pt, ppt } = input;
  const cfg = config.validation;

  // 1. Validate Date of Birth and Completed Age (Validation Rule 5)
  if (!dob) {
    errors.push('Date of birth is required.');
  } else {
    const age = calculateAge(dob, options.asOfDate || new Date());
    if (isNaN(age)) {
      errors.push('Date of birth is invalid.');
    } else if (age < cfg.age.min || age > cfg.age.max) {
      errors.push(`Age (${age} years) must be between ${cfg.age.min} and ${cfg.age.max} years (based on completed birthdays).`);
    }
  }

  // 2. Validate PPT and PT Ranges (Validation Rule 1)
  const numPPT = Number(ppt);
  if (isNaN(numPPT) || !Number.isInteger(numPPT) || numPPT < cfg.ppt.min || numPPT > cfg.ppt.max) {
    errors.push(`Premium Paying Term (PPT) must be an integer between ${cfg.ppt.min} and ${cfg.ppt.max} years.`);
  }

  const numPT = Number(pt);
  if (isNaN(numPT) || !Number.isInteger(numPT) || numPT < cfg.pt.min || numPT > cfg.pt.max) {
    errors.push(`Policy Term (PT) must be an integer between ${cfg.pt.min} and ${cfg.pt.max} years.`);
  }

  // 3. PT must be greater than PPT (Validation Rule 2)
  if (!isNaN(numPT) && !isNaN(numPPT) && numPT <= numPPT) {
    errors.push(`Policy Term (PT = ${numPT}) must be strictly greater than Premium Paying Term (PPT = ${numPPT}).`);
  }

  // 4. Premium Frequency (Validation Rule 3)
  const freq = premiumFrequency || 'Yearly';
  if (!cfg.frequencies.includes(freq)) {
    errors.push(`Premium frequency must be one of: ${cfg.frequencies.join(', ')}.`);
  }

  // 5. Modal Premium Validation (Allows any positive premium amount)
  const prem = Number(modalPremium);
  if (isNaN(prem) || prem <= 0) {
    errors.push('Modal Premium must be a valid number greater than 0.');
  } else if (cfg.premium?.min && prem < cfg.premium.min) {
    errors.push(`Modal Premium (₹${prem}) must be at least ₹${cfg.premium.min.toLocaleString('en-IN')}.`);
  } else if (cfg.premium?.max && prem > cfg.premium.max) {
    errors.push(`Modal Premium (₹${prem}) cannot exceed ₹${cfg.premium.max.toLocaleString('en-IN')}.`);
  }

  // 6. Sum Assured Validation (Validation Rule 4)
  if (!isNaN(prem) && sumAssured !== undefined) {
    const annualPrem = prem; // In Yearly frequency; if half-yearly/monthly, modal factor applies
    const saCheck = validateSumAssured(sumAssured, annualPrem, options);
    if (!saCheck.valid) {
      errors.push(saCheck.message);
    }
  } else if (!sumAssured) {
    errors.push('Sum Assured is required.');
  }

  // 7. Gender Validation
  if (gender && !cfg.genders.includes(gender)) {
    errors.push(`Gender must be one of: ${cfg.genders.join(', ')}.`);
  }

  // 8. Policy Type & Riders Validation (Optional structured attributes)
  const { POLICY_TYPES, RIDERS } = require('../models/policyCatalog');
  if (input.policyType && !POLICY_TYPES[input.policyType]) {
    errors.push(`Policy Type must be one of: ${Object.keys(POLICY_TYPES).join(', ')}.`);
  }
  if (input.riders !== undefined) {
    if (!Array.isArray(input.riders)) {
      errors.push('Riders must be provided as an array of rider codes/IDs.');
    } else {
      const invalidRiders = input.riders.filter((r) => !RIDERS[r]);
      if (invalidRiders.length > 0) {
        errors.push(`Invalid rider(s): ${invalidRiders.join(', ')}. Allowed riders: ${Object.keys(RIDERS).join(', ')}.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    calculatedAge: !isNaN(calculateAge(dob, options.asOfDate)) ? calculateAge(dob, options.asOfDate) : null,
  };
}

module.exports = {
  calculateAge,
  validateSumAssured,
  validatePolicyInputs,
};

