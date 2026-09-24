// Runs the read-only data-integrity audit against the linked Supabase project.
// Usage: npm run audit:data      (exits 1 if any critical/high check fails)
import { execFileSync } from 'node:child_process';

const SQL_FILE = 'supabase/audits/data_integrity.sql';
const SAMPLE_CHARS = 220;

// Capture both streams: with a TTY on stderr the CLI switches to interactive output.
let raw;
try {
  raw = execFileSync('npx', ['-y', 'supabase@latest', 'db', 'query', '--linked', '--output-format', 'json', '-f', SQL_FILE], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (error) {
  console.error('Audit query failed:', error.stderr || error.message);
  process.exit(2);
}

const jsonStart = raw.indexOf('{');
if (jsonStart < 0) {
  console.error('Audit query returned no JSON. Raw output:\n', raw);
  process.exit(2);
}
const payload = JSON.parse(raw.slice(jsonStart));
const rows = payload.rows ?? [];
let failing = 0;

for (const row of rows) {
  const isOk = Number(row.violations) === 0;
  if (!isOk && row.severity !== 'info') failing += 1;
  const mark = isOk ? 'PASS' : row.severity === 'info' ? 'INFO' : 'FAIL';
  const sample = row.sample ? `  ${JSON.stringify(row.sample).slice(0, SAMPLE_CHARS)}` : '';
  console.log(`${mark}  ${row.severity.padEnd(8)} ${String(row.violations).padStart(4)}  ${row.check_name}${sample}`);
}

console.log(`\n${rows.length} checks, ${failing} failing (critical/high).`);
process.exit(failing > 0 ? 1 : 0);
