// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const employeesRouter = require('./routes/employees');
const checkinsRouter = require('./routes/checkins');
const authRouter = require('./routes/auth');
const reportsRouter = require('./routes/reports');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/employees', employeesRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de presenças a correr em http://localhost:${PORT}`);
});
