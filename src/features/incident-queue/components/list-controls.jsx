import { useState } from 'react';

import { RANGE_OPTIONS } from '../utils/list-paging';
import styles from './list-controls.module.css';

/**
 * Time range tabs: last 1 / 7 / 30 days, plus "Tất cả" when `allowAll`.
 * @param {{ value: number|null, onChange: (days: number|null) => void, allowAll?: boolean }} props
 */
export function RangeTabs({ value, onChange, allowAll = false }) {
  const options = allowAll ? [{ days: null, label: 'Tất cả' }, ...RANGE_OPTIONS] : RANGE_OPTIONS;
  return (
    <div className={styles.range} role="radiogroup" aria-label="Khoảng thời gian">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={value === o.days}
          className={value === o.days ? styles.rangeOn : styles.rangeBtn}
          onClick={() => onChange(o.days)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Previous / next page and "jump to page".
 * @param {{ page: number, totalPages: number, total: number, onPage: (page: number) => void, disabled?: boolean }} props
 *   page is 0-based; the UI shows it 1-based.
 */
export function Pager({ page, totalPages, total, onPage, disabled = false }) {
  const pages = Math.max(1, totalPages);
  return (
    <div className={styles.pager}>
      <span className={styles.total}>{total} ca</span>
      <div className={styles.pagerNav}>
        <button
          type="button"
          className={styles.pageBtn}
          aria-label="Trang trước"
          disabled={disabled || page <= 0}
          onClick={() => onPage(page - 1)}
        >
          ‹
        </button>
        {/* keyed by page: the box shows the current page again after every page change */}
        <JumpToPage key={page} page={page} pages={pages} disabled={disabled} onPage={onPage} />
        <button
          type="button"
          className={styles.pageBtn}
          aria-label="Trang sau"
          disabled={disabled || page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

function JumpToPage({ page, pages, disabled, onPage }) {
  const [draft, setDraft] = useState(String(page + 1));

  const jump = (e) => {
    e.preventDefault();
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1 || n > pages) {
      setDraft(String(page + 1));
      return;
    }
    if (n - 1 !== page) onPage(n - 1);
  };

  return (
    <form className={styles.jump} onSubmit={jump}>
      <span>Trang</span>
      <input
        className={styles.jumpInput}
        inputMode="numeric"
        aria-label="Nhảy đến trang"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={jump}
      />
      <span>/ {pages}</span>
    </form>
  );
}
