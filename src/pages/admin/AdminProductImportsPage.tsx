import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import {
  commitProductImport,
  confirmProductMediaUpload,
  createProductMediaUploadRequest,
  downloadProductImportTemplate,
  inspectProductImportWorkbook,
  validateProductImport,
} from '../../features/admin/adminApi'
import { mapAdminApiError } from '../../features/admin/adminConstants'
import { executeWithAdminAuth } from '../../features/admin/adminGuardHelper'
import {
  buildConfirmedImageMappings,
  buildFolderInventory,
  canCommitValidatedImport,
  createImportSnapshotSignature,
  createObjectUrlPool,
  createUploadTasksFromMatchSummary,
  executeMatchedImagesUpload,
  executeProductImportCommit,
  matchInspectRowsWithFolder,
  triggerBrowserBlobDownload,
  validateWorkbookFile,
  type FolderInventoryResult,
  type LocalFolderFileInput,
  type SkuFolderMatchSummary,
  type UploadTaskItem,
} from '../../features/admin/adminProductImportHelper'
import type {
  ProductImportCommitResultDto,
  ProductImportInspectResultDto,
  ProductImportValidationResultDto,
} from '../../features/admin/adminTypes'

const MATCH_TABLE_PAGE_SIZE = 15
const ERROR_TABLE_PAGE_SIZE = 20

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const AdminProductImportsPage: React.FC = () => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? null

  const [showGuide, setShowGuide] = useState(true)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const [workbookFile, setWorkbookFile] = useState<File | null>(null)
  const [workbookError, setWorkbookError] = useState<string | null>(null)

  const [folderFiles, setFolderFiles] = useState<LocalFolderFileInput[]>([])
  const [folderInventory, setFolderInventory] =
    useState<FolderInventoryResult | null>(null)

  const [isInspecting, setIsInspecting] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [inspectResult, setInspectResult] =
    useState<ProductImportInspectResultDto | null>(null)

  const [confirmedUrlOverride, setConfirmedUrlOverride] = useState(false)
  const [uploadTasks, setUploadTasks] = useState<UploadTaskItem[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [uploadGlobalError, setUploadGlobalError] = useState<string | null>(null)
  const [hasCorsUploadError, setHasCorsUploadError] = useState(false)

  const [isValidating, setIsValidating] = useState(false)
  const [validateApiError, setValidateApiError] = useState<string | null>(null)
  const [validationResult, setValidationResult] =
    useState<ProductImportValidationResultDto | null>(null)
  const [validatedSignature, setValidatedSignature] = useState<string | null>(
    null
  )

  const [isCommitting, setIsCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [isAmbiguousCommitError, setIsAmbiguousCommitError] = useState(false)
  const [commitResult, setCommitResult] =
    useState<ProductImportCommitResultDto | null>(null)

  const [matchPage, setMatchPage] = useState(1)
  const [errorPage, setErrorPage] = useState(1)
  const [previewUrlMap, setPreviewUrlMap] = useState<Record<string, string>>({})

  const supportsDirectoryPicker = useMemo(() => {
    if (typeof document === 'undefined') return true
    const input = document.createElement('input')
    return 'webkitdirectory' in input
  }, [])

  const mountedRef = useRef(true)
  const ownerIdRef = useRef<string | null>(ownerId)
  const operationSeqRef = useRef(0)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const previewPoolRef = useRef(createObjectUrlPool())
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '')
      folderInputRef.current.setAttribute('directory', '')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    ownerIdRef.current = ownerId
    const pool = previewPoolRef.current
    return () => {
      mountedRef.current = false
      operationSeqRef.current += 1
      uploadAbortRef.current?.abort()
      pool.revokeAll()
    }
  }, [ownerId])

  // Ghép kết quả inspect với folderInventory
  const matchSummary: SkuFolderMatchSummary | null = useMemo(() => {
    if (!inspectResult) return null
    return matchInspectRowsWithFolder({
      inspectResult,
      folderInventory,
    })
  }, [inspectResult, folderInventory])

  // Xây dựng imageMappings từ các task đã confirmed
  const confirmedMappingsBuild = useMemo(() => {
    if (!matchSummary) {
      return {
        isValid: true,
        errors: [],
        mappings: [],
        jsonByteLength: 2,
      }
    }
    return buildConfirmedImageMappings(matchSummary, uploadTasks)
  }, [matchSummary, uploadTasks])

  const currentSnapshotSignature = useMemo(
    () =>
      createImportSnapshotSignature({
        workbookFile,
        imageMappings: confirmedMappingsBuild.mappings,
      }),
    [workbookFile, confirmedMappingsBuild.mappings]
  )

  // Trạng thái tổng hợp của Upload Tasks
  const uploadStats = useMemo(() => {
    const total = uploadTasks.length
    const confirmed = uploadTasks.filter(
      (t) => t.status === 'confirmed' && Boolean(t.confirmedMedia?.objectKey)
    ).length
    const failed = uploadTasks.filter((t) => t.status === 'error').length
    const inFlight = uploadTasks.filter(
      (t) => t.status === 'uploading' || t.status === 'confirming'
    ).length
    const allConfirmed = total > 0 && confirmed === total
    return { total, confirmed, failed, inFlight, allConfirmed }
  }, [uploadTasks])

  // Cảnh báo trình duyệt khi đang có tiến trình chưa lưu trên bộ nhớ
  const hasActiveWorkInMemory =
    Boolean(workbookFile) && !commitResult?.isCommitted
  useEffect(() => {
    if (!hasActiveWorkInMemory) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasActiveWorkInMemory])

  // Khi người dùng thay đổi file Excel hoặc thư mục ảnh -> vô hiệu hóa ngay kết quả validate/commit cũ
  const invalidateDownstreamValidation = useCallback(() => {
    setValidationResult(null)
    setValidatedSignature(null)
    setValidateApiError(null)
    setCommitResult(null)
    setCommitError(null)
    setIsAmbiguousCommitError(false)
    setErrorPage(1)
  }, [])

  const handleDownloadTemplate = async () => {
    if (isDownloadingTemplate) return
    setIsDownloadingTemplate(true)
    setTemplateError(null)

    const activeOwner = ownerIdRef.current
    const checkCurrent = () =>
      mountedRef.current && ownerIdRef.current === activeOwner

    try {
      const response = await executeWithAdminAuth({
        authStatus,
        user,
        getAccessToken,
        isContextCurrent: checkCurrent,
        operation: (token) => downloadProductImportTemplate(token),
      })

      if (!checkCurrent()) return
      triggerBrowserBlobDownload({
        blob: response.blob,
        fileName: response.fileName,
      })
    } catch (err: unknown) {
      if (!checkCurrent()) return
      setTemplateError(
        mapAdminApiError(
          err,
          'Không thể tải xuống file mẫu Excel. Vui lòng thử lại.'
        )
      )
    } finally {
      if (checkCurrent()) {
        setIsDownloadingTemplate(false)
      }
    }
  }

  const handleWorkbookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    uploadAbortRef.current?.abort()
    setIsUploadingImages(false)
    invalidateDownstreamValidation()
    setInspectResult(null)
    setInspectError(null)
    setUploadTasks([])
    setUploadGlobalError(null)
    setHasCorsUploadError(false)
    setConfirmedUrlOverride(false)
    setMatchPage(1)

    if (!selected) {
      setWorkbookFile(null)
      setWorkbookError(null)
      return
    }

    const check = validateWorkbookFile(selected)
    if (!check.isValid) {
      setWorkbookFile(null)
      setWorkbookError(check.error)
      return
    }

    setWorkbookFile(selected)
    setWorkbookError(null)
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    uploadAbortRef.current?.abort()
    setIsUploadingImages(false)
    previewPoolRef.current.revokeAll()
    invalidateDownstreamValidation()
    setUploadGlobalError(null)
    setHasCorsUploadError(false)
    setConfirmedUrlOverride(false)
    setMatchPage(1)

    if (!fileList || fileList.length === 0) {
      setFolderFiles([])
      setFolderInventory(null)
      setPreviewUrlMap({})
      setUploadTasks([])
      return
    }

    const inputs: LocalFolderFileInput[] = Array.from(fileList).map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      webkitRelativePath:
        (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
        f.name,
    }))

    const inv = buildFolderInventory(inputs)
    const nextPreviewMap: Record<string, string> = {}
    for (const bucket of inv.skuBuckets.values()) {
      for (const entry of bucket.files) {
        if (!entry.validationError) {
          nextPreviewMap[entry.relativePath] =
            previewPoolRef.current.getOrCreate(entry.relativePath, entry.file)
        }
      }
    }
    setPreviewUrlMap(nextPreviewMap)
    setFolderFiles(inputs)
    setFolderInventory(inv)

    if (inspectResult) {
      const nextSummary = matchInspectRowsWithFolder({
        inspectResult,
        folderInventory: inv,
      })
      setUploadTasks(createUploadTasksFromMatchSummary(nextSummary))
    } else {
      setUploadTasks([])
    }
  }

  const handleClearFolder = () => {
    uploadAbortRef.current?.abort()
    setIsUploadingImages(false)
    previewPoolRef.current.revokeAll()
    setPreviewUrlMap({})
    invalidateDownstreamValidation()
    setFolderFiles([])
    setFolderInventory(null)
    setUploadTasks([])
    setUploadGlobalError(null)
    setHasCorsUploadError(false)
    setConfirmedUrlOverride(false)
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  const handleInspectWorkbook = async () => {
    if (!workbookFile || isInspecting || isUploadingImages || isValidating || isCommitting) {
      return
    }

    const fileCheck = validateWorkbookFile(workbookFile)
    if (!fileCheck.isValid) {
      setWorkbookError(fileCheck.error)
      return
    }

    const seq = ++operationSeqRef.current
    const activeOwner = ownerIdRef.current
    const checkCurrent = () =>
      mountedRef.current &&
      ownerIdRef.current === activeOwner &&
      operationSeqRef.current === seq

    invalidateDownstreamValidation()
    setInspectError(null)
    setUploadGlobalError(null)
    setHasCorsUploadError(false)
    setIsInspecting(true)

    try {
      const result = await executeWithAdminAuth({
        authStatus,
        user,
        getAccessToken,
        isContextCurrent: checkCurrent,
        operation: (token) =>
          inspectProductImportWorkbook(workbookFile, token, workbookFile.name),
      })

      if (!checkCurrent()) return
      setInspectResult(result)
      setMatchPage(1)

      const summary = matchInspectRowsWithFolder({
        inspectResult: result,
        folderInventory,
      })
      setUploadTasks((prev) => {
        const prevMap = new Map(prev.map((t) => [t.taskKey, t]))
        return createUploadTasksFromMatchSummary(summary, prevMap)
      })
    } catch (err: unknown) {
      if (!checkCurrent()) return
      setInspectResult(null)
      setUploadTasks([])
      setInspectError(
        mapAdminApiError(
          err,
          'Không thể phân tích file Excel (inspect). Vui lòng kiểm tra lại định dạng file.'
        )
      )
    } finally {
      if (checkCurrent()) {
        setIsInspecting(false)
      }
    }
  }

  const handleRunImageUploads = async (retryOnlyFailed = false) => {
    if (
      !matchSummary ||
      matchSummary.hasAnyBlockingError ||
      isUploadingImages ||
      isInspecting ||
      isValidating ||
      isCommitting
    ) {
      return
    }

    if (matchSummary.urlOverrideRowCount > 0 && !confirmedUrlOverride) {
      setUploadGlobalError(
        'Vui lòng tích chọn xác nhận thay thế ImageUrl có sẵn trong Excel bằng ảnh trong thư mục local trước khi tải ảnh lên.'
      )
      return
    }

    const currentTasks =
      uploadTasks.length > 0
        ? uploadTasks
        : createUploadTasksFromMatchSummary(matchSummary)

    if (currentTasks.length === 0) return

    const onlyKeys = retryOnlyFailed
      ? new Set(
          currentTasks
            .filter((t) => t.status === 'error' || t.status === 'pending')
            .map((t) => t.taskKey)
        )
      : undefined

    const seq = ++operationSeqRef.current
    const activeOwner = ownerIdRef.current
    const controller = new AbortController()
    uploadAbortRef.current = controller

    const checkCurrent = () =>
      mountedRef.current &&
      ownerIdRef.current === activeOwner &&
      operationSeqRef.current === seq &&
      !controller.signal.aborted

    invalidateDownstreamValidation()
    setUploadGlobalError(null)
    setHasCorsUploadError(false)
    setIsUploadingImages(true)

    try {
      const outcome = await executeMatchedImagesUpload({
        tasks: currentTasks,
        onlyTaskKeys: onlyKeys,
        isContextCurrent: checkCurrent,
        signal: controller.signal,
        createUploadRequest: (req) =>
          executeWithAdminAuth({
            authStatus,
            user,
            getAccessToken,
            isContextCurrent: checkCurrent,
            operation: (token) =>
              createProductMediaUploadRequest(req, token, controller.signal),
          }),
        confirmUpload: (objectKey) =>
          executeWithAdminAuth({
            authStatus,
            user,
            getAccessToken,
            isContextCurrent: checkCurrent,
            operation: (token) =>
              confirmProductMediaUpload({ objectKey }, token, controller.signal),
          }),
        onTasksChange: (updated) => {
          setUploadTasks(updated)
        },
      })

      if (!checkCurrent()) return
      setUploadTasks(outcome.tasks)
      setHasCorsUploadError(outcome.hasCorsError)
      if (outcome.failedCount > 0) {
        setUploadGlobalError(
          `Có ${outcome.failedCount} tệp ảnh tải lên hoặc xác nhận thất bại. Các tệp đã thành công được giữ nguyên, bạn có thể nhấn "Thử lại tệp lỗi".`
        )
      }
    } catch (err: unknown) {
      if (!checkCurrent()) return
      setUploadGlobalError(
        mapAdminApiError(
          err,
          'Quá trình tải ảnh lên kho lưu trữ gặp sự cố. Vui lòng thử lại.'
        )
      )
    } finally {
      if (checkCurrent()) {
        setIsUploadingImages(false)
      }
    }
  }

  const handleValidateImport = async () => {
    if (
      !workbookFile ||
      !matchSummary ||
      matchSummary.hasAnyBlockingError ||
      isValidating ||
      isUploadingImages ||
      isInspecting ||
      isCommitting
    ) {
      return
    }

    if (matchSummary.totalFilesToUpload > 0 && !uploadStats.allConfirmed) {
      setValidateApiError(
        'Vui lòng tải lên và xác nhận hoàn tất toàn bộ ảnh local trước khi chạy kiểm tra dữ liệu (Validate).'
      )
      return
    }

    if (!confirmedMappingsBuild.isValid) {
      setValidateApiError(confirmedMappingsBuild.errors.join(' '))
      return
    }

    const seq = ++operationSeqRef.current
    const activeOwner = ownerIdRef.current
    const snapshotFile = workbookFile
    const snapshotMappings = confirmedMappingsBuild.mappings
    const snapshotSig = createImportSnapshotSignature({
      workbookFile: snapshotFile,
      imageMappings: snapshotMappings,
    })

    const checkCurrent = () =>
      mountedRef.current &&
      ownerIdRef.current === activeOwner &&
      operationSeqRef.current === seq

    setValidateApiError(null)
    setCommitError(null)
    setIsAmbiguousCommitError(false)
    setCommitResult(null)
    setIsValidating(true)

    try {
      const result = await executeWithAdminAuth({
        authStatus,
        user,
        getAccessToken,
        isContextCurrent: checkCurrent,
        operation: (token) =>
          validateProductImport({
            file: snapshotFile,
            fileName: snapshotFile.name,
            imageMappings:
              snapshotMappings.length > 0 ? snapshotMappings : undefined,
            token,
          }),
      })

      if (!checkCurrent()) return
      setValidationResult(result)
      setValidatedSignature(result.isValid ? snapshotSig : null)
      setErrorPage(1)
    } catch (err: unknown) {
      if (!checkCurrent()) return
      setValidationResult(null)
      setValidatedSignature(null)
      setValidateApiError(
        mapAdminApiError(
          err,
          'Không thể kiểm tra dữ liệu import (validate). Vui lòng thử lại.'
        )
      )
    } finally {
      if (checkCurrent()) {
        setIsValidating(false)
      }
    }
  }

  const handleCommitImport = async () => {
    if (
      !workbookFile ||
      isCommitting ||
      isValidating ||
      isUploadingImages ||
      isInspecting
    ) {
      return
    }

    const seq = ++operationSeqRef.current
    const activeOwner = ownerIdRef.current
    const snapshotFile = workbookFile
    const snapshotMappings = confirmedMappingsBuild.mappings

    const checkCurrent = () =>
      mountedRef.current &&
      ownerIdRef.current === activeOwner &&
      operationSeqRef.current === seq

    await executeProductImportCommit({
      workbookFile: snapshotFile,
      workbookFileName: snapshotFile.name,
      imageMappings: snapshotMappings,
      validationResult,
      validatedSignature,
      currentSignature: currentSnapshotSignature,
      isSubmitting: isCommitting,
      isContextCurrent: checkCurrent,
      commitImport: ({ file, fileName, imageMappings }) =>
        executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent: checkCurrent,
          operation: (token) =>
            commitProductImport({
              file,
              fileName,
              imageMappings,
              token,
            }),
        }),
      onSubmittingChange: setIsCommitting,
      onError: (msg, isAmbiguous) => {
        setCommitError(msg)
        setIsAmbiguousCommitError(Boolean(isAmbiguous))
      },
      onValidationFailedWithoutCommit: (failedValidation) => {
        setValidationResult(failedValidation)
        setValidatedSignature(null)
        setErrorPage(1)
      },
      onCommittedSuccess: (committed) => {
        setCommitResult(committed)
        setValidationResult(committed.validation)
      },
    })
  }

  // Phân trang bảng ghép SKU
  const totalMatchPages = matchSummary
    ? Math.max(1, Math.ceil(matchSummary.rows.length / MATCH_TABLE_PAGE_SIZE))
    : 1
  const visibleMatchRows = useMemo(() => {
    if (!matchSummary) return []
    const start = (matchPage - 1) * MATCH_TABLE_PAGE_SIZE
    return matchSummary.rows.slice(start, start + MATCH_TABLE_PAGE_SIZE)
  }, [matchSummary, matchPage])

  // Phân trang bảng lỗi Validate
  const validationErrors = useMemo(
    () => validationResult?.errors ?? [],
    [validationResult]
  )
  const totalErrorPages = Math.max(
    1,
    Math.ceil(validationErrors.length / ERROR_TABLE_PAGE_SIZE)
  )
  const visibleValidationErrors = useMemo(() => {
    const start = (errorPage - 1) * ERROR_TABLE_PAGE_SIZE
    return validationErrors.slice(start, start + ERROR_TABLE_PAGE_SIZE)
  }, [validationErrors, errorPage])

  const taskByKey = useMemo(() => {
    const map = new Map<string, UploadTaskItem>()
    for (const t of uploadTasks) {
      map.set(t.taskKey, t)
    }
    return map
  }, [uploadTasks])

  const isAnyBusy =
    isInspecting || isUploadingImages || isValidating || isCommitting

  const canStartUpload =
    Boolean(matchSummary) &&
    !matchSummary!.hasAnyBlockingError &&
    matchSummary!.totalFilesToUpload > 0 &&
    !uploadStats.allConfirmed &&
    (matchSummary!.urlOverrideRowCount === 0 || confirmedUrlOverride) &&
    !isAnyBusy

  const canRunValidate =
    Boolean(matchSummary) &&
    !matchSummary!.hasAnyBlockingError &&
    (matchSummary!.totalFilesToUpload === 0 || uploadStats.allConfirmed) &&
    confirmedMappingsBuild.isValid &&
    !isAnyBusy

  const canConfirmImport = canCommitValidatedImport({
    validationResult,
    validatedSignature,
    currentSignature: currentSnapshotSignature,
    isBusy: isAnyBusy,
  })

  return (
    <div className="space-y-6">
      {/* Header trang & Nút Tải Template / Quản lý danh mục */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/products"
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Danh sách sản phẩm
          </Link>
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Nhập Sản Phẩm Hàng Loạt Từ Excel &amp; Thư Mục Ảnh Theo SKU
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Sử dụng trực tiếp file Excel mẫu chuẩn v1.0 kết hợp tự động ghép thư mục ảnh theo mã
            SKU, tải ảnh lên kho lưu trữ R2 và kiểm tra toàn diện trước khi tạo sản phẩm.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/categories"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <FolderTree className="h-4 w-4 text-slate-500" />
            Quản lý danh mục (Xem CategorySlug)
          </Link>

          <button
            type="button"
            onClick={() => void handleDownloadTemplate()}
            disabled={isDownloadingTemplate}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isDownloadingTemplate ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Tải template Excel (v1.0)
          </button>
        </div>
      </div>

      {templateError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="font-medium">{templateError}</div>
        </div>
      )}

      {/* Khu vực hướng dẫn sử dụng (Collapsible) */}
      <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Hướng Dẫn Chuẩn Bị File Excel &amp; Thư Mục Ảnh Theo SKU
              </h2>
              <p className="text-xs text-slate-600">
                Quy trình 6 bước giúp ghép ảnh tự động chính xác mà không cần chèn link thủ công
                vào từng dòng Excel.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
          >
            {showGuide ? (
              <>
                Thu gọn <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Xem hướng dẫn <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {showGuide && (
          <div className="mt-4 grid grid-cols-1 gap-5 border-t border-blue-200/80 pt-4 lg:grid-cols-3">
            <ol className="space-y-2.5 text-xs leading-relaxed text-slate-700 lg:col-span-2">
              <li>
                <strong className="text-slate-900">1. Tải &amp; điền Template:</strong> Nhấn{' '}
                <strong>Tải template Excel (v1.0)</strong>, điền thông tin chung tại sheet{' '}
                <code className="rounded bg-white px-1 py-0.5 font-mono font-bold">Products</code>{' '}
                và thông số kỹ thuật tại sheet linh kiện tương ứng theo đúng mã{' '}
                <code className="rounded bg-white px-1 py-0.5 font-mono font-bold">SKU</code>. Chỉ
                điền các sản phẩm cần nhập, không bắt buộc phải điền đủ cả 9 loại linh kiện.
              </li>
              <li>
                <strong className="text-slate-900">2. Danh mục &amp; dữ liệu chuẩn:</strong> Cột{' '}
                <code className="rounded bg-white px-1 py-0.5 font-mono font-bold">
                  CategorySlug
                </code>{' '}
                phải lấy từ danh mục đã có trong hệ thống (nhấn{' '}
                <Link
                  to="/admin/categories"
                  className="font-bold text-blue-700 underline hover:text-blue-800"
                >
                  Quản lý danh mục
                </Link>{' '}
                để tra cứu hoặc tạo trước danh mục). Không nhập mật khẩu, API key hoặc nhúng hình
                ảnh trực tiếp vào ô Excel.
              </li>
              <li>
                <strong className="text-slate-900">3. Chuẩn bị thư mục ảnh theo SKU:</strong> Đặt
                ảnh của từng sản phẩm vào thư mục con trùng tên <code className="font-mono">SKU</code>
                . Mỗi thư mục có duy nhất 1 ảnh chính tên{' '}
                <code className="rounded bg-white px-1 py-0.5 font-mono font-bold">
                  main.jpg / main.png / main.webp
                </code>{' '}
                (hoặc chỉ định rõ <code className="font-mono">&lt;SKU&gt;/&lt;file&gt;</code> ở cột{' '}
                <code className="font-mono">PrimaryImageFile</code>) và tối đa <strong>10</strong>{' '}
                ảnh phụ (hỗ trợ <code className="font-mono">.jpg</code>,{' '}
                <code className="font-mono">.png</code>, <code className="font-mono">.webp</code>,
                tối đa 5 MiB/ảnh).
              </li>
              <li>
                <strong className="text-slate-900">4. Chọn nguồn &amp; đối chiếu:</strong> Chọn file
                Excel (`.xlsx` &le; 5 MiB) và thư mục ảnh, sau đó kiểm tra bảng ghép SKU &amp; ảnh
                xem trước (thumbnail) trước khi tải lên. Nếu file Excel đã điền sẵn{' '}
                <code className="font-mono">ImageUrl</code> (HTTPS) cho mọi dòng thì có thể bỏ qua
                việc chọn thư mục ảnh.
              </li>
              <li>
                <strong className="text-slate-900">5. Tải ảnh &rarr; Kiểm tra &rarr; Nhập:</strong>{' '}
                Thực hiện lần lượt: <strong>Tải lên &amp; xác nhận ảnh</strong> &rarr;{' '}
                <strong>Kiểm tra dữ liệu (Validate)</strong> &rarr; xem kỹ báo cáo lỗi theo
                dòng/SKU &rarr; bấm <strong>Xác nhận import</strong>. Khi chưa bấm{' '}
                <strong>Xác nhận import</strong> thì chưa có sản phẩm nào được tạo.
              </li>
              <li>
                <strong className="text-slate-900">6. Lưu ý vận hành &amp; an toàn dữ liệu:</strong>{' '}
                Import chỉ tạo mới (<strong>create-only</strong>), không ghi đè các mã SKU đã tồn
                tại. Ảnh đã tải lên kho R2 nhưng hủy nhập giữa chừng có thể vẫn tồn tại trên R2 (hệ
                thống không tự động xóa lùi ảnh). Nếu kết nối mạng bị ngắt hoặc quá thời gian phản
                hồi ở bước xác nhận import, hãy kiểm tra{' '}
                <Link
                  to="/admin/products"
                  className="font-bold text-blue-700 underline hover:text-blue-800"
                >
                  Danh sách sản phẩm
                </Link>{' '}
                trước khi thử lại.
              </li>
            </ol>

            <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-200">
              <div className="mb-2 text-[11px] font-bold tracking-wider text-blue-400 uppercase">
                Ví dụ cấu trúc thư mục ảnh chuẩn
              </div>
              <pre className="overflow-x-auto leading-relaxed text-[11px] text-slate-300">
{`images/
├── CPU-001/
│   ├── main.jpg      (Ảnh chính)
│   ├── 02.jpg        (Ảnh phụ #1)
│   └── 03.webp       (Ảnh phụ #2)
└── GPU-001/
    ├── main.png      (Ảnh chính)
    ├── 02.png        (Ảnh phụ #1)
    └── 10.png        (Ảnh phụ #2)`}
              </pre>
              <p className="mt-2.5 font-sans text-[11px] text-slate-400">
                • Định dạng hợp lệ: <strong>.jpg, .png, .webp</strong> (&le; 5 MiB/ảnh).
                <br />• Ảnh phụ được sắp xếp tự nhiên theo số (02 trước 10), tối đa 10 ảnh/SKU.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* BƯỚC 1: Chọn File Excel & Thư mục ảnh + Phân tích (Inspect) */}
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 uppercase">
              Bước 1
            </span>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              Chọn File Excel (.xlsx) &amp; Thư Mục Ảnh Theo SKU
            </h2>
          </div>
          {hasActiveWorkInMemory && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
              Dữ liệu tệp đang giữ trong bộ nhớ trình duyệt (Tải lại trang sẽ cần chọn lại tệp)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Chọn Workbook .xlsx */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <label
              htmlFor="import-workbook-input"
              className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-800"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              1. File Excel sản phẩm (.xlsx, tối đa 5 MiB){' '}
              <span className="text-rose-600">*</span>
            </label>
            <input
              id="import-workbook-input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isAnyBusy}
              onChange={handleWorkbookFileChange}
              className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3.5 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-slate-800 disabled:opacity-50"
            />
            {workbookFile && (
              <p className="mt-2 font-mono text-xs text-emerald-700">
                Đã chọn: <strong>{workbookFile.name}</strong> (
                {formatBytes(workbookFile.size)})
              </p>
            )}
            {workbookError && (
              <p className="mt-2 text-xs font-medium text-rose-600">
                {workbookError}
              </p>
            )}
          </div>

          {/* Chọn Thư mục ảnh */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="import-folder-input"
                className="flex items-center gap-2 text-xs font-bold text-slate-800"
              >
                <FolderOpen className="h-4 w-4 text-blue-600" />
                2. Thư mục ảnh theo SKU (Tùy chọn nếu Excel đã có đủ ImageUrl)
              </label>
              {folderFiles.length > 0 && (
                <button
                  type="button"
                  disabled={isAnyBusy}
                  onClick={handleClearFolder}
                  className="text-[11px] font-semibold text-rose-600 hover:underline disabled:opacity-50"
                >
                  Bỏ chọn thư mục
                </button>
              )}
            </div>

            {!supportsDirectoryPicker ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                Trình duyệt hiện tại không hỗ trợ chọn thư mục (
                <code className="font-mono">webkitdirectory</code>). Vui lòng mở bằng trình duyệt
                Chrome, Edge, Firefox hoặc Safari trên máy tính, hoặc chỉ sử dụng file Excel đã
                điền sẵn cột <code className="font-mono">ImageUrl</code>.
              </div>
            ) : (
              <>
                <input
                  ref={folderInputRef}
                  id="import-folder-input"
                  type="file"
                  multiple
                  disabled={isAnyBusy}
                  onChange={handleFolderSelect}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3.5 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                />
                {folderInventory && (
                  <p className="mt-2 font-mono text-xs text-blue-700">
                    Thư mục:{' '}
                    <strong>{folderInventory.rootFolderName || '(Gốc)'}</strong> •{' '}
                    {folderInventory.skuBuckets.size} thư mục SKU •{' '}
                    {folderInventory.totalFilesScanned} tệp
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {inspectError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="font-medium">{inspectError}</div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500">
            Nhấn <strong>Phân tích Excel &amp; Ghép ảnh</strong> để kiểm tra cấu trúc workbook và
            xem trước bảng ánh xạ ảnh theo SKU.
          </span>

          <button
            type="button"
            disabled={!workbookFile || Boolean(workbookError) || isAnyBusy}
            onClick={() => void handleInspectWorkbook()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isInspecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Phân tích Excel &amp; Ghép ảnh (Inspect)
          </button>
        </div>
      </section>

      {/* BƯỚC 2: Kết quả Inspect, Bảng ghép SKU & Tải ảnh lên R2 */}
      {matchSummary && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 uppercase">
                Bước 2
              </span>
              <h2 className="mt-1 text-base font-bold text-slate-900">
                Bảng Ghép Ảnh Theo SKU &amp; Tải Lên Kho Lưu Trữ R2
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500">
              Template v{inspectResult?.templateVersion || '1.0'}
            </span>
          </div>

          {/* Thẻ tóm tắt kết quả ghép */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="block text-[11px] font-semibold text-slate-500">
                Tổng dòng Products
              </span>
              <span className="mt-1 block font-mono text-lg font-black text-slate-900">
                {matchSummary.totalRows}
              </span>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
              <span className="block text-[11px] font-semibold text-blue-800">
                Ghép thư mục Local
              </span>
              <span className="mt-1 block font-mono text-lg font-black text-blue-700">
                {matchSummary.localMatchedRowCount} SKU
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
              <span className="block text-[11px] font-semibold text-emerald-800">
                Dùng sẵn ImageUrl
              </span>
              <span className="mt-1 block font-mono text-lg font-black text-emerald-700">
                {matchSummary.urlOnlyRowCount} SKU
              </span>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5">
              <span className="block text-[11px] font-semibold text-indigo-800">
                Tổng tệp ảnh cần tải
              </span>
              <span className="mt-1 block font-mono text-lg font-black text-indigo-700">
                {matchSummary.totalFilesToUpload} tệp
              </span>
            </div>

            <div
              className={`rounded-xl border p-3.5 ${
                matchSummary.hasAnyBlockingError
                  ? 'border-rose-200 bg-rose-50/70'
                  : 'border-emerald-200 bg-emerald-50/70'
              }`}
            >
              <span
                className={`block text-[11px] font-semibold ${
                  matchSummary.hasAnyBlockingError
                    ? 'text-rose-800'
                    : 'text-emerald-800'
                }`}
              >
                Dòng lỗi chặn (Blocking)
              </span>
              <span
                className={`mt-1 block font-mono text-lg font-black ${
                  matchSummary.hasAnyBlockingError
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                {matchSummary.blockingRowCount}
              </span>
            </div>
          </div>

          {/* Lỗi toàn cục từ Folder hoặc Inspect */}
          {(matchSummary.globalBlockingErrors.length > 0 ||
            matchSummary.inspectErrors.length > 0) && (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  Phát hiện lỗi cần khắc phục trước khi tải ảnh lên hoặc kiểm tra dữ liệu:
                </span>
              </div>
              {matchSummary.inspectErrorsTruncated && (
                <p className="font-semibold text-rose-700">
                  • Danh sách lỗi từ file Excel đã được giới hạn hiển thị 500 lỗi đầu tiên.
                </p>
              )}
              <ul className="list-inside list-disc space-y-1">
                {matchSummary.globalBlockingErrors.map((err, idx) => (
                  <li key={`glob-${idx}`}>{err}</li>
                ))}
                {matchSummary.inspectErrors.slice(0, 15).map((err, idx) => (
                  <li key={`insp-${idx}`}>
                    [{err.sheet} dòng {err.row}
                    {err.column ? ` - cột ${err.column}` : ''}
                    {err.sku ? ` - SKU ${err.sku}` : ''}] ({err.code}): {err.message}
                  </li>
                ))}
                {matchSummary.inspectErrors.length > 15 && (
                  <li className="font-semibold">
                    ...và {matchSummary.inspectErrors.length - 15} lỗi khác trong bảng bên dưới.
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Cảnh báo thư mục ảnh thừa không có trong Excel */}
          {matchSummary.unusedFolders.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Có {matchSummary.unusedFolders.length} thư mục ảnh không khớp với bất kỳ SKU
                  nào trong Excel (Sẽ được bỏ qua, không tải lên):
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {matchSummary.unusedFolders.map((u) => (
                  <span
                    key={u.normalizedSku}
                    className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-mono text-[11px]"
                  >
                    {u.folderName} ({u.fileCount} tệp)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Xác nhận ghi đè khi dòng có cả ImageUrl trong Excel và thư mục ảnh local */}
          {matchSummary.urlOverrideRowCount > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={confirmedUrlOverride}
                  disabled={isAnyBusy}
                  onChange={(e) => setConfirmedUrlOverride(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <strong>
                    Xác nhận ưu tiên ảnh thư mục Local ({matchSummary.urlOverrideRowCount} dòng):
                  </strong>{' '}
                  Có {matchSummary.urlOverrideRowCount} dòng sản phẩm vừa có sẵn{' '}
                  <code className="font-mono">ImageUrl</code> trong Excel vừa có thư mục ảnh
                  local trùng SKU. Tôi xác nhận dùng ảnh từ thư mục local để thay thế đường dẫn{' '}
                  <code className="font-mono">ImageUrl</code> trong Excel cho các sản phẩm này.
                </span>
              </label>
            </div>
          )}

          {/* Thanh điều khiển Upload R2 */}
          {matchSummary.totalFilesToUpload > 0 && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Tiến Trình Tải Lên &amp; Xác Nhận Ảnh Trên Kho R2 (Tối đa 3 tệp song song)
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Đã xác nhận:{' '}
                    <strong className="font-mono text-emerald-700">
                      {uploadStats.confirmed}/{uploadStats.total}
                    </strong>{' '}
                    tệp
                    {uploadStats.inFlight > 0 &&
                      ` • Đang xử lý: ${uploadStats.inFlight} tệp`}
                    {uploadStats.failed > 0 && (
                      <span className="text-rose-600">
                        {' '}
                        • Lỗi: <strong>{uploadStats.failed}</strong> tệp
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {uploadStats.failed > 0 && !isUploadingImages && (
                    <button
                      type="button"
                      disabled={isAnyBusy || matchSummary.hasAnyBlockingError}
                      onClick={() => void handleRunImageUploads(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Thử lại {uploadStats.failed} tệp lỗi (Giữ nguyên tệp đã xong)
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!canStartUpload}
                    onClick={() => void handleRunImageUploads(false)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploadingImages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    {uploadStats.allConfirmed
                      ? 'Đã tải lên & xác nhận đủ ảnh'
                      : `Tải lên & Xác nhận ${matchSummary.totalFilesToUpload} ảnh`}
                  </button>
                </div>
              </div>

              {/* Thanh tiến trình */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{
                    width: `${
                      uploadStats.total > 0
                        ? Math.round(
                            (uploadStats.confirmed / uploadStats.total) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              {uploadGlobalError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>{uploadGlobalError}</div>
                </div>
              )}

              {hasCorsUploadError && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
                    <span>Hướng dẫn xử lý lỗi kết nối trực tiếp / CORS tới Cloudflare R2:</span>
                  </div>
                  <p className="mt-1 leading-relaxed">
                    Trình duyệt bị chặn khi gửi yêu cầu <code className="font-mono">PUT</code> trực
                    tiếp tới URL presigned của bucket R2. Vui lòng kiểm tra cấu hình{' '}
                    <strong>CORS Policy</strong> trên bucket Cloudflare R2 đã cho phép{' '}
                    <code className="font-mono">AllowedOrigins</code> (domain quản trị hiện tại),{' '}
                    <code className="font-mono">AllowedMethods: [&quot;PUT&quot;, &quot;GET&quot;, &quot;HEAD&quot;]</code>{' '}
                    và <code className="font-mono">AllowedHeaders: [&quot;Content-Type&quot;]</code>
                    , sau đó nhấn <strong>Thử lại tệp lỗi</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bảng chi tiết từng dòng SKU */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                  <th className="px-3 py-2.5">Dòng / SKU</th>
                  <th className="px-3 py-2.5">Sản phẩm &amp; Loại</th>
                  <th className="px-3 py-2.5">Ảnh chính (Primary)</th>
                  <th className="px-3 py-2.5">Ảnh phụ (Gallery)</th>
                  <th className="px-3 py-2.5">Nguồn ảnh</th>
                  <th className="px-3 py-2.5">Trạng thái &amp; Kiểm tra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleMatchRows.map((row) => {
                  const primaryTaskKey = row.primaryFile
                    ? `${row.normalizedSku}::primary::${row.primaryFile.relativePath}`
                    : ''
                  const primaryTask = primaryTaskKey
                    ? taskByKey.get(primaryTaskKey)
                    : undefined

                  const previewUrl = row.primaryFile
                    ? (previewUrlMap[row.primaryFile.relativePath] ?? null)
                    : row.excelImageUrl

                  const rowAddTasks = row.additionalFiles.map((af, idx) =>
                    taskByKey.get(
                      `${row.normalizedSku}::additional::${idx}::${af.relativePath}`
                    )
                  )
                  const confirmedAddCount = rowAddTasks.filter(
                    (t) => t?.status === 'confirmed'
                  ).length
                  const failedTaskMessages = [
                    primaryTask?.status === 'error'
                      ? primaryTask.errorMessage
                      : null,
                    ...rowAddTasks.map((t) =>
                      t?.status === 'error' ? t.errorMessage : null
                    ),
                  ].filter((m): m is string => Boolean(m))

                  return (
                    <tr
                      key={`${row.rowNumber}-${row.sku}`}
                      className={
                        row.blockingErrors.length > 0
                          ? 'bg-rose-50/40'
                          : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <div className="font-mono text-[11px] text-slate-400">
                          Dòng #{row.rowNumber}
                        </div>
                        <div className="font-mono font-bold text-slate-900">
                          {row.sku || '(Trống)'}
                        </div>
                      </td>

                      <td className="max-w-xs px-3 py-3 align-top">
                        <div className="line-clamp-2 font-semibold text-slate-900">
                          {row.name || '(Chưa có tên)'}
                        </div>
                        <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {row.componentTypeLabel}
                        </span>
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={row.sku}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            {row.primaryFile ? (
                              <>
                                <div className="truncate font-mono text-[11px] font-bold text-slate-800">
                                  {row.primaryFile.relativePath}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {formatBytes(row.primaryFile.size)}
                                </div>
                              </>
                            ) : row.excelImageUrl ? (
                              <div className="max-w-[180px] truncate font-mono text-[11px] text-emerald-700">
                                {row.excelImageUrl}
                              </div>
                            ) : (
                              <span className="text-[11px] font-semibold text-rose-600">
                                Thiếu ảnh chính
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        {row.additionalFiles.length > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-slate-800">
                              {row.additionalFiles.length} ảnh phụ
                            </span>
                            <div className="mt-0.5 max-w-[200px] truncate font-mono text-[10px] text-slate-500">
                              {row.additionalFiles
                                .map((f) => f.fileName)
                                .join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">0 ảnh phụ</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        {row.sourceType === 'local_folder' ? (
                          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                            {row.overridesExistingUrl
                              ? 'Local (Thay thế URL)'
                              : 'Thư mục Local'}
                          </span>
                        ) : row.sourceType === 'url_only' ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            URL trong Excel
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                            Chưa có nguồn ảnh
                          </span>
                        )}
                      </td>

                      <td className="max-w-xs px-3 py-3 align-top">
                        {row.blockingErrors.length > 0 ? (
                          <ul className="space-y-1 text-[11px] font-medium text-rose-600">
                            {row.blockingErrors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="space-y-1">
                            {row.sourceType === 'local_folder' && (
                              <div className="text-[11px] font-semibold">
                                {primaryTask?.status === 'confirmed' &&
                                confirmedAddCount ===
                                  row.additionalFiles.length ? (
                                  <span className="text-emerald-700">
                                    ✓ Đã xác nhận đủ {1 + confirmedAddCount} ảnh trên R2
                                  </span>
                                ) : failedTaskMessages.length > 0 ? (
                                  <div className="text-rose-600">
                                    {failedTaskMessages.map((m, idx) => (
                                      <div key={idx}>• {m}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-600">
                                    Chờ tải lên ({1 + row.additionalFiles.length} tệp)
                                  </span>
                                )}
                              </div>
                            )}
                            {row.sourceType === 'url_only' && (
                              <span className="text-[11px] font-semibold text-emerald-700">
                                ✓ Hợp lệ (Sử dụng URL sẵn có)
                              </span>
                            )}
                            {row.warnings.map((w, i) => (
                              <div
                                key={i}
                                className="text-[11px] font-medium text-amber-700"
                              >
                                ⚠ {w}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phân trang bảng ghép SKU */}
          {totalMatchPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <span>
                Trang <strong>{matchPage}</strong> /{' '}
                <strong>{totalMatchPages}</strong> ({matchSummary.rows.length} dòng)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={matchPage <= 1}
                  onClick={() => setMatchPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <button
                  type="button"
                  disabled={matchPage >= totalMatchPages}
                  onClick={() =>
                    setMatchPage((p) => Math.min(totalMatchPages, p + 1))
                  }
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* BƯỚC 3: Kiểm tra toàn diện (Validate) & Xác nhận Import */}
      {matchSummary && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <span className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 uppercase">
                Bước 3
              </span>
              <h2 className="mt-1 text-base font-bold text-slate-900">
                Kiểm Tra Dữ Liệu (Validate) &amp; Xác Nhận Import Sản Phẩm
              </h2>
              <p className="text-xs text-slate-500">
                Hệ thống gửi nguyên bản file Excel gốc kèm danh sách ObjectKey ảnh đã xác nhận để
                kiểm tra chéo toàn bộ thông số kỹ thuật, danh mục và kho R2 trước khi tạo sản phẩm.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={!canRunValidate}
                onClick={() => void handleValidateImport()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Kiểm tra dữ liệu (Validate)
              </button>

              <button
                type="button"
                disabled={!canConfirmImport}
                onClick={() => void handleCommitImport()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCommitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {validationResult?.isValid
                  ? `Xác nhận import ${validationResult.validRows} sản phẩm`
                  : 'Xác nhận import sản phẩm'}
              </button>
            </div>
          </div>

          {validateApiError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="font-medium">{validateApiError}</div>
            </div>
          )}

          {commitError && (
            <div
              className={`rounded-xl border p-4 text-xs ${
                isAmbiguousCommitError
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p className="font-bold">{commitError}</p>
                  {isAmbiguousCommitError && (
                    <Link
                      to="/admin/products"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 font-bold text-white hover:bg-amber-900"
                    >
                      Mở Danh sách sản phẩm để kiểm tra SKU
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Kết quả Validate */}
          {validationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="block text-[11px] font-semibold text-slate-500">
                    Tổng số dòng kiểm tra
                  </span>
                  <span className="mt-1 block font-mono text-lg font-black text-slate-900">
                    {validationResult.totalRows}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                  <span className="block text-[11px] font-semibold text-emerald-800">
                    Số dòng hợp lệ (Valid)
                  </span>
                  <span className="mt-1 block font-mono text-lg font-black text-emerald-700">
                    {validationResult.validRows}
                  </span>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
                  <span className="block text-[11px] font-semibold text-rose-800">
                    Số dòng lỗi (Invalid)
                  </span>
                  <span className="mt-1 block font-mono text-lg font-black text-rose-700">
                    {validationResult.invalidRows}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="block text-[11px] font-semibold text-slate-500">
                    Trạng thái Validate
                  </span>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      validationResult.isValid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {validationResult.isValid
                      ? 'Đạt yêu cầu (Sẵn sàng Import)'
                      : 'Chưa hợp lệ'}
                  </span>
                </div>
              </div>

              {validationResult.errorsTruncated && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
                  Danh sách lỗi vượt quá 500 mục; hệ thống đang hiển thị 500 lỗi đầu tiên.
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-rose-700 uppercase">
                    Chi Tiết Lỗi Kiểm Tra ({validationErrors.length} lỗi)
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-rose-200">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-900 uppercase">
                          <th className="px-3 py-2.5">Sheet</th>
                          <th className="px-3 py-2.5">Dòng</th>
                          <th className="px-3 py-2.5">Cột</th>
                          <th className="px-3 py-2.5">SKU</th>
                          <th className="px-3 py-2.5">Mã lỗi</th>
                          <th className="px-3 py-2.5">Nội dung chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {visibleValidationErrors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-rose-50/40">
                            <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-slate-800">
                              {err.sheet}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-700">
                              {err.row > 0 ? err.row : '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-700">
                              {err.column || '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-slate-900">
                              {err.sku || '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-rose-700">
                              {err.code}
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              {err.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalErrorPages > 1 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Trang lỗi <strong>{errorPage}</strong> /{' '}
                        <strong>{totalErrorPages}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={errorPage <= 1}
                          onClick={() => setErrorPage((p) => Math.max(1, p - 1))}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
                        >
                          Trước
                        </button>
                        <button
                          type="button"
                          disabled={errorPage >= totalErrorPages}
                          onClick={() =>
                            setErrorPage((p) => Math.min(totalErrorPages, p + 1))
                          }
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Kết quả Commit thành công (201 Created, isCommitted === true) */}
          {commitResult?.isCommitted && (
            <div className="space-y-4 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-xs text-emerald-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-black text-emerald-950">
                      Đã Nhập Thành Công {commitResult.createdCount} Sản Phẩm Mới!
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Toàn bộ sản phẩm và lịch sử khởi tạo tồn kho đã được lưu vào cơ sở dữ liệu.
                    </p>
                  </div>
                </div>

                <Link
                  to="/admin/products"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Về danh sách sản phẩm
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              {commitResult.createdProducts.length > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-emerald-200 bg-white p-3">
                  <div className="mb-2 text-[11px] font-bold text-slate-600 uppercase">
                    Danh sách SKU vừa tạo ({commitResult.createdProducts.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {commitResult.createdProducts.map((prod) => (
                      <Link
                        key={prod.id}
                        to={`/admin/products/${prod.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700 hover:border-blue-400 hover:bg-blue-50"
                      >
                        <span>{prod.sku}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}