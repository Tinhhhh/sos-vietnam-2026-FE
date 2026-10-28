/** Avatar letters of an officer: first + last word ("Đỗ Đức Khang" -> "ĐK"), "CB" without a name. */
export function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'CB';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}
