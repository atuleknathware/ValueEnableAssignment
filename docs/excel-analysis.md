# Excel Workbook Analysis Report

**File Analyzed:** `assignment_reference_sample (1).xlsm`  
**Analysis Date:** October 2026  
**Auditor:** Senior Full-Stack Actuarial Systems Developer  

---

## 1. Executive Summary

The reference workbook `assignment_reference_sample (1).xlsm` specifies the actuarial and business calculation engine for a traditional life insurance Benefit Illustration (BI) system.

The workbook contains **6 sheets**:
1. `Checks`: An actuarial QA log and peer-review discussion regarding fund returns, loyalty additions (LA), mortality charges, and discontinued policy funds from an earlier prototype. Contains no active calculation logic for this assignment.
2. `Inputs`: Contains customer and policy parameters along with 5 specified business validation rules.
3. `Illustration`: Contains the primary 20-year benefit projection schedule, annual premiums, sum assured, bonus accruals, maturity benefits, annual net cashflows, and policy Internal Rate of Return (IRR).
4. `Death Benefit Calculation WIP` *(Hidden)*: A draft sheet with incomplete formulas.
5. `Cashflows_Backtesting` *(Hidden)*: Contains broken external workbook references (`[1]Pre-Calculation!$H$2:$L$33`, resulting in `#REF!` and `#N/A`).
6. `UNMODELLED` *(Hidden)*: Unmodelled placeholder table.

**Source of Truth:** For this assignment, `Inputs` and `Illustration` represent the complete, authoritative source of truth.

---

## 2. Sheet-by-Sheet Breakdown

### Sheet 1: `Inputs` (Cell Mapping & Data Types)

| Cell | Parameter | Sample Value | Data Type / Format | Business Meaning |
|---|---|---|---|---|
| `B1` | Header | `"POLICY DETAILS"` | String | Section Title |
| `B3` / `C3` | `DOB` | `36506` (`1999-12-12`) | Date (Excel Serial) | Policyholder Date of Birth |
| `B4` / `C4` | `Gender` | `"M"` | String (`"M"` / `"F"`) | Policyholder Gender |
| `B5` / `C5` | `Sum Assured` (`SA`) | `1200000` | Currency (INR) | Guaranteed Sum Assured payable on maturity/death |
| `B6` / `C6` | `Modal Premium` | `80000` | Currency (INR) | Premium paid per installment |
| `B7` / `C7` | `Premium Frequency` | `"Yearly"` | Enum (`Yearly`, `Half-Yearly`, `Monthly`) | Installment frequency |
| `B8` / `C8` | `PT` | `18` | Integer | Policy Term in years |
| `B9` / `C9` | `PPT` | `10` | Integer | Premium Paying Term in years |

#### Defined Names in Workbook:
- `DOB` $\rightarrow$ `Inputs!$C$3`
- `Mod_Prem` $\rightarrow$ `Inputs!$C$6`
- `Prem_Freq` / `Mode` $\rightarrow$ `Inputs!$C$7`
- `PT` $\rightarrow$ `Inputs!$C$8`
- `PPT` $\rightarrow$ `Inputs!$C$9`
- `SA` $\rightarrow$ `Inputs!$C$5`

---

### Sheet 2: `Illustration` (Formulas, Columns & Mechanics)

The Illustration model projects up to 20 policy years (rows 4 through 23, corresponding to Policy Years 1 to 20).

| Col | Header | Excel Formula (Row $r$, Year $A_r$) | Sample Row 4 (Year 1) | Sample Row 21 (Year 18, PT) | Sample Row 23 (Year 20) |
|---|---|---|---|---|---|
| `A` | **Policy Year** | Literal integer $1 \dots 20$ | `1` | `18` | `20` |
| `B` | **Premium** | `=IF(A_r <= Inputs!$C$9, Inputs!$C$6, 0)` | `80,000` | `0` | `0` |
| `C` | **Sum Assured** | `=IF(Inputs!$C$8 = A_r, Inputs!$C$5, 0)` | `0` | `1,200,000` | `0` |
| `D` | **Bonus Rate** | Literal percentage constant | `0.025` (2.5%) | `0.045` (4.5%) | `0.250` (25.0%) |
| `E` | **Bonus Amount** | `=D_r * Inputs!$C$5` | `30,000` | `54,000` | `300,000` |
| `F` | **Total Benefit** | `=IF(Inputs!$C$8 = A_r, C_r + SUM(E$1:E$23), 0)` | `0` | `2,256,000` | `0` |
| `G` | **Net Cashflows** | `=IF(Inputs!$C$8 = A_r, F_r, C_r - B_r)` | `-80,000` | `2,256,000` | `0` |

