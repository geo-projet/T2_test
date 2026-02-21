"use client";

import React, { useState } from 'react';
import WMSCapabilities from 'ol/format/WMSCapabilities';

interface ActiveWmsLayer {
  id: string;
  url: string;
  layerName: string;
  title: string;
}

interface WmsLayerOption {
  name: string;
  title: string;
}

interface WMSDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (layers: ActiveWmsLayer[]) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractLayers = (layer: any, result: WmsLayerOption[]) => {
  if (layer?.Name) {
    result.push({ name: layer.Name, title: layer.Title || layer.Name });
  }
  if (layer?.Layer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.Layer.forEach((sub: any) => extractLayers(sub, result));
  }
};

const WMSDialog: React.FC<WMSDialogProps> = ({ open, onClose, onAdd }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableLayers, setAvailableLayers] = useState<WmsLayerOption[]>([]);
  const [selectedLayerNames, setSelectedLayerNames] = useState<Set<string>>(new Set());

  if (!open) return null;

  const loadCapabilities = async () => {
    if (!url.trim()) {
      setError("Veuillez saisir une URL de service WMS.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAvailableLayers([]);
    setSelectedLayerNames(new Set());

    try {
      const proxyUrl = `/api/wms-proxy?url=${encodeURIComponent(url.trim())}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Erreur serveur : ${response.status}`);
      }
      const xml = await response.text();

      const parser = new WMSCapabilities();
      const result = parser.read(xml);

      const layers: WmsLayerOption[] = [];
      extractLayers(result?.Capability?.Layer, layers);

      if (layers.length === 0) {
        setError("Aucune couche trouvée dans ce service WMS.");
      } else {
        setAvailableLayers(layers);
      }
    } catch {
      setError("Impossible de charger les capacités WMS. Vérifiez l'URL et la disponibilité du service.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLayer = (name: string) => {
    setSelectedLayerNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleAdd = () => {
    const layers: ActiveWmsLayer[] = availableLayers
      .filter(l => selectedLayerNames.has(l.name))
      .map(l => ({
        id: `${url.trim()}::${l.name}`,
        url: url.trim(),
        layerName: l.name,
        title: l.title,
      }));
    onAdd(layers);
  };

  const handleClose = () => {
    setUrl('');
    setError(null);
    setAvailableLayers([]);
    setSelectedLayerNames(new Set());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <h2 className="text-base font-semibold text-gray-800">Ajouter un service WMS</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fermer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* URL Input */}
        <div className="px-5 py-4 border-b border-gray-100">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            URL du service WMS
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadCapabilities()}
              placeholder="https://exemple.com/wms"
              className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <button
              onClick={loadCapabilities}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Chargement…
                </>
              ) : (
                'Charger les couches'
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              {error}
            </p>
          )}
        </div>

        {/* Layer List */}
        {availableLayers.length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Couches disponibles ({availableLayers.length})
              </p>
              <div className="flex gap-3 text-xs text-blue-600">
                <button onClick={() => setSelectedLayerNames(new Set(availableLayers.map(l => l.name)))} className="hover:underline">
                  Tout sélectionner
                </button>
                <button onClick={() => setSelectedLayerNames(new Set())} className="hover:underline">
                  Désélectionner
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
              {availableLayers.map(layer => (
                <label
                  key={layer.name}
                  className={`flex items-start gap-3 p-2.5 rounded cursor-pointer transition-colors ${
                    selectedLayerNames.has(layer.name) ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLayerNames.has(layer.name)}
                    onChange={() => toggleLayer(layer.name)}
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedLayerNames.has(layer.name) ? 'text-blue-700' : 'text-gray-700'}`}>
                      {layer.title}
                    </p>
                    <p className="text-xs text-gray-400 font-mono truncate">{layer.name}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedLayerNames.size === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Ajouter à la carte{selectedLayerNames.size > 0 ? ` (${selectedLayerNames.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WMSDialog;
