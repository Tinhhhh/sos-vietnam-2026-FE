import { useRef, useState } from 'react';
import styles from './report-modal.module.css';

export function ReportModal({ incident, citizenAccessToken, onClose }) {
  const [isSigning, setIsSigning] = useState(false);
  const [citizenSignature, setCitizenSignature] = useState(
    incident?.signatures?.citizen?.signatureData || null
  );
  const [submittingDocx, setSubmittingDocx] = useState(false);
  const canvasRef = useRef(null);

  const inc = incident || {};
  const incidentId = inc.id || 'SOS-01';
  const unit = inc.dispatchUnit || inc.assignedUnit || {};
  const officerName = inc.officerName || unit.officerName || 'Cán bộ trực ban tác chiến';
  const officerRank = unit.officerRank || 'Đại úy';
  const officerSigned = Boolean(inc.signatures?.officer?.signed);

  // Canvas drawing handlers
  const handleStartDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.isDrawing = true;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0284c7';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx.isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.isDrawing = false;
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setCitizenSignature(dataUrl);
    setIsSigning(false);

    try {
      await fetch('/api/sos/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(citizenAccessToken ? { 'X-SOS-Access-Token': citizenAccessToken } : {}),
        },
        body: JSON.stringify({
          incidentId,
          signerRole: 'citizen',
          name: inc.reporterName || 'Người dân',
          type: 'draw',
          signatureData: dataUrl,
          accessToken: citizenAccessToken || '',
        }),
      });
    } catch {}
  };

  const handlePrint = () => {
    document.body.classList.add('printing-incident-report');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-incident-report');
    }, 1000);
  };

  const handleDownloadDocx = async () => {
    setSubmittingDocx(true);
    try {
      const payload = {
        incidentId,
        incidentTime: inc.createdAt || new Date().toISOString(),
        officerName,
        officerTitle: officerRank,
        unitName: unit.unitName || unit.name || 'Công an Phường / Xã',
        unitAddress: unit.address || inc.address || '',
        unitPhone: unit.phone || '113',
        unitEmail: unit.email || 'trucban.sos@vn.gov',
        reporterName: inc.reporterName || 'Người dân',
        reporterPhone: inc.reporterPhone || 'Chưa cung cấp',
        reporterAddress: inc.address || 'Hiện trường sự cố',
        incidentDesc: inc.description || 'Cần hỗ trợ cứu hộ khẩn cấp',
        citizenSigned: Boolean(citizenSignature),
        officerSigned,
      };

      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Không thể tải file Word từ máy chủ');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu_TiepNhan_UPSC_${incidentId}.docx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {
      alert(`Lỗi: ${e.message || 'Không thể tạo file Word'}`);
    } finally {
      setSubmittingDocx(false);
    }
  };

  const handleSafeClose = () => {
    if (!citizenSignature) {
      const proceed = confirm('Biên bản chưa có chữ ký xác nhận của bạn. Bạn có muốn đóng và ký sau không?');
      if (!proceed) return;
    }
    onClose?.();
  };

  return (
    <div className={styles.reportOverlay}>
      <div className={styles.reportContainer} id="incidentReportDocxModal">
        {/* Toolbar Header */}
        <div className={styles.reportToolbar}>
          <div className={styles.toolbarTitle}>
            <span>📄</span>
            <span>PHIẾU TIẾP NHẬN & XỬ LÝ SỰ CỐ KHẨN CẤP (#{incidentId})</span>
          </div>

          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={`${styles.btnToolbar} ${styles.btnDocx}`}
              onClick={handleDownloadDocx}
              disabled={submittingDocx}
            >
              💾 {submittingDocx ? 'Đang tạo...' : 'Tải File Word (.docx)'}
            </button>
            <button type="button" className={`${styles.btnToolbar} ${styles.btnPrint}`} onClick={handlePrint}>
              🖨️ In Phiếu / PDF
            </button>
            <button type="button" className={`${styles.btnToolbar} ${styles.btnClose}`} onClick={handleSafeClose}>
              ✕ Đóng
            </button>
          </div>
        </div>

        {/* Printable Official Sheet */}
        <div className={styles.reportSheet} id="reportSheetContainer">
          <div className={styles.sheetHeader}>
            <div className={styles.sheetNationalHeading}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className={styles.sheetMotto}>Độc lập - Tự do - Hạnh phúc</div>
            <div className={styles.sheetDivider} />
            <div className={styles.sheetDocTitle}>PHIẾU TIẾP NHẬN & ỨNG PHÓ SỰ CỐ KHẨN CẤP</div>
            <div className={styles.sheetDocId}>Số hồ sơ điện tử: #{incidentId}</div>
          </div>

          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>I. THÔNG TIN NGƯỜI BÁO TIN & HIỆN TRƯỜNG</div>
            <div className={styles.infoRow}>
              <b>Họ và tên người yêu cầu:</b> {inc.reporterName || 'Người dân'}
            </div>
            <div className={styles.infoRow}>
              <b>Số điện thoại liên hệ:</b> {inc.reporterPhone || 'Chưa cung cấp'}
            </div>
            <div className={styles.infoRow}>
              <b>Địa điểm xảy ra sự cố:</b> {inc.address || 'Tọa độ GPS xác định'}
            </div>
            <div className={styles.infoRow}>
              <b>Thời điểm tiếp nhận tin báo:</b>{' '}
              {inc.createdAt ? new Date(inc.createdAt).toLocaleString('vi-VN') : 'Đang cập nhật'}
            </div>
            <div className={styles.infoRow}>
              <b>Nội dung sự cố khẩn cấp:</b> {inc.description || 'Yêu cầu cứu nạn, ứng phó sự cố cấp bách'}
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <div className={styles.sectionTitle}>II. ĐƠN VỊ ĐỊA BÀN PHỤ TRÁCH & ĐIỀU PHỐI</div>
            <div className={styles.infoRow}>
              <b>Đơn vị xử lý:</b> {unit.unitName || unit.name || 'Công an Phường / Xã tiếp nhận'}
            </div>
            <div className={styles.infoRow}>
              <b>Trụ sở:</b> {unit.address || 'Trụ sở cơ quan công an địa phương'}
            </div>
            <div className={styles.infoRow}>
              <b>Cán bộ phụ trách tiếp nhận:</b> {officerName} ({officerRank})
            </div>
            <div className={styles.infoRow}>
              <b>Đường dây nóng đơn vị:</b> {unit.phone || '113'}
            </div>
          </div>

          {/* Signatures Grid */}
          <div className={styles.signaturesGrid}>
            <div>
              <div className={styles.sigTitle}>NGƯỜI BÁO TIN / ĐẠI DIỆN</div>
              <div className={styles.sigSub}>(Ký và ghi rõ họ tên)</div>

              <div className={styles.sigBox}>
                {citizenSignature ? (
                  <img
                    src={citizenSignature}
                    alt="Chữ ký người dân"
                    style={{ maxHeight: '75px', objectFit: 'contain' }}
                  />
                ) : (
                  <button type="button" className={styles.btnSignNow} onClick={() => setIsSigning(true)}>
                    ✍️ Ký tên điện tử
                  </button>
                )}
              </div>
              <div style={{ fontWeight: 700 }}>{inc.reporterName || 'Người dân'}</div>
            </div>

            <div>
              <div className={styles.sigTitle}>CÁN BỘ TRỰC BAN TÁC CHIẾN</div>
              <div className={styles.sigSub}>(Xác thực số hóa chỉ huy)</div>

              <div className={styles.sigBox}>
                {officerSigned ? (
                  <div style={{ color: '#059669', fontWeight: 800 }}>
                    🛡️ ĐÃ XÁC THỰC SỐ HÓA
                    <div style={{ fontSize: '9pt', color: '#64748b' }}>Hệ thống Điều phối Quốc gia</div>
                  </div>
                ) : (
                  <div style={{ color: '#0284c7', fontWeight: 700, fontSize: '11pt' }}>
                    ✍️ {officerName}
                    <div style={{ fontSize: '9pt', color: '#64748b' }}>Xác nhận trực ban</div>
                  </div>
                )}
              </div>
              <div style={{ fontWeight: 700 }}>{officerName}</div>
            </div>
          </div>

          {/* Inline signature pad */}
          {isSigning && (
            <div className={styles.sigCanvasWrapper}>
              <div style={{ fontWeight: 700, marginBottom: '6px', textAlign: 'center', fontSize: '11pt' }}>
                ✍️ Vẽ chữ ký của bạn vào khung bên dưới:
              </div>
              <canvas
                ref={canvasRef}
                width={360}
                height={120}
                className={styles.canvasEl}
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
              />
              <div className={styles.canvasActions}>
                <button
                  type="button"
                  className={styles.btnToolbar}
                  style={{ background: '#e2e8f0', color: '#334155' }}
                  onClick={handleClearCanvas}
                >
                  Xóa nét
                </button>
                <button
                  type="button"
                  className={styles.btnToolbar}
                  style={{ background: '#0284c7', color: '#ffffff' }}
                  onClick={handleSaveSignature}
                >
                  Xác nhận chữ ký
                </button>
                <button
                  type="button"
                  className={styles.btnToolbar}
                  style={{ background: '#fee2e2', color: '#dc2626' }}
                  onClick={() => setIsSigning(false)}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
