import { useCallback, useEffect, useRef, useState } from 'react';

import { getProvinceLabels, getProvinceShapes, getWardShapes } from '../api/geo';
import { bboxCenter, bboxOf, normalizeProvinceName } from '../utils/geo-math';

function indexProvinces(shapes, labels) {
  const labelByName = new Map(
    (labels?.features || []).map((f) => [normalizeProvinceName(f.properties.name), f.geometry.coordinates]),
  );
  return shapes.features.map((f) => {
    const name = f.properties.shapeName || f.properties.name;
    const bbox = bboxOf(f);
    return {
      name,
      key: normalizeProvinceName(name),
      feature: f,
      bbox,
      // Label point sits inside the province; bbox centre may not (coastal provinces).
      center: labelByName.get(normalizeProvinceName(name)) || bboxCenter(bbox),
    };
  });
}

function indexWards(shapes) {
  const byProvince = new Map();
  for (const f of shapes.features) {
    const key = normalizeProvinceName(f.properties.province);
    const bbox = bboxOf(f);
    const ward = {
      id: f.properties.id,
      name: f.properties.ward,
      province: f.properties.province,
      unitType: f.properties.unitType,
      feature: f,
      bbox,
      center: bboxCenter(bbox),
    };
    if (!byProvince.has(key)) byProvince.set(key, []);
    byProvince.get(key).push(ward);
  }
  return byProvince;
}

/**
 * Province polygons load with the map. Ward polygons (6 MB) load on first need:
 * zooming into a province, picking a ward or a ward officer's start view.
 */
export function useBoundaries() {
  const [provinces, setProvinces] = useState(null);
  const [wardsByProvince, setWardsByProvince] = useState(null);
  const wardsPromise = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getProvinceShapes(), getProvinceLabels()])
      .then(([shapes, labels]) => alive && setProvinces(indexProvinces(shapes, labels)))
      .catch((err) => console.warn('[command-map] provinces:', err));
    return () => {
      alive = false;
    };
  }, []);

  const ensureWards = useCallback(() => {
    if (!wardsPromise.current) {
      wardsPromise.current = getWardShapes()
        .then((shapes) => {
          const index = indexWards(shapes);
          setWardsByProvince(index);
          return index;
        })
        .catch((err) => {
          wardsPromise.current = null;
          throw err;
        });
    }
    return wardsPromise.current;
  }, []);

  return { provinces, wardsByProvince, ensureWards };
}
