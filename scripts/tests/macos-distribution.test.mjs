import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { distributionConfig, macSigning, notarizeApp, notarizeDmg, validateDeveloperId, validateMacNotarization } from '../macos-distribution.mjs';

const env = { SNAPSLOT_MAC_SIGN_IDENTITY: 'A'.repeat(40), APPLE_TEAM_ID: 'TESTTEAM01', SNAPSLOT_NOTARY_PROFILE: 'fixture', SNAPSLOT_MAC_KEYCHAIN: '/tmp/fixture.keychain-db' };
const config = distributionConfig(env);
const submission = '12345678-1234-1234-1234-123456789abc';
const signature = 'Authority=Developer ID Application: Fixture (TESTTEAM01)\nTeamIdentifier=TESTTEAM01\nCodeDirectory flags=0x10000(runtime)\nTimestamp=Nov 5, 2026\n';

test('formal packaging refuses incomplete credentials, development certificates and missing protections', () => {
  for (const field of Object.keys(env)) assert.throws(() => distributionConfig({ ...env, [field]: '' }));
  for (const details of [signature.replace('Developer ID Application:', 'Apple Development:'), signature.replace('TeamIdentifier=TESTTEAM01', 'TeamIdentifier=OTHERTEAM1'), signature.replace('flags=0x10000(runtime)', 'flags=0x0(none)'), signature.replace('Timestamp=', 'Signed Time=')]) {
    assert.throws(() => validateDeveloperId(details, config.teamId));
  }
  assert.doesNotThrow(() => validateDeveloperId(signature, config.teamId));
});

function toolFixture({ status = 'Accepted', failStaple = false, failGatekeeper = false } = {}) {
  const calls = [];
  const run = (tool, args) => {
    calls.push([tool, args]);
    if (tool === 'codesign' && args.includes('--display')) return signature;
    if (tool === 'xcrun' && args[0] === 'notarytool') return JSON.stringify({ status, id: submission });
    if (failStaple && tool === 'xcrun' && args[0] === 'stapler') throw new Error('Staple failed');
    if (failGatekeeper && tool === 'spctl') throw new Error('Gatekeeper rejected');
    return '';
  };
  return { calls, run };
}

test('signed app is notarized before stapling and assessed with Gatekeeper', () => {
  const { calls, run } = toolFixture();
  assert.equal(notarizeApp('/tmp/SnapSlot.app', '/tmp/stage', config, run), submission);
  const sign = calls[0];
  assert.equal(sign[0], 'codesign');
  assert.ok(sign[1].includes('--timestamp') && sign[1].includes('runtime'));
  assert.ok(!sign[1].includes('--deep'));
  assert.deepEqual(calls.filter(([tool, args]) => tool === 'xcrun').map(([, args]) => args.slice(0, 2)), [
    ['notarytool', 'submit'], ['notarytool', 'wait'], ['stapler', 'staple'], ['stapler', 'validate'],
  ]);
  const submit = calls.find(([tool, args]) => tool === 'xcrun' && args[0] === 'notarytool')[1];
  assert.ok(submit.includes('--no-wait') && submit.includes(config.profile) && submit.includes(config.keychain));
  const wait = calls.find(([tool, args]) => tool === 'xcrun' && args[1] === 'wait')[1];
  assert.ok(wait.includes(submission) && wait.includes('--timeout'));
  assert.deepEqual(calls.at(-1), ['spctl', ['--assess', '--type', 'execute', '--verbose=2', '/tmp/SnapSlot.app']]);
});

