import React, { useState, useEffect } from "react";
import { illustrationAPI } from "../services/api";

export default function BulkProcessing() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV file to upload.");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await illustrationAPI.bulkUpload(formData);
      if (res.data.success) {
        setActiveJob({
          id: res.data.jobId,
          total_records: res.data.totalRecords,
          processed_records: 0,
          successful_records: 0,
          failed_records: 0,
          status: "PROCESSING",
        });
        setPolling(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  // Poll job status every 1.5 seconds while job is processing
  useEffect(() => {
    let interval = null;
    if (polling && activeJob?.id) {
      interval = setInterval(async () => {
        try {
          const res = await illustrationAPI.getBulkJobStatus(activeJob.id);
          if (res.data.success && res.data.job) {
            const job = res.data.job;
            setActiveJob(job);
            if (job.status === "COMPLETED" || job.status === "FAILED") {
              setPolling(false);
            }
          }
        } catch (err) {
          console.error("Failed to poll bulk job status:", err);
          setPolling(false);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [polling, activeJob?.id]);

  const downloadSampleCSV = () => {
    const sampleHeaders =
      "dob,gender,sumAssured,modalPremium,frequency,pt,ppt\n";
    const sampleRows = [
      "1999-12-12,M,1200000,40000,Yearly,18,10",
      "1995-05-20,F,1500000,45000,Yearly,20,10",
      "1990-08-14,M,1000000,35000,Yearly,15,8",
    ].join("\n");

    const blob = new Blob([sampleHeaders + sampleRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_policies_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const progressPercent = activeJob?.total_records
    ? Math.round((activeJob.processed_records / activeJob.total_records) * 100)
    : 0;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-bold mb-1">Bulk Policy Processing</h3>
          <p className="text-muted small mb-0">
            Asynchronous background calculation engine prototype for batch
            benefit illustration processing
          </p>
        </div>
        <div>
          <button
            onClick={downloadSampleCSV}
            className="btn btn-outline-secondary btn-sm"
          >
            ⬇️ Download Sample CSV
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* Upload Form */}
        <div className="col-lg-5">
          <div className="card shadow-sm p-4">
            <h5 className="fw-bold mb-3">Upload Policy Batch</h5>

            {error && (
              <div className="alert alert-danger py-2 small">{error}</div>
            )}

            <form onSubmit={handleUpload}>
              <div className="mb-3">
                <label className="form-label small fw-semibold">
                  Choose CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  className="form-control"
                  onChange={handleFileChange}
                  disabled={uploading || polling}
                />
                <div className="form-text" style={{ fontSize: "0.75rem" }}>
                  Expected columns:{" "}
                  <code>
                    dob, gender, sumAssured, modalPremium, frequency, pt, ppt
                  </code>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 fw-semibold"
                disabled={uploading || polling || !file}
              >
                {uploading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    ></span>
                    Uploading & Starting Job...
                  </>
                ) : (
                  "Start Bulk Processing"
                )}
              </button>
            </form>

            <div className="border-top mt-4 pt-3 text-muted small">
              <h6 className="fw-semibold text-dark mb-1">
                Scalability & Millions of Records:
              </h6>
              <p className="mb-1" style={{ fontSize: "0.8rem" }}>
                This prototype demonstrates asynchronous batch processing. For
                production at scale (millions of inputs):
              </p>
              <ul className="mb-0 ps-3" style={{ fontSize: "0.78rem" }}>
                <li>Chunked CSV streams via AWS S3 / Object Storage</li>
                <li>Distributed queue (BullMQ / RabbitMQ)</li>
                <li>Horizontal worker scaling with idempotency checks</li>
                <li>
                  Bulk PostgreSQL <code>COPY</code> / batch inserts
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="col-lg-7">
          {activeJob ? (
            <div className="card shadow-sm p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0">Job Status</h5>
                <span
                  className={`badge ${
                    activeJob.status === "COMPLETED"
                      ? "bg-success"
                      : activeJob.status === "FAILED"
                        ? "bg-danger"
                        : "bg-primary"
                  }`}
                >
                  {activeJob.status}
                </span>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="progress" style={{ height: "10px" }}>
                  <div
                    className={`progress-bar ${
                      activeJob.status === "COMPLETED"
                        ? "bg-success"
                        : "progress-bar-striped progress-bar-animated"
                    }`}
                    role="progressbar"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="row g-2 text-center my-3">
                <div className="col-3">
                  <div className="p-2 border rounded bg-light">
                    <div className="text-muted small">Total</div>
                    <div className="fs-5 fw-bold">
                      {activeJob.total_records}
                    </div>
                  </div>
                </div>
                <div className="col-3">
                  <div className="p-2 border rounded bg-light">
                    <div className="text-muted small">Processed</div>
                    <div className="fs-5 fw-bold">
                      {activeJob.processed_records}
                    </div>
                  </div>
                </div>
                <div className="col-3">
                  <div className="p-2 border rounded bg-light">
                    <div className="text-muted small">Successful</div>
                    <div className="fs-5 fw-bold text-success">
                      {activeJob.successful_records}
                    </div>
                  </div>
                </div>
                <div className="col-3">
                  <div className="p-2 border rounded bg-light">
                    <div className="text-muted small">Failed</div>
                    <div className="fs-5 fw-bold text-danger">
                      {activeJob.failed_records}
                    </div>
                  </div>
                </div>
              </div>

              {activeJob.failed_records > 0 && activeJob.error_message && (
                <div className="alert alert-warning py-2 px-3 my-3 small border-start border-4 border-warning">
                  <div className="fw-bold mb-1 d-flex align-items-center">
                    <span className="me-1">⚠️</span> Reasons Why Records Failed:
                  </div>
                  <pre
                    className="mb-0 text-dark bg-white p-2 rounded border"
                    style={{
                      fontSize: "0.78rem",
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    {activeJob.error_message}
                  </pre>
                </div>
              )}

              <div className="small text-muted border-top pt-2 mt-2">
                <div>
                  <strong>Job ID:</strong> <code>{activeJob.id}</code>
                </div>
                {activeJob.status === "COMPLETED" && (
                  <div className="text-success mt-2">
                    ✅ Batch calculations completed! You can review the
                    processed policies under{" "}
                    <a href="/history">Saved Illustrations</a>.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card shadow-sm p-5 text-center text-muted">
              <div className="fs-1 mb-2">⚡</div>
              <h5 className="fw-semibold">No Active Bulk Job</h5>
              <p className="small mb-0">
                Upload a CSV file on the left to start an asynchronous
                calculation job.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
