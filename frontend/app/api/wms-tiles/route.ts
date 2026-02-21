export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tileUrl = searchParams.get('url');

  if (!tileUrl) {
    return new Response('Missing url', { status: 400 });
  }

  try {
    new URL(tileUrl);
  } catch {
    return new Response('URL invalide', { status: 400 });
  }

  const resp = await fetch(tileUrl);
  const buffer = await resp.arrayBuffer();
  const contentType = resp.headers.get('content-type') || 'image/png';

  return new Response(buffer, {
    headers: { 'Content-Type': contentType },
  });
}
