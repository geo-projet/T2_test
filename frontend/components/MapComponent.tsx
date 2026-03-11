"use client";

import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import ImageTile from 'ol/ImageTile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { defaults as defaultControls } from 'ol/control';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { Select, Draw } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import type { DrawEvent } from 'ol/interaction/Draw';
import { intersects as extentIntersects } from 'ol/extent';
import type { FeatureLike } from 'ol/Feature';
import { click } from 'ol/events/condition';
import ToolButton from './ToolButton';
import WMSDialog from './WMSDialog';
import PrintDialog from './PrintDialog';

// Constants
const MAP_DEFAULTS = {
  INITIAL_CENTER: [0, 0] as [number, number],
  INITIAL_ZOOM: 2,
  MAX_ZOOM: 16,
  FIT_PADDING: [50, 50, 50, 50] as [number, number, number, number],
  DRAW_Z_INDEX: 999,
} as const;

const COLORS = {
  PRIMARY: '#3b82f6',
  PRIMARY_LIGHT: 'rgba(59, 130, 246, 0.1)',
  DRAW_STROKE: '#ffcc33',
  DRAW_FILL: 'rgba(255, 255, 255, 0.2)',
  SELECT_STROKE: 'rgba(255, 0, 0, 0.7)',
  SELECT_FILL: 'rgba(255, 0, 0, 0.1)',
} as const;

interface ActiveLayer {
  id: string; // groupName/fileName
  groupName: string;
  fileName: string;
  url?: string; // Custom URL (e.g. static file in /public)
}

interface ActiveWmsLayer {
  id: string;
  url: string;
  layerName: string;
  title: string;
}

interface MapComponentProps {
  activeLayers: ActiveLayer[];
  layerColors: Record<string, string>;
  layerOpacities: Record<string, number>;
  activeWmsLayers: ActiveWmsLayer[];
  onAddWmsLayers: (layers: ActiveWmsLayer[]) => void;
  onRoiChange?: (bbox: [number, number, number, number] | null, matchedLayerIds: string[], adminKeywords?: string[]) => void;
  onInitialOpacity?: (layerId: string, opacity: number) => void;
}

type ToolMode = 'navigate' | 'select' | 'draw';

// Helper function to create layer style from color and opacity
// Polygones : stroke opaque, fill transparent | Lignes : tout transparent | Points : tout transparent
/** Check if a layer is an admin layer (loaded via bbox strategy) */
const isAdminLayer = (layerInfo: ActiveLayer): boolean =>
  layerInfo.id.startsWith('__admin__/');

const createLayerStyle = (color: string, opacity: number = 0.1) => {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  const colorWithAlpha = `${color}${alpha}`;

  const polygonStyle = new Style({
    stroke: new Stroke({ color: color, width: 2 }),
    fill: new Fill({ color: colorWithAlpha }),
  });

  const lineStyle = new Style({
    stroke: new Stroke({ color: colorWithAlpha, width: 2 }),
  });

  const pointStyle = new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: colorWithAlpha }),
      stroke: new Stroke({ color: colorWithAlpha, width: 1 }),
    }),
  });

  return (feature: FeatureLike) => {
    const geomType = feature.getGeometry()?.getType();
    if (geomType === 'Point' || geomType === 'MultiPoint') return pointStyle;
    if (geomType === 'LineString' || geomType === 'MultiLineString') return lineStyle;
    return polygonStyle;
  };
};

