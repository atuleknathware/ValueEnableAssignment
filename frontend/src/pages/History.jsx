import React, { useState, useEffect } from 'react';
import { illustrationAPI } from '../services/api';

export default function History() {
  const [illustrations, setIllustrations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedIllustration, setSelectedIllustration] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchHistory(pagination.page);
  }, [pagination.page]);

  const fetchHistory = async (page) => {
    setLoading(true);
    try {
      const res = await illustrationAPI.getHistory(page, pagination.limit);
      if (res.data.success) {
        setIllustrations(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const res = await illustrationAPI.getById(id);
      if (res.data.success) {
        setSelectedIllustration(res.data.data);
      }
    } catch (err) {
      alert('Failed to load illustration details');
    } finally {
      setLoadingDetails(false);
    }
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
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-bold mb-1">Saved Illustrations</h3>
          <p className="text-muted small mb-0">View and download your previously saved benefit calculation schedules</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted small mt-2">Loading saved illustrations...</p>
        </div>
      ) : illustrations.length === 0 ? (
        <div className="card shadow-sm p-5 text-center text-muted">
          <div className="fs-1 mb-2">📂</div>
          <h5 className="fw-semibold">No Saved Illustrations Found</h5>
          <p className="small mb-3">You haven't saved any benefit calculations to your account yet.</p>
          <div>
            <a href="/" className="btn btn-primary btn-sm px-4">
              Calculate a Policy
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="card shadow-sm overflow-hidden mb-3">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-end">
                <thead className="table-light">
                  <tr>
                    <th className="text-start">Plan Name</th>
                    <th>Sum Assured</th>
                    <th>Premium</th>
                    <th className="text-center">Term (PT/PPT)</th>
                    <th>Maturity Benefit</th>
                    <th className="text-center">IRR</th>
                    <th className="text-center">Date Saved</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {illustrations.map((ill) => (
                    <tr key={ill.id}>
                      <td className="text-start fw-semibold">{ill.policy_name}</td>
                      <td>{formatINR(ill.sum_assured)}</td>
                      <td>{formatINR(ill.modal_premium)}</td>
                      <td className="text-center">
                        <span className="badge bg-secondary-subtle text-secondary-emphasis">
                          {ill.pt}y / {ill.ppt}y
                        </span>
                      </td>
                      <td className="fw-bold text-success">{formatINR(ill.maturity_benefit)}</td>
                      <td className="text-center fw-semibold text-warning">
                        {ill.irr_percentage ? `${ill.irr_percentage}%` : 'N/A'}
                      </td>
                      <td className="text-center text-muted small">
                        {new Date(ill.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button
                            onClick={() => handleViewDetails(ill.id)}
                            className="btn btn-outline-primary"
                            title="View Full Schedule"
                          >
                            View
                          </button>
                          <a
                            href={illustrationAPI.exportCSVUrl(ill.id)}
                            download
                            className="btn btn-outline-secondary"
                            title="Download CSV"
                          >
                            CSV
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted small">
                Showing {illustrations.length} of {pagination.total} records
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  className="btn btn-outline-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </button>
                <button className="btn btn-outline-secondary active" disabled>
                  {pagination.page} / {pagination.totalPages}
                </button>
                <button
                  className="btn btn-outline-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal / Drawer */}
      {selectedIllustration && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {selectedIllustration.policy.policyName} &mdash; Details
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedIllustration(null)}
                ></button>
              </div>
              <div className="modal-body p-4">
                {/* Summary Metrics */}
                <div className="row g-3 mb-4">
                  <div className="col-md-3">
                    <div className="metric-card shadow-sm border-start border-4 border-primary">
                      <div className="metric-label">Sum Assured</div>
                      <div className="metric-value">{formatINR(selectedIllustration.policy.sumAssured)}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="metric-card shadow-sm border-start border-4 border-info">
                      <div className="metric-label">Total Premiums Paid</div>
                      <div className="metric-value">{formatINR(selectedIllustration.policy.totalPremiumsPaid)}</div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="metric-card shadow-sm border-start border-4 border-success">
                      <div className="metric-label">Maturity Benefit</div>
                      <div className="metric-value text-success">
                        {formatINR(selectedIllustration.policy.maturityBenefit)}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="metric-card shadow-sm border-start border-4 border-warning">
                      <div className="metric-label">Policy IRR</div>
                      <div className="metric-value text-warning">
                        {selectedIllustration.policy.irrPercentage
                          ? `${selectedIllustration.policy.irrPercentage}%`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table */}
                <h6 className="fw-bold mb-2">20-Year Schedule</h6>
                <div className="table-responsive" style={{ maxHeight: '400px' }}>
                  <table className="table table-hover table-sm align-middle text-end mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th className="text-center">Year</th>
                        <th>Premium</th>
                        <th>Sum Assured</th>
                        <th className="text-center">Bonus Rate</th>
                        <th>Bonus Amount</th>
                        <th>Total Benefit</th>
                        <th>Net Cashflows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedIllustration.schedule.map((r) => (
                        <tr
                          key={r.policyYear}
                          className={r.policyYear === selectedIllustration.policy.pt ? 'maturity-row' : ''}
                        >
                          <td className="text-center fw-semibold">{r.policyYear}</td>
                          <td>{formatINR(r.premium)}</td>
                          <td>{formatINR(r.sumAssured)}</td>
                          <td className="text-center">{(r.bonusRate * 100).toFixed(2)}%</td>
                          <td>{formatINR(r.bonusAmount)}</td>
                          <td className="fw-semibold">{formatINR(r.totalBenefit)}</td>
                          <td className={`fw-semibold ${r.netCashflow < 0 ? 'text-danger' : r.netCashflow > 0 ? 'text-success' : 'text-muted'}`}>
                            {formatINR(r.netCashflow)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <a
                  href={illustrationAPI.exportCSVUrl(selectedIllustration.id)}
                  download
                  className="btn btn-outline-secondary btn-sm"
                >
                  Download CSV
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedIllustration(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

