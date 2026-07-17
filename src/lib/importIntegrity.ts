/**
 * EV-C import integrity helpers: file identity, filename/operator parsing,
 * card normalization, match/warning/conflict resolution, preview summary.
 */

import type { ParsedSession } from './importService';

export const IMPORT_PARSER_VERSION = 'ev-c-v1.0.0';
export const IMPORT_WORKFLOW_FLAG = 'import_workflow_v2_enabled';

export type OperatorMatchStatus =
  | 'match'
  | 'warning'
  | 'conflict'
  | 'unknown_card'
  | 'no_card'
  | 'pending';

export type ImportRowStatus =
  | 'valid'
  | 'warning'
  | 'conflict'
  | 'duplicate'
  | 'invalid'
  | 'overnight'
  | 'cross_period';

export interface OperatorCardRef {
  id: string;
  name: string;
  card_number: string;
  card_number_normalized?: string | null;
  status?: string | null;
}

export interface FileIdentity {
  originalFilename: string;
  normalizedFilename: string;
  fileHash: string;
  fileSizeBytes: number;
  sheetName?: string;
  rowCount: number;
  parsedTransactionCount: number;
  parserVersion: string;
  detectedCardId: string | null;
  detectedOperatorName: string | null;
}

export interface OperatorResolution {
  status: OperatorMatchStatus;
  selectedOperatorId: string | null;
  selectedOperatorName: string | null;
  detectedCardId: string | null;
  detectedOperatorName: string | null;
  cardOwnerOperatorId: string | null;
  cardOwnerOperatorName: string | null;
  message: string;
  canPost: boolean;
  requiresFilenameConfirmation: boolean;
  requiresConflictOverride: boolean;
}

export interface ImportPreviewSummary {
  fileName: string;
  fileHash: string;
  detectedOperatorName: string | null;
  detectedCardId: string | null;
  selectedOperatorName: string | null;
  operatorMatchStatus: OperatorMatchStatus;
  stationId: string | null;
  dateRange: { start: string | null; end: string | null };
  transactionCount: number;
  totalEnergyKwh: number;
  overnightCount: number;
  boundaryCrossingCount: number;
  duplicateCount: number;
  invalidCount: number;
  validCount: number;
  billingReady: boolean;
}

export function normalizeCardNumber(card: string | null | undefined): string | null {
  if (!card) return null;
  const n = card.toUpperCase().replace(/[^0-9A-Z]/g, '').trim();
  return n.length ? n : null;
}

export function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Parse operator text from patterns like `2026-07-16+abo saleh.xlsx`. */
export function parseOperatorFromFilename(filename: string): string | null {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.(xlsx|xls|csv)$/i, '');
  const plus = base.split('+');
  if (plus.length >= 2) {
    const name = plus.slice(1).join('+').trim();
    return name || null;
  }
  const dash = base.match(/^\d{4}-\d{2}-\d{2}[-_](.+)$/);
  if (dash?.[1]) return dash[1].replace(/[_-]+/g, ' ').trim() || null;
  return null;
}

export function normalizePersonName(name: string | null | undefined): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function namesLooselyMatch(a: string | null, b: string | null): boolean {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return true; // no filename signal → not a mismatch
  return na.includes(nb) || nb.includes(na);
}

export function detectDominantCard(sessions: ParsedSession[]): string | null {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const n = normalizeCardNumber(s.cardNumber);
    if (!n) continue;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [card, count] of counts) {
    if (count > bestCount) {
      best = card;
      bestCount = count;
    }
  }
  return best;
}

