import { ComponentType, type Category } from '../products/productTypes'
import { mapAdminApiError } from './adminConstants'
import { isValidUuid } from './adminApi'
import type {
  CategoryDraft,
  CreateCategoryRequest,
  FlattenedCategoryNode,
  UpdateCategoryRequest,
} from './adminTypes'

export function isValidComponentType(value: unknown): value is ComponentType {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= ComponentType.CPU &&
    value <= ComponentType.Accessory
  )
}

function collectDescendantIds(category: Category, target: Set<string>): void {
  if (!Array.isArray(category.subCategories)) return
  for (const child of category.subCategories) {
    target.add(child.id.toLowerCase())
    collectDescendantIds(child, target)
  }
}

/**
 * Làm phẳng cây danh mục phân cấp từ GET /categories kèm độ sâu, đường dẫn cha-con và tập descendantIds.
 */
export function flattenCategoryTree(categories: Category[]): FlattenedCategoryNode[] {
  const result: FlattenedCategoryNode[] = []

  const walk = (
    nodes: Category[],
    depth: number,
    parentName: string | null,
    ancestorNames: string[]
  ) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      const descendants = new Set<string>()
      collectDescendantIds(node, descendants)
      const pathNames = [...ancestorNames, node.name]
      const subCount = Array.isArray(node.subCategories)
        ? node.subCategories.length
        : 0

      result.push({
        id: node.id,
        name: node.name,
        slug: node.slug,
        componentType: node.componentType,
        description: node.description ?? null,
        parentId: node.parentId ?? null,
        parentName,
        depth,
        pathNames,
        subCategoryCount: subCount,
        descendantIds: descendants,
        raw: node,
      })

      if (subCount > 0) {
        walk(node.subCategories, depth + 1, node.name, pathNames)
      }
    }
  }

  walk(categories, 0, null, [])
  return result
}

/**
 * Trả về danh sách danh mục có thể chọn làm cha:
 * - Không bao giờ cho phép chọn chính nó hoặc bất kỳ danh mục con/cháu (descendant) của nó.
 */
export function getEligibleParentCategories(
  flatNodes: FlattenedCategoryNode[],
  editingCategoryId: string | null
): FlattenedCategoryNode[] {
  if (!editingCategoryId) {
    return flatNodes
  }
  const normalizedEditId = editingCategoryId.trim().toLowerCase()
  const editingNode = flatNodes.find(
    (n) => n.id.trim().toLowerCase() === normalizedEditId
  )
  const forbiddenDescendants = editingNode?.descendantIds ?? new Set<string>()

  return flatNodes.filter((candidate) => {
    const candidateId = candidate.id.trim().toLowerCase()
    if (candidateId === normalizedEditId) return false
    if (forbiddenDescendants.has(candidateId)) return false
    return true
  })
}

export function createEmptyCategoryDraft(
  defaultComponentType: ComponentType | '' = ComponentType.CPU
): CategoryDraft {
  return {
    name: '',
    componentType: defaultComponentType,
    description: '',
    parentId: '',
  }
}

export function mapCategoryToDraft(category: FlattenedCategoryNode | Category): CategoryDraft {
  return {
    name: category.name ?? '',
    componentType: category.componentType,
    description: category.description ?? '',
    parentId: category.parentId ?? '',
  }
}

/**
 * Đổi parentId trên draft danh mục mà KHÔNG làm mất description hoặc componentType.
 */
export function applyCategoryParentChange(
  draft: CategoryDraft,
  newParentId: string
): CategoryDraft {
  return {
    ...draft,
    parentId: newParentId,
  }
}

export interface CategoryValidationResult {
  isValid: boolean
  errors: Record<string, string>
  payload: CreateCategoryRequest | UpdateCategoryRequest | null
}

