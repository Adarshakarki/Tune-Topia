const PROXY_BASE = 'https://tune-topia.onrender.com/proxy';
const TARGET_HOST_PATTERNS = [
  'tidal.com',
  'amz-pr-fa.audio.tidal.com',
  'resources.tidal.com',
  'binimum.org',
  'tidal-api.binimum.org',
  'lyrics-api.binimum.org',
  'lrclib.net',
  'wsrv.nl',
  'm8tec.top',
];

function getUrlString(input) {
  if (!input) return null;
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  if (typeof input === 'object' && typeof input.url === 'string') return input.url;
  return null;
}

function isProxyUrl(url) {
  return typeof url === 'string' && url.startsWith(`${PROXY_BASE}?url=`);
}

function shouldProxyUrl(input) {
  const rawUrl = getUrlString(input);
  if (!rawUrl || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:') || isProxyUrl(rawUrl)) {
    return false;
  }

  try {
    const absoluteUrl = new URL(rawUrl, window.location.href);
    if (!/^https?:$/.test(absoluteUrl.protocol)) return false;
    if (absoluteUrl.origin === window.location.origin) return false;

    const hostname = absoluteUrl.hostname.toLowerCase();
    return TARGET_HOST_PATTERNS.some((pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`));
  } catch {
    return false;
  }
}

export function proxifyUrl(input, context = 'request') {
  const rawUrl = getUrlString(input);
  if (!rawUrl || !shouldProxyUrl(rawUrl)) return rawUrl;

  const absoluteUrl = new URL(rawUrl, window.location.href).toString();
  const proxiedUrl = `${PROXY_BASE}?url=${encodeURIComponent(absoluteUrl)}`;

  console.log(`[ProxyRewrite:${context}] original`, absoluteUrl);
  console.log(`[ProxyRewrite:${context}] proxied`, proxiedUrl);

  return proxiedUrl;
}

export async function debugProxyStatus(input, context = 'request') {
  const rawInput = getUrlString(input);
  const proxiedUrl = isProxyUrl(rawInput) ? rawInput : proxifyUrl(input, `${context}:head`);
  if (!proxiedUrl) return null;

  try {
    const response = await window.fetch(proxiedUrl, { method: 'HEAD' });
    console.log(`[ProxyRewrite:${context}] proxy status`, response.status, proxiedUrl);
    return response.status;
  } catch (error) {
    console.warn(`[ProxyRewrite:${context}] proxy HEAD failed`, error);
    return null;
  }
}

function installSrcDescriptor(ctor, context) {
  if (!ctor?.prototype) return;

  const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, 'src');
  if (!descriptor?.set || !descriptor?.get || descriptor.set.__ttProxyWrapped) return;

  const originalSet = descriptor.set;
  const originalGet = descriptor.get;

  const wrappedSet = function wrappedSrc(value) {
    originalSet.call(this, proxifyUrl(value, context));
  };

  wrappedSet.__ttProxyWrapped = true;

  Object.defineProperty(ctor.prototype, 'src', {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: originalGet,
    set: wrappedSet,
  });
}

export function installGlobalProxyInterceptors() {
  if (window.__ttGlobalProxyInstalled) return;
  window.__ttGlobalProxyInstalled = true;

  window.__userInteracted = false;
  const markUserInteracted = () => {
    window.__userInteracted = true;
  };

  ['click', 'touchstart', 'keydown'].forEach((eventName) => {
    document.addEventListener(eventName, markUserInteracted, { capture: true, passive: true });
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const proxiedUrl = proxifyUrl(input, 'fetch');
    if (typeof Request !== 'undefined' && input instanceof Request && proxiedUrl && proxiedUrl !== input.url) {
      return originalFetch(new Request(proxiedUrl, input), init);
    }
    return originalFetch(proxiedUrl ?? input, init);
  };

  const NativeAudio = window.Audio;
  function ProxiedAudio(...args) {
    const [src, ...rest] = args;
    const instance = new NativeAudio();
    if (rest.length) {
      console.warn('[ProxyRewrite:audio-constructor] Ignoring unexpected Audio constructor args', rest);
    }
    if (src) {
      instance.src = proxifyUrl(src, 'audio-constructor');
    }
    return instance;
  }
  ProxiedAudio.prototype = NativeAudio.prototype;
  Object.setPrototypeOf(ProxiedAudio, NativeAudio);
  window.Audio = ProxiedAudio;

  installSrcDescriptor(window.HTMLMediaElement, 'media-src');
  installSrcDescriptor(window.HTMLImageElement, 'image-src');
  installSrcDescriptor(window.HTMLSourceElement, 'source-src');

  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function patchedSetAttribute(name, value) {
    if (typeof value === 'string' && (name === 'src' || name === 'poster')) {
      return originalSetAttribute.call(this, name, proxifyUrl(value, `setAttribute:${this.tagName.toLowerCase()}`));
    }
    return originalSetAttribute.call(this, name, value);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    return originalOpen.call(this, method, proxifyUrl(url, 'xhr') ?? url, ...rest);
  };
}
