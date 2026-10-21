import { Modal } from '@/components/ui/modal/modal';

import styles from './report-modal.module.css';

/**
 * Right after an officer closes an incident (step 4 "Kết thúc"): offer to write the report document now.
 *
 * @param {{ incidentId: string | null, onCreate: (id) => void, onLater: () => void }} props
 */
export function ReportPromptDialog({ incidentId, onCreate, onLater }) {
  return (
    <Modal
      open={!!incidentId}
      onClose={onLater}
      solid
      containerStyle={{ maxWidth: 440, width: 'min(440px, calc(100vw - 16px))' }}
      titleStyle={{ color: '#34d399' }}
      title="Ca đã kết thúc"
    >
      <div className={styles.prompt}>
        <div>
          Ca <b>{incidentId}</b> đã hoàn tất. Lập văn bản báo cáo (phiếu tiếp nhận &amp; ứng phó sự cố) ngay
          bây giờ? Bạn cũng có thể lập sau trong mục <b>Lịch sử sự cố</b>.
        </div>
        <div className={styles.promptActions}>
          <button type="button" className={styles.ghost} onClick={onLater}>
            Để sau
          </button>
          <button type="button" className={styles.primary} onClick={() => onCreate(incidentId)}>
            Lập văn bản báo cáo ngay
          </button>
        </div>
      </div>
    </Modal>
  );
}
