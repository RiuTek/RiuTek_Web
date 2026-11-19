import { ArrowUpRight, Cpu, Layers3 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export function SidePromotionalBanners() {
  const { pathname } = useLocation()
  if (pathname !== '/' && pathname !== '/products' && !pathname.startsWith('/products/') && pathname !== '/pc-builder') return null

  return (
    <aside aria-label="Khám phá RiuTek"
      className="pointer-events-none fixed inset-x-0 top-[clamp(11rem,22vh,15rem)] z-10 hidden [@media(min-width:1536px)_and_(min-height:720px)]:block">
      <Link to="/pc-builder"
        className="pointer-events-auto absolute left-[calc(50%-756px)] flex h-90 w-26 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-linear-to-b from-slate-800 to-slate-950 p-3 text-white shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600">
        <span className="text-sm font-extrabold tracking-tight">Riu<span className="text-red-400">Tek</span></span>
        <Cpu className="my-6 size-12 shrink-0 text-red-400" strokeWidth={1.25} aria-hidden="true" />
        <span className="text-xl font-black leading-tight tracking-tight">Máy tính<br />theo ý bạn</span>
        <span className="mt-3 text-xs leading-relaxed text-slate-300">Tự chọn từng linh kiện cho bộ PC của mình.</span>
        <span className="mt-auto flex items-center justify-between gap-1 border-t border-white/15 pt-3 text-xs font-bold">
          Bắt đầu build <ArrowUpRight size={15} className="shrink-0" aria-hidden="true" />
        </span>
      </Link>
      <Link to="/products"
        className="pointer-events-auto absolute right-[calc(50%-756px)] flex h-90 w-26 flex-col overflow-hidden rounded-2xl border border-red-700 bg-linear-to-b from-red-600 to-red-800 p-3 text-white shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600">
        <span className="text-sm font-extrabold tracking-tight">RiuTek</span>
        <Layers3 className="my-6 size-12 shrink-0 text-red-100" strokeWidth={1.25} aria-hidden="true" />
        <span className="text-xl font-black leading-tight tracking-tight">Chọn đúng<br />linh kiện</span>
        <span className="mt-3 text-xs leading-relaxed text-red-100">Tìm mẫu phù hợp nhu cầu và ngân sách.</span>
        <span className="mt-auto flex items-center justify-between gap-1 border-t border-white/25 pt-3 text-xs font-bold">
          Xem sản phẩm <ArrowUpRight size={15} className="shrink-0" aria-hidden="true" />
        </span>
      </Link>
    </aside>
  )
}
