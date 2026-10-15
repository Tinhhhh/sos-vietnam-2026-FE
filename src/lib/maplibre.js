/**
 * MapLibre GL, preconfigured for Vite.
 *
 * MapLibre 6 starts its web worker from `new URL('./maplibre-gl-worker.mjs', import.meta.url)`,
 * and that worker imports a sibling chunk. Vite's dep pre-bundling (dev) and asset
 * copy (build) both break that path, so we let Vite bundle the worker itself and
 * hand MapLibre the resulting URL.
 */
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

export { LngLatBounds, Map, Marker, Popup } from 'maplibre-gl';
