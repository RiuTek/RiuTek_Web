import { apiClient } from '../../lib/api'
import type {
  CreatePCBuildRequest,
  MyPCBuild,
  PCBuildItemInput,
  PCBuildPreviewResult,
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
