/**
 * arabicReshaper.ts
 *
 * Converts standard Arabic Unicode (U+0600–U+06FF) into Unicode Arabic
 * Presentation Forms (U+FE70–FEFF / U+FB50–FDFF) and reverses the string
 * to visual order so jsPDF renders it correctly with an Arabic font (Amiri).
 *
 * jsPDF does NOT use a text-shaping engine — it maps code points to glyphs
 * directly via the font's cmap table.  We must therefore pre-shape the text
 * ourselves before passing it to doc.text().
 *
 * Usage:
 *   const shaped = reshapeArabic("مرحبا بكم");
 *   doc.setFont('Amiri', 'normal');
 *   doc.text(shaped, pageWidth - margin, y, { align: 'right', isInputVisual: true });
 */

// ── Joining types ──────────────────────────────────────────────────────────
// D = dual (connects left AND right)
// R = right-only (connects to previous char, not to next)
// T = transparent (diacritics — skip when determining neighbours)
// U = non-joining

type JoinType = 'D' | 'R' | 'T' | 'U';

const JOIN_TYPE: Record<number, JoinType> = {
  // Transparents (diacritics / Tatweel)
  0x0640: 'D', // TATWEEL (kashida — elongation)
  0x064B: 'T', 0x064C: 'T', 0x064D: 'T', 0x064E: 'T',
  0x064F: 'T', 0x0650: 'T', 0x0651: 'T', 0x0652: 'T',
  0x0653: 'T', 0x0654: 'T', 0x0655: 'T', 0x0656: 'T',
  0x0657: 'T', 0x0658: 'T', 0x0659: 'T', 0x065A: 'T',
  0x065B: 'T', 0x065C: 'T', 0x065D: 'T', 0x065E: 'T',
  0x065F: 'T',
  // Right-joining only (non-dual)
  0x0621: 'U', // HAMZA (standalone — no joining)
  0x0622: 'R', // آ ALEF WITH MADDA ABOVE
  0x0623: 'R', // أ ALEF WITH HAMZA ABOVE
  0x0624: 'R', // ؤ WAW WITH HAMZA
  0x0625: 'R', // إ ALEF WITH HAMZA BELOW
  0x0627: 'R', // ا ALEF
  0x0629: 'R', // ة TEH MARBUTA
  0x062F: 'R', // د DAL
  0x0630: 'R', // ذ THAL
  0x0631: 'R', // ر RAA
  0x0632: 'R', // ز ZAYN
  0x0648: 'R', // و WAW
  0x0649: 'R', // ى ALEF MAQSURA
  0x0671: 'R', // ٱ ALEF WASLA
  0x0698: 'R', // ژ JEH (Farsi)
  // Dual-joining
  0x0626: 'D', 0x0628: 'D', 0x062A: 'D', 0x062B: 'D', 0x062C: 'D',
  0x062D: 'D', 0x062E: 'D', 0x0633: 'D', 0x0634: 'D', 0x0635: 'D',
  0x0636: 'D', 0x0637: 'D', 0x0638: 'D', 0x0639: 'D', 0x063A: 'D',
  0x0641: 'D', 0x0642: 'D', 0x0643: 'D', 0x0644: 'D', 0x0645: 'D',
  0x0646: 'D', 0x0647: 'D', 0x064A: 'D',
  // Extended Arabic (Farsi / Urdu / Kurdish)
  0x067E: 'D', // پ PEH
  0x0686: 'D', // چ TCHEH
  0x06A9: 'D', // ک KEHEH
  0x06AF: 'D', // گ GAF
  0x06CC: 'D', // ی FARSI YEH
};

// ── Presentation Forms [isolated, final, initial, medial] ─────────────────
// Index 0 = isolated, 1 = final, 2 = initial, 3 = medial
// 0 means that form does not exist (right-joining chars have no initial/medial)

