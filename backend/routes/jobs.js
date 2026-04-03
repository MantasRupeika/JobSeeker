const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { jobType, location, salaryMin, salaryMax, limit } = req.query;
    const where = [];
    const params = [];

    const hasSalaryMin = salaryMin !== undefined && String(salaryMin).trim() !== '';
    const hasSalaryMax = salaryMax !== undefined && String(salaryMax).trim() !== '';

    const minValue = hasSalaryMin ? Number(salaryMin) : null;
    const maxValue = hasSalaryMax ? Number(salaryMax) : null;

    if (hasSalaryMin && !Number.isFinite(minValue)) {
      return res.status(400).json({ error: 'salaryMin turi būti skaičius' });
    }

    if (hasSalaryMax && !Number.isFinite(maxValue)) {
      return res.status(400).json({ error: 'salaryMax turi būti skaičius' });
    }

    if (hasSalaryMin && hasSalaryMax && minValue > maxValue) {
      return res.status(400).json({ error: 'salaryMin negali būti didesnis už salaryMax' });
    }

    if (jobType && String(jobType).trim() !== '') {
      where.push("LOWER(COALESCE(job_type, '')) = LOWER(?)");
      params.push(String(jobType).trim());
    }

    if (location && String(location).trim() !== '') {
      where.push("LOWER(COALESCE(address, '')) LIKE LOWER(?)");
      params.push(`%${String(location).trim()}%`);
    }

    if (hasSalaryMin) {
      where.push('(COALESCE(salary_max, salary_min) IS NOT NULL AND COALESCE(salary_max, salary_min) >= ?)');
      params.push(minValue);
    }

    if (hasSalaryMax) {
      where.push('(COALESCE(salary_min, salary_max) IS NOT NULL AND COALESCE(salary_min, salary_max) <= ?)');
      params.push(maxValue);
    }

    let query = `
      SELECT
        id,
        title,
        company,
        address,
        salary_min,
        salary_max,
        job_type,
        url,
        scraped_at
      FROM jobs
    `;

    if (where.length > 0) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    query += ' ORDER BY datetime(scraped_at) DESC, id DESC';

    const hasLimit = limit !== undefined && String(limit).trim() !== '';
    if (hasLimit) {
      const limitValue = Number(limit);
      if (!Number.isInteger(limitValue) || limitValue <= 0) {
        return res.status(400).json({ error: 'limit turi būti teigiamas sveikas skaičius' });
      }
      query += ' LIMIT ?';
      params.push(limitValue);
    }

    const rows = db.prepare(query).all(...params);

    const jobs = rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.address,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      jobType: row.job_type,
      url: row.url,
      scrapedAt: row.scraped_at
    }));

    return res.status(200).json({ jobs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;