import styles from './sos-request-form.module.css';

/**
 * Shown instead of the SOS form for "Dịch vụ cứu hộ" and "Cấp cứu".
 * Legacy listed nearby rescue companies / hospitals here; that directory
 * (and its be-v2 API) is module 5, so for now it explains and offers 115.
 */
export function ServiceDirectoryNotice({ directory }) {
  if (directory === 'hospitals') {
    return (
      <div className={styles.serviceSectionHospital}>
        <div className={styles.serviceHeader}>
          <div className={styles.serviceTitleHospital}>
            <img src="/assets/icons/logo-medical.png" className={styles.serviceLogo} alt="" />
            TRẠM CẤP CỨU 115 &amp; BỆNH VIỆN (GẦN NHẤT)
          </div>
          <span className={styles.serviceBadgeHospital}>DỊCH VỤ CÔNG</span>
        </div>
        <p className={styles.serviceText}>
          Danh sách trạm 115 và bệnh viện gần vị trí của bạn sẽ hiển thị ở đây (Module 5). Trong lúc chờ, hãy
          gọi trực tiếp Cấp cứu 115.
        </p>
        <a className={styles.serviceCall} href="tel:115">
          <svg className="svg-ico ico-md ico-white" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          GỌI CẤP CỨU 115
        </a>
      </div>
    );
  }

  return (
    <div className={styles.serviceSectionRescue}>
      <div className={styles.serviceHeader}>
        <div className={styles.serviceTitleRescue}>
          <svg className="svg-ico ico-md ico-amber" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
          DOANH NGHIỆP CỨU HỘ XE ĐÃ ĐĂNG KÝ (TOP 5★ &amp; GẦN NHẤT)
        </div>
        <span className={styles.serviceBadgeRescue}>DỊCH VỤ CÔNG</span>
      </div>
      <p className={styles.serviceText}>
        Danh sách doanh nghiệp cứu hộ xe gần bạn (gọi trực tiếp, xem chi tiết, đánh giá) sẽ hiển thị ở đây
        (Module 5).
      </p>
    </div>
  );
}
