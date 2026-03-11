"use client";

import React, { useState, useRef, useEffect } from 'react';

interface LayerGroup {
  groupName: string;
  files: string[];
}

interface ActiveWmsLayer {
  id: string;
  url: string;
  layerName: string;
  title: string;
}

interface AdminGroup {
  groupName: string;
  layers: { id: string; fileName: string; url: string }[];
}

interface MapSidebarProps {
  layers: LayerGroup[];
  activeLayerIds: string[];
  layerColors: Record<string, string>;
  layerOpacities: Record<string, number>;
  onToggleLayer: (groupName: string, fileName: string) => void;
  onToggleGroup: (groupName: string) => void;
  onColorChange: (layerId: string, color: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
  activeWmsLayers?: ActiveWmsLayer[];
  onRemoveWmsLayer?: (id: string) => void;
  onExport?: () => void;
  isExporting?: boolean;
  adminGroup?: AdminGroup;
  onToggleAdminLayer?: (layerId: string, fileName: string, url: string) => void;
}

interface GroupCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  groupName: string;
}

const GroupCheckbox: React.FC<GroupCheckboxProps> = ({ checked, indeterminate, onChange, groupName }) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Sélectionner toutes les couches de ${groupName}`}
    />
  );
};

const normalize = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const MapSidebar: React.FC<MapSidebarProps> = ({ layers, activeLayerIds, layerColors, layerOpacities, onToggleLayer, onToggleGroup, onColorChange, onOpacityChange, activeWmsLayers, onRemoveWmsLayer, onExport, isExporting, adminGroup, onToggleAdminLayer }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setColorPickerOpen(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [colorPickerOpen]);

  const toggleGroupExpand = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const isActive = (groupName: string, fileName: string) => {
    return activeLayerIds.includes(`${groupName}/${fileName}`);
  };

  const getGroupCheckState = (group: LayerGroup) => {
    const groupLayerIds = group.files.map(file => `${group.groupName}/${file}`);
    const activeCount = groupLayerIds.filter(id => activeLayerIds.includes(id)).length;

    if (activeCount === 0) return { checked: false, indeterminate: false };
    if (activeCount === groupLayerIds.length) return { checked: true, indeterminate: false };
    return { checked: false, indeterminate: true };
  };

  return (
    <div className="w-72 h-full bg-white flex flex-col z-20 overflow-hidden border-r border-gray-200 flex-shrink-0">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-base font-bold text-gray-800">Couches</h2>
        <p className="text-xs text-gray-500 mt-0.5">Explorateur GeoJSON</p>
      </div>

      {/* Champ de recherche */}
      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher une couche…"
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Effacer la recherche"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 ? (
          <div className="text-center p-4 text-gray-400 text-sm">
            Aucune couche trouvée.
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const needle = normalize(searchTerm.trim());
              const filteredLayers = !needle
                ? layers
                : layers
                    .map((group) => {
                      if (normalize(group.groupName).includes(needle)) return group;
                      const matchedFiles = group.files.filter((f) =>
                        normalize(f.replace('.geojson', '').replace('.json', '')).includes(needle)
                      );
                      if (matchedFiles.length === 0) return null;
                      return { ...group, files: matchedFiles };
                    })
                    .filter((g): g is LayerGroup => g !== null);

              if (filteredLayers.length === 0) {
                return (
                  <div className="text-center p-4 text-gray-400 text-sm">
                    Aucune couche trouvée pour « {searchTerm.trim()} ».
                  </div>
                );
              }

              return filteredLayers.map((group) => {
              const checkState = getGroupCheckState(group);

              return (
                <div key={group.groupName} className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <GroupCheckbox
                      checked={checkState.checked}
                      indeterminate={checkState.indeterminate}
                      onChange={() => onToggleGroup(group.groupName)}
                      groupName={group.groupName}
                    />
                    <button
                      onClick={() => toggleGroupExpand(group.groupName)}
                      className="flex-1 flex items-center justify-between text-left min-w-0"
                    >
                      <span className="font-semibold text-gray-700 text-sm truncate">{group.groupName}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex-shrink-0">
                        {group.files.length}
                      </span>
                    </button>
                  </div>

                  {expandedGroups.has(group.groupName) && (
                    <div className="bg-white p-2 space-y-1 border-t border-gray-200">
                      {group.files.map((file) => {
                        const id = `${group.groupName}/${file}`;
                        const checked = isActive(group.groupName, file);
                        const currentColor = layerColors[id] || '#3b82f6';

                        const currentOpacity = layerOpacities[id] ?? 0.5;
                        const opacityPct = Math.round(currentOpacity * 100);

                        return (
                          <div
                            key={id}
                            className={`flex items-center gap-2 p-2 rounded transition-colors text-sm ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          >
                            <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                                checked={checked}
                                onChange={() => onToggleLayer(group.groupName, file)}
                              />
                              <span className={`truncate ${checked ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                                {file.replace('.geojson', '').replace('.json', '')}
                              </span>
                            </label>
                            {checked && (
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => setColorPickerOpen(colorPickerOpen === id ? null : id)}
                                  className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                                  style={{
                                    backgroundColor: `${currentColor}${Math.round(currentOpacity * 255).toString(16).padStart(2, '0')}`,
                                  }}
                                  title={`Couleur & opacité (${opacityPct}%)`}
                                  aria-label={`Couleur et opacité de ${file}`}
                                />
                                {colorPickerOpen === id && (
                                  <div
                                    ref={popoverRef}
                                    className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-48"
                                  >
                                    <input
                                      type="color"
                                      value={currentColor}
                                      onChange={(e) => onColorChange(id, e.target.value)}
                                      className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                                      title="Choisir une couleur"
                                      aria-label={`Couleur de ${file}`}
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs text-gray-500 whitespace-nowrap">Opacité</span>
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={opacityPct}
                                        onChange={(e) => onOpacityChange(id, Number(e.target.value) / 100)}
                                        className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
                                        aria-label={`Opacité de ${file}`}
                                      />
                                      <span className="text-xs text-gray-600 font-medium w-8 text-right">{opacityPct}%</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
            })()}
          </div>
        )}
        {/* Section Administrative */}
        {adminGroup && adminGroup.layers.length > 0 && (
          <div className="border-t border-gray-200 mt-3 pt-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">{adminGroup.groupName}</p>
            <div className="space-y-1">
              {adminGroup.layers.map((layer) => {
                const checked = activeLayerIds.includes(layer.id);
                const currentColor = layerColors[layer.id] || '#6b7280';
                const currentOpacity = layerOpacities[layer.id] ?? 0.5;
                const opacityPct = Math.round(currentOpacity * 100);
                const displayName = layer.fileName.replace('.geojson', '').replace('.json', '');

                return (
                  <div
                    key={layer.id}
                    className={`flex items-center gap-2 p-2 rounded transition-colors text-sm ${checked ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                        checked={checked}
                        onChange={() => onToggleAdminLayer?.(layer.id, layer.fileName, layer.url)}
                      />
                      <span className={`truncate ${checked ? 'text-gray-700 font-medium' : 'text-gray-600'}`}>
                        {displayName}
                      </span>
                    </label>
                    {checked && (
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setColorPickerOpen(colorPickerOpen === layer.id ? null : layer.id)}
                          className="w-6 h-6 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                          style={{
                            backgroundColor: `${currentColor}${Math.round(currentOpacity * 255).toString(16).padStart(2, '0')}`,
                          }}
                          title={`Couleur & opacité (${opacityPct}%)`}
                          aria-label={`Couleur et opacité de ${displayName}`}
                        />
                        {colorPickerOpen === layer.id && (
                          <div
                            ref={popoverRef}
                            className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-48"
                          >
                            <input
                              type="color"
                              value={currentColor}
                              onChange={(e) => onColorChange(layer.id, e.target.value)}
                              className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                              title="Choisir une couleur"
                              aria-label={`Couleur de ${displayName}`}
                            />
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-gray-500 whitespace-nowrap">Opacité</span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={opacityPct}
                                onChange={(e) => onOpacityChange(layer.id, Number(e.target.value) / 100)}
                                className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
                                aria-label={`Opacité de ${displayName}`}
                              />
                              <span className="text-xs text-gray-600 font-medium w-8 text-right">{opacityPct}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section Services WMS */}
        {activeWmsLayers && activeWmsLayers.length > 0 && (
          <div className="border-t border-gray-200 mt-3 pt-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">Services WMS</p>
            <div className="space-y-1">
              {activeWmsLayers.map(layer => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between p-2 rounded bg-blue-50 border border-blue-100"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-blue-700 truncate">{layer.title}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{layer.layerName}</p>
                  </div>
                  <button
                    onClick={() => onRemoveWmsLayer?.(layer.id)}
                    className="ml-2 flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                    title="Retirer cette couche WMS"
                    aria-label={`Retirer ${layer.title}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bouton export — fixe en bas de la sidebar */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <button
          onClick={onExport}
          disabled={activeLayerIds.length === 0 || isExporting}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
          title={activeLayerIds.length === 0 ? 'Sélectionnez au moins une couche' : 'Exporter les couches sélectionnées en GeoPackage (.gpkg)'}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Exportation…
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Exporter {activeLayerIds.length > 0 ? `(${activeLayerIds.length})` : ''} → .gpkg
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default MapSidebar;
