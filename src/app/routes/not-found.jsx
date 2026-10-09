import { Link } from 'react-router';

import { paths } from '@/config/paths';

import styles from './status-screen.module.css';

export function NotFoundRoute() {
  return (
    <div className={styles.screen}>
      <div className={`${styles.card} liquid-glass`}>
        <div className={styles.eyebrow}>404</div>
        <h1 className={styles.title}>Không tìm thấy trang</h1>
        <Link className="btn-refresh-loc" to={paths.citizen.home.getHref()}>
          ← Về trang chủ SOS
        </Link>
      </div>
    </div>
  );
}
