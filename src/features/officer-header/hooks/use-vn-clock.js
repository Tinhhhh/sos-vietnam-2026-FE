import { useEffect, useState } from 'react';

const DAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const TZ = 'Asia/Ho_Chi_Minh';

function format(now) {
  const time = now.toLocaleTimeString('vi-VN', { timeZone: TZ, hour12: false });
  // Date parts in Vietnam time, whatever the device timezone is.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { time, date: `${DAYS[weekdayIndex]}, ${parts.day}/${parts.month}/${parts.year}` };
}

/** Live Vietnam clock, ticking every second. */
export function useVnClock() {
  const [value, setValue] = useState(() => format(new Date()));
  useEffect(() => {
    const id = setInterval(() => setValue(format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return value;
}