#### Summary Metrics:
- **Cell `F2`**: Label `"IRR ->"`
- **Cell `G2`**: Formula `=IRR(G4:G23)`
- **Calculated IRR Value**: `0.08415014819081512` ($8.415\%$)
- **Total Premiums Paid**: $\sum_{t=1}^{PPT} \text{Premium}_t = 10 \times 80,000 = ₹8,00,000$
- **Total Maturity Benefit**: Sum Assured ($₹12,00,000$) + Total Bonuses ($₹1,056,000$) = $₹22,56,000$

---

## 3. Bonus Rates Schedule

In the reference Excel sheet, Column D contains hardcoded bonus rate percentages for each policy year. There is no external formula or lookup table:

| Policy Year | Bonus Rate (%) | Bonus Rate (Decimal) | Bonus on ₹12,00,000 SA (₹) |
|:---:|:---:|:---:|:---:|
| 1 | 2.5% | 0.025 | 30,000 |
| 2 | 3.0% | 0.030 | 36,000 |
| 3 | 3.5% | 0.035 | 42,000 |
| 4 | 3.5% | 0.035 | 42,000 |
| 5 | 3.5% | 0.035 | 42,000 |
| 6 | 3.5% | 0.035 | 42,000 |
| 7 | 3.0% | 0.030 | 36,000 |
| 8 | 3.0% | 0.030 | 36,000 |
| 9 | 3.0% | 0.030 | 36,000 |
| 10 | 3.0% | 0.030 | 36,000 |
| 11 | 3.0% | 0.030 | 36,000 |
| 12 | 2.5% | 0.025 | 30,000 |
| 13 | 3.0% | 0.030 | 36,000 |
| 14 | 3.0% | 0.030 | 36,000 |
| 15 | 2.5% | 0.025 | 30,000 |
| 16 | 5.0% | 0.050 | 60,000 |
| 17 | 4.0% | 0.040 | 48,000 |
| 18 | 4.5% | 0.045 | 54,000 |
| 19 | 4.0% | 0.040 | 48,000 |
| 20 | 25.0% | 0.250 | 300,000 |
| **Sum (Years 1..20)** | **88.0%** | **0.880** | **₹1,056,000** |
| **Sum (Years 1..18, PT)** | **59.0%** | **0.590** | **₹708,000** |

---

## 4. Key Ambiguities and Actuarial Discrepancies Investigated

### 1. Premium Range Validation vs. Sample Value Discrepancy
- **Validation Rule (Inputs Row 16):** `Min: 10,000`, `Max: 50,000`.
- **Sample Input (Inputs Row 6):** `Modal Premium = 80,000`.
- **Findings:** The sample workbook input violates its own stated validation rule ($80,000 > 50,000$).
- **Architecture Decision:**
  - We retain the official specification rules: `MIN_PREMIUM = 10,000`, `MAX_PREMIUM = 50,000`.
  - We expose configuration parameters `PREMIUM_MIN` and `PREMIUM_MAX` via environment variables (`process.env.VALIDATION_PREMIUM_MIN` and `process.env.VALIDATION_PREMIUM_MAX`, default `10000` and `50000`).
  - For testing and parity verification of the sample workbook, a configurable flag `ALLOW_SAMPLE_PREMIUM_OVERRIDE` or test-specific configuration allows premiums up to $80,000$ to reproduce the Excel numbers without silently breaking the production validation contract.

### 2. Sum Assured Validation Rule Text Ambiguity
- **Validation Rule Text (Inputs Row 24):** `"Minimum of 10 times Sum assured or 5000000"`.
- **Actuarial / Regulatory Context:**
  - In Indian Insurance (IRDAI non-linked regulations and Section 10(10D) of Income Tax Act), the standard mandate requires:
    $$\text{Sum Assured} \ge 10 \times \text{Annualized Premium}$$
  - Phrasing `"10 times Sum assured"` is a clear clerical typographical error for `"10 times Premium"`.
  - Furthermore, $₹50,00,000$ ($5$ million INR) represents a standard underwriting cap for simplified non-medical insurance issuances.
- **Interpretation Matrix:**
  - **Interpretation A (Standard IRDAI / Industry Rule):** $\text{Sum Assured} \ge 10 \times \text{Annual Premium}$ AND $\text{Sum Assured} \le 50,00,000$.
  - **Interpretation B (Strict Literal):** $\text{Sum Assured} \ge \min(10 \times \text{Annual Premium}, 50,00,000)$.
  - **Resolution in Code:** Isolate into `validateSumAssured(sumAssured, annualPremium, options)` where options allow configurable bounds. In the sample workbook, $\text{Annual Premium} = 80,000 \implies 10 \times 80,000 = 800,000$, and $\text{Sum Assured} = 1,200,000$, which satisfies both $1,200,000 \ge 800,000$ and $1,200,000 \le 5,000,000$.

