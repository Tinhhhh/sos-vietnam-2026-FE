const WAVES =
  'c.6 0 1.2.2 1.7.6l.6.6a2.4 2.4 0 0 0 3.4 0l.6-.6a2.4 2.4 0 0 1 3.4 0l.6.6a2.4 2.4 0 0 0 3.4 0l.6-.6a2.4 2.4 0 0 1 3.4 0l.6.6c.5.4 1.1.6 1.7.6';
const CAR_BODY =
  'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2';

// glassClass is a global legacy class; toneClass lives in the CSS module.
export const SURVIVAL_GUIDES = [
  {
    id: 'flood',
    title: '1. Ứng Phó Mưa Bão & Lũ Lụt',
    badge: 'THIÊN TAI',
    glassClass: 'liquid-glass-blue',
    toneClass: 'guideCardBlue',
    iconClass: 'ico-blue',
    icon: (
      <>
        <path d={`M2 12${WAVES}`} />
        <path d={`M2 18${WAVES}`} />
        <path d={`M2 6${WAVES}`} />
      </>
    ),
    items: [
      ['Chiếu sáng & Nguồn điện:', 'Sạc đầy pin điện thoại, sạc dự phòng, đèn pin, nến.'],
      ['Lương thực & Nước sạch:', 'Dự trữ nước uống, mì tôm, lương khô đủ cho 3-5 ngày.'],
      ['An toàn điện:', 'Ngắt cầu dao khu vực trũng, kê cao các thiết bị điện tử.'],
      [
        'Di chuyển & Sơ tán:',
        'Không lội qua dòng nước xiết, di chuyển lên tầng cao hoặc nơi trú bão kiên cố.',
      ],
    ],
  },
  {
    id: 'fire',
    title: '2. Thoát Hiểm Cháy Nổ & Ngạt Khói',
    badge: 'PCCC 114',
    glassClass: 'liquid-glass-red',
    toneClass: 'guideCardRed',
    iconClass: 'ico-red',
    icon: (
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    ),
    items: [
      ['Bảo vệ đường thở:', 'Dùng khăn/vải ướt bịt kín mũi và miệng để lọc khói độc CO.'],
      ['Di chuyển thấp:', 'Bò sát sàn nhà (không khí sạch ở tầm dưới 0.5m).'],
      ['Tuyệt đối KHÔNG dùng thang máy:', 'Chỉ sử dụng thang bộ thoát hiểm có cửa chống cháy.'],
      ['Báo động:', 'Hô hoán và bấm ngay 114 trên ứng dụng để định vị lực lượng PCCC.'],
    ],
  },
  {
    id: 'cpr',
    title: '3. Sơ Cứu Hồi Sinh Tim Phổi (CPR)',
    badge: 'CẤP CỨU 115',
    glassClass: 'liquid-glass-green',
    toneClass: 'guideCardGreen',
    iconClass: 'ico-emerald',
    icon: (
      <>
        <path d={CAR_BODY} />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
        <line x1="9" y1="10" x2="13" y2="10" />
        <line x1="11" y1="8" x2="11" y2="12" />
      </>
    ),
    items: [
      ['Kiểm tra:', 'Lay gọi nạn nhân, kiểm tra nhịp thở trong 10 giây.'],
      ['Ép tim lồng ngực:', 'Đặt 2 tay giữa ngực, ép sâu 5cm với nhịp 100-120 lần/phút liên tục.'],
      ['Tai nạn giao thông:', 'Hạn chế di chuyển nạn nhân nếu nghi ngờ chấn thương cột sống cổ.'],
    ],
  },
  {
    id: 'traffic',
    title: '4. Cứu Hộ Giao Thông & Va Chạm Xe',
    badge: 'CỨU HỘ XE',
    glassClass: 'liquid-glass-orange',
    toneClass: 'guideCardAmber',
    iconClass: 'ico-amber',
    icon: (
      <>
        <path d={CAR_BODY} />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
    items: [
      ['Đặt biển cảnh báo:', 'Bật đèn khẩn cấp hazard, đặt tam giác phản quang cách xe tối thiểu 50-100m.'],
      ['Đứng vị trí an toàn:', 'Di chuyển ra ngoài dải phân cách hoặc vỉa hè, không đứng trước/sau đầu xe.'],
      ['Gọi cứu hộ chuyên dụng:', 'Sử dụng ứng dụng để điều phối xe cẩu/kéo chuyên dùng gần nhất.'],
    ],
  },
];
