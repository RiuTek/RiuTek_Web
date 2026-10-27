import React from 'react'
import {
  ComponentType,
  CpuSocket,
  RamType,
  RamFormFactor,
  MotherboardFormFactor,
  StorageType,
  StorageInterface,
  PsuEfficiency,
  PsuModularity,
  PsuFormFactor,
  CoolerType,
} from '../../products/productTypes'
import {
  CPU_SOCKET_LABELS,
  RAM_TYPE_LABELS,
  RAM_FORM_FACTOR_LABELS,
  MOTHERBOARD_FORM_FACTOR_LABELS,
  STORAGE_TYPE_LABELS,
  STORAGE_INTERFACE_LABELS,
  PSU_EFFICIENCY_LABELS,
  PSU_MODULARITY_LABELS,
  PSU_FORM_FACTOR_LABELS,
  COOLER_TYPE_LABELS,
} from '../../products/productConstants'
import type { PCBuilderTechnicalFilterState } from '../pcBuilderTypes'

interface PCBuilderTechnicalFiltersProps {
  activeSlot: ComponentType
  technicalFilters: PCBuilderTechnicalFilterState
  onChange: <K extends keyof PCBuilderTechnicalFilterState>(
    key: K,
    value: PCBuilderTechnicalFilterState[K]
  ) => void
}

interface EnumSelectProps<T extends number> {
  id: string
  label: string
  value: T | undefined
  labelsMap: Record<T, string>
  onChange: (value: T | undefined) => void
}

function EnumSelect<T extends number>({
  id,
  label,
  value,
  labelsMap,
  onChange,
}: EnumSelectProps<T>): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold text-slate-700 block">
        {label}
      </label>
      <select
        id={id}
        value={value !== undefined ? String(value) : ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val === '' ? undefined : (Number(val) as T))
        }}
        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
      >
        <option value="">Tất cả</option>
        {Object.entries(labelsMap).map(([k, name]) => (
          <option key={k} value={k}>
            {name as string}
          </option>
        ))}
      </select>
    </div>
  )
}

interface TriStateBooleanSelectProps {
  id: string
  label: string
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
}

function TriStateBooleanSelect({
  id,
  label,
  value,
  onChange,
}: TriStateBooleanSelectProps): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold text-slate-700 block">
        {label}
      </label>
      <select
        id={id}
        value={value === true ? 'true' : value === false ? 'false' : ''}
        onChange={(e) => {
          const val = e.target.value
          if (val === 'true') {
            onChange(true)
          } else if (val === 'false') {
            onChange(false)
          } else {
            onChange(undefined)
          }
        }}
        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
      >
        <option value="">Tất cả</option>
        <option value="true">Có</option>
        <option value="false">Không</option>
      </select>
    </div>
  )
}

