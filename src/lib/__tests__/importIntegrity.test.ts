import { describe, expect, it } from 'vitest';
import {
  buildImportPreviewSummary,
  crossesMidPeakBoundary,
  detectDominantCard,
  isOvernightSession,
  namesLooselyMatch,
  normalizeCardNumber,
  parseOperatorFromFilename,
  resolveOperatorMatch,
  type FileIdentity,
} from '../importIntegrity';
import type { ParsedSession as PS } from '../importService';

function sess(partial: Partial<PS> & Pick<PS, 'transactionId' | 'startDateTime' | 'endDateTime'>): PS {
  return {
    chargeId: 'C1',
    cardNumber: '2024040000006424',
    energyKwh: 10,
    ...partial,
  };
}

describe('importIntegrity EV-C', () => {
  it('normalizes card numbers', () => {
    expect(normalizeCardNumber('2024-0400-0000-6424')).toBe('2024040000006424');
    expect(normalizeCardNumber('  ')).toBeNull();
  });

  it('parses operator from filename', () => {
    expect(parseOperatorFromFilename('2026-07-16+abo saleh.xlsx')).toBe('abo saleh');
    expect(parseOperatorFromFilename('2026-07-16+mohammad.xlsx')).toBe('mohammad');
    expect(parseOperatorFromFilename('plain.xlsx')).toBeNull();
  });

  it('matches loose operator names', () => {
    expect(namesLooselyMatch('abo saleh', 'ABO SALEH ALI SALEH')).toBe(true);
    expect(namesLooselyMatch('mohammad', 'MOHAMMAD DARWESH')).toBe(true);
    expect(namesLooselyMatch('abo saleh', 'MOHAMMAD DARWESH')).toBe(false);
  });

  it('detects dominant card', () => {
    const sessions = [
      sess({ transactionId: '1', startDateTime: '2026-07-16 10:00:00', endDateTime: '2026-07-16 11:00:00', cardNumber: 'AAA' }),
      sess({ transactionId: '2', startDateTime: '2026-07-16 11:00:00', endDateTime: '2026-07-16 12:00:00', cardNumber: 'BBB' }),
      sess({ transactionId: '3', startDateTime: '2026-07-16 12:00:00', endDateTime: '2026-07-16 13:00:00', cardNumber: 'AAA' }),
    ];
    expect(detectDominantCard(sessions)).toBe('AAA');
  });

  it('resolves match / warning / conflict / unknown', () => {
    const selected = { id: 'op-a', name: 'ABO SALEH ALI SALEH', card_number: '2024040000006424' };
    const owner = { ...selected };

    expect(
      resolveOperatorMatch({
        selected,
        detectedCardId: '2024040000006424',
        detectedOperatorName: 'abo saleh',
        cardOwner: owner,
      }).status
    ).toBe('match');

    expect(
      resolveOperatorMatch({
        selected,
        detectedCardId: '2024040000006424',
        detectedOperatorName: 'mohammad',
        cardOwner: owner,
      }).status
    ).toBe('warning');

    expect(
      resolveOperatorMatch({
        selected,
        detectedCardId: '2024040000006443',
        detectedOperatorName: 'abo saleh',
        cardOwner: { id: 'op-b', name: 'MOHAMMAD DARWESH', card_number: '2024040000006443' },
      }).status
    ).toBe('conflict');

    expect(
      resolveOperatorMatch({
        selected,
        detectedCardId: '9999999999999999',
        detectedOperatorName: 'abo saleh',
        cardOwner: null,
      }).status
    ).toBe('unknown_card');
  });

  it('flags overnight and mid-peak boundary sessions', () => {
    const overnight = sess({
      transactionId: '1573323579',
      startDateTime: '2026-07-15 23:53:32',
      endDateTime: '2026-07-16 00:37:05',
    });
    const boundary = sess({
      transactionId: '1409778499',
      startDateTime: '2026-07-16 13:59:17',
      endDateTime: '2026-07-16 14:14:44',
    });
    expect(isOvernightSession(overnight)).toBe(true);
    expect(crossesMidPeakBoundary(boundary)).toBe(true);
  });

  it('builds preview summary counters', () => {
    const sessions = [
      sess({
        transactionId: '1573323579',
        startDateTime: '2026-07-15 23:53:32',
        endDateTime: '2026-07-16 00:37:05',
        energyKwh: 38,
      }),
      sess({
        transactionId: '1409778499',
        startDateTime: '2026-07-16 13:59:17',
        endDateTime: '2026-07-16 14:14:44',
        energyKwh: 8.2,
      }),
    ];
    const identity: FileIdentity = {
      originalFilename: '2026-07-16+abo saleh.xlsx',
      normalizedFilename: '2026-07-16+abo saleh.xlsx',
      fileHash: 'abc',
      fileSizeBytes: 1,
      rowCount: 2,
      parsedTransactionCount: 2,
      parserVersion: 'ev-c-v1.0.0',
      detectedCardId: '2024040000006424',
      detectedOperatorName: 'abo saleh',
    };
    const resolution = resolveOperatorMatch({
      selected: { id: 'op-a', name: 'ABO SALEH ALI SALEH', card_number: '2024040000006424' },
      detectedCardId: identity.detectedCardId,
      detectedOperatorName: identity.detectedOperatorName,
      cardOwner: { id: 'op-a', name: 'ABO SALEH ALI SALEH', card_number: '2024040000006424' },
    });
    const summary = buildImportPreviewSummary({
      fileIdentity: identity,
      sessions,
      resolution,
      stationId: 'st-1',
      existingTransactionIds: new Set(['1409778499']),
      invalidRows: 0,
    });
    expect(summary.overnightCount).toBe(1);
    expect(summary.duplicateCount).toBe(1);
    expect(summary.operatorMatchStatus).toBe('match');
    expect(summary.totalEnergyKwh).toBe(46.2);
  });
});
