import { describe, it, expect } from 'vitest';
import {
  SHARE_PARAM,
  decodeReportConfig,
  encodeReportConfig,
} from '@/lib/share-link';

const CONFIG = {
  states: ['MS'],
  populationType: 'statewide',
  household: null,
  selectedReforms: ['ms_eitc'],
  parameterValues: { ms_eitc: { make_refundable: 1, match_rate: 15 } },
  reformLabels: ['Mississippi EITC — Match rate 0% → 15%'],
  year: 2026,
};

describe('share-link codec', () => {
  it('round-trips a report config', () => {
    const encoded = encodeReportConfig(CONFIG);
    expect(decodeReportConfig(encoded)).toEqual(CONFIG);
  });

  it('produces URL-safe output without further escaping', () => {
    const encoded = encodeReportConfig(CONFIG);
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  it('survives URLSearchParams transport (the + vs space trap)', () => {
    const encoded = encodeReportConfig(CONFIG);
    const roundTripped = new URLSearchParams(`c=${encoded}`).get('c')!;
    expect(decodeReportConfig(roundTripped)).toEqual(CONFIG);
  });

  it('stays link-sized for parameter-heavy configs', () => {
    const heavy = {
      ...CONFIG,
      states: ['CA', 'TX', 'NY', 'FL', 'MS'],
      selectedReforms: Array.from({ length: 8 }, (_, i) => `reform_${i}`),
      parameterValues: Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [
          `reform_${i}`,
          { amount: 1000 + i, age: 6 + i, phaseout_start: 20000 + 500 * i },
        ]),
      ),
    };
    expect(encodeReportConfig(heavy).length).toBeLessThan(1200);
  });

  it('returns null for garbage and tampered inputs', () => {
    expect(decodeReportConfig('not-a-real-payload')).toBeNull();
    expect(decodeReportConfig('')).toBeNull();
    const encoded = encodeReportConfig(CONFIG);
    expect(decodeReportConfig(encoded.slice(0, -10))).toBeNull();
  });

  it('rejects payloads without the version envelope', () => {
    // A raw compressed object (no {v, config} wrapper) must not decode.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LZString = require('lz-string');
    const bare = LZString.compressToEncodedURIComponent(JSON.stringify({ states: ['CA'] }));
    expect(decodeReportConfig(bare)).toBeNull();
  });

  it('exports the query param the pages agree on', () => {
    expect(SHARE_PARAM).toBe('c');
  });
});
