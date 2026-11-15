import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, LoaderCircle, MessageCircle, Minus, Package, Send, Sparkles } from 'lucide-react'
import { Link, useMatch } from 'react-router-dom'
import { executeWithAdminAuth, isContentManagerRole } from '../admin/adminGuardHelper'
import { useAuth } from '../auth/AuthContext'
import { formatVnd } from '../products/productConstants'
import { ApiError } from '../../lib/api'
import { AI_HISTORY_LIMIT, AI_MESSAGE_LIMIT, askAiChat, type AiChatReply } from './aiChatApi'

interface ChatTurn {
  id: number
  question: string
  reply: AiChatReply
}

function httpsUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

function chatError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Bạn đã dùng hết lượt hỏi hiện tại. Vui lòng thử lại sau.'
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Bạn vui lòng đăng nhập lại.'
    if (error.status === 403) return 'Tài khoản này chưa có quyền dùng thử tư vấn AI.'
  }
  return 'Tư vấn AI đang gián đoạn. Bạn có thể gửi lại câu hỏi sau ít phút.'
}

function ProductThumbnail({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false)
  const src = httpsUrl(url)

  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
      {src && !failed ? (
        <img src={src} alt="" width={48} height={48} loading="lazy" decoding="async"
          className="size-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <Package className="size-5 text-slate-400" aria-hidden="true" />
      )}
    </span>
  )
}

