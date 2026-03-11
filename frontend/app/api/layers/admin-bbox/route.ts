import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Whitelist of allowed files for security
const ALLOWED_FILES = new Set(['municipalite.geojson']);

interface GeoJSONFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface CachedFeature {
  feature: GeoJSONFeature;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
}

interface CacheEntry {
  features: CachedFeature[];
}

// Module-level cache: parse once, reuse across requests
const cache = new Map<string, CacheEntry>();

/**
 * Compute the bounding box of a GeoJSON geometry by walking all coordinates.
 */
function computeBbox(coordinates: unknown): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function walk(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    // If it's a coordinate pair [x, y, ...]
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const x = coords[0] as number;
      const y = coords[1] as number;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    // Otherwise recurse into nested arrays
    for (const c of coords) {
      walk(c);
    }
  }

  walk(coordinates);
  return [minX, minY, maxX, maxY];
}

/**
 * Check if two bounding boxes intersect.
 */
function bboxIntersects(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

async function loadAndCache(fileName: string): Promise<CacheEntry> {
  const existing = cache.get(fileName);
  if (existing) return existing;

  const filePath = join(process.cwd(), 'public', fileName);
  const raw = await readFile(filePath, 'utf-8');
  const geojson = JSON.parse(raw) as { type: string; features: GeoJSONFeature[] };

  const cachedFeatures: CachedFeature[] = geojson.features.map((feature, idx) => {
    // Ensure each feature has a stable numeric id for OL deduplication
    if (feature.id === undefined || feature.id === null) {
      feature.id = idx;
    }
    return {
      feature,
      bbox: computeBbox(feature.geometry.coordinates),
    };
  });

  const entry: CacheEntry = { features: cachedFeatures };
  cache.set(fileName, entry);
  return entry;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');
  const bboxParam = searchParams.get('bbox');

  if (!file || !ALLOWED_FILES.has(file)) {
    return NextResponse.json({ error: 'File not allowed' }, { status: 400 });
  }

  if (!bboxParam) {
    return NextResponse.json({ error: 'Missing bbox parameter' }, { status: 400 });
  }

  const parts = bboxParam.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return NextResponse.json({ error: 'Invalid bbox format' }, { status: 400 });
  }
  const queryBbox: [number, number, number, number] = [parts[0], parts[1], parts[2], parts[3]];

  try {
    const entry = await loadAndCache(file);

    const filtered = entry.features
      .filter(cf => bboxIntersects(cf.bbox, queryBbox))
      .map(cf => cf.feature);

    return NextResponse.json({
      type: 'FeatureCollection',
      features: filtered,
    });
  } catch (err) {
    console.error('admin-bbox error:', err);
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
  }
}
