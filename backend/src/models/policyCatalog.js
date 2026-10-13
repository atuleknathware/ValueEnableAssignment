/**
 * Data Structures for Policy Information:
 * - Policy Types (Endowment, Money Back, Whole Life)
 * - Optional Riders (Accidental Death, Critical Illness, Waiver of Premium)
 * - Premium Payment Options (Yearly, Half-Yearly, Monthly)
 * - Sample Policy Data Presets (including the Excel Reference Scenario)
 */

const POLICY_TYPES = {
  ENDOWMENT: {
    id: 'ENDOWMENT',
    code: 'ENDOW-101',
    name: 'Traditional Participating Endowment Plan',
    category: 'Savings & Protection',
    description:
      'Guaranteed Sum Assured plus accrued yearly simple reversionary bonuses and terminal bonus payable at policy maturity or earlier death.',
    minPT: 10,
    maxPT: 20,
    minPPT: 5,
    maxPPT: 10,
    bonusApplicable: true,
  },
  MONEY_BACK: {
    id: 'MONEY_BACK',
    code: 'MB-102',
    name: 'Periodic Money-Back Savings Plan',
    category: 'Income & Savings',
    description:
      'Provides liquidity alongside life insurance protection with guaranteed maturity benefits and simple reversionary bonus accruals.',
    minPT: 10,
    maxPT: 20,
    minPPT: 5,
    maxPPT: 10,
    bonusApplicable: true,
  },
  WHOLE_LIFE: {
    id: 'WHOLE_LIFE',
    code: 'WL-103',
    name: 'Whole Life Guaranteed Protection Plan',
    category: 'Protection & Legacy',
    description:
      'Long-term participating life insurance coverage with guaranteed Sum Assured and cumulative bonus additions at maturity.',
    minPT: 10,
    maxPT: 20,
    minPPT: 5,
    maxPPT: 10,
    bonusApplicable: true,
  },
};

const RIDERS = {
  ACCIDENTAL_DEATH: {
    id: 'ACCIDENTAL_DEATH',
    code: 'RIDER-ADB',
    name: 'Accidental Death Benefit (ADB) Rider',
    description: 'Additional 100% Rider Sum Assured lump-sum payout in the event of accidental death.',
    riderSumAssuredRatio: 0.5, // 50% of Base Sum Assured (up to ₹25,00,000)
    maxRiderSumAssured: 2500000,
    annualRatePerThousandSA: 0.5, // ₹0.50 per ₹1,000 of Rider SA
  },
  CRITICAL_ILLNESS: {
    id: 'CRITICAL_ILLNESS',
    code: 'RIDER-CI',
    name: 'Critical Illness (CI) Care Rider',
    description: 'Lump-sum benefit payable on first diagnosis of any of 36 specified critical illnesses.',
    riderSumAssuredRatio: 0.25, // 25% of Base Sum Assured (up to ₹15,00,000)
    maxRiderSumAssured: 1500000,
    annualRatePerThousandSA: 1.2, // ₹1.20 per ₹1,000 of Rider SA
  },
  WAIVER_OF_PREMIUM: {
    id: 'WAIVER_OF_PREMIUM',
    code: 'RIDER-WOP',
    name: 'Waiver of Premium (WoP) Disability Rider',
    description: 'Waives all future base policy premiums in case of Total and Permanent Disability.',
    riderSumAssuredRatio: 0,
    maxRiderSumAssured: 0,
    premiumPercentageLoading: 0.02, // 2% of Base Annual Premium
  },
};

const PREMIUM_OPTIONS = {
  Yearly: {
    id: 'Yearly',
    label: 'Yearly (Annual)',
    installmentsPerYear: 1,
    modalFactor: 1.0,
    description: 'Single annual premium payment per policy year.',
  },
  'Half-Yearly': {
    id: 'Half-Yearly',
    label: 'Half-Yearly (Semi-Annual)',
    installmentsPerYear: 2,
    modalFactor: 0.5,
    description: 'Two semi-annual premium installments per policy year.',
  },
  Monthly: {
    id: 'Monthly',
    label: 'Monthly (ECS / Auto-Debit)',
    installmentsPerYear: 12,
    modalFactor: 1 / 12,
    description: 'Twelve monthly premium installments per policy year.',
  },
};

const SAMPLE_POLICIES = [
  {
    id: 'SAMPLE-EXCEL-REF',
    policyName: 'Excel Sample Reference Policy',
    policyType: 'ENDOWMENT',
    dob: '1999-12-12',
    gender: 'M',
    sumAssured: 1200000,
    modalPremium: 80000,
    premiumFrequency: 'Yearly',
    pt: 18,
    ppt: 10,
    riders: [],
    description: 'Exact sample input from assignment_reference_sample (1).xlsm (IRR: 8.415%, Maturity: ₹22,56,000).',
  },
  {
    id: 'SAMPLE-ENDOW-RIDERS',
    policyName: 'Comprehensive Endowment with Riders',
    policyType: 'ENDOWMENT',
    dob: '1995-06-15',
    gender: 'F',
    sumAssured: 1500000,
    modalPremium: 50000,
    premiumFrequency: 'Yearly',
    pt: 20,
    ppt: 10,
    riders: ['ACCIDENTAL_DEATH', 'WAIVER_OF_PREMIUM'],
    description: '20-year Endowment plan with Accidental Death and Waiver of Premium riders.',
  },
  {
    id: 'SAMPLE-MONEY-BACK',
    policyName: 'Family Money-Back Protection Plan',
    policyType: 'MONEY_BACK',
    dob: '1990-03-22',
    gender: 'M',
    sumAssured: 1000000,
    modalPremium: 40000,
    premiumFrequency: 'Yearly',
    pt: 15,
    ppt: 8,
    riders: ['CRITICAL_ILLNESS'],
    description: '15-year Money-Back plan with Critical Illness rider protection.',
  },
];

/**
 * Resolves selected rider IDs into structured rider benefit & premium metadata
 * @param {string[]} riderIds
 * @param {number} baseSumAssured
 * @param {number} baseAnnualPremium
 * @returns {object[]}
 */
function resolveRiders(riderIds = [], baseSumAssured = 0, baseAnnualPremium = 0) {
  if (!Array.isArray(riderIds)) return [];

  return riderIds
    .map((id) => {
      const riderDef = RIDERS[id];
      if (!riderDef) return null;

      let riderSumAssured = 0;
      let riderAnnualPremium = 0;

      if (riderDef.riderSumAssuredRatio > 0) {
        riderSumAssured = Math.min(
          Math.round(baseSumAssured * riderDef.riderSumAssuredRatio),
          riderDef.maxRiderSumAssured
        );
        riderAnnualPremium = Math.round((riderSumAssured / 1000) * riderDef.annualRatePerThousandSA);
      } else if (riderDef.premiumPercentageLoading) {
        riderAnnualPremium = Math.round(baseAnnualPremium * riderDef.premiumPercentageLoading);
      }

      return {
        id: riderDef.id,
        code: riderDef.code,
        name: riderDef.name,
        description: riderDef.description,
        riderSumAssured,
        riderAnnualPremium,
      };
    })
    .filter(Boolean);
}

/**
 * Returns the full catalog of policy types, riders, premium options, and sample policies
 */
function getPolicyCatalog() {
  return {
    policyTypes: Object.values(POLICY_TYPES),
    riders: Object.values(RIDERS),
    premiumOptions: Object.values(PREMIUM_OPTIONS),
    samplePolicies: SAMPLE_POLICIES,
  };
}

module.exports = {
  POLICY_TYPES,
  RIDERS,
  PREMIUM_OPTIONS,
  SAMPLE_POLICIES,
  resolveRiders,
  getPolicyCatalog,
};