export function resolveOperatorMatch(params: {
  selected: OperatorCardRef | null;
  detectedCardId: string | null;
  detectedOperatorName: string | null;
  cardOwner: OperatorCardRef | null;
}): OperatorResolution {
  const { selected, detectedCardId, detectedOperatorName, cardOwner } = params;

  if (!selected) {
    return {
      status: 'pending',
      selectedOperatorId: null,
      selectedOperatorName: null,
      detectedCardId,
      detectedOperatorName,
      cardOwnerOperatorId: cardOwner?.id ?? null,
      cardOwnerOperatorName: cardOwner?.name ?? null,
      message: 'Select an operator before posting',
      canPost: false,
      requiresFilenameConfirmation: false,
      requiresConflictOverride: false,
    };
  }

  const selectedCard = normalizeCardNumber(selected.card_number_normalized || selected.card_number);
  const fileCard = normalizeCardNumber(detectedCardId);

  if (!fileCard) {
    const filenameOk = namesLooselyMatch(detectedOperatorName, selected.name);
    if (!filenameOk) {
      return {
        status: 'warning',
        selectedOperatorId: selected.id,
        selectedOperatorName: selected.name,
        detectedCardId,
        detectedOperatorName,
        cardOwnerOperatorId: null,
        cardOwnerOperatorName: null,
        message: 'No card in file; filename operator differs — confirm to proceed',
        canPost: true,
        requiresFilenameConfirmation: true,
        requiresConflictOverride: false,
      };
    }
    return {
      status: 'no_card',
      selectedOperatorId: selected.id,
      selectedOperatorName: selected.name,
      detectedCardId,
      detectedOperatorName,
      cardOwnerOperatorId: null,
      cardOwnerOperatorName: null,
      message: 'No card detected in file — posting with selected operator',
      canPost: true,
      requiresFilenameConfirmation: false,
      requiresConflictOverride: false,
    };
  }

  if (!cardOwner) {
    return {
      status: 'unknown_card',
      selectedOperatorId: selected.id,
      selectedOperatorName: selected.name,
      detectedCardId: fileCard,
      detectedOperatorName,
      cardOwnerOperatorId: null,
      cardOwnerOperatorName: null,
      message: 'Card ID not mapped to an active operator — mapping required before trust',
      canPost: true,
      requiresFilenameConfirmation: !namesLooselyMatch(detectedOperatorName, selected.name),
      requiresConflictOverride: false,
    };
  }

  if (cardOwner.id !== selected.id && selectedCard !== fileCard) {
    return {
      status: 'conflict',
      selectedOperatorId: selected.id,
      selectedOperatorName: selected.name,
      detectedCardId: fileCard,
      detectedOperatorName,
      cardOwnerOperatorId: cardOwner.id,
      cardOwnerOperatorName: cardOwner.name,
      message: `Card belongs to ${cardOwner.name}, not selected operator`,
      canPost: false,
      requiresFilenameConfirmation: false,
      requiresConflictOverride: true,
    };
  }

  const filenameOk = namesLooselyMatch(detectedOperatorName, selected.name);
  if (!filenameOk) {
    return {
      status: 'warning',
      selectedOperatorId: selected.id,
      selectedOperatorName: selected.name,
      detectedCardId: fileCard,
      detectedOperatorName,
      cardOwnerOperatorId: cardOwner.id,
      cardOwnerOperatorName: cardOwner.name,
      message: 'Card matches selected operator; filename differs — confirm to proceed',
      canPost: true,
      requiresFilenameConfirmation: true,
      requiresConflictOverride: false,
    };
  }

  return {
    status: 'match',
    selectedOperatorId: selected.id,
    selectedOperatorName: selected.name,
    detectedCardId: fileCard,
    detectedOperatorName,
    cardOwnerOperatorId: cardOwner.id,
    cardOwnerOperatorName: cardOwner.name,
    message: 'Ready to import',
    canPost: true,
    requiresFilenameConfirmation: false,
    requiresConflictOverride: false,
  };
}

export function isOvernightSession(session: ParsedSession): boolean {
  const start = session.startDateTime?.slice(0, 10);
  const end = session.endDateTime?.slice(0, 10);
  return !!start && !!end && start !== end;
}

