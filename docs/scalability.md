# Scalability Architecture: Processing Millions of Inputs & Outputs

**Module:** Benefit Illustration Calculation Engine  
**Target Throughput:** $10^6+$ (Millions) of Policies & Cashflow Illustrations  

---

## 1. System Architecture Overview

When transitioning from interactive web calculators (hundreds of requests per minute) to enterprise bulk processing (millions of policy evaluations from corporate partners, banking channels, or actuarial revaluation runs), a synchronous API model causes connection timeouts, CPU starvation, and Out-Of-Memory (OOM) crashes.

The system adopts an **Asynchronous Distributed Worker Architecture**:

```
[ Client / Partner ] 
         |
         | 1. Upload CSV / Excel (Multipart Stream)
         v
[ API Gateway / Express API ] 
         |
         | 2. Store file in S3 / GCS
         | 3. Create Bulk Job (Status: PENDING)
         v
[ Distributed Message Broker (BullMQ / Redis or RabbitMQ) ]
         |
         | 4. Partition into Chunks (e.g., 5,000 policies / chunk)
         v
+------------------+------------------+------------------+
|  Worker Node 1   |  Worker Node 2   |  Worker Node N   |
| (Docker / K8s)   | (Docker / K8s)   | (Horizontal Auto)|
+------------------+------------------+------------------+
         |                  |                  |
         +------------------+------------------+
                            |
                            | 5. Run illustrationService engine
                            | 6. Batch Bulk Insert (PostgreSQL COPY)
                            v
             [ PostgreSQL Database Cluster ]
             - Write replica / Read replicas
             - Partitioned illustration tables
                            |
                            v
             [ Results Object Store (CSV Export) ]
```

---

## 2. Step-by-Step Processing Pipeline

### Step 1: Secure File Ingestion & Storage
- **Streaming Upload:** Files are streamed directly to cloud object storage (AWS S3, Google Cloud Storage, or MinIO) using multipart uploads.
- **Memory Guard:** The API server never buffers a 500MB+ CSV file into Node.js heap memory.
- **Sanitization:** MIME type, header schema, and file signatures are validated before job dispatch.

### Step 2: Job Registration & Idempotency
- A unique UUID `jobId` is generated and recorded in `bulk_jobs` table.
- **Idempotency Key:** If an upload includes an idempotency header (`X-Idempotency-Key` or file SHA-256 hash), duplicate uploads are rejected or return the existing job status, preventing duplicate batch runs.

### Step 3: Work Distribution via Message Queue
- Instead of queueing 1 million individual messages, a **Job Splitter** breaks the file into chunk jobs of configurable size (e.g., 2,500 to 5,000 policies per message).
- **Queuing System:** **BullMQ on Redis** or **RabbitMQ**:
  - Supports concurrency controls and rate limiting.
  - Automatic retry with exponential backoff for transient database errors.
  - Priority queuing for critical underwriting tasks.

### Step 4: Worker Engine Execution
- Worker nodes pull chunks from the queue.
- Each worker executes the **identical core actuarial calculation engine** (`illustrationService.js`):
  - Completed-birthday age determination.
  - Year-by-year benefit formulas matching `assignment_reference_sample (1).xlsm`.
  - Newton-Raphson IRR solver.
- Calculations are stateless and pure JavaScript functions, allowing CPU-bound worker threads or multi-process cluster forks (`worker_threads`).

### Step 5: High-Performance Database Persistence
- Writing millions of rows with standard single-record `INSERT` statements produces massive network roundtrip overhead.
- **Optimization Strategy:**
  1. **PostgreSQL `COPY` Protocol:** Workers use `pg-copy-streams` to stream tabular CSV directly into PostgreSQL at 50,000+ rows/second.
  2. **Unnest / Multi-row parameterized inserts:**
     ```sql
     INSERT INTO illustration_schedules (illustration_id, policy_year, premium, ...)
     SELECT * FROM UNNEST($1::int[], $2::int[], $3::numeric[], ...);
     ```
  3. **Table Partitioning:** The `illustration_schedules` table is partitioned by range (e.g. by `illustration_id` ranges or monthly partitions) to maintain B-tree index performance.

### Step 6: Progress Tracking & Real-Time Monitoring
- Workers update processed, successful, and failed counts atomically in the database (`UPDATE bulk_jobs SET processed_records = processed_records + batchSize ...`).
- Clients poll `GET /api/illustrations/bulk-jobs/:id` or subscribe via WebSockets / Server-Sent Events (SSE).

### Step 7: Export & Streaming Results Download
- When processing completes, workers stream the combined result set to an S3 bucket and generate a signed pre-signed download URL.
- Clients download pre-compressed Gzip/CSV files directly from object storage without burdening the API server.

---

## 3. Resilience, Fault Tolerance & Error Handling

| Concern | Failure Scenario | Architectural Remedy |
|---|---|---|
| **Worker Crash** | Node runs out of memory or pod gets evicted mid-batch | BullMQ automatic lock renewal and stalled job recovery; unacknowledged chunk is reassigned to another healthy worker. |
| **Malformed Records** | Row 4,520 has an invalid date of birth | Individual invalid rows are recorded in `bulk_job_records` with error details, while the rest of the batch continues uninterrupted. |
| **Database Backpressure** | Database connection pool exhausted | Dynamic worker concurrency throttling and connection pooling with PgBouncer. |
| **Dead-Letter Queue (DLQ)** | Record repeatedly fails calculation | Moved to DLQ after 3 retries for offline inspection without blocking the queue. |

---

## 4. Implemented Prototype vs. Enterprise Enhancements

| Feature | Implemented in Current Submission | Proposed Enterprise Scale Enhancement |
|---|---|---|
| **Calculation Service** | ✅ Fully implemented, tested, identical for single & bulk | Core engine packaged as optimized C++/Rust N-API addon if extreme throughput needed |
| **Bulk API Endpoint** | ✅ `POST /api/illustrations/bulk-upload` | Direct multipart presigned upload to S3 |
| **Asynchronous Background Processing** | ✅ Asynchronous event loop batch worker | Distributed BullMQ / RabbitMQ with K8s HPA worker pods |
| **Progress Polling** | ✅ `GET /api/illustrations/bulk-jobs/:id` | WebSockets / SSE push notifications |
| **Record Tracking** | ✅ `bulk_jobs` and `bulk_job_records` tables | Dedicated TimescaleDB or ClickHouse analytical datastore |
| **Database Schema** | ✅ Fully relational with foreign keys & indexes | Table partitioning & PgBouncer connection multiplexing |

