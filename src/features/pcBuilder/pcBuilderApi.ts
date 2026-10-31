import { apiClient, type PagedResult } from '../../lib/api'
import type {
  CreatePCBuildRequest,
  MyPCBuild,
  MyPCBuildSummary,
  PCBuildItemInput,
  PCBuildPreviewResult,
  UpdatePCBuildRequest,
} from './pcBuilderTypes'

/**
 * Gửi cấu hình linh kiện lên Backend để tính toán và kiểm tra tương thích.
 * Endpoint public, không gửi JWT token.
 */
export function previewPCBuild(
  items: PCBuildItemInput[],
  signal?: AbortSignal
): Promise<PCBuildPreviewResult> {
  return apiClient.post<PCBuildPreviewResult>(
    '/pc-builds/preview',
    { items },
    {
      signal,
    }
  )
}

/**
 * Lưu cấu hình PC hiện tại vào tài khoản khách hàng đã đăng nhập.
 * Yêu cầu quyền Customer (Bearer token).
 */
export function createPCBuild(
  request: CreatePCBuildRequest,
  token: string,
  signal?: AbortSignal
): Promise<MyPCBuild> {
  return apiClient.post<MyPCBuild>('/pc-builds', request, {
    token,
    signal,
  })
}

/**
 * Lấy danh sách cấu hình đã lưu của khách hàng hiện tại (phân trang).
 * Yêu cầu quyền Customer (Bearer token).
 */
export function getMyPCBuilds(
  pageIndex: number = 1,
  pageSize: number = 20,
  token: string,
  signal?: AbortSignal
): Promise<PagedResult<MyPCBuildSummary>> {
  return apiClient.get<PagedResult<MyPCBuildSummary>>('/pc-builds/mine', {
    params: {
      pageIndex,
      pageSize,
    },
    token,
    signal,
  })
}

/**
 * Lấy chi tiết một cấu hình đã lưu theo ID.
 * Yêu cầu quyền Customer (Bearer token).
 */
export function getMyPCBuildById(
  id: string,
  token: string,
  signal?: AbortSignal
): Promise<MyPCBuild> {
  return apiClient.get<MyPCBuild>(`/pc-builds/${id}`, {
    token,
    signal,
  })
}

/**
 * Cập nhật cấu hình PC đã lưu (thay thế tên, mô tả và toàn bộ linh kiện).
 * Yêu cầu quyền Customer (Bearer token).
 */
export function updateMyPCBuild(
  id: string,
  request: UpdatePCBuildRequest,
  token: string,
  signal?: AbortSignal
): Promise<MyPCBuild> {
  return apiClient.put<MyPCBuild>(`/pc-builds/${id}`, request, {
    token,
    signal,
  })
}

/**
 * Xóa một cấu hình đã lưu.
 * Yêu cầu quyền Customer (Bearer token).
 * Backend trả về 204 NoContent khi thành công.
 */
export function deleteMyPCBuild(
  id: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  return apiClient.delete<void>(`/pc-builds/${id}`, {
    token,
    signal,
  })
}
