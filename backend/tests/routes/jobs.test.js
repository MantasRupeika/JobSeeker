const request = require('supertest');
const express = require('express');

const mockAll = jest.fn();
const mockPrepare = jest.fn(() => ({ all: mockAll }));

jest.mock('../../db/database', () => ({
  prepare: mockPrepare
}));

const jobsRoutes = require('../../routes/jobs');

const app = express();
app.use(express.json());
app.use('/api/jobs', jobsRoutes);

describe('GET /api/jobs filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([
      {
        id: 1,
        title: 'Frontend Developer',
        company: 'BrightApps',
        address: 'Vilnius',
        salary_min: 2400,
        salary_max: 3200,
        job_type: 'full-time',
        url: 'https://example.com/job/1',
        scraped_at: '2026-04-03 10:00:00'
      }
    ]);
  });

  test('returns jobs mapped from DB response', async () => {
    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0]).toMatchObject({
      id: 1,
      title: 'Frontend Developer',
      company: 'BrightApps',
      location: 'Vilnius',
      salaryMin: 2400,
      salaryMax: 3200,
      jobType: 'full-time'
    });
  });

  test('applies jobType filter', async () => {
    await request(app).get('/api/jobs').query({ jobType: 'full-time' });

    const builtQuery = mockPrepare.mock.calls[0][0];
    expect(builtQuery).toContain("LOWER(COALESCE(job_type, '')) = LOWER(?)");
    expect(mockAll).toHaveBeenCalledWith('full-time');
  });

  test('applies location filter with LIKE', async () => {
    await request(app).get('/api/jobs').query({ location: '  Vilnius  ' });

    const builtQuery = mockPrepare.mock.calls[0][0];
    expect(builtQuery).toContain("LOWER(COALESCE(address, '')) LIKE LOWER(?)");
    expect(mockAll).toHaveBeenCalledWith('%Vilnius%');
  });

  test('applies salary range filters', async () => {
    await request(app)
      .get('/api/jobs')
      .query({ salaryMin: '1500', salaryMax: '3000' });

    const builtQuery = mockPrepare.mock.calls[0][0];
    expect(builtQuery).toContain('COALESCE(salary_max, salary_min) >= ?');
    expect(builtQuery).toContain('COALESCE(salary_min, salary_max) <= ?');
    expect(mockAll).toHaveBeenCalledWith(1500, 3000);
  });

  test('applies combined filters and limit', async () => {
    await request(app)
      .get('/api/jobs')
      .query({
        jobType: 'contract',
        location: 'Kaunas',
        salaryMin: '1200',
        salaryMax: '5000',
        limit: '10'
      });

    const builtQuery = mockPrepare.mock.calls[0][0];
    expect(builtQuery).toContain('WHERE');
    expect(builtQuery).toContain('LIMIT ?');
    expect(mockAll).toHaveBeenCalledWith('contract', '%Kaunas%', 1200, 5000, 10);
  });

  test('returns 400 for invalid salaryMin', async () => {
    const res = await request(app).get('/api/jobs').query({ salaryMin: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('salaryMin');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid salaryMax', async () => {
    const res = await request(app).get('/api/jobs').query({ salaryMax: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('salaryMax');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 400 when salaryMin is greater than salaryMax', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .query({ salaryMin: '5000', salaryMax: '1000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('salaryMin');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid limit', async () => {
    const res = await request(app).get('/api/jobs').query({ limit: '0' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('limit');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 500 when database throws', async () => {
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('DB failure');
    });

    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Serverio klaida');
  });
});
