(() => {
  if (window.__tidalOriginExtension === true) return;
  window.__tidalOriginExtension = true;

  const PROXY_BASE = 'https://tune-topia.onrender.com/proxy';
  const TARGET_HOST_PATTERNS = ['tidal.com', 'amz-pr-fa.audio.tidal.com', 'binimum.org'];

  const getUrlString = (input) => {
    if (!input) return null;
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    if (typeof input === 'object' && typeof input.url === 'string') return input.url;
    return null;
  };

  const isProxyUrl = (url) => typeof url === 'string' && url.startsWith(`${PROXY_BASE}?url=`);

  const shouldProxyUrl = (input) => {
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
  };

  const proxifyUrl = (input, context = 'request') => {
    const rawUrl = getUrlString(input);
    if (!rawUrl || !shouldProxyUrl(rawUrl)) return rawUrl;

    const absoluteUrl = new URL(rawUrl, window.location.href).toString();
    const proxiedUrl = `${PROXY_BASE}?url=${encodeURIComponent(absoluteUrl)}`;

    console.log(`[TuneTopiaExtension:${context}] original`, absoluteUrl);
    console.log(`[TuneTopiaExtension:${context}] proxied`, proxiedUrl);

    return proxiedUrl;
  };

  const installSrcDescriptor = (ctor, context) => {
    if (!ctor?.prototype) return;

    const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, 'src');
    if (!descriptor?.get || !descriptor?.set || descriptor.set.__ttProxyWrapped) return;

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
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const proxiedUrl = proxifyUrl(input, 'fetch');
    if (typeof Request !== 'undefined' && input instanceof Request && proxiedUrl && proxiedUrl !== input.url) {
      return originalFetch(new Request(proxiedUrl, input), init);
    }
    return originalFetch(proxiedUrl ?? input, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    return originalOpen.call(this, method, proxifyUrl(url, 'xhr') ?? url, ...rest);
  };

  const NativeAudio = window.Audio;
  function ProxiedAudio(...args) {
    const [src] = args;
    const instance = new NativeAudio();
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

  const rewriteNode = (node) => {
    if (!(node instanceof Element)) return;

    if (node.hasAttribute('src')) {
      const currentSrc = node.getAttribute('src');
      const proxiedSrc = proxifyUrl(currentSrc, `observer:${node.tagName.toLowerCase()}`);
      if (proxiedSrc && proxiedSrc !== currentSrc) {
        node.setAttribute('src', proxiedSrc);
      }
    }

    if (node.hasAttribute('poster')) {
      const currentPoster = node.getAttribute('poster');
      const proxiedPoster = proxifyUrl(currentPoster, `observer-poster:${node.tagName.toLowerCase()}`);
      if (proxiedPoster && proxiedPoster !== currentPoster) {
        node.setAttribute('poster', proxiedPoster);
      }
    }

    node.querySelectorAll?.('[src],[poster]').forEach(rewriteNode);
  };

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        rewriteNode(mutation.target);
      }

      mutation.addedNodes.forEach(rewriteNode);
    }
  }).observe(document.documentElement || document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'poster'],
  });

  rewriteNode(document.documentElement);
  console.log('Tune Topia proxy extension enabled');
})();
