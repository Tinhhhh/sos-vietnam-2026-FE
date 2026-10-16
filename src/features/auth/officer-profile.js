/**
 * Officer profile — turns GET /api/v1/auth/me into what the officer console needs
 * (port of legacy DispatcherApp.applyOfficerProfile).
 *
 * Level comes from accounts.unit_level (NATIONAL | PROVINCE | WARD). Accounts created
 * before that column existed fall back to: ADMIN -> national, has a ward -> ward, else province.
 */

// be-v2 AgencyType -> legacy agency key (used for themes, station filters, labels).
const AGENCY_BY_TYPE = {
  POLICE: 'police',
  CSGT: 'csgt',
  FIRE: 'fire',
  HOSPITAL: 'hospital',
};

const THEME_BY_AGENCY = {
  police: 'theme-police',
  csgt: 'theme-csgt',
  fire: 'theme-rescue',
  hospital: 'theme-hospital',
  all: 'theme-admin',
};

const AGENCY_LABEL = {
  police: 'Công An',
  csgt: 'Cảnh Sát Giao Thông',
  fire: 'Cảnh Sát PCCC & CNCH',
  hospital: 'Cấp Cứu Y Tế 115',
};

const AGENCY_LOGO = {
  police: '/assets/icons/logo-bocongan.png',
  csgt: '/assets/icons/logo-csgt.png',
  fire: '/assets/icons/logo-pccc.png',
  hospital: '/assets/icons/logo-medical.png',
};

const STATIONS_TAB_TITLE = {
  police: 'Công An',
  csgt: 'CSGT',
  fire: 'PCCC',
  hospital: 'Trạm 115',
  all: 'Danh Bạ',
};

/**
 * @param {object|null} me data of GET /api/v1/auth/me
 */
export function buildOfficerProfile(me) {
  if (!me) return null;
  const isAdmin = me.role_name === 'ADMIN';
  const agency = isAdmin ? 'all' : AGENCY_BY_TYPE[me.agency_type] || 'police';
  const level = me.unit_level
    ? me.unit_level.toLowerCase()
    : isAdmin
      ? 'national'
      : me.ward
        ? 'ward'
        : 'province';
  const agencyLabel = AGENCY_LABEL[agency];

  let unitName;
  let unitSub;
  if (level === 'national') {
    unitName = 'TT. Chỉ Huy Tác Chiến Quốc Gia';
    unitSub = 'Bộ Công An · Cấp Quốc Gia';
  } else if (level === 'province') {
    unitName = `${agencyLabel} ${me.province || 'cấp Tỉnh'}`;
    unitSub = `${me.province || ''} (Trụ Sở Bộ Chỉ Huy)`;
  } else {
    unitName = `${agencyLabel} ${me.ward}`;
    unitSub = me.province ? `${me.province} · Trụ sở địa bàn` : me.address || 'Trụ sở đơn vị';
  }

  return {
    accountId: me.account_id,
    fullName: me.full_name || me.email,
    email: me.email,
    phone: me.phone,
    isAdmin,
    agency,
    level,
    province: me.province || null,
    ward: me.ward || null,
    theme: THEME_BY_AGENCY[agency],
    logo: isAdmin ? '/assets/icons/logo-admin-login.png' : AGENCY_LOGO[agency],
    brandTitle: isAdmin ? 'Trung Tâm Chỉ Huy Tác Chiến' : unitName,
    unitName,
    unitSub,
    stationsTabTitle: STATIONS_TAB_TITLE[agency],
  };
}
