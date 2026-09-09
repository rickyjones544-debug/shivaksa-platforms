const { execSync } = require('child_process');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const prismaBin = path.join(appRoot, 'node_modules', 'prisma', 'build', 'index.js');
const schemaPath = '/home/shivjhtl/repositories/shivaksa-platforms/prisma/schema.prisma';
const baselineName = '20260909000000_initial_baseline';

function run(label, command) {
  console.log(`\n>> ${label}`);
  console.log(`$ ${command}\n`);
  execSync(command, { stdio: 'inherit', cwd: appRoot, env: process.env });
}

// Try to mark the previously failed baseline as rolled back.
// If it is not in a failed state (e.g. already resolved), log and continue.
try {
  run('Resolve failed baseline as rolled back', `node "${prismaBin}" migrate resolve --rolled-back "${baselineName}" --schema "${schemaPath}"`);
} catch (err) {
  console.log('\n[!] Rollback resolve step failed (this is OK if the migration was already resolved):');
  console.log(err.message);
}

// Deploy all pending migrations.
run('Deploy migrations', `node "${prismaBin}" migrate deploy --schema "${schemaPath}"`);

console.log('\n[OK] Migration deployment finished.');
