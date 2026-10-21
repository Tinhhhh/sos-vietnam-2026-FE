/**
 * "In / PDF": prints the saved report on A4 from a hidden iframe (the browser's print dialog offers
 * "Save as PDF"). Standalone HTML with inline styles, same layout as the Word file.
 */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const TIME = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const box = (on) => (on ? '☒' : '☐');

function signature(role, hint, sig, fallbackName) {
  const mark = !sig
    ? '<div style="height:70px"></div>'
    : sig.type === 'DRAW' && sig.image
      ? `<img src="${esc(sig.image)}" style="max-height:64px;max-width:170px" alt="">`
      : `<div style="height:70px;display:flex;align-items:center;justify-content:center;font-style:italic;font-weight:bold;color:#1e3a8a;font-size:18pt">${esc(sig.name)}</div>`;
  const proxy =
    sig?.channel === 'OFFICER_PROXY'
      ? `<div style="font-size:10pt;font-style:italic">(Cán bộ ${esc(sig.signedByName)} ký hộ, lý do: ${esc(sig.proxyReason)})</div>`
      : '';
  return `<td style="width:50%;text-align:center;vertical-align:top">
    <div style="font-weight:bold;text-transform:uppercase">${role}</div>
    <div style="font-style:italic;font-size:11pt">${hint}</div>
    ${mark}
    <div style="font-weight:bold">${esc(sig?.name || fallbackName)}</div>
    ${sig ? `<div style="font-size:10pt;font-style:italic">Thời gian ký: ${esc(TIME.format(sig.signedAt))}</div>` : ''}
    ${proxy}
  </td>`;
}

export function buildPrintHtml(doc) {
  const f = doc.fields;
  const line = (label, value) =>
    `<p style="margin:0 0 4px 0.5cm;text-align:justify"><b>${label}</b> ${esc(value)}</p>`;
  const yesNo = (v) => `${box(v === true)} Có &nbsp;&nbsp; ${box(v === false)} Không`;
  const target = (t) => `${box(f.target_type === t)} ${t}`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(doc.docNumber)}</title>
<style>
  @page { size: A4; margin: 20mm 20mm 20mm 25mm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.45; color: #000; margin: 0; }
  .rule { height: 1px; background: #000; margin: 3px auto 4px; }
  h2 { font-size: 13.5pt; margin: 10px 0 4px; text-transform: uppercase; }
</style></head><body>
<table style="width:100%;border-collapse:collapse"><tr>
  <td style="width:44%;text-align:center;vertical-align:top">
    <div style="font-size:12pt;text-transform:uppercase">${esc(f.header_upper)}</div>
    <div style="font-size:12.5pt;font-weight:bold;text-transform:uppercase">${esc(f.header_lower)}</div>
    <div class="rule" style="width:4cm"></div>
    <div style="font-size:12pt">Số: ${esc(doc.docNumber)}</div>
  </td>
  <td style="width:56%;text-align:center;vertical-align:top">
    <div style="font-size:12.5pt;font-weight:bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div style="font-size:13.5pt;font-weight:bold">Độc lập - Tự do - Hạnh phúc</div>
    <div class="rule" style="width:4.8cm"></div>
    <div style="font-style:italic">${esc(f.place_date)}</div>
  </td>
</tr></table>
<div style="text-align:center;margin:14px 0 12px">
  <div style="font-size:14.5pt;font-weight:bold">PHIẾU THÔNG BÁO VÀ TIẾP NHẬN THÔNG TIN<br>ỨNG PHÓ SỰ CỐ KHẨN CẤP</div>
  <div style="font-size:12pt;font-style:italic">Mã tiếp nhận: ${esc(doc.incidentId)} | Thời gian: ${esc(f.incident_time)}</div>
</div>
<h2>A. Thông tin chung (đơn vị tiếp nhận)</h2>
${line('- Họ tên cán bộ tiếp nhận:', [f.officer_name, f.officer_title && `(${f.officer_title})`].filter(Boolean).join(' '))}
${line('- Đơn vị tiếp nhận:', f.unit_name)}
${line('- Địa chỉ cơ quan / Trụ sở công tác:', f.unit_address)}
${line('- Số điện thoại liên hệ của đơn vị:', f.unit_phone)}
<h2>B. Thông tin đến (người báo &amp; hiện trường sự cố)</h2>
${line('- Tên người gọi / Người báo tin:', f.reporter_name)}
<p style="margin:0 0 4px 0.5cm"><b>- Thuộc đối tượng:</b> ${target('Người dân')} &nbsp; ${target('Nhân viên cơ sở')} &nbsp; ${target('Lực lượng ứng phó')}</p>
${line('- Số điện thoại người gọi:', f.reporter_phone)}
${line('- Giờ gọi / Báo tin:', f.incident_time)}
${line('- Vị trí xảy ra sự cố (Địa chỉ thực tế):', f.incident_address)}
${f.coordinates ? line('- Tọa độ định vị GPS:', f.coordinates) : ''}
${line('- Loại sự cố &amp; Mô tả chi tiết:', f.description)}
<p style="margin:0 0 4px 0.5cm"><b>- Có ảnh hưởng tới người dân:</b> ${yesNo(f.affects_citizens)}</p>
<p style="margin:0 0 4px 0.5cm"><b>- Tình huống có yêu cầu trợ giúp:</b> ${yesNo(f.needs_help)}</p>
${line('- Yêu cầu trợ giúp cụ thể / Lực lượng điều động:', f.help_request)}
${line('- Lời khuyên / Khuyến cáo đã hướng dẫn người dân:', f.advice_given)}
${line('- Kết quả xử lý:', f.resolution_result)}
<table style="width:100%;margin-top:18px;border-collapse:collapse"><tr>
  ${signature('Người báo tin / Người dân', '(Ký, ghi rõ họ tên)', doc.citizenSignature, f.reporter_name)}
  ${signature('Cán bộ / Chỉ huy tiếp nhận', '(Ký, đóng dấu và ghi rõ họ tên)', doc.officerSignature, f.officer_name)}
</tr></table>
</body></html>`;
}

export function printDocument(doc) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  win.document.open();
  win.document.write(buildPrintHtml(doc));
  win.document.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  // Wait for the signature images before printing
  const go = () => {
    win.focus();
    win.print();
    cleanup();
  };
  const imgs = Array.from(win.document.images);
  if (imgs.every((i) => i.complete)) setTimeout(go, 50);
  else Promise.all(imgs.map((i) => new Promise((r) => (i.onload = i.onerror = r)))).then(go);
}