### 3. Total Benefit Bonus Accumulation (`SUM(E$1:E$23)` vs. Policy Term)
- **Workbook Formula:** In cell `F21` (Year 18), the formula is `=IF(Inputs!$C$8=A21, C21+SUM(E$1:E$23), 0)`.
- **Observed Behavior:**
  - The range `E$1:E$23` covers all 20 rows of the sheet, regardless of whether $PT=18$ or $PT=20$.
  - This sums all bonuses from Year 1 to 20 ($₹1,056,000$), yielding a total benefit of $₹12,00,000 + ₹1,056,000 = ₹22,56,000$.
  - In a live actuarial contract, a policy ending at Year 18 would normally only accrue bonuses up to Year 18 ($₹708,000$, totaling $₹19,08,000$).
- **Resolution in Code:**
  - The calculation engine implements a clearly named strategy function: `calculateTotalMaturityBenefit(sumAssured, bonusList, policyTerm, strategy)`.
  - **Default Strategy (`EXCEL_STRICT`):** Faithfully matches the workbook formula `SUM(E1:E23)` yielding $₹22,56,000$ and the workbook IRR of $8.415\%$.
  - **Alternative Strategy (`ACTUARIAL_TERM_BOUND`):** Accrues bonuses only up to the maturity year $PT$.
  - Both strategies are documented, configurable, and thoroughly covered by unit tests.

### 4. Premium Frequency Multiplier vs. Modal Premium
- **Workbook Formula:** Column B `=IF(A_r <= Inputs!$C$9, Inputs!$C$6, 0)`.
- **Observed Behavior:** The formula maps directly to `Inputs!$C$6` (`Modal Premium`) without applying frequency factors (e.g. $\times 2$ for Half-Yearly, $\times 12$ for Monthly).
- **Resolution in Code:**
  - `calculateAnnualPremium(modalPremium, frequency, options)`:
    - By default in the Excel workbook, the sample frequency is `Yearly`, so Modal Premium = Annual Premium = $80,000$.
    - For `Half-Yearly` and `Monthly`, the engine provides configurable behavior (`PASS_THROUGH` vs `ANNUALIZED_FACTOR`), cleanly logging the operational assumptions.

### 5. Age Calculation (Completed Birthdays)
- **Validation Rule (Inputs Row 26):** `Min 23 and Max 56`.
- **Implementation:**
  - Calculates completed age as of evaluation date:
    $$\text{Age} = \text{Year}(\text{asOfDate}) - \text{Year}(\text{DOB}) - (\text{asOfDate} < \text{DOB birthday this year} ? 1 : 0)$$
  - For sample DOB `1999-12-12` as of current date `2026-10-12`:
    - 2026 birthday has not occurred yet.
    - Completed age is $2026 - 1999 - 1 = 26$ years.
    - $23 \le 26 \le 56$, valid.

---

## 5. Verification Matrix Against Excel Reference

| Parameter | Excel Expected | Engine Implementation | Match Status |
|---|---|---|---|
| Customer Age (as of 2026-10-12) | 26 years | `calculateAge('1999-12-12')` $\to 26$ | **MATCH** |
| Policy Term ($PT$) | 18 | 18 | **MATCH** |
| Premium Paying Term ($PPT$) | 10 | 10 | **MATCH** |
| Annual Premium (Yr 1..10) | ₹80,000 | ₹80,000 | **MATCH** |
| Annual Premium (Yr 11..20) | ₹0 | ₹0 | **MATCH** |
| Total Premium Paid | ₹800,000 | ₹800,000 | **MATCH** |
| Bonus Amount Yr 1 (2.5%) | ₹30,000 | ₹30,000 | **MATCH** |
| Bonus Amount Yr 3..6 (3.5%) | ₹42,000 each | ₹42,000 each | **MATCH** |
| Bonus Amount Yr 20 (25.0%) | ₹300,000 | ₹300,000 | **MATCH** |
| Total Bonus (20 Yrs) | ₹1,056,000 | ₹1,056,000 | **MATCH** |
| Maturity Benefit (Yr 18) | ₹2,256,000 | ₹2,256,000 | **MATCH** |
| Year 1..10 Net Cashflow | -₹80,000 | -₹80,000 | **MATCH** |
| Year 18 Net Cashflow | +₹2,256,000 | +₹2,256,000 | **MATCH** |
| Policy IRR (Cell G2) | 8.415015% | 8.415015% | **MATCH** |

