import React from 'react'
import type { ComponentSpecification } from '../productTypes'
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
  getEnumLabel,
} from '../productConstants'

interface ProductSpecificationTableProps {
  specifications: ComponentSpecification | undefined | null
}

interface SpecItem {
  label: string
  value: React.ReactNode
}

function getSpecRows(specs: ComponentSpecification): SpecItem[] {
  switch (specs.$type) {
    case 'cpu':
      return [
        { label: 'Socket', value: getEnumLabel(CPU_SOCKET_LABELS, specs.socket) },
        { label: 'Số nhân xử lý', value: `${specs.coreCount} nhân` },
        { label: 'Số luồng xử lý', value: `${specs.threadCount} luồng` },
        { label: 'Xung nhịp cơ bản', value: `${specs.baseClockGhz} GHz` },
        { label: 'Xung nhịp tối đa', value: `${specs.boostClockGhz} GHz` },
        { label: 'Công suất tiêu thụ (TDP)', value: `${specs.tdpWattage} W` },
        {
          label: 'Đồ họa tích hợp (iGPU)',
          value: specs.hasIntegratedGpu ? 'Có' : 'Không',
        },
        {
          label: 'Loại RAM hỗ trợ',
          value: getEnumLabel(RAM_TYPE_LABELS, specs.supportedMemoryType),
        },
        {
          label: 'Tốc độ RAM tối đa',
          value: `${specs.maxMemorySpeedMhz} MHz`,
        },
      ]

    case 'motherboard':
      return [
        { label: 'Socket CPU', value: getEnumLabel(CPU_SOCKET_LABELS, specs.socket) },
        { label: 'Chipset', value: specs.chipset },
        {
          label: 'Kích thước chuẩn (Form Factor)',
          value: getEnumLabel(MOTHERBOARD_FORM_FACTOR_LABELS, specs.formFactor),
        },
        {
          label: 'Chuẩn RAM',
          value: getEnumLabel(RAM_TYPE_LABELS, specs.memoryType),
        },
        { label: 'Số khe cắm RAM', value: `${specs.memorySlots} khe` },
        {
          label: 'Dung lượng RAM tối đa',
          value: `${specs.maxMemoryCapacityGb} GB`,
        },
        { label: 'Số khe cắm M.2 NVMe', value: `${specs.m2Slots} khe` },
        { label: 'Số cổng SATA', value: `${specs.sataPorts} cổng` },
        { label: 'Số khe cắm PCIe', value: `${specs.pcieSlots} khe` },
        { label: 'Tích hợp Wi-Fi', value: specs.hasWifi ? 'Có' : 'Không' },
      ]

    case 'gpu':
      return [
        { label: 'Chip đồ họa (Chipset)', value: specs.chipset },
        { label: 'Dung lượng VRAM', value: `${specs.vramGb} GB` },
        { label: 'Chuẩn bộ nhớ VRAM', value: specs.vramType },
        { label: 'Chiều dài card', value: `${specs.lengthMm} mm` },
        { label: 'Độ dày khe cắm', value: `${specs.slotWidth} slot` },
        { label: 'Công suất tiêu thụ (TDP)', value: `${specs.tdpWattage} W` },
        {
          label: 'Nguồn đề xuất tối thiểu',
          value: `${specs.recommendedPsuWattage} W`,
        },
        {
          label: 'Yêu cầu cổng 12VHPWR',
          value: specs.requires12VHPWR ? 'Có' : 'Không',
        },
        {
          label: 'Cổng cấp nguồn phụ',
          value: specs.powerConnectors || 'Không yêu cầu',
        },
      ]

    case 'ram':
      return [
        {
          label: 'Chuẩn bộ nhớ',
          value: getEnumLabel(RAM_TYPE_LABELS, specs.memoryType),
        },
        {
          label: 'Kích thước chuẩn',
          value: getEnumLabel(RAM_FORM_FACTOR_LABELS, specs.formFactor),
        },
        { label: 'Tổng dung lượng', value: `${specs.capacityGb} GB` },
        { label: 'Số thanh trong kit', value: `${specs.moduleCount} thanh` },
        { label: 'Tốc độ Bus RAM', value: `${specs.speedMhz} MHz` },
        { label: 'Độ trễ CAS (CL)', value: `CL${specs.casLatency}` },
        { label: 'Đèn LED RGB', value: specs.hasRgb ? 'Có' : 'Không' },
      ]

    case 'storage': {
      const displayCap =
        specs.capacityGb >= 1000 && specs.capacityGb % 1000 === 0
          ? `${specs.capacityGb / 1000} TB`
          : `${specs.capacityGb} GB`
      return [
        {
          label: 'Loại ổ cứng',
          value: getEnumLabel(STORAGE_TYPE_LABELS, specs.storageType),
        },
        {
          label: 'Chuẩn giao tiếp',
          value: getEnumLabel(STORAGE_INTERFACE_LABELS, specs.interface),
        },
        { label: 'Dung lượng lưu trữ', value: displayCap },
        {
          label: 'Tốc độ đọc tuần tự',
          value: `${specs.readSpeedMBs} MB/s`,
        },
        {
          label: 'Tốc độ ghi tuần tự',
          value: `${specs.writeSpeedMBs} MB/s`,
        },
        { label: 'Kích thước chuẩn', value: specs.formFactor },
      ]
    }

    case 'psu':
      return [
        { label: 'Công suất định mức', value: `${specs.wattage} W` },
        {
          label: 'Chứng nhận hiệu suất',
          value: getEnumLabel(PSU_EFFICIENCY_LABELS, specs.efficiency),
        },
        {
          label: 'Kiểu cáp nguồn (Modularity)',
          value: getEnumLabel(PSU_MODULARITY_LABELS, specs.modularity),
        },
        {
          label: 'Kích thước chuẩn',
          value: getEnumLabel(PSU_FORM_FACTOR_LABELS, specs.formFactor),
        },
        {
          label: 'Hỗ trợ cáp 12VHPWR',
          value: specs.has12VHPWR ? 'Có' : 'Không',
        },
        { label: 'Chiều dài bộ nguồn', value: `${specs.lengthMm} mm` },
      ]

    case 'case': {
      const formFactors =
        Array.isArray(specs.supportedFormFactors) &&
        specs.supportedFormFactors.length > 0
          ? specs.supportedFormFactors
              .map((ff) => getEnumLabel(MOTHERBOARD_FORM_FACTOR_LABELS, ff))
              .join(', ')
          : 'Không xác định'

      const radiators =
        Array.isArray(specs.supportedRadiatorSizesMm) &&
        specs.supportedRadiatorSizesMm.length > 0
          ? specs.supportedRadiatorSizesMm.map((s) => `${s} mm`).join(', ')
          : 'Không hỗ trợ'

      return [
        { label: 'Mainboard hỗ trợ', value: formFactors },
        { label: 'Chiều dài GPU tối đa', value: `${specs.maxGpuLengthMm} mm` },
        {
          label: 'Chiều cao tản CPU tối đa',
          value: `${specs.maxCpuCoolerHeightMm} mm`,
        },
        { label: 'Chiều dài nguồn tối đa', value: `${specs.maxPsuLengthMm} mm` },
        { label: 'Kích thước tản nước hỗ trợ', value: radiators },
        { label: 'Quạt lắp sẵn', value: `${specs.includedFans} quạt` },
      ]
    }

    case 'cooler': {
      const sockets =
        Array.isArray(specs.supportedSockets) && specs.supportedSockets.length > 0
          ? specs.supportedSockets
              .map((s) => getEnumLabel(CPU_SOCKET_LABELS, s))
              .join(', ')
          : 'Không xác định'

      return [
        {
          label: 'Loại tản nhiệt',
          value: getEnumLabel(COOLER_TYPE_LABELS, specs.coolerType),
        },
        { label: 'Socket CPU hỗ trợ', value: sockets },
        { label: 'Chiều cao tản nhiệt', value: `${specs.heightMm} mm` },
        {
          label: 'Kích thước két tản nhiệt (Radiator)',
          value: specs.radiatorSizeMm > 0 ? `${specs.radiatorSizeMm} mm` : 'Không có',
        },
        {
          label: 'Công suất tản nhiệt tối đa (TDP)',
          value: `${specs.maxTdpRating} W`,
        },
        { label: 'Đèn LED RGB', value: specs.hasRgb ? 'Có' : 'Không' },
      ]
    }

    case 'accessory':
      return [
        {
          label: 'Chi tiết phụ kiện',
          value: specs.details || 'Không có mô tả chi tiết',
        },
      ]

    default:
      return []
  }
}

