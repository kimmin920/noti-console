import { readFile } from 'node:fs/promises';

const files = {
  bootstrap: 'src/features/publClient/PublClientBootstrap.jsx',
  clientApi: 'src/features/console/messageSend/api.js',
  config: 'src/server/publPapp/clientConfig.js',
  consolePages: 'src/features/console/ConsolePages.jsx',
  contract: 'docs/PUBL_IFRAME_RECIPIENT_CONTRACT.md',
  payloads: 'src/features/console/messageSend/payloads.js',
  recipientSelect: 'src/components/ui/RecipientSelect.jsx',
  recipientSource: 'src/features/publClient/usePublMessageRecipients.js',
  schema: 'src/db/schema.js',
  sdkAdapter: 'src/features/publClient/sdkAdapter.js',
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));
const failures = [];

checkIncludes(source.contract, 'Top-level `/publ-client`', 'contract fixes top-level entry behavior');
checkIncludes(source.contract, 'Do not add `recipientSnapshotJson`', 'contract fixes history parity');
checkIncludes(source.bootstrap, 'isPublIframeContext()', 'bootstrap checks the iframe boundary');
checkIncludes(source.bootstrap, "window.location.replace('/message-send')", 'top-level entry redirects to standalone');
checkIncludes(source.clientApi, '!isPublIframeContext()', 'standalone API calls do not attach Publ bearer tokens');
checkIncludes(source.sdkAdapter, 'hasPublClientSession({ storage })', 'SDK bootstrap reuses stored sessions');
checkIncludes(source.config, 'PM_19177_READ_MEMBER_CONTACTS', 'testflight contact permission is configured');
checkIncludes(source.consolePages, '<PublAudiencePage />', 'Publ embed has a dedicated audience view');
checkIncludes(source.consolePages, 'recipientSelectProps={publRecipients.selectProps}', 'all message forms receive Publ recipient props');
checkIncludes(source.recipientSelect, 'sourceTabs = []', 'recipient selector supports independent source tabs');
checkIncludes(source.recipientSource, "label: 'Publ 수신자'", 'recipient selector exposes Publ source labels');
checkIncludes(source.payloads, "type === 'publ-contact'", 'Publ contacts expand as concrete recipients');
checkNotIncludes(source.schema, 'recipientSnapshotJson', 'schema does not add a recipient snapshot');
checkNotIncludes(source.schema, 'recipient_snapshot_json', 'schema does not add a recipient snapshot column');

if (failures.length) {
  console.error('Publ iframe recipient contract failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Publ iframe recipient contract passed');

function checkIncludes(value, expected, label) {
  if (!value.includes(expected)) failures.push(`${label}: missing ${JSON.stringify(expected)}`);
}

function checkNotIncludes(value, expected, label) {
  if (value.includes(expected)) failures.push(`${label}: found forbidden ${JSON.stringify(expected)}`);
}
