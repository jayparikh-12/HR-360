import { executeQuery } from '../server/dist/config/database.js';

async function run() {
  try {
    await executeQuery(`
      ALTER TABLE employees
      ADD COLUMN gender ENUM('MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY') NULL DEFAULT NULL AFTER jobPosition
    `);
    console.log('ALTER TABLE SUCCESS: gender column added');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column gender already exists in employees table');
    } else {
      console.error('Error adding column:', err);
      process.exit(1);
    }
  }

  await executeQuery("UPDATE employees SET gender = 'MALE' WHERE firstName = 'John' AND lastName = 'Doe'");
  await executeQuery("UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Jane' AND lastName = 'Smith'");
  await executeQuery("UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Maya' AND lastName = 'Lin'");
  await executeQuery("UPDATE employees SET gender = 'NON_BINARY' WHERE firstName = 'Alex' AND lastName = 'Rivera'");
  await executeQuery("UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Elena' AND lastName = 'Rostova'");
  await executeQuery("UPDATE employees SET gender = 'MALE' WHERE firstName = 'David' AND lastName = 'Kim'");
  await executeQuery("UPDATE employees SET gender = 'FEMALE' WHERE firstName = 'Sarah' AND lastName = 'Connor'");
  console.log('SEED GENDER SUCCESS: known employees seeded');

  const rows = await executeQuery('DESCRIBE employees');
  const genderCol = rows.find(r => r.Field === 'gender');
  console.log('Verified column in database:', genderCol);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
