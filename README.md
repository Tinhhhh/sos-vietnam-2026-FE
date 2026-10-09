# SOS Việt Nam 2026 — Frontend (React)

Bản React của `sos-vietnam-2026` (cổng người dân + cổng trực ban), dùng backend Spring Boot `sos-vietnam-be-v2`.
Lộ trình và tiến độ: [docs/plans/2026-10-09-react-refactor/plan.md](docs/plans/2026-10-09-react-refactor/plan.md).

## Chạy local

Yêu cầu Node ≥ 22.22 (khuyên dùng Node 24 LTS).

```bash
npm install
npm run dev
```

Mở http://localhost:5173.

Backend không bắt buộc cho các module chưa cần API. Khi chạy `sos-vietnam-be-v2` ở cổng 8080, dev server tự proxy `/api` và `/ws` sang đó.
Đổi địa chỉ backend: copy `.env.example` thành `.env.local` rồi sửa `BACKEND_URL`.

| Lệnh                                | Việc                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                       | Dev server có HMR                                                     |
| `npm run build` / `npm run preview` | Build production / chạy thử bản build                                 |
| `npm run lint`                      | ESLint (gồm luật chặn import chéo giữa các feature)                   |
| `npm run format`                    | Prettier                                                              |
| `npm run css:extract`               | Sinh lại CSS từ repo cũ theo `tools/legacy-css/legacy-css.config.mjs` |

## Cấu trúc (Bulletproof React)

```text
src/
├── app/            # router, provider, routes/ (ghép các feature thành trang)
├── components/     # UI dùng chung: layouts/, ui/ (modal, toast)
├── config/         # env, paths
├── features/       # mỗi nghiệp vụ một thư mục: api/ components/ hooks/ utils/ data/
├── hooks/          # hook dùng chung
├── lib/            # api-client (axios), device-profile
├── styles/         # legacy-global.css (sinh tự động) + app.css
└── main.jsx
```

Luật import một chiều: `shared → features → app`. Feature không import feature khác; route trong `src/app/routes` lấy dữ liệu từ feature này rồi truyền xuống feature kia qua props.

## CSS từ bản cũ

CSS gốc được chép nguyên văn sang React bằng `tools/legacy-css/extract.mjs`. Tool đọc `public/css` của repo cũ theo `legacyRoot` trong config. Nếu repo cũ nằm ở chỗ khác, đặt biến `LEGACY_REPO`.

- Mỗi component sở hữu một danh sách class trong config.
- Rule của class đó được đưa vào `*.module.css` cạnh component, giữ nguyên thứ tự cascade và media query.
- Class dùng chung (`liquid-glass`, `svg-ico`, `modal-*`, ...) nằm trong `src/styles/legacy-global.css`.

File sinh tự động có header `AUTO-GENERATED`. Muốn sửa thì sửa config rồi chạy lại `npm run css:extract`. Khi đã sửa tay, xoá header đó đi.
