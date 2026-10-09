/**
 * The 5 forces a citizen can call. Police, traffic police and fire submit an
 * SOS (`emergencyType` maps to the be-v2 enum); traffic rescue and ambulance
 * open a directory of nearby services instead, as in legacy.
 */
export const AGENCIES = [
  {
    id: 'police',
    cssClass: 'police',
    title: 'Công an',
    desc: 'An ninh trật tự địa bàn',
    logo: '/assets/icons/logo-bocongan.png',
    emergencyType: 'POLICE',
  },
  {
    id: 'csgt',
    cssClass: 'csgt',
    title: 'CSGT',
    desc: 'Tai nạn / Va chạm xe',
    logo: '/assets/icons/logo-csgt.png',
    emergencyType: 'TRAFFIC',
  },
  {
    id: 'fire',
    cssClass: 'fire',
    title: 'PCCC & CNCH',
    desc: 'Cháy nổ / Sập đổ / Đuối nước',
    logo: '/assets/icons/logo-pccc.png',
    emergencyType: 'FIRE',
  },
  {
    id: 'traffic-rescue',
    cssClass: 'trafficRescue',
    title: 'Dịch vụ Cứu hộ',
    desc: 'Cứu hộ xe / Kéo xe / Sửa chữa',
    logo: '/assets/icons/logo-traffic-rescue.png',
    directory: 'enterprises',
  },
  {
    id: 'hospital',
    cssClass: 'hospital',
    title: 'Cấp cứu',
    desc: 'Cấp cứu y tế người bệnh',
    logo: '/assets/icons/logo-medical.png',
    directory: 'hospitals',
  },
];

export const DEFAULT_AGENCY_ID = 'police';

export const findAgency = (id) => AGENCIES.find((a) => a.id === id) || AGENCIES[0];
