// TODO: Thay the bang URL Cloudflare R2 / Backend API khi tich hop thuc te
// Tat ca du lieu duoi day la mockup phuc vu UI Preview cho Phase 0, khong phai du lieu that.

export interface ProductCategory {
  id: string
  name: string
  description: string
  itemCount: string
  slug: string
}

export interface FeaturedProduct {
  id: string
  name: string
  brand: string
  tag: string
  specs: string[]
  priceDemo: string
  imageUrl: string
  status: 'preview'
}

export interface ServiceBenefit {
  id: string
  title: string
  description: string
  iconName: string
}

export const CATEGORIES_DATA: ProductCategory[] = [
  {
    id: 'cat-cpu',
    name: 'CPU — Bộ vi xử lý',
    description: 'Vi xử lý kiến trúc mới tối ưu đa luồng & tác vụ tính toán',
    itemCount: 'Demo Catalog',
    slug: 'cpu',
  },
  {
    id: 'cat-vga',
    name: 'Card màn hình — GPU',
    description: 'Xử lý đồ họa, Ray Tracing và tăng tốc Tensor Core',
    itemCount: 'Demo Catalog',
    slug: 'vga',
  },
  {
    id: 'cat-mainboard',
    name: 'Bo mạch chủ — Motherboard',
    description: 'Nền tảng PCIe Gen 5, cấp nguồn VRM sạch và tản nhiệt tối ưu',
    itemCount: 'Demo Catalog',
    slug: 'mainboard',
  },
  {
    id: 'cat-ram',
    name: 'Bộ nhớ RAM & Ổ cứng SSD',
    description: 'Băng thông cao DDR5 cùng tốc độ đọc ghi NVMe siêu tốc',
    itemCount: 'Demo Catalog',
    slug: 'ram-ssd',
  },
  {
    id: 'cat-psu',
    name: 'Nguồn máy tính — PSU',
    description: 'Chuẩn ATX 3.1 & PCIe 5.0 cấp nguồn ổn định cho linh kiện',
    itemCount: 'Demo Catalog',
    slug: 'psu',
  },
  {
    id: 'cat-cooling',
    name: 'Tản nhiệt & Vỏ Case',
    description: 'Lưu thông khí động học và giải pháp tản nhiệt chất lỏng',
    itemCount: 'Demo Catalog',
    slug: 'case-cooling',
  },
]

