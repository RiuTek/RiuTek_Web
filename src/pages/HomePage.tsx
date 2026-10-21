import React from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  Cpu,
  Layers,
  Zap,
  ShieldCheck,
  PackageCheck,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  Gauge,
  HelpCircle,
} from 'lucide-react'
import {
  CATEGORIES_DATA,
  FEATURED_PRODUCTS_DATA,
  SERVICE_BENEFITS,
} from '../data/homeMockData'

export const HomePage: React.FC = () => {
  return (
    <div className="w-full flex flex-col space-y-12 sm:space-y-16 pb-16">
      {/* 1. HERO SECTION: Asymmetric Editorial Split */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Content Column */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 lg:p-12 rounded-3xl shadow-[0_12px_40px_rgba(220,38,38,0.06)] border border-red-100/70 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-72 h-72 bg-red-100/40 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-slate-100/60 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-red-50 border border-red-200/80 rounded-full mb-6 shadow-sm">
                <Flame className="w-4 h-4 text-red-600" />
                <span className="text-xs font-extrabold text-red-600 uppercase tracking-wider">
                  RiuTek Kinetic Apex • Architecture Preview
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 tracking-tight mb-5 leading-tight">
                Kỷ nguyên hiệu năng PC: Khám phá{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-red-500 to-rose-700">
                  Phần Cứng Đỉnh Cao
                </span>{' '}
                &amp; Tối Ưu Cấu Hình.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-xl mb-8 leading-relaxed">
                Nền tảng thương mại điện tử linh kiện máy tính, hệ thống PC Gaming và máy trạm AI. Hỗ trợ người dùng từ cơ bản đến chuyên sâu dễ dàng lựa chọn linh kiện tương thích và cân bằng hiệu năng.
              </p>

              <div className="flex flex-wrap items-center gap-3.5">
                <Link
                  to="/pc-builder"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full text-sm font-bold shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Khám Phá PC Builder</span>
                </Link>

                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-slate-100 text-slate-900 rounded-full text-sm font-semibold hover:bg-red-50 hover:text-red-600 transition-all border border-slate-200 hover:border-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <span>Xem Danh Mục Linh Kiện</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Telemetry Spec Footnote */}
            <div className="relative z-10 pt-6 mt-8 border-t border-slate-100 grid grid-cols-3 gap-2 sm:gap-4 text-slate-600">
              <div>
                <div className="text-base sm:text-lg font-bold text-slate-950 font-mono">100%</div>
                <div className="text-xs text-slate-500">Chuẩn thông số phần cứng</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-bold text-red-600 font-mono">Thông minh</div>
                <div className="text-xs text-slate-500">Kiểm tra tương thích</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-bold text-slate-950 font-mono">Tối ưu</div>
                <div className="text-xs text-slate-500">Cân đối ngân sách &amp; TDP</div>
              </div>
            </div>
          </div>

          {/* Right Visual Feature Column */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Flagship Hardware Preview Card */}
            <div className="flex-1 bg-slate-900 rounded-3xl border border-red-100/40 relative overflow-hidden flex flex-col justify-between group min-h-[320px] p-6 shadow-sm">
              <img
                src={FEATURED_PRODUCTS_DATA[0].imageUrl}
                alt="Flagship Hardware Preview"
                className="w-full h-full object-cover rounded-2xl absolute inset-0 opacity-80 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent pointer-events-none" />

              <div className="relative z-10 flex justify-between items-start">
                <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full shadow-md">
                  RIUTEK APEX PREVIEW
                </span>
                <span className="px-3 py-1 bg-slate-950/80 backdrop-blur-md text-white text-xs font-mono rounded-full border border-white/20">
                  TDP: 450W Max
                </span>
              </div>

              <div className="relative z-10 text-white mt-auto pt-16">
                <p className="text-xs text-red-400 uppercase tracking-widest font-bold mb-1">
                  Kiến Trúc Đồ Họa Next-Gen
                </p>
                <h2 className="text-xl font-bold text-white mb-1">
                  Hệ Thống Tản Nhiệt Đa Tầng &amp; GDDR7
                </h2>
                <p className="text-xs text-slate-300 line-clamp-2">
                  Tối ưu hóa luồng gió khí động học, chuẩn PCIe Gen 5 và băng thông bộ nhớ đồ họa tốc độ cao cho gaming 4K và huấn luyện mô hình.
                </p>
              </div>
            </div>

            {/* Quick Spec Highlights */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Z890 &amp; X870E</div>
                  <div className="text-[11px] text-slate-500">Bo mạch chủ thế hệ mới</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-red-400 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">PCIe Gen 5 NVMe</div>
                  <div className="text-[11px] text-slate-500">Tốc độ đọc 14.500 MB/s</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Core Architecture Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-start gap-3.5 hover:border-red-200 transition-colors">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Tương Thích Tuyệt Đối
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đồng bộ chuẩn socket, kích thước khe cắm và công suất nguồn tránh rủi ro nghẽn cổ chai phần cứng.
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-start gap-3.5 hover:border-red-200 transition-colors">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Quản Trị TDP &amp; Tản Nhiệt
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tính toán chính xác nhiệt lượng tỏa ra và mức điện áp tiêu thụ để chọn bộ nguồn và quạt làm mát thích hợp.
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-start gap-3.5 hover:border-red-200 transition-colors">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Hỗ Trợ Người Mới Tự Lắp Ráp
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mô tả thông số mạch lạc, dễ hiểu, giúp người dùng không chuyên vẫn tự tin lựa chọn cấu hình máy tính riêng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY CARDS SECTION */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">
              Phần Cứng Chuyên Sâu
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Danh Mục Linh Kiện Chính
            </h2>
          </div>
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
          >
            <span>Xem toàn bộ linh kiện</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES_DATA.map((cat) => (
            <Link
              key={cat.id}
              to="/products"
              className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:border-red-300 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-red-50 group-hover:text-red-600 group-hover:border-red-200 transition-colors">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium font-mono">
                    {cat.itemCount}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors mb-1.5">
                  {cat.name}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  {cat.description}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 group-hover:text-red-600 transition-colors pt-2 border-t border-slate-100">
                <span>Khám phá nhóm linh kiện</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. QUICK PC BUILDER INTRO WIDGET */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden border border-slate-800 shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 text-red-500" />
              PC Builder Studio Preview
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4 text-white">
              Tự Tay Cấu Hình Dàn Máy Trong Vài Bước
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Công cụ cấu hình linh kiện thông minh giúp bạn chọn CPU, bo mạch chủ, card đồ họa và bộ nguồn một cách trực quan. Hệ thống sẽ tự động đối chiếu kích thước case, công suất nguồn tiêu thụ và chuẩn kết nối.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-red-400 font-bold mb-1 font-mono">BƯỚC 1</div>
              <h4 className="text-sm font-bold text-white mb-1">Xác Định Nhu Cầu</h4>
              <p className="text-xs text-slate-400">
                Lựa chọn mục đích: Gaming eSports, đồ họa render 3D hoặc phát triển mô hình tính toán.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-red-400 font-bold mb-1 font-mono">BƯỚC 2</div>
              <h4 className="text-sm font-bold text-white mb-1">Lựa Chọn Linh Kiện</h4>
              <p className="text-xs text-slate-400">
                Gợi ý linh kiện tương thích theo từng socket, băng thông PCIe và chuẩn RAM DDR5.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-red-400 font-bold mb-1 font-mono">BƯỚC 3</div>
              <h4 className="text-sm font-bold text-white mb-1">Kiểm Tra Điện Năng &amp; TDP</h4>
              <p className="text-xs text-slate-400">
                Kiểm tra điện áp công suất nguồn cần thiết và giải pháp tản nhiệt đáp ứng tải trọng.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              * Giao diện PC Builder tương tác đầy đủ sẽ được phát hành trong các phase kế tiếp.
            </div>
            <Link
              to="/pc-builder"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
            >
              <span>Xem Trang Giới Thiệu PC Builder</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4. FEATURED PRODUCTS (PREVIEW UI) */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-medium mb-2 border border-slate-200">
              [Preview UI — Mock Data]
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Sản Phẩm Minh Họa Giao Diện
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-sm">
            Dữ liệu linh kiện mẫu giúp hiển thị trực quan thiết kế thẻ sản phẩm Kinetic Apex.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURED_PRODUCTS_DATA.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:border-red-300 hover:shadow-lg transition-all group flex flex-col justify-between overflow-hidden"
            >
              <div className="p-4">
                <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden mb-4">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <span className="absolute top-2 left-2 bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {product.tag}
                  </span>
                </div>

                <div className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-1">
                  {product.brand}
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 mb-2.5">
                  {product.name}
                </h3>

                <div className="space-y-1 mb-4">
                  {product.specs.map((spec, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-slate-600 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-red-500 flex-shrink-0" />
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Giá tham khảo</div>
                  <div className="text-sm font-bold text-slate-950 font-mono">
                    {product.priceDemo}
                  </div>
                </div>
                <Link
                  to="/products"
                  className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-red-600 transition-colors shadow-sm"
                >
                  Chi Tiết
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. SERVICE BENEFITS SECTION (GENERAL & HONEST) */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">
              Giá Trị Cốt Lõi
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mb-3">
              Tiêu Chuẩn Phần Cứng &amp; Dịch Vụ
            </h2>
            <p className="text-sm text-slate-600">
              Cam kết mang đến trải nghiệm mua sắm linh kiện máy tính minh bạch, chuẩn xác và an tâm tuyệt đối cho mọi khách hàng.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICE_BENEFITS.map((b) => (
              <div
                key={b.id}
                className="flex flex-col items-start p-5 rounded-2xl bg-slate-50/70 border border-slate-200/60"
              >
                <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200/60 flex items-center justify-center text-red-600 mb-4">
                  {b.iconName === 'ShieldCheck' && <ShieldCheck className="w-5 h-5" />}
                  {b.iconName === 'Cpu' && <Cpu className="w-5 h-5" />}
                  {b.iconName === 'Zap' && <Zap className="w-5 h-5" />}
                  {b.iconName === 'PackageCheck' && <PackageCheck className="w-5 h-5" />}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{b.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
