const cron = require('node-cron');
const config = require('./config');
require('./db/database');
const app = require('./app');
const { createRemindersForTomorrow } = require('./services/notificationService');

app.listen(config.port, () => {
  console.log(`IruUyir backend running on http://localhost:${config.port}`);
  console.log(`Database: ${config.dbPath}`);
  console.log(`ML service: ${config.mlUrl}`);
});

// Daily 09:00 (server timezone setting TZ_NAME) - create "appointment tomorrow" reminders.
cron.schedule('0 9 * * *', () => {
  try { console.log('Reminders:', createRemindersForTomorrow()); } catch (e) { console.error('Reminder job failed', e); }
}, { timezone: config.tz });
try { console.log('Reminders (startup):', createRemindersForTomorrow()); } catch (e) { console.error(e); }
