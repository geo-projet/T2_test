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

interface MapSidebarProps {
  layers: LayerGroup[];
  activeLayerIds: string[];
  layerColors: Record<string, string>;
  onToggleLayer: (groupName: string, fileName: string) => void;
  onToggleGroup: (groupName: string) => void;
  onColorChange: (layerId: string, color: string) => void;
  activeWmsLayers?: ActiveWmsLayer[];
  onRemoveWmsLayer?: (id: string) => void;
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

const MapSidebar: React.FC<MapSidebarProps> = ({ layers, activeLayerIds, layerColors, onToggleLayer, onToggleGroup, onColorChange, activeWmsLayers, onRemoveWmsLayer }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 ? (
          <div className="text-center p-4 text-gray-400 text-sm">
            Aucune couche trouvée.
          </div>
        ) : (
          <div className="space-y-2">
            {layers.map((group) => {
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
                      className="flex-1 flex items-center justify-between text-left"
                    >
                      <span className="font-semibold text-gray-700 text-sm">{group.groupName}</span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
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

                        return (
                          <div
                            key={id}
                            className={`flex items-center gap-2 p-2 rounded transition-colors text-sm ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          >
                            <label className="flex items-center gap-3 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                checked={checked}
                                onChange={() => onToggleLayer(group.groupName, file)}
                              />
                              <span className={`truncate ${checked ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                                {file.replace('.geojson', '').replace('.json', '')}
                              </span>
                            </label>
                            {checked && (
                              <input
                                type="color"
                                value={currentColor}
                                onChange={(e) => onColorChange(id, e.target.value)}
                                className="w-7 h-7 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                                title="Choisir une couleur"
                                aria-label={`Couleur de ${file}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
    </div>
  );
};

export default MapSidebar;
