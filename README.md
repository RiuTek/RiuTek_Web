# RiuTek Web

Frontend chính thức cho nền tảng thương mại điện tử linh kiện máy tính, hệ thống PC Gaming và máy trạm AI **RiuTek**.

- **Production Domain:** [https://www.riutek.store](https://www.riutek.store)
- **Deployment Platform:** [Vercel](https://vercel.com/) (Static SPA với cấu hình rewrite qua `vercel.json`)

## 1. Kiến Trúc Kết Nối API (Vercel API Bridge)

Trình duyệt trên production gọi Backend thông qua đường dẫn tương đối `/api/v1/*` cùng origin với `www.riutek.store`. Vercel reverse proxy sẽ chuyển tiếp yêu cầu tới Azure App Service:

```text
Browser Client (https://www.riutek.store/api/v1/*)
  │
  ▼
Vercel External Rewrite (vercel.json)
  │
  ▼
Backend Origin (https://riutek-api-prod-ejg8f8cjfpefendh.southeastasia-01.azurewebsites.net/api/v1/*)
```

- **Same-origin context:** Tránh các rào cản CORS phức tạp và cho phép cookie xác thực (`HttpOnly`, `Secure`, `SameSite=Strict`) hoạt động trơn tru.
- **Backend Origin:** Hostname mặc định của Azure App Service là public endpoint hạ tầng, không phải bí mật. Mọi cơ chế xác thực và phân quyền đều do Backend bảo vệ.

## 2. Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Build Tool:** [Vite](https://vite.dev/)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **HTTP Client:** Native `fetch` wrapper (`src/lib/api`) với typed error handling
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [lucide-react](https://lucide.dev/)

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
│   └── homeMockData.ts     # Dữ liệu minh họa giao diện sản phẩm mẫu
├── layouts/
│   └── PublicLayout.tsx    # Layout bọc Header, Outlet và Footer
├── lib/
│   └── api/                # HTTP client foundation & error contracts
│       ├── apiClient.ts    # Fetch wrapper với relative base URL
│       ├── apiError.ts     # ApiError class cho business & problem details
│       ├── apiTypes.ts     # Contract DTO hạ tầng (PagedResult, ProblemDetails)
│       └── index.ts        # Public exports
├── pages/
│   ├── HomePage.tsx        # Trang chủ responsive theo ngôn ngữ Kinetic Apex
│   ├── ComingSoonPage.tsx  # Trang thông báo tính năng đang hoàn thiện
│   └── NotFoundPage.tsx    # Trang 404
├── styles/
│   └── globals.css         # Token Kinetic Apex & cấu hình Tailwind
├── main.tsx                # Application entrypoint
└── vite-env.d.ts           # Vite client types
```

## 4. Biến Môi Trường & Bảo Mật

Tham khảo mẫu tại `.env.example`:

```text
VITE_API_BASE_URL=/api/v1
```

> [!IMPORTANT]
> **Quy tắc bảo mật bắt buộc:**
> 1. Mọi biến có tiền tố `VITE_*` đều sẽ được đóng gói công khai (public) vào client bundle trong trình duyệt. Mặc định client sử dụng `/api/v1` tương đối, không cần cấu hình thêm trên Vercel.
> 2. **Tuyệt đối không** đưa JWT secret, refresh token, Stripe secret, connection string, Redis URL, Cloudflare R2 key, hoặc Azure credential vào frontend repository.
> 3. Không lưu access token hoặc refresh token vào `localStorage`, `sessionStorage` hoặc cookie phía client JavaScript.

## 5. Hướng Dẫn Phát Triển & Scripts

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
