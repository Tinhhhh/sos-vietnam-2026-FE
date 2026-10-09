import { isRouteErrorResponse, useRouteError } from 'react-router';

import styles from './status-screen.module.css';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error?.message;

  return (
    <div className={styles.screen}>
      <div className={`${styles.card} liquid-glass`} role="alert">
        <div className={styles.eyebrow}>LỖI GIAO DIỆN</div>
        <h1 className={styles.title}>Đã xảy ra lỗi</h1>
        {detail && <p className={styles.text}>{detail}</p>}
        <button type="button" className="btn-refresh-loc" onClick={() => window.location.reload()}>
          Tải lại trang
        </button>
      </div>
    </div>
  );
}
