import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const macSigning = 'Developer ID Application; hardened runtime; app and DMG notarized and stapled';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function distributionConfig(env = process.env) {
  const identity = env.SNAPSLOT_MAC_SIGN_IDENTITY, teamId = env.APPLE_TEAM_ID;
  const profile = env.SNAPSLOT_NOTARY_PROFILE, keychain = env.SNAPSLOT_MAC_KEYCHAIN;
  if (!/^[a-f0-9]{40}$/i.test(identity || '') || !/^[A-Z0-9]{10}$/.test(teamId || '') || !profile || !keychain) {
    throw new Error('Mac release requires a Developer ID identity, Apple team, notarization profile and signing keychain. See docs/releases/hosting.md.');
  }
  const reuseAppSubmission = env.SNAPSLOT_NOTARY_REUSE_APP_SUBMISSION;
  if (reuseAppSubmission && !uuid.test(reuseAppSubmission)) throw new Error('Invalid original app notarization submission ID.');
  return { identity, teamId, profile, keychain, checkpointDir: env.SNAPSLOT_NOTARY_CHECKPOINT_DIR, reuseAppSubmission };
}

function execute(command, args, capture = false) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}); the Mac release is blocked. ${capture ? result.stderr || '' : ''}`);
  return capture === 'stdout' ? result.stdout : `${result.stdout || ''}${result.stderr || ''}`;
}

export function validateDeveloperId(details, teamId, app = true) {
  if (!details.includes('Authority=Developer ID Application:') || !details.split(/\r?\n/).includes(`TeamIdentifier=${teamId}`)) {
    throw new Error('The Mac signature must use the expected team’s Developer ID Application certificate.');
  }
  if (app && !/flags=.*\bruntime\b/.test(details)) throw new Error('The Mac app must enable hardened runtime.');
  if (!/^Timestamp=/m.test(details)) throw new Error('The Mac signature needs a secure timestamp.');
}

function sign(target, config, app, run) {
  run('codesign', ['--force', '--sign', config.identity, '--keychain', config.keychain, '--timestamp', ...(app ? ['--options', 'runtime'] : []), target]);
  run('codesign', ['--verify', '--deep', '--strict', target]);
  validateDeveloperId(run('codesign', ['--display', '--verbose=4', target], true), config.teamId, app);
}

function notarize(archive, target, config, run) {
  console.log(`Submitting ${path.basename(archive)} to Apple for notarization…`);
  const auth = ['--keychain-profile', config.profile, '--keychain', config.keychain];
  const submitted = JSON.parse(run('xcrun', ['notarytool', 'submit', archive, ...auth, '--no-wait', '--output-format', 'json'], 'stdout'));
  if (!uuid.test(submitted.id || '')) throw new Error('Apple did not return a valid notarization submission ID.');
  console.log(`Apple notarization submission: ${submitted.id}`);
  // Preserve the exact signed payload outside the disposable packaging folder.
  // A timeout does not cancel Apple's processing or invalidate this submission.
  let checkpoint, receipt;
  if (config.checkpointDir) {
    mkdirSync(config.checkpointDir, { recursive: true });
    const file = path.basename(archive);
    copyFileSync(archive, path.join(config.checkpointDir, file));
    checkpoint = path.join(config.checkpointDir, `${file}.json`);
    receipt = { id: submitted.id, status: 'Submitted', file, teamId: config.teamId,
      sha256: createHash('sha256').update(readFileSync(archive)).digest('hex') };
    writeFileSync(checkpoint, JSON.stringify(receipt, null, 2) + '\n');
  }
  const result = JSON.parse(run('xcrun', ['notarytool', 'wait', submitted.id, ...auth, '--timeout', '60m', '--output-format', 'json'], 'stdout'));
  if (result.status !== 'Accepted' || !uuid.test(result.id || '')) {
    // Apple’s result is the authority: never staple, package or publish a rejected submission.
    throw new Error(`Apple notarization did not accept this build (status: ${result.status || 'unknown'}, submission: ${uuid.test(result.id || '') ? result.id : 'unknown'}). Retrieve its notarytool log before retrying.`);
  }
  if (result.id !== submitted.id) throw new Error('Apple notarization response does not match the submitted payload.');
  if (checkpoint) writeFileSync(checkpoint, JSON.stringify({ ...receipt, status: 'Accepted' }, null, 2) + '\n');
  run('xcrun', ['stapler', 'staple', target]);
  run('xcrun', ['stapler', 'validate', target]);
  run('codesign', ['--verify', '--deep', '--strict', target]);
  return result.id;
}

export function notarizeApp(app, scratch, config = distributionConfig(), run = execute) {
  sign(app, config, true, run);
  if (config.reuseAppSubmission) {
    const original = JSON.parse(run('xcrun', ['notarytool', 'info', config.reuseAppSubmission,
      '--keychain-profile', config.profile, '--keychain', config.keychain, '--output-format', 'json'], 'stdout'));
    if (original.id !== config.reuseAppSubmission || original.status !== 'Accepted') throw new Error('Original app notarization is not Accepted; wait for Apple before resuming.');
    // Stapler retrieves by this signed app's code hashes. A prior ticket that
    // does not apply to these exact binaries cannot satisfy these checks.
    run('xcrun', ['stapler', 'staple', app]);
    run('xcrun', ['stapler', 'validate', app]);
    run('codesign', ['--verify', '--deep', '--strict', app]);
    run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app]);
    console.log(`Reused accepted app notarization: ${original.id}`);
    return original.id;
  }
  const archive = path.join(scratch, 'SnapSlot-notarization.zip');
  run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, archive]);
  const submission = notarize(archive, app, config, run);
  run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app]);
  return submission;
}

export function notarizeDmg(dmg, config = distributionConfig(), run = execute) {
  sign(dmg, config, false, run);
  const submission = notarize(dmg, dmg, config, run);
  run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=2', dmg]);
  return submission;
}

export function validateMacNotarization(pkg, expectedTeam) {
  const receipt = pkg?.notarization;
  if (pkg?.signing !== macSigning || receipt?.status !== 'Accepted' || !/^[A-Z0-9]{10}$/.test(receipt?.teamId || '') ||
      !uuid.test(receipt?.appSubmission || '') || !uuid.test(receipt?.dmgSubmission || '') ||
      (expectedTeam && receipt.teamId !== expectedTeam)) {
    throw new Error('A formal Mac release must contain verified Developer ID signatures and accepted app/DMG notarization receipts.');
  }
}
