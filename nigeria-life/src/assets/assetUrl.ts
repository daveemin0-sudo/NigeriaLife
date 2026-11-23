/**
 * Resolve a public-folder path against Vite's base URL.
 * GitHub Pages serves the game under `/NigeriaLife/`, so root-absolute
 * paths like `/models/...` would miss the base and 404.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const cleaned = path.replace(/^\/+/, '');
  return base.endsWith('/') ? `${base}${cleaned}` : `${base}/${cleaned}`;
}