const FORMS: Record<number, [number, number, number, number]> = {
  0x0622: [0xFE81, 0xFE82, 0,      0     ], // آ
  0x0623: [0xFE83, 0xFE84, 0,      0     ], // أ
  0x0624: [0xFE85, 0xFE86, 0,      0     ], // ؤ
  0x0625: [0xFE87, 0xFE88, 0,      0     ], // إ
  0x0626: [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C], // ئ
  0x0627: [0xFE8D, 0xFE8E, 0,      0     ], // ا
  0x0628: [0xFE8F, 0xFE90, 0xFE91, 0xFE92], // ب
  0x0629: [0xFE93, 0xFE94, 0,      0     ], // ة
  0x062A: [0xFE95, 0xFE96, 0xFE97, 0xFE98], // ت
  0x062B: [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C], // ث
  0x062C: [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0], // ج
  0x062D: [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4], // ح
  0x062E: [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8], // خ
  0x062F: [0xFEA9, 0xFEAA, 0,      0     ], // د
  0x0630: [0xFEAB, 0xFEAC, 0,      0     ], // ذ
  0x0631: [0xFEAD, 0xFEAE, 0,      0     ], // ر
  0x0632: [0xFEAF, 0xFEB0, 0,      0     ], // ز
  0x0633: [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4], // س
  0x0634: [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8], // ش
  0x0635: [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC], // ص
  0x0636: [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0], // ض
  0x0637: [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4], // ط
  0x0638: [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8], // ظ
  0x0639: [0xFEC9, 0xFECA, 0xFECB, 0xFECC], // ع
  0x063A: [0xFECD, 0xFECE, 0xFECF, 0xFED0], // غ
  0x0641: [0xFED1, 0xFED2, 0xFED3, 0xFED4], // ف
  0x0642: [0xFED5, 0xFED6, 0xFED7, 0xFED8], // ق
  0x0643: [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC], // ك
  0x0644: [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0], // ل
  0x0645: [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4], // م
  0x0646: [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8], // ن
  0x0647: [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC], // ه
  0x0648: [0xFEED, 0xFEEE, 0,      0     ], // و
  0x0649: [0xFEEF, 0xFEF0, 0,      0     ], // ى
  0x064A: [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4], // ي
  // Hamza (no joining)
  0x0621: [0xFE80, 0,      0,      0     ], // ء
  // Extended Arabic / Farsi / Urdu
  0x0671: [0xFB50, 0xFB51, 0,      0     ], // ٱ ALEF WASLA
  0x067E: [0xFB56, 0xFB57, 0xFB58, 0xFB59], // پ PEH
  0x0686: [0xFB7A, 0xFB7B, 0xFB7C, 0xFB7D], // چ TCHEH
  0x0698: [0xFB8A, 0xFB8B, 0,      0     ], // ژ JEH
  0x06A9: [0xFB8E, 0xFB8F, 0xFB90, 0xFB91], // ک KEHEH
  0x06AF: [0xFB92, 0xFB93, 0xFB94, 0xFB95], // گ GAF
  0x06CC: [0xFBFC, 0xFBFD, 0xFBFE, 0xFBFF], // ی FARSI YEH
};

