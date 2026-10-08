import fs from 'node:fs';
import path from 'node:path';

const targetFile = path.resolve('node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  let changed = false;

  // 1. Ensure preview-props is included in glob pattern
  if (content.includes('**/{*-manifest,required-server-files,prefetch-hints}.json')) {
    content = content.replace(
      '**/{*-manifest,required-server-files,prefetch-hints}.json',
      '**/{*-manifest,required-server-files,prefetch-hints,preview-props}.json'
    );
    changed = true;
  }

  // 2. Ensure preview-props is handled in fallback list as safeguard
  if (!content.includes('p.endsWith("preview-props")')) {
    content = content.replace(
      'p.endsWith("fallback-build-manifest") ||',
      'p.endsWith("fallback-build-manifest") ||\n        p.endsWith("preview-props") ||'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-opennext] Successfully patched load-manifest.js for preview-props.json');
  } else {
    console.log('[patch-opennext] load-manifest.js is already patched');
  }
} else {
  console.log('[patch-opennext] Target file not found, skipping patch');
}
