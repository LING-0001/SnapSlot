import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifySourceVersion, repositoryRoot } from './verify-source.mjs';
import { checkReleaseRequest } from './release-policy.mjs';
import { publishRelease } from './release-publication.mjs';
const version = await verifySourceVersion();
const tag = checkReleaseRequest({ repository: process.env.GITHUB_REPOSITORY, actor: process.env.GITHUB_ACTOR, triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR, branch: process.env.GITHUB_REF_NAME, version });
const sha = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid publication commit.');
const folder = path.join(repositoryRoot, `apps/website/public/downloads/${tag}`);
const files = [
  path.join(folder, `SnapSlot-${version}-macOS-universal.dmg`), path.join(folder, `SnapSlot-${version}-windows-x64-setup.exe`),
  path.join(folder, 'SHA256SUMS.txt'), path.join(folder, 'manifest.json'),
  path.join(repositoryRoot, `artifacts/release/SnapSlot-${version}-website.zip`), path.join(repositoryRoot, `artifacts/release/SnapSlot-${version}-media.zip`),
];
const release = await publishRelease({ tag, sha, branch: process.env.GITHUB_REF_NAME, token: process.env.GH_TOKEN, files, notes: await readFile(path.join(repositoryRoot, `docs/releases/${tag}.md`), 'utf8') });
console.log(`Published ${release.html_url} from ${sha}; all six assets verified.`);
