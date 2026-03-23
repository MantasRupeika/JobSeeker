const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/database');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email ir password yra privalomi' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'password turi būti bent 8 simbolių' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'email jau užregistruotas' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)'
    ).run(email, hashedPassword, name || null);

    return res.status(201).json({ id: result.lastInsertRowid, email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;
