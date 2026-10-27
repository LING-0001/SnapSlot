import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export async function publishRelease({ tag, sha, branch, token, files, notes, fetcher = fetch, upload = (paths, releaseTag, auth) => execFileSync('gh', ['release', 'upload', releaseTag, ...paths, '--clobber'], { stdio: 'inherit', env: { ...process.env, GH_TOKEN: auth, GH_REPO: 'LING-0001/SnapSlot' } }) }) {
  const api = 'https://api.github.com/repos/LING-0001/SnapSlot';
  async function request(route, { method = 'GET', body, missing = false } = {}) {
    const response = await fetcher(`${api}${route}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (missing && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub publication request failed: ${method} ${route} (${response.status})`);
    return response.json();
  }
  async function checkCurrentBranch() {
    const ref = await request(`/git/ref/heads/${branch}`);
    if (ref.object.sha !== sha) throw new Error('Release branch advanced. This outdated build will not be published.');
  }
  await checkCurrentBranch();
  let release = await request(`/releases/tags/${tag}`, { missing: true });
  if (release && !release.draft) throw new Error('Refusing to change a published release.');
  if (release && release.target_commitish !== sha) {
    if (!/^[a-f0-9]{40}$/.test(release.target_commitish)) throw new Error('Unrecognized draft source commit.');
    const comparison = await request(`/compare/${release.target_commitish}...${sha}`);
    if (comparison.status !== 'ahead') throw new Error('Refusing to replace a draft with an unrelated or older commit.');
    release = await request(`/releases/${release.id}`, { method: 'PATCH', body: { target_commitish: sha, body: notes } });
  }
  if (!release) release = await request('/releases', { method: 'POST', body: { tag_name: tag, target_commitish: sha, name: `SnapSlot ${tag}`, body: notes, draft: true } });
  await upload(files, tag, token);
  const assets = await request(`/releases/${release.id}/assets?per_page=100`);
  for (const file of files) {
    const data = await readFile(file), asset = assets.find(item => item.name === path.basename(file));
    const digest = `sha256:${createHash('sha256').update(data).digest('hex')}`;
    if (!asset || asset.state !== 'uploaded' || asset.size !== data.length || asset.digest !== digest) throw new Error(`Release asset verification failed: ${path.basename(file)}. The release remains a draft.`);
  }
  await checkCurrentBranch();
  release = await request(`/releases/${release.id}`, { method: 'PATCH', body: { draft: false, make_latest: 'true' } });
  return release;
}
