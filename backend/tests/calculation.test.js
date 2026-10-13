const {
  STANDARD_BONUS_RATES,
  calculateIRR,
  calculateNPV,
  generateIllustration,
  exportIllustrationToCSV,
} = require('../src/services/illustrationService');

describe('Benefit Calculation Engine & Excel Reference Parity', () => {
  // Exact parameters from assignment_reference_sample (1).xlsm (Sheet: Inputs)
  const excelSampleInputs = {
    dob: '1999-12-12',
    gender: 'M',
    sumAssured: 1200000,
    modalPremium: 80000,
    premiumFrequency: 'Yearly',
    pt: 18,
    ppt: 10,
  };

  const fixedAsOfDate = '2026-10-12';

  describe('1. Excel Reference Workbook Parity', () => {
    let result;

    beforeAll(() => {
      result = generateIllustration(excelSampleInputs, {
        asOfDate: fixedAsOfDate,
        bonusStrategy: 'EXCEL_STRICT',
      });
    });

    test('generates exactly 20 policy year rows', () => {
      expect(result.schedule).toHaveLength(20);
      expect(result.schedule[0].policyYear).toBe(1);
      expect(result.schedule[19].policyYear).toBe(20);
    });

    test('calculates correct customer age from completed birthdays (26 years)', () => {
      expect(result.customer.age).toBe(26);
    });

    test('applies premiums exclusively during the Premium Paying Term (Years 1..10)', () => {
      for (let i = 0; i < 10; i++) {
        expect(result.schedule[i].premium).toBe(80000);
      }
      for (let i = 10; i < 20; i++) {
        expect(result.schedule[i].premium).toBe(0);
      }
      expect(result.policy.totalPremiumsPaid).toBe(800000);
    });

    test('applies Sum Assured payout exclusively at maturity year (Year 18)', () => {
      for (let i = 0; i < 17; i++) {
        expect(result.schedule[i].sumAssured).toBe(0);
      }
      // Year 18 (index 17)
      expect(result.schedule[17].sumAssured).toBe(1200000);
      // Years 19 and 20
      expect(result.schedule[18].sumAssured).toBe(0);
      expect(result.schedule[19].sumAssured).toBe(0);
    });

    test('applies correct bonus rates and amounts matching Excel Column D & E', () => {
      // Year 1: 2.5% on 1.2M = 30,000
      expect(result.schedule[0].bonusRate).toBe(0.025);
      expect(result.schedule[0].bonusAmount).toBe(30000);

      // Year 2: 3.0% on 1.2M = 36,000
      expect(result.schedule[1].bonusRate).toBe(0.03);
      expect(result.schedule[1].bonusAmount).toBe(36000);

      // Year 3: 3.5% on 1.2M = 42,000
      expect(result.schedule[2].bonusRate).toBe(0.035);
      expect(result.schedule[2].bonusAmount).toBe(42000);

      // Year 16: 5.0% on 1.2M = 60,000
      expect(result.schedule[15].bonusRate).toBe(0.05);
      expect(result.schedule[15].bonusAmount).toBe(60000);

      // Year 18: 4.5% on 1.2M = 54,000
      expect(result.schedule[17].bonusRate).toBe(0.045);
      expect(result.schedule[17].bonusAmount).toBe(54000);

      // Year 20: 25.0% on 1.2M = 300,000
      expect(result.schedule[19].bonusRate).toBe(0.25);
      expect(result.schedule[19].bonusAmount).toBe(300000);

      // Total 20-year bonus pool: ₹1,056,000
      const totalBonus = result.schedule.reduce((acc, r) => acc + r.bonusAmount, 0);
      expect(totalBonus).toBe(1056000);
      expect(result.policy.totalBonusAccrued).toBe(1056000);
    });

    test('calculates exact Total Benefit at maturity matching Excel cell F21 (₹2,256,000)', () => {
      // Non-maturity years should have Total Benefit = 0
      for (let i = 0; i < 17; i++) {
        expect(result.schedule[i].totalBenefit).toBe(0);
      }

      // Year 18: Sum Assured (1,200,000) + Total Bonus (1,056,000) = 2,256,000
      expect(result.schedule[17].totalBenefit).toBe(2256000);
      expect(result.policy.maturityBenefit).toBe(2256000);

      // Years 19 and 20 Total Benefit = 0
      expect(result.schedule[18].totalBenefit).toBe(0);
      expect(result.schedule[19].totalBenefit).toBe(0);
    });

    test('calculates exact Net Cashflows matching Excel Column G', () => {
      // Years 1..10: -80,000
      for (let i = 0; i < 10; i++) {
        expect(result.schedule[i].netCashflow).toBe(-80000);
      }
      // Years 11..17: 0
      for (let i = 10; i < 17; i++) {
        expect(result.schedule[i].netCashflow).toBe(0);
      }
      // Year 18: +2,256,000
      expect(result.schedule[17].netCashflow).toBe(2256000);
      // Years 19..20: 0
      expect(result.schedule[18].netCashflow).toBe(0);
      expect(result.schedule[19].netCashflow).toBe(0);
    });

    test('calculates exact IRR matching Excel cell G2 (8.4150%)', () => {
      // Excel cell G2: =IRR(G4:G23) -> 8.41501481908151%
      expect(result.policy.irrDecimal).toBeCloseTo(0.08415015, 6);
      expect(result.policy.irrPercentage).toBe(8.415);
    });
  });

  describe('2. Bonus Accumulation Strategy Comparison', () => {
    test('supports ACTUARIAL_TERM_BOUND strategy (bonuses accrued only up to PT)', () => {
      const boundResult = generateIllustration(excelSampleInputs, {
        asOfDate: fixedAsOfDate,
        bonusStrategy: 'ACTUARIAL_TERM_BOUND',
      });

      // Bonus sum up to Year 18 is 59.0% -> 708,000
      expect(boundResult.policy.totalBonusAccrued).toBe(708000);
      // Maturity benefit = 1,200,000 + 708,000 = 1,908,000
      expect(boundResult.policy.maturityBenefit).toBe(1908000);
      expect(boundResult.schedule[17].totalBenefit).toBe(1908000);
      // IRR will be lower with 1,908,000 maturity benefit
      expect(boundResult.policy.irrPercentage).toBeLessThan(8.415);
    });
  });

  describe('3. IRR Solver Edge Cases', () => {
    test('returns null for cash flows with no positive values', () => {
      const allNegative = [-10000, -10000, -10000];
      expect(calculateIRR(allNegative)).toBeNull();
    });

    test('returns null for cash flows with no negative values', () => {
      const allPositive = [10000, 20000, 30000];
      expect(calculateIRR(allPositive)).toBeNull();
    });

    test('returns null for empty or single element array', () => {
      expect(calculateIRR([])).toBeNull();
      expect(calculateIRR([-1000])).toBeNull();
    });

    test('NPV at solved IRR equals approximately zero', () => {
      const cfs = [-80000, -80000, 0, 0, 200000];
      const rate = calculateIRR(cfs);
      expect(rate).not.toBeNull();
      const npv = calculateNPV(rate, cfs);
      expect(Math.abs(npv)).toBeLessThan(0.01);
    });
  });

  describe('4. Idempotence & CSV Export', () => {
    test('produces identical results for repeated identical runs', () => {
      const run1 = generateIllustration(excelSampleInputs, { asOfDate: fixedAsOfDate });
      const run2 = generateIllustration(excelSampleInputs, { asOfDate: fixedAsOfDate });
      expect(run1.policy).toEqual(run2.policy);
      expect(run1.schedule).toEqual(run2.schedule);
      expect(run1.customer).toEqual(run2.customer);
    });

    test('exports structured illustration to valid CSV text', () => {
      const res = generateIllustration(excelSampleInputs, { asOfDate: fixedAsOfDate });
      const csv = exportIllustrationToCSV(res);
      expect(csv).toContain('Benefit Illustration Report');
      expect(csv).toContain('Policy Year,Premium (INR),Sum Assured (INR)');
      expect(csv).toContain('18,0,1200000,4.50%,54000,2256000,2256000');
    });
  });
});
