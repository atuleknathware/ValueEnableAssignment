import React, { useState, useEffect } from 'react';
import { illustrationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Calculator() {
  const { user, isAuthenticated } = useAuth();

  const [catalog, setCatalog] = useState({
    policyTypes: [
      { id: 'ENDOWMENT', name: 'Traditional Participating Endowment Plan' },
      { id: 'MONEY_BACK', name: 'Periodic Money-Back Savings Plan' },
      { id: 'WHOLE_LIFE', name: 'Whole Life Guaranteed Protection Plan' },
    ],
    riders: [
      { id: 'ACCIDENTAL_DEATH', name: 'Accidental Death Benefit (ADB) Rider' },
      { id: 'CRITICAL_ILLNESS', name: 'Critical Illness (CI) Care Rider' },
      { id: 'WAIVER_OF_PREMIUM', name: 'Waiver of Premium (WoP) Disability Rider' },
    ],
    samplePolicies: [],
  });

  const [form, setForm] = useState({
    dob: '1999-12-12',
    gender: 'M',
    policyType: 'ENDOWMENT',
    riders: [],
    sumAssured: 1200000,
    modalPremium: 40000,
    premiumFrequency: 'Yearly',
    pt: 18,
    ppt: 10,
    policyName: 'My Benefit Illustration',
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState([]);

  // Fetch Policy Catalog & Sample Policies from backend API on mount
  useEffect(() => {
    illustrationAPI
      .getCatalog()
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          setCatalog(res.data.data);
        }
      })
      .catch(() => {
        // Fallback to default local catalog if offline
      });
  }, []);

  // Auto-fill DOB from authenticated user if available
  useEffect(() => {
    if (user && user.rawDob) {
      setForm((prev) => ({ ...prev, dob: user.rawDob }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrors([]);
    setSaveSuccess(false);
  };

  const handleRiderToggle = (riderId) => {
    setForm((prev) => {
      const exists = prev.riders.includes(riderId);
      const nextRiders = exists
        ? prev.riders.filter((id) => id !== riderId)
        : [...prev.riders, riderId];
      return { ...prev, riders: nextRiders };
    });
    setErrors([]);
    setSaveSuccess(false);
  };

  // Quick load official sample scenario from assignment_reference_sample (1).xlsm
  const loadExcelSample = () => {
    const excelPreset = catalog.samplePolicies?.find((s) => s.id === 'SAMPLE-EXCEL-REF');
    if (excelPreset) {
      setForm({
        dob: excelPreset.dob,
        gender: excelPreset.gender,
        policyType: excelPreset.policyType || 'ENDOWMENT',
        riders: excelPreset.riders || [],
        sumAssured: excelPreset.sumAssured,
        modalPremium: excelPreset.modalPremium,
        premiumFrequency: excelPreset.premiumFrequency,
        pt: excelPreset.pt,
        ppt: excelPreset.ppt,
        policyName: excelPreset.policyName,
      });
    } else {
      setForm({
        dob: '1999-12-12',
        gender: 'M',
        policyType: 'ENDOWMENT',
        riders: [],
        sumAssured: 1200000,
        modalPremium: 80000,
        premiumFrequency: 'Yearly',
        pt: 18,
        ppt: 10,
        policyName: 'Excel Sample Reference Policy',
      });
    }
    setErrors([]);
    setSaveSuccess(false);
  };

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrors([]);
    setSaveSuccess(false);

    try {
      const res = await illustrationAPI.calculate({
        ...form,
        sumAssured: Number(form.sumAssured),
        modalPremium: Number(form.modalPremium),
        pt: parseInt(form.pt, 10),
        ppt: parseInt(form.ppt, 10),
      });

      if (res.data.success) {
        setResult(res.data.data);
      }
    } catch (err) {
      const respErrors = err.response?.data?.errors;
      const respMsg = err.response?.data?.message;
      if (respErrors && Array.isArray(respErrors)) {
        setErrors(respErrors);
      } else if (respMsg) {
        setErrors([respMsg]);
      } else {
        setErrors(['Calculation failed. Please verify the input values.']);
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !isAuthenticated) return;
    setSaving(true);
    try {
      const res = await illustrationAPI.save({
        calculationData: result,
        policyName: form.policyName,
      });
      if (res.data.success) {
        setSaveSuccess(true);
      }
    } catch (err) {
      alert('Failed to save illustration: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!result) return;
    const { customer, policy, schedule } = result;

    const headers = [
      'Policy Year,Premium (INR),Sum Assured (INR),Bonus Rate,Bonus Amount (INR),Total Benefit (INR),Net Cashflow (INR)',
    ];
    const rows = schedule.map((r) =>
      [
        r.policyYear,
        r.premium,
        r.sumAssured,
        `${(r.bonusRate * 100).toFixed(2)}%`,
        r.bonusAmount,
        r.totalBenefit,
        r.netCashflow,
      ].join(',')
    );

    const meta = [
      `"Benefit Illustration Report"`,
      `"Customer Age: ${customer.age}"`,
      `"Sum Assured: ₹${policy.sumAssured.toLocaleString('en-IN')}"`,
      `"Modal Premium: ₹${policy.modalPremium.toLocaleString('en-IN')}"`,
      `"Policy Term (PT): ${policy.pt} yrs"`,
      `"Premium Paying Term (PPT): ${policy.ppt} yrs"`,
      `"Total Premiums Paid: ₹${policy.totalPremiumsPaid.toLocaleString('en-IN')}"`,
      `"Maturity Benefit: ₹${policy.maturityBenefit.toLocaleString('en-IN')}"`,
      `"Policy IRR: ${policy.irrPercentage}%"`,
      '',
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([...meta, ...headers, ...rows].join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `illustration-PT${policy.pt}-PPT${policy.ppt}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatINR = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0';
    const num = Number(val);
    const abs = Math.abs(num);
    const str = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return num < 0 ? `-₹${str}` : `₹${str}`;
  };

  return (
    <div className="container py-4">
      {/* Top Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-bold mb-1">Benefit Illustration Calculator</h3>
          <p className="text-muted small mb-0">
            Engine based on the reference model: <code>assignment_reference_sample (1).xlsm</code>
          </p>
        </div>
        <div className="d-flex gap-2 mt-2 mt-sm-0">
          <button onClick={loadExcelSample} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
            <span>📋</span> Load Excel Sample Scenario
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Input Form */}
        <div className="col-lg-4">
          <div className="card shadow-sm p-3">
            <h5 className="fw-bold mb-3 border-bottom pb-2">Policy Parameters</h5>

            {errors.length > 0 && (
              <div className="alert alert-danger py-2 px-3 small mb-3">
                <div className="fw-semibold mb-1">Validation Errors:</div>
                <ul className="mb-0 ps-3">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleCalculate}>
              {/* Policy Type */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Policy Type</label>
                <select
                  name="policyType"
                  className="form-select form-select-sm"
                  value={form.policyType}
                  onChange={handleChange}
                >
                  {catalog.policyTypes.map((ptItem) => (
                    <option key={ptItem.id} value={ptItem.id}>
                      {ptItem.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DOB & Gender */}
              <div className="row mb-3">
                <div className="col-7">
                  <label className="form-label small fw-semibold">Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    className="form-control form-control-sm"
                    value={form.dob}
                    onChange={handleChange}
                    required
                  />
                  <div className="form-text" style={{ fontSize: '0.72rem' }}>
                    Age: 23 to 56 years
                  </div>
                </div>
                <div className="col-5">
                  <label className="form-label small fw-semibold">Gender</label>
                  <select
                    name="gender"
                    className="form-select form-select-sm"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Modal Premium & Frequency */}
              <div className="row mb-3">
                <div className="col-7">
                  <label className="form-label small fw-semibold">Modal Premium (₹)</label>
                  <input
                    type="number"
                    name="modalPremium"
                    className="form-control form-control-sm"
                    min="1"
                    step="any"
                    value={form.modalPremium}
                    onChange={handleChange}
                    required
                  />
                  <div className="form-text" style={{ fontSize: '0.72rem' }}>
                    Enter any premium amount (e.g. ₹80,000)
                  </div>
                </div>
                <div className="col-5">
                  <label className="form-label small fw-semibold">Frequency</label>
                  <select
                    name="premiumFrequency"
                    className="form-select form-select-sm"
                    value={form.premiumFrequency}
                    onChange={handleChange}
                  >
                    <option value="Yearly">Yearly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Sum Assured */}
              <div className="mb-3">
                <label className="form-label small fw-semibold">Sum Assured (₹)</label>
                <input
                  type="number"
                  name="sumAssured"
                  className="form-control form-control-sm"
                  min="100000"
                  step="any"
                  value={form.sumAssured}
                  onChange={handleChange}
                  required
                />
                <div className="form-text" style={{ fontSize: '0.72rem' }}>
                  Min 10x Annual Premium, Max ₹50,00,000
                </div>
              </div>

              {/* PT & PPT */}
              <div className="row mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold">Policy Term (PT)</label>
                  <input
                    type="number"
                    name="pt"
                    className="form-control form-control-sm"
                    min="10"
                    max="20"
                    value={form.pt}
                    onChange={handleChange}
                    required
                  />
                  <div className="form-text" style={{ fontSize: '0.72rem' }}>
                    10 to 20 yrs (PT &gt; PPT)
                  </div>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">Paying Term (PPT)</label>
                  <input
                    type="number"
                    name="ppt"
                    className="form-control form-control-sm"
                    min="5"
                    max="10"
                    value={form.ppt}
                    onChange={handleChange}
                    required
                  />
                  <div className="form-text" style={{ fontSize: '0.72rem' }}>
                    5 to 10 yrs
                  </div>
                </div>
              </div>

              {/* Optional Riders */}
              <div className="mb-3">
                <label className="form-label small fw-semibold mb-1">Optional Riders</label>
                <div className="border rounded p-2 bg-light">
                  {catalog.riders.map((rider) => (
                    <div className="form-check small" key={rider.id}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`rider-${rider.id}`}
                        checked={form.riders.includes(rider.id)}
                        onChange={() => handleRiderToggle(rider.id)}
                      />
                      <label className="form-check-label" htmlFor={`rider-${rider.id}`}>
                        {rider.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy Name (for saving) */}
              {isAuthenticated && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Plan Nickname</label>
                  <input
                    type="text"
                    name="policyName"
                    className="form-control form-control-sm"
                    value={form.policyName}
                    onChange={handleChange}
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary w-100 fw-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Calculating...
                  </>
                ) : (
                  'Calculate Benefit Illustration'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Illustration Results */}
        <div className="col-lg-8">
          {!result && !loading && (
            <div className="card shadow-sm p-5 text-center text-muted">
              <div className="fs-1 mb-2">📊</div>
              <h5 className="fw-semibold">No Illustration Generated Yet</h5>
              <p className="small mb-3">
                Fill in the policy parameters on the left or click "Load Excel Sample Scenario" to generate the full year-by-year benefit illustration.
              </p>
              <div>
                <button onClick={loadExcelSample} className="btn btn-primary btn-sm px-4">
                  Load Reference Excel Scenario
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="card shadow-sm p-5 text-center text-muted">
              <div className="spinner-border text-primary mx-auto mb-3" role="status"></div>
              <h6>Calculating Benefit Projection Schedule...</h6>
            </div>
          )}

          {result && !loading && (
            <div className="d-flex flex-column gap-3">
              {/* Summary Cards */}
              <div className="row g-2">
                <div className="col-sm-6 col-md-3">
                  <div className="metric-card shadow-sm border-start border-4 border-primary">
                    <div className="metric-label">Customer Age</div>
                    <div className="metric-value">{result.customer.age} yrs</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      DOB: {result.customer.dob}
                    </div>
                  </div>
                </div>

                <div className="col-sm-6 col-md-3">
                  <div className="metric-card shadow-sm border-start border-4 border-info">
                    <div className="metric-label">Total Premiums Paid</div>
                    <div className="metric-value">{formatINR(result.policy.totalPremiumsPaid)}</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {result.policy.ppt} installments ({result.policy.premiumFrequency})
                    </div>
                  </div>
                </div>

                <div className="col-sm-6 col-md-3">
                  <div className="metric-card shadow-sm border-start border-4 border-success">
                    <div className="metric-label">Maturity Benefit</div>
                    <div className="metric-value text-success">{formatINR(result.policy.maturityBenefit)}</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      At Year {result.policy.pt}
                    </div>
                  </div>
                </div>

                <div className="col-sm-6 col-md-3">
                  <div className="metric-card shadow-sm border-start border-4 border-warning">
                    <div className="metric-label">Policy IRR</div>
                    <div className="metric-value text-warning">
                      {result.policy.irrPercentage !== null ? `${result.policy.irrPercentage}%` : 'N/A'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      Annualized Return
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Status */}
              <div className="d-flex flex-wrap justify-content-between align-items-center bg-white p-2 px-3 rounded shadow-sm border gap-2">
                <div className="small">
                  <div>
                    <strong>Plan Type:</strong>{' '}
                    <span className="badge bg-primary-subtle text-primary-emphasis me-2">
                      {result.policy.policyTypeName || result.policy.policyType}
                    </span>
                    <strong>Total Bonus Accrued:</strong>{' '}
                    <span className="text-primary fw-semibold">{formatINR(result.policy.totalBonusAccrued)}</span>
                  </div>
                  {result.policy.riders && result.policy.riders.length > 0 && (
                    <div className="mt-1">
                      <strong>Selected Riders:</strong>{' '}
                      {result.policy.riders.map((r) => (
                        <span key={r.id} className="badge bg-secondary-subtle text-secondary-emphasis me-1">
                          {r.name} {r.riderSumAssured > 0 ? `(Cover: ${formatINR(r.riderSumAssured)})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <button onClick={handleExportCSV} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                    <span>⬇️</span> Export CSV
                  </button>
                  {isAuthenticated ? (
                    <button
                      onClick={handleSave}
                      className="btn btn-success btn-sm d-flex align-items-center gap-1"
                      disabled={saving || saveSuccess}
                    >
                      <span>💾</span> {saveSuccess ? 'Saved!' : saving ? 'Saving...' : 'Save Illustration'}
                    </button>
                  ) : (
                    <span className="text-muted small align-self-center">Log in to save</span>
                  )}
                </div>
              </div>

              {saveSuccess && (
                <div className="alert alert-success py-2 px-3 small mb-0">
                  Illustration successfully saved to your account! You can view it anytime under <strong>Saved Illustrations</strong>.
                </div>
              )}

              {/* Year-by-Year Illustration Table */}
              <div className="card shadow-sm overflow-hidden">
                <div className="card-header bg-white py-2 px-3 d-flex justify-content-between align-items-center">
                  <h6 className="fw-bold mb-0">Year-Wise Benefit Illustration Schedule (20 Years)</h6>
                  <span className="badge bg-light text-dark border">Currency: INR (₹)</span>
                </div>
                <div className="table-responsive" style={{ maxHeight: '520px' }}>
                  <table className="table table-hover table-sm align-middle mb-0 text-end">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th className="text-center" style={{ width: '60px' }}>Policy Year</th>
                        <th>Premium</th>
                        <th>Sum Assured</th>
                        <th className="text-center">Bonus Rate</th>
                        <th>Bonus Amount</th>
                        <th>Total Benefit</th>
                        <th>Net Cashflows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.schedule.map((row) => {
                        const isMaturityYear = row.policyYear === result.policy.pt;
                        return (
                          <tr key={row.policyYear} className={isMaturityYear ? 'maturity-row' : ''}>
                            <td className="text-center fw-semibold">
                              {row.policyYear}
                              {isMaturityYear && (
                                <span className="badge bg-success ms-1" style={{ fontSize: '0.65rem' }}>
                                  Maturity
                                </span>
                              )}
                            </td>
                            <td>{formatINR(row.premium)}</td>
                            <td>{formatINR(row.sumAssured)}</td>
                            <td className="text-center">{(row.bonusRate * 100).toFixed(2)}%</td>
                            <td>{formatINR(row.bonusAmount)}</td>
                            <td className={isMaturityYear ? 'fw-bold text-success' : ''}>
                              {formatINR(row.totalBenefit)}
                            </td>
                            <td
                              className={`fw-semibold ${
                                row.netCashflow < 0 ? 'text-danger' : row.netCashflow > 0 ? 'text-success' : 'text-muted'
                              }`}
                            >
                              {formatINR(row.netCashflow)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

