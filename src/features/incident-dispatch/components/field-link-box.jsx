import { useState } from 'react';

import { useToast } from '@/components/ui/toast/toast-context';

import { issueFieldLink } from '../api/dispatch-api';
import styles from './field-link.module.css';

const TIME = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** zalo.me/<phone> opens the chat with that number (Zalo app on phones, Zalo Web / PC on computers). */
function zaloChatUrl(phone) {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  return digits.length >= 9 ? `https://zalo.me/${digits}` : null;
}

const zaloText = (incidentId, url) =>
  `[SOS Việt Nam] Ca ${incidentId}: mở link để xem ca, đường đi, gọi video và báo "Đã đến" (không cần đăng nhập): ${url}`;

/**
 * "Link cho người phụ trách hiện trường": the field officer has no login, so they get a link. "Tạo link" / "Cấp lại
 * mã" makes a new code (the old link stops working, also when the field officer changes) and returns it once. The BE
 * only texts that person that they were assigned: carriers hold or block SMS with links, so the link itself goes by
 * Zalo ("Zalo" copies a ready message and opens the chat with that phone; the officer pastes) or by copying.
 *
 * @param {{ incidentId: string, plan: object }} props  plan.fieldLinkIssuedAt = last issue time (null = none)
 */
export function FieldLinkBox({ incidentId, plan }) {
  const toast = useToast();
  const [link, setLink] = useState(null); // { url, issuedAt, name, sms } of the code made in this window
  const [busy, setBusy] = useState(false);
  const issuedAt = link?.issuedAt || plan.fieldLinkIssuedAt;
  const who = plan.tracker?.fullName;
  const zaloUrl = zaloChatUrl(plan.tracker?.phone);

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
      toast.show(`Đã báo SMS tới ${sms.phoneMasked}: bấm "Gửi qua Zalo" để gửi link`, { tone: 'success' });
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
        nhập).
      </p>
      {link?.sms && (
        <div className={link.sms.sent ? styles.smsOk : styles.smsErr} role="status">
          {link.sms.sent
            ? `✓ Đã báo SMS tới ${link.sms.phoneMasked} (có thể tới chậm vài phút). Gửi link qua Zalo.`
            : `SMS chưa gửi: ${link.sms.error || 'lỗi không rõ'}. Gửi link qua Zalo hoặc sao chép.`}
        </div>
      )}
      {link ? (
        <input className={styles.link} readOnly value={link.url} onFocus={(e) => e.target.select()} />
      ) : (
        issuedAt && (
          <div className={styles.note}>
            Đã cấp link lúc {TIME.format(issuedAt)}. Link chỉ hiện một lần: lỡ đóng thì bấm "Cấp lại" (link
            cũ hết hiệu lực).
          </div>
        )
      )}
      {/* "Sao chép", "Gửi qua Zalo" and "Cấp lại" side by side */}
      <div className={styles.actions}>
        {link && (
          <button type="button" className={styles.copy} onClick={() => copy(link.url)}>
            Sao chép
          </button>
        )}
        {link && (
          // a plain link (not window.open): no popup blocker, and phones hand it to the Zalo app.
          // Always shown: without a phone in the profile the click only says so.
          <a
            className={styles.zalo}
            href={zaloUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            title={
              zaloUrl
                ? `Mở Zalo với ${who || 'người phụ trách'} (tin nhắn đã được chép sẵn, chỉ cần dán và gửi)`
                : `${who || 'Người phụ trách'} chưa có số điện thoại trong hồ sơ`
            }
            onClick={(e) => {
              if (!zaloUrl) {
                e.preventDefault();
                toast.show(
                  `${who || 'Người phụ trách hiện trường'} chưa cung cấp số điện thoại: bấm "Sao chép" rồi gửi link cách khác`,
                  { tone: 'error', duration: 6000 },
                );
                return;
              }
              // started inside the click, before Zalo takes the focus
              navigator.clipboard
                ?.writeText(zaloText(incidentId, link.url))
                .then(() =>
                  toast.show('Đã chép tin nhắn kèm link: dán vào Zalo rồi bấm gửi', {
                    tone: 'success',
                    duration: 6000,
                  }),
                )
                .catch(() =>
                  toast.show('Không chép được tin: bấm "Sao chép" rồi dán vào Zalo', { tone: 'error' }),
                );
            }}
          >
            <span className={styles.longLabel}>Gửi qua Zalo</span>
            <span className={styles.shortLabel}>Zalo</span>
          </a>
        )}
        <button
          type="button"
          className={styles.issue}
          disabled={busy}
          onClick={issue}
          title={link || issuedAt ? 'Cấp lại mã & báo lại SMS (link cũ hết hiệu lực)' : undefined}
        >
          {busy ? (
            'Đang tạo...'
          ) : link || issuedAt ? (
            'Cấp lại'
          ) : (
            'Tạo link & báo SMS'
          )}
        </button>
      </div>
    </div>
  );
}
