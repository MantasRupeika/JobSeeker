const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { validateCvInput } = require('../validation/cv');

const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, email, phone, experience, education, skills } = req.body;

    const errors = validateCvInput({ name, email, phone, experience, education, skills });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
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

router.put('/:id', authMiddleware, (req, res) => {
  try {
    const cvId = parseInt(req.params.id, 10);
    if (isNaN(cvId)) {
      return res.status(400).json({ error: 'Neteisingas CV id' });
    }

    const { name, email, phone, experience, education, skills } = req.body;

    const errors = validateCvInput({ name, email, phone, experience, education, skills });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const cv = db.prepare('SELECT * FROM cvs WHERE id = ?').get(cvId);
    if (!cv) {
      return res.status(404).json({ error: 'CV nerastas' });
    }

    const experienceStr = experience != null ? JSON.stringify(experience) : null;
    const educationStr = education != null ? JSON.stringify(education) : null;
    const skillsStr = skills != null ? JSON.stringify(skills) : null;

    db.prepare(`
      UPDATE cvs SET name = ?, email = ?, phone = ?, experience = ?, education = ?, skills = ?
      WHERE id = ?
    `).run(name.trim(), email || null, phone || null, experienceStr, educationStr, skillsStr, cvId);

    const updated = db.prepare('SELECT * FROM cvs WHERE id = ?').get(cvId);

    return res.status(200).json({
      id: updated.id,
      user_id: updated.user_id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      experience: updated.experience ? JSON.parse(updated.experience) : null,
      education: updated.education ? JSON.parse(updated.education) : null,
      skills: updated.skills ? JSON.parse(updated.skills) : null,
      created_at: updated.created_at,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;
