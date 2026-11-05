import { apiClient } from '../../lib/api'
import type {
  CreateBannerRequest,
  ManagedBannerDto,
  PublicBannerDto,
  UpdateBannerRequest,
} from './bannerTypes'

/**
 * GET /api/v1/banners (PUBLIC — không auth)
 * Trả về danh sách banner đang active, sắp xếp theo DisplayOrder ASC, Id ASC từ Backend.
 * Mảng rỗng [] là trạng thái bình thường khi chưa có banner hoạt động.
 */
export async function getPublicBanners(signal?: AbortSignal): Promise<PublicBannerDto[]> {
  return apiClient.get<PublicBannerDto[]>('/banners', {
    signal,
  })
}

/**
 * GET /api/v1/banners/managed (TOKEN — ContentManager: Admin & Staff)
 * Lấy toàn bộ danh sách banner (cả active lẫn inactive) kèm imageObjectKey và metadata.
 */
export async function getManagedBanners(
  token: string,
  signal?: AbortSignal
): Promise<ManagedBannerDto[]> {
  return apiClient.get<ManagedBannerDto[]>('/banners/managed', {
    token,
    signal,
  })
}

/**
 * GET /api/v1/banners/{id} (TOKEN)
 */
export async function getManagedBannerById(
  id: string,
  token: string,
  signal?: AbortSignal
): Promise<ManagedBannerDto> {
  const cleanId = id.trim()
  return apiClient.get<ManagedBannerDto>(`/banners/${encodeURIComponent(cleanId)}`, {
    token,
    signal,
  })
}

/**
 * POST /api/v1/banners (TOKEN — ContentManager)
 * Tạo mới banner, lưu imageObjectKey đã confirm qua product-media.
 */
export async function createBanner(
  request: CreateBannerRequest,
  token: string,
  signal?: AbortSignal
): Promise<ManagedBannerDto> {
  return apiClient.post<ManagedBannerDto>('/banners', request, {
    token,
    signal,
  })
}

/**
 * PUT /api/v1/banners/{id} (TOKEN — ContentManager)
 * Cập nhật đầy đủ 5 trường của banner.
 */
export async function updateBanner(
  id: string,
  request: UpdateBannerRequest,
  token: string,
  signal?: AbortSignal
): Promise<ManagedBannerDto> {
  const cleanId = id.trim()
  return apiClient.put<ManagedBannerDto>(`/banners/${encodeURIComponent(cleanId)}`, request, {
    token,
    signal,
  })
}

/**
 * DELETE /api/v1/banners/{id} (TOKEN — ContentManager)
 * Xóa bản ghi banner (204 No Content, không có JSON body).
 * Thao tác này không xóa tệp ảnh trên Cloudflare R2 để tránh ảnh hưởng dữ liệu dùng chung.
 */
export async function deleteBanner(
  id: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  const cleanId = id.trim()
  await apiClient.delete<void>(`/banners/${encodeURIComponent(cleanId)}`, {
    token,
    signal,
  })
}