export const ProductSpecificationTable: React.FC<ProductSpecificationTableProps> = ({
  specifications,
}) => {
  if (!specifications || !specifications.$type) {
    return (
      <section
        aria-labelledby="specifications-heading"
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-6"
      >
        <h2 id="specifications-heading" className="text-lg font-bold text-slate-900 tracking-tight mb-2">
          Thông Số Kỹ Thuật
        </h2>
        <p className="text-xs text-slate-500">
          Thông số kỹ thuật chưa được phân loại hoặc không xác định.
        </p>
      </section>
    )
  }

  const rows = getSpecRows(specifications)

  if (rows.length === 0) {
    return (
      <section
        aria-labelledby="specifications-heading"
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-6"
      >
        <h2 id="specifications-heading" className="text-lg font-bold text-slate-900 tracking-tight mb-2">
          Thông Số Kỹ Thuật
        </h2>
        <p className="text-xs text-slate-500">
          Thông số kỹ thuật chưa được cập nhật cho sản phẩm này.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="specifications-heading"
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
    >
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
        <h2
          id="specifications-heading"
          className="text-lg font-bold text-slate-900 tracking-tight"
        >
          Thông Số Kỹ Thuật Chi Tiết
        </h2>
      </div>

      <dl className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 sm:grid-cols-3 px-6 py-3.5 text-xs hover:bg-slate-50/50 transition-colors"
          >
            <dt className="text-slate-500 font-medium">{row.label}</dt>
            <dd className="sm:col-span-2 text-slate-900 font-semibold mt-1 sm:mt-0 break-words">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