test('a notarization timeout retains the exact signed payload and original submission ID', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'snapslot-notary-check-'));
  try {
    const archive = path.join(folder, 'SnapSlot-notarization.zip');
    const payload = Buffer.from('signed payload fixture');
    await writeFile(archive, payload);
    const checkpointDir = path.join(folder, 'checkpoint');
    const fixture = toolFixture();
    const run = (tool, args, capture) => {
      if (tool === 'xcrun' && args[0] === 'notarytool' && args[1] === 'wait') throw new Error('Apple processing exceeded the wait limit');
      return fixture.run(tool, args, capture);
    };
    assert.throws(() => notarizeApp('/tmp/SnapSlot.app', folder, { ...config, checkpointDir }, run), /wait limit/);
    assert.deepEqual(await readFile(path.join(checkpointDir, path.basename(archive))), payload);
    const receipt = JSON.parse(await readFile(path.join(checkpointDir, path.basename(archive) + '.json'), 'utf8'));
    assert.equal(receipt.id, submission);assert.equal(receipt.status, 'Submitted');
    assert.ok(!fixture.calls.some(([tool, args]) => tool === 'xcrun' && args[0] === 'stapler'));
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('an accepted original app submission resumes only if its ticket applies to the actual signed app', () => {
  const { calls, run } = toolFixture();
  assert.equal(notarizeApp('/tmp/SnapSlot.app', '/tmp/stage', { ...config, reuseAppSubmission: submission }, run), submission);
  assert.ok(!calls.some(([tool, args]) => tool === '/usr/bin/ditto' || (tool === 'xcrun' && args[1] === 'submit')));
  assert.ok(calls.some(([tool, args]) => tool === 'xcrun' && args[1] === 'info'));
  assert.equal(calls.at(-1)[0], 'spctl');
  for (const options of [{ status: 'In Progress' }, { failStaple: true }, { failGatekeeper: true }]) {
    const fixture = toolFixture(options);
    assert.throws(() => notarizeApp('/tmp/SnapSlot.app', '/tmp/stage', { ...config, reuseAppSubmission: submission }, fixture.run));
    assert.ok(!fixture.calls.some(([tool, args]) => tool === 'xcrun' && args[1] === 'submit'));
  }
});

test('final DMG gets its own signature, notarization and offline ticket', () => {
  const { calls, run } = toolFixture();
  assert.equal(notarizeDmg('/tmp/SnapSlot.dmg', config, run), submission);
  assert.ok(!calls[0][1].includes('runtime'));
  assert.deepEqual(calls.at(-1), ['spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=2', '/tmp/SnapSlot.dmg']]);
});

test('rejection, timeout or an invalid result never leads to stapling or publication', () => {
  for (const status of ['Invalid', 'In Progress', undefined]) {
    const { calls, run } = toolFixture({ status: status ?? '' });
    assert.throws(() => notarizeApp('/tmp/SnapSlot.app', '/tmp/stage', config, run), /did not accept/);
    assert.ok(!calls.some(([tool, args]) => tool === 'xcrun' && args[0] === 'stapler'));
  }
  for (const fault of [{ failStaple: true }, { failGatekeeper: true }]) {
    const { run } = toolFixture(fault);
    assert.throws(() => notarizeDmg('/tmp/SnapSlot.dmg', config, run));
  }
});

test('release verification rejects old ad-hoc metadata, missing receipts and wrong teams', () => {
  const pkg = { signing: macSigning, notarization: { status: 'Accepted', teamId: config.teamId, appSubmission: submission, dmgSubmission: submission } };
  assert.doesNotThrow(() => validateMacNotarization(pkg, config.teamId));
  assert.throws(() => validateMacNotarization({ signing: 'ad-hoc app, DMG not notarized' }));
  assert.throws(() => validateMacNotarization(pkg, 'OTHERTEAM1'));
  for (const field of ['status', 'teamId', 'appSubmission', 'dmgSubmission']) {
    assert.throws(() => validateMacNotarization({ ...pkg, notarization: { ...pkg.notarization, [field]: '' } }));
  }
});

