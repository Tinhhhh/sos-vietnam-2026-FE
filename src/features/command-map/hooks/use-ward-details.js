import { useCallback, useRef } from 'react';

import { getProvinces, getWardsOfProvince } from '../api/geo';
import { normalizeProvinceName } from '../utils/geo-math';

const cleanWardName = (s) => (s || '').normalize('NFC').toLowerCase().trim();

/**
 * Looks up be-v2 ward rows (sap_nhap_tu, ...) for the HUD. Province codes and
 * ward lists are fetched once and cached.
 */
export function useWardDetails() {
  const provinceCodes = useRef(null);
  const wardsByCode = useRef(new Map());

  return useCallback(async (provinceName, wardName) => {
    try {
      if (!provinceCodes.current) {
        provinceCodes.current = getProvinces().then(
          (list) => new Map(list.map((p) => [normalizeProvinceName(p.name), p.code])),
        );
      }
      const code = (await provinceCodes.current).get(normalizeProvinceName(provinceName));
      if (!code) return null;
      if (!wardsByCode.current.has(code)) wardsByCode.current.set(code, getWardsOfProvince(code));
      const wards = await wardsByCode.current.get(code);
      return wards.find((w) => cleanWardName(w.name) === cleanWardName(wardName)) || null;
    } catch {
      provinceCodes.current = null;
      return null;
    }
  }, []);
}
