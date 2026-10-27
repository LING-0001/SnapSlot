import { verifySourceVersion } from './verify-source.mjs';
import { fetchRelease } from './fetch-release.mjs';
const version = await verifySourceVersion();
if (process.env.SNAPSLOT_SOURCE_CHECK_ONLY === '1') {
  console.log(`CI source preview for v${version}; installer download/validation skipped; do not deploy this preview.`);
} else {
  await fetchRelease({ version });
  await import('./verify-release.mjs');
}