test('CI setup validates credentials and cleans only its own temporary keychain on success or failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'snapslot-signing-check-'));
  try {
    const bin = path.join(root, 'bin');
    await mkdir(bin);
    await writeFile(path.join(bin, 'security'), `#!/usr/bin/env node
const fs=require('fs'),args=process.argv.slice(2);
fs.appendFileSync(process.env.FIXTURE_CALLS,args[0]+'\\n');
if(args[0]==='list-keychains'){
 const state=process.env.FIXTURE_KEYCHAIN_LIST;
 if(args.includes('-s'))fs.writeFileSync(state,JSON.stringify(args.slice(args.indexOf('-s')+1)));
 else for(const item of JSON.parse(fs.readFileSync(state,'utf8')))console.log('    "'+item+'"');
}
if(args[0]==='create-keychain')fs.writeFileSync(args.at(-1),'fixture');
if(args[0]==='find-identity')console.log('1) ${'A'.repeat(40)} "Developer ID Application: Fixture (TESTTEAM01)"');
if(args[0]==='delete-keychain')fs.unlinkSync(args.at(-1));
`, { mode: 0o755 });
    await writeFile(path.join(bin, 'xcrun'), '#!/bin/sh\nexit "${FIXTURE_NOTARY_FAILURE:-0}"\n', { mode: 0o755 });
    for (const failure of ['0', '1']) {
      const workspace = path.join(root, `run-${failure}`);
      await mkdir(workspace);
      const githubEnv = path.join(workspace, 'env');
      const calls = path.join(workspace, 'calls');
      const keychainList = path.join(workspace, 'keychains');
      const originalKeychains = ['/tmp/fixture-login.keychain-db'];
      await writeFile(keychainList, JSON.stringify(originalKeychains));
      const environment = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: workspace, GITHUB_ENV: githubEnv, FIXTURE_CALLS: calls,
        FIXTURE_KEYCHAIN_LIST: keychainList,
        MACOS_CERTIFICATE_P12_BASE64: Buffer.from('fixture').toString('base64'), MACOS_CERTIFICATE_PASSWORD: 'fixture-password', APPLE_ID: 'fixture@example.test',
        APPLE_APP_SPECIFIC_PASSWORD: 'fixture-notary-password', APPLE_TEAM_ID: config.teamId, FIXTURE_NOTARY_FAILURE: failure };
      const setup = spawnSync('bash', ['scripts/setup-macos-signing.sh'], { env: environment, encoding: 'utf8' });
      assert.equal(setup.status, Number(failure));
      assert.ok(!setup.stdout.includes(environment.MACOS_CERTIFICATE_PASSWORD) && !setup.stdout.includes(environment.APPLE_APP_SPECIFIC_PASSWORD));
      const exported = Object.fromEntries((await readFile(githubEnv, 'utf8')).trim().split('\n').map(line => {
        const i = line.indexOf('=');return [line.slice(0, i), line.slice(i + 1)];
      }));
      if (failure === '0') assert.equal(exported.SNAPSLOT_MAC_SIGN_IDENTITY, config.identity);
      else assert.ok(!exported.SNAPSLOT_NOTARY_PROFILE);
      assert.deepEqual(JSON.parse(await readFile(keychainList, 'utf8')), [exported.SNAPSLOT_MAC_KEYCHAIN, ...originalKeychains]);
      const cleanup = spawnSync('bash', ['scripts/cleanup-macos-signing.sh'], { env: { ...environment, ...exported }, encoding: 'utf8' });
      assert.equal(cleanup.status, 0);
      assert.deepEqual((await readdir(workspace)).sort(), ['calls', 'env', 'keychains']);
      assert.deepEqual(JSON.parse(await readFile(keychainList, 'utf8')), originalKeychains);
      assert.ok((await readFile(calls, 'utf8')).includes('delete-keychain'));
      const refused = spawnSync('bash', ['scripts/cleanup-macos-signing.sh'], { env: { ...environment, SNAPSLOT_MAC_KEYCHAIN_DIR: workspace }, encoding: 'utf8' });
      assert.equal(refused.status, 1);
      assert.deepEqual((await readdir(workspace)).sort(), ['calls', 'env', 'keychains']);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
