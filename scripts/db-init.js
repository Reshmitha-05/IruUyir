require('dotenv').config();
const db = require('../src/db/database');
const config = require('../src/config');
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log(`Database ready at ${config.dbPath}\nTables created (${t.length}):`);
t.forEach((r) => console.log(' -', r.name));
