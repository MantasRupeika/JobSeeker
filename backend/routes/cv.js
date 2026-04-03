const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

function mapCvRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    experience: row.experience,
    education: row.education,
    skills: row.skills,
    filePath: row.file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getCvByIdForUser(cvId, userId) {
  return db.prepare(
    `SELECT id, user_id, name, email, phone, experience, education, skills, file_path, created_at, updated_at
     FROM cvs
     WHERE id = ? AND user_id = ?`
  ).get(cvId, userId);
}

router.get('/', (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT id, user_id, name, email, phone, experience, education, skills, file_path, created_at, updated_at
       FROM cvs
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC, id DESC`
    ).all(req.user.id);

    return res.status(200).json({ cvs: rows.map(mapCvRow) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const cv = getCvByIdForUser(req.params.id, req.user.id);

    if (!cv) {
      return res.status(404).json({ error: 'CV nerastas' });
    }

    return res.status(200).json(mapCvRow(cv));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

router.post('/', (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      experience,
      education,
      skills,
      filePath,
      file_path
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name yra privalomas' });
    }

    const resolvedFilePath = filePath || file_path || null;

    const result = db.prepare(
      `INSERT INTO cvs (user_id, name, email, phone, experience, education, skills, file_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      name,
      email || null,
      phone || null,
      experience || null,
      education || null,
      skills || null,
      resolvedFilePath
    );

    const created = getCvByIdForUser(result.lastInsertRowid, req.user.id);

    return res.status(201).json(mapCvRow(created));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const existing = getCvByIdForUser(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'CV nerastas' });
    }

    const nextName = req.body.name !== undefined ? req.body.name : existing.name;
    const nextEmail = req.body.email !== undefined ? req.body.email : existing.email;
    const nextPhone = req.body.phone !== undefined ? req.body.phone : existing.phone;
    const nextExperience = req.body.experience !== undefined ? req.body.experience : existing.experience;
    const nextEducation = req.body.education !== undefined ? req.body.education : existing.education;
    const nextSkills = req.body.skills !== undefined ? req.body.skills : existing.skills;
    const nextFilePath = req.body.filePath !== undefined
      ? req.body.filePath
      : (req.body.file_path !== undefined ? req.body.file_path : existing.file_path);

    if (!nextName) {
      return res.status(400).json({ error: 'name yra privalomas' });
    }

    db.prepare(
      `UPDATE cvs
       SET name = ?, email = ?, phone = ?, experience = ?, education = ?, skills = ?, file_path = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      nextName,
      nextEmail || null,
      nextPhone || null,
      nextExperience || null,
      nextEducation || null,
      nextSkills || null,
      nextFilePath || null,
      req.params.id,
      req.user.id
    );

    const updated = getCvByIdForUser(req.params.id, req.user.id);

    return res.status(200).json(mapCvRow(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = getCvByIdForUser(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'CV nerastas' });
    }

    db.prepare('DELETE FROM cvs WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);

    return res.status(200).json({ message: 'CV ištrintas' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;