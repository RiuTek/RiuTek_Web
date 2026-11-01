import React from 'react'
import {
  COMPONENT_TYPE_LABELS,
  COOLER_TYPE_LABELS,
  CPU_SOCKET_LABELS,
  MOTHERBOARD_FORM_FACTOR_LABELS,
  PSU_EFFICIENCY_LABELS,
  PSU_FORM_FACTOR_LABELS,
  PSU_MODULARITY_LABELS,
  RAM_FORM_FACTOR_LABELS,
  RAM_TYPE_LABELS,
  STORAGE_INTERFACE_LABELS,
  STORAGE_TYPE_LABELS,
} from '../../products/productConstants'
import {
  ComponentType,
  CoolerType,
  CpuSocket,
  MotherboardFormFactor,
  PsuEfficiency,
  PsuFormFactor,
  PsuModularity,
  RamFormFactor,
  RamType,
  StorageInterface,
  StorageType,
} from '../../products/productTypes'
import { isAioCoolerType } from '../adminProductHelper'
import type {
  AccessorySpecDraft,
  AnySpecificationDraft,
  CaseSpecDraft,
  CoolerSpecDraft,
  CpuSpecDraft,
  GpuSpecDraft,
  MotherboardSpecDraft,
  PsuSpecDraft,
  RamSpecDraft,
  StorageSpecDraft,
} from '../adminTypes'

interface ProductSpecificationFieldsProps {
  componentType: ComponentType
  specDraft: AnySpecificationDraft
  disabled?: boolean
  errors: Record<string, string>
  onChange: (nextSpecDraft: AnySpecificationDraft) => void
}

const CPU_SOCKET_OPTIONS = Object.entries(CPU_SOCKET_LABELS).map(
  ([val, label]) => ({ value: Number(val) as CpuSocket, label })
)
const RAM_TYPE_OPTIONS = Object.entries(RAM_TYPE_LABELS).map(([val, label]) => ({
  value: Number(val) as RamType,
  label,
}))
const RAM_FORM_FACTOR_OPTIONS = Object.entries(RAM_FORM_FACTOR_LABELS).map(
  ([val, label]) => ({ value: Number(val) as RamFormFactor, label })
)
const MB_FORM_FACTOR_OPTIONS = Object.entries(MOTHERBOARD_FORM_FACTOR_LABELS).map(
  ([val, label]) => ({ value: Number(val) as MotherboardFormFactor, label })
)
const STORAGE_TYPE_OPTIONS = Object.entries(STORAGE_TYPE_LABELS).map(
  ([val, label]) => ({ value: Number(val) as StorageType, label })
)
const STORAGE_INTERFACE_OPTIONS = Object.entries(STORAGE_INTERFACE_LABELS).map(
  ([val, label]) => ({ value: Number(val) as StorageInterface, label })
)
const PSU_EFFICIENCY_OPTIONS = Object.entries(PSU_EFFICIENCY_LABELS).map(
  ([val, label]) => ({ value: Number(val) as PsuEfficiency, label })
)
const PSU_MODULARITY_OPTIONS = Object.entries(PSU_MODULARITY_LABELS).map(
  ([val, label]) => ({ value: Number(val) as PsuModularity, label })
)
const PSU_FORM_FACTOR_OPTIONS = Object.entries(PSU_FORM_FACTOR_LABELS).map(
  ([val, label]) => ({ value: Number(val) as PsuFormFactor, label })
)
const COOLER_TYPE_OPTIONS = Object.entries(COOLER_TYPE_LABELS).map(
  ([val, label]) => ({ value: Number(val) as CoolerType, label })
)

function inputClass(hasError: boolean): string {
  return `w-full rounded-lg border px-3 py-2 text-xs text-slate-900 transition outline-none ${
    hasError
      ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
      : 'border-slate-300 bg-white focus:border-blue-600'
  } disabled:bg-slate-100`
}

export const ProductSpecificationFields: React.FC<
  ProductSpecificationFieldsProps
