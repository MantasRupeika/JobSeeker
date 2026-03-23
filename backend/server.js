require('dotenv').config();
const express = require('express');
const { runMigrations } = require('./db/migrations');

const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const cvRoutes = require('./routes/cv');

const app = express();

app.use(express.json());

runMigrations();

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/cv', cvRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
