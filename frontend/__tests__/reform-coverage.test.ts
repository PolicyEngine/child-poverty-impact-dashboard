/**
 * Exhaustive coverage sweep: every selectable (state, option) the UI exposes
 * must build a valid reform dict without throwing. This is the fast, no-PE-US
 * guard against wiring regressions — e.g. adding a state to a registry but
 * forgetting to wire its suffix in ``buildReformDict``, which would otherwise
 * only surface as a broken impact page at runtime.
 *
 * Param-path validity against policyengine-us is checked separately by the
 * Python compute test (``tests/calculations/test_reform_computes.py``), which
 * consumes the manifest these same helpers produce.
 */

import { describe, it, expect } from 'vitest';
import {
  allStateCodes,
  getReformOptionsForState,
} from '@/lib/state-programs';
import { buildReformDict, type ReformDict } from '@/lib/reforms';
import {
  COVERAGE_YEAR,
  selectableOptions,
  defaultParamValues,
  editedParamValues,
  comboOptionsForState,
  mergedDefaultParamValues,
} from '@/lib/reform-coverage';

/** A reform dict must map non-empty parameter-path strings to scalars or
 *  date/breakdown maps of scalars. An empty dict is valid (= baseline). */
function assertValidReformDict(reform: ReformDict): void {
  expect(reform).toBeTypeOf('object');
  expect(reform).not.toBeNull();
  for (const [path, value] of Object.entries(reform)) {
    expect(path.length).toBeGreaterThan(0);
    const t = typeof value;
    if (t === 'number' || t === 'boolean') continue;
    expect(value).toBeTypeOf('object');
    expect(value).not.toBeNull();
    for (const inner of Object.values(value as Record<string, unknown>)) {
      expect(['number', 'boolean']).toContain(typeof inner);
    }
  }
}

const states = allStateCodes();

it('exposes options for a meaningful number of states', () => {
  // Guard against a registry/import collapse silently emptying the sweep.
  expect(states.length).toBeGreaterThanOrEqual(50);
});

describe.each(states)('reform options for %s', (state) => {
  const opts = getReformOptionsForState(state, COVERAGE_YEAR);
  const options = selectableOptions(opts);

  if (options.length === 0) {
    // States with no income tax still expose federal + child-allowance
    // options, so an empty list would itself be a regression worth seeing.
    it('has at least the universal (federal / child-allowance) options', () => {
      expect(options.length).toBeGreaterThan(0);
    });
    return;
  }

  it.each(options.map((o) => [o.id, o] as const))(
    'builds %s at default params',
    (_id, option) => {
      const reform = buildReformDict(
        [option.id],
        defaultParamValues(option),
        COVERAGE_YEAR,
      );
      assertValidReformDict(reform);
    },
  );

  const configurable = options.filter(
    (o) => (o.adjustable_params?.length ?? 0) > 0,
  );
  if (configurable.length > 0) {
    it.each(configurable.map((o) => [o.id, o] as const))(
      'builds %s at an edited param value',
      (_id, option) => {
        const reform = buildReformDict(
          [option.id],
          editedParamValues(option),
          COVERAGE_YEAR,
        );
        assertValidReformDict(reform);
      },
    );
  }

  it('builds the all-categories combo', () => {
    const combo = comboOptionsForState(opts);
    const ids = combo.map((o) => o.id);
    const reform = buildReformDict(
      ids,
      mergedDefaultParamValues(combo),
      COVERAGE_YEAR,
    );
    assertValidReformDict(reform);
  });
});
