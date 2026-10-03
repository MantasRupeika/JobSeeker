const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        applications.id,
        applications.sent_at,
        jobs.title AS job_title,
        jobs.company AS company,
        cvs.name AS cv_name,
        cvs.id AS cv_id
      FROM applications
      INNER JOIN jobs ON jobs.id = applications.job_id
      LEFT JOIN cvs ON cvs.id = applications.cv_id
      WHERE applications.user_id = ?
      ORDER BY datetime(applications.sent_at) DESC, applications.id DESC
    `).all(req.user.id);

    return res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;
