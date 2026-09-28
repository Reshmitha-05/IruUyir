require('dotenv').config();
const path = require('path');

const raw = process.env.DATABASE_URL || './data/iruuyir.db';
const dbPath = path.resolve(raw.replace(/^(sqlite:|file:)(\/\/)?/, ''));

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET missing or too short (min 16 chars). Set it in .env');
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES_IN || '8h',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  mlUrl: (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''),
  dbPath,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174')
    .split(',').map((s) => s.trim()).filter(Boolean),
  tz: process.env.TZ_NAME || 'Asia/Kolkata',
  patientCanSeeNotes: process.env.PATIENT_CAN_SEE_NOTES === 'true',
};
