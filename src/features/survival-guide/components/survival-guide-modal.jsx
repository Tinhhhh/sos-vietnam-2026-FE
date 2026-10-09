import { Modal } from '@/components/ui/modal/modal';

import { SURVIVAL_GUIDES } from '../data/survival-guides';
import styles from './survival-guide-modal.module.css';

/** Static disaster / fire / CPR / traffic survival checklists. */
export function SurvivalGuideModal({ open, onClose }) {
  const year = new Date().getFullYear();

  return (
    <Modal
      open={open}
      onClose={onClose}
      containerStyle={{ maxWidth: 620, maxHeight: '88vh' }}
      titleStyle={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 8 }}
      title={
        <>
          <svg className="svg-ico ico-lg ico-amber" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>{' '}
          CẨM NANG THOÁT HIỂM &amp; ỨNG PHÓ THIÊN TAI {year}
        </>
      }
    >
      <div className={styles.guideCardsList}>
        {SURVIVAL_GUIDES.map((guide) => (
          <div
            key={guide.id}
            className={`${styles.guideGlassCard} ${guide.glassClass} ${styles[guide.toneClass]}`}
          >
            <div className={styles.guideCardHeader}>
              <div
                className={styles.guideCardTitle}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg className={`svg-ico ico-md ${guide.iconClass}`} viewBox="0 0 24 24" aria-hidden="true">
                  {guide.icon}
                </svg>{' '}
                {guide.title}
              </div>
              <span className={styles.guidePillBadge}>{guide.badge}</span>
            </div>
            <ul className={styles.guideChecklist}>
              {guide.items.map(([label, text]) => (
                <li key={label}>
                  <b>{label}</b> {text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
