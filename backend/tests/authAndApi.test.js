const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');

describe('Auth & API Integration Suite', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;
  let savedIllustrationId;

  const user1Data = {
    fullName: 'Rahul Sharma',
    dob: '1999-12-12',
    mobile: '9876543210',
    email: 'rahul.sharma@example.com',
    password: 'Password@123',
    confirmPassword: 'Password@123',
  };

  const user2Data = {
    fullName: 'Priya Verma',
    dob: '1995-05-15',
    mobile: '9812345678',
    email: 'priya.verma@example.com',
    password: 'Password@456',
    confirmPassword: 'Password@456',
  };

  beforeAll(() => {
    // Force in-memory db setup for tests
    db.setupMemoryDb();
  });

  describe('1. Registration & Security', () => {
    test('successfully registers User 1 and returns JWT and masked PII', async () => {
      const res = await request(app).post('/api/auth/register').send(user1Data);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('rahul.sharma@example.com');
      // Verify PII (name, mobile, DOB) is masked in response
      expect(res.body.user.fullName).toBe('R***l S****a');
      expect(res.body.user.mobile).toBe('******3210');
      expect(res.body.user.dob).toBe('****-**-12');
      // Password hash must NEVER be returned
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();

      // Verify name, dob, and mobile are encrypted/masked in the database at rest
      const dbRow = await db.query('SELECT full_name, dob_encrypted, mobile_encrypted FROM users WHERE id = $1', [
        res.body.user.id,
      ]);
      expect(dbRow.rows[0].full_name).not.toBe('Rahul Sharma');
      expect(dbRow.rows[0].full_name).toContain(':');
      expect(dbRow.rows[0].dob_encrypted).not.toBe('1999-12-12');
      expect(dbRow.rows[0].mobile_encrypted).not.toBe('9876543210');

      user1Token = res.body.token;
      user1Id = res.body.user.id;
    });

    test('rejects registration with duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send(user1Data);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    test('rejects registration with mismatched passwords', async () => {
      const res = await request(app).post('/api/auth/register').send({
        ...user1Data,
        email: 'other@example.com',
        confirmPassword: 'DifferentPassword',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContainEqual(expect.stringContaining('do not match'));
    });

    test('registers User 2 for authorization tests', async () => {
      const res = await request(app).post('/api/auth/register').send(user2Data);

      expect(res.status).toBe(201);
      user2Token = res.body.token;
      user2Id = res.body.user.id;
    });
  });

  describe('2. Login & Profile', () => {
    test('successfully logs in with correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'rahul.sharma@example.com',
        password: 'Password@123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.fullName).toBe('R***l S****a');
      expect(res.body.user.mobile).toBe('******3210');
    });

    test('rejects login with incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'rahul.sharma@example.com',
        password: 'WrongPassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email address or password');
    });

    test('rejects login with non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Password@123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/auth/me returns masked profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('rahul.sharma@example.com');
      expect(res.body.user.fullName).toBe('R***l S****a');
      expect(res.body.user.mobile).toBe('******3210');
      expect(res.body.user.dob).toBe('****-**-12');
    });

    test('GET /api/auth/me fails without token (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Illustration API & Access Control', () => {
    test('GET /api/illustrations/catalog serves policy types, riders, premium options, and sample policies', async () => {
      const res = await request(app).get('/api/illustrations/catalog');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.policyTypes.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.riders.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.premiumOptions.length).toBe(3);
      expect(res.body.data.samplePolicies.length).toBeGreaterThanOrEqual(1);
    });

    test('POST /api/illustrations/calculate generates illustration dynamically with policyType and riders', async () => {
      const res = await request(app)
        .post('/api/illustrations/calculate')
        .send({
          dob: '1999-12-12',
          gender: 'M',
          policyType: 'ENDOWMENT',
          riders: ['ACCIDENTAL_DEATH', 'WAIVER_OF_PREMIUM'],
          sumAssured: 1200000,
          modalPremium: 40000,
          premiumFrequency: 'Yearly',
          pt: 18,
          ppt: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.schedule).toHaveLength(20);
      expect(res.body.data.policy.policyType).toBe('ENDOWMENT');
      expect(res.body.data.policy.riders).toHaveLength(2);
      expect(res.body.data.policy.totalPremiumsPaid).toBe(400000);
      expect(res.body.data.policy.maturityBenefit).toBeGreaterThan(1200000);
      expect(res.body.data.policy.irrPercentage).not.toBeNull();
    });

    test('POST /api/illustrations/save saves calculation for User 1', async () => {
      const res = await request(app)
        .post('/api/illustrations/save')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          dob: '1999-12-12',
          gender: 'M',
          sumAssured: 1200000,
          modalPremium: 40000,
          premiumFrequency: 'Yearly',
          pt: 18,
          ppt: 10,
          policyName: 'My First Retirement Plan',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      savedIllustrationId = res.body.data.id;
    });

    test('GET /api/illustrations lists saved calculations for User 1', async () => {
      const res = await request(app)
        .get('/api/illustrations')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
    });

    test('GET /api/illustrations/:id allows User 1 to view their own calculation', async () => {
      const res = await request(app)
        .get(`/api/illustrations/${savedIllustrationId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(savedIllustrationId);
      expect(res.body.data.schedule).toHaveLength(20);
    });

    test('GET /api/illustrations/:id DENIES User 2 from accessing User 1 illustration (404/Access Denied)', async () => {
      const res = await request(app)
        .get(`/api/illustrations/${savedIllustrationId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found or access denied');
    });

    test('GET /api/illustrations/:id/export generates CSV download', async () => {
      const res = await request(app)
        .get(`/api/illustrations/${savedIllustrationId}/export`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Benefit Illustration Report');
      expect(res.text).toContain('Policy Year');
    });
  });

  describe('4. Bulk Upload Asynchronous Processing', () => {
    test('POST /api/illustrations/bulk-upload accepts CSV file and returns Job ID', async () => {
      const csvData = [
        'dob,gender,sumAssured,modalPremium,frequency,pt,ppt',
        '1998-01-15,M,1000000,40000,Yearly,15,10',
        '1992-06-20,F,1500000,45000,Yearly,20,10',
      ].join('\n');

      const res = await request(app)
        .post('/api/illustrations/bulk-upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', Buffer.from(csvData), 'policies.csv');

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.jobId).toBeDefined();
      expect(res.body.totalRecords).toBe(2);

      const jobId = res.body.jobId;

      // Check job status endpoint
      const statusRes = await request(app)
        .get(`/api/illustrations/bulk-jobs/${jobId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.job.id).toBe(jobId);
    });
  });
});

