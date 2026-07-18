/**
 * arabicReshaper.ts
 *
 * Arabic text rendering for jsPDF using the browser's HTML5 Canvas engine.
 *
 * WHY CANVAS INSTEAD OF UNICODE PRESENTATION FORMS:
 * jsPDF has no text-shaping engine — it maps Unicode code points directly to
 * glyph IDs using the font's cmap table.  Even with an Arabic font embedded,
 * it cannot:
 *   • Apply contextual letter forms (initial / medial / final / isolated)
 *   • Produce mandatory ligatures (lam-alef, etc.)
 *   • Reverse text for right-to-left rendering
 *
 * The browser's Canvas 2D API DOES handle all of this natively via the OS
 * text-shaping stack (HarfBuzz / CoreText / DirectWrite).  We render the
 * Arabic text onto an offscreen canvas, export it as a PNG, then embed it as
 * an image in the PDF.  The result is pixel-perfect Arabic.
 *
 * The `@fontsource/amiri` package is already installed in this project and
 * loaded via CSS, so the browser will use the Amiri font on the canvas.
 *
 * Usage (in pdfReportService.ts):
 *   const img = await arabicTextToPng("ملاحظة: نقص في المبلغ", 9);
 *   if (img) {
 *     doc.addImage(img.dataUrl, 'PNG', img.x(rightEdge), y - img.heightMm * 0.8,
 *                  img.widthMm, img.heightMm);
 *   }
 */

/** Returns true if the string contains any Arabic character */
export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export interface ArabicImage {
  /** PNG data URL — pass directly to doc.addImage() */
  dataUrl: string;
  /** Rendered width in millimetres (for PDF placement) */
  widthMm: number;
  /** Rendered height in millimetres (for PDF placement) */
  heightMm: number;
  /**
   * Helper: returns the X coordinate so the text image is RIGHT-aligned
   * against `rightEdgeMm`.
   */
  xRight(rightEdgeMm: number): number;
  /**
   * Helper: returns the X coordinate so the text image is LEFT-aligned
   * starting at `leftEdgeMm`.
   */
  xLeft(leftEdgeMm: number): number;
}

/**
 * Renders `text` onto an offscreen HTML5 canvas using the browser's native
 * Arabic shaping engine, then returns the PNG as an ArabicImage descriptor.
 *
 * @param text         The Arabic (or mixed Arabic/Latin) string to render.
 * @param fontSizePt   Desired font size in PDF points (same as jsPDF fontSize).
 * @param color        CSS colour for the text (default '#000000').
 * @param maxWidthMm   Maximum line width in mm; text is clipped to this width.
 * @param fontFamily   CSS font-family override (defaults to Amiri → Arial).
 *
 * Returns `null` if `text` contains no Arabic characters (caller should use
 * normal jsPDF text rendering instead).
 */
export async function arabicTextToPng(
  text: string,
  fontSizePt: number = 9,
  color: string = '#000000',
  maxWidthMm: number = 180,
  fontFamily: string = '"Amiri", "Arial Unicode MS", "Scheherazade New", serif',
): Promise<ArabicImage | null> {
  if (!text || !containsArabic(text)) return null;

  // ── Size constants ──────────────────────────────────────────────────────
  // Render at 3× to get crisp text when downscaled in the PDF
  const SCALE = 3;
  const MM_TO_PX_96DPI = 3.7795276; // 1 mm at 96 dpi

  // Convert PDF points (72 dpi) → CSS pixels (96 dpi)
  const fontPx = Math.round((fontSizePt * 96) / 72);
  const fontPxScaled = fontPx * SCALE;

  // Maximum pixel width at the scaled resolution
  const maxPxWidth = maxWidthMm * MM_TO_PX_96DPI * SCALE;

  // ── Measure text ────────────────────────────────────────────────────────
  // We need a temporary canvas just to measure the text width before sizing.
  const probe = document.createElement('canvas');
  const pCtx = probe.getContext('2d')!;
  pCtx.font = `${fontPxScaled}px ${fontFamily}`;
  const measured = pCtx.measureText(text).width;
  const textPxWidth = Math.min(measured, maxPxWidth) + fontPxScaled * 0.2;

  // Line height with comfortable leading
  const lineHeightPx = Math.ceil(fontPxScaled * 1.55);

  // ── Render canvas ───────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width  = Math.ceil(textPxWidth);
  canvas.height = lineHeightPx;

  const ctx = canvas.getContext('2d')!;

  // Canvas must be transparent so the PDF background shows through
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set up RTL Arabic rendering
  ctx.font      = `${fontPxScaled}px ${fontFamily}`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;

  // Baseline at ~80 % of line height gives comfortable top/bottom margins
  const baseline = Math.round(lineHeightPx * 0.78);
  ctx.fillText(text, canvas.width, baseline, canvas.width);

  // ── Convert to PDF units ────────────────────────────────────────────────
  const widthMm  = canvas.width  / (MM_TO_PX_96DPI * SCALE);
  const heightMm = canvas.height / (MM_TO_PX_96DPI * SCALE);

  const dataUrl = canvas.toDataURL('image/png');

  return {
    dataUrl,
    widthMm,
    heightMm,
    xRight(rightEdgeMm: number) { return rightEdgeMm - widthMm; },
    xLeft(leftEdgeMm: number)   { return leftEdgeMm; },
  };
}

/**
 * Convenience wrapper: renders Arabic text and places it into `doc` in one call.
 *
 * @param doc         jsPDF instance
 * @param text        Text to render (may be Arabic, Latin, or mixed)
 * @param rightEdgeMm Right edge X position in mm (text will be right-aligned here)
 * @param yMm         Baseline Y position in mm
 * @param fontSizePt  Font size in PDF points (should match surrounding jsPDF text size)
 * @param color       CSS colour string (default '#000000')
 *
 * Returns the bottom Y of the rendered image (yMm + heightMm), useful for
 * positioning the next element.  If the text is not Arabic, renders it with
 * jsPDF's normal text engine using the current font and returns yMm unchanged.
 */
export async function drawArabicOrLatin(
  doc: any,
  text: string,
  rightEdgeMm: number,
  yMm: number,
  fontSizePt: number = 9,
  color: string = '#000000',
): Promise<number> {
  if (!text) return yMm;

  if (containsArabic(text)) {
    const img = await arabicTextToPng(text, fontSizePt, color, rightEdgeMm - 14);
    if (img) {
      const xImg = img.xRight(rightEdgeMm);
      // Y offset: image top is (yMm - heightMm * 0.78) so the baseline aligns at yMm
      const yImg = yMm - img.heightMm * 0.78;
      doc.addImage(img.dataUrl, 'PNG', xImg, yImg, img.widthMm, img.heightMm);
      return yMm; // caller's baseline is unchanged
    }
  }

  // Non-Arabic fallback: render with jsPDF text engine
  doc.setFontSize(fontSizePt);
  doc.text(text, rightEdgeMm, yMm, { align: 'right' });
  return yMm;
}

/**
 * Returns the CSS hex colour string for an RGB triple used by jsPDF
 * (e.g. [30, 58, 138] → '#1e3a8a').
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
