import { CALL_ROLE_LABEL } from '@/hooks/use-call';

import styles from './call-switch-dialog.module.css';

/**
 * A second video call arrives while we are already talking (citizen, officer holding the case or field officer):
 * "<Người phụ trách hiện trường> muốn nối máy với bạn. Huỷ cuộc gọi hiện tại để nối máy?" Có = hang up and take the
 * new call, Không = the new caller hears "busy".
 *
 * @param {{ waiting: null | { from, peer: { name, unitName } }, onYes: () => void, onNo: () => void }} props
 */
export function CallSwitchDialog({ waiting, onYes, onNo }) {
  if (!waiting) return null;
  const role = CALL_ROLE_LABEL[waiting.from] || 'Một người';
  const who = waiting.peer?.name ? `${role} ${waiting.peer.name}` : role;
  return (
    <div className={styles.backdrop}>
      <div className={styles.box} role="alertdialog" aria-label="Có cuộc gọi khác muốn nối máy">
        <div className={styles.title}>{who} muốn nối máy với bạn</div>
        {waiting.peer?.unitName && <div className={styles.sub}>{waiting.peer.unitName}</div>}
        <p className={styles.text}>Huỷ cuộc gọi hiện tại để nối máy với người này?</p>
        <div className={styles.row}>
          <button type="button" className={styles.no} onClick={onNo}>
            Không
          </button>
          <button type="button" className={styles.yes} onClick={onYes}>
            Có, nối máy
          </button>
        </div>
      </div>
    </div>
  );
}