function ChatReply({ reply }: { reply: AiChatReply }) {
  return (
    <div className="space-y-3 rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-3 text-sm text-slate-800">
      <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{reply.answer}</p>
      {reply.products.length > 0 && (
        <ul className="space-y-2">
          {reply.products.map((product) => (
            <li key={product.sku}>
              <Link
                to={`/products/${encodeURIComponent(product.slug)}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 hover:border-red-300"
              >
                <ProductThumbnail key={product.imageUrl} url={product.imageUrl} />
                <span className="min-w-0">
                  <span className="block wrap-break-word font-semibold text-slate-900">{product.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-red-700">{formatVnd(product.priceVnd)}</span>
                    <span className={product.isActive && product.inStock ? 'text-emerald-800' : 'text-slate-600'}>
                      {product.isActive ? (product.inStock ? 'Còn hàng' : 'Hết hàng') : 'Ngừng bán'}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {reply.sources.length > 0 && (
        <div className="border-t border-slate-200 pt-2 text-xs text-slate-600">
          <p className="mb-1 font-semibold">Nguồn tham khảo</p>
          <ul className="space-y-1">
            {reply.sources.map((source, index) => {
              const href = httpsUrl(source.url)
              return (
                <li key={index} className="wrap-break-word">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-red-800 underline underline-offset-2">
                      {source.title}
                      <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
                    </a>
                  ) : source.title}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export function StaffAiChat() {
  const { status, isAuthenticated, user } = useAuth()
  if (status !== 'authenticated' || !isAuthenticated || !user?.id || !isContentManagerRole(user.role)) {
    return null
  }

  return <AiChat key={user.id} />
}

function AiChat() {
  const { status, user, getAccessToken } = useAuth()
  const slug = useMatch('/products/:slug')?.params.slug
  const productSlug = slug && slug.length <= 200 ? slug : undefined
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [pendingQuestion, setPendingQuestion] = useState('')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const nextId = useRef(0)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)

  useEffect(() => () => request.current?.abort(), [])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [open, turns, pendingQuestion, error])

  function minimize() {
    setOpen(false)
    launcher.current?.focus()
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = draft.trim()
    if (!question || question.length > AI_MESSAGE_LIMIT || request.current) return

    const controller = new AbortController()
    request.current = controller
    setPendingQuestion(question)
    setError('')
    const history = turns.slice(-(AI_HISTORY_LIMIT / 2)).flatMap((turn) => [
      { role: 'user' as const, content: turn.question },
      { role: 'assistant' as const, content: turn.reply.answer.trim().slice(0, AI_MESSAGE_LIMIT) },
    ]).filter((message) => message.content.trim().length > 0)

    try {
      const reply = await executeWithAdminAuth({
        authStatus: status,
        user,
        getAccessToken,
        isContextCurrent: () => !controller.signal.aborted,
        operation: (token) => askAiChat({ question, productSlug, history }, token, controller.signal),
      })
      if (controller.signal.aborted) return
      if (typeof reply?.answer !== 'string' || !reply.answer.trim() ||
          !Array.isArray(reply.products) || !Array.isArray(reply.sources)) {
        throw new Error('Invalid chat response')
      }
      const turn = { id: nextId.current++, question, reply }
      setTurns((previous) => [...previous, turn])
      setDraft('')
    } catch (cause) {
      if (!controller.signal.aborted) setError(chatError(cause))
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setPendingQuestion('')
    }
  }

  return (
    <aside className="pointer-events-none fixed inset-x-3 bottom-4 z-40 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6">
      {open && (
        <section
          id={panelId}
          aria-labelledby={`${panelId}-title`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              minimize()
            }
          }}
          className="pointer-events-auto flex h-[min(34rem,calc(100dvh-6rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[26rem]"
        >
          <div className="flex items-center gap-3 bg-slate-950 p-3.5 text-white">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-600">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`${panelId}-title`} className="text-sm font-bold">Tư vấn AI RiuTek</h2>
              <p className="text-xs text-slate-300">Dùng thử nội bộ</p>
            </div>
            <button type="button" aria-label="Thu gọn khung chat" onClick={minimize}
              className="grid size-9 place-items-center rounded-lg hover:bg-slate-800">
              <Minus size={18} aria-hidden="true" />
            </button>
          </div>
          <div ref={log} role="log" aria-label="Cuộc trò chuyện" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3.5">
            <p className="rounded-2xl rounded-tl-sm bg-slate-100 p-3.5 text-sm leading-relaxed text-slate-700">
              Dạ, bạn muốn hỏi về thông số, tình trạng hàng hay tìm linh kiện theo ngân sách?
            </p>
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-2">
                <p className="ml-8 rounded-2xl rounded-br-sm bg-red-700 px-3.5 py-2.5 text-sm whitespace-pre-wrap wrap-break-word text-white">
                  {turn.question}
                </p>
                <ChatReply reply={turn.reply} />
              </div>
            ))}
            {pendingQuestion && (
              <div className="space-y-2">
                <p className="ml-8 rounded-2xl rounded-br-sm bg-red-700 px-3.5 py-2.5 text-sm whitespace-pre-wrap wrap-break-word text-white">
                  {pendingQuestion}
                </p>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  Đang kiểm tra thông tin…
                </p>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          </div>
          <form onSubmit={send} className="border-t border-slate-200 p-3">
            {productSlug && <p className="mb-2 text-xs text-slate-600">Đang tư vấn theo sản phẩm trên trang này</p>}
            <div className="flex items-end gap-2">
              <textarea
                ref={input}
                aria-label="Câu hỏi tư vấn"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                readOnly={!!pendingQuestion}
                rows={2}
                maxLength={AI_MESSAGE_LIMIT}
                placeholder="Nhập câu hỏi về linh kiện…"
                className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-red-600"
              />
              <button type="submit" aria-label="Gửi câu hỏi" disabled={!draft.trim() || !!pendingQuestion}
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-700 text-white hover:bg-red-800 disabled:opacity-50">
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (open) minimize()
          else {
            setHasOpened(true)
            setOpen(true)
          }
        }}
        className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-red-700 px-3 text-sm font-semibold text-white shadow-lg shadow-red-900/25 ring-2 ring-red-200 ring-offset-2 hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700"
      >
        <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-white/15">
          {open ? <Minus size={18} aria-hidden="true" /> : <MessageCircle size={18} aria-hidden="true" />}
          {!hasOpened && (
            <Sparkles className="absolute -right-1 -top-1 size-3 text-amber-200 motion-safe:animate-[pulse_1.2s_ease-in-out_3]" aria-hidden="true" />
          )}
        </span>
        <span className="pr-1">{open ? 'Thu gọn' : 'Hỏi tư vấn AI'}</span>
      </button>
    </aside>
  )
}
