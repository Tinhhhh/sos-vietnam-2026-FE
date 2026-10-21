// Same rule as the command map: "TP. Cần Thơ" / "Thành phố Cần Thơ" / "Cần Thơ" are one province
function normalizeProvinceName(name) {
  return (name || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/^(thành phố|tp\.?|tỉnh)\s*/u, '')
    .trim();
}

/** Agency that handles each emergency type (BE EmergencyType.agency). */
export const AGENCY_BY_TYPE = { POLICE: 'police', TRAFFIC: 'csgt', FIRE: 'fire', AMBULANCE: 'hospital' };

export const STATION_ICON = {
  police: '/assets/iconcongan.png',
  csgt: '/assets/icons/logo-csgt.png',
  fire: '/assets/icons/logo-pccc.png',
  hospital: '/assets/icons/logo-medical.png',
};

const sameName = (a, b) =>
  (a || '').normalize('NFC').trim().toLowerCase() === (b || '').normalize('NFC').trim().toLowerCase();

/**
 * Which stations an officer may send out for this incident (step 1).
 *
 * - Ward police: only the police station(s) of their own ward; the nearest is picked for them.
 * - Province police / PCCC / CSGT (and admin): every station of that agency in the incident's
 *   province: the province HQ ("cơ sở hiện tại") plus the ward stations. Picking a ward station
 *   means handing the case to that unit (step 2, Uỷ quyền).
 *
 * @returns {{ mode: 'ward' | 'province', agency: string, stations: object[] }}
 */
export function originCandidates(officer, incident, stations) {
  const agency = officer.agency === 'all' ? AGENCY_BY_TYPE[incident.type] || 'police' : officer.agency;
  const provinceKey = normalizeProvinceName(
    officer.level === 'national' ? incident.province : officer.province,
  );
  const usable = stations.filter(
    (s) =>
      s.agency === agency &&
      s.level !== 'enterprise' &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      normalizeProvinceName(s.province) === provinceKey,
  );

  if (officer.level === 'ward') {
    const own = usable.filter((s) => s.level === 'ward' && sameName(s.ward, officer.ward));
    return { mode: 'ward', agency, stations: own };
  }
  return { mode: 'province', agency, stations: usable };
}

/** Choosing a ward station as a province (or admin) officer hands the case to that unit. */
export function needsDelegation(officer, station) {
  return officer.level !== 'ward' && station?.level === 'ward';
}