// ── Lam-Alef mandatory ligatures ─────────────────────────────────────────
// When ل (LAM, 0x0644) is followed by one of these Alef variants,
// they MUST fuse into a single ligature glyph.
// Values: [isolated_ligature, final_ligature]
const LAM_ALEF: Record<number, [number, number]> = {
  0x0622: [0xFEF5, 0xFEF6], // لآ
  0x0623: [0xFEF7, 0xFEF8], // لأ
  0x0625: [0xFEF9, 0xFEFA], // لإ
  0x0627: [0xFEFB, 0xFEFC], // لا
  0x0671: [0xFEFB, 0xFEFC], // لٱ (Alef Wasla → treat as laa)
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** True if the codepoint is in any Arabic Unicode block */
export function isArabicChar(cp: number): boolean {
  return (cp >= 0x0600 && cp <= 0x06FF) || // Arabic
         (cp >= 0x0750 && cp <= 0x077F) || // Arabic Supplement
         (cp >= 0xFB50 && cp <= 0xFDFF) || // Arabic Pres. Forms-A
         (cp >= 0xFE70 && cp <= 0xFEFF);   // Arabic Pres. Forms-B
}

/** True if the string contains at least one Arabic character */
export function containsArabic(text: string): boolean {
  for (const ch of text) {
    if (isArabicChar(ch.codePointAt(0)!)) return true;
  }
  return false;
}

/** Skip transparent characters (diacritics) when finding neighbours */
function effectiveJoinType(cp: number): JoinType {
  return JOIN_TYPE[cp] ?? 'U';
}

/** Find the nearest non-transparent Arabic character to the LEFT of index i */
function prevJoiningChar(cps: number[], i: number): JoinType {
  for (let j = i - 1; j >= 0; j--) {
    const jt = effectiveJoinType(cps[j]);
    if (jt !== 'T') return jt;
  }
  return 'U';
}

/** Find the nearest non-transparent Arabic character to the RIGHT of index i */
function nextJoiningChar(cps: number[], i: number): JoinType {
  for (let j = i + 1; j < cps.length; j++) {
    const jt = effectiveJoinType(cps[j]);
    if (jt !== 'T') return jt;
  }
  return 'U';
}

// ── Main reshaping function ────────────────────────────────────────────────

/**
 * Reshapes an Arabic string and returns it in visual (left-to-right) order
 * using Unicode Presentation Form characters.
 *
 * The return value can be passed directly to jsPDF `doc.text()` with:
 *   - font set to 'Amiri' (or any Arabic font embedded in the PDF)
 *   - `{ isInputVisual: true }` option
 *   - text positioned at the RIGHT edge of the printable area with align:'right'
 */
export function reshapeArabic(text: string): string {
  // Convert string to array of Unicode code points (handles surrogate pairs)
  const cps: number[] = [];
  for (const ch of text) {
    cps.push(ch.codePointAt(0)!);
  }

  const out: number[] = [];
  let i = 0;

  while (i < cps.length) {
    const cp = cps[i];
    const forms = FORMS[cp];

    // Non-Arabic character — pass through unchanged
    if (!forms) {
      out.push(cp);
      i++;
      continue;
    }

    const jt = effectiveJoinType(cp);

    // Transparent character (diacritic) — pass through unchanged
    if (jt === 'T') {
      out.push(cp);
      i++;
      continue;
    }

    const prevJT = prevJoiningChar(cps, i);
    const nextJT = nextJoiningChar(cps, i);

    const connectsFromLeft  = (jt === 'D' || jt === 'R') && (prevJT === 'D' || prevJT === 'R');
    const connectsToRight   = (jt === 'D') && (nextJT === 'D' || nextJT === 'R');

    // Lam-Alef ligature check: current is LAM (0x0644), next is an Alef variant
    if (cp === 0x0644 && i + 1 < cps.length && LAM_ALEF[cps[i + 1]]) {
      const alef = cps[i + 1];
      const ligPair = LAM_ALEF[alef];
      // Use final form if LAM connects to a letter on its left
      out.push(connectsFromLeft ? ligPair[1] : ligPair[0]);
      i += 2; // consume both LAM and ALEF
      continue;
    }

    // Choose contextual form
    let formIdx: 0 | 1 | 2 | 3;
    if (connectsFromLeft && connectsToRight && forms[3]) {
      formIdx = 3; // medial
    } else if (connectsFromLeft && forms[1]) {
      formIdx = 1; // final
    } else if (connectsToRight && forms[2]) {
      formIdx = 2; // initial
    } else {
      formIdx = 0; // isolated
    }

    out.push(forms[formIdx] || forms[0]);
    i++;
  }

  // Reverse to visual (left-to-right) order for jsPDF rendering
  // Characters that are NOT Arabic (digits, punctuation) stay in place
  // within their RTL run — we do a word-level reversal here.
  return reverseRTL(out);
}

/**
 * Reverses Arabic runs while keeping Latin/numeric sub-runs in their
 * natural left-to-right order within the reversed Arabic context.
 *
 * Example (logical):  "كود 123 تجريبي"
 * Visual (reversed):  "يبيرجت 123 دوك"
 *
 * This is a simplified BiDi implementation sufficient for single-line
 * strings containing Arabic and ASCII mixed text.
 */
function reverseRTL(cps: number[]): string {
  type Run = { chars: number[]; isArabic: boolean };
  const runs: Run[] = [];
  let current: Run | null = null;

  for (const cp of cps) {
    // Spaces and punctuation are grouped with their surrounding run
    const arabic = isArabicChar(cp);
    if (!current || current.isArabic !== arabic) {
      current = { chars: [], isArabic: arabic };
      runs.push(current);
    }
    current.chars.push(cp);
  }

  // Reverse the order of runs (RTL paragraph) and reverse Arabic runs internally
  const visual: number[] = [];
  for (const run of runs.reverse()) {
    if (run.isArabic) {
      visual.push(...run.chars.reverse());
    } else {
      visual.push(...run.chars);
    }
  }

  return visual.map(cp => String.fromCodePoint(cp)).join('');
}

// ── jsPDF text helper ──────────────────────────────────────────────────────

/**
 * Renders a string that may contain Arabic (or mixed Arabic/Latin) correctly
 * in a jsPDF document.
 *
 * For Arabic text:
 *  - Reshapes and reverses the string
 *  - Sets font to Amiri
 *  - Right-aligns the text from the given x position
 *
 * For Latin-only text:
 *  - Passes through unchanged with the current font
 *
 * @param doc       jsPDF instance (Amiri font must already be registered)
 * @param text      The text to render
 * @param x         X position (used as the RIGHT edge for Arabic text)
 * @param y         Y position
 * @param fontSize  Font size
 * @param latin     Font name to restore for Latin text (default 'helvetica')
 */
export function drawText(
  doc: any,
  text: string,
  x: number,
  y: number,
  fontSize: number = 9,
  latin: string = 'helvetica',
): void {
  if (!text) return;
  doc.setFontSize(fontSize);

  if (containsArabic(text)) {
    const shaped = reshapeArabic(text);
    doc.setFont('Amiri', 'normal');
    doc.text(shaped, x, y, { align: 'right', isInputVisual: true });
    doc.setFont(latin, 'normal'); // restore Latin font
  } else {
    doc.setFont(latin, 'normal');
    doc.text(text, x, y);
  }
}
