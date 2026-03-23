const jwt = require('jsonwebtoken');
const db = require('../db/database');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const blacklisted = db.prepare('SELECT id FROM token_blacklist WHERE token = ?').get(token);
    if (blacklisted) {
      return res.status(401).json({ error: 'Token has been invalidated' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
