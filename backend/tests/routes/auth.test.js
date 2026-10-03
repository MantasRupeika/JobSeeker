const request = require('supertest');
const express = require('express');

const mockGet = jest.fn();
const mockRun = jest.fn();
const mockPrepare = jest.fn();

jest.mock('../../db/database', () => ({
  prepare: (...args) => mockPrepare(...args)
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token')
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@test.com' };
  next();
});

const bcrypt = require('bcrypt');
const authRoutes = require('../../routes/auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrepare.mockImplementation((sql) => {
      if (sql.includes('SELECT id FROM users WHERE email = ?')) {
        return { get: mockGet };
      }

      if (sql.includes('INSERT INTO users (email, password, name) VALUES (?, ?, ?)')) {
        return { run: mockRun };
      }

      if (sql.includes('SELECT id, email, password FROM users WHERE email = ?')) {
        return { get: mockGet };
      }

      if (sql.includes('INSERT INTO token_blacklist (token) VALUES (?)')) {
        return { run: mockRun };
      }

      return {
        get: mockGet,
        run: mockRun
      };
    });
  });

  describe('POST /api/auth/register', () => {
    test('returns 201 when registration is successful', async () => {
      mockGet.mockReturnValueOnce(undefined);
      mockRun.mockReturnValueOnce({ lastInsertRowid: 1 });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: '12345678',
          name: 'Test User'
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 1,
        email: 'test@test.com'
      });
    });

    test('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          password: '12345678'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email ir password yra privalomi');
    });

    test('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email ir password yra privalomi');
    });

    test('returns 400 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: '1234567'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('password turi būti bent 8 simbolių');
    });

    test('returns 409 when email is already registered', async () => {
      mockGet.mockReturnValueOnce({ id: 5 });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          password: '12345678'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('email jau užregistruotas');
    });
  });

  describe('POST /api/auth/login', () => {
    test('returns 200 and token when login is successful', async () => {
      mockGet.mockReturnValueOnce({
        id: 1,
        email: 'test@test.com',
        password: 'hashed-password'
      });

      bcrypt.compare.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: '12345678'
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        token: 'mock-jwt-token'
      });
    });

    test('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          password: '12345678'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email ir password yra privalomi');
    });

    test('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('email ir password yra privalomi');
    });

    test('returns 404 when user does not exist', async () => {
      mockGet.mockReturnValueOnce(undefined);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'missing@test.com',
          password: '12345678'
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vartotojas nerastas');
    });

    test('returns 401 when password is incorrect', async () => {
      mockGet.mockReturnValueOnce({
        id: 1,
        email: 'test@test.com',
        password: 'hashed-password'
      });

      bcrypt.compare.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrongpass'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Neteisingas slaptažodis');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('returns 200 when logout succeeds', async () => {
      mockRun.mockReturnValueOnce({ changes: 1 });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer mock-jwt-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });
});