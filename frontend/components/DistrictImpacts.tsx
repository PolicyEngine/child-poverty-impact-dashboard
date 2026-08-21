'use client';

/**
 * Congressional-district impacts: a state-filtered choropleth of the
 * per-district average household net-income change, plus a per-district
 * table with each district's current representative.
 *
 * Boundaries: 119th-Congress districts (frontend/public/data/geojson/…,
 * CD119 shapes shared with the EDAA dashboard); the backend tags results
 * with `district_congress` so a 120th-Congress swap for 2027/2028 changes
 * the geojson + representatives data together. Representatives come from
 * the unitedstates/congress-legislators dataset (119th Congress snapshot
 * in frontend/data/cd-representatives.json).
 *
 * Rendering is plain SVG via d3-geo (geoAlbersUsa handles the AK/HI
 * insets) — no map library, so no React-version peer constraints.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import type { DistrictImpact } from '@/lib/modalApi';
import representatives from '@/data/cd-representatives.json';

const REPS = representatives as Record<string, { name: string; party: string }>;

// PolicyEngine diverging scale (gray = loss, teal = gain), as used by the
// EDAA district map.
const NEG = '#475569';
const MID = '#E2E8F0';
const POS = '#319795';

const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56',
};

/** DISTRICT_ID convention shared with the geojson: at-large ("00" / DC's
 *  delegate "98") renders as -01. */
function districtId(state: string, geoid: string): string {
  const num = parseInt(geoid.slice(2), 10);
  const display = num === 0 || num === 98 ? 1 : num;
  return `${state}-${String(display).padStart(2, '0')}`;
}

/** Party color convention: Democrats blue, Republicans red, others gray. */
function partyClass(party: string): string {
  if (party.startsWith('Democrat')) return 'text-blue-600';
  if (party.startsWith('Republican')) return 'text-red-600';
  return 'text-pe-gray-600';
}

