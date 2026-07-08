import LZString from 'lz-string';

/** Deep-link codec for report configurations.
 *
 *  The full report config (states, year, reforms, parameter values,
 *  household) is compressed into a URL-safe string so a results page can be
 *  shared as a link. Recipients decode and recompute; the Modal result cache
 *  makes any config already run on the current build return instantly, so
 *  shared links populate without waiting on a fresh simulation.
 *
 *  The config is versioned (`v`) so the decoder can evolve without breaking
 *  older links. lz-string's EncodedURIComponent alphabet needs no further
 *  escaping, and keeps parameter-heavy configs comfortably inside URL
 *  length limits (~5:1 on JSON this shape).
 */

const SHARE_VERSION = 1;

/** Query parameter carrying the encoded config on /report/results. */
export const SHARE_PARAM = 'c';

export function encodeReportConfig(config: unknown): string {
  // lz-string's "URI component" alphabet still emits '+', which
  // URLSearchParams decodes as a space and silently corrupts the payload.
  // '.' is unreserved and unused by the alphabet, so swap it in.
  return LZString.compressToEncodedURIComponent(
    JSON.stringify({ v: SHARE_VERSION, config }),
  ).replace(/\+/g, '.');
}

export function decodeReportConfig<T = unknown>(encoded: string): T | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(
      encoded.replace(/\./g, '+'),
    );
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !('config' in parsed)) {
      return null;
    }
    return (parsed as { config: T }).config ?? null;
  } catch {
    return null;
  }
}

/** Absolute share URL for a config, built from the current origin. */
export function shareUrl(config: unknown): string {
  const encoded = encodeReportConfig(config);
  return `${window.location.origin}/report/results?${SHARE_PARAM}=${encoded}`;
}