export const FEATURED_PRODUCTS_DATA: FeaturedProduct[] = [
  {
    id: 'prod-1',
    name: 'Flagship GPU Architecture Next-Gen (Demo)',
    brand: 'Apex Edition',
    tag: 'Flagship 2025',
    specs: ['32GB GDDR7', 'PCIe 5.0 Ready', 'TDP 450W Max'],
    priceDemo: '64.990.000 ₫ (Demo)',
    // TODO: Thay the bang URL Cloudflare R2 / Backend API khi tich hop
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD1C5LWi5imwQ4jrnKHQvs1OdAS2xDyG4V__wpsxk0YkMfVRT8ozaIEWYnAQQVUC_Z2r7ZA7gpc5FyTjhxnPh2YDam3pB_O7IoNCcINKMihMwYEo81St9BW9eCgsv6tn6HuxBVi202CLkbhBS4mS-axGwITrkCHpM8H-gWW8MD3YkXYWq4rzMV7vPcZVsFaTFI9Mo6c7_sNIwFgJ06-JUtNNxweayivXGzF1iuovPD8ZnuW0tWdyxY9Zw',
    status: 'preview',
  },
  {
    id: 'prod-2',
    name: 'Enthusiast Multicore CPU 16C/32T (Demo)',
    brand: 'NextGen Core',
    tag: 'Top Performance',
    specs: ['16 Cores / 32 Threads', 'Boost 5.7 GHz', '104MB Cache'],
    priceDemo: '15.490.000 ₫ (Demo)',
    // TODO: Thay the bang URL Cloudflare R2 / Backend API khi tich hop
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDgvQRfsho0V_18dr_JAs-VYnpQ1e0RvTCNG9Vj5Rz5XbilHLNWAl-DDuBVq983jCqhhoD45qprDwY1RZH5VPSSDLJnb6bwhI5md_xEUCXxu7i7YTy-KDAIdjB4oL45_w3mf6Tw4a3U4I6i1mQTEmghq9cTQmX2dGDNT1UvL7bC9Dy50hgl9K_zhsAEwrfPGrY5X99sLjwiwtb3E82WA-gdSGux5xhYIddaCt_8X0_n82YX-rVwbQJedQ',
    status: 'preview',
  },
  {
    id: 'prod-3',
    name: 'Apex Tier-1 Motherboard WiFi 7 (Demo)',
    brand: 'Titan Series',
    tag: 'PCIe 5.0',
    specs: ['Socket AM5/LGA1851', '24+2+1 Phase VRM', 'USB4 40Gbps'],
    priceDemo: '18.890.000 ₫ (Demo)',
    // TODO: Thay the bang URL Cloudflare R2 / Backend API khi tich hop
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDKe_mfS-lNG4-pgk3xOmLlpZ9Yc19oXkM6q8I7uPOhzY8zkXEEFJJI9xb7HN8YU8tmeEZPBKCAacJrl0TRR0szx4Ukgz5tRoo4Lz50TxbCF46twZ9cc-5BvGjIuNkPeVftgHmGG0ZwArdMiedxNeB5qLhcKZYyp4HtYg-5fHirHSVN4Q2lGf5zdr3uX1lNqNENZ-yTMGvHQ0Vs9_p3-utxDw4XB04UIgZcLv5-KfT3rvzE7yUjNiLHYQ',
    status: 'preview',
  },
  {
    id: 'prod-4',
    name: 'High-Speed Gen5 NVMe M.2 SSD 2TB (Demo)',
    brand: 'HyperSpeed',
    tag: '14,000 MB/s',
    specs: ['2TB Dung lượng', 'Đọc 14.500 MB/s', 'Heatsink chủ động'],
    priceDemo: '6.990.000 ₫ (Demo)',
    // TODO: Thay the bang URL Cloudflare R2 / Backend API khi tich hop
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCiku9j020zqenuKZ7jPQZJW1zIF3ZPH0H16Vgr4Hfg1odXFwvW9gK4wIeakpJk0hXRmEPUJg40yfmOT-sZbGkd7B98lTn-6P9CR6Cv-pKvg6UzxnGCA2CBJSZJfb3V-wvk1zAlES0kcmN0jiGdvYM-8wMhFX-SGdQEk4KPoQkKYpcoFUfziJl6XTnADEIQEVxMKfpSRM6kiJExektHFYHYHqGTvR2wBsQ5TfQL8ZBlNHE308ztz5kNDQ',
    status: 'preview',
  },
]

export const SERVICE_BENEFITS: ServiceBenefit[] = [
  {
    id: 'b-1',
    title: 'Phần Cứng Chuẩn Chính Hãng',
    description: 'Cam kết linh kiện nhập khẩu nguyên hộp, đầy đủ hóa đơn chứng từ và bảo hành theo hãng sản xuất.',
    iconName: 'ShieldCheck',
  },
  {
    id: 'b-2',
    title: 'Hỗ Trợ Người Mới Tự Cấu Hình',
    description: 'Hướng dẫn lựa chọn linh kiện ăn khớp, đồng bộ kích thước và kiểm tra công suất nguồn phù hợp.',
    iconName: 'Cpu',
  },
  {
    id: 'b-3',
    title: 'Tối Ưu Hiệu Năng & Tản Nhiệt',
    description: 'Tư vấn luồng gió khí động học, giải pháp làm mát thông minh và cân đối ngân sách theo nhu cầu thực tế.',
    iconName: 'Zap',
  },
  {
    id: 'b-4',
    title: 'Đóng Gói & Bảo Vệ Chuyên Nghiệp',
    description: 'Quy trình bao gói chống sốc đa tầng và bảo hiểm vận chuyển an toàn cho mọi kiện hàng linh kiện giá trị.',
    iconName: 'PackageCheck',
  },
]
