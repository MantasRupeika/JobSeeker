const request = require('supertest');
const express = require('express');

const mockGet = jest.fn();
const mockAll = jest.fn();
const mockRun = jest.fn();
const mockPrepare = jest.fn();

jest.mock('../../db/database', () => ({
  prepare: (...args) => mockPrepare(...args)
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@test.com' };
  next();
});

const savedJobsRoutes = require('../../routes/saved-jobs');

const app = express();
app.use(express.json());
app.use('/api/saved-jobs', savedJobsRoutes);

describe('Saved jobs routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrepare.mockImplementation((sql) => {
      if (sql.includes('SELECT id FROM jobs WHERE id = ?')) {
        return { get: mockGet };
      }

      if (sql.includes('SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?')) {
        return { get: mockGet };
      }

      if (sql.includes('INSERT INTO saved_jobs')) {
        return { run: mockRun };
      }

      if (sql.includes('FROM saved_jobs sj')) {
        return { all: mockAll };
      }

      if (sql.includes('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?')) {
        return { run: mockRun };
      }

      return {
        get: mockGet,
        all: mockAll,
        run: mockRun
      };
    });
  });

  describe('POST /api/saved-jobs', () => {
    test('returns 201 when job is saved successfully', async () => {
      mockGet
        .mockReturnValueOnce({ id: 5 })
        .mockReturnValueOnce(undefined);

      mockRun.mockReturnValue({ lastInsertRowid: 10 });

      const res = await request(app)
        .post('/api/saved-jobs')
        .send({ jobId: 5 });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 10,
        userId: 1,
        jobId: 5
      });
    });

    test('returns 400 when jobId is missing', async () => {
      const res = await request(app)
        .post('/api/saved-jobs')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('jobId yra privalomas');
    });

    test('returns 404 when job does not exist', async () => {
      mockGet.mockReturnValueOnce(undefined);

      const res = await request(app)
        .post('/api/saved-jobs')
        .send({ jobId: 999 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Darbo skelbimas nerastas');
    });

    test('returns 409 when job is already saved', async () => {
      mockGet
        .mockReturnValueOnce({ id: 5 })
        .mockReturnValueOnce({ id: 99 });

      const res = await request(app)
        .post('/api/saved-jobs')
        .send({ jobId: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Skelbimas jau išsaugotas');
    });
  });

  describe('GET /api/saved-jobs', () => {
    test('returns saved jobs list', async () => {
      mockAll.mockReturnValue([
        {
          id: 1,
          job_id: 5,
          saved_at: '2026-04-03 12:00:00',
          title: 'Frontend Developer',
          company: 'Test Company',
          address: 'Vilnius',
          salary_min: 1500,
          salary_max: 2500,
          job_type: 'full-time',
          url: 'https://example.com/job/5'
        }
      ]);

      const res = await request(app).get('/api/saved-jobs');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].job_id).toBe(5);
      expect(res.body[0].title).toBe('Frontend Developer');
    });

    test('returns empty array when no saved jobs exist', async () => {
      mockAll.mockReturnValue([]);

      const res = await request(app).get('/api/saved-jobs');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('DELETE /api/saved-jobs/:jobId', () => {
    test('returns 200 when saved job is removed', async () => {
      mockGet.mockReturnValueOnce({ id: 1 });
      mockRun.mockReturnValue({ changes: 1 });

      const res = await request(app).delete('/api/saved-jobs/5');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Saved job removed successfully');
    });

    test('returns 400 for invalid jobId', async () => {
      const res = await request(app).delete('/api/saved-jobs/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Neteisingas jobId');
    });

    test('returns 404 when saved job is not found', async () => {
      mockGet.mockReturnValueOnce(undefined);

      const res = await request(app).delete('/api/saved-jobs/5');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Išsaugotas skelbimas nerastas');
    });
  });
});