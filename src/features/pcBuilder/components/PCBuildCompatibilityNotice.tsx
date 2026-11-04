import React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  evaluateCompatibility,
  COMPATIBILITY_GUIDANCE_NOTICE,
  COMPATIBILITY_LABELS,
} from '../pcBuildCompatibilityHelper'
import type { CompatibilityIssue } from '../pcBuilderTypes'

export interface PCBuildCompatibilityNoticeProps {
  isCompatible?: boolean | null
  isCompleteSystem?: boolean | null
  issues?: CompatibilityIssue[] | null
  missingComponents?: string[] | null
  estimatedWattage?: number | null
  recommendedPsuWattage?: number | null
  hasPreviewError?: boolean
  compact?: boolean
  showPowerSpecs?: boolean
  showCompleteSystemBadge?: boolean
  className?: string
}

export const PCBuildCompatibilityNotice: React.FC<PCBuildCompatibilityNoticeProps> = ({
  isCompatible,
  isCompleteSystem,
  issues,
  missingComponents,
  estimatedWattage,
  recommendedPsuWattage,
  hasPreviewError = false,
  compact = false,
  showPowerSpecs = false,
  showCompleteSystemBadge = false,
  className = '',
}) => {
  const assessment = evaluateCompatibility({
    isCompatible,
    issues,
    hasPreviewError,
  })

  const { classifiedIssues, level, isGenericErrorNotice } = assessment
  const safeMissing = Array.isArray(missingComponents) ? missingComponents : []
  const hasMissing = isCompleteSystem === false && safeMissing.length > 0

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 1. Main Status Badges / Cards */}
      <div className={`grid gap-2.5 ${showCompleteSystemBadge ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Compatibility Assessment Badge */}
        <div
          className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
            level === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : level === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : level === 'clean'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}
        >
          {level === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          ) : level === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          ) : level === 'clean' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-slate-500 flex-shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
              Độ tương thích linh kiện
            </span>
            <span className="text-xs font-bold block truncate" title={assessment.title}>
              {assessment.title}
            </span>
          </div>
        </div>

        {/* Complete System Badge (tùy chọn) */}
        {showCompleteSystemBadge && (
          <div
            className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
              isCompleteSystem
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {isCompleteSystem ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                Độ hoàn chỉnh
              </span>
              <span className="text-xs font-bold truncate block">
                {isCompleteSystem
                  ? COMPATIBILITY_LABELS.complete
                  : COMPATIBILITY_LABELS.incomplete}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Generic Error Notice (khi isCompatible=false nhưng BE không gửi kèm list error issues) */}
      {isGenericErrorNotice && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Hệ thống ghi nhận cấu hình có xung đột tương thích hoặc thông số chưa phù hợp giữa các linh kiện đã chọn.
          </p>
        </div>
      )}

      {/* 3. Missing Components (độc lập với tương thích) */}
      {hasMissing && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-1.5 text-amber-900 text-xs">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{COMPATIBILITY_LABELS.incomplete} cho một dàn máy:</span>
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {safeMissing.map((comp, idx) => (
              <span
                key={`${comp}-${idx}`}
                className="px-2 py-0.5 bg-white border border-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold"
              >
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. Power Specifications (nếu được yêu cầu) */}
      {showPowerSpecs && typeof estimatedWattage === 'number' && (
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Ước tính tiêu thụ:</span>
            </span>
            <span className="font-bold text-slate-900">{estimatedWattage} W</span>
          </div>

          {typeof recommendedPsuWattage === 'number' && recommendedPsuWattage > 0 && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
              <span className="text-slate-500 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-blue-500" />
                <span>Khuyến nghị bộ nguồn (PSU):</span>
              </span>
              <span className="font-bold text-slate-900">≥ {recommendedPsuWattage} W</span>
            </div>
          )}
        </div>
      )}

      {/* 5. Issues List (Errors, Warnings, Others) */}
      {classifiedIssues.totalCount > 0 && (
        <div className="space-y-2">
          {!compact && (
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Chi tiết lưu ý ({classifiedIssues.totalCount})
            </h4>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {/* Errors */}
            {classifiedIssues.errors.map((issue, idx) => (
              <div
                key={`err-${issue.ruleId || idx}-${idx}`}
                className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs space-y-1"
              >
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="font-semibold leading-relaxed break-words">
                      {issue.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-rose-700 opacity-90">
                      {(issue.componentA || issue.componentB) && (
                        <span>
                          {[issue.componentA, issue.componentB].filter(Boolean).join(' • ')}
                        </span>
                      )}
                      {issue.ruleId && (
                        <span className="font-mono bg-rose-100/80 px-1 py-0.2 rounded border border-rose-200">
                          {issue.ruleId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Warnings */}
            {classifiedIssues.warnings.map((issue, idx) => (
              <div
                key={`warn-${issue.ruleId || idx}-${idx}`}
                className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="font-semibold leading-relaxed break-words">
                      {issue.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-amber-700 opacity-90">
                      {(issue.componentA || issue.componentB) && (
                        <span>
                          {[issue.componentA, issue.componentB].filter(Boolean).join(' • ')}
                        </span>
                      )}
                      {issue.ruleId && (
                        <span className="font-mono bg-amber-100/80 px-1 py-0.2 rounded border border-amber-200">
                          {issue.ruleId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Others / Info */}
            {classifiedIssues.others.map((issue, idx) => (
              <div
                key={`other-${issue.ruleId || idx}-${idx}`}
                className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs space-y-1"
              >
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="font-semibold leading-relaxed break-words">
                      {issue.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-blue-700 opacity-90">
                      {(issue.componentA || issue.componentB) && (
                        <span>
                          {[issue.componentA, issue.componentB].filter(Boolean).join(' • ')}
                        </span>
                      )}
                      {issue.ruleId && (
                        <span className="font-mono bg-blue-100/80 px-1 py-0.2 rounded border border-blue-200">
                          {issue.ruleId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Guidance Notice: Bạn vẫn có thể lưu cấu hình và mua linh kiện */}
      <div className="pt-1 text-[11px] text-slate-500 italic leading-relaxed">
        {assessment.level === 'unverified'
          ? assessment.guidanceMessage
          : COMPATIBILITY_GUIDANCE_NOTICE}
      </div>
    </div>
  )
}
