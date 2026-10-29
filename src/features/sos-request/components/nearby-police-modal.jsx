import { Modal } from '@/components/ui/modal/modal';

import { NearbyStations } from './nearby-stations';
import styles from './nearby-stations.module.css';

/**
 * "Công an gần nhất" (citizen dock): the 5 nearest police stations by GPS, like the hospitals of "Y tế",
 * with 113 for an emergency.
 *
 * @param {{ open: boolean, onClose: () => void, location: object }} props
 */
export function NearbyPoliceModal({ open, onClose, location }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      solid
      containerStyle={{ maxWidth: 460 }}
      title="Cơ quan công an gần nhất"
    >
      {open && <NearbyStations kind="POLICE" location={location} />}
      <a className={styles.callWide} href="tel:113">
        Khẩn cấp: gọi 113
      </a>
    </Modal>
  );
}
