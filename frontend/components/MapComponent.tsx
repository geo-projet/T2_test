"use client";

import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { defaults as defaultControls } from 'ol/control';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { Select, Draw } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import { click } from 'ol/events/condition';
import ToolButton from './ToolButton';

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
}

interface MapComponentProps {
  activeLayers: ActiveLayer[];
  layerColors: Record<string, string>;
}

type ToolMode = 'navigate' | 'select' | 'draw';

// Helper function to create layer style from color
const createLayerStyle = (color: string) => {
  const fillColor = `${color}1A`; // Add alpha channel for transparency (10% opacity)

  return new Style({
    stroke: new Stroke({
      color: color,
      width: 2,
    }),
    fill: new Fill({
      color: fillColor,
    }),
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: color }),
      stroke: new Stroke({ color: 'white', width: 1 }),
    })
  });
};

const MapComponent: React.FC<MapComponentProps> = ({ activeLayers, layerColors }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<OlMap | null>(null);
  const vectorLayersRef = useRef<Map<string, VectorLayer<VectorSource>>>(new Map());
  const drawSourceRef = useRef<VectorSource>(new VectorSource());

  // State
  const [baseLayer, setBaseLayer] = useState<'osm' | 'satellite'>('osm');
  const [toolMode, setToolMode] = useState<ToolMode>('navigate');
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<Record<string, unknown> | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
      properties: { name: 'osm' },
      visible: true,
    });

    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        maxZoom: 20,
      }),
      properties: { name: 'satellite' },
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
      layers: [osmLayer, satelliteLayer, drawLayer],
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
      map.addInteraction(drawInteraction);
    } else {
      setSelectedFeatureInfo(null);
    }
  }, [toolMode]);

  // Handle Base Layer Switch
  useEffect(() => {
    if (!mapInstance.current) return;
    const layers = mapInstance.current.getLayers().getArray();
    layers.forEach(layer => {
      if (layer.get('name') === 'osm') {
        layer.setVisible(baseLayer === 'osm');
      } else if (layer.get('name') === 'satellite') {
        layer.setVisible(baseLayer === 'satellite');
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
        const source = new VectorSource({
          url: `/api/layers/data?path=${encodeURIComponent(layerInfo.id)}`,
          format: new GeoJSON(),
        });

        const layerColor = layerColors[layerInfo.id] || COLORS.PRIMARY;

        const vectorLayer = new VectorLayer({
          source: source,
          style: createLayerStyle(layerColor)
        });

        currentMap.addLayer(vectorLayer);
        vectorLayersRef.current.set(layerInfo.id, vectorLayer);

        source.on('change', () => {
          const state = source.getState();
          if (state === 'ready') {
            const extent = source.getExtent();
            if (!extent.includes(Infinity) && !extent.includes(-Infinity)) {
              currentMap.getView().fit(extent, {
                padding: MAP_DEFAULTS.FIT_PADDING,
                maxZoom: MAP_DEFAULTS.MAX_ZOOM
              });
            }
          } else if (state === 'error') {
            console.error(`Erreur de chargement de la couche: ${layerInfo.fileName}`);
          }
        });
      }
    });
  }, [activeLayers, layerColors]);

  // Update layer styles when colors change
  useEffect(() => {
    vectorLayersRef.current.forEach((layer, layerId) => {
      const newColor = layerColors[layerId] || COLORS.PRIMARY;
      layer.setStyle(createLayerStyle(newColor));
    });
  }, [layerColors]);

  const clearDrawings = () => {
    drawSourceRef.current.clear();
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

      {/* Base Layer Switcher */}
      <div className="absolute top-4 right-4 bg-white p-2 rounded shadow-md z-10 flex flex-col gap-2" role="radiogroup" aria-label="Sélection de la carte de base">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="basemap"
            value="osm"
            checked={baseLayer === 'osm'}
            onChange={() => setBaseLayer('osm')}
            aria-label="Carte OpenStreetMap"
          />
          <span className="text-sm font-medium">OSM</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="basemap"
            value="satellite"
            checked={baseLayer === 'satellite'}
            onChange={() => setBaseLayer('satellite')}
            aria-label="Carte satellite"
          />
          <span className="text-sm font-medium">Satellite</span>
        </label>
      </div>
    </div>
  );
};

export default MapComponent;
