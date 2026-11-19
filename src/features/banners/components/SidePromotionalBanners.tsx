import type { CSSProperties } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const promotions = [
  { side: 'left', to: '/pc-builder', image: '/banners/pc-builder-promo.webp', heading: 'PC theo ý bạn', action: 'Tự chọn cấu hình' },
  { side: 'right', to: '/products', image: '/banners/components-promo.webp', heading: 'Nâng cấp bộ máy', action: 'Xem linh kiện' },
] as const

export function SidePromotionalBanners() {
  const { pathname } = useLocation()
  if (pathname !== '/' && pathname !== '/products' && !pathname.startsWith('/products/') && pathname !== '/pc-builder') return null

  return (
    <aside aria-label="Khám phá RiuTek"
      style={{ '--side-banner-width': 'clamp(104px, calc((100vw - 1280px) / 2 - 24px), min(240px, calc((100dvh - 240px) * 0.4)))' } as CSSProperties}
      className="pointer-events-none fixed inset-x-0 top-[clamp(10rem,18vh,13rem)] z-10 hidden [@media(min-width:1536px)_and_(min-height:720px)]:block">
      {promotions.map(promotion => (
        <Link key={promotion.side} to={promotion.to}
          className={`pointer-events-auto absolute aspect-[2/5] min-h-90 w-[var(--side-banner-width)] overflow-hidden rounded-2xl border border-slate-800 bg-black text-white shadow-xl transition-transform motion-safe:hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600 ${
            promotion.side === 'left'
              ? 'left-[calc(50%-652px-var(--side-banner-width))]'
              : 'right-[calc(50%-652px-var(--side-banner-width))]'
          }`}>
          <img src={promotion.image} alt="" width={480} height={1200} loading="lazy" decoding="async"
            className="absolute inset-0 size-full object-contain" />
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-black/30 via-transparent to-black/60" />
          <span className="absolute inset-x-0 top-0 p-[clamp(12px,1vw,20px)]">
            <span className="text-sm font-extrabold tracking-tight">Riu<span className="text-red-400">Tek</span></span>
            <span className="mt-3 block font-black leading-tight tracking-tight"
              style={{ fontSize: 'clamp(18px, calc(var(--side-banner-width) * 0.12), 28px)' }}>
              {promotion.heading}
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 p-3">
            <span className="flex min-h-10 items-center justify-between gap-1 rounded-lg border border-white/25 bg-black/40 px-2 py-2 text-xs font-bold backdrop-blur-sm">
              {promotion.action} <ArrowUpRight size={15} className="shrink-0" aria-hidden="true" />
            </span>
          </span>
        </Link>
      ))}
    </aside>
  )
}
