/** The app's basePath (see next.config.js). Next auto-prefixes routing and
 *  next/image, but raw asset URLs, manual fetches of public/ files, and
 *  absolute share URLs must prefix it themselves. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
