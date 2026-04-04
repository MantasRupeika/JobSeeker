require('dotenv').config();
const express = require('express');
const path = require('path');
const { runMigrations } = require('./db/migrations');

const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const cvRoutes = require('./routes/cv');
const savedJobsRoutes = require('./routes/saved-jobs');

const app = express();
const frontendDir = path.join(__dirname, '..', 'frontend');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use(express.static(frontendDir));

runMigrations();

app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'job-search.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/saved-jobs', savedJobsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