> = ({ componentType, specDraft, disabled = false, errors, onChange }) => {
  const renderFieldError = (key: string) => {
    const msg = errors[key]
    if (!msg) return null
    return <p className="mt-1 text-xs font-medium text-rose-600">{msg}</p>
  }

  const toggleNumberInList = (list: number[], item: number): number[] => {
    if (list.includes(item)) {
      return list.filter((v) => v !== item)
    }
    return [...list, item]
  }

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Thông Số Kỹ Thuật — {COMPONENT_TYPE_LABELS[componentType]}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Các trường có dấu <span className="text-rose-600">*</span> là bắt buộc theo quy chuẩn
            tương thích phần cứng RiuTek.
          </p>
        </div>
        <span className="rounded-md bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700">
          ComponentType #{componentType}
        </span>
      </div>

      {/* 1. CPU */}
      {componentType === ComponentType.CPU &&
        (() => {
          const d = specDraft as CpuSpecDraft
          const patch = (partial: Partial<CpuSpecDraft>) =>
            onChange({ ...d, ...partial })

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Socket CPU <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.socket}
                  disabled={disabled}
                  onChange={(e) => patch({ socket: e.target.value })}
                  className={inputClass(Boolean(errors['spec.socket']))}
                >
                  <option value="">-- Chọn Socket --</option>
                  {CPU_SOCKET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.socket')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số nhân (Cores) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.coreCount}
                  disabled={disabled}
                  onChange={(e) => patch({ coreCount: e.target.value })}
                  placeholder="Ví dụ: 14"
                  className={inputClass(Boolean(errors['spec.coreCount']))}
                />
                {renderFieldError('spec.coreCount')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số luồng (Threads) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.threadCount}
                  disabled={disabled}
                  onChange={(e) => patch({ threadCount: e.target.value })}
                  placeholder="Ví dụ: 20"
                  className={inputClass(Boolean(errors['spec.threadCount']))}
                />
                {renderFieldError('spec.threadCount')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Xung nhịp cơ bản (GHz) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  value={d.baseClockGhz}
                  disabled={disabled}
                  onChange={(e) => patch({ baseClockGhz: e.target.value })}
                  placeholder="Ví dụ: 3.5"
                  className={inputClass(Boolean(errors['spec.baseClockGhz']))}
                />
                {renderFieldError('spec.baseClockGhz')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Xung nhịp Boost (GHz) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  value={d.boostClockGhz}
                  disabled={disabled}
                  onChange={(e) => patch({ boostClockGhz: e.target.value })}
                  placeholder="Ví dụ: 5.3"
                  className={inputClass(Boolean(errors['spec.boostClockGhz']))}
                />
                {renderFieldError('spec.boostClockGhz')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Công suất TDP (W) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.tdpWattage}
                  disabled={disabled}
                  onChange={(e) => patch({ tdpWattage: e.target.value })}
                  placeholder="Ví dụ: 125"
                  className={inputClass(Boolean(errors['spec.tdpWattage']))}
                />
                {renderFieldError('spec.tdpWattage')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chuẩn RAM hỗ trợ <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.supportedMemoryType}
                  disabled={disabled}
                  onChange={(e) => patch({ supportedMemoryType: e.target.value })}
                  className={inputClass(
                    Boolean(errors['spec.supportedMemoryType'])
                  )}
                >
                  <option value="">-- Chọn chuẩn RAM --</option>
                  {RAM_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.supportedMemoryType')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Xung RAM tối đa (MHz) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.maxMemorySpeedMhz}
                  disabled={disabled}
                  onChange={(e) => patch({ maxMemorySpeedMhz: e.target.value })}
                  placeholder="Ví dụ: 5600"
                  className={inputClass(Boolean(errors['spec.maxMemorySpeedMhz']))}
                />
                {renderFieldError('spec.maxMemorySpeedMhz')}
              </div>

              <div className="flex items-center pt-5">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={d.hasIntegratedGpu}
                    disabled={disabled}
                    onChange={(e) => patch({ hasIntegratedGpu: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Tích hợp nhân đồ họa (iGPU)
                </label>
              </div>
            </div>
          )
        })()}

      {/* 2. Motherboard */}
      {componentType === ComponentType.Motherboard &&
        (() => {
          const d = specDraft as MotherboardSpecDraft
          const patch = (partial: Partial<MotherboardSpecDraft>) =>
            onChange({ ...d, ...partial })

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Socket CPU <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.socket}
                  disabled={disabled}
                  onChange={(e) => patch({ socket: e.target.value })}
                  className={inputClass(Boolean(errors['spec.socket']))}
                >
                  <option value="">-- Chọn Socket --</option>
                  {CPU_SOCKET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.socket')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chipset <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={d.chipset}
                  disabled={disabled}
                  onChange={(e) => patch({ chipset: e.target.value })}
                  placeholder="Ví dụ: B760, Z790, B650..."
                  className={inputClass(Boolean(errors['spec.chipset']))}
                />
                {renderFieldError('spec.chipset')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Kích thước (Form Factor) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.formFactor}
                  disabled={disabled}
                  onChange={(e) => patch({ formFactor: e.target.value })}
                  className={inputClass(Boolean(errors['spec.formFactor']))}
                >
                  <option value="">-- Chọn Form Factor --</option>
                  {MB_FORM_FACTOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.formFactor')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Loại RAM hỗ trợ <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.memoryType}
                  disabled={disabled}
                  onChange={(e) => patch({ memoryType: e.target.value })}
                  className={inputClass(Boolean(errors['spec.memoryType']))}
                >
                  <option value="">-- Chọn chuẩn RAM --</option>
                  {RAM_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.memoryType')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số khe RAM <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.memorySlots}
                  disabled={disabled}
                  onChange={(e) => patch({ memorySlots: e.target.value })}
                  placeholder="Ví dụ: 4"
                  className={inputClass(Boolean(errors['spec.memorySlots']))}
                />
                {renderFieldError('spec.memorySlots')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Dung lượng RAM tối đa (GB) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.maxMemoryCapacityGb}
                  disabled={disabled}
                  onChange={(e) => patch({ maxMemoryCapacityGb: e.target.value })}
                  placeholder="Ví dụ: 192"
                  className={inputClass(
                    Boolean(errors['spec.maxMemoryCapacityGb'])
                  )}
                />
                {renderFieldError('spec.maxMemoryCapacityGb')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số khe M.2 <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={d.m2Slots}
                  disabled={disabled}
                  onChange={(e) => patch({ m2Slots: e.target.value })}
                  placeholder="Ví dụ: 3"
                  className={inputClass(Boolean(errors['spec.m2Slots']))}
                />
                {renderFieldError('spec.m2Slots')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số cổng SATA <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={d.sataPorts}
                  disabled={disabled}
                  onChange={(e) => patch({ sataPorts: e.target.value })}
                  placeholder="Ví dụ: 4"
                  className={inputClass(Boolean(errors['spec.sataPorts']))}
                />
                {renderFieldError('spec.sataPorts')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số khe PCIe <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={d.pcieSlots}
                  disabled={disabled}
                  onChange={(e) => patch({ pcieSlots: e.target.value })}
                  placeholder="Ví dụ: 2"
                  className={inputClass(Boolean(errors['spec.pcieSlots']))}
                />
                {renderFieldError('spec.pcieSlots')}
              </div>

              <div className="flex items-center pt-2">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={d.hasWifi}
                    disabled={disabled}
                    onChange={(e) => patch({ hasWifi: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Tích hợp Wi-Fi / Bluetooth
                </label>
              </div>
            </div>
          )
        })()}

      {/* 3. GPU */}
      {componentType === ComponentType.GPU &&
        (() => {
          const d = specDraft as GpuSpecDraft
          const patch = (partial: Partial<GpuSpecDraft>) =>
            onChange({ ...d, ...partial })

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chipset GPU <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={d.chipset}
                  disabled={disabled}
                  onChange={(e) => patch({ chipset: e.target.value })}
                  placeholder="Ví dụ: RTX 4070 Super"
                  className={inputClass(Boolean(errors['spec.chipset']))}
                />
                {renderFieldError('spec.chipset')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Dung lượng VRAM (GB) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.vramGb}
                  disabled={disabled}
                  onChange={(e) => patch({ vramGb: e.target.value })}
                  placeholder="Ví dụ: 12"
                  className={inputClass(Boolean(errors['spec.vramGb']))}
                />
                {renderFieldError('spec.vramGb')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chuẩn VRAM
                </label>
                <input
                  type="text"
                  value={d.vramType}
                  disabled={disabled}
                  onChange={(e) => patch({ vramType: e.target.value })}
                  placeholder="Ví dụ: GDDR6X"
                  className={inputClass(false)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chiều dài card (mm) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.lengthMm}
                  disabled={disabled}
                  onChange={(e) => patch({ lengthMm: e.target.value })}
                  placeholder="Ví dụ: 300"
                  className={inputClass(Boolean(errors['spec.lengthMm']))}
                />
                {renderFieldError('spec.lengthMm')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Độ dày (Slot Width) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0.5}
                  step="any"
                  value={d.slotWidth}
                  disabled={disabled}
                  onChange={(e) => patch({ slotWidth: e.target.value })}
                  placeholder="Ví dụ: 2.5"
                  className={inputClass(Boolean(errors['spec.slotWidth']))}
                />
                {renderFieldError('spec.slotWidth')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Công suất TDP (W) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.tdpWattage}
                  disabled={disabled}
                  onChange={(e) => patch({ tdpWattage: e.target.value })}
                  placeholder="Ví dụ: 220"
                  className={inputClass(Boolean(errors['spec.tdpWattage']))}
                />
                {renderFieldError('spec.tdpWattage')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Nguồn khuyến nghị (W) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.recommendedPsuWattage}
                  disabled={disabled}
                  onChange={(e) =>
                    patch({ recommendedPsuWattage: e.target.value })
                  }
                  placeholder="Ví dụ: 650"
                  className={inputClass(
                    Boolean(errors['spec.recommendedPsuWattage'])
                  )}
                />
                {renderFieldError('spec.recommendedPsuWattage')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Cổng cấp nguồn (Power Connectors)
                </label>
                <input
                  type="text"
                  value={d.powerConnectors}
                  disabled={disabled}
                  onChange={(e) => patch({ powerConnectors: e.target.value })}
                  placeholder="Ví dụ: 1x 16-pin (12VHPWR) hoặc 2x 8-pin"
                  className={inputClass(false)}
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={d.requires12VHPWR}
                    disabled={disabled}
                    onChange={(e) => patch({ requires12VHPWR: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Yêu cầu cáp nguồn 12VHPWR (PCIe 5.0)
                </label>
              </div>
            </div>
          )
        })()}

      {/* 4. RAM */}
      {componentType === ComponentType.RAM &&
        (() => {
          const d = specDraft as RamSpecDraft
          const patch = (partial: Partial<RamSpecDraft>) =>
            onChange({ ...d, ...partial })

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chuẩn RAM <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.memoryType}
                  disabled={disabled}
                  onChange={(e) => patch({ memoryType: e.target.value })}
                  className={inputClass(Boolean(errors['spec.memoryType']))}
                >
                  <option value="">-- Chọn chuẩn RAM --</option>
                  {RAM_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.memoryType')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Kiểu chân cắm (Form Factor) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.formFactor}
                  disabled={disabled}
                  onChange={(e) => patch({ formFactor: e.target.value })}
                  className={inputClass(Boolean(errors['spec.formFactor']))}
                >
                  <option value="">-- Chọn Form Factor --</option>
                  {RAM_FORM_FACTOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.formFactor')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Tổng dung lượng bộ kit (GB) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.capacityGb}
                  disabled={disabled}
                  onChange={(e) => patch({ capacityGb: e.target.value })}
                  placeholder="Ví dụ: 32"
                  className={inputClass(Boolean(errors['spec.capacityGb']))}
                />
                {renderFieldError('spec.capacityGb')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Số thanh (Modules) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.moduleCount}
                  disabled={disabled}
                  onChange={(e) => patch({ moduleCount: e.target.value })}
                  placeholder="Ví dụ: 2"
                  className={inputClass(Boolean(errors['spec.moduleCount']))}
                />
                {renderFieldError('spec.moduleCount')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Tốc độ Bus (MHz) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.speedMhz}
                  disabled={disabled}
                  onChange={(e) => patch({ speedMhz: e.target.value })}
                  placeholder="Ví dụ: 6000"
                  className={inputClass(Boolean(errors['spec.speedMhz']))}
                />
                {renderFieldError('spec.speedMhz')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Độ trễ CAS (CL) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.casLatency}
                  disabled={disabled}
                  onChange={(e) => patch({ casLatency: e.target.value })}
                  placeholder="Ví dụ: 30"
                  className={inputClass(Boolean(errors['spec.casLatency']))}
                />
                {renderFieldError('spec.casLatency')}
              </div>

              <div className="flex items-center pt-2">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={d.hasRgb}
                    disabled={disabled}
                    onChange={(e) => patch({ hasRgb: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Có đèn LED RGB
                </label>
              </div>
            </div>
          )
        })()}

      {/* 5. Storage */}
      {componentType === ComponentType.Storage &&
        (() => {
          const d = specDraft as StorageSpecDraft
          const patch = (partial: Partial<StorageSpecDraft>) =>
            onChange({ ...d, ...partial })

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Loại ổ cứng <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.storageType}
                  disabled={disabled}
                  onChange={(e) => patch({ storageType: e.target.value })}
                  className={inputClass(Boolean(errors['spec.storageType']))}
                >
                  <option value="">-- Chọn loại ổ cứng --</option>
                  {STORAGE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.storageType')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chuẩn giao tiếp <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.interface}
                  disabled={disabled}
                  onChange={(e) => patch({ interface: e.target.value })}
                  className={inputClass(Boolean(errors['spec.interface']))}
                >
                  <option value="">-- Chọn chuẩn giao tiếp --</option>
                  {STORAGE_INTERFACE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.interface')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Dung lượng (GB) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.capacityGb}
                  disabled={disabled}
                  onChange={(e) => patch({ capacityGb: e.target.value })}
                  placeholder="Ví dụ: 1000"
                  className={inputClass(Boolean(errors['spec.capacityGb']))}
                />
                {renderFieldError('spec.capacityGb')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Tốc độ đọc (MB/s) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={d.readSpeedMBs}
                  disabled={disabled}
                  onChange={(e) => patch({ readSpeedMBs: e.target.value })}
                  placeholder="Ví dụ: 7300"
                  className={inputClass(Boolean(errors['spec.readSpeedMBs']))}
                />
                {renderFieldError('spec.readSpeedMBs')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Tốc độ ghi (MB/s) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={d.writeSpeedMBs}
                  disabled={disabled}
                  onChange={(e) => patch({ writeSpeedMBs: e.target.value })}
                  placeholder="Ví dụ: 6000"
                  className={inputClass(Boolean(errors['spec.writeSpeedMBs']))}
                />
                {renderFieldError('spec.writeSpeedMBs')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Kích thước (Form Factor) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={d.formFactor}
                  disabled={disabled}
                  onChange={(e) => patch({ formFactor: e.target.value })}
                  placeholder='Ví dụ: M.2 2280 hoặc 2.5"'
                  className={inputClass(Boolean(errors['spec.formFactor']))}
                />
                {renderFieldError('spec.formFactor')}
              </div>
            </div>
          )
        })()}

      {/* 6. PSU */}
      {componentType === ComponentType.PSU &&
        (() => {
          const d = specDraft as PsuSpecDraft
          const patch = (partial: Partial<PsuSpecDraft>) =>
            onChange({ ...d, ...partial })

          return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Công suất định mức (W) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.wattage}
                  disabled={disabled}
                  onChange={(e) => patch({ wattage: e.target.value })}
                  placeholder="Ví dụ: 750"
                  className={inputClass(Boolean(errors['spec.wattage']))}
                />
                {renderFieldError('spec.wattage')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chuẩn hiệu suất 80 Plus <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.efficiency}
                  disabled={disabled}
                  onChange={(e) => patch({ efficiency: e.target.value })}
                  className={inputClass(Boolean(errors['spec.efficiency']))}
                >
                  <option value="">-- Chọn chuẩn 80 Plus --</option>
                  {PSU_EFFICIENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.efficiency')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Kiểu dây cáp (Modularity) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.modularity}
                  disabled={disabled}
                  onChange={(e) => patch({ modularity: e.target.value })}
                  className={inputClass(Boolean(errors['spec.modularity']))}
                >
                  <option value="">-- Chọn kiểu dây cáp --</option>
                  {PSU_MODULARITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.modularity')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Kích thước nguồn (Form Factor) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={d.formFactor}
                  disabled={disabled}
                  onChange={(e) => patch({ formFactor: e.target.value })}
                  className={inputClass(Boolean(errors['spec.formFactor']))}
                >
                  <option value="">-- Chọn chuẩn nguồn --</option>
                  {PSU_FORM_FACTOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {renderFieldError('spec.formFactor')}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Chiều dài nguồn (mm) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={d.lengthMm}
                  disabled={disabled}
                  onChange={(e) => patch({ lengthMm: e.target.value })}
                  placeholder="Ví dụ: 150"
                  className={inputClass(Boolean(errors['spec.lengthMm']))}
                />
                {renderFieldError('spec.lengthMm')}
              </div>

              <div className="flex items-center pt-5">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={d.has12VHPWR}
                    disabled={disabled}
                    onChange={(e) => patch({ has12VHPWR: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Trang bị sẵn cổng cáp 12VHPWR (PCIe 5.0)
                </label>
              </div>
            </div>
          )
        })()}

      {/* 7. Case */}
      {componentType === ComponentType.Case &&
        (() => {
          const d = specDraft as CaseSpecDraft
          const patch = (partial: Partial<CaseSpecDraft>) =>
            onChange({ ...d, ...partial })

          return (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Chuẩn Mainboard hỗ trợ <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {MB_FORM_FACTOR_OPTIONS.map((opt) => {
                    const checked = d.supportedFormFactors.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          patch({
                            supportedFormFactors: toggleNumberInList(
                              d.supportedFormFactors,
                              opt.value
                            ),
                          })
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          checked
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        } disabled:opacity-50`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                {renderFieldError('spec.supportedFormFactors')}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Chiều dài GPU tối đa (mm) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={d.maxGpuLengthMm}
                    disabled={disabled}
                    onChange={(e) => patch({ maxGpuLengthMm: e.target.value })}
                    placeholder="Ví dụ: 360"
                    className={inputClass(Boolean(errors['spec.maxGpuLengthMm']))}
                  />
                  {renderFieldError('spec.maxGpuLengthMm')}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Chiều cao tản CPU tối đa (mm){' '}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={d.maxCpuCoolerHeightMm}
                    disabled={disabled}
                    onChange={(e) =>
                      patch({ maxCpuCoolerHeightMm: e.target.value })
                    }
                    placeholder="Ví dụ: 170"
                    className={inputClass(
                      Boolean(errors['spec.maxCpuCoolerHeightMm'])
                    )}
                  />
                  {renderFieldError('spec.maxCpuCoolerHeightMm')}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Chiều dài nguồn tối đa (mm){' '}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={d.maxPsuLengthMm}
                    disabled={disabled}
                    onChange={(e) => patch({ maxPsuLengthMm: e.target.value })}
                    placeholder="Ví dụ: 200"
                    className={inputClass(Boolean(errors['spec.maxPsuLengthMm']))}
                  />
                  {renderFieldError('spec.maxPsuLengthMm')}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Kích thước Radiator hỗ trợ (mm)
                  </label>
                  <input
                    type="text"
                    value={d.supportedRadiatorSizesMm}
                    disabled={disabled}
                    onChange={(e) =>
                      patch({ supportedRadiatorSizesMm: e.target.value })
                    }
                    placeholder="Ví dụ: 120, 240, 360"
                    className={inputClass(
                      Boolean(errors['spec.supportedRadiatorSizesMm'])
                    )}
                  />
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Nhập các cỡ cách nhau bởi dấu phẩy (để trống nếu không hỗ trợ).
                  </span>
                  {renderFieldError('spec.supportedRadiatorSizesMm')}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Số quạt đi kèm <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={d.includedFans}
                    disabled={disabled}
                    onChange={(e) => patch({ includedFans: e.target.value })}
                    placeholder="Ví dụ: 3"
                    className={inputClass(Boolean(errors['spec.includedFans']))}
                  />
                  {renderFieldError('spec.includedFans')}
                </div>
              </div>
            </div>
          )
        })()}

      {/* 8. Cooler */}
      {componentType === ComponentType.Cooler &&
        (() => {
          const d = specDraft as CoolerSpecDraft
          const patch = (partial: Partial<CoolerSpecDraft>) =>
            onChange({ ...d, ...partial })
          const numericCoolerType = Number(d.coolerType)
          const isAir = numericCoolerType === CoolerType.Air
          const isAio = isAioCoolerType(numericCoolerType)

          return (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Socket CPU hỗ trợ <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CPU_SOCKET_OPTIONS.map((opt) => {
                    const checked = d.supportedSockets.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          patch({
                            supportedSockets: toggleNumberInList(
                              d.supportedSockets,
                              opt.value
                            ),
                          })
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          checked
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        } disabled:opacity-50`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                {renderFieldError('spec.supportedSockets')}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Loại tản nhiệt <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={d.coolerType}
                    disabled={disabled}
                    onChange={(e) => patch({ coolerType: e.target.value })}
                    className={inputClass(Boolean(errors['spec.coolerType']))}
                  >
                    <option value="">-- Chọn loại tản nhiệt --</option>
                    {COOLER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {renderFieldError('spec.coolerType')}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Chiều cao tản (mm){' '}
                    {isAir && <span className="text-rose-600">*</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={d.heightMm}
                    disabled={disabled}
                    onChange={(e) => patch({ heightMm: e.target.value })}
                    placeholder={isAir ? 'Bắt buộc > 0 (VD: 158)' : '0'}
                    className={inputClass(Boolean(errors['spec.heightMm']))}
                  />
                  {renderFieldError('spec.heightMm')}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Kích thước Radiator (mm){' '}
                    {isAio && <span className="text-rose-600">*</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={d.radiatorSizeMm}
                    disabled={disabled}
                    onChange={(e) => patch({ radiatorSizeMm: e.target.value })}
                    placeholder={isAio ? 'Bắt buộc > 0 (VD: 360)' : '0'}
                    className={inputClass(Boolean(errors['spec.radiatorSizeMm']))}
                  />
                  {renderFieldError('spec.radiatorSizeMm')}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Max TDP hỗ trợ (W) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={d.maxTdpRating}
                    disabled={disabled}
                    onChange={(e) => patch({ maxTdpRating: e.target.value })}
                    placeholder="Ví dụ: 250"
                    className={inputClass(Boolean(errors['spec.maxTdpRating']))}
                  />
                  {renderFieldError('spec.maxTdpRating')}
                </div>
              </div>

              <div className="pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={d.hasRgb}
                    disabled={disabled}
                    onChange={(e) => patch({ hasRgb: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Có đèn LED RGB / ARGB
                </label>
              </div>
            </div>
          )
        })()}

      {/* 9. Accessory */}
      {componentType === ComponentType.Accessory &&
        (() => {
          const d = specDraft as AccessorySpecDraft
          return (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Chi tiết thông số phụ kiện <span className="text-rose-600">*</span>
                </label>
                <span className="font-mono text-[11px] text-slate-400">
                  {d.details.length}/2000
                </span>
              </div>
              <textarea
                rows={4}
                maxLength={2000}
                value={d.details}
                disabled={disabled}
                onChange={(e) => onChange({ details: e.target.value })}
                placeholder="Nhập thông số kỹ thuật chi tiết của phụ kiện (tối đa 2000 ký tự)..."
                className={inputClass(Boolean(errors['spec.details']))}
              />
              {renderFieldError('spec.details')}
            </div>
          )
        })()}
    </div>
  )
}
