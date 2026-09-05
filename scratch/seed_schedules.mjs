import { executeQuery } from '../server/dist/config/database.js';

async function main() {
  await executeQuery(`
    INSERT INTO working_schedules (id, name, weekly_hours)
    VALUES ('SCH-001', 'Standard 40h Regular', 40.0), ('SCH-002', 'Flexible Engineering', 40.0)
    ON DUPLICATE KEY UPDATE name=VALUES(name)
  `);
  console.log('working_schedules seeded successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
