import { useState } from 'react';

import styles from './legal-warning-card.module.css';

const LEGAL_ITEMS = [
  {
    bullet: '⚖️',
    title: 'Xử phạt hành chính từ 4.000.000đ — 6.000.000đ:',
    body: (
      <>
        Áp dụng đối với mọi hành vi cố ý báo tin giả, gọi khẩn cấp sai sự thật, trêu đùa hoặc quấy rối đường
        dây cứu hộ theo <em>Khoản 3, Điều 7, Nghị định 144/2021/NĐ-CP</em>.
      </>
    ),
  },
  {
    bullet: '🚨',
    title: 'Truy cứu trách nhiệm hình sự:',
    body: 'Các hành vi giả mạo gây hậu quả nghiêm trọng, cản trở phương tiện thi hành công vụ hoặc làm thiệt hại tài sản, tính mạng sẽ bị truy cứu theo Bộ luật Hình sự.',
  },
  {
    bullet: '📡',
    title: 'Định danh số tự động:',
    body: 'Hệ thống tự động ghi nhận địa chỉ IP mạng, số định danh thiết bị, tọa độ GPS vệ tinh thời gian thực và lưu trữ dữ liệu truyền tin phục vụ công tác xác minh của Cơ quan Công an.',
  },
];

/** Collapsible Decree 144/2021 warning under the SOS orb. */
export function LegalWarningCard() {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((v) => !v);

  // Collapsed: a tap anywhere expands. Expanded: only the header collapses it,
  // so reading/selecting the body text does not close the card.
  const handleClick = (e) => {
    if (!expanded || e.target.closest('[data-legal-toggle]')) toggle();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      className={`${styles.legalWarningCard} liquid-glass-amber${expanded ? ` ${styles.expanded}` : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      title="Nhấn để xem đầy đủ điều khoản Nghị định 144/2021/NĐ-CP"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.legalCardHeader} data-legal-toggle>
        <div className={styles.legalShieldBadge}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <path d="M12 8v5M12 16h.01" stroke="#fef3c7" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className={styles.legalHeaderText}>
          <div className={styles.legalTitle}>
            <span>CẢNH BÁO CHẾ TÀI PHÁP LÝ KHẨN CẤP</span>
            <span className={styles.legalSummaryInline}>
              • Phạt 4-6 triệu VNĐ &amp; xử lý hình sự (NĐ 144)
            </span>
          </div>
          <div className={styles.legalSubtitle}>
            Căn cứ Nghị định số 144/2021/NĐ-CP của Chính phủ &amp; Bộ luật Hình sự
          </div>
        </div>
        <button
          type="button"
          className={styles.legalToggleBtn}
          aria-label="Xem chi tiết điều khoản"
          tabIndex={-1}
        >
          <span className={styles.legalToggleLabel}>Chi tiết</span>
          <svg
            className={styles.legalChevron}
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <div className={styles.legalCardBody}>
        {LEGAL_ITEMS.map((item) => (
          <div key={item.bullet} className={styles.legalItem}>
            <span className={styles.legalBullet}>{item.bullet}</span>
            <div className={styles.legalItemContent}>
              <strong>{item.title}</strong> {item.body}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.legalCardFooter}>
        <span className={styles.legalFooterIcon}>💡</span>
        <span>
          Vui lòng <strong>chỉ kích hoạt SOS</strong> trong tình huống thực sự nguy cấp đe dọa trực tiếp đến
          tính mạng, sức khỏe và an toàn trật tự.
        </span>
      </div>
    </div>
  );
}
