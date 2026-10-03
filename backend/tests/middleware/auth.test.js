const express = require('express');
const request = require('supertest');

const mockGet = jest.fn();
const mockPrepare = jest.fn();
const mockVerify = jest.fn();

jest.mock('../../db/database', () => ({
  prepare: (...args) => mockPrepare(...args)
}));

jest.mock('jsonwebtoken', () => ({
  verify: (...args) => mockVerify(...args)
}));

const authMiddleware = require('../../middleware/auth');

const app = express();
app.use(express.json());

app.get('/protected', authMiddleware, (req, res) => {
  res.status(200).json({
    message: 'Access granted',
    user: req.user
  });
});

describe('Auth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrepare.mockImplementation((sql) => {
      if (sql.includes('SELECT id FROM token_blacklist WHERE token = ?')) {
        return { get: mockGet };
      }

      return { get: mockGet };
    });
  });

  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  test('returns 401 when token is invalid', async () => {
    mockVerify.mockImplementationOnce(() => {
      throw new Error('Invalid token');
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid token');
  });

  test('returns 401 when token has been blacklisted', async () => {
    mockVerify.mockReturnValueOnce({
      id: 1,
      email: 'test@test.com'
    });

    mockGet.mockReturnValueOnce({ id: 1 });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer blacklisted-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token has been invalidated');
  });

  test('returns 200 and sets req.user when token is valid', async () => {
    mockVerify.mockReturnValueOnce({
      id: 1,
      email: 'test@test.com'
    });

    mockGet.mockReturnValueOnce(undefined);

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Access granted',
      user: {
        id: 1,
        email: 'test@test.com'
      }
    });
  });
});