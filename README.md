# RiuTek Web

Frontend chính thức cho nền tảng thương mại điện tử linh kiện máy tính, hệ thống PC Gaming và máy trạm AI **RiuTek**.

## 1. Trạng Thái Dự Án

- **Giai đoạn hiện tại:** FE Phase 0 — React/Vite Storefront Shell & First Vercel Deployment.
- **Tình trạng:** Đang phát triển giao diện người dùng (Storefront Shell).
- **Trạng thái tính năng:**
  - ✅ **Storefront Shell & Design System:** Hoàn thành (Dựa trên thiết kế Kinetic Apex).
  - ✅ **Routing cơ bản & SPA Fallback:** Hoàn thành (`/`, `/products`, `/pc-builder`, `/login`, `*`).
  - ⏳ **Product Catalog & Filtering:** Đang phát triển (Planned).
  - ⏳ **PC Builder Studio & Compatibility Engine:** Đang phát triển (Planned).
  - ⏳ **Xác thực tài khoản (Auth) & Đơn hàng:** Đang phát triển (Planned).
  - ⏳ **Backend API Integration:** Đang lên kế hoạch cho Phase tiếp theo.

## 2. Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Build Tool:** [Vite](https://vite.dev/)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [lucide-react](https://lucide.dev/)
- **Deployment Target:** [Vercel](https://vercel.com/) (Static SPA với cấu hình rewrite qua `vercel.json`)

## 3. Cấu Trúc Mã Nguồn

```text
src/
├── app/
│   ├── App.tsx             # Root component với RouterProvider
│   └── router.tsx          # Khai báo React Router route tree
├── assets/                 # Static assets nội bộ
├── components/
│   ├── layout/             # Header, Footer dùng chung
│   └── ui/                 # UI primitives
├── data/
│   └── homeMockData.ts     # Dữ liệu mẫu minh họa giao diện cho Phase 0
├── layouts/
│   └── PublicLayout.tsx    # Layout bọc Header, Outlet và Footer
├── pages/
│   ├── HomePage.tsx        # Trang chủ responsive theo ngôn ngữ Kinetic Apex
│   ├── ComingSoonPage.tsx  # Trang thông báo tính năng đang phát triển
│   └── NotFoundPage.tsx    # Trang 404
├── styles/
│   └── globals.css         # Token Kinetic Apex & cấu hình Tailwind
├── main.tsx                # Application entrypoint
└── vite-env.d.ts           # Vite client types
```

## 4. Nguồn Thiết Kế (Design Reference)

- **Design System:** `kinetic_apex/DESIGN.md` (Google Stitch Export).
- **Bảng màu chủ đạo:** Crimson Red (`#DC2626`, `#B91C1C`), Abyssal Slate (`#0F172A`, `#1E293B`), Ceramic Surface (`#FFFFFF`, `#F8FAFC`).
- **Typography:** `Plus Jakarta Sans` với fallback hệ thống.
- **Nguyên tắc:** Thiết kế bo tròn khí động học (`rounded-full`, `rounded-2xl`, `rounded-3xl`), phản hồi tương tác mượt mà, hỗ trợ chuẩn `prefers-reduced-motion`.

## 5. Quy Tắc Biến Môi Trường & Bảo Mật

Tham khảo mẫu tại `.env.example`:

```text
VITE_API_BASE_URL=https://your-api.example.com
```

> [!IMPORTANT]
> **Quy tắc bảo mật bắt buộc:**
> 1. Mọi biến có tiền tố `VITE_*` đều sẽ được đóng gói công khai (public) vào client bundle trong trình duyệt.
> 2. **Tuyệt đối không** đưa JWT secret, Stripe secret, database connection string, Redis URL, Cloudflare R2 secret hoặc Azure credential vào frontend repository này.
> 3. Không commit file `.env` hoặc `.env.local` lên git.
> 4. `VITE_API_BASE_URL` chưa được sử dụng trong Phase 0 do chưa tích hợp Backend API. Mọi URL API sẽ được cấu hình động qua biến môi trường khi bắt đầu giai đoạn tích hợp, không hardcode vào mã nguồn.

## 6. Hướng Dẫn Cài Đặt & Scripts

### Cài đặt dependencies:

```powershell
npm install
```

### Chạy môi trường phát triển (Dev Server):

```powershell
npm run dev
```

### Kiểm tra cú pháp & quy chuẩn mã nguồn (Lint):

```powershell
npm run lint
```

### Đóng gói sản phẩm (Production Build):

```powershell
npm run build
```

### Xem thử bản đóng gói (Preview):

```powershell
npm run preview
```
