const request = require('supertest');
const express = require('express');

// Mock DB before requiring the route
const mockRun = jest.fn();
const mockGet = jest.fn();
const mockPrepare = jest.fn(() => ({ run: mockRun, get: mockGet }));
jest.mock('../../db/database', () => ({ prepare: mockPrepare }));

// Mock auth middleware to inject a test user
jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const cvRoutes = require('../../routes/cv');

const app = express();
app.use(express.json());
app.use('/api/cv', cvRoutes);

describe('POST /api/cv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validBody = {
    name: 'Jonas Jonaitis',
    email: 'jonas@example.com',
    phone: '+370 600 00000',
    experience: ['2 metai Node.js'],
    education: 'Vilniaus universitetas',
    skills: ['JavaScript', 'SQL'],
  };

  const mockCreatedCv = {
    id: 1,
    user_id: 1,
    name: 'Jonas Jonaitis',
    email: 'jonas@example.com',
    phone: '+370 600 00000',
    experience: JSON.stringify(['2 metai Node.js']),
    education: JSON.stringify('Vilniaus universitetas'),
    skills: JSON.stringify(['JavaScript', 'SQL']),
    created_at: '2026-01-01 00:00:00',
  };

  test('201 - creates CV with valid data', async () => {
    mockRun.mockReturnValue({ lastInsertRowid: 1 });
    mockGet.mockReturnValue(mockCreatedCv);

    const res = await request(app).post('/api/cv').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
    expect(res.body.name).toBe('Jonas Jonaitis');
    expect(res.body.skills).toEqual(['JavaScript', 'SQL']);
  });

  test('201 - creates CV with only required name field', async () => {
    const minimalCv = { id: 1, user_id: 1, name: 'Jonas', email: null, phone: null, experience: null, education: null, skills: null, created_at: '2026-01-01 00:00:00' };
    mockRun.mockReturnValue({ lastInsertRowid: 1 });
    mockGet.mockReturnValue(minimalCv);

    const res = await request(app).post('/api/cv').send({ name: 'Jonas' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Jonas');
    expect(res.body.skills).toBeNull();
  });

  test('400 - missing name', async () => {
    const res = await request(app).post('/api/cv').send({ email: 'jonas@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('name yra privalomas');
  });

  test('400 - empty name', async () => {
    const res = await request(app).post('/api/cv').send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('name yra privalomas');
  });

  test('400 - invalid email format', async () => {
    const res = await request(app).post('/api/cv').send({ name: 'Jonas', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('email formatas neteisingas');
  });

  test('400 - invalid phone format', async () => {
    const res = await request(app).post('/api/cv').send({ name: 'Jonas', phone: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('phone formatas neteisingas (pvz. +370 600 00000)');
  });

  test('400 - invalid skills type', async () => {
    const res = await request(app).post('/api/cv').send({ name: 'Jonas', skills: 123 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('skills turi būti tekstas arba masyvas');
  });

  test('400 - returns all errors at once', async () => {
    const res = await request(app).post('/api/cv').send({ name: '', email: 'bad', phone: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
  });

  test('inserts into db with correct user_id from JWT', async () => {
    mockRun.mockReturnValue({ lastInsertRowid: 1 });
    mockGet.mockReturnValue(mockCreatedCv);

    await request(app).post('/api/cv').send(validBody);

    expect(mockRun).toHaveBeenCalledWith(
      1, // req.user.id
      'Jonas Jonaitis',
      'jonas@example.com',
      '+370 600 00000',
      JSON.stringify(['2 metai Node.js']),
      JSON.stringify('Vilniaus universitetas'),
      JSON.stringify(['JavaScript', 'SQL'])
    );
  });

  test('500 - returns server error on db failure', async () => {
    mockRun.mockImplementation(() => { throw new Error('DB error'); });

    const res = await request(app).post('/api/cv').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Serverio klaida');
  });
});

describe('PUT /api/cv/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validBody = {
    name: 'Jonas Jonaitis',
    email: 'jonas@example.com',
    phone: '+370 600 00000',
    experience: ['3 metai Node.js'],
    education: 'Vilniaus universitetas',
    skills: ['JavaScript', 'SQL'],
  };

  const mockCv = {
    id: 1,
    user_id: 1,
    name: 'Jonas Jonaitis',
    email: 'jonas@example.com',
    phone: '+370 600 00000',
    experience: JSON.stringify(['3 metai Node.js']),
    education: JSON.stringify('Vilniaus universitetas'),
    skills: JSON.stringify(['JavaScript', 'SQL']),
    created_at: '2026-01-01 00:00:00',
  };

  test('200 - updates CV with valid data', async () => {
    mockGet.mockReturnValueOnce(mockCv).mockReturnValueOnce(mockCv);
    mockRun.mockReturnValue({});

    const res = await request(app).put('/api/cv/1').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.name).toBe('Jonas Jonaitis');
    expect(res.body.skills).toEqual(['JavaScript', 'SQL']);
  });

  test('400 - invalid id param', async () => {
    const res = await request(app).put('/api/cv/abc').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Neteisingas CV id');
  });

  test('400 - missing name', async () => {
    const res = await request(app).put('/api/cv/1').send({ email: 'jonas@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('name yra privalomas');
  });

  test('404 - CV not found', async () => {
    mockGet.mockReturnValueOnce(undefined);

    const res = await request(app).put('/api/cv/99').send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CV nerastas');
  });

  test('403 - CV belongs to another user', async () => {
    mockGet.mockReturnValueOnce({ ...mockCv, user_id: 2 });

    const res = await request(app).put('/api/cv/1').send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Neturite teisės redaguoti šio CV');
  });

  test('500 - returns server error on db failure', async () => {
    mockGet.mockImplementation(() => { throw new Error('DB error'); });

    const res = await request(app).put('/api/cv/1').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Serverio klaida');
  });
});

describe('DELETE /api/cv/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCv = {
    id: 1,
    user_id: 1,
    name: 'Jonas Jonaitis',
    email: null,
    phone: null,
    experience: null,
    education: null,
    skills: null,
    created_at: '2026-01-01 00:00:00',
  };

  test('200 - deletes CV', async () => {
    mockGet.mockReturnValueOnce(mockCv);
    mockRun.mockReturnValue({});

    const res = await request(app).delete('/api/cv/1');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('CV ištrintas');
  });

  test('400 - invalid id param', async () => {
    const res = await request(app).delete('/api/cv/abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Neteisingas CV id');
  });

  test('404 - CV not found', async () => {
    mockGet.mockReturnValueOnce(undefined);

    const res = await request(app).delete('/api/cv/99');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CV nerastas');
  });

  test('403 - CV belongs to another user', async () => {
    mockGet.mockReturnValueOnce({ ...mockCv, user_id: 2 });

    const res = await request(app).delete('/api/cv/1');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Neturite teisės ištrinti šio CV');
  });

  test('500 - returns server error on db failure', async () => {
    mockGet.mockImplementation(() => { throw new Error('DB error'); });

    const res = await request(app).delete('/api/cv/1');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Serverio klaida');
  });
});
