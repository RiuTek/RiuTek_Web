import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FolderPlus,
  FolderTree,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { getCategories } from '../../features/products/productApi'
import {
  COMPONENT_TYPE_LABELS,
  getEnumLabel,
} from '../../features/products/productConstants'
import { ComponentType, type Category } from '../../features/products/productTypes'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '../../features/admin/adminApi'
import { mapAdminApiError } from '../../features/admin/adminConstants'
import { executeWithAdminAuth } from '../../features/admin/adminGuardHelper'
import {
  applyCategoryParentChange,
  createEmptyCategoryDraft,
  executeCategoryDelete,
  executeCategorySave,
  flattenCategoryTree,
  getEligibleParentCategories,
  mapCategoryToDraft,
} from '../../features/admin/adminCategoryHelper'
import type {
  CategoryDraft,
  FlattenedCategoryNode,
} from '../../features/admin/adminTypes'

const ALL_COMPONENT_TYPES: ComponentType[] = [
  ComponentType.CPU,
  ComponentType.Motherboard,
  ComponentType.GPU,
  ComponentType.RAM,
  ComponentType.Storage,
  ComponentType.PSU,
  ComponentType.Case,
  ComponentType.Cooler,
  ComponentType.Accessory,
]

export const AdminCategoriesPage: React.FC = () => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [treeStatus, setTreeStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [treeError, setTreeError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<ComponentType | 'all'>('all')

  // Form state (create / edit)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(() =>
    createEmptyCategoryDraft(ComponentType.CPU)
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formApiError, setFormApiError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<FlattenedCategoryNode | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Lifecycle refs
  const isMountedRef = useRef(true)
  const ownerIdRef = useRef(ownerId)
  const treeReqSeqRef = useRef(0)
  const mutationSeqRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    ownerIdRef.current = ownerId
    return () => {
      isMountedRef.current = false
    }
  }, [ownerId])

  const loadCategoryTree = useCallback(async (signal?: AbortSignal) => {
    const seq = ++treeReqSeqRef.current
    await Promise.resolve()
    if (!isMountedRef.current || treeReqSeqRef.current !== seq) return
    setTreeStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
    setTreeError(null)

    try {
      const data = await getCategories(signal)
      if (!isMountedRef.current || treeReqSeqRef.current !== seq) return
      setCategories(Array.isArray(data) ? data : [])
      setTreeStatus('ready')
      setTreeError(null)
    } catch (err: unknown) {
      if (!isMountedRef.current || treeReqSeqRef.current !== seq) return
      if (err instanceof Error && err.name === 'AbortError') return
      setTreeError(mapAdminApiError(err, 'Không thể tải cây danh mục.'))
      setTreeStatus('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => loadCategoryTree(controller.signal))
    return () => controller.abort()
  }, [loadCategoryTree])

  const flatNodes = useMemo(() => flattenCategoryTree(categories), [categories])

  const filteredNodes = useMemo(() => {
    if (filterType === 'all') return flatNodes
    return flatNodes.filter((n) => n.componentType === filterType)
  }, [flatNodes, filterType])

  const eligibleParents = useMemo(
    () =>
      getEligibleParentCategories(
        flatNodes,
        formMode === 'edit' ? editingId : null
      ),
    [flatNodes, formMode, editingId]
  )

  const editingNode = useMemo(
    () =>
      formMode === 'edit' && editingId
        ? flatNodes.find((n) => n.id.toLowerCase() === editingId.toLowerCase()) ?? null
        : null,
    [flatNodes, formMode, editingId]
  )

  const handleStartCreate = (defaultType: ComponentType = ComponentType.CPU) => {
    if (isSaving || isDeleting) return
    setFormMode('create')
    setEditingId(null)
    setDraft(createEmptyCategoryDraft(defaultType))
    setFieldErrors({})
    setFormApiError(null)
    setFormSuccess(null)
  }

  const handleStartEdit = (node: FlattenedCategoryNode) => {
    if (isSaving || isDeleting) return
    setFormMode('edit')
    setEditingId(node.id)
    setDraft(mapCategoryToDraft(node))
    setFieldErrors({})
    setFormApiError(null)
    setFormSuccess(null)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving || isDeleting) return

    const mutSeq = ++mutationSeqRef.current
    const isContextCurrent = () =>
      isMountedRef.current &&
      ownerIdRef.current === ownerId &&
      mutationSeqRef.current === mutSeq

    setFormSuccess(null)

    await executeCategorySave({
      mode: formMode,
      editingCategoryId: editingId,
      draft,
      flatNodes,
      isSubmitting: isSaving,
      isContextCurrent,
      createCategory: (payload) =>
        executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent,
          operation: (token) => createCategory(payload, token),
        }),
      updateCategory: (id, payload) =>
        executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent,
          operation: (token) => updateCategory(id, payload, token),
        }),
      refetchTree: () => loadCategoryTree(),
      onValidationError: setFieldErrors,
      onSubmittingChange: setIsSaving,
      onApiError: setFormApiError,
      onSuccess: (saved) => {
        if (formMode === 'create') {
          setDraft(createEmptyCategoryDraft(saved.componentType))
          setFormSuccess(`Đã tạo danh mục "${saved.name}" thành công.`)
        } else {
          setDraft(mapCategoryToDraft(saved))
          setFormSuccess(`Đã cập nhật danh mục "${saved.name}" thành công.`)
        }
      },
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting || isSaving) return

    const mutSeq = ++mutationSeqRef.current
    const isContextCurrent = () =>
      isMountedRef.current &&
      ownerIdRef.current === ownerId &&
      mutationSeqRef.current === mutSeq

    const deletedId = deleteTarget.id
    const deletedName = deleteTarget.name

    await executeCategoryDelete({
      categoryId: deletedId,
      isDeleting,
      isContextCurrent,
      deleteCategory: (id) =>
        executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent,
          operation: (token) => deleteCategory(id, token),
        }),
      refetchTree: () => loadCategoryTree(),
      onDeletingChange: setIsDeleting,
      onDeleteError: setDeleteError,
      onDeleteSuccess: () => {
        setDeleteTarget(null)
        setDeleteError(null)
        if (editingId && editingId.toLowerCase() === deletedId.toLowerCase()) {
          setFormMode('create')
          setEditingId(null)
          setDraft(createEmptyCategoryDraft(ComponentType.CPU))
        }
        setFormSuccess(`Đã xóa danh mục "${deletedName}".`)
      },
    })
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-xs font-bold mb-2">
            <FolderTree className="w-3.5 h-3.5" />
            <span>Quản Trị Danh Mục</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Danh Mục Linh Kiện
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Quản lý cây danh mục phân cấp theo 9 loại linh kiện phần cứng. Slug được tạo tự động bởi hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void loadCategoryTree()}
            disabled={treeStatus === 'loading' || isSaving || isDeleting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${treeStatus === 'loading' ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            onClick={() => handleStartCreate(ComponentType.CPU)}
            disabled={isSaving || isDeleting}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Tạo danh mục mới</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Table/Tree, Right Create/Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Category Tree Table */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Cây Danh Mục ({filteredNodes.length})
              </h2>
              <p className="text-xs text-slate-500">
                Hiển thị cấu trúc phân cấp cha - con và loại linh kiện tương ứng
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="category-filter-type" className="text-xs font-semibold text-slate-600">
                Lọc loại:
              </label>
              <select
                id="category-filter-type"
                value={filterType}
                onChange={(e) =>
                  setFilterType(
                    e.target.value === 'all' ? 'all' : (Number(e.target.value) as ComponentType)
                  )
                }
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
              >
                <option value="all">Tất cả 9 loại linh kiện</option>
                {ALL_COMPONENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {COMPONENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {treeStatus === 'loading' && flatNodes.length === 0 ? (
            <div
              aria-busy="true"
              className="py-16 flex flex-col items-center justify-center text-center p-6"
            >
              <Loader2 className="w-7 h-7 text-red-600 animate-spin mb-2.5" />
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Đang tải cây danh mục...
              </p>
            </div>
          ) : treeStatus === 'error' ? (
            <div role="alert" className="p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Không thể tải danh mục
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">{treeError}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadCategoryTree()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                Chưa có danh mục nào phù hợp
              </p>
              <p className="text-xs text-slate-500">
                Hãy sử dụng biểu mẫu bên cạnh để tạo danh mục mới cho hệ thống.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Tên danh mục / Slug</th>
                    <th className="py-3.5 px-3">Loại linh kiện</th>
                    <th className="py-3.5 px-3">Danh mục cha</th>
                    <th className="py-3.5 px-3">Mô tả</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredNodes.map((node) => {
                    const isEditingThis =
                      formMode === 'edit' &&
                      editingId?.toLowerCase() === node.id.toLowerCase()

                    return (
                      <tr
                        key={node.id}
                        className={`transition-colors ${
                          isEditingThis ? 'bg-red-50/40' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div
                            className="flex items-start gap-2"
                            style={{ paddingLeft: `${node.depth * 20}px` }}
                          >
                            {node.depth > 0 && (
                              <span
                                aria-hidden="true"
                                className="text-slate-300 font-mono select-none mt-0.5"
                              >
                                └─
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                <span>{node.name}</span>
                                {node.subCategoryCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                    {node.subCategoryCount} con
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono truncate">
                                /{node.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold">
                            {getEnumLabel(COMPONENT_TYPE_LABELS, node.componentType)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          {node.parentName ? (
                            <span className="font-medium text-slate-800">
                              {node.parentName}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Danh mục gốc</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 max-w-[200px]">
                          {node.description ? (
                            <p className="line-clamp-2 leading-relaxed">{node.description}</p>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(node)}
                              disabled={isSaving || isDeleting}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors disabled:opacity-50"
                              title={`Chỉnh sửa ${node.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isSaving && !isDeleting) {
                                  setDeleteError(null)
                                  setDeleteTarget(node)
                                }
                              }}
                              disabled={isSaving || isDeleting}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-700 font-semibold transition-colors disabled:opacity-50"
                              title={`Xóa ${node.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Create / Edit Category Form */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5 sticky top-6">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 mb-1.5">
                {formMode === 'create' ? 'Tạo mới' : 'Chỉnh sửa'}
              </span>
              <h2 className="text-base font-bold text-slate-950">
                {formMode === 'create'
                  ? 'Thêm Danh Mục Mới'
                  : `Sửa: ${editingNode?.name ?? ''}`}
              </h2>
            </div>

            {formMode === 'edit' && (
              <button
                type="button"
                onClick={() => handleStartCreate(ComponentType.CPU)}
                disabled={isSaving || isDeleting}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Hủy sửa
              </button>
            )}
          </div>

          {formSuccess && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formSuccess}</div>
              <button
                type="button"
                onClick={() => setFormSuccess(null)}
                className="text-emerald-700 hover:text-emerald-900"
                aria-label="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {formApiError && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formApiError}</div>
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-4" noValidate>
            {/* Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="category-name-input"
                className="block text-xs font-bold text-slate-800"
              >
                Tên danh mục <span className="text-red-500">*</span>
              </label>
              <input
                id="category-name-input"
                type="text"
                maxLength={150}
                disabled={isSaving}
                value={draft.name}
                onChange={(e) => {
                  const val = e.target.value
                  setDraft((prev) => ({ ...prev, name: val }))
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: '' }))
                  }
                }}
                placeholder="Ví dụ: Vi xử lý Intel Core"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.name
                    ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 bg-slate-50/40 focus:bg-white focus:border-red-500 focus:ring-red-100'
                }`}
              />
              {fieldErrors.name && (
                <p className="text-[11px] text-rose-600 font-medium">{fieldErrors.name}</p>
              )}
            </div>

            {/* ComponentType */}
            <div className="space-y-1.5">
              <label
                htmlFor="category-component-type-select"
                className="block text-xs font-bold text-slate-800"
              >
                Loại linh kiện <span className="text-red-500">*</span>
              </label>
              <select
                id="category-component-type-select"
                disabled={isSaving}
                value={draft.componentType}
                onChange={(e) => {
                  const val = e.target.value ? (Number(e.target.value) as ComponentType) : ''
                  setDraft((prev) => ({ ...prev, componentType: val }))
                  if (fieldErrors.componentType || fieldErrors.parentId) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      componentType: '',
                      parentId: '',
                    }))
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.componentType
                    ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 bg-slate-50/40 focus:bg-white focus:border-red-500 focus:ring-red-100'
                }`}
              >
                <option value="">-- Chọn loại linh kiện --</option>
                {ALL_COMPONENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {COMPONENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              {editingNode && editingNode.subCategoryCount > 0 && (
                <p className="text-[11px] text-amber-700">
                  Danh mục đang có {editingNode.subCategoryCount} danh mục con; không thể đổi loại linh kiện.
                </p>
              )}
              {fieldErrors.componentType && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {fieldErrors.componentType}
                </p>
              )}
            </div>

            {/* Parent Category */}
            <div className="space-y-1.5">
              <label
                htmlFor="category-parent-select"
                className="block text-xs font-bold text-slate-800"
              >
                Danh mục cha <span className="text-slate-400 font-normal">(Tùy chọn)</span>
              </label>
              <select
                id="category-parent-select"
                disabled={isSaving}
                value={draft.parentId}
                onChange={(e) => {
                  const nextParentId = e.target.value
                  // Đổi parent không làm mất description hoặc componentType
                  setDraft((prev) => applyCategoryParentChange(prev, nextParentId))
                  if (fieldErrors.parentId) {
                    setFieldErrors((prev) => ({ ...prev, parentId: '' }))
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.parentId
                    ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 bg-slate-50/40 focus:bg-white focus:border-red-500 focus:ring-red-100'
                }`}
              >
                <option value="">— Không có (Danh mục gốc) —</option>
                {eligibleParents.map((node) => {
                  const prefix = node.depth > 0 ? `${'— '.repeat(node.depth)}` : ''
                  const typeLabel = getEnumLabel(
                    COMPONENT_TYPE_LABELS,
                    node.componentType
                  )
                  return (
                    <option key={node.id} value={node.id}>
                      {prefix}
                      {node.name} ({typeLabel})
                    </option>
                  )
                })}
              </select>
              <p className="text-[11px] text-slate-500">
                Danh mục con bắt buộc phải có cùng loại linh kiện với danh mục cha.
              </p>
              {fieldErrors.parentId && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {fieldErrors.parentId}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label
                htmlFor="category-description-input"
                className="block text-xs font-bold text-slate-800"
              >
                Mô tả <span className="text-slate-400 font-normal">(Tùy chọn, tối đa 500 ký tự)</span>
              </label>
              <textarea
                id="category-description-input"
                rows={3}
                maxLength={500}
                disabled={isSaving}
                value={draft.description}
                onChange={(e) => {
                  const val = e.target.value
                  setDraft((prev) => ({ ...prev, description: val }))
                  if (fieldErrors.description) {
                    setFieldErrors((prev) => ({ ...prev, description: '' }))
                  }
                }}
                placeholder="Mô tả ngắn gọn về nhóm sản phẩm trong danh mục..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.description
                    ? 'border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-200 bg-slate-50/40 focus:bg-white focus:border-red-500 focus:ring-red-100'
                }`}
              />
              {fieldErrors.description && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              {formMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => handleStartCreate(ComponentType.CPU)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                >
                  Hủy
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving || isDeleting || treeStatus === 'error'}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {formMode === 'create' ? 'Tạo danh mục' : 'Lưu cập nhật'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-category-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3
                  id="delete-category-modal-title"
                  className="text-base font-bold text-slate-900"
                >
                  Xác nhận xóa danh mục
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa danh mục{' '}
                  <strong className="text-slate-900">"{deleteTarget.name}"</strong> không?
                </p>
                <p className="text-[11px] text-slate-500">
                  Hệ thống chỉ cho phép xóa danh mục trống (không chứa danh mục con và không chứa sản phẩm).
                </p>
              </div>
            </div>

            {deleteError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteError(null)
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
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
export default AdminCategoriesPage
