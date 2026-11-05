# RiuTek Web

Frontend chính thức cho nền tảng thương mại điện tử linh kiện máy tính và công cụ tự chọn cấu hình PC **RiuTek**.

- **Website chính thức:** [https://riutek.store](https://riutek.store)
- **Deployment Platform:** [Vercel](https://vercel.com/) (Static SPA với cấu hình rewrite qua `vercel.json`)

---

## 1. Giới Thiệu Dự Án

RiuTek là ứng dụng web thương mại điện tử chuyên cung cấp linh kiện phần cứng máy tính và hỗ trợ người dùng tự xây dựng dàn máy (PC Builder). Hệ thống cung cấp trải nghiệm mua sắm minh bạch, tra cứu thông số kỹ thuật chuẩn hóa, kiểm tra tương thích phần cứng và ước tính công suất nguồn theo thời gian thực.

### Các Tính Năng Đã Hoàn Thành:
- **Danh mục linh kiện & Bộ lọc kỹ thuật:** Phân cấp danh mục đa tầng, lọc theo 9 nhóm linh kiện (`ComponentType`), hỗ trợ lọc kỹ thuật chuyên sâu (Socket CPU, chuẩn RAM, kích thước Mainboard/Case, công suất nguồn PSU, chuẩn lưu trữ).
- **Tự chọn cấu hình PC (PC Builder):**
  - Trực quan hóa 9 slot linh kiện theo thứ tự lắp ráp chuẩn.
  - Tự động kiểm tra tương thích phần cứng (Socket, TDP, kích thước vật lý).
  - Ước tính công suất tiêu thụ điện và công suất nguồn khuyến nghị.
  - Lưu cấu hình vào tài khoản cá nhân.
  - Xuất toàn bộ cấu hình thành file ảnh PNG độ nét cao trực tiếp trên trình duyệt bằng native Canvas 2D.
- **Giỏ hàng & Mua ngay (Buy Now):** Chọn lọc từng sản phẩm để thanh toán, hỗ trợ mua ngay trọn bộ cấu hình PC hoặc sản phẩm đơn lẻ.
- **Đặt hàng & Thanh toán:** Hỗ trợ phương thức thanh toán khi nhận hàng (COD) và thanh toán qua thẻ quốc tế bằng cổng Stripe Checkout (chế độ thử nghiệm).
- **Quản lý đơn hàng:** Tra cứu lịch sử đơn hàng, xem chi tiết tiến độ xử lý và trạng thái thanh toán.
- **Trang quản trị (Admin Portal):** Quản lý sản phẩm, cây danh mục, nhập dữ liệu hàng loạt qua file Excel, và quản lý banner quảng cáo trang chủ.

---

## 2. Kiến Trúc Kết Nối API (Vercel API Proxy)

Trình duyệt trên môi trường production gọi Backend thông qua đường dẫn tương đối `/api/v1/*` cùng origin với `riutek.store`. Vercel reverse proxy chuyển tiếp yêu cầu tới Azure App Service:

```text
Trình duyệt Client (https://riutek.store/api/v1/*)
  │
  ▼
Vercel External Rewrite (vercel.json)
  │
  ▼
Backend Endpoint (Azure App Service /api/v1/*)
```

- **Same-origin context:** Tránh các rào cản CORS và cho phép cookie phiên xác thực (`HttpOnly`, `Secure`, `SameSite=Strict`) hoạt động bảo mật, an toàn.
- **Endpoint công khai:** Endpoint của Azure App Service là public infrastructure URL. Mọi cơ chế xác thực phiên và phân quyền đều do Backend kiểm soát độc lập.

---

## 3. Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Build Tool:** [Vite](https://vite.dev/)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **HTTP Client:** Native `fetch` wrapper (`src/lib/api`) với typed ProblemDetails error handling
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [lucide-react](https://lucide.dev/)
- **Đồ họa Canvas:** Native HTML5 Canvas 2D Renderer

---

## 4. Cấu Trúc Mã Nguồn

```text
src/
├── app/                  # Application root & Router configuration
├── assets/               # Static assets & Brand resources
├── components/           # Reusable UI primitives & Shared Layout (Header, Footer)
├── features/             # Feature-based business logic
│   ├── admin/            # Quản trị danh mục, sản phẩm, import Excel
│   ├── auth/             # Quản lý phiên, xác thực người dùng
│   ├── banners/          # Carousel banner trang chủ & admin banner
│   ├── buyNow/           # Luồng thanh toán nhanh cho cấu hình & sản phẩm
│   ├── cart/             # Giỏ hàng & tính toán tạm tính
│   ├── checkout/         # Quy trình đặt hàng COD & Stripe
│   ├── orders/           # Tra cứu và chi tiết đơn hàng
│   ├── pcBuilder/        # Tự chọn cấu hình, kiểm tra tương thích & xuất ảnh PNG
│   └── products/         # Danh mục, bộ lọc thông số & chi tiết sản phẩm
├── layouts/              # Public layout bọc Header, Outlet và Footer
├── lib/                  # Api client & error handler dùng chung
└── pages/                # Các trang hiển thị chính của ứng dụng
```

---

## 5. Biến Môi Trường & Bảo Mật

Tham khảo mẫu tại `.env.example`:

```text
VITE_API_BASE_URL=/api/v1
```

> [!IMPORTANT]
> **Quy tắc bảo mật:**
> 1. Mọi biến có tiền tố `VITE_*` đều sẽ được đóng gói công khai vào client bundle. Client mặc định sử dụng `/api/v1` tương đối.
> 2. **Tuyệt đối không** đưa JWT secret, connection string, Redis URL, Cloudflare R2 key, hoặc Azure credential vào frontend repository.
> 3. Không lưu access token vào `localStorage` hoặc `sessionStorage` phía client JavaScript.

---

## 6. Hướng Dẫn Phát Triển

### Cài đặt dependencies:
```powershell
npm ci
```

### Chạy môi trường phát triển (Dev Server):
```powershell
npm run dev
```

### Kiểm tra quy chuẩn mã nguồn (Lint):
```powershell
npm run lint
```

### Đóng gói sản phẩm (Production Build):
```powershell
npm run build
```

### Xem trước bản build:
```powershell
npm run preview
```

---

## 7. Hướng Dẫn Trải Nghiệm Demo

- **Khách vãng lai (Guest):** Có thể duyệt toàn bộ danh mục linh kiện, áp dụng bộ lọc thông số kỹ thuật, tự dựng cấu hình PC với công cụ PC Builder và xuất ảnh cấu hình PNG về máy.
- **Khách hàng (Customer):** Đăng ký tài khoản trực tiếp trên web để lưu trữ cấu hình PC, thêm vào giỏ hàng và đặt hàng thử nghiệm (COD hoặc Stripe Test).
- **Quản trị viên (Admin):** Vui lòng liên hệ quản trị viên dự án nếu cần cấp tài khoản trải nghiệm trang quản trị catalog và quản lý banner.

---

## 8. Lộ Trình Phát Triển (Roadmap)

- Bổ sung thêm các phương thức thanh toán nội địa qua cổng thanh toán trực tuyến.
- Mở rộng thêm các tiêu chuẩn thông số kỹ thuật phần cứng chuyên sâu.
