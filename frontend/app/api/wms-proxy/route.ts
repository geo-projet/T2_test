export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wmsUrl = searchParams.get('url');

  if (!wmsUrl) {
    return Response.json({ error: 'Paramètre url manquant' }, { status: 400 });
  }

  try {
    new URL(wmsUrl);
  } catch {
    return Response.json({ error: 'URL invalide' }, { status: 400 });
  }

  const capUrl = new URL(wmsUrl);
  capUrl.searchParams.set('SERVICE', 'WMS');
  capUrl.searchParams.set('REQUEST', 'GetCapabilities');

  const resp = await fetch(capUrl.toString());
  const xml = await resp.text();

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