/**
 * Validate dữ liệu form danh mục khớp chặt với CreateCategoryCommandValidator / UpdateCategoryCommandValidator:
 * - Name: bắt buộc, sau trim <= 150 ký tự
 * - Description: tùy chọn, sau trim <= 500 ký tự, rỗng -> null
 * - ComponentType: enum hợp lệ (1..9)
 * - ParentId: tùy chọn; nếu có phải là UUID hợp lệ, tồn tại trong cây, không phải chính nó hoặc descendant,
 *   và phải có cùng ComponentType với danh mục con.
 * - Khi sửa danh mục đã có danh mục con (subCategoryCount > 0), không được đổi ComponentType.
 */
export function validateAndBuildCategoryPayload(params: {
  draft: CategoryDraft
  flatNodes: FlattenedCategoryNode[]
  editingCategoryId: string | null
}): CategoryValidationResult {
  const { draft, flatNodes, editingCategoryId } = params
  const errors: Record<string, string> = {}

  const cleanName = typeof draft.name === 'string' ? draft.name.trim() : ''
  if (!cleanName) {
    errors.name = 'Tên danh mục không được để trống.'
  } else if (cleanName.length > 150) {
    errors.name = 'Tên danh mục không được vượt quá 150 ký tự.'
  }

  const rawDesc = typeof draft.description === 'string' ? draft.description.trim() : ''
  if (rawDesc.length > 500) {
    errors.description = 'Mô tả danh mục không được vượt quá 500 ký tự.'
  }

  const compTypeNum =
    typeof draft.componentType === 'number'
      ? draft.componentType
      : Number(draft.componentType)
  if (!isValidComponentType(compTypeNum)) {
    errors.componentType = 'Vui lòng chọn loại linh kiện hợp lệ.'
  }

  const normalizedEditId = editingCategoryId?.trim().toLowerCase() ?? null
  const editingNode = normalizedEditId
    ? flatNodes.find((n) => n.id.trim().toLowerCase() === normalizedEditId) ?? null
    : null

  if (
    editingNode &&
    isValidComponentType(compTypeNum) &&
    compTypeNum !== editingNode.componentType &&
    editingNode.subCategoryCount > 0
  ) {
    errors.componentType =
      'Không thể thay đổi loại linh kiện vì danh mục đang có danh mục con.'
  }

  const cleanParentId = typeof draft.parentId === 'string' ? draft.parentId.trim() : ''
  let resolvedParentId: string | null = null

  if (cleanParentId) {
    if (!isValidUuid(cleanParentId)) {
      errors.parentId = 'Id danh mục cha không hợp lệ.'
    } else {
      const normalizedParentId = cleanParentId.toLowerCase()
      if (normalizedEditId && normalizedParentId === normalizedEditId) {
        errors.parentId = 'Danh mục không thể là danh mục cha của chính nó.'
      } else if (editingNode && editingNode.descendantIds.has(normalizedParentId)) {
        errors.parentId =
          'Không thể thiết lập danh mục cha là danh mục con của chính nó (vòng lặp phân cấp).'
      } else {
        const parentNode = flatNodes.find(
          (n) => n.id.trim().toLowerCase() === normalizedParentId
        )
        if (!parentNode) {
          errors.parentId = 'Danh mục cha không tồn tại.'
        } else if (
          isValidComponentType(compTypeNum) &&
          parentNode.componentType !== compTypeNum
        ) {
          errors.parentId =
            'Loại linh kiện của danh mục con phải trùng khớp với danh mục cha.'
        } else {
          resolvedParentId = parentNode.id
        }
      }
    }
  }

  if (Object.keys(errors).length > 0 || !isValidComponentType(compTypeNum)) {
    return {
      isValid: false,
      errors,
      payload: null,
    }
  }

  return {
    isValid: true,
    errors: {},
    payload: {
      name: cleanName,
      componentType: compTypeNum,
      description: rawDesc.length > 0 ? rawDesc : null,
      parentId: resolvedParentId,
    },
  }
}

export interface ExecuteCategorySaveDeps {
  mode: 'create' | 'edit'
  editingCategoryId: string | null
  draft: CategoryDraft
  flatNodes: FlattenedCategoryNode[]
  isSubmitting: boolean
  isContextCurrent: () => boolean
  createCategory: (payload: CreateCategoryRequest) => Promise<Category>
  updateCategory: (id: string, payload: UpdateCategoryRequest) => Promise<Category>
  refetchTree: () => Promise<void>
  onValidationError: (errors: Record<string, string>) => void
  onSubmittingChange: (submitting: boolean) => void
  onApiError: (message: string | null) => void
  onSuccess: (saved: Category) => void
}

export async function executeCategorySave(deps: ExecuteCategorySaveDeps): Promise<boolean> {
  if (deps.isSubmitting) return false

  const validation = validateAndBuildCategoryPayload({
    draft: deps.draft,
    flatNodes: deps.flatNodes,
    editingCategoryId: deps.mode === 'edit' ? deps.editingCategoryId : null,
  })

  if (!validation.isValid || !validation.payload) {
    deps.onValidationError(validation.errors)
    return false
  }

  if (deps.mode === 'edit' && !isValidUuid(deps.editingCategoryId)) {
    deps.onApiError('Id danh mục cần chỉnh sửa không hợp lệ.')
    return false
  }

  deps.onValidationError({})
  deps.onApiError(null)
  deps.onSubmittingChange(true)

  try {
    const saved =
      deps.mode === 'create'
        ? await deps.createCategory(validation.payload)
        : await deps.updateCategory(deps.editingCategoryId!.trim(), validation.payload)

    if (!deps.isContextCurrent()) return false

    await deps.refetchTree()
    if (!deps.isContextCurrent()) return false

    deps.onSuccess(saved)
    return true
  } catch (err: unknown) {
    if (!deps.isContextCurrent()) return false
    if (err instanceof Error && err.name === 'AbortError') return false

    // Giữ nguyên dữ liệu người dùng đã nhập trong form khi gặp lỗi (400/409/500)
    const msg = mapAdminApiError(err, 'Không thể lưu danh mục. Vui lòng thử lại.')
    deps.onApiError(msg)
    return false
  } finally {
    if (deps.isContextCurrent()) {
      deps.onSubmittingChange(false)
    }
  }
}

export interface ExecuteCategoryDeleteDeps {
  categoryId: string
  isDeleting: boolean
  isContextCurrent: () => boolean
  deleteCategory: (id: string) => Promise<void>
  refetchTree: () => Promise<void>
  onDeletingChange: (deleting: boolean) => void
  onDeleteError: (message: string | null) => void
  onDeleteSuccess: () => void
}

/**
 * Xóa danh mục đơn lẻ (không tự động xóa/di chuyển sản phẩm hoặc cascade danh mục con).
 * - 204 No Content: refetch tree đúng 1 lần và đóng modal.
 * - 409 Category.HasSubCategories / Category.HasProducts: hiển thị rõ thông báo và giữ nguyên dữ liệu.
 */
export async function executeCategoryDelete(
  deps: ExecuteCategoryDeleteDeps
): Promise<boolean> {
  if (deps.isDeleting) return false
  if (!isValidUuid(deps.categoryId)) {
    deps.onDeleteError('Id danh mục cần xóa không hợp lệ.')
    return false
  }

  deps.onDeleteError(null)
  deps.onDeletingChange(true)

  try {
    await deps.deleteCategory(deps.categoryId.trim())
    if (!deps.isContextCurrent()) return false

    await deps.refetchTree()
    if (!deps.isContextCurrent()) return false

    deps.onDeleteSuccess()
    return true
  } catch (err: unknown) {
    if (!deps.isContextCurrent()) return false
    if (err instanceof Error && err.name === 'AbortError') return false

    const msg = mapAdminApiError(
      err,
      'Không thể xóa danh mục này. Vui lòng kiểm tra lại.'
    )
    deps.onDeleteError(msg)
    return false
  } finally {
    if (deps.isContextCurrent()) {
      deps.onDeletingChange(false)
    }
  }
}
