// Instance monitoring
import { CORS_PROXY } from './utils.js';

const INSTANCES = {
  api: {
    label: 'API Instances',
    urls: ['https://eu-central.monochrome.tf', 'https://us-west.monochrome.tf', 'https://arran.monochrome.tf', 'https://api.monochrome.tf', 'https://monochrome-api.samidy.com', 'https://triton.squid.wtf', 'https://wolf.qqdl.site', 'https://maus.qqdl.site', 'https://vogel.qqdl.site', 'https://hund.qqdl.site', 'https://tidal.kinoplus.online'],
  },
  streaming: {
    label: 'Streaming Instances',
    urls: ['https://arran.monochrome.tf', 'https://triton.squid.wtf', 'https://wolf.qqdl.site', 'https://maus.qqdl.site', 'https://vogel.qqdl.site', 'https://katze.qqdl.site', 'https://hund.qqdl.site', 'https://hifi.p1nkhamster.xyz'],
  },
}

// Ping instance
export async function pingInstance(url) {
  const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 6000);
  try {
    const finalUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
    const res = await fetch(finalUrl, { signal: ctrl.signal, cache: 'no-store' });
    return { url, online: res.ok };
  } catch { return { url, online: false }; }
  finally { clearTimeout(tid); }
}

export const checkGroup = k => INSTANCES[k] ? Promise.all(INSTANCES[k].urls.map(pingInstance)) : Promise.resolve([]);

export async function checkAll() {
  const [api, streaming] = await Promise.all([checkGroup('api'), checkGroup('streaming')]);
  return { api, streaming };
}

// Status loop
export function startLiveCheck(cb, ms = 30000) {
  let active = true;
  const run = async () => { if (active) { cb(await checkAll()); setTimeout(run, ms); } };
  run();
  return () => active = false;
}

export { INSTANCES }