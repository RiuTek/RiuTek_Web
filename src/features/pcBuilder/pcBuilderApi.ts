import { apiClient } from '../../lib/api'
import type { PCBuildItemInput, PCBuildPreviewResult } from './pcBuilderTypes'

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
