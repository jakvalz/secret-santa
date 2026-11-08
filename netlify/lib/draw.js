/**
 * Fair Secret Santa draw with exclusions.
 * Returns Map giverId -> receiverId, or null if no valid assignment exists.
 */
export function runDraw(participantIds, exclusions = []) {
  if (participantIds.length < 2) return null;

  const forbidden = new Map();
  for (const id of participantIds) {
    forbidden.set(id, new Set([id]));
  }
  for (const { from, to } of exclusions) {
    if (!forbidden.has(from)) forbidden.set(from, new Set([from]));
    forbidden.get(from).add(to);
  }

  // Quick impossibility checks
  for (const id of participantIds) {
    const blocked = forbidden.get(id) || new Set([id]);
    const options = participantIds.filter((t) => !blocked.has(t));
    if (options.length === 0) return null;
  }

  const maxAttempts = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const order = shuffle([...participantIds]);
    const result = assign(order, participantIds, forbidden);
    if (result) return Object.fromEntries(result);
  }
  return null;
}

function assign(givers, receivers, forbidden) {
  const remaining = new Set(receivers);
  const result = new Map();

  function dfs(index) {
    if (index === givers.length) return true;
    const giver = givers[index];
    const blocked = forbidden.get(giver) || new Set([giver]);
    const choices = shuffle([...remaining].filter((r) => !blocked.has(r)));
    for (const receiver of choices) {
      remaining.delete(receiver);
      result.set(giver, receiver);
      if (dfs(index + 1)) return true;
      result.delete(giver);
      remaining.add(receiver);
    }
    return false;
  }

  return dfs(0) ? result : null;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
