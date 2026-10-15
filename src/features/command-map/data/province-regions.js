/** Region tabs of the province popover (legacy STATIC_34_PROVINCES in dispatcher.js). */
export const PROVINCE_REGION = {
  'Hà Nội': 'city',
  'TP. Hồ Chí Minh': 'city',
  'Cần Thơ': 'city',
  'Đà Nẵng': 'city',
  'Hải Phòng': 'city',
  Huế: 'city',
  'An Giang': 'south',
  'Bắc Ninh': 'north',
  'Cà Mau': 'south',
  'Cao Bằng': 'north',
  'Đắk Lắk': 'south',
  'Điện Biên': 'north',
  'Đồng Nai': 'south',
  'Đồng Tháp': 'south',
  'Gia Lai': 'south',
  'Hà Tĩnh': 'central',
  'Hưng Yên': 'north',
  'Khánh Hòa': 'central',
  'Lai Châu': 'north',
  'Lâm Đồng': 'south',
  'Lạng Sơn': 'north',
  'Lào Cai': 'north',
  'Nghệ An': 'central',
  'Ninh Bình': 'central',
  'Phú Thọ': 'north',
  'Quảng Ngãi': 'central',
  'Quảng Ninh': 'north',
  'Quảng Trị': 'central',
  'Sơn La': 'north',
  'Tây Ninh': 'south',
  'Thái Nguyên': 'north',
  'Thanh Hóa': 'central',
  'Tuyên Quang': 'north',
  'Vĩnh Long': 'south',
};

export const REGION_TABS = [
  { key: 'all', label: 'Tất Cả' },
  { key: 'city', label: 'Đô Thị TT' },
  { key: 'north', label: 'Miền Bắc' },
  { key: 'central', label: 'Miền Trung' },
  { key: 'south', label: 'Miền Nam' },
];

export function provinceIcon(name) {
  if (name === 'Hà Nội') return '🏛️';
  if (name === 'TP. Hồ Chí Minh') return '🏙️';
  if (name === 'Cần Thơ') return '🌊';
  if (name === 'Đà Nẵng') return '🏖️';
  if (name === 'Hải Phòng') return '⚓';
  if (name === 'Huế') return '🌸';
  if (['Khánh Hòa', 'Quảng Ninh'].includes(name)) return '🏝️';
  if (['Lâm Đồng', 'Đắk Lắk', 'Gia Lai'].includes(name)) return '🌲';
  return '📍';
}
