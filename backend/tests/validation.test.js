const { calculateAge, validateSumAssured, validatePolicyInputs } = require('../src/validators/policyValidator');

describe('Policy Validation Suite', () => {
  const validParams = {
    dob: '1999-12-12',
    gender: 'M',
    sumAssured: 1200000,
    modalPremium: 40000,
    premiumFrequency: 'Yearly',
    pt: 18,
    ppt: 10,
  };

  // Fixed evaluation date matching 2026-10-12
  const fixedAsOfDate = new Date('2026-10-12T12:00:00Z');

  describe('1. Age Validation (Completed Birthdays, Min 23, Max 56)', () => {
    test('calculates correct age for completed birthdays', () => {
      // 1999-12-12 on 2026-10-12: birthday not yet occurred in 2026 -> age 26
      expect(calculateAge('1999-12-12', fixedAsOfDate)).toBe(26);

      // Birthday already occurred earlier this year: 1999-05-01 -> age 27
      expect(calculateAge('1999-05-01', fixedAsOfDate)).toBe(27);

      // Birthday on evaluation date: 1999-10-12 -> age 27
      expect(calculateAge('1999-10-12', fixedAsOfDate)).toBe(27);
    });

    test('accepts age at boundary limits (23 and 56)', () => {
      // 23 years old on 2026-10-12 -> born 2003-10-12
      const resMin = validatePolicyInputs({ ...validParams, dob: '2003-10-12' }, { asOfDate: fixedAsOfDate });
      expect(resMin.isValid).toBe(true);
      expect(resMin.calculatedAge).toBe(23);

      // 56 years old on 2026-10-12 -> born 1970-10-12
      const resMax = validatePolicyInputs({ ...validParams, dob: '1970-10-12' }, { asOfDate: fixedAsOfDate });
      expect(resMax.isValid).toBe(true);
      expect(resMax.calculatedAge).toBe(56);
    });

    test('rejects age below 23', () => {
      // 22 years old -> born 2004-10-12
      const res = validatePolicyInputs({ ...validParams, dob: '2004-10-13' }, { asOfDate: fixedAsOfDate });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContainEqual(expect.stringContaining('must be between 23 and 56 years'));
    });

    test('rejects age above 56', () => {
      // 57 years old -> born 1969-10-12
      const res = validatePolicyInputs({ ...validParams, dob: '1969-10-10' }, { asOfDate: fixedAsOfDate });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContainEqual(expect.stringContaining('must be between 23 and 56 years'));
    });

    test('rejects invalid or missing date of birth', () => {
      expect(validatePolicyInputs({ ...validParams, dob: '' }).isValid).toBe(false);
      expect(validatePolicyInputs({ ...validParams, dob: 'invalid-date' }).isValid).toBe(false);
    });
  });

  describe('2. PPT and PT Range Validations (PPT 5-10, PT 10-20)', () => {
    test('accepts valid PPT and PT boundaries', () => {
      const resMin = validatePolicyInputs({ ...validParams, ppt: 5, pt: 10 });
      expect(resMin.isValid).toBe(true);

      const resMax = validatePolicyInputs({ ...validParams, ppt: 10, pt: 20 });
      expect(resMax.isValid).toBe(true);
    });

    test('rejects PPT < 5 or PPT > 10', () => {
      const resLow = validatePolicyInputs({ ...validParams, ppt: 4 });
      expect(resLow.isValid).toBe(false);
      expect(resLow.errors).toContainEqual(expect.stringContaining('PPT'));

      const resHigh = validatePolicyInputs({ ...validParams, ppt: 11, pt: 15 });
      expect(resHigh.isValid).toBe(false);
      expect(resHigh.errors).toContainEqual(expect.stringContaining('PPT'));
    });

    test('rejects PT < 10 or PT > 20', () => {
      const resLow = validatePolicyInputs({ ...validParams, pt: 9 });
      expect(resLow.isValid).toBe(false);
      expect(resLow.errors).toContainEqual(expect.stringContaining('PT'));

      const resHigh = validatePolicyInputs({ ...validParams, pt: 21 });
      expect(resHigh.isValid).toBe(false);
      expect(resHigh.errors).toContainEqual(expect.stringContaining('PT'));
    });
  });

  describe('3. PT must be greater than PPT (PT > PPT)', () => {
    test('rejects when PT equals PPT', () => {
      const res = validatePolicyInputs({ ...validParams, ppt: 10, pt: 10 });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContainEqual(expect.stringContaining('strictly greater than'));
    });

    test('rejects when PT is less than PPT', () => {
      // PPT = 10, PT = 8 (even if out of PT range, PT <= PPT fails)
      const res = validatePolicyInputs({ ...validParams, ppt: 10, pt: 8 });
      expect(res.isValid).toBe(false);
      expect(res.errors).toContainEqual(expect.stringContaining('strictly greater than'));
    });

    test('accepts when PT is strictly greater than PPT', () => {
      const res = validatePolicyInputs({ ...validParams, ppt: 5, pt: 10 });
      expect(res.isValid).toBe(true);
    });
  });

  describe('4. Premium Range (Any Amount Allowed)', () => {
    test('accepts any valid premium amounts including ₹10,000, ₹50,000, and ₹80,000+ without override', () => {
      expect(validatePolicyInputs({ ...validParams, modalPremium: 10000, sumAssured: 100000 }).isValid).toBe(true);
      expect(validatePolicyInputs({ ...validParams, modalPremium: 50000, sumAssured: 500000 }).isValid).toBe(true);
      expect(validatePolicyInputs({ ...validParams, modalPremium: 80000, sumAssured: 1200000 }).isValid).toBe(true);
      expect(validatePolicyInputs({ ...validParams, modalPremium: 150000, sumAssured: 2000000 }).isValid).toBe(true);
    });

    test('rejects premium less than or equal to 0 or non-numeric', () => {
      const resZero = validatePolicyInputs({ ...validParams, modalPremium: 0 });
      expect(resZero.isValid).toBe(false);
      expect(resZero.errors).toContainEqual(expect.stringContaining('Modal Premium'));

      const resNeg = validatePolicyInputs({ ...validParams, modalPremium: -5000 });
      expect(resNeg.isValid).toBe(false);
      expect(resNeg.errors).toContainEqual(expect.stringContaining('Modal Premium'));

      const resNaN = validatePolicyInputs({ ...validParams, modalPremium: 'invalid' });
      expect(resNaN.isValid).toBe(false);
      expect(resNaN.errors).toContainEqual(expect.stringContaining('Modal Premium'));
    });
  });

  describe('5. Sum Assured Validation (10x Multiple & ₹50,00,000 Cap)', () => {
    test('accepts valid Sum Assured meeting 10x premium and <= 50,00,000', () => {
      // Premium 40,000 -> 10x is 400,000. SA = 1,200,000 is valid.
      const res = validateSumAssured(1200000, 40000);
      expect(res.valid).toBe(true);
    });

    test('rejects Sum Assured below 10 times premium', () => {
      // Premium 40,000 -> 10x is 400,000. SA = 350,000 is invalid.
      const res = validateSumAssured(350000, 40000);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('at least 10 times the annual premium');
    });

    test('rejects Sum Assured exceeding ₹50,00,000 limit in standard IRDAI mode', () => {
      const res = validateSumAssured(5500000, 40000);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('cannot exceed the maximum limit of ₹50,00,000');
    });
  });

  describe('6. Missing Mandatory Fields', () => {
    test('reports missing fields', () => {
      const res = validatePolicyInputs({});
      expect(res.isValid).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});

