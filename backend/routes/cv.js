const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, email, phone, experience, education, skills } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'name yra privalomas' });
    }

    const experienceStr = experience != null ? JSON.stringify(experience) : null;
    const educationStr = education != null ? JSON.stringify(education) : null;
    const skillsStr = skills != null ? JSON.stringify(skills) : null;

    const result = db.prepare(`
      INSERT INTO cvs (user_id, name, email, phone, experience, education, skills)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      name.trim(),
      email || null,
      phone || null,
      experienceStr,
      educationStr,
      skillsStr
    );

    const cv = db.prepare('SELECT * FROM cvs WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      id: cv.id,
      user_id: cv.user_id,
      name: cv.name,
      email: cv.email,
      phone: cv.phone,
      experience: cv.experience ? JSON.parse(cv.experience) : null,
      education: cv.education ? JSON.parse(cv.education) : null,
      skills: cv.skills ? JSON.parse(cv.skills) : null,
      created_at: cv.created_at,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;
