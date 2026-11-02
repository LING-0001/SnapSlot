import { verifySourceVersion } from './verify-source.mjs';
import { fetchRelease } from './fetch-release.mjs';
const sourceVersion = await verifySourceVersion();
const version = process.env.NEXT_PUBLIC_SNAPSLOT_RELEASE_VERSION || sourceVersion;
if (process.env.GITHUB_REF_TYPE === 'tag' && version !== sourceVersion) throw new Error('A tagged release must use its own installers');
if (process.env.SNAPSLOT_SOURCE_CHECK_ONLY === '1') {
  console.log(`CI source preview for v${version}; installer download/validation skipped; do not deploy this preview.`);
} else {
  await fetchRelease({ version });
  await import('./verify-release.mjs');
}
