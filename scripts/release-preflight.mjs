import { appendFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { verifySourceVersion, repositoryRoot } from './verify-source.mjs';
import { checkReleaseRequest } from './release-policy.mjs';
const version = await verifySourceVersion();
const tag = checkReleaseRequest({ repository: process.env.GITHUB_REPOSITORY, actor: process.env.GITHUB_ACTOR, triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR, branch: process.env.GITHUB_REF_NAME, version });
const sha = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid release source commit.');
execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main'], { cwd: repositoryRoot });
await access(`${repositoryRoot}/docs/releases/${tag}.md`);
const response = await fetch(`https://api.github.com/repos/LING-0001/SnapSlot/releases/tags/${tag}`, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
if (response.ok) {
  const release = await response.json();
  if (!release.draft || !/^[a-f0-9]{40}$/.test(release.target_commitish)) throw new Error(`${tag} already has a Release. Use a new version; published packages are never overwritten.`);
  execFileSync('git', ['merge-base', '--is-ancestor', release.target_commitish, sha], { cwd: repositoryRoot });
}
if (!response.ok && response.status !== 404) throw new Error(`Cannot check existing release (${response.status}).`);
try {
  const existing = execFileSync('git', ['rev-parse', '--verify', `${tag}^{commit}`], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (existing !== sha) throw new Error(`${tag} already points to another commit.`);
} catch (error) { if (!error.status) throw error; }
await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\n`);
console.log(`Release authorized: ${tag} from ${sha}`);