function fmtUsd(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`;
}

interface GeoFeature {
  type: string;
  properties: Record<string, string | number>;
  geometry: GeoJSON.Geometry;
}

interface Props {
  state: string;
  districts: DistrictImpact[];
  year: number;
}

interface Hover {
  x: number;
  y: number;
  /** Container width at hover time (for tooltip edge-flipping) — captured
   *  in the event handler so render never reads the ref. */
  width: number;
  row: DistrictImpact;
}

export default function DistrictImpacts({ state, districts, year }: Props) {
  const [features, setFeatures] = useState<GeoFeature[] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/geojson/congressional_districts.geojson')
      .then((r) => r.json())
      .then((geo) => {
        const fips = STATE_FIPS[state];
        setFeatures(
          (geo.features as GeoFeature[]).filter(
            (f) => f.properties.STATEFP === fips,
          ),
        );
      })
      .catch(() => setGeoError(true));
  }, [state]);

  const byGeoid = useMemo(() => {
    const m: Record<string, DistrictImpact> = {};
    for (const d of districts) m[d.geoid] = m[d.geoid] ?? d;
    return m;
  }, [districts]);

  // DC's delegate district is geoid 1198 in the shapes but may be tagged
  // 1100 in the microdata (or vice versa) — bridge both.
  const rowForFeature = (f: GeoFeature): DistrictImpact | undefined => {
    const g = String(f.properties.GEOID);
    return byGeoid[g] ?? (g === '1198' ? byGeoid['1100'] : undefined);
  };

  const maxAbs = useMemo(
    () =>
      Math.max(
        1,
        ...districts.map((d) => Math.abs(d.average_household_gain)),
      ),
    [districts],
  );
  const color = useMemo(
    () =>
      scaleLinear<string>()
        .domain([-maxAbs, 0, maxAbs])
        .range([NEG, MID, POS])
        .clamp(true),
    [maxAbs],
  );

  const WIDTH = 860;
  const HEIGHT = 520;
  const paths = useMemo(() => {
    if (!features || features.length === 0) return null;
    const collection = {
      type: 'FeatureCollection',
      features,
    } as GeoJSON.FeatureCollection;
    const projection = geoAlbersUsa().fitExtent(
      [
        [12, 12],
        [WIDTH - 12, HEIGHT - 12],
      ],
      collection,
    );
    const path = geoPath(projection);
    return features.map((f) => ({
      feature: f,
      d: path(f as GeoJSON.Feature) ?? '',
    }));
  }, [features]);

  const onMove = (e: React.MouseEvent, row: DistrictImpact) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width,
      row,
    });
  };

  const sorted = [...districts].sort(
    (a, b) => a.district_number - b.district_number,
  );

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800">
          Average household impact by congressional district
        </h3>
        <p className="text-sm text-pe-gray-500 mb-4">
          Change in annual household net income under the reform ({year}),
          averaged within each of {state}&apos;s congressional districts
          (119th Congress boundaries). Hover a district for its
          representative and details.
        </p>
        {geoError ? (
          <p className="text-sm text-red-600">District map unavailable.</p>
        ) : !paths ? (
          <div className="flex items-center justify-center py-16 text-pe-gray-500 text-sm">
            Loading district map…
          </div>
        ) : (
          <div ref={wrapRef} className="relative">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full h-auto"
              role="img"
              aria-label={`Map of ${state} congressional districts colored by average household impact`}
            >
              {paths.map(({ feature, d }) => {
                const row = rowForFeature(feature);
                return (
                  <path
                    key={String(feature.properties.GEOID)}
                    d={d}
                    fill={row ? color(row.average_household_gain) : '#F1F5F9'}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                    className="transition-opacity hover:opacity-80 cursor-pointer"
                    onMouseMove={(e) => row && onMove(e, row)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </svg>
            {hover && <DistrictTooltip hover={hover} state={state} />}
            {/* Legend */}
            <div className="flex items-center gap-2 mt-2 text-xs text-pe-gray-500">
              <span>{fmtUsd(-maxAbs)}</span>
              <div
                className="h-2 w-40 rounded"
                style={{
                  background: `linear-gradient(to right, ${NEG}, ${MID}, ${POS})`,
                }}
              />
              <span>{fmtUsd(maxAbs)}</span>
              <span className="ml-2">average change per household</span>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">
          District detail
        </h3>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-pe-gray-500 border-b border-pe-gray-100">
              <th className="py-2 pr-4">District</th>
              <th className="py-2 pr-4">Representative</th>
              <th className="py-2 pr-4 text-right">Avg change</th>
              <th className="py-2 pr-4 text-right">% gaining</th>
              <th className="py-2 pr-4 text-right">Child poverty</th>
              <th className="py-2 text-right">Children lifted</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const id = districtId(state, d.geoid);
              const rep = REPS[id];
              return (
                <tr
                  key={d.geoid}
                  className="border-b border-pe-gray-50 last:border-0"
                >
                  <td className="py-2 pr-4 font-medium text-pe-gray-700">
                    {id}
                  </td>
                  <td className="py-2 pr-4">
                    {rep ? (
                      <span className={`font-medium ${partyClass(rep.party)}`}>
                        {rep.name} ({rep.party.charAt(0)})
                      </span>
                    ) : (
                      <span className="text-pe-gray-400">—</span>
                    )}
                  </td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${
                      d.average_household_gain > 0
                        ? 'text-pe-teal-600'
                        : d.average_household_gain < 0
                          ? 'text-red-600'
                          : 'text-pe-gray-500'
                    }`}
                  >
                    {fmtUsd(d.average_household_gain)}
                  </td>
                  <td className="py-2 pr-4 text-right text-pe-gray-600">
                    {d.percent_gaining.toFixed(1)}%
                  </td>
                  <td className="py-2 pr-4 text-right text-pe-gray-600">
                    {d.child_baseline_rate.toFixed(1)}% →{' '}
                    {d.child_reform_rate.toFixed(1)}%
                  </td>
                  <td className="py-2 text-right text-pe-gray-600">
                    {Math.round(d.children_lifted).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-pe-gray-400 mt-3">
          Representatives: 119th Congress. District estimates draw on
          roughly {Math.min(...sorted.map((d) => d.n_households)).toLocaleString()}
          &ndash;{Math.max(...sorted.map((d) => d.n_households)).toLocaleString()}{' '}
          sampled households per district; smaller districts carry more
          sampling uncertainty than statewide figures.
        </p>
      </div>
    </div>
  );
}

function DistrictTooltip({ hover, state }: { hover: Hover; state: string }) {
  const { row } = hover;
  const id = districtId(state, row.geoid);
  const rep = REPS[id];
  const flipLeft = hover.x > hover.width - 240;
  return (
    <div
      className="absolute z-10 pointer-events-none bg-white border border-pe-gray-200 rounded-lg shadow-lg p-3 text-sm w-56"
      style={{
        left: flipLeft ? hover.x - 236 : hover.x + 12,
        top: hover.y + 12,
      }}
    >
      <div className="font-semibold text-pe-gray-800">{id}</div>
      {rep && (
        <div className={`text-xs mb-1 font-medium ${partyClass(rep.party)}`}>
          {rep.name} ({rep.party.charAt(0)})
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-pe-gray-500">Avg change</span>
        <span className="font-medium">{fmtUsd(row.average_household_gain)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-pe-gray-500">% gaining</span>
        <span>{row.percent_gaining.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-pe-gray-500">Child poverty</span>
        <span>
          {row.child_baseline_rate.toFixed(1)}% →{' '}
          {row.child_reform_rate.toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-pe-gray-500">Children lifted</span>
        <span>{Math.round(row.children_lifted).toLocaleString()}</span>
      </div>
    </div>
  );
}
