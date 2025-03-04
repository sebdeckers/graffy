import { isBranch, isRange, getIndex, getLastIndex } from '../node';
import { keyAfter, keyBefore } from '../key';

export default function sieve(current, changes, result = []) {
  let index = 0;
  for (const change of changes) {
    index = isRange(change)
      ? insertRange(current, change, result, index)
      : insertNode(current, change, result, index);
  }
  return result;
}

export function insertRange(current, change, result, start = 0) {
  const { key, end } = change;
  const keyIx = getIndex(current, key, start);
  const endIx = getLastIndex(current, end, keyIx);

  if (
    keyIx === endIx &&
    !(current[keyIx] && current[keyIx].key <= key && current[keyIx].end >= end)
  ) {
    // This range does not overlap with any existing data. Ignore it.
    return keyIx;
  }

  // TODO: Extract the parts of result that are relevant.
  result.push(change);

  // If current contains nodes that are newer than this range, keep them.
  // We do this by merging them back into insertions first.
  const insertions = [change];
  for (let i = keyIx; i < endIx; i++) {
    const node = current[i];
    if (isRange(node)) {
      insertions.push(...mergeRanges(insertions.pop(), node));
    } else {
      insertNode(insertions, node, [], insertions.length - 1);
    }
  }

  current.splice(keyIx, endIx - keyIx, ...insertions);
  return keyIx + insertions.length;
}

function mergeRanges(base, node) {
  // assertClock(node, base.clock);
  if (node.clock < base.clock) [node, base] = [base, node];
  return [
    base.key < node.key && { ...base, end: keyBefore(node.key) },
    node,
    base.end > node.end && { ...base, key: keyAfter(node.end) },
  ].filter(Boolean);
}

export function insertNode(current, change, result, start = 0) {
  const key = change.key;
  const index = getIndex(current, key, start);
  const node = current[index];

  if (node && node.key <= key) {
    // This change overlaps with something that exists.
    return isRange(node)
      ? insertNodeIntoRange(current, index, change, result)
      : updateNode(current, index, change, result);
  } else {
    // This change does not overlap with any existing knowledge. Skip it
    // current.splice(index, 0, change);
    return index;
  }
}

function insertNodeIntoRange(current, index, change, result) {
  const key = change.key;
  const range = current[index];
  const newChange = getNewer(change, range.clock);
  if (!newChange) return;
  result.push(newChange);

  const insertions = [
    range.key < key && { ...range, end: keyBefore(key) },
    newChange,
    range.end > key && { ...range, key: keyAfter(key) },
  ].filter(Boolean);
  current.splice(index, 1, ...insertions);

  return index + insertions.length;
}

function updateNode(current, index, change, result) {
  const node = current[index];
  if (isBranch(change) && isBranch(node)) {
    // Both are branches: Recursively merge children.
    const nextResult = [];
    sieve(node.children, change.children, nextResult);
    if (nextResult.length) result.push({ ...change, children: nextResult });
  } else if (isBranch(node)) {
    // Current node is a branch but the change is a leaf; if the branch
    // has newer children, ignore the change and keep only those children;
    // Otherwise, discard the branch and keep the change.
    const newNode = getNewer(node, change.clock);
    current[index] = newNode || change;
    if (!newNode) result.push(change);
    // TODO: In the case of partial removal, what should result be?
  } else {
    // Current node is a leaf. Replace with the change if it is newer.
    const newChange = getNewer(change, node.clock);
    if (newChange) {
      current[index] = newChange;
      result.push(newChange);
    }
  }
  return index + 1;
}

function getNewer(node, clock) {
  if (isBranch(node)) {
    const children = node.children.filter(child => getNewer(child, clock));
    return children.length && { ...node, children };
  } else {
    // assertClock(node, clock);
    return node.clock >= clock ? node : null;
  }
}

// function assertClock(node, clock) {
//   // if (node.clock === clock) {
//   //   throw Error('merge.clock_collision ' + [node.key, clock].join(' '));
//   // }
// }
