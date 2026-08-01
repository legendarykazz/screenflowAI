export function getParticipantLayout(remoteCount) {
  const count = Math.max(0, Number(remoteCount) || 0);
  if (count === 0) return 'empty';
  if (count === 1) return 'solo';
  if (count === 2) return 'pair';
  if (count <= 4) return 'quad';
  if (count <= 9) return 'compact';
  return 'dense';
}
