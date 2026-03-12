"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

type DrawingCanvasProps = {
  isVisible: boolean;
  onSave: (payload: { dataUrl: string; textureCanvas: HTMLCanvasElement }) => void;
  onDismiss: () => void;
  canvasSize?: { width: number; height: number };
};

const CANVAS_WIDTH = 595;
const CANVAS_HEIGHT = 844;
const MIN_BRUSH = 1;
const MAX_BRUSH = 30;

export function DrawingCanvas({ isVisible, onSave, onDismiss, canvasSize }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [brushColor, setBrushColor] = useState("#111111");
  const [brushSize, setBrushSize] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const hasDrawnRef = useRef(false);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedCanvasSize = {
    width: Math.max(1, Math.round(canvasSize?.width ?? CANVAS_WIDTH)),
    height: Math.max(1, Math.round(canvasSize?.height ?? CANVAS_HEIGHT)),
  };

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    hasDrawnRef.current = false;
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVisible, onDismiss]);

  if (!isVisible) return null;

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

  const getRelativePoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return null;
    const normalizedX = clamp01((clientX - rect.left) / rect.width);
    const normalizedY = clamp01((clientY - rect.top) / rect.height);

    // Canvas is visually rotated 90deg clockwise via CSS. Convert pointer back
    // into the unrotated canvas pixel space so drawn strokes map 1:1 to texture.
    return {
      x: normalizedY * canvas.width,
      y: (1 - normalizedX) * canvas.height,
    };
  };

  const beginStroke = (clientX: number, clientY: number) => {
    const point = getRelativePoint(clientX, clientY);
    if (!point) return;
    isDrawingRef.current = true;
    lastPointRef.current = point;
  };

  const drawStroke = (clientX: number, clientY: number) => {
    if (!isDrawingRef.current || !canvasRef.current || !lastPointRef.current) return;
    const point = getRelativePoint(clientX, clientY);
    if (!point) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = isEraser ? "#ffffff" : brushColor;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.restore();
    if (!isEraser) {
      hasDrawnRef.current = true;
    }

    lastPointRef.current = point;
  };

  const endStroke = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasDrawnRef.current = false;
  };

  const saveDrawing = () => {
    if (!canvasRef.current) return;
    if (!hasDrawnRef.current) {
      console.warn("Canvas is empty - nothing drawn yet");
      return;
    }

    const sourceCanvas = canvasRef.current;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = sourceCanvas.width;
    textureCanvas.height = sourceCanvas.height;
    const textureCtx = textureCanvas.getContext("2d", { alpha: false });
    if (!textureCtx) return;
    textureCtx.fillStyle = "#ffffff";
    textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
    textureCtx.drawImage(sourceCanvas, 0, 0);

    onSave({ dataUrl: textureCanvas.toDataURL("image/png"), textureCanvas });
  };

  const brushProgress = ((brushSize - MIN_BRUSH) / (MAX_BRUSH - MIN_BRUSH)) * 100;

  return (
    <div className="drawing-modal-overlay" onClick={onDismiss}>
      <div className="drawing-workspace" onClick={(event) => event.stopPropagation()}>
        <div className="drawing-workspace__paper">
          <canvas
            ref={canvasRef}
            width={resolvedCanvasSize.width}
            height={resolvedCanvasSize.height}
            className="drawing-workspace__canvas drawing-workspace__canvas--rotated"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              beginStroke(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              drawStroke(event.clientX, event.clientY);
            }}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
          />
        </div>

        <aside className="drawing-sidebar">
          <div className="drawing-sidebar__panel drawing-sidebar__panel--tools">
            <button
              type="button"
              className={`drawing-sheet__pill ${isEraser ? "drawing-sheet__pill--erase-selected" : ""}`}
              onClick={() => setIsEraser(true)}
            >
              Erase
            </button>
            <button type="button" className="drawing-sheet__pill" onClick={clearCanvas}>
              Clear
            </button>
            <button
              type="button"
              className={`drawing-sheet__pill drawing-sheet__pill--pencil ${!isEraser ? "drawing-sheet__pill--selected" : ""}`}
              onClick={() => setIsEraser(false)}
            >
              Pencil
            </button>

            <label className="drawing-sidebar__sliderWrap">
              <input
                className="drawing-sidebar__slider"
                type="range"
                min={MIN_BRUSH}
                max={MAX_BRUSH}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                style={{ "--slider-fill": `${brushProgress}%` } as CSSProperties}
              />
            </label>

            <button
              type="button"
              className="drawing-sheet__color-dot"
              aria-label="Pick color"
              onClick={() => colorInputRef.current?.click()}
              style={{ backgroundColor: brushColor }}
            >
              <input
                ref={colorInputRef}
                type="color"
                value={brushColor}
                onChange={(event) => setBrushColor(event.target.value)}
              />
            </button>
          </div>

          <div className="drawing-sidebar__panel drawing-sidebar__panel--actions">
            <button type="button" className="drawing-sheet__done" onClick={saveDrawing}>
              Done
            </button>
            <button type="button" className="drawing-sheet__cancel" onClick={onDismiss}>
              Cancel
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
