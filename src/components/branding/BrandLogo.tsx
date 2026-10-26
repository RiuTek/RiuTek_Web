import React from 'react'
import markSrc from '../../assets/branding/riutek-mark-v2.png'

export interface BrandLogoProps {
  className?: string
  markClassName?: string
  textClassName?: string
  theme?: 'light' | 'dark' | 'auto'
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  markClassName = 'h-8 sm:h-9 w-auto',
  textClassName = 'text-xl sm:text-2xl',
  theme = 'auto',
}) => {
  const riuColorClass =
    theme === 'dark'
      ? 'text-white'
      : theme === 'light'
      ? 'text-slate-950'
      : 'text-slate-950 dark:text-white'

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <img
        src={markSrc}
        alt=""
        aria-hidden="true"
        className={`object-contain flex-shrink-0 ${markClassName}`}
        loading="eager"
        decoding="async"
      />
      <span
        className={`font-extrabold tracking-tight font-sans leading-none flex items-center ${textClassName}`}
      >
        <span className={riuColorClass}>Riu</span>
        <span className="text-red-600">Tek</span>
      </span>
    </div>
  )
}
