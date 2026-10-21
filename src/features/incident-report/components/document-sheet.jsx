import styles from './document-sheet.module.css';

const TARGETS = ['Người dân', 'Nhân viên cơ sở', 'Lực lượng ứng phó'];
const TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const fmt = (d) => (d ? TIME.format(d) : '');

/**
 * The report sheet ("Phiếu thông báo và tiếp nhận thông tin ứng phó sự cố khẩn cấp"), legacy layout:
 * header (Nghị định 30), A. đơn vị tiếp nhận, B. người báo + hiện trường, legal notice, 2 signature boxes.
 * editable: every field is an inline input (officer); otherwise plain text (citizen, signed document).
 *
 * @param {{ doc: object, fields: object, editable: boolean, onChange?: (key, value) => void,
 *           officerAction?: React.ReactNode, citizenAction?: React.ReactNode }} props
 *   officerAction / citizenAction: buttons under each signature box (sign, sign for the citizen...)
 */
export function DocumentSheet({ doc, fields, editable, onChange, officerAction, citizenAction }) {
  const f = fields;
  const text = (key, { wide, center, placeholder, bold } = {}) =>
    editable ? (
      <input
        className={`${styles.input} ${wide ? styles.wide : ''} ${center ? styles.center : ''}`}
        style={bold ? { fontWeight: 'bold' } : undefined}
        value={f[key] ?? ''}
        placeholder={placeholder || 'Nhấn để điền...'}
        onChange={(e) => onChange(key, e.target.value)}
      />
    ) : (
      <span className={styles.value} style={bold ? { fontWeight: 'bold' } : undefined}>
        {f[key] || '…'}
      </span>
    );
  const area = (key, rows = 2, placeholder) =>
    editable ? (
      <textarea
        className={styles.textarea}
        rows={rows}
        value={f[key] ?? ''}
        placeholder={placeholder || 'Nhấn để điền...'}
        onChange={(e) => onChange(key, e.target.value)}
      />
    ) : (
      <div className={styles.value} style={{ whiteSpace: 'pre-wrap' }}>
        {f[key] || '…'}
      </div>
    );
  const yesNo = (key) =>
    !editable ? (
      <span className={styles.choices}>
        <span>
          <span className={styles.mark}>{f[key] === true ? '☒' : '☐'}</span> Có
        </span>
        <span>
          <span className={styles.mark}>{f[key] === false ? '☒' : '☐'}</span> Không
        </span>
      </span>
    ) : (
      <span className={styles.choices}>
        {[
          [true, 'Có'],
          [false, 'Không'],
        ].map(([v, label]) => (
          <label key={label}>
            <input
              type="radio"
              name={`${doc.incidentId}-${key}`}
              checked={f[key] === v}
              disabled={!editable}
              onChange={() => onChange(key, v)}
            />
            {label}
          </label>
        ))}
      </span>
    );
  const signedBoth = !!doc.officerSignature && !!doc.citizenSignature;
  const gmaps =
    doc.lat != null && doc.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${doc.lat},${doc.lng}`
      : null;

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <div className={styles.headLeft}>
          <div className={styles.upper}>{text('header_upper', { center: true })}</div>
          <div className={styles.lower}>{text('header_lower', { center: true, bold: true })}</div>
          <div className={styles.rule} style={{ width: 70 }} />
          <div>Số: {doc.docNumber}</div>
        </div>
        <div className={styles.headRight}>
          <div className={styles.nation}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className={styles.motto}>Độc lập - Tự do - Hạnh phúc</div>
          <div className={styles.rule} style={{ width: 140 }} />
          <div className={styles.placeDate}>{text('place_date', { center: true })}</div>
        </div>
      </div>

      <div className={styles.title}>
        <div className={styles.titleText}>Phiếu thông báo và tiếp nhận thông tin</div>
        <div className={styles.titleText}>Ứng phó sự cố khẩn cấp</div>
        <div className={styles.subtitle}>
          Mã tiếp nhận: <b>{doc.incidentId}</b> | Thời gian: {f.incident_time || '…'}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>A. Thông tin chung (đơn vị tiếp nhận)</div>
        <div className={styles.line}>
          <b>- Họ tên cán bộ tiếp nhận:</b> {text('officer_name', { bold: true })}
        </div>
        <div className={styles.line}>
          <b>- Chức vụ:</b> {text('officer_title')}
        </div>
        <div className={styles.line}>
          <b>- Đơn vị tiếp nhận:</b> {text('unit_name')}
        </div>
        <div className={styles.line}>
          <b>- Địa chỉ cơ quan / Trụ sở:</b> {text('unit_address')}
        </div>
        <div className={styles.line}>
          <b>- Số điện thoại liên hệ của đơn vị:</b> {text('unit_phone', { placeholder: 'Chưa cập nhật' })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>B. Thông tin đến (người báo &amp; hiện trường sự cố)</div>
        <div className={styles.line}>
          <b>- Tên người gọi / người báo:</b> {text('reporter_name', { bold: true })}
        </div>
        <div className={styles.line}>
          <b>- Đối tượng:</b>
          <span className={styles.choices}>
            {TARGETS.map((t) =>
              !editable ? (
                <span key={t}>
                  <span className={styles.mark}>{f.target_type === t ? '☒' : '☐'}</span> {t}
                </span>
              ) : (
                <label key={t}>
                  <input
                    type="radio"
                    name={`${doc.incidentId}-target`}
                    checked={f.target_type === t}
                    disabled={!editable}
                    onChange={() => onChange('target_type', t)}
                  />
                  {t}
                </label>
              ),
            )}
          </span>
        </div>
        <div className={styles.line}>
          <b>- Số điện thoại người gọi:</b> {text('reporter_phone')}
        </div>
        <div className={styles.line}>
          <b>- Giờ tiếp nhận tin:</b> {text('incident_time')}
        </div>
        <div className={styles.line}>
          <b>- Vị trí xảy ra sự cố:</b>
          {text('incident_address', { wide: true, bold: true })}
        </div>
        {(editable || f.coordinates) && (
          <div className={styles.line}>
            <b>- Tọa độ GPS:</b> {text('coordinates')}{' '}
            {gmaps && (
              <a className={styles.link} href={gmaps} target="_blank" rel="noopener noreferrer">
                Xem trên Google Maps ↗
              </a>
            )}
          </div>
        )}
        <div className={styles.line}>
          <b>- Loại sự cố &amp; mô tả chi tiết hiện trường:</b>
          {area('description', 3)}
        </div>
        <div className={styles.line}>
          <b>- Có ảnh hưởng tới người dân:</b> {yesNo('affects_citizens')}
          <span style={{ marginLeft: 24 }}>
            <b>- Yêu cầu trợ giúp:</b> {yesNo('needs_help')}
          </span>
        </div>
        <div className={styles.line}>
          <b>- Yêu cầu trợ giúp cụ thể / lực lượng điều động:</b>
          {area('help_request', 2)}
        </div>
        <div className={styles.line}>
          <b>- Lời khuyên / khuyến cáo đã hướng dẫn người dân:</b>
          {area('advice_given', 2, 'Ví dụ: giữ bình tĩnh, di chuyển tới nơi an toàn, giữ liên lạc...')}
        </div>
        <div className={styles.line}>
          <b>- Kết quả xử lý:</b>
          {area('resolution_result', 3)}
        </div>
      </div>

      <div className={signedBoth ? styles.noticeOk : styles.notice}>
        <span>
          {signedBoth ? (
            <>
              <b>VĂN BẢN ĐÃ ĐỦ CHỮ KÝ 2 BÊN:</b> văn bản có hiệu lực và không sửa được nữa.
            </>
          ) : (
            <>
              <b>VĂN BẢN CHƯA ĐỦ CHỮ KÝ 2 BÊN:</b> cần chữ ký của người dân (hoặc cán bộ ký hộ khi được uỷ
              quyền) và của cán bộ tiếp nhận. Sửa nội dung sau khi đã ký sẽ xoá chữ ký đã có.
            </>
          )}
        </span>
        <span className={styles.badge}>{signedBoth ? 'CÓ HIỆU LỰC' : 'CHƯA CÓ HIỆU LỰC'}</span>
      </div>

      <div className={styles.signatures}>
        <SignatureBox
          role="Người báo tin / người dân"
          hint="(Ký, ghi rõ họ tên)"
          signature={doc.citizenSignature}
          fallbackName={f.reporter_name}
          emptyText="Chưa có chữ ký người dân"
          action={citizenAction}
        />
        <SignatureBox
          role="Cán bộ / chỉ huy tiếp nhận"
          hint="(Ký, đóng dấu và ghi rõ họ tên)"
          signature={doc.officerSignature}
          fallbackName={f.officer_name}
          emptyText="Chờ cán bộ ký xác nhận"
          action={officerAction}
        />
      </div>
    </div>
  );
}

function SignatureBox({ role, hint, signature, fallbackName, emptyText, action }) {
  return (
    <div className={styles.sigBox}>
      <div className={styles.sigRole}>{role}</div>
      <div className={styles.sigHint}>{hint}</div>
      <div className={styles.sigArea}>
        {!signature ? (
          <span className={styles.sigEmpty}>{emptyText}</span>
        ) : signature.type === 'DRAW' && signature.image ? (
          <img className={styles.sigImg} src={signature.image} alt={`Chữ ký ${signature.name}`} />
        ) : (
          <span className={styles.sigTyped}>{signature.name}</span>
        )}
      </div>
      <div className={styles.sigName}>{signature?.name || fallbackName || '…'}</div>
      {signature && <div className={styles.sigMeta}>Ký lúc {fmt(signature.signedAt)}</div>}
      {signature?.channel === 'OFFICER_PROXY' && (
        <div className={styles.sigMeta}>
          Cán bộ {signature.signedByName || ''} ký hộ · Lý do: {signature.proxyReason}
        </div>
      )}
      {action}
    </div>
  );
}
