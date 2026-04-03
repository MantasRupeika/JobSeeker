const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  try {
    const { jobId } = req.body;
    const userId = req.user.id;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId yra privalomas' });
    }

    const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Darbo skelbimas nerastas' });
    }

    const existing = db
      .prepare('SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?')
      .get(userId, jobId);

    if (existing) {
      return res.status(409).json({ error: 'Skelbimas jau išsaugotas' });
    }

    const result = db
      .prepare('INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)')
      .run(userId, jobId);

    return res.status(201).json({
      id: result.lastInsertRowid,
      userId,
      jobId
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const jobs = db.prepare(`
      SELECT
        saved_jobs.id,
        saved_jobs.job_id,
        saved_jobs.saved_at,
        jobs.title,
        jobs.company,
        jobs.address,
        jobs.salary_min,
        jobs.salary_max,
        jobs.job_type,
        jobs.url
      FROM saved_jobs
      INNER JOIN jobs ON jobs.id = saved_jobs.job_id
      WHERE saved_jobs.user_id = ?
      ORDER BY datetime(saved_jobs.saved_at) DESC, saved_jobs.id DESC
    `).all(userId);

    return res.status(200).json(jobs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});
module.exports = router;