import {
  ComponentType,
  ProductSortOption,
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
} from './productTypes'

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  [ComponentType.CPU]: 'Bộ vi xử lý (CPU)',
  [ComponentType.Motherboard]: 'Bo mạch chủ (Mainboard)',
  [ComponentType.GPU]: 'Card màn hình (GPU)',
  [ComponentType.RAM]: 'Bộ nhớ RAM',
  [ComponentType.Storage]: 'Ổ cứng SSD & HDD',
  [ComponentType.PSU]: 'Nguồn máy tính (PSU)',
  [ComponentType.Case]: 'Vỏ case máy tính',
  [ComponentType.Cooler]: 'Tản nhiệt (Cooler)',
  [ComponentType.Accessory]: 'Phụ kiện máy tính',
}

export const SORT_OPTION_LABELS: Record<ProductSortOption, string> = {
  [ProductSortOption.Newest]: 'Mới nhất',
  [ProductSortOption.PriceLowToHigh]: 'Giá tăng dần',
  [ProductSortOption.PriceHighToLow]: 'Giá giảm dần',
  [ProductSortOption.NameAToZ]: 'Tên từ A đến Z',
  [ProductSortOption.NameZToA]: 'Tên từ Z đến A',
}

export const CPU_SOCKET_LABELS: Record<CpuSocket, string> = {
  [CpuSocket.LGA1700]: 'LGA1700',
  [CpuSocket.LGA1851]: 'LGA1851',
  [CpuSocket.LGA1200]: 'LGA1200',
  [CpuSocket.AM4]: 'AM4',
  [CpuSocket.AM5]: 'AM5',
  [CpuSocket.TR4]: 'TR4',
  [CpuSocket.sTRX4]: 'sTRX4',
  [CpuSocket.Other]: 'Khác',
}

export const RAM_TYPE_LABELS: Record<RamType, string> = {
  [RamType.DDR4]: 'DDR4',
  [RamType.DDR5]: 'DDR5',
  [RamType.DDR3]: 'DDR3',
  [RamType.LPDDR5]: 'LPDDR5',
}

export const RAM_FORM_FACTOR_LABELS: Record<RamFormFactor, string> = {
  [RamFormFactor.DIMM]: 'DIMM',
  [RamFormFactor.SODIMM]: 'SO-DIMM',
}

export const MOTHERBOARD_FORM_FACTOR_LABELS: Record<MotherboardFormFactor, string> = {
  [MotherboardFormFactor.ATX]: 'ATX',
  [MotherboardFormFactor.MicroATX]: 'Micro-ATX',
  [MotherboardFormFactor.MiniITX]: 'Mini-ITX',
  [MotherboardFormFactor.EATX]: 'E-ATX',
}

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  [StorageType.NVMeM2]: 'NVMe M.2',
  [StorageType.SataSSD]: 'SATA SSD',
  [StorageType.Hdd35]: 'HDD 3.5"',
  [StorageType.Hdd25]: 'HDD 2.5"',
}

export const STORAGE_INTERFACE_LABELS: Record<StorageInterface, string> = {
  [StorageInterface.PCIe30]: 'PCIe 3.0',
  [StorageInterface.PCIe40]: 'PCIe 4.0',
  [StorageInterface.PCIe50]: 'PCIe 5.0',
  [StorageInterface.SATA3]: 'SATA 3',
}

export const PSU_EFFICIENCY_LABELS: Record<PsuEfficiency, string> = {
  [PsuEfficiency.Plus80]: '80 Plus',
  [PsuEfficiency.Plus80Bronze]: '80 Plus Bronze',
  [PsuEfficiency.Plus80Silver]: '80 Plus Silver',
  [PsuEfficiency.Plus80Gold]: '80 Plus Gold',
  [PsuEfficiency.Plus80Platinum]: '80 Plus Platinum',
  [PsuEfficiency.Plus80Titanium]: '80 Plus Titanium',
}

export const PSU_MODULARITY_LABELS: Record<PsuModularity, string> = {
  [PsuModularity.NonModular]: 'Non-Modular',
  [PsuModularity.SemiModular]: 'Semi-Modular',
  [PsuModularity.FullModular]: 'Full-Modular',
}

export const PSU_FORM_FACTOR_LABELS: Record<PsuFormFactor, string> = {
  [PsuFormFactor.ATX]: 'ATX',
  [PsuFormFactor.SFX]: 'SFX',
  [PsuFormFactor.SFXL]: 'SFX-L',
  [PsuFormFactor.TFX]: 'TFX',
}

export const COOLER_TYPE_LABELS: Record<CoolerType, string> = {
  [CoolerType.Air]: 'Air',
  [CoolerType.AIO120]: 'AIO 120 mm',
  [CoolerType.AIO240]: 'AIO 240 mm',
  [CoolerType.AIO280]: 'AIO 280 mm',
  [CoolerType.AIO360]: 'AIO 360 mm',
  [CoolerType.AIO420]: 'AIO 420 mm',
  [CoolerType.CustomLoop]: 'Custom Loop',
}

export function getEnumLabel<T extends number>(
  map: Record<T, string>,
  value: T | number,
  fallback = 'Không xác định'
): string {
  return (map as Record<number, string>)[value] ?? fallback
}

export const DEFAULT_PAGE_INDEX = 1
export const DEFAULT_PAGE_SIZE = 12
export const DEFAULT_SORT_BY = ProductSortOption.Newest

export const formatVnd = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}
