export interface PublicBannerDto {
  id: string
  title: string
  imageUrl: string
  targetUrl: string
  displayOrder: number
}

export interface ManagedBannerDto {
  id: string
  title: string
  imageUrl: string
  imageObjectKey: string
  targetUrl: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateBannerRequest {
  title: string
  imageObjectKey: string
  targetUrl: string
  displayOrder: number
  isActive: boolean
}

export interface UpdateBannerRequest {
  title: string
  imageObjectKey: string
  targetUrl: string
  displayOrder: number
  isActive: boolean
}

export interface BannerDraft {
  title: string
  imageObjectKey: string
  imageUrl: string
  targetUrl: string
  displayOrder: number
  isActive: boolean
}
