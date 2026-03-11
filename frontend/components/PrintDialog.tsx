"use client";

import React, { useState } from 'react';
import type OlMap from 'ol/Map';
import { jsPDF } from 'jspdf';

interface ActiveLayer {
  id: string;
  groupName: string;
  fileName: string;
}

interface ActiveWmsLayer {
  id: string;
  url: string;
  layerName: string;
  title: string;
}

interface PrintDialogProps {
  open: boolean;
  onClose: () => void;
  map: OlMap | null;
  activeLayers: ActiveLayer[];
  layerColors: Record<string, string>;
  activeWmsLayers: ActiveWmsLayer[];
}

type PaperSize = 'a4' | 'letter' | 'a3';
type Orientation = 'landscape' | 'portrait';
type ExportFormat = 'png' | 'pdf';
type DpiOption = 72 | 150 | 300;

const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string }> = {
  a4: { width: 210, height: 297, label: 'A4' },
  letter: { width: 216, height: 279, label: 'Letter' },
  a3: { width: 297, height: 420, label: 'A3' },
};

const getNiceRoundNumber = (value: number): number => {
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  return candidates.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
};

const PrintDialog: React.FC<PrintDialogProps> = ({ open, onClose, map, activeLayers, layerColors, activeWmsLayers }) => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [title, setTitle] = useState('');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [dpi, setDpi] = useState<DpiOption>(150);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeScaleBar, setIncludeScaleBar] = useState(true);
  const [includeNorthArrow, setIncludeNorthArrow] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!open) return null;

  const captureMap = (targetDpi: number): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      if (!map) return reject(new Error('Carte non disponible'));

      const scaleFactor = targetDpi / 72;
      const size = map.getSize();
      if (!size) return reject(new Error('Taille indéterminée'));

      const viewportEl = map.getViewport();
      const mapTarget = map.getTargetElement() as HTMLElement;
      const origWidth = mapTarget.style.width;
      const origHeight = mapTarget.style.height;

      const exportWidth = Math.round(size[0] * scaleFactor);
      const exportHeight = Math.round(size[1] * scaleFactor);

      mapTarget.style.width = exportWidth + 'px';
      mapTarget.style.height = exportHeight + 'px';
      map.updateSize();

      map.once('rendercomplete', () => {
        const mapCanvas = document.createElement('canvas');
        mapCanvas.width = exportWidth;
        mapCanvas.height = exportHeight;
        const ctx = mapCanvas.getContext('2d')!;

        const canvases = viewportEl.querySelectorAll('canvas');
        canvases.forEach((canvas) => {
          if (canvas.width > 0) {
            const opacity = (canvas.parentElement as HTMLElement)?.style?.opacity;
            ctx.globalAlpha = opacity === '' || opacity === undefined ? 1 : Number(opacity);
            const transform = canvas.style.transform;
            const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
            if (match) {
              ctx.drawImage(canvas, parseFloat(match[1]), parseFloat(match[2]));
            } else {
              ctx.drawImage(canvas, 0, 0);
            }
          }
        });
        ctx.globalAlpha = 1;

        mapTarget.style.width = origWidth;
        mapTarget.style.height = origHeight;
        map.updateSize();

        resolve(mapCanvas);
      });

      map.renderSync();
    });
  };

  const drawScaleBar = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scaleFactor: number) => {
    if (!map) return;
    const view = map.getView();
    const resolution = view.getResolution();
    if (!resolution) return;

    const center = view.getCenter();
    const lat = center ? center[1] : 0;
    const metersPerDegree = 111320 * Math.cos((lat * Math.PI) / 180);
    const metersPerPixel = resolution * metersPerDegree / scaleFactor;

    const targetWidthPx = 150 * scaleFactor;
    const targetMeters = metersPerPixel * targetWidthPx;
    const niceDistance = getNiceRoundNumber(targetMeters);
    const barWidthPx = niceDistance / metersPerPixel;

    const x = 20 * scaleFactor;
    const y = canvas.height - 20 * scaleFactor;
    const h = 8 * scaleFactor;
    const fontSize = 11 * scaleFactor;

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(x - 4 * scaleFactor, y - h - fontSize - 4 * scaleFactor, barWidthPx + 8 * scaleFactor, h + fontSize + 8 * scaleFactor);

    ctx.fillStyle = '#333';
    ctx.font = `${fontSize}px sans-serif`;
    const label = niceDistance >= 1000 ? `${niceDistance / 1000} km` : `${niceDistance} m`;
    ctx.fillText(label, x, y - h - 2 * scaleFactor);

    ctx.fillStyle = '#333';
    ctx.fillRect(x, y - h, barWidthPx, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y - h, barWidthPx / 2, h / 2);
    ctx.fillRect(x + barWidthPx / 2, y - h / 2, barWidthPx / 2, h / 2);
  };

  const drawNorthArrow = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scaleFactor: number) => {
    const x = canvas.width - 35 * scaleFactor;
    const y = 35 * scaleFactor;
    const size = 20 * scaleFactor;

    ctx.beginPath();
    ctx.arc(x, y, size + 4 * scaleFactor, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = scaleFactor;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.4, y + size * 0.5);
    ctx.lineTo(x, y + size * 0.15);
    ctx.fillStyle = '#333';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.4, y + size * 0.5);
    ctx.lineTo(x, y + size * 0.15);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = scaleFactor;
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = `bold ${12 * scaleFactor}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', x, y - size - 6 * scaleFactor);
    ctx.textAlign = 'start';
  };

  const handleExport = async () => {
    if (!map) return;
    setIsExporting(true);

    try {
      const scaleFactor = dpi / 72;
      const canvas = await captureMap(dpi);
      const ctx = canvas.getContext('2d')!;

      if (includeScaleBar) drawScaleBar(ctx, canvas, scaleFactor);
      if (includeNorthArrow) drawNorthArrow(ctx, canvas, scaleFactor);

      if (format === 'png') {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `carte${title ? '_' + title.replace(/\s+/g, '_') : ''}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
      } else {
        const paper = PAPER_SIZES[paperSize];
        const pWidth = orientation === 'landscape' ? paper.height : paper.width;
        const pHeight = orientation === 'landscape' ? paper.width : paper.height;

        const doc = new jsPDF({
          orientation,
          unit: 'mm',
          format: [pWidth, pHeight],
        });

        const margin = 10;
        const titleBarH = 15;
        const footerH = includeLegend ? 20 : 10;
        const contentW = pWidth - 2 * margin;

        // Title bar
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, margin, contentW, titleBarH, 'F');
        doc.setFontSize(12);
        doc.setTextColor(51, 51, 51);
        doc.text(title || 'Sans titre', margin + 4, margin + 10);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        const dateStr = new Date().toLocaleDateString('fr-CA');
        doc.text(dateStr, margin + contentW - 4, margin + 10, { align: 'right' });

        // Map image
        const mapY = margin + titleBarH;
        const mapH = pHeight - 2 * margin - titleBarH - footerH;
        const imgData = canvas.toDataURL('image/png');

        // Preserve aspect ratio
        const canvasRatio = canvas.width / canvas.height;
        const slotRatio = contentW / mapH;
        let imgW = contentW;
        let imgH = mapH;
        let imgX = margin;
        let imgY = mapY;

        if (canvasRatio > slotRatio) {
          imgH = contentW / canvasRatio;
          imgY = mapY + (mapH - imgH) / 2;
        } else {
          imgW = mapH * canvasRatio;
          imgX = margin + (contentW - imgW) / 2;
        }

        doc.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH);

        // Border around map area
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(margin, mapY, contentW, mapH);

        // Footer
        const footerY = pHeight - margin - footerH;
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, footerY, contentW, footerH, 'F');

        if (includeLegend) {
          const legendItems: { color: string; label: string }[] = [];
          activeLayers.forEach(l => {
            legendItems.push({
              color: layerColors[l.id] || '#3b82f6',
              label: l.fileName.replace(/\.geojson$/i, ''),
            });
          });
          activeWmsLayers.forEach(l => {
            legendItems.push({
              color: '#2563eb',
              label: `WMS: ${l.title}`,
            });
          });

          if (legendItems.length > 0) {
            const colWidth = 60;
            let lx = margin + 4;
            let ly = footerY + 5;
            const maxCols = Math.floor(contentW / colWidth);
            let col = 0;

            doc.setFontSize(7);
            legendItems.forEach((item) => {
              const hex = item.color.replace('#', '');
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              doc.setFillColor(r, g, b);
              doc.rect(lx, ly, 3, 3, 'F');
              doc.setTextColor(51, 51, 51);
              const truncLabel = item.label.length > 30 ? item.label.substring(0, 28) + '...' : item.label;
              doc.text(truncLabel, lx + 5, ly + 2.5);

              col++;
              if (col >= maxCols) {
                col = 0;
                lx = margin + 4;
                ly += 5;
              } else {
                lx += colWidth;
              }
            });
          }
        }

        // Projection info bottom-right
        doc.setFontSize(6);
        doc.setTextColor(160, 160, 160);
        doc.text('Projection: EPSG:4326', margin + contentW - 4, pHeight - margin - 2, { align: 'right' });

        doc.save(`carte${title ? '_' + title.replace(/\s+/g, '_') : ''}.pdf`);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setFormat('png');
    setDpi(150);
    setPaperSize('a4');
    setOrientation('landscape');
    setIncludeLegend(true);
    setIncludeScaleBar(true);
    setIncludeNorthArrow(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.131A2.026 2.026 0 0 0 18 7.087V3.375" />
            </svg>
            <h2 className="text-base font-semibold text-gray-800">Exporter la carte</h2>
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

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Titre</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Sans titre"
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Format</label>
            <div className="flex gap-2">
              {(['png', 'pdf'] as ExportFormat[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 text-sm font-medium rounded border transition-colors ${
                    format === f
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* DPI */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Résolution (DPI)
            </label>
            <select
              value={dpi}
              onChange={e => setDpi(Number(e.target.value) as DpiOption)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            >
              <option value={72}>72 DPI (écran)</option>
              <option value={150}>150 DPI (standard)</option>
              <option value={300}>300 DPI (haute qualité)</option>
            </select>
          </div>

          {/* Paper size (PDF only) */}
          {format === 'pdf' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Taille du papier
              </label>
              <select
                value={paperSize}
                onChange={e => setPaperSize(e.target.value as PaperSize)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                {Object.entries(PAPER_SIZES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Orientation (PDF only) */}
          {format === 'pdf' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Orientation
              </label>
              <div className="flex gap-2">
                {([
                  ['landscape', 'Paysage'],
                  ['portrait', 'Portrait'],
                ] as [Orientation, string][]).map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setOrientation(val)}
                    className={`flex-1 py-2 text-sm font-medium rounded border transition-colors ${
                      orientation === val
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Options</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLegend}
                  onChange={e => setIncludeLegend(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Inclure la légende</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeScaleBar}
                  onChange={e => setIncludeScaleBar(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Inclure la barre d'échelle</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNorthArrow}
                  onChange={e => setIncludeNorthArrow(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700">Inclure la flèche nord</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isExporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Export en cours...
              </>
            ) : (
              'Exporter'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintDialog;