export const PCBuilderTechnicalFilters: React.FC<PCBuilderTechnicalFiltersProps> = ({
  activeSlot,
  technicalFilters,
  onChange,
}) => {
  // Accessory không có bộ lọc kỹ thuật
  if (activeSlot === ComponentType.Accessory) {
    return null
  }

  return (
    <div className="pt-4 border-t border-slate-200 space-y-4">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        Thông số kỹ thuật
      </div>

      {activeSlot === ComponentType.CPU && (
        <div className="space-y-3">
          <EnumSelect<CpuSocket>
            id="filter-cpu-socket"
            label="Socket CPU"
            value={technicalFilters.socket}
            labelsMap={CPU_SOCKET_LABELS}
            onChange={(val) => onChange('socket', val)}
          />
          <EnumSelect<RamType>
            id="filter-cpu-ram-type"
            label="Loại RAM hỗ trợ"
            value={technicalFilters.memoryType}
            labelsMap={RAM_TYPE_LABELS}
            onChange={(val) => onChange('memoryType', val)}
          />
          <TriStateBooleanSelect
            id="filter-cpu-igpu"
            label="GPU tích hợp"
            value={technicalFilters.hasIntegratedGpu}
            onChange={(val) => onChange('hasIntegratedGpu', val)}
          />
        </div>
      )}

      {activeSlot === ComponentType.Motherboard && (
        <div className="space-y-3">
          <EnumSelect<CpuSocket>
            id="filter-mb-socket"
            label="Socket CPU"
            value={technicalFilters.socket}
            labelsMap={CPU_SOCKET_LABELS}
            onChange={(val) => onChange('socket', val)}
          />
          <EnumSelect<RamType>
            id="filter-mb-ram-type"
            label="Loại RAM"
            value={technicalFilters.memoryType}
            labelsMap={RAM_TYPE_LABELS}
            onChange={(val) => onChange('memoryType', val)}
          />
          <EnumSelect<MotherboardFormFactor>
            id="filter-mb-form-factor"
            label="Kích thước Mainboard"
            value={technicalFilters.motherboardFormFactor}
            labelsMap={MOTHERBOARD_FORM_FACTOR_LABELS}
            onChange={(val) => onChange('motherboardFormFactor', val)}
          />
          <TriStateBooleanSelect
            id="filter-mb-wifi"
            label="Wi‑Fi tích hợp"
            value={technicalFilters.hasWifi}
            onChange={(val) => onChange('hasWifi', val)}
          />
        </div>
      )}

      {activeSlot === ComponentType.GPU && (
        <div className="space-y-3">
          <TriStateBooleanSelect
            id="filter-gpu-12vhpwr"
            label="Yêu cầu 12VHPWR"
            value={technicalFilters.requires12VHPWR}
            onChange={(val) => onChange('requires12VHPWR', val)}
          />
        </div>
      )}

      {activeSlot === ComponentType.RAM && (
        <div className="space-y-3">
          <EnumSelect<RamType>
            id="filter-ram-type"
            label="Loại RAM"
            value={technicalFilters.memoryType}
            labelsMap={RAM_TYPE_LABELS}
            onChange={(val) => onChange('memoryType', val)}
          />
          <EnumSelect<RamFormFactor>
            id="filter-ram-form-factor"
            label="Form Factor RAM"
            value={technicalFilters.ramFormFactor}
            labelsMap={RAM_FORM_FACTOR_LABELS}
            onChange={(val) => onChange('ramFormFactor', val)}
          />
          <TriStateBooleanSelect
            id="filter-ram-rgb"
            label="Đèn RGB"
            value={technicalFilters.hasRgb}
            onChange={(val) => onChange('hasRgb', val)}
          />
        </div>
      )}

      {activeSlot === ComponentType.Storage && (
        <div className="space-y-3">
          <EnumSelect<StorageType>
            id="filter-storage-type"
            label="Loại ổ lưu trữ"
            value={technicalFilters.storageType}
            labelsMap={STORAGE_TYPE_LABELS}
            onChange={(val) => onChange('storageType', val)}
          />
          <EnumSelect<StorageInterface>
            id="filter-storage-interface"
            label="Chuẩn giao tiếp"
            value={technicalFilters.storageInterface}
            labelsMap={STORAGE_INTERFACE_LABELS}
            onChange={(val) => onChange('storageInterface', val)}
          />
        </div>
      )}

      {activeSlot === ComponentType.PSU && (
        <div className="space-y-3">
          <EnumSelect<PsuEfficiency>
            id="filter-psu-efficiency"
            label="Chuẩn hiệu suất"
            value={technicalFilters.psuEfficiency}
            labelsMap={PSU_EFFICIENCY_LABELS}
            onChange={(val) => onChange('psuEfficiency', val)}
          />
          <EnumSelect<PsuModularity>
            id="filter-psu-modularity"
            label="Modularity nguồn"
            value={technicalFilters.psuModularity}
            labelsMap={PSU_MODULARITY_LABELS}
            onChange={(val) => onChange('psuModularity', val)}
          />
          <EnumSelect<PsuFormFactor>
            id="filter-psu-form-factor"
            label="Kích thước nguồn (PSU)"
            value={technicalFilters.psuFormFactor}
            labelsMap={PSU_FORM_FACTOR_LABELS}
            onChange={(val) => onChange('psuFormFactor', val)}
          />
          <TriStateBooleanSelect
            id="filter-psu-12vhpwr"
            label="Đầu nguồn 12VHPWR"
            value={technicalFilters.has12VHPWR}
            onChange={(val) => onChange('has12VHPWR', val)}
          />
        </div>
      )}

      {activeSlot === ComponentType.Case && (
        <div className="space-y-3">
          <EnumSelect<MotherboardFormFactor>
            id="filter-case-mb-support"
            label="Mainboard hỗ trợ"
            value={technicalFilters.motherboardFormFactor}
            labelsMap={MOTHERBOARD_FORM_FACTOR_LABELS}
            onChange={(val) => onChange('motherboardFormFactor', val)}
          />
        </div>
      )}

      {activeSlot === ComponentType.Cooler && (
        <div className="space-y-3">
          <EnumSelect<CpuSocket>
            id="filter-cooler-socket"
            label="Socket hỗ trợ"
            value={technicalFilters.socket}
            labelsMap={CPU_SOCKET_LABELS}
            onChange={(val) => onChange('socket', val)}
          />
          <EnumSelect<CoolerType>
            id="filter-cooler-type"
            label="Loại tản nhiệt"
            value={technicalFilters.coolerType}
            labelsMap={COOLER_TYPE_LABELS}
            onChange={(val) => onChange('coolerType', val)}
          />
          <TriStateBooleanSelect
            id="filter-cooler-rgb"
            label="Đèn RGB"
            value={technicalFilters.hasRgb}
            onChange={(val) => onChange('hasRgb', val)}
          />
        </div>
      )}
    </div>
  )
}
