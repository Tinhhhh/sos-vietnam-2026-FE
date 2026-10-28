import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { issueFieldLink } from '../api/dispatch-api';
import styles from './field-link.module.css';

const TIME = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * "Link cho người phụ trách hiện trường": the field officer has no login, so they get a link. "Tạo link" / "Cấp lại
 * mã" makes a new code (the old link stops working, also when the field officer changes), the BE texts it to the
 * phone in their profile and returns it once so it can also be copied (Zalo...) when the SMS did not go.
 *
 * @param {{ incidentId: string, plan: object }} props  plan.fieldLinkIssuedAt = last issue time (null = none)
 */
export function FieldLinkBox({ incidentId, plan }) {
  const toast = useToast();
  const [link, setLink] = useState(null); // { url, issuedAt, name, sms } of the code made in this window
  const [busy, setBusy] = useState(false);
  const issuedAt = link?.issuedAt || plan.fieldLinkIssuedAt;
  const who = plan.tracker?.fullName;

  const issue = async () => {
    setBusy(true);
    try {
      const res = await issueFieldLink(incidentId);
      const url = `${window.location.origin}${res.path}`;
      setLink({ url, issuedAt: res.issuedAt, name: res.fieldMember?.fullName, sms: res.sms });
      await copy(url, false, res.sms);
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url, say = true, sms = null) => {
    let copied = true;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      copied = false;
    }
    if (say) {
      toast.show(copied ? 'Đã sao chép link' : 'Không sao chép được, hãy bôi đen link để chép', {
        tone: copied ? 'success' : 'error',
      });
    } else if (sms?.sent) {
      toast.show(`Đã gửi SMS link tới ${sms.phoneMasked}`, { tone: 'success' });
    } else {
      toast.show(
        copied
          ? 'Đã tạo và sao chép link: gửi cho người phụ trách hiện trường'
          : 'Đã tạo link: bôi đen link để chép rồi gửi cho người phụ trách',
        { tone: 'success' },
      );
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
        nhập). Link được gửi SMS tới số trong hồ sơ; không nhận được thì sao chép gửi qua Zalo.
      </p>
      {link?.sms && (
        <div className={link.sms.sent ? styles.smsOk : styles.smsErr} role="status">
          {link.sms.sent
            ? `✓ Đã gửi SMS tới ${link.sms.phoneMasked} (tin tới sau vài giây)`
            : `SMS chưa gửi: ${link.sms.error || 'lỗi không rõ'}. Sao chép link để gửi.`}
        </div>
      )}
      {link ? (
        <input className={styles.link} readOnly value={link.url} onFocus={(e) => e.target.select()} />
      ) : (
        issuedAt && (
          <div className={styles.note}>
            Đã cấp link lúc {TIME.format(issuedAt)}. Link chỉ hiện một lần: lỡ đóng thì bấm "Cấp lại mã" (link
            cũ hết hiệu lực).
          </div>
        )
      )}
      {/* "Sao chép" and "Cấp lại" side by side; on phones the second is just "Cấp lại" */}
      <div className={styles.actions}>
        {link && (
          <button type="button" className={styles.copy} onClick={() => copy(link.url)}>
            Sao chép
          </button>
        )}
        <button
          type="button"
          className={styles.issue}
          disabled={busy}
          onClick={issue}
          title={link || issuedAt ? 'Cấp lại mã & gửi lại SMS (link cũ hết hiệu lực)' : undefined}
        >
          {busy ? (
            'Đang tạo...'
          ) : link || issuedAt ? (
            <>
              <span className={styles.longLabel}>Cấp lại mã & gửi lại SMS</span>
              <span className={styles.shortLabel}>Cấp lại</span>
            </>
          ) : (
            'Tạo link & gửi SMS'
          )}
        </button>
      </div>
    </div>
  );
}
