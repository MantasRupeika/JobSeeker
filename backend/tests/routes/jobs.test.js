const request = require('supertest');
const express = require('express');

const mockAll = jest.fn();
const mockGet = jest.fn();
const mockPrepare = jest.fn(() => ({ get: mockGet, all: mockAll }));

jest.mock('../../db/database', () => ({
  prepare: mockPrepare
}));

const jobsRoutes = require('../../routes/jobs');

const app = express();
app.use(express.json());
app.use('/api/jobs', jobsRoutes);

const mockJob = {
  id: 1,
  title: 'Frontend Developer',
  company: 'BrightApps',
  address: 'Vilnius',
  lat: 54.6872,
  lng: 25.2797,
  salary_min: 2400,
  salary_max: 3200,
  job_type: 'full-time',
  url: 'https://example.com/job/1',
  scraped_at: '2026-04-03 10:00:00'
};

describe('GET /api/jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue({ count: 1 });
    mockAll.mockReturnValue([mockJob]);
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
      lat: 54.6872,
      lng: 25.2797,
      salaryMin: 2400,
      salaryMax: 3200,
      jobType: 'full-time'
    });
  });

  test('returns pagination metadata with defaults', async () => {
    mockGet.mockReturnValue({ count: 1 });

    const res = await request(app).get('/api/jobs');

    expect(res.body.pagination).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1
    });
  });

  test('calculates totalPages correctly', async () => {
    mockGet.mockReturnValue({ count: 55 });

    const res = await request(app).get('/api/jobs').query({ pageSize: '10' });

    expect(res.body.pagination).toMatchObject({
      total: 55,
      page: 1,
      pageSize: 10,
      totalPages: 6
    });
  });

  test('uses correct LIMIT and OFFSET for page 3', async () => {
    mockGet.mockReturnValue({ count: 100 });

    await request(app).get('/api/jobs').query({ page: '3', pageSize: '10' });

    expect(mockAll).toHaveBeenCalledWith(10, 20);
  });

  test('uses correct LIMIT and OFFSET for default page', async () => {
    await request(app).get('/api/jobs');

    expect(mockAll).toHaveBeenCalledWith(20, 0);
  });

  test('applies jobType filter', async () => {
    await request(app).get('/api/jobs').query({ jobType: 'full-time' });

    const countQuery = mockPrepare.mock.calls[0][0];
    const dataQuery = mockPrepare.mock.calls[1][0];
    expect(countQuery).toContain("LOWER(COALESCE(job_type, '')) = LOWER(?)");
    expect(dataQuery).toContain("LOWER(COALESCE(job_type, '')) = LOWER(?)");
    expect(mockGet).toHaveBeenCalledWith('full-time');
    expect(mockAll).toHaveBeenCalledWith('full-time', 20, 0);
  });

  test('applies location filter with LIKE', async () => {
    await request(app).get('/api/jobs').query({ location: '  Vilnius  ' });

    const dataQuery = mockPrepare.mock.calls[1][0];
    expect(dataQuery).toContain("LOWER(COALESCE(address, '')) LIKE LOWER(?)");
    expect(mockAll).toHaveBeenCalledWith('%Vilnius%', 20, 0);
  });

  test('applies salary range filters', async () => {
    await request(app).get('/api/jobs').query({ salaryMin: '1500', salaryMax: '3000' });

    const dataQuery = mockPrepare.mock.calls[1][0];
    expect(dataQuery).toContain('COALESCE(salary_min, salary_max) >= ?');
    expect(dataQuery).toContain('COALESCE(salary_max, salary_min) <= ?');
    expect(mockAll).toHaveBeenCalledWith(1500, 3000, 20, 0);
  });

  test('applies combined filters with pagination', async () => {
    await request(app).get('/api/jobs').query({
      jobType: 'contract',
      location: 'Kaunas',
      salaryMin: '1200',
      salaryMax: '5000',
      page: '2',
      pageSize: '10'
    });

    const dataQuery = mockPrepare.mock.calls[1][0];
    expect(dataQuery).toContain('WHERE');
    expect(dataQuery).toContain('LIMIT ? OFFSET ?');
    expect(mockAll).toHaveBeenCalledWith('contract', '%Kaunas%', 1200, 5000, 10, 10);
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
    const res = await request(app).get('/api/jobs').query({ salaryMin: '5000', salaryMax: '1000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('salaryMin');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid page (zero)', async () => {
    const res = await request(app).get('/api/jobs').query({ page: '0' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('page');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid page (non-integer)', async () => {
    const res = await request(app).get('/api/jobs').query({ page: '1.5' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('page');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid pageSize (over 100)', async () => {
    const res = await request(app).get('/api/jobs').query({ pageSize: '101' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pageSize');
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid pageSize (zero)', async () => {
    const res = await request(app).get('/api/jobs').query({ pageSize: '0' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pageSize');
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
