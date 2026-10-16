/** Agency colours/labels and pie-slice builders for the statistics charts. */

export const AGENCY_LOOK = {
  police: { label: 'Công an', color: '#38bdf8' },
  csgt: { label: 'CSGT', color: '#fbbf24' },
  fire: { label: 'PCCC & CNCH', color: '#f87171' },
  hospital: { label: 'Y tế', color: '#34d399' },
};

/** Pie items: areas (wards for a province, provinces for the nation). */
export function areaSlices(byArea) {
  return byArea.map((a) => ({ key: a.name, name: a.name, value: a.total }));
}

/** Pie items: forces, in their console colours. */
export function agencySlices(byAgency) {
  return byAgency.map((a) => ({
    key: a.agency,
    name: AGENCY_LOOK[a.agency]?.label || a.agency,
    value: a.total,
    color: AGENCY_LOOK[a.agency]?.color,
  }));
}
