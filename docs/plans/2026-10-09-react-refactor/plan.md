# Refactor sos-vietnam-2026 → React (sos-vietnam-fe-v2)

- Bắt đầu: 2026-10-09
- Nguồn: `sos-vietnam-2026/public` (index.html + app.js cho cổng dân; dispatcher.html + dispatcher.js cho cổng trực ban)
- Backend đích: `sos-vietnam-be-v2` (Spring Boot, cổng 8080)
- Tiêu chí của mỗi module: chạy được `npm run dev`, mở `http://localhost:5173` và thấy giao diện. Xong module nào thì commit, rồi dừng lại để review.

## Quyết định đã chốt

| Chủ đề    | Quyết định                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolchain | Node 24 LTS, Vite 8, React 19, React Router 8 (data mode)                                                                                                                                                     |
| Ngôn ngữ  | JavaScript (JSX)                                                                                                                                                                                              |
| CSS       | Giữ CSS gốc. Tách thành CSS Modules theo từng component bằng `tools/legacy-css/extract.mjs`. Rule được chép nguyên văn và giữ đúng thứ tự cascade                                                             |
| Kiến trúc | [Bulletproof React](https://github.com/alan2207/bulletproof-react): code nghiệp vụ nằm trong `src/features/*`; feature không import lẫn nhau (ESLint chặn); route trong `src/app/routes` ghép các feature lại |
| Gọi API   | Dùng một axios instance (`src/lib/api-client.js`). Dev server proxy `/api` và `/ws` sang `BACKEND_URL`                                                                                                        |
| Bỏ đi     | `cyber-shield.js` (chặn DevTools, tắt console), các handler chặn chuột phải, các phần tử chết                                                                                                                 |

## Lộ trình module

| #         | Module                                                 | Nội dung                                                                                                                                                                                                                     | Backend cần                                                                                        |
| --------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **M1** ✅ | Nền tảng + trang chủ cổng dân                          | Khung Vite/React/Router, công cụ tách CSS, layout (video nền theo chất lượng mạng, bong bóng, dock), banner GPS (Kalman filter), quả cầu SOS (canvas + giọng nói), thẻ cảnh báo NĐ 144, modal SOS Người Thân, modal Cẩm Nang | Không bắt buộc. Đã nối `GET /api/geo/resolve`. Chưa có `/api/geocode/reverse` và `/api/geocode/ip` |
| M2        | Cổng dân: form gửi SOS                                 | Chọn 5 lực lượng, chip sự cố (`incident-dictionary`), ghi chú, ảnh/video, người báo, gửi tới `POST /api/incidents`                                                                                                           | Thống nhất enum lực lượng (5 loại), trả `citizenAccessToken`, sửa serialize JTS `Point`            |
| M3        | Cổng dân: theo dõi sự cố realtime                      | Stepper 5 bước, đơn vị phụ trách, nút gọi, cập nhật qua STOMP, nút "Tôi đã an toàn"                                                                                                                                          | `GET /api/incidents/{id}`, topic STOMP riêng cho từng sự cố, endpoint citizen-safe                 |
| M4        | Bản đồ lõi MapLibre (dùng chung)                       | Component bản đồ, lớp tỉnh/xã, pin trạm, tuyến OSRM, highlight ranh giới; gắn vào màn tracking                                                                                                                               | Seed GeoJSON 34 tỉnh / 3.321 xã, API danh sách trạm                                                |
| M5        | Cổng dân: danh bạ bệnh viện & doanh nghiệp cứu hộ      | Danh sách theo khoảng cách, chi tiết, đánh giá sao, ghi log cuộc gọi                                                                                                                                                         | API hospitals / enterprises / reviews / service-calls                                              |
| M6        | Cổng trực ban: đăng nhập                               | Gatekeeper, 4 quả cầu lực lượng, đăng nhập JWT, auth store, interceptor refresh token, route bảo vệ, đăng xuất                                                                                                               | Auth be-v2 đã có (đăng nhập bằng email)                                                            |
| M7        | Bàn tác chiến                                          | Layout 3 vùng, widget header, hàng đợi sự cố, drawer chi tiết, tiếp nhận / cập nhật trạng thái realtime                                                                                                                      | API dispatcher: danh sách theo địa bàn, accept, update-status, ...                                 |
| M8        | Chat + gọi thoại WebRTC (2 phía)                       |                                                                                                                                                                                                                              | Signaling + chat qua STOMP                                                                         |
| M9        | Biên bản NĐ 30 + chữ ký + xuất docx/png/in             |                                                                                                                                                                                                                              | sign, sync-doc, export docx                                                                        |
| M10       | Lịch sử & thùng rác, báo giả + OSINT, thống kê địa bàn |                                                                                                                                                                                                                              |                                                                                                    |
| M11       | Quản trị                                               | Tài khoản, ca trực, CRUD trạm/BV/DN, bảo mật & audit, cấu hình giọng nói                                                                                                                                                     |                                                                                                    |
| M12       | PWA + hiệu ứng                                         | Cài lối tắt, service worker, cinematic Three.js, trang Heritage                                                                                                                                                              | Không                                                                                              |

Có thể đổi thứ tự. Ví dụ: làm M6 (đăng nhập) sớm hơn để kiểm thử trọn luồng JWT với be-v2.

## M1: checklist

- [x] Repo git riêng, Vite 8 + React 19 + React Router 8, ESLint (chặn import chéo feature), Prettier
- [x] `tools/legacy-css`: tách CSS gốc thành `src/styles/legacy-global.css` và 9 CSS Module
- [x] `lib/device-profile` (gắn class `device-*` / `os-*` như bản gốc), `hooks/use-network-status`
- [x] Layout cổng dân: video nền (chọn file theo mạng), bong bóng ambient, dock 4 nút
- [x] `features/location`: GPS → Kalman 20 s → reverse geocode → tra địa bàn; fallback IP rồi vị trí mặc định
- [x] `features/sos-trigger`: quả cầu canvas (glitter, sóng xung kích, hạt bắn, parallax), giọng nói nhắc (MP3 hoặc speechSynthesis), rung, thẻ NĐ 144
- [x] `features/family-sos`: lưu 2 số người thân, gửi SMS / Web Share, xem trước, sao chép
- [x] `features/survival-guide`: 4 thẻ cẩm nang
- [x] Route `/`, `/dispatcher` (placeholder), 404, error boundary
- [x] Đối chiếu computed style với bản gốc ở 1280×800 và 375×812

## Khác biệt cố ý so với bản gốc (M1)

- Không còn số mặc định `0912345678` cho người thân 1, vì có thể gửi SOS nhầm cho người lạ.
- Khi không có GPS, dòng tọa độ ghi rõ "(vị trí mặc định — chưa lấy được GPS)". Bản gốc vẫn hiển thị "±10m".
- Bản gốc dùng `alert()` và gọi `showToast()` (hàm này không tồn tại). Bản mới thay bằng toast.
- Nút "Cài Lối Tắt" tạm hiện thông báo; luồng cài PWA thuộc M12.
- Bấm SOS: hiệu ứng + giọng nói giữ nguyên, rồi hiện thông báo thay vì mở form (form thuộc M2).

## Lỗi phát hiện ở be-v2 (chưa sửa, để backend xử lý)

- `POST /api/v1/auth/register` cho client tự chọn `roleName`, nên ai cũng đăng ký được ADMIN.
- Refresh token bị lưu 2 lần (`JwtTokenProvider.generateRefreshToken` và `AuthenService.saveRefreshToken`). `findByToken` trả `Optional` nên khả năng cao lỗi 500 khi refresh.
- Entity có trường JTS `Geometry` / `Point` nhưng chưa có `jackson-datatype-jts` hoặc `@JsonIgnore`. Serialize incident / station / geo nhiều khả năng lỗi.
- `/swagger-ui.html` không nằm trong permitAll; dùng `/swagger-ui/index.html`.
