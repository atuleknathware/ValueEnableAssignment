# Benefit Illustration Module

A full-stack web application that calculates life insurance **Benefit Illustrations (BI)**—including 20-year cashflows, bonuses, maturity payouts, and Internal Rate of Return (IRR)—based on the reference Excel workbook (`assignment_reference_sample (1).xlsm`).

---

## Features

- **20-Year Projection Engine:** Calculates annual premiums, bonuses, total maturity benefit, net cashflows, and IRR matching the reference Excel formulas.
- **Policy Validation:** Enforces rules for policy term, premium paying term, age limits, premium minimums, and sum assured caps.
- **Data Security:** Encrypts sensitive customer details (name, DOB, mobile) with AES-256-GCM, hashes passwords with bcrypt, and masks personal info in the UI.
- **Bulk Upload:** Supports uploading CSV files to process multiple policies in the background.
- **Interactive UI:** Built with React and Bootstrap—includes live form validation, a 20-year schedule table, and CSV export.

---

## Tech Stack

- **Frontend:** React 18, Vite, React Router, Axios, Bootstrap 5
- **Backend:** Node.js, Express.js, `express-validator`
- **Database:** PostgreSQL (automatically falls back to an in-memory database if PostgreSQL isn't installed)
- **Security:** JWT authentication, `bcryptjs`, Node `crypto` (AES-256-GCM)
- **Testing:** Jest, Supertest

---

## Quick Start

### Prerequisites
- **Node.js** v18+ and **npm** v9+
- **PostgreSQL** *(Optional — if not running, the app automatically uses a built-in memory database)*

### 1. Install Dependencies

```bash
# Install backend packages
cd backend && npm install

# Install frontend packages
cd ../frontend && npm install
cd ..
```

### 2. Set Up Environment Variables

```bash
cp .env.example backend/.env
```

*(Optional)* If you are using a local PostgreSQL server, update `DATABASE_URL` in `backend/.env` and run `cd backend && npm run migrate`.

### 3. Start the App

Open two terminals:

**Terminal 1 — Backend (runs on `http://localhost:5001`):**
```bash
cd backend && npm start
```

**Terminal 2 — Frontend (runs on `http://localhost:5173`):**
```bash
cd frontend && npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## Running Tests

To run the backend test suite (calculations, validations, and API/security tests):

```bash
cd backend && npm test
```

---

## Calculation Summary

Full details are in [`docs/excel-analysis.md`](docs/excel-analysis.md).

| Column | How It Is Calculated |
|---|---|
| **Premium** | Paid each year up to the Premium Paying Term (PPT); `0` after that. |
| **Sum Assured** | Paid out only in the final Policy Term (PT) year. |
| **Bonus Rate** | Fixed 20-year schedule ranging from `2.5%` to `25.0%`. |
| **Bonus Amount** | `Bonus Rate × Sum Assured` each year. |
| **Total Benefit** | Paid at maturity (year PT): `Sum Assured + Total Accumulated Bonuses`. |
| **Net Cashflows** | `-Premium` during paying years, and `+Total Benefit` in the maturity year. |
| **IRR** | Internal Rate of Return across all annual cashflows (`8.4150%` for the sample policy). |

---

## API Endpoints

### Auth
- `POST /api/auth/register` — Register a new user
- `POST /api/auth/login` — Log in and receive a JWT token
- `GET /api/auth/me` — Get current user profile (masked PII)

### Illustrations
- `GET /api/illustrations/catalog` — Load sample policy data and dropdown options
- `POST /api/illustrations/calculate` — Calculate a 20-year illustration and IRR
- `POST /api/illustrations/save` — Save a calculated policy to the database
- `GET /api/illustrations` — List saved illustrations for the logged-in user
- `GET /api/illustrations/:id` — View a single saved illustration
- `GET /api/illustrations/:id/export` — Download the illustration as a CSV
- `POST /api/illustrations/bulk-upload` — Upload a CSV for bulk calculation
- `GET /api/illustrations/bulk-jobs/:id` — Check bulk upload progress

---

## Additional Documentation

- **Excel Formula Analysis:** [`docs/excel-analysis.md`](docs/excel-analysis.md)
- **Security & Privacy Design:** [`docs/security.md`](docs/security.md)
- **High-Volume Scalability:** [`docs/scalability.md`](docs/scalability.md)
