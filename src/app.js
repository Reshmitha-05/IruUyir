const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db/database');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS origin not allowed'))),
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  let database = 'ok';
  try { db.prepare('SELECT 1').get(); } catch { database = 'error'; }
  res.json({ success: true, data: { status: 'ok', database, time: new Date().toISOString() } });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/ml', require('./routes/ml'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/alerts', require('./routes/alerts'));

app.use(notFound);
app.use(errorHandler);
module.exports = app;
