export const releaseOwner = 'LING-0001';
export const releaseRepository = 'LING-0001/SnapSlot';
export function checkReleaseRequest({ repository, actor, triggeringActor = actor, branch, version }) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Invalid release version.');
  if (repository !== releaseRepository || actor !== releaseOwner || triggeringActor !== releaseOwner) throw new Error('Only LING-0001 can release SnapSlot.');
  const match = /^(?:releasev|release\/v)((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(branch);
  if (branch !== 'release' && !match) throw new Error('Use release, releasevX.Y.Z or release/vX.Y.Z.');
  if (match && match[1] !== version) throw new Error('Release branch version must match release.json.');
  return `v${version}`;
}
