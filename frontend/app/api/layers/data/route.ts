import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const filePathParam = request.nextUrl.searchParams.get('path');

  if (!filePathParam) {
    return NextResponse.json({ error: 'Paramètre path requis' }, { status: 400 });
  }

  const rootPath = process.env.GEOJSON_PATH || '../mpk_to_geojson/geojson_dir';
  const resolvedRootPath = path.resolve(process.cwd(), rootPath);
  const fullPath = path.resolve(resolvedRootPath, filePathParam);

  // Sécurité : interdire le path traversal
  if (!fullPath.startsWith(resolvedRootPath)) {
    return NextResponse.json({ error: 'Chemin invalide' }, { status: 403 });
  }

  // Valider l'extension
  if (!fullPath.endsWith('.geojson') && !fullPath.endsWith('.json')) {
    return NextResponse.json({ error: 'Type de fichier invalide' }, { status: 403 });
  }

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  try {
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const json = JSON.parse(fileContent);

    if (!json.type || !['FeatureCollection', 'Feature', 'GeometryCollection'].includes(json.type)) {
      return NextResponse.json({ error: 'Format GeoJSON invalide' }, { status: 400 });
    }

    return NextResponse.json(json);
  } catch (error) {
    console.error('Erreur lecture fichier :', error);
    return NextResponse.json({ error: 'Erreur lecture fichier' }, { status: 500 });
  }
}
