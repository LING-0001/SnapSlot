import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkReleaseRequest } from '../release-policy.mjs';
import { fetchRelease, validateManifest } from '../fetch-release.mjs';
const request = { repository: 'LING-0001/SnapSlot', actor: 'LING-0001', version: '1.2.0' };
test('only the owner can publish, including reruns; branch versions must match', () => {
  for (const branch of ['release', 'releasev1.2.0', 'release/v1.2.0']) assert.equal(checkReleaseRequest({ ...request, branch }), 'v1.2.0');
  for (const change of [{ actor: 'collaborator' }, { triggeringActor: 'collaborator' }, { repository: 'someone/SnapSlot' }, { branch: 'main' }, { branch: 'releasev1.3.0' }, { branch: 'releasev01.2.0' }, { version: '../outside' }]) assert.throws(() => checkReleaseRequest({ ...request, branch: 'release', ...change }));
});
function fixture() {
  const version = '1.2.0', files = {}, packages = {};
  for (const [platform, suffix] of [['macos', 'macOS-universal.dmg'], ['windows', 'windows-x64-setup.exe']]) {
    const file = `SnapSlot-${version}-${suffix}`, data = Buffer.alloc(1024, platform === 'macos' ? 1 : 2);
    files[file] = data; packages[platform] = { file, url: `/downloads/v${version}/${file}`, size: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }
  const manifest = { version, tag: `v${version}`, packages };
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest));
  files['SHA256SUMS.txt'] = Buffer.from(Object.values(packages).map(pkg => `${pkg.sha256}  ${pkg.file}`).join('\n') + '\n');
  return { version, files, manifest };
}
test('download metadata rejects traversal, extra packages and incorrect versions', () => {
  const { manifest } = fixture();
  for (const mutate of [m => { m.version = '9.0.0'; }, m => { m.packages.macos.file = '../secret'; }, m => { m.packages.extra = { file: '../secret' }; }, m => { m.packages.windows.size = -1; }]) {
    const broken = structuredClone(manifest); mutate(broken); assert.throws(() => validateManifest(broken, '1.2.0'));
  }
});
test('website caches verified releases and rejects corrupt downloads without replacing a cache', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snapslot-fetch-check-'));
  try {
    const { version, files, manifest } = fixture(); let calls = 0;
    const fetcher = async url => { calls++; return new Response(files[url.split('/').at(-1)], { status: 200 }); };
    const folder = await fetchRelease({ root, version, base: 'https://example.test', fetcher });
    assert.equal(calls, 4);
    await fetchRelease({ root, version, fetcher: () => { throw new Error('A valid cache must not use the network'); } });
    await writeFile(path.join(folder, manifest.packages.windows.file), 'old-corrupt-cache');
    const corrupt = async url => new Response(url.endsWith('.exe') ? Buffer.alloc(1024) : files[url.split('/').at(-1)]);
    await assert.rejects(fetchRelease({ root, version, base: 'https://example.test', fetcher: corrupt }), /Invalid cached package/);
    assert.equal(await readFile(path.join(folder, manifest.packages.windows.file), 'utf8'), 'old-corrupt-cache');
  } finally { await rm(root, { recursive: true, force: true }); }
});

import { publishRelease } from '../release-publication.mjs';
async function publicationFixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'snapslot-publish-check-'));
  try {
    const files = [];
    for (let i = 0; i < 6; i++) { const file = path.join(root, `asset-${i}`); await writeFile(file, `release file ${i}`); files.push(file); }
    const sha = 'a'.repeat(40), state = { release: null, assets: [], branch: sha, uploads: 0, checks: 0 };
    const fetcher = async (url, options) => {
      const route = new URL(url).pathname.replace('/repos/LING-0001/SnapSlot', '');
      const body = options.body && JSON.parse(options.body);
      if (route.startsWith('/git/ref/')) { state.checks++; return Response.json({ object: { sha: state.branch } }); }
      if (route.startsWith('/compare/')) return Response.json({ status: state.comparison || 'ahead' });
      if (route.startsWith('/releases/tags/')) return state.release ? Response.json(state.release) : new Response('', { status: 404 });
      if (route === '/releases' && options.method === 'POST') { state.release = { ...body, id: 1, html_url: 'https://github.com/LING-0001/SnapSlot/releases/tag/v1.2.0' }; return Response.json(state.release); }
      if (route === '/releases/1/assets') return Response.json(state.assets);
      if (route === '/releases/1' && options.method === 'PATCH') { Object.assign(state.release, body); return Response.json(state.release); }
      throw new Error(`Unexpected publication API: ${route}`);
    };
    const upload = async () => {
      state.uploads++;
      state.assets = await Promise.all(files.map(async file => { const data = await readFile(file); return { name: path.basename(file), size: data.length, state: 'uploaded', digest: `sha256:${createHash('sha256').update(data).digest('hex')}` }; }));
    };
    await run({ state, options: { sha, tag: 'v1.2.0', branch: 'releasev1.2.0', token: 'test-only', files, notes: 'Release notes', fetcher, upload } });
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('publication remains a draft until every uploaded asset is verified', () => publicationFixture(async ({ state, options }) => {
  const result = await publishRelease(options);
  assert.equal(result.draft, false); assert.equal(result.target_commitish, options.sha); assert.equal(state.checks, 2);
}));
test('a bad upload never exposes a release and an existing published release is never changed', () => publicationFixture(async ({ state, options }) => {
  const upload = options.upload;
  await assert.rejects(publishRelease({ ...options, upload: async () => { await upload(); state.assets[0].digest = 'sha256:incorrect'; } }), /verification failed/);
  assert.equal(state.release.draft, true);
  state.release.draft = false; const previousUploads = state.uploads;
  await assert.rejects(publishRelease(options), /published release/);
  assert.equal(state.uploads, previousUploads);
}));
test('an advanced release branch prevents an outdated build from being published', () => publicationFixture(async ({ state, options }) => {
  const upload = options.upload;
  await assert.rejects(publishRelease({ ...options, upload: async () => { await upload(); state.branch = 'b'.repeat(40); } }), /outdated build/);
  assert.equal(state.release.draft, true);
}));

test('only a later main commit can replace an unpublished draft', () => publicationFixture(async ({ state, options }) => {
  state.release = { id: 1, draft: true, target_commitish: 'b'.repeat(40) };
  state.comparison = 'diverged';
  await assert.rejects(publishRelease(options), /unrelated or older commit/);
  assert.equal(state.uploads, 0);
  state.comparison = 'ahead';
  const published = await publishRelease(options);
  assert.equal(published.target_commitish, options.sha);
  assert.equal(published.draft, false);
}));
