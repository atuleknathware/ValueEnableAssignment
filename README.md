# Benefit Illustration Module

A production-grade, full-stack web application and actuarial calculation engine for traditional life insurance Benefit Illustrations (BI), built strictly according to the reference model `assignment_reference_sample (1).xlsm`.

---

## 1. Overview & Architecture

This application delivers a complete life insurance Benefit Illustration module:
- **Actuarial Calculation Engine:** Accurately reproduces the 20-year projection table, bonus accruals, maturity benefits, annual cash flows, and policy Internal Rate of Return (IRR) matching the Excel workbook.
- **5 Assignment Validations:** Rigorously enforces policy term, premium paying term, completed birthday age limits, premium boundaries, and sum assured multiples.
- **Enterprise Security:** AES-256-GCM authenticated encryption for sensitive customer fields (DOB, mobile), bcrypt password hashing, and UI/log data masking.
- **Scalable Architecture:** Asynchronous batch processing design with prototype endpoint for processing large-scale policy submissions.
- **Modern UI:** Responsive React application with Vite, Bootstrap, real-time validation, dynamic 20-year schedule, and CSV export.

```
                    +-----------------------------+
                    |    React Frontend (Vite)    |
                    |  - Policy Form & Validation |
                    |  - Dynamic 20-Year Schedule |
                    |  - CSV Export & Bulk UI     |
                    +-----------------------------+
                                   |
                             Axios / JWT
                                   v
                    +-----------------------------+
                    |     Express.js API Server   |
                    |  - Helmet & Rate Limiting   |
                    |  - express-validator        |
                    |  - JWT Authentication       |
                    +-----------------------------+
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
   +------------------------------+   +------------------------------+
   |   Actuarial Engine Service   |   |     PostgreSQL Database      |
   |  - Age Calculation (DOB)     |   |  - Users (AES-256-GCM)       |
   |  - Bonus Schedule (Yr 1..20) |   |  - Policies                  |
   |  - Maturity Benefit & CFs    |   |  - Illustrations & Schedules |
   |  - Newton-Raphson IRR Solver |   |  - Bulk Jobs & Records       |
   +------------------------------+   +------------------------------+
```

---

## 2. Technology Stack

- **Frontend:** React 18, Vite, React Router v6, Axios, Bootstrap 5.
- **Backend:** Node.js v20+, Express.js, express-validator.
- **Database:** PostgreSQL (with `pg` connection pool and automatic `pg-mem` fallback for zero-config testing).
- **Authentication & Security:** JWT (`jsonwebtoken`), `bcryptjs`, Node.js native `crypto` (AES-256-GCM).
- **Testing:** Jest, Supertest.

---

## 3. Prerequisites

- **Node.js:** v18.0.0 or higher (v20+ recommended).
- **npm:** v9.0.0 or higher.
- *(Optional)* **PostgreSQL:** v12+ if running against an external PostgreSQL server. (If PostgreSQL is not running locally, the application automatically boots into zero-config memory database mode for instant developer evaluation).

---

## 4. Quick Start & Installation

### Step 1: Clone & Install Dependencies

```bash
# In the project root:
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### Step 2: Environment Configuration

Copy the example environment files:

```bash
cp .env.example backend/.env
```

### Step 3: Run Database Migrations (Optional for external PostgreSQL)

If connecting to a live PostgreSQL instance, set `DATABASE_URL` in `backend/.env` and run:

```bash
cd backend && npm run migrate
cd ..
```

*(Note: When running tests or in development without a live PostgreSQL server, the backend automatically initializes the complete PostgreSQL DDL schema in memory).*

### Step 4: Run Tests

Execute the comprehensive unit and integration test suite:

```bash
cd backend && npm test
```

Expected output: **50 tests passed** across all 3 test suites:
- `tests/calculation.test.js` (18 tests: Excel parity, IRR convergence, cash flows, bonus schedules)
- `tests/validation.test.js` (16 tests: 5 assignment validations and boundaries)
- `tests/authAndApi.test.js` (16 tests: JWT, registration, login, data masking, tenant isolation, bulk jobs)

---

## 5. Starting the Application

### Start the Backend API Server:

```bash
cd backend && npm start
# API server starts on http://localhost:5001
```

### Start the React Frontend:

In a separate terminal:

```bash
cd frontend && npm run dev
# Vite dev server starts on http://localhost:5173
```

Visit **`http://localhost:5173`** in your browser.

---

## 6. Actuarial Calculation Rules & Excel Analysis

Detailed workbook documentation is available in [`docs/excel-analysis.md`](docs/excel-analysis.md).

### 6.1 Formula Parity Matrix

