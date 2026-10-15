/**
 * One station shape for the whole console, whatever the backend returns.
 *   { id, name, agency, level, province, ward, address, phone, lat, lng,
 *     officer, email, services, facilityType }
 * agency: police | mobile-police | csgt | fire | hospital | traffic-rescue
 * level:  province | ward | enterprise
 */
const AGENCY_BY_TYPE = {
  POLICE: 'police',
  MOBILE_POLICE: 'mobile-police',
  CSGT: 'csgt',
  FIRE: 'fire',
  HOSPITAL: 'hospital',
  TRAFFIC_RESCUE: 'traffic-rescue',
};

const PROVINCE_WIDE_WARDS = new Set(['toàn thành phố', 'toàn tỉnh']);
const WARD_UNIT_RE = /^(công an|ca) (xã|phường|thị trấn|đặc khu)\b/;
const PROVINCE_UNIT_KEYWORDS = ['công an tp.', 'công an tỉnh', 'công an thành phố', 'bộ chỉ huy'];

// Legacy map-controller.js isNonOperationalStation: units that never take SOS calls.
const NON_OPERATIONAL = [
  'bảo tàng công an',
  'báo an ninh thủ đô',
  'bệnh viện catp',
  'bệnh viện công an',
  'nhà khách',
  'nhà nghỉ dưỡng',
  'công ty tnhh',
  'trung tâm huấn luyện và bồi dưỡng',
  'trại tạm giam',
  'nhà tạm giữ',
  'cơ sở cai nghiện',
  'văn phòng cơ quan cảnh sát điều tra',
  'phòng cảnh sát kinh tế',
  'phòng cảnh sát điều tra tội phạm về tham nhũng',
  'phòng cảnh sát quản lý hành chính về trật tự xã hội',
  'phòng quản lý xuất nhập cảnh',
  'thanh tra catp',
  'thanh tra công an',
  'phòng cảnh sát hình sự',
  'phòng cảnh sát cơ động',
  'phòng cảnh sát điều tra tội phạm về ma túy',
  'phòng hồ sơ nghiệp vụ',
  'cơ sở đăng ký xe',
  'đội sát hạch',
  'đội chỉ huy giao thông và đèn tín hiệu',
];

/**
 * be-v2 does not store the unit level yet (the seed JSON has it). Until it does,
 * guess it from the name the way legacy did: ~98% right on the current data.
 */
function guessLevel(name, ward) {
  const n = name.toLowerCase();
  const w = (ward || '').trim().toLowerCase();
  if (!w || PROVINCE_WIDE_WARDS.has(w)) return 'province';
  if (WARD_UNIT_RE.test(n)) return 'ward';
  if (PROVINCE_UNIT_KEYWORDS.some((k) => n.includes(k)) && !n.includes('phường') && !n.includes('xã'))
    return 'province';
  return 'ward';
}

export function normalizeStation(raw) {
  const lat = Number(raw.latitude ?? raw.lat);
  const lng = Number(raw.longitude ?? raw.lng);
  if (!raw.name || !Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;

  const text = `${raw.name} ${raw.address || ''}`.toLowerCase();
  if (NON_OPERATIONAL.some((k) => text.includes(k))) return null;

  const level = raw.level ? String(raw.level).toLowerCase() : guessLevel(raw.name, raw.ward);
  if (level === 'national') return null;

  return {
    id: String(raw.id ?? raw.code ?? `${raw.name}_${lat}_${lng}`),
    name: raw.name,
    agency: AGENCY_BY_TYPE[raw.agency_type] || raw.agency || 'police',
    level,
    province: raw.province || '',
    ward: raw.ward || '',
    address: raw.address || '',
    phone: raw.phone || '',
    lat,
    lng,
    officer: raw.officer || null,
    email: raw.email || null,
    services: raw.services || null,
    facilityType: raw.facility_type || null,
  };
}

/** Officers only see stations of their own agency (legacy strict isolation). */
export function stationMatchesAgency(station, agency) {
  if (!agency || agency === 'all') return true;
  return station.agency === agency;
}
