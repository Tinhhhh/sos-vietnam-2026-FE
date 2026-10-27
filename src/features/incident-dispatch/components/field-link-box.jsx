import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { issueFieldLink } from '../api/dispatch-api';
import styles from './field-link.module.css';

const TIME = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * "Link cho người phụ trách hiện trường": the field officer has no login, so the officer sends them a link
 * (Zalo... until SMS exists). The BE returns the code only once: "Tạo link" / "Cấp lại mã" makes a new one and the
 * old link stops working (also when the field officer changes).
 *
 * @param {{ incidentId: string, plan: object }} props  plan.fieldLinkIssuedAt = last issue time (null = none)
 */
export function FieldLinkBox({ incidentId, plan }) {
  const toast = useToast();
  const [link, setLink] = useState(null); // { url, issuedAt, name } of the code made in this window
  const [busy, setBusy] = useState(false);
  const issuedAt = link?.issuedAt || plan.fieldLinkIssuedAt;
  const who = plan.tracker?.fullName;

  const issue = async () => {
    setBusy(true);
    try {
      const res = await issueFieldLink(incidentId);
      const url = `${window.location.origin}${res.path}`;
      setLink({ url, issuedAt: res.issuedAt, name: res.fieldMember?.fullName });
      await copy(url, false);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url, say = true) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show(say ? 'Đã sao chép link' : 'Đã tạo và sao chép link: gửi cho người phụ trách hiện trường', {
        tone: 'success',
      });
    } catch {
      if (say) toast.show('Không sao chép được, hãy bôi đen link để chép', { tone: 'error' });
    }
  };

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <span className={styles.title}>Link cho người phụ trách hiện trường</span>
        {who && <span className={styles.who}>{who}</span>}
      </div>
      <p className={styles.hint}>
        Người phụ trách mở link trên điện thoại để xem ca, đường đi, gọi video và báo "Đã đến" (không cần đăng
        nhập). Chưa có SMS: sao chép rồi gửi qua Zalo / tin nhắn.
      </p>
      {link ? (
        <div className={styles.linkRow}>
          <input className={styles.link} readOnly value={link.url} onFocus={(e) => e.target.select()} />
          <button type="button" className={styles.copy} onClick={() => copy(link.url)}>
            Sao chép
          </button>
        </div>
      ) : (
        issuedAt && (
          <div className={styles.note}>
            Đã cấp link lúc {TIME.format(issuedAt)}. Link chỉ hiện một lần: lỡ đóng thì bấm "Cấp lại mã" (link
            cũ hết hiệu lực).
          </div>
        )
      )}
      <button type="button" className={styles.issue} disabled={busy} onClick={issue}>
        {busy ? 'Đang tạo...' : link || issuedAt ? 'Cấp lại mã' : 'Tạo link'}
      </button>
    </div>
  );
}