| Illustration Column | Reference Excel Formula | Implementation in `illustrationService.js` |
|---|---|---|
| **Premium** | `=IF(A_r <= PPT, Modal_Premium, 0)` | Applied for years $1 \dots PPT$; zero thereafter. |
| **Sum Assured** | `=IF(PT = A_r, Sum_Assured, 0)` | Paid out exclusively in maturity year $PT$; zero in other years. |
| **Bonus Rate** | Literal constants (rows 4 to 23) | Hardcoded 20-year array from 2.5% to 25.0%. |
| **Bonus Amount** | `=Bonus_Rate * Sum_Assured` | Exact multiplication with safe currency rounding. |
| **Total Benefit** | `=IF(PT = A_r, C_r + SUM(E$1:E$23), 0)` | Sum of Sum Assured + Accumulated Bonuses in maturity year. |
| **Net Cashflows** | `=IF(PT = A_r, F_r, C_r - B_r)` | $- \text{Premium}$ during paying years; $+ \text{Total Benefit}$ in year $PT$. |
| **IRR** | `=IRR(G4:G23)` | Newton-Raphson polynomial solver (matches $8.4150\%$). |

### 6.2 Key Discrepancies Investigated

1. **₹80,000 Sample Premium vs. Legacy ₹50,000 Validation Limit:**
   - The sample workbook input specifies a Modal Premium of ₹80,000, while the historical text in the reference template suggested an upper limit of ₹50,000.
   - **Resolution:** The ₹50,000 ceiling and separate override toggles have been removed. The system allows any valid positive premium amount (including the ₹80,000 sample workbook input, ₹1,00,000+, or custom entries) directly without artificial caps or separate override logic.
2. **Sum Assured Validation Rule Phrasing:**
   - Workbook text states: *"Minimum of 10 times Sum assured or 5000000"*.
   - **Resolution:** Interpreted according to Indian regulatory standards (IRDAI & Section 10(10D)): $\text{Sum Assured} \ge 10 \times \text{Annual Premium}$ and $\text{Sum Assured} \le ₹50,00,000$.

---

## 7. API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/auth/register` | Register new user with encrypted DOB & mobile | No |
| `POST` | `/api/auth/login` | Authenticate user & return signed JWT | No |
| `GET` | `/api/auth/me` | Fetch current user profile with masked PII | **Yes** |

### Illustration Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/illustrations/calculate` | Compute dynamic 20-year illustration & IRR | Optional |
| `POST` | `/api/illustrations/save` | Persist policy, calculation, and schedule to DB | **Yes** |
| `GET` | `/api/illustrations` | Paginated calculation history for logged-in user | **Yes** |
| `GET` | `/api/illustrations/:id` | Fetch specific illustration and full schedule | **Yes** |
| `GET` | `/api/illustrations/:id/export` | Download illustration as CSV file | **Yes** |
| `POST` | `/api/illustrations/bulk-upload` | Asynchronous bulk CSV upload & job dispatch | **Yes** |
| `GET` | `/api/illustrations/bulk-jobs/:id` | Check status and progress of bulk job | **Yes** |

---

## 8. Customer Data Security & Privacy

Detailed documentation is available in [`docs/security.md`](docs/security.md).

- **Encryption at Rest:** Sensitive customer fields (`dob`, `mobile`) are encrypted before database insertion using authenticated **AES-256-GCM** with a unique 96-bit IV per row and 128-bit authentication tags.
- **Password Security:** Passwords hashed using `bcrypt` with salt rounds = 10.
- **Data Masking:** Mobile numbers masked as `******3210`; DOB masked as `****-**-12`.
- **Tenant Isolation:** Enforces strict row-level ownership checks preventing cross-user unauthorized access.
- **Defensive Headers & Rate Limiting:** Protected via `helmet` and `express-rate-limit`.

---

## 9. Scalability Architecture for Millions of Records

Detailed architecture is available in [`docs/scalability.md`](docs/scalability.md).

- **Asynchronous Ingestion:** Decouples file uploads from calculations using distributed message brokers (BullMQ / RabbitMQ).
- **Chunked Processing:** Splits large CSV files into batches (e.g. 2,500 records) to prevent memory exhaustion (OOM).
- **High-Performance Persistence:** Utilizes PostgreSQL `COPY` streaming protocol (50,000+ rows/sec) and table partitioning.
- **Idempotency & Retries:** Automatic lock renewal and dead-letter queues (DLQ) for failed records.

---

## 10. Development & Sample Data

A sample test account can be registered via the UI or using the credentials:
- **Email:** `demo.user@example.com`
- **Password:** `Password@123`
- *(Contains no real customer PII)*.