/** Rough 14:00 Amman mid-peak boundary crossing heuristic for preview. */
export function crossesMidPeakBoundary(session: ParsedSession): boolean {
  const start = session.startDateTime;
  const end = session.endDateTime;
  if (!start || !end) return false;
  const startTime = start.includes(' ') ? start.split(' ')[1] : start.split('T')[1];
  const endTime = end.includes(' ') ? end.split(' ')[1] : end.split('T')[1];
  if (!startTime || !endTime) return false;
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const s = toMin(startTime);
  const e = toMin(endTime);
  const boundary = 14 * 60;
  if (isOvernightSession(session)) return true;
  return s < boundary && e > boundary;
}

export function buildImportPreviewSummary(params: {
  fileIdentity: FileIdentity;
  sessions: ParsedSession[];
  resolution: OperatorResolution;
  stationId: string | null;
  existingTransactionIds: Set<string>;
  invalidRows: number;
}): ImportPreviewSummary {
  const { fileIdentity, sessions, resolution, stationId, existingTransactionIds, invalidRows } = params;
  let totalEnergy = 0;
  let overnight = 0;
  let boundary = 0;
  let duplicates = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const s of sessions) {
    totalEnergy += Number(s.energyKwh) || 0;
    if (isOvernightSession(s)) overnight++;
    if (crossesMidPeakBoundary(s)) boundary++;
    if (existingTransactionIds.has(s.transactionId)) duplicates++;
    const d = s.startDateTime?.slice(0, 10);
    if (d) {
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
  }

  const validCount = Math.max(0, sessions.length - invalidRows);

  return {
    fileName: fileIdentity.originalFilename,
    fileHash: fileIdentity.fileHash,
    detectedOperatorName: fileIdentity.detectedOperatorName,
    detectedCardId: fileIdentity.detectedCardId,
    selectedOperatorName: resolution.selectedOperatorName,
    operatorMatchStatus: resolution.status,
    stationId,
    dateRange: { start: minDate, end: maxDate },
    transactionCount: sessions.length,
    totalEnergyKwh: Math.round(totalEnergy * 1000) / 1000,
    overnightCount: overnight,
    boundaryCrossingCount: boundary,
    duplicateCount: duplicates,
    invalidCount: invalidRows,
    validCount,
    billingReady:
      resolution.canPost &&
      !resolution.requiresConflictOverride &&
      validCount > 0 &&
      duplicates < sessions.length,
  };
}

export async function sha256File(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildFileIdentity(
  file: File,
  sessions: ParsedSession[],
  sheetName?: string
): Promise<FileIdentity> {
  const fileHash = await sha256File(file);
  return {
    originalFilename: file.name,
    normalizedFilename: normalizeFilename(file.name),
    fileHash,
    fileSizeBytes: file.size,
    sheetName,
    rowCount: sessions.length,
    parsedTransactionCount: sessions.length,
    parserVersion: IMPORT_PARSER_VERSION,
    detectedCardId: detectDominantCard(sessions),
    detectedOperatorName: parseOperatorFromFilename(file.name),
  };
}

export function sessionsToPostPayload(
  sessions: ParsedSession[],
  parseDateTime: (s: string) => { date: string; time: string; timestamp: string } | null
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  sessions.forEach((session, idx) => {
    const start = parseDateTime(session.startDateTime);
    const end = parseDateTime(session.endDateTime);
    if (!start || !end) return;
    out.push({
      transaction_id: session.transactionId,
      charge_id: session.chargeId,
      card_number: session.cardNumber,
      start_ts: start.timestamp,
      end_ts: end.timestamp,
      energy_consumed_kwh: session.energyKwh,
      calculated_cost: session.cost ?? 0,
      station_code: session.stationCode ?? null,
      max_demand_kw: session.maxDemandKw ?? null,
      user_identifier: session.userIdentifier ?? null,
      connector_number: session.connectorNumber ?? null,
      connector_type: session.connectorType ?? null,
      duration_text: session.durationText ?? null,
      co2_reduction_kg: session.co2ReductionKg ?? null,
      start_soc_percent: session.startSocPercent ?? null,
      end_soc_percent: session.endSocPercent ?? null,
      source_row_number: idx + 2,
    });
  });
  return out;
}
