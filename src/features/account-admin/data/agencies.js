// Mirrors be-v2 AgencyType.levels / levelLabel (create account form, account export filters)
export const AGENCIES = [
  {
    value: 'POLICE',
    label: 'Công an',
    levels: [
      ['WARD', 'Công an xã/phường'],
      ['PROVINCE', 'Công an tỉnh/TP'],
    ],
  },
  {
    value: 'CSGT',
    label: 'Cảnh sát giao thông',
    levels: [
      ['WARD', 'Cấp Đội'],
      ['PROVINCE', 'Cấp Phòng'],
    ],
  },
  {
    value: 'FIRE',
    label: 'Cảnh sát PCCC & CNCH',
    levels: [
      ['WARD', 'Cấp Đội'],
      ['PROVINCE', 'Cấp Phòng'],
    ],
  },
  { value: 'HOSPITAL', label: 'Y tế - Cấp cứu 115', levels: [['PROVINCE', 'Cấp Tỉnh/TP']] },
];
