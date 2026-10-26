import React from 'react'
import logoSrc from '../../assets/branding/riutek-logo.png'

export interface BrandLogoProps {
  className?: string
  alt?: string
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-9 w-auto',
  alt = 'RiuTek',
}) => {
  return (
    <img
      src={logoSrc}
      alt={alt}
      className={`object-contain rounded-lg ${className}`}
      loading="eager"
      decoding="async"
    />
  )
}
