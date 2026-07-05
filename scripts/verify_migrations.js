import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const migrationDir = path.join(process.cwd(), 'drizzle');
const journalPath = path.join(migrationDir, 'meta', '_journal.json');

const forbiddenIdentifiers = new Set([
  'send_logs',
  'sent_messages',
  'message_logs',
  'message_results',
  'recipient_results',
  'delivery_results',
  'recipient_no',
  'recipient_number',
  'phone_number',
  'recipient_list',
  'recipients',
  'international_recipient_no',
  'body',
  'message_body',
  'content',
  'rendered_content',
  'alimtalk_content',
  'buttons',
  'quick_replies',
  'template_parameter',
  'template_parameters',
  'template_source_payload',
  'template_payload',
  'raw',
  'raw_payload',
  'provider_payload',
  'nhn_payload',
  'result_payload',
  'request_body',
  'response_body',
  'app_key',
  'secret_key',
  'x_secret_key',
  'access_token',
  'refresh_token',
  'provider_token',
]);

function fail(message) {
  console.error(`[db:migration:verify] ${message}`);
  process.exitCode = 1;
}

if (!existsSync(migrationDir)) {
  fail('Missing drizzle migration directory.');
} else if (!existsSync(journalPath)) {
  fail('Missing drizzle migration journal.');
} else {
  const migrationFiles = readdirSync(migrationDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    fail('No SQL migration files found.');
  }

  for (const fileName of migrationFiles) {
    const sql = readFileSync(path.join(migrationDir, fileName), 'utf8');
    const quotedIdentifiers = [...sql.matchAll(/"([^"]+)"/g)].map((match) => match[1].toLowerCase());
    const forbiddenMatches = quotedIdentifiers.filter((identifier) => forbiddenIdentifiers.has(identifier));

    if (forbiddenMatches.length > 0) {
      fail(`${fileName} contains forbidden local storage identifiers: ${[...new Set(forbiddenMatches)].join(', ')}`);
    }
  }

  if (!process.exitCode) {
    console.log(`[db:migration:verify] ${migrationFiles.length} migration file(s) passed privacy-boundary checks.`);
  }
}
