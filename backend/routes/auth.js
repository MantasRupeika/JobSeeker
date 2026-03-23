const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email ir password yra privalomi' });
    }

    const user = db.prepare('SELECT id, email, password FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: 'Vartotojas nerastas' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Neteisingas slaptažodis' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  try {
    const token = req.headers['authorization'].slice(7);
    db.prepare('INSERT INTO token_blacklist (token) VALUES (?)').run(token);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Serverio klaida' });
  }
});

module.exports = router;
