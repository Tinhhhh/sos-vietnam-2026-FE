import { INCIDENT_SUGGESTIONS } from '../data/incident-suggestions';
import styles from './incident-chips.module.css';

/** Quick-pick incident tags for the chosen force (multi-select). */
export function IncidentChips({ agencyId, selected, onToggle }) {
  const suggestions = INCIDENT_SUGGESTIONS[agencyId] || [];

  return (
    <div className={styles.incidentChipsContainer}>
      {suggestions.map((label) => {
        const active = selected.includes(label);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            className={`${styles.incidentChip}${active ? ` ${styles.isActive}` : ''}`}
            style={{ fontFamily: 'inherit' }} // legacy used <div>; buttons don't inherit fonts
            onClick={() => onToggle(label)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
