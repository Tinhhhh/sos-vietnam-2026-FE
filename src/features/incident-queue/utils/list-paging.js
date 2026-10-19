/** Time ranges of the queue / history windows (last N days). */
export const RANGE_OPTIONS = [
  { days: 1, label: '1 ngày' },
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
];

/** Page size of the queue and history windows (about 4 cards fit). */
export const PAGE_SIZE = 4;

/** Small "Chi tiết" button on queue / history cards. */
export const DETAIL_BUTTON_STYLE = {
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 9px',
  borderRadius: 6,
  border: '1px solid rgba(56, 189, 248, 0.55)',
  background: 'rgba(14, 165, 233, 0.12)',
  color: '#7dd3fc',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};
