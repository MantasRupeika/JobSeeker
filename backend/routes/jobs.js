const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { jobType, location, salaryMin, salaryMax, page, pageSize } = req.query;
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

    const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';

    const pageNum = page !== undefined && String(page).trim() !== '' ? Number(page) : 1;
    const pageSizeNum = pageSize !== undefined && String(pageSize).trim() !== '' ? Number(pageSize) : 20;

    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'page turi būti teigiamas sveikas skaičius' });
    }

    if (!Number.isInteger(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({ error: 'pageSize turi būti sveikas skaičius nuo 1 iki 100' });
    }

    const offset = (pageNum - 1) * pageSizeNum;

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM jobs${whereClause}`).get(...params);
    const total = countRow.count;
    const totalPages = Math.ceil(total / pageSizeNum);

    const rows = db.prepare(`
      SELECT
        id,
        title,
        company,
        address,
        lat,
        lng,
        salary_min,
        salary_max,
        job_type,
        url,
        scraped_at
      FROM jobs${whereClause}
      ORDER BY datetime(scraped_at) DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSizeNum, offset);

    const jobs = rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.address,
      lat: row.lat,
      lng: row.lng,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      jobType: row.job_type,
      url: row.url,
      scrapedAt: row.scraped_at
    }));

    return res.status(200).json({
      jobs,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;
