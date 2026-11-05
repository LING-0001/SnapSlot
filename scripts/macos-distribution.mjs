import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const macSigning = 'Developer ID Application; hardened runtime; app and DMG notarized and stapled';
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function distributionConfig(env = process.env) {
  const identity = env.SNAPSLOT_MAC_SIGN_IDENTITY, teamId = env.APPLE_TEAM_ID;
  const profile = env.SNAPSLOT_NOTARY_PROFILE, keychain = env.SNAPSLOT_MAC_KEYCHAIN;
  if (!/^[a-f0-9]{40}$/i.test(identity || '') || !/^[A-Z0-9]{10}$/.test(teamId || '') || !profile || !keychain) {
    throw new Error('Mac release requires a Developer ID identity, Apple team, notarization profile and signing keychain. See docs/releases/hosting.md.');
  }
  return { identity, teamId, profile, keychain };
}

function execute(command, args, capture = false) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}); the Mac release is blocked. ${capture ? result.stderr || '' : ''}`);
  return `${result.stdout || ''}${result.stderr || ''}`;
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
  const result = JSON.parse(run('xcrun', ['notarytool', 'submit', archive, ...auth, '--wait', '--timeout', '20m', '--output-format', 'json'], true));
  if (result.status !== 'Accepted' || !uuid.test(result.id || '')) {
    // Apple’s result is the authority: never staple, package or publish a rejected submission.
    throw new Error(`Apple notarization did not accept this build (status: ${result.status || 'unknown'}, submission: ${uuid.test(result.id || '') ? result.id : 'unknown'}). Retrieve its notarytool log before retrying.`);
  }
  run('xcrun', ['stapler', 'staple', target]);
  run('xcrun', ['stapler', 'validate', target]);
  run('codesign', ['--verify', '--deep', '--strict', target]);
  return result.id;
}

export function notarizeApp(app, scratch, config = distributionConfig(), run = execute) {
  sign(app, config, true, run);
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
