import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  PlusCircle,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { executeWithAdminAuth } from '../../features/admin/adminGuardHelper'
import { mapAdminApiError } from '../../features/admin/adminConstants'
import type {
  BannerDraft,
  CreateBannerRequest,
  ManagedBannerDto,
  UpdateBannerRequest,
} from '../../features/banners/bannerTypes'
import {
  createBanner,
  deleteBanner,
  getManagedBanners,
  updateBanner,
} from '../../features/banners/bannerApi'
import {
  isSafeInternalTargetUrl,
  uploadBannerImage,
  validateBannerDisplayOrder,
  validateBannerTargetUrl,
  validateBannerTitle,
} from '../../features/banners/bannerHelper'

function createEmptyBannerDraft(): BannerDraft {
  return {
    title: '',
    imageObjectKey: '',
    imageUrl: '',
    targetUrl: '',
    displayOrder: 0,
    isActive: false,
  }
}

export const AdminBannersPage: React.FC = () => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? ''

  const [banners, setBanners] = useState<ManagedBannerDto[]>([])
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listError, setListError] = useState<string | null>(null)

  // Form state
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<BannerDraft>(createEmptyBannerDraft)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formApiError, setFormApiError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [selectedFileForRetry, setSelectedFileForRetry] = useState<File | null>(null)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ManagedBannerDto | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Lifecycle refs
  const isMountedRef = useRef(true)
  const ownerIdRef = useRef(ownerId)
  const reqSeqRef = useRef(0)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const isSavingRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    ownerIdRef.current = ownerId
    return () => {
      isMountedRef.current = false
      if (uploadAbortRef.current) {
        uploadAbortRef.current.abort()
      }
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl)
      }
    }
  }, [ownerId, previewBlobUrl])

  // Tải danh sách banner quản trị
  const loadBanners = useCallback(
    async (signal?: AbortSignal) => {
      const seq = ++reqSeqRef.current
      await Promise.resolve()
      if (!isMountedRef.current || reqSeqRef.current !== seq) return
      setListStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
      setListError(null)

      try {
        const data = await executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent: () => isMountedRef.current && ownerIdRef.current === ownerId,
          operation: (token) => getManagedBanners(token, signal),
        })

        if (!isMountedRef.current || reqSeqRef.current !== seq) return
        setBanners(Array.isArray(data) ? data : [])
        setListStatus('ready')
      } catch (err: unknown) {
        if (!isMountedRef.current || reqSeqRef.current !== seq) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = mapAdminApiError(err)
        setListError(msg)
        setListStatus('error')
      }
    },
    [authStatus, user, getAccessToken, ownerId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadBanners(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadBanners])

  // Xử lý dọn dẹp preview object URL
  const cleanupPreviewBlob = useCallback(() => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl)
      setPreviewBlobUrl(null)
    }
  }, [previewBlobUrl])

  // Bắt đầu upload file ảnh mới
  const handleStartImageUpload = async (file: File) => {
    // Nếu đang có upload cũ dở dang, hủy nó
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort()
    }
    const controller = new AbortController()
    uploadAbortRef.current = controller

    cleanupPreviewBlob()
    const localBlob = URL.createObjectURL(file)
    setPreviewBlobUrl(localBlob)
    setSelectedFileForRetry(file)

    setIsUploading(true)
    setUploadError(null)
    setUploadProgressMsg('Đang chuẩn bị tải ảnh lên kho lưu trữ R2...')

    try {
      setUploadProgressMsg('Đang tải tệp lên Cloudflare R2...')
      const result = await executeWithAdminAuth({
        authStatus,
        user,
        getAccessToken,
        isContextCurrent: () => isMountedRef.current && !controller.signal.aborted,
        operation: (token) =>
          uploadBannerImage({
            file,
            token,
            signal: controller.signal,
          }),
      })

      if (!isMountedRef.current || controller.signal.aborted) return

      // Upload thành công -> cập nhật draft với objectKey và imageUrl đã confirm
      setDraft((prev) => ({
        ...prev,
        imageObjectKey: result.objectKey,
        imageUrl: result.publicUrl,
      }))
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next.image
        return next
      })
      setUploadProgressMsg(null)
    } catch (err: unknown) {
      if (!isMountedRef.current || controller.signal.aborted) return
      if (err instanceof DOMException && err.name === 'AbortError') return

      let errMsg = 'Tải ảnh lên kho lưu trữ thất bại.'
      if (err instanceof Error) {
        errMsg = err.message
      }
      setUploadError(errMsg)
      setUploadProgressMsg(null)
    } finally {
      if (isMountedRef.current && uploadAbortRef.current === controller) {
        setIsUploading(false)
      }
    }
  }

  // Chọn banner để chỉnh sửa
  const handleSelectEdit = (banner: ManagedBannerDto) => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort()
      uploadAbortRef.current = null
    }
    cleanupPreviewBlob()

    setFormMode('edit')
    setEditingId(banner.id)
    setDraft({
      title: banner.title,
      imageObjectKey: banner.imageObjectKey,
      imageUrl: banner.imageUrl,
      targetUrl: banner.targetUrl,
      displayOrder: banner.displayOrder,
      isActive: banner.isActive,
    })
    setFieldErrors({})
    setFormApiError(null)
    setFormSuccess(null)
    setUploadError(null)
    setSelectedFileForRetry(null)
  }

  // Hủy chế độ chỉnh sửa -> quay về form thêm mới
  const handleCancelEdit = () => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort()
      uploadAbortRef.current = null
    }
    cleanupPreviewBlob()

    setFormMode('create')
    setEditingId(null)
    setDraft(createEmptyBannerDraft())
    setFieldErrors({})
    setFormApiError(null)
    setFormSuccess(null)
    setUploadError(null)
    setSelectedFileForRetry(null)
  }

  // Kiểm tra tính hợp lệ toàn bộ form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    const titleCheck = validateBannerTitle(draft.title)
    if (!titleCheck.isValid && titleCheck.error) {
      errors.title = titleCheck.error
    }

    const urlCheck = validateBannerTargetUrl(draft.targetUrl)
    if (!urlCheck.isValid && urlCheck.error) {
      errors.targetUrl = urlCheck.error
    }

    const orderCheck = validateBannerDisplayOrder(draft.displayOrder)
    if (!orderCheck.isValid && orderCheck.error) {
      errors.displayOrder = orderCheck.error
    }

    if (!draft.imageObjectKey || draft.imageObjectKey.trim() === '') {
      errors.image = 'Vui lòng chọn và tải lên ảnh banner trước khi lưu.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Lưu Banner (Tạo mới hoặc Cập nhật)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSavingRef.current || isSaving || isUploading) return

    setFormApiError(null)
    setFormSuccess(null)

    if (!validateForm()) return

    const orderCheck = validateBannerDisplayOrder(draft.displayOrder)
    const normalizedOrder = orderCheck.isValid ? orderCheck.value : 0

    isSavingRef.current = true
    setIsSaving(true)

    try {
      if (formMode === 'create') {
        const payload: CreateBannerRequest = {
          title: draft.title.trim(),
          imageObjectKey: draft.imageObjectKey.trim(),
          targetUrl: draft.targetUrl.trim(),
          displayOrder: normalizedOrder,
          isActive: Boolean(draft.isActive),
        }

        const created = await executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent: () => isMountedRef.current && ownerIdRef.current === ownerId,
          operation: (token) => createBanner(payload, token),
        })

        if (!isMountedRef.current) return

        setFormSuccess(`Đã tạo thành công banner "${created.title}".`)
        handleCancelEdit()
        void loadBanners()
      } else {
        if (!editingId) return

        const payload: UpdateBannerRequest = {
          title: draft.title.trim(),
          imageObjectKey: draft.imageObjectKey.trim(),
          targetUrl: draft.targetUrl.trim(),
          displayOrder: normalizedOrder,
          isActive: Boolean(draft.isActive),
        }

        const updated = await executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent: () => isMountedRef.current && ownerIdRef.current === ownerId,
          operation: (token) => updateBanner(editingId, payload, token),
        })

        if (!isMountedRef.current) return

        setFormSuccess(`Đã cập nhật banner "${updated.title}".`)
        void loadBanners()
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = mapAdminApiError(err)
      setFormApiError(msg)
    } finally {
      if (isMountedRef.current) {
        isSavingRef.current = false
        setIsSaving(false)
      }
    }
  }

  // Thực hiện Xóa Banner
  const handleExecuteDelete = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      await executeWithAdminAuth({
        authStatus,
        user,
        getAccessToken,
        isContextCurrent: () => isMountedRef.current && ownerIdRef.current === ownerId,
        operation: (token) => deleteBanner(deleteTarget.id, token),
      })

      if (!isMountedRef.current) return

      // Nếu banner đang được chỉnh sửa bị xóa, reset form
      if (editingId === deleteTarget.id) {
        handleCancelEdit()
      }

      setDeleteTarget(null)
      void loadBanners()
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      let msg = mapAdminApiError(err)
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 409) {
        msg = 'Không thể xóa banner vì tài nguyên ảnh đang được tham chiếu bởi bản ghi khác.'
      }
      setDeleteError(msg)
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ImageIcon className="w-7 h-7 text-red-600" />
            <span>Quản Lý Banner Quảng Cáo</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản trị banner carousel trang chủ, liên kết sản phẩm và phân loại linh kiện.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadBanners()}
          disabled={listStatus === 'loading'}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${listStatus === 'loading' ? 'animate-spin' : ''}`}
          />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Main Grid: Left Column = List, Right Column = Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Banners List (8 cols on lg) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Danh Sách Banner</h2>
                <p className="text-xs text-slate-500">
                  Tổng số: <strong className="text-slate-900">{banners.length}</strong> banner (sắp xếp theo thứ tự hiển thị)
                </p>
              </div>
            </div>

            {/* List Body */}
            {listStatus === 'loading' && (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Đang tải danh sách banner...</p>
              </div>
            )}

            {listStatus === 'error' && (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Không thể tải dữ liệu banner</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">{listError}</p>
                <button
                  type="button"
                  onClick={() => void loadBanners()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại</span>
                </button>
              </div>
            )}

            {listStatus === 'ready' && banners.length === 0 && (
              <div className="p-12 text-center space-y-2">
                <ImageIcon className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">Chưa có banner nào</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Sử dụng biểu mẫu bên cạnh để tạo banner đầu tiên cho trang chủ RiuTek.
                </p>
              </div>
            )}

            {listStatus === 'ready' && banners.length > 0 && (
              <div className="divide-y divide-slate-100">
                {banners.map((item) => {
                  const isBeingEdited = editingId === item.id
                  const isSafeUrl = isSafeInternalTargetUrl(item.targetUrl)

                  return (
                    <div
                      key={item.id}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between transition-colors ${
                        isBeingEdited ? 'bg-red-50/50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Thumbnail & Info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-24 h-14 sm:w-32 sm:h-18 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden relative">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        {/* Title, Target, Order */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                item.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {item.isActive ? 'Đang bật' : 'Đang tắt'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              Thứ tự: <strong>{item.displayOrder}</strong>
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {item.title}
                          </h3>

                          <div className="text-xs text-slate-500 truncate flex items-center gap-1 font-mono">
                            <span className="text-slate-400">Đích:</span>
                            {isSafeUrl ? (
                              <Link
                                to={item.targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-red-600 hover:underline truncate inline-flex items-center gap-1"
                              >
                                <span>{item.targetUrl}</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              </Link>
                            ) : (
                              <span className="text-slate-600 truncate">{item.targetUrl}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectEdit(item)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isBeingEdited
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isBeingEdited ? 'Đang sửa' : 'Sửa'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(item)
                            setDeleteError(null)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Xóa banner"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Create / Edit Form (4-5 cols on lg) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div className="flex items-center gap-2">
                {formMode === 'create' ? (
                  <PlusCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Edit3 className="w-5 h-5 text-red-600" />
                )}
                <h2 className="text-base font-bold text-slate-900">
                  {formMode === 'create' ? 'Tạo Banner Mới' : 'Chỉnh Sửa Banner'}
                </h2>
              </div>

              {formMode === 'edit' && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Hủy sửa
                </button>
              )}
            </div>

            {/* Notification messages */}
            {formSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {formApiError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formApiError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Tiêu đề */}
              <div className="space-y-1">
                <label
                  htmlFor="banner-title"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Tiêu đề banner <span className="text-red-600">*</span>
                </label>
                <input
                  id="banner-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => {
                    const val = e.target.value
                    setDraft((prev) => ({ ...prev, title: val }))
                    if (fieldErrors.title) {
                      setFieldErrors((prev) => {
                        const next = { ...prev }
                        delete next.title
                        return next
                      })
                    }
                  }}
                  maxLength={160}
                  placeholder="Ví dụ: Đại Tiệc Siêu Card Màn Hình RTX 40-Series"
                  className={`w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border rounded-xl outline-none transition ${
                    fieldErrors.title
                      ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                      : 'border-slate-300 focus:border-red-600'
                  }`}
                />
                {fieldErrors.title && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.title}</p>
                )}
              </div>

              {/* 2. Ảnh Banner & Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Ảnh banner <span className="text-red-600">*</span>
                </label>

                {/* Preview Box */}
                {(previewBlobUrl || draft.imageUrl) ? (
                  <div className="space-y-2">
                    <div className="relative w-full aspect-[16/7] rounded-xl overflow-hidden bg-slate-950 border border-slate-200 flex items-center justify-center">
                      <img
                        src={previewBlobUrl || draft.imageUrl}
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                      />
                      {isUploading && (
                        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-red-500 mb-2" />
                          <span className="text-xs font-semibold">
                            {uploadProgressMsg || 'Đang tải ảnh lên...'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <label className="cursor-pointer text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1">
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Chọn ảnh khác</span>
                        <input
                          type="file"
                          accept=".jpg,.png,.webp,image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={isUploading || isSaving}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              void handleStartImageUpload(file)
                            }
                            e.target.value = ''
                          }}
                        />
                      </label>

                      {draft.imageObjectKey && (
                        <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đã xác nhận R2</span>
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Upload Dropzone / Picker */
                  <label className="block w-full border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-red-50/20">
                    <div className="space-y-2 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                        <ImagePlus className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        Nhấn để chọn ảnh từ máy tính
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Hỗ trợ .jpg, .png, .webp (tối đa 5 MiB)
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".jpg,.png,.webp,image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={isUploading || isSaving}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          void handleStartImageUpload(file)
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}

                {/* Upload Error / Retry */}
                {uploadError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{uploadError}</span>
                    </div>
                    {selectedFileForRetry && (
                      <button
                        type="button"
                        onClick={() => void handleStartImageUpload(selectedFileForRetry)}
                        className="inline-flex items-center gap-1 font-bold text-red-600 hover:underline pt-0.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Thử lại tải ảnh</span>
                      </button>
                    )}
                  </div>
                )}

                {fieldErrors.image && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.image}</p>
                )}
              </div>

              {/* 3. Đường dẫn đích (targetUrl) */}
              <div className="space-y-1">
                <label
                  htmlFor="banner-target-url"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Đường dẫn liên kết (Target URL) <span className="text-red-600">*</span>
                </label>
                <input
                  id="banner-target-url"
                  type="text"
                  value={draft.targetUrl}
                  onChange={(e) => {
                    const val = e.target.value
                    setDraft((prev) => ({ ...prev, targetUrl: val }))
                    if (fieldErrors.targetUrl) {
                      setFieldErrors((prev) => {
                        const next = { ...prev }
                        delete next.targetUrl
                        return next
                      })
                    }
                  }}
                  maxLength={2048}
                  placeholder="/products/intel-core-i5-13400f"
                  className={`w-full px-3.5 py-2.5 text-xs text-slate-900 font-mono bg-white border rounded-xl outline-none transition ${
                    fieldErrors.targetUrl
                      ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                      : 'border-slate-300 focus:border-red-600'
                  }`}
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Đường dẫn nội bộ bắt đầu bằng dấu /, ví dụ: <code className="text-red-600 font-mono">/products/&lt;slug&gt;</code>, <code className="text-red-600 font-mono">/products?categoryId=&lt;id&gt;</code>, <code className="text-red-600 font-mono">/pc-builder</code>.
                </p>
                {fieldErrors.targetUrl && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.targetUrl}</p>
                )}
              </div>

              {/* 4. Thứ tự hiển thị & Trạng thái */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label
                    htmlFor="banner-display-order"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Thứ tự hiển thị
                  </label>
                  <input
                    id="banner-display-order"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.displayOrder}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setDraft((prev) => ({ ...prev, displayOrder: val }))
                      if (fieldErrors.displayOrder) {
                        setFieldErrors((prev) => {
                          const next = { ...prev }
                          delete next.displayOrder
                          return next
                        })
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border rounded-xl outline-none transition ${
                      fieldErrors.displayOrder
                        ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                        : 'border-slate-300 focus:border-red-600'
                    }`}
                  />
                  {fieldErrors.displayOrder && (
                    <p className="text-[11px] text-rose-600">{fieldErrors.displayOrder}</p>
                  )}
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 cursor-pointer py-2.5">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, isActive: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Bật hiển thị
                    </span>
                  </label>
                </div>
              </div>

              {/* Note banner dimensions */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                <strong>Gợi ý thiết kế:</strong> Kích thước banner khuyến nghị là 1600x600 px (tỉ lệ ~8:3). Đặt các nội dung chữ quan trọng vào vùng giữa để hiển thị rõ ràng trên cả máy tính và điện thoại.
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSaving || isUploading || (!draft.imageObjectKey && formMode === 'create')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-red-600/25 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{formMode === 'create' ? 'Tạo banner' : 'Lưu thay đổi'}</span>
                    </>
                  )}
                </button>

                {formMode === 'edit' && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in-50 duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Xác nhận xóa banner</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa banner{' '}
              <strong className="text-slate-900">"{deleteTarget.title}"</strong>?
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              <strong>Lưu ý:</strong> Thao tác này chỉ xóa bản ghi cấu hình banner trên hệ thống, không xóa tệp ảnh đã lưu trên Cloudflare R2 để tránh ảnh hưởng đến các sản phẩm hoặc tài nguyên khác có thể đang sử dụng chung ảnh.
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
