import { AGENCIES } from '../data/agencies';
import styles from './agency-picker.module.css';

/** "1. Chọn lực lượng" — the 5 force cards with official logos. */
export function AgencyPicker({ value, onChange }) {
  return (
    <div
      className={styles.agencyCardsGrid}
      style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
      role="radiogroup"
      aria-label="Lực lượng cần hỗ trợ"
    >
      {AGENCIES.map((agency) => {
        const selected = agency.id === value;
        return (
          <button
            key={agency.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={[styles.agencyCard, styles[agency.cssClass], selected && styles.isSelected]
              .filter(Boolean)
              .join(' ')}
            style={{ fontFamily: 'inherit' }} // legacy used <div>; buttons don't inherit fonts
            onClick={() => onChange(agency.id)}
          >
            <img src={agency.logo} className={styles.agencyRealLogo} alt="" />
            <div className={styles.agencyTitle}>{agency.title}</div>
            <div className={styles.agencyDesc}>{agency.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
