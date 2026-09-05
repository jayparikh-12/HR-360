import { executeQuery } from '../server/dist/config/database.js';

async function main() {
  const rows = await executeQuery('SELECT id, empCode, firstName, lastName, email, department, jobPosition FROM employees');
  console.log('Total employees:', rows.length);
  for (const r of rows) {
    console.log(`${r.empCode}: ${r.firstName} ${r.lastName} (${r.id}) - ${r.email}`);
  }
  process.exit(0);
}

main().catch(console.error);
