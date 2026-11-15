import { useEffect, useState } from 'react'
import { ApiError } from '../../../lib/api'
import type { AiBuildTransfer } from '../pcBuilderDraftStorage'

interface Props {
  transfer: AiBuildTransfer
  draftReady: boolean
  needsConfirmation: boolean
  onApply: (transfer: AiBuildTransfer, signal: AbortSignal) => Promise<void>
  onDismiss: () => void
}

export function AiBuildHandoff({ transfer, draftReady, needsConfirmation, onApply, onDismiss }: Props) {
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const shouldApply = draftReady && (!needsConfirmation || attempt > 0)

  useEffect(() => {
    if (!shouldApply) return
    const controller = new AbortController()
    onApply(transfer, controller.signal)
      .then(() => { if (!controller.signal.aborted) onDismiss() })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof ApiError && cause.status === 404
          ? 'Có linh kiện không còn trong danh mục. Bạn có thể hỏi AI để lấy gợi ý mới.'
          : cause instanceof Error ? cause.message : 'Không thể kiểm tra cấu hình AI. Bạn vui lòng thử lại.')
      })
    return () => controller.abort()
  }, [attempt, onApply, onDismiss, shouldApply, transfer])

  return (
    <section aria-label="Cấu hình từ tư vấn AI" className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-900">
      {error ? <p role="alert">{error} Bản nháp cũ vẫn được giữ.</p> : (
        <p role="status">{!draftReady ? 'Đang kiểm tra bản nháp hiện tại…' : shouldApply
          ? 'Đang cập nhật giá, tồn kho và tương thích cho cấu hình AI…'
          : 'Bạn đã có bản nháp. Bạn muốn thay bằng cấu hình AI vừa chọn không?'}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {draftReady && (!shouldApply || error) && (
          <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-700"
            onClick={() => { setError(null); setAttempt(value => value + 1) }}>
            {error ? 'Thử lại' : 'Thay bản nháp'}
          </button>
        )}
        <button type="button" onClick={onDismiss} className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-blue-100">
          {needsConfirmation ? 'Giữ bản nháp hiện tại' : 'Hủy mở cấu hình'}
        </button>
      </div>
    </section>
  )
}
