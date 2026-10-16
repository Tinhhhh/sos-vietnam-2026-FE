import { Link } from 'react-router';

import { paths } from '@/config/paths';

import styles from '../status-screen.module.css';

/** Temporary page until the dispatcher portal modules land. */
export function DispatcherPlaceholderRoute() {
  return (
    <div className={styles.screen}>
      <div className={`${styles.card} liquid-glass`}>
        <div className={styles.eyebrow}>CỔNG CÁN BỘ</div>
        <h1 className={styles.title}>Đang được chuyển sang React</h1>
        <p className={styles.text}>
          Đăng nhập cán bộ, bàn tác chiến và bản đồ số sẽ được làm ở các module tiếp theo.
        </p>
        <Link className="btn-refresh-loc" to={paths.citizen.home.getHref()}>
          ← Về cổng người dân
        </Link>
      </div>
    </div>
  );
}
