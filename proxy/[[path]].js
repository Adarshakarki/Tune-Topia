// Cloudflare Worker / Pages Function Logic
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Rewrite destination to Tidal API by stripping the /proxy prefix
  const pathname = url.pathname.replace(/^\/proxy/, '');
  const targetUrl = `https://api.tidal.com${pathname}${url.search}`;

  const modifiedHeaders = new Headers(request.headers);
  modifiedHeaders.set("Origin", "https://listen.tidal.com");
  modifiedHeaders.set("Referer", "https://listen.tidal.com/");
  
  // Forward original IP for rate limiting/analytics
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) modifiedHeaders.set("x-forwarded-for", ip);

  return fetch(targetUrl, {
    method: request.method,
    headers: modifiedHeaders,
    body: request.body
  });
}