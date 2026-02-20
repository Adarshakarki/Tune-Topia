import { INSTANCES } from './config.js';

let activeInstance = null;

export async function pickInstance(pill) {
  for (const inst of INSTANCES) {
    try {
      const r = await fetch(`${inst}/api/v1/search?q=test&type=video&fields=videoId`);
      if (r.ok) {
        activeInstance = inst;
        pill.textContent = '● ' + inst.replace('https://','');
        pill.className = 'server-pill ok';
        return true;
      }
    } catch {}
  }
  pill.textContent = '✕ No server';
  pill.className = 'server-pill err';
  return false;
}

export async function search(query, pill) {
  if (!activeInstance) await pickInstance(pill);
  if (!activeInstance) throw new Error('No server available');

  const r = await fetch(
    `${activeInstance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
  );
  if (!r.ok) throw new Error('Search failed');
  return r.json();
}
