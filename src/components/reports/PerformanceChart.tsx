import React, { useRef, useEffect } from 'react';

export interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'heatmap';
  data: number[];
  labels: string[];
  title?: string;
  width?: number;
  height?: number;
  color?: string;
  colors?: string[];
  heatmapData?: number[][]; // for heatmap: [24 hours][7 days]
}

const defaultColors = ['#1e3a8a', '#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function PerformanceChart({
  type,
  data,
  labels,
  title,
  width = 600,
  height = 250,
  color = '#1e3a8a',
  colors = defaultColors,
  heatmapData,
}: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Hi-DPI scaling for crisp rendering on Retina displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (type === 'heatmap' && heatmapData) {
      drawHeatmap(ctx, heatmapData, width, height);
    } else if (type === 'pie') {
      drawPie(ctx, data, labels, colors, width, height);
    } else if (type === 'line') {
      drawLine(ctx, data, labels, color, width, height);
    } else {
      drawBar(ctx, data, labels, color, width, height);
    }
  }, [type, data, labels, width, height, color, colors, heatmapData]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      {title && (
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
      )}
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ maxWidth: width, height: 'auto', aspectRatio: `${width}/${height}` }}
      />
    </div>
  );
}

// ─── Bar chart ──────────────────────────────────────────────────────

function drawBar(ctx: CanvasRenderingContext2D, data: number[], labels: string[], color: string, w: number, h: number) {
  const pad = 50;
  const cw = w - pad * 2;
  const ch = h - pad * 2;
  const max = Math.max(...data, 1);

  // Grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = pad + (ch / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, gy);
    ctx.lineTo(w - pad, gy);
    ctx.stroke();

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const val = max - (max / 4) * i;
    ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1), pad - 5, gy + 3);
  }

  const spacing = cw / data.length;
  const barW = spacing * 0.6;

  data.forEach((v, i) => {
    const bh = (v / max) * ch;
    const x = pad + spacing * i + (spacing - barW) / 2;
    const y = h - pad - bh;

    // Gradient bar
    const grad = ctx.createLinearGradient(x, y, x, y + bh);
    grad.addColorStop(0, color);
    grad.addColorStop(1, adjustColor(color, 30));
    ctx.fillStyle = grad;

    // Rounded top
    const radius = Math.min(barW / 2, 4);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + barW - radius, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
    ctx.lineTo(x + barW, y + bh);
    ctx.lineTo(x, y + bh);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();
  });

  // X labels
  ctx.fillStyle = '#374151';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((lbl, i) => {
    ctx.fillText(lbl.substring(0, 10), pad + spacing * i + spacing / 2, h - 10);
  });
}

// ─── Line chart ─────────────────────────────────────────────────────

function drawLine(ctx: CanvasRenderingContext2D, data: number[], labels: string[], color: string, w: number, h: number) {
  const pad = 50;
  const cw = w - pad * 2;
  const ch = h - pad * 2;
  const max = Math.max(...data, 1);

  // Grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = pad + (ch / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, gy);
    ctx.lineTo(w - pad, gy);
    ctx.stroke();

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const val = max - (max / 4) * i;
    ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1), pad - 5, gy + 3);
  }

  const sp = cw / Math.max(data.length - 1, 1);

  // Area fill
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  data.forEach((v, i) => {
    const x = pad + sp * i;
    const y = h - pad - (v / max) * ch;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(pad + sp * (data.length - 1), h - pad);
  ctx.closePath();
  ctx.fillStyle = color + '1a'; // 10% opacity
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  data.forEach((v, i) => {
    const x = pad + sp * i;
    const y = h - pad - (v / max) * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  data.forEach((v, i) => {
    const x = pad + sp * i;
    const y = h - pad - (v / max) * ch;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // X labels
  ctx.fillStyle = '#374151';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((lbl, i) => {
    ctx.fillText(lbl.substring(0, 10), pad + sp * i, h - 10);
  });
}

// ─── Pie chart ──────────────────────────────────────────────────────

function drawPie(ctx: CanvasRenderingContext2D, data: number[], labels: string[], colors: string[], w: number, h: number) {
  const total = data.reduce((s, v) => s + v, 0);
  if (total === 0) return;

  const cx = w / 2;
  const cy = h / 2 - 20;
  const r = Math.min(cx, cy) - 30;
  let angle = -Math.PI / 2;

  data.forEach((v, i) => {
    const slice = (v / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    angle += slice;
  });

  // Legend
  let lx = 15;
  const ly = h - 20;
  ctx.font = '10px sans-serif';
  labels.forEach((lbl, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = '#374151';
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : '0';
    const text = `${lbl} (${pct}%)`;
    ctx.fillText(text, lx + 14, ly + 9);
    lx += ctx.measureText(text).width + 24;
  });
}

// ─── Heatmap ────────────────────────────────────────────────────────

function drawHeatmap(ctx: CanvasRenderingContext2D, data: number[][], w: number, h: number) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const padL = 40;
  const padT = 20;
  const padR = 15;
  const padB = 25;
  const cellW = (w - padL - padR) / 7;
  const cellH = (h - padT - padB) / 24;

  const max = Math.max(...data.flat(), 1);

  // Day headers
  ctx.fillStyle = '#374151';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  days.forEach((d, i) => {
    ctx.fillText(d, padL + cellW * i + cellW / 2, 14);
  });

  // Hour labels + cells
  for (let hr = 0; hr < 24; hr++) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${hr}:00`, padL - 4, padT + cellH * hr + cellH / 2 + 3);

    for (let d = 0; d < 7; d++) {
      const val = data[hr][d];
      const intensity = val / max;
      const x = padL + cellW * d;
      const y = padT + cellH * hr;

      ctx.fillStyle = intensity === 0
        ? '#f3f4f6'
        : `rgba(30, 58, 138, ${0.1 + intensity * 0.8})`;
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

      if (val > 0 && cellH > 10) {
        ctx.fillStyle = intensity > 0.5 ? '#ffffff' : '#374151';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(val), x + cellW / 2, y + cellH / 2 + 3);
      }
    }
  }
}

// ─── Color helper ───────────────────────────────────────────────────

function adjustColor(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + amount);
  g = Math.min(255, g + amount);
  b = Math.min(255, b + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Export chart as base64 (for PDF embedding) ─────────────────────

export function getChartImage(canvasRef: React.RefObject<HTMLCanvasElement>): string {
  return canvasRef.current?.toDataURL('image/png', 0.8) || '';
}
