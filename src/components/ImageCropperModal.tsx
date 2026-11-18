import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Check, Move } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  fileUrl: string;
  aspectRatio: '1:1' | '16:5';
  title: string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  fileUrl,
  aspectRatio,
  title,
  onCancel,
  onSave,
}) => {
  const [zoom, setZoom] = useState(1.2);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !fileUrl) return;
    setZoom(1.1);
    setOffset({ x: 0, y: 0 });
    setError(null);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      setError('Could not decode this image file. Try a PNG or JPG image.');
    };
    img.src = fileUrl;
  }, [isOpen, fileUrl]);

  if (!isOpen) return null;

  const isAvatar = aspectRatio === '1:1';
  const boxWidth = isAvatar ? 260 : 340;
  const boxHeight = isAvatar ? 260 : Math.round(340 * (5 / 16));

  const getBaseScale = () => {
    if (!imgSize) return 1;
    return Math.max(boxWidth / imgSize.w, boxHeight / imgSize.h);
  };

  const clampOffset = (x: number, y: number, nextZoom = zoom) => {
    if (!imgSize) return { x, y };
    const scale = getBaseScale() * nextZoom;
    const drawW = imgSize.w * scale;
    const drawH = imgSize.h * scale;
    const maxX = Math.max(0, (drawW - boxWidth) / 2);
    const maxY = Math.max(0, (drawH - boxHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, origX: offset.x, origY: offset.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset(clampOffset(dragStartRef.current.origX + dx, dragStartRef.current.origY + dy));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleZoomChange = (val: number) => {
    const next = Math.min(3, Math.max(1, val));
    setZoom(next);
    setOffset(prev => clampOffset(prev.x, prev.y, next));
  };

  const handleExportCrop = () => {
    const img = imgRef.current;
    if (!img || !imgSize) return;

    const outW = isAvatar ? 512 : 1280;
    const outH = isAvatar ? 512 : 400;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Browser canvas is unavailable.');
      return;
    }

    const previewScale = getBaseScale() * zoom;
    const drawW = imgSize.w * previewScale;
    const drawH = imgSize.h * previewScale;

    const srcLeft = (boxWidth - drawW) / 2 + offset.x;
    const srcTop = (boxHeight - drawH) / 2 + offset.y;

    const sx = Math.max(0, -srcLeft / previewScale);
    const sy = Math.max(0, -srcTop / previewScale);
    const sw = Math.min(imgSize.w - sx, boxWidth / previewScale);
    const sh = Math.min(imgSize.h - sy, boxHeight / previewScale);

    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    // Strip EXIF automatically by encoding fresh canvas pixels to JPEG/WEBP
    let output = canvas.toDataURL('image/webp', 0.85);
    if (!output.startsWith('data:image/webp')) {
      output = canvas.toDataURL('image/jpeg', 0.85);
    }
    if (output.length > 3_800_000) {
      output = canvas.toDataURL('image/jpeg', 0.72);
    }
    onSave(output);
  };

  const displayScale = getBaseScale() * zoom;
  const imgStyleWidth = imgSize ? imgSize.w * displayScale : boxWidth;
  const imgStyleHeight = imgSize ? imgSize.h * displayScale : boxHeight;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-backdrop">
      <div className="bg-white dark:bg-[#15161C] rounded-2xl max-w-md w-full border border-[#E4E4E7] dark:border-[#27272A] shadow-2xl overflow-hidden animate-modal-enter">
        <div className="px-5 py-4 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-[#111111] dark:text-white">{title}</h3>
            <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA]">
              Drag to reposition and adjust zoom. EXIF metadata is removed automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[#71717A] hover:text-[#111111] dark:hover:text-white hover:bg-[#F4F4F5] dark:hover:bg-[#1E2028]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          {error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs text-center w-full">
              {error}
            </div>
          ) : (
            <>
              <div
                ref={previewBoxRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ width: boxWidth, height: boxHeight }}
                className={`relative overflow-hidden bg-[#111111] border-2 border-[#FF6B00] select-none touch-none cursor-grab active:cursor-grabbing ${
                  isAvatar ? 'rounded-full' : 'rounded-xl'
                }`}
              >
                {imgSize && (
                  <img
                    src={fileUrl}
                    alt="Crop preview"
                    draggable={false}
                    style={{
                      width: imgStyleWidth,
                      height: imgStyleHeight,
                      transform: `translate(${(boxWidth - imgStyleWidth) / 2 + offset.x}px, ${(boxHeight - imgStyleHeight) / 2 + offset.y}px)`,
                      maxWidth: 'none',
                    }}
                    className="pointer-events-none select-none"
                  />
                )}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/65 text-white text-[10px] font-semibold flex items-center gap-1 pointer-events-none">
                  <Move className="w-3 h-3" />
                  <span>Drag</span>
                </div>
              </div>

              <div className="w-full flex items-center gap-3 px-2">
                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom - 0.15)}
                  className="p-1.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF6B00]"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={e => handleZoomChange(parseFloat(e.target.value))}
                  className="flex-1 accent-[#FF6B00]"
                />
                <button
                  type="button"
                  onClick={() => handleZoomChange(zoom + 0.15)}
                  className="p-1.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF6B00]"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-end gap-2 bg-[#FAFAFA] dark:bg-[#0D0E12]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={Boolean(error) || !imgSize}
            onClick={handleExportCrop}
            className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E55E00] disabled:opacity-50 text-[#111111] font-black text-xs border-2 border-[#111111] flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Crop</span>
          </button>
        </div>
      </div>
    </div>
  );
};