const MapComponent: React.FC<MapComponentProps> = ({ activeLayers, layerColors, layerOpacities, activeWmsLayers, onAddWmsLayers, onRoiChange, onInitialOpacity }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<OlMap | null>(null);
  const vectorLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const wmsLayerRefsRef = useRef<Map<string, TileLayer<TileWMS>>>(new Map());
  const drawSourceRef = useRef<VectorSource>(new VectorSource());

  // State
  type BasemapKey = 'osm' | 'satellite' | 'hybrid' | 'topo' | 'positron' | 'dark' | 'esri';
  const [baseLayer, setBaseLayer] = useState<BasemapKey>('osm');
  const [toolMode, setToolMode] = useState<ToolMode>('navigate');
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<Record<string, unknown> | null>(null);
  const [wmsDialogOpen, setWmsDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM({ crossOrigin: 'anonymous' }),
      properties: { name: 'osm' },
      visible: true,
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        maxZoom: 20,
        crossOrigin: 'anonymous',
      }),
      properties: { name: 'satellite' },
      visible: false,
    });

    const hybridLayer = new TileLayer({
      source: new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        maxZoom: 20,
        crossOrigin: 'anonymous',
      }),
      properties: { name: 'hybrid' },
      visible: false,
    });

    const topoLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
        maxZoom: 17,
        crossOrigin: 'anonymous',
      }),
      properties: { name: 'topo' },
      visible: false,
    });

    const positronLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        maxZoom: 20,
        crossOrigin: 'anonymous',
      }),
      properties: { name: 'positron' },
      visible: false,
    });

    const darkLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        maxZoom: 20,
        crossOrigin: 'anonymous',
      }),
      properties: { name: 'dark' },
      visible: false,
    });

    const esriLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 19,
        crossOrigin: 'anonymous',
      }),
      properties: { name: 'esri' },
      visible: false,
    });

    // Layer for drawn items (ROI)
    const drawLayer = new VectorLayer({
      source: drawSourceRef.current,
      style: new Style({
        fill: new Fill({ color: COLORS.DRAW_FILL }),
        stroke: new Stroke({ color: COLORS.DRAW_STROKE, width: 2 }),
      }),
      zIndex: MAP_DEFAULTS.DRAW_Z_INDEX,
    });

    const map = new OlMap({
      target: mapRef.current,
      layers: [osmLayer, satelliteLayer, hybridLayer, topoLayer, positronLayer, darkLayer, esriLayer, drawLayer],
      view: new View({
        projection: 'EPSG:4326',
        center: MAP_DEFAULTS.INITIAL_CENTER,
        zoom: MAP_DEFAULTS.INITIAL_ZOOM,
      }),
      controls: defaultControls({ zoom: false, rotate: false }),
    });

    mapInstance.current = map;

    return () => {
      vectorLayersRef.current.forEach(layer => {
        layer.getSource()?.clear();
      });
      vectorLayersRef.current.clear();
      wmsLayerRefsRef.current.forEach(layer => map.removeLayer(layer));
      wmsLayerRefsRef.current.clear();
      drawSourceRef.current.clear();
      map.setTarget(undefined);
    };
  }, []);

  // Handle Interactions (Select & Draw)
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    map.getInteractions().forEach((interaction) => {
      if (interaction instanceof Select || interaction instanceof Draw) {
        map.removeInteraction(interaction);
      }
    });

    if (toolMode === 'select') {
      const selectInteraction = new Select({
        condition: click,
        style: new Style({
          stroke: new Stroke({ color: COLORS.SELECT_STROKE, width: 3 }),
          fill: new Fill({ color: COLORS.SELECT_FILL }),
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: COLORS.SELECT_STROKE }),
            stroke: new Stroke({ color: 'white', width: 2 }),
          })
        })
      });

      selectInteraction.on('select', (e) => {
        if (e.selected.length > 0) {
          const feature = e.selected[0];
          const properties = feature.getProperties();
          const { geometry, ...attributes } = properties;
          setSelectedFeatureInfo(attributes);
        } else {
          setSelectedFeatureInfo(null);
        }
      });

      map.addInteraction(selectInteraction);
    } else if (toolMode === 'draw') {
      const drawInteraction = new Draw({
        source: drawSourceRef.current,
        type: 'Circle',
        geometryFunction: createBox(),
      });

      drawInteraction.on('drawend', (evt: DrawEvent) => {
        const geom = evt.feature.getGeometry();
        if (!geom) return;
        const drawnExtent = geom.getExtent();

        const matched: string[] = [];
        vectorLayersRef.current.forEach((layer, layerId) => {
          if (layerId.startsWith('__admin__/')) return; // Exclude admin layers
          const source = layer.getSource();
          if (!source) return;
          const layerExtent = source.getExtent();
          // getExtent() retourne [Infinity...] quand la source est vide ou en cours de chargement
          if (layerExtent && !layerExtent.includes(Infinity) && !layerExtent.includes(-Infinity)) {
            if (extentIntersects(drawnExtent, layerExtent)) {
              matched.push(layerId);
            }
          }
        });

        // Fetch municipality attributes independently (works even if layer not displayed)
        const bboxStr = drawnExtent.join(',');
        fetch(`/api/layers/admin-bbox?file=municipalite.geojson&bbox=${bboxStr}`)
          .then(r => r.json())
          .then((fc: { features: { properties: Record<string, string> }[] }) => {
            const keywords = new Set<string>();
            for (const f of fc.features) {
              const p = f.properties;
              if (p.MUS_NM_MUN) keywords.add(p.MUS_NM_MUN);
              if (p.MUS_NM_MRC) keywords.add(p.MUS_NM_MRC);
              if (p.MUS_NM_REG) keywords.add(p.MUS_NM_REG);
            }
            onRoiChange?.(drawnExtent as [number, number, number, number], matched, [...keywords]);
          })
          .catch(() => {
            onRoiChange?.(drawnExtent as [number, number, number, number], matched, []);
          });
      });

      map.addInteraction(drawInteraction);
    } else {
      setSelectedFeatureInfo(null);
    }
  }, [toolMode]);

  // Handle Base Layer Switch
  useEffect(() => {
    if (!mapInstance.current) return;
    const basemapNames: BasemapKey[] = ['osm', 'satellite', 'hybrid', 'topo', 'positron', 'dark', 'esri'];
    mapInstance.current.getLayers().getArray().forEach(layer => {
      const name = layer.get('name');
      if (basemapNames.includes(name)) {
        layer.setVisible(name === baseLayer);
      }
    });
  }, [baseLayer]);

  // Handle GeoJSON Layers
  useEffect(() => {
    if (!mapInstance.current) return;
    const currentMap = mapInstance.current;
    const activeIds = new Set(activeLayers.map(l => l.id));

    vectorLayersRef.current.forEach((layer, id) => {
      if (!activeIds.has(id)) {
        currentMap.removeLayer(layer);
        vectorLayersRef.current.delete(id);
      }
    });

    activeLayers.forEach(layerInfo => {
      if (!vectorLayersRef.current.has(layerInfo.id)) {
        const isAdmin = isAdminLayer(layerInfo);

        let source: VectorSource;
        if (isAdmin) {
          // Admin layers: bbox loading strategy — only fetch visible features
          const adminFile = layerInfo.fileName;
          source = new VectorSource({
            format: new GeoJSON(),
            strategy: bboxStrategy,
            url: (extent) =>
              `/api/layers/admin-bbox?file=${encodeURIComponent(adminFile)}&bbox=${extent.join(',')}`,
          });
        } else {
          const sourceUrl = layerInfo.url
            ?? `/api/layers/data?path=${encodeURIComponent(layerInfo.id)}`;
          source = new VectorSource({
            url: sourceUrl,
            format: new GeoJSON(),
          });
        }

        const layerColor = layerColors[layerInfo.id] || COLORS.PRIMARY;
        const layerOpacity = layerOpacities[layerInfo.id] ?? 0.5;

        const vectorLayer = new VectorLayer({
          source: source,
          style: createLayerStyle(layerColor, layerOpacity)
        });

        currentMap.addLayer(vectorLayer);
        vectorLayersRef.current.set(layerInfo.id, vectorLayer);

        source.on('change', () => {
          const state = source.getState();
          if (state === 'ready') {
            // Skip auto-zoom for admin layers (too large, loaded progressively)
            if (!isAdmin) {
              const extent = source.getExtent();
              if (extent && !extent.includes(Infinity) && !extent.includes(-Infinity)) {
                currentMap.getView().fit(extent, {
                  padding: MAP_DEFAULTS.FIT_PADDING,
                  maxZoom: MAP_DEFAULTS.MAX_ZOOM
                });
              }
            }
            // Detect geometry type and set initial opacity
            if (layerOpacities[layerInfo.id] === undefined) {
              const firstFeature = source.getFeatures()[0];
              const geomType = firstFeature?.getGeometry()?.getType();
              const detectedOpacity =
                geomType === 'Point' || geomType === 'MultiPoint' ||
                geomType === 'LineString' || geomType === 'MultiLineString'
                  ? 1.0
                  : 0.5;
              vectorLayer.setStyle(createLayerStyle(layerColor, detectedOpacity));
              onInitialOpacity?.(layerInfo.id, detectedOpacity);
            }
          } else if (state === 'error') {
            console.error(`Erreur de chargement de la couche: ${layerInfo.fileName}`);
          }
        });
      }
    });
  }, [activeLayers, layerColors, layerOpacities]);

  // Update layer styles when colors or opacities change
  useEffect(() => {
    vectorLayersRef.current.forEach((layer, layerId) => {
      const newColor = layerColors[layerId] || COLORS.PRIMARY;
      const opacity = layerOpacities[layerId] ?? 0.5;
      layer.setStyle(createLayerStyle(newColor, opacity));
    });
  }, [layerColors, layerOpacities]);

  // Handle WMS Layers
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const activeIds = new Set(activeWmsLayers.map(l => l.id));

    wmsLayerRefsRef.current.forEach((layer, id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(layer);
        wmsLayerRefsRef.current.delete(id);
      }
    });

    activeWmsLayers.forEach(wmsLayer => {
      if (!wmsLayerRefsRef.current.has(wmsLayer.id)) {
        const layer = new TileLayer({
          source: new TileWMS({
            url: wmsLayer.url,
            params: { LAYERS: wmsLayer.layerName, TILED: true, FORMAT: 'image/png' },
            serverType: 'geoserver',
            // Proxy chaque requête de tuile via Next.js pour éviter les blocages CORS
            tileLoadFunction: (tile, src) => {
              const proxyUrl = `/api/wms-tiles?url=${encodeURIComponent(src)}`;
              const img = (tile as ImageTile).getImage() as HTMLImageElement;
              img.src = proxyUrl;
            },
          }),
        });
        map.addLayer(layer);
        wmsLayerRefsRef.current.set(wmsLayer.id, layer);
      }
    });
  }, [activeWmsLayers]);

  const clearDrawings = () => {
    drawSourceRef.current.clear();
    onRoiChange?.(null, [], []);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Tool Bar */}
      <div className="absolute top-4 left-4 bg-white p-2 rounded shadow-md z-10 flex gap-2">
        <ToolButton
          mode="navigate"
          currentMode={toolMode}
          onClick={() => setToolMode('navigate')}
          title="Naviguer"
          ariaLabel="Outil de navigation de la carte"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834-1.385-.81 2.229m4.155 2.155-2.229.81m1.385 5.834h-2.25m-2.155 4.155-.81-2.229M4.5 12H2.25m1.385-5.834.81 2.229M2.229 4.229l2.229.81" />
            </svg>
          }
        />
        <ToolButton
          mode="select"
          currentMode={toolMode}
          onClick={() => setToolMode('select')}
          title="Sélectionner entité"
          ariaLabel="Outil de sélection de features"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
            </svg>
          }
        />
        <ToolButton
          mode="draw"
          currentMode={toolMode}
          onClick={() => setToolMode('draw')}
          title="Dessiner ROI (Rectangle)"
          ariaLabel="Outil de dessin de rectangles (ROI)"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" stroke="currentColor" fill="none" />
            </svg>
          }
        />
        {toolMode === 'draw' && (
          <button
            onClick={clearDrawings}
            className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Effacer les dessins"
            aria-label="Effacer tous les dessins de ROI"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        )}

        {/* WMS Tool — séparateur + bouton d'ajout de service */}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button
          onClick={() => setWmsDialogOpen(true)}
          className="p-2 rounded transition-colors hover:bg-gray-100 text-gray-600"
          title="Ajouter un service WMS"
          aria-label="Ouvrir l'outil d'ajout de service WMS"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        </button>

        {/* Print / Export Tool */}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button
          onClick={() => setPrintDialogOpen(true)}
          className="p-2 rounded transition-colors hover:bg-gray-100 text-gray-600"
          title="Exporter / Imprimer la carte"
          aria-label="Ouvrir l'outil d'export et d'impression de la carte"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.131A2.026 2.026 0 0 0 18 7.087V3.375" />
          </svg>
        </button>
      </div>

      {/* Attribute Panel */}
      {selectedFeatureInfo && (
        <div className="absolute bottom-4 right-4 bg-white p-4 rounded shadow-lg z-20 max-w-sm max-h-60 overflow-y-auto border border-gray-200">
          <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
            <h3 className="font-bold text-gray-800">Attributs</h3>
            <button onClick={() => setSelectedFeatureInfo(null)} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          <div className="text-sm space-y-1">
            {Object.entries(selectedFeatureInfo).map(([key, value]) => (
              <div key={key} className="flex flex-col border-b border-gray-50 last:border-0 pb-1">
                <span className="font-semibold text-gray-600 text-xs uppercase">{key}</span>
                <span className="text-gray-800 break-words">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WMS Dialog */}
      <WMSDialog
        open={wmsDialogOpen}
        onClose={() => setWmsDialogOpen(false)}
        onAdd={(layers) => { onAddWmsLayers(layers); setWmsDialogOpen(false); }}
      />

      {/* Print Dialog */}
      <PrintDialog
        open={printDialogOpen}
        onClose={() => setPrintDialogOpen(false)}
        map={mapInstance.current}
        activeLayers={activeLayers}
        layerColors={layerColors}
        activeWmsLayers={activeWmsLayers}
      />

      {/* Base Layer Switcher */}
      <div className="absolute top-4 right-4 bg-white p-2 rounded shadow-md z-10">
        <select
          value={baseLayer}
          onChange={e => setBaseLayer(e.target.value as BasemapKey)}
          className="text-sm font-medium border rounded px-2 py-1"
          aria-label="Sélection du fond de carte"
        >
          <option value="osm">OpenStreetMap</option>
          <option value="satellite">Satellite</option>
          <option value="hybrid">Satellite hybride</option>
          <option value="topo">Topographique</option>
          <option value="positron">Clair (Positron)</option>
          <option value="dark">Sombre</option>
          <option value="esri">Esri Imagerie</option>
        </select>
      </div>
    </div>
  );
};

export default MapComponent;
