export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing url", { status: 400 });
  }

  const modifiedHeaders = new Headers(request.headers);

  modifiedHeaders.set("Origin", "https://listen.tidal.com");
  modifiedHeaders.set("Referer", "https://listen.tidal.com/");
  modifiedHeaders.set("Accept", "*/*");

  const ip = request.headers.get("cf-connecting-ip");
  if (ip) modifiedHeaders.set("x-forwarded-for", ip);

  const res = await fetch(target, {
    method: request.method,
    headers: modifiedHeaders,
    body: request.body,
  });

  const responseHeaders = new Headers(res.headers);

  // Important for audio streaming
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Accept-Ranges", "bytes");

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}