// api/status.js

const INSTANCES = {
  api: {
    label: 'API Instances',
    urls: [
      'https://eu-central.monochrome.tf',
      'https://us-west.monochrome.tf',
      'https://api.monochrome.tf',
      'https://arran.monochrome.tf',
      'https://triton.squid.wtf',
      'https://monochrome-api.samidy.com',
      'https://tidal.kinoplus.online',
      'https://wolf.qqdl.site',
      'https://maus.qqdl.site',
      'https://vogel.qqdl.site',
      'https://katze.qqdl.site',
      'https://hund.qqdl.site',
    ],
  },
  streaming: {
    label: 'Streaming Instances',
    urls: [
      'https://api.monochrome.tf',
      'https://arran.monochrome.tf',
      'https://triton.squid.wtf',
      'https://wolf.qqdl.site',
      'https://maus.qqdl.site',
      'https://vogel.qqdl.site',
      'https://katze.qqdl.site',
      'https://hund.qqdl.site',
    ],
  },
};

async function pingInstance(url) {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(tid);
    return { url, online: res.ok };
  } catch {
    return { url, online: false };
  }
}

export function checkGroup(groupKey) {
  const group = INSTANCES[groupKey];
  if (!group) return Promise.resolve([]);
  return Promise.all(group.urls.map(pingInstance));
}

export async function checkAll() {
  const [api, streaming] = await Promise.all([
    checkGroup('api'),
    checkGroup('streaming'),
  ]);
  return { api, streaming };
}

// Runs check immediately then on interval, returns stop function
export function startLiveCheck(callback, interval = 30000) {
  let running = true;
  async function run() {
    if (running) callback(await checkAll());
  }
  run();
  const id = setInterval(run, interval);
  return () => {
    running = false;
    clearInterval(id);
  };
}

export { INSTANCES, pingInstance };
