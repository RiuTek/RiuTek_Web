import markSrc from '../../assets/branding/riutek-mark-v2.png'
import { COMPONENT_TYPE_LABELS, formatVnd } from '../products/productConstants'
import { evaluateCompatibility } from './pcBuildCompatibilityHelper'
import type { PCBuildExportItem, PCBuildExportSnapshot } from './pcBuildExportTypes'

const CANVAS_WIDTH = 1200
const MAX_CANVAS_HEIGHT = 12000
const PADDING_X = 50

interface LayoutItemRow {
  item: PCBuildExportItem
  groupLabel: string
  nameLines: string[]
  skuLine: string
  height: number
}

interface LayoutPlan {
  totalHeight: number
  headerHeight: number
  tableTop: number
  tableHeaderHeight: number
  rowLayouts: LayoutItemRow[]
  tableTotalHeight: number
  summaryTop: number
  summaryHeight: number
  specsTop: number
  specsHeight: number
  compatibilityTop: number
  compatibilityHeight: number
  compatibilityLines: { severity: string; textLines: string[] }[]
  missingComponentsLines: string[]
  footerTop: number
  footerHeight: number
  footerDisclaimerLines: string[]
}

/**
 * Tách chuỗi thành nhiều dòng vừa với chiều rộng maxWidth
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return []
  const paragraphs = text.split('\n')
  const lines: string[] = []

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('')
      continue
    }

    const words = para.split(' ')
    let currentLine = ''

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = ctx.measureText(testLine).width

      if (testWidth <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) {
          lines.push(currentLine)
        }
        // Trường hợp 1 từ dài liên tục (như mã SKU hoặc chuỗi không dấu cách)
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = ''
          for (const char of word) {
            if (ctx.measureText(chunk + char).width <= maxWidth) {
              chunk += char
            } else {
              if (chunk) lines.push(chunk)
              chunk = char
            }
          }
          currentLine = chunk
        } else {
          currentLine = word
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines
}

/**
 * Tải logo mark cùng origin từ bundle Vite với fallback an toàn
 */
function loadLogoImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src

    setTimeout(() => {
      if (!img.complete) {
        resolve(null)
      }
    }, 2500)
  })
}

function formatExportDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

/**
 * Tính toán toàn bộ kích thước, ngắt dòng và vị trí trước khi vẽ Canvas
 */
function computeLayout(
  ctx: CanvasRenderingContext2D,
  snapshot: PCBuildExportSnapshot
): LayoutPlan {
  const contentWidth = CANVAS_WIDTH - PADDING_X * 2 // 1100px
  let currentY = 0

  // 1. Accent bar đỉnh ảnh
  currentY += 8

  // 2. Header
  const headerTop = currentY
  currentY += 40 // padding top
  // Dòng logo + site domain
  currentY += 45
  // Khoảng cách
  currentY += 15
  // Tiêu đề cấu hình
  ctx.font = 'bold 26px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  const titleLines = wrapText(ctx, snapshot.buildName || 'Cấu hình PC', contentWidth - 300)
  currentY += Math.max(titleLines.length * 34, 34)
  // Thời điểm xuất & ngày lưu
  currentY += 30
  if (snapshot.savedDateStr) {
    currentY += 22
  }
  currentY += 25 // Header bottom padding
  const headerHeight = currentY - headerTop

  // 3. Bảng linh kiện
  const tableTop = currentY
  const tableHeaderHeight = 44
  currentY += tableHeaderHeight

  // Đo các dòng linh kiện
  const nameColWidth = 500
  const rowLayouts: LayoutItemRow[] = []

  ctx.font = 'bold 14px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  for (const item of snapshot.items) {
    const groupLabel = COMPONENT_TYPE_LABELS[item.componentType] || 'Linh kiện'
    ctx.font = 'bold 14px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    const nameLines = wrapText(ctx, item.name, nameColWidth)
    const skuLine = `SKU: ${item.sku}`

    // Tính chiều cao dòng: padding top 12 + nameLines*20 + skuLine 18 + padding bottom 12
    const contentHeight = Math.max(nameLines.length * 20 + 22, 44)
    const rowHeight = contentHeight + 20

    rowLayouts.push({
      item,
      groupLabel,
      nameLines,
      skuLine,
      height: rowHeight,
    })
    currentY += rowHeight
  }

  const tableTotalHeight = currentY - tableTop
  currentY += 30 // Khoảng cách sau bảng

  // 4. Khối Tổng tiền
  const summaryTop = currentY
  const summaryHeight = 90
  currentY += summaryHeight + 25

  // 5. Khối Thông số điện năng (nếu có thông tin)
  const hasWattage =
    typeof snapshot.estimatedWattage === 'number' && snapshot.estimatedWattage > 0
  const hasPsu =
    typeof snapshot.recommendedPsuWattage === 'number' &&
    snapshot.recommendedPsuWattage > 0

  const specsTop = currentY
  let specsHeight = 0
  if (hasWattage || hasPsu) {
    specsHeight = 54
    currentY += specsHeight + 20
  }

  // 6. Khối Đánh giá tương thích
  const compatibilityTop = currentY
  const assessment = evaluateCompatibility({
    isCompatible: snapshot.isCompatible,
    issues: snapshot.issues,
  })

  const compBoxInnerWidth = contentWidth - 40
  const compatibilityLines: { severity: string; textLines: string[] }[] = []

  ctx.font = '13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'

  // Phân loại các cảnh báo
  for (const issue of assessment.classifiedIssues.errors) {
    const msg = `[Lỗi] ${issue.message}`
    compatibilityLines.push({
      severity: 'error',
      textLines: wrapText(ctx, msg, compBoxInnerWidth),
    })
  }
  for (const issue of assessment.classifiedIssues.warnings) {
    const msg = `[Lưu ý] ${issue.message}`
    compatibilityLines.push({
      severity: 'warning',
      textLines: wrapText(ctx, msg, compBoxInnerWidth),
    })
  }
  for (const issue of assessment.classifiedIssues.others) {
    const msg = `[Thông tin] ${issue.message}`
    compatibilityLines.push({
      severity: 'info',
      textLines: wrapText(ctx, msg, compBoxInnerWidth),
    })
  }

  if (assessment.isGenericErrorNotice) {
    const genericMsg =
      '[Lỗi] Hệ thống phát hiện một số linh kiện có xung đột hoặc thông số chưa phù hợp với nhau.'
    compatibilityLines.push({
      severity: 'error',
      textLines: wrapText(ctx, genericMsg, compBoxInnerWidth),
    })
  }

  // Linh kiện còn thiếu
  let missingComponentsLines: string[] = []
  if (snapshot.missingComponents && snapshot.missingComponents.length > 0) {
    const missingText = `Linh kiện cơ bản còn thiếu: ${snapshot.missingComponents.join(', ')}`
    missingComponentsLines = wrapText(ctx, missingText, compBoxInnerWidth)
  }

  let totalIssueLineCount = 0
  for (const compLine of compatibilityLines) {
    totalIssueLineCount += compLine.textLines.length
  }
  totalIssueLineCount += missingComponentsLines.length

  let compContentHeight = 40 // Tiêu đề trạng thái
  if (totalIssueLineCount > 0) {
    compContentHeight += 12 + totalIssueLineCount * 22
  } else {
    compContentHeight += 24 // Dòng hướng dẫn / thông báo an toàn
  }
  const compatibilityHeight = compContentHeight + 30 // padding
  currentY += compatibilityHeight + 30

  // 7. Footer & Lưu ý pháp lý / hướng dẫn
  const footerTop = currentY
  const disclaimers = [
    '• Lưu ý: Giá và tình trạng tồn kho có thể thay đổi tùy thời điểm. Giá thanh toán chính thức được xác nhận khi đặt hàng trên hệ thống.',
    snapshot.sourceType === 'saved'
      ? '• Cấu hình này trích xuất từ dữ liệu đã lưu tại thời điểm hiển thị. Đây không phải là hóa đơn, chứng từ hoặc cam kết giữ chỗ tồn kho.'
      : '• Tổng tiền tạm tính từ máy chủ cho cấu hình đang dựng và chưa bao gồm các khuyến mãi thanh toán riêng nếu có.',
    '• Kết quả đánh giá tương thích chỉ mang tính chất tham khảo kỹ thuật dựa trên thông số do nhà sản xuất công bố.',
  ]

  ctx.font = '12px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  const footerDisclaimerLines: string[] = []
  for (const disc of disclaimers) {
    const lines = wrapText(ctx, disc, contentWidth)
    footerDisclaimerLines.push(...lines)
  }

  const footerHeight = footerDisclaimerLines.length * 20 + 70
  currentY += footerHeight + 40 // Lề dưới

  return {
    totalHeight: Math.ceil(currentY),
    headerHeight,
    tableTop,
    tableHeaderHeight,
    rowLayouts,
    tableTotalHeight,
    summaryTop,
    summaryHeight,
    specsTop,
    specsHeight,
    compatibilityTop,
    compatibilityHeight,
    compatibilityLines,
    missingComponentsLines,
    footerTop,
    footerHeight,
    footerDisclaimerLines,
  }
}

/**
 * Vẽ toàn bộ nội dung lên Canvas 2D
 */
async function drawToCanvas(
  canvas: HTMLCanvasElement,
  snapshot: PCBuildExportSnapshot,
  layout: LayoutPlan,
  signal?: AbortSignal
): Promise<void> {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) {
    throw new Error('Không thể khởi tạo Canvas 2D context.')
  }

  if (signal?.aborted) {
    throw new DOMException('Thao tác xuất ảnh đã bị hủy.', 'AbortError')
  }

  // 1. Nền trắng toàn bộ
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 2. Accent stripe trên cùng (Màu đỏ RiuTek #DC2626)
  ctx.fillStyle = '#DC2626'
  ctx.fillRect(0, 0, canvas.width, 8)

  const contentWidth = CANVAS_WIDTH - PADDING_X * 2 // 1100px

  // 3. Vẽ Header
  const logoImg = await loadLogoImage(markSrc)
  if (signal?.aborted) {
    throw new DOMException('Thao tác xuất ảnh đã bị hủy.', 'AbortError')
  }

  const headerY = 28
  if (logoImg) {
    ctx.drawImage(logoImg, PADDING_X, headerY, 40, 40)
    // Chữ RiuTek bên cạnh logo
    ctx.font = 'bold 30px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#0F172A'
    ctx.fillText('Riu', PADDING_X + 48, headerY + 20)
    const riuWidth = ctx.measureText('Riu').width
    ctx.fillStyle = '#DC2626'
    ctx.fillText('Tek', PADDING_X + 48 + riuWidth, headerY + 20)
  } else {
    // Fallback nếu logo không load được
    ctx.font = 'bold 32px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#0F172A'
    ctx.fillText('Riu', PADDING_X, headerY + 20)
    const riuWidth = ctx.measureText('Riu').width
    ctx.fillStyle = '#DC2626'
    ctx.fillText('Tek', PADDING_X + riuWidth, headerY + 20)
  }

  // Domain riutek.store góc phải
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = '600 15px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#64748B'
  ctx.fillText('riutek.store', CANVAS_WIDTH - PADDING_X, headerY + 12)
  ctx.font = '500 12px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#94A3B8'
  ctx.fillText('Hệ Thống Xây Dựng Cấu Hình PC', CANVAS_WIDTH - PADDING_X, headerY + 30)

  // Tiêu đề cấu hình
  const titleY = headerY + 60
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = 'bold 26px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#0F172A'
  const titleLines = wrapText(ctx, snapshot.buildName || 'Cấu hình PC', contentWidth - 300)
  let currTitleY = titleY
  for (const line of titleLines) {
    ctx.fillText(line, PADDING_X, currTitleY)
    currTitleY += 34
  }

  // Thông tin ngày giờ
  ctx.font = '500 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#64748B'
  const exportTimeStr = `Thời điểm xuất: ${formatExportDate(snapshot.exportedAt)}`
  ctx.fillText(exportTimeStr, PADDING_X, currTitleY + 4)

  if (snapshot.savedDateStr) {
    ctx.font = '600 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#0284C7' // Xanh cyan/blue cho ngày lưu
    ctx.fillText(`Thời điểm lưu cấu hình: ${snapshot.savedDateStr}`, PADDING_X, currTitleY + 26)
  }

  // Đường kẻ ngang dưới header
  const dividerY = layout.tableTop - 15
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING_X, dividerY)
  ctx.lineTo(CANVAS_WIDTH - PADDING_X, dividerY)
  ctx.stroke()

  // 4. Bảng linh kiện
  const tableY = layout.tableTop
  // Nền thanh tiêu đề bảng
  ctx.fillStyle = '#F8FAFC'
  ctx.fillRect(PADDING_X, tableY, contentWidth, layout.tableHeaderHeight)
  ctx.strokeStyle = '#E2E8F0'
  ctx.strokeRect(PADDING_X, tableY, contentWidth, layout.tableHeaderHeight)

  // Cột:
  // Col 0: Nhóm [50, 240] (190)
  // Col 1: Tên & SKU [250, 750] (500)
  // Col 2: SL [760, 830] (70)
  // Col 3: Đơn giá [840, 960] (120)
  // Col 4: Thành tiền [970, 1150] (180)
  ctx.font = 'bold 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#475569'
  ctx.textBaseline = 'middle'

  const thMiddleY = tableY + layout.tableHeaderHeight / 2
  ctx.textAlign = 'left'
  ctx.fillText('NHÓM LINH KIỆN', PADDING_X + 15, thMiddleY)
  ctx.fillText('TÊN SẢN PHẨM & SKU', PADDING_X + 200, thMiddleY)
  ctx.textAlign = 'center'
  ctx.fillText('SL', PADDING_X + 740, thMiddleY)
  ctx.textAlign = 'right'
  ctx.fillText('ĐƠN GIÁ', PADDING_X + 900, thMiddleY)
  ctx.fillText('THÀNH TIỀN', CANVAS_WIDTH - PADDING_X - 15, thMiddleY)

  // Vẽ các dòng linh kiện
  let rowY = tableY + layout.tableHeaderHeight
  for (let idx = 0; idx < layout.rowLayouts.length; idx++) {
    const row = layout.rowLayouts[idx]

    // Nền xen kẽ nhẹ
    if (idx % 2 === 1) {
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(PADDING_X, rowY, contentWidth, row.height)
    }

    // Đường phân cách dưới dòng
    ctx.strokeStyle = '#F1F5F9'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PADDING_X, rowY + row.height)
    ctx.lineTo(CANVAS_WIDTH - PADDING_X, rowY + row.height)
    ctx.stroke()

    // 1. Nhóm linh kiện
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = 'bold 12px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#DC2626'
    ctx.fillText(row.groupLabel, PADDING_X + 15, rowY + 12)

    // 2. Tên & SKU
    ctx.font = 'bold 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#0F172A'
    let nameLineY = rowY + 12
    for (const line of row.nameLines) {
      ctx.fillText(line, PADDING_X + 200, nameLineY)
      nameLineY += 20
    }
    ctx.font = '500 11px monospace'
    ctx.fillStyle = '#64748B'
    ctx.fillText(row.skuLine, PADDING_X + 200, nameLineY + 2)

    // 3. Số lượng
    ctx.textAlign = 'center'
    ctx.font = 'bold 14px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#0F172A'
    ctx.fillText(String(row.item.quantity), PADDING_X + 740, rowY + 14)

    // 4. Đơn giá
    ctx.textAlign = 'right'
    ctx.font = '500 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#334155'
    ctx.fillText(formatVnd(row.item.unitPrice), PADDING_X + 900, rowY + 14)

    // 5. Thành tiền
    ctx.textAlign = 'right'
    ctx.font = 'bold 14px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#0F172A'
    ctx.fillText(formatVnd(row.item.lineTotal), CANVAS_WIDTH - PADDING_X - 15, rowY + 14)

    rowY += row.height
  }

  // Viền bao quanh toàn bảng
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1
  ctx.strokeRect(PADDING_X, tableY, contentWidth, layout.tableTotalHeight)

  // 5. Khối Tổng Tiền
  const sumY = layout.summaryTop
  ctx.fillStyle = '#F8FAFC'
  ctx.fillRect(PADDING_X, sumY, contentWidth, layout.summaryHeight)
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1
  ctx.strokeRect(PADDING_X, sumY, contentWidth, layout.summaryHeight)

  // Accent bên trái card tổng tiền
  ctx.fillStyle = '#DC2626'
  ctx.fillRect(PADDING_X, sumY, 5, layout.summaryHeight)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = 'bold 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText(snapshot.priceLabel, PADDING_X + 25, sumY + 18)

  ctx.font = '500 12px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#94A3B8'
  ctx.fillText('Số lượng: ' + snapshot.items.length + ' linh kiện', PADDING_X + 25, sumY + 44)

  ctx.textAlign = 'right'
  ctx.font = 'bold 30px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#DC2626'
  ctx.fillText(formatVnd(snapshot.totalPrice), CANVAS_WIDTH - PADDING_X - 25, sumY + 26)

  // 6. Khối Thông số điện năng (nếu có)
  if (layout.specsHeight > 0) {
    const spY = layout.specsTop
    ctx.fillStyle = '#FFFBEB' // Vàng nhạt
    ctx.fillRect(PADDING_X, spY, contentWidth, layout.specsHeight)
    ctx.strokeStyle = '#FDE68A'
    ctx.strokeRect(PADDING_X, spY, contentWidth, layout.specsHeight)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#B45309'
    ctx.fillText('⚡ ƯỚC TÍNH CÔNG SUẤT TIÊU THỤ', PADDING_X + 20, spY + layout.specsHeight / 2)

    ctx.textAlign = 'right'
    ctx.font = 'bold 14px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#92400E'
    let specsText = `${snapshot.estimatedWattage ?? 0} W`
    if (snapshot.recommendedPsuWattage && snapshot.recommendedPsuWattage > 0) {
      specsText += ` (Nguồn khuyến nghị: ≥ ${snapshot.recommendedPsuWattage} W)`
    }
    ctx.fillText(specsText, CANVAS_WIDTH - PADDING_X - 20, spY + layout.specsHeight / 2)
  }

  // 7. Khối Đánh giá tương thích
  const compY = layout.compatibilityTop
  const assessment = evaluateCompatibility({
    isCompatible: snapshot.isCompatible,
    issues: snapshot.issues,
  })

  let compBg = '#F0FDF4'
  let compBorder = '#BBF7D0'
  let compTitleColor = '#16A34A'
  let compIcon = '✓ '

  if (assessment.level === 'error') {
    compBg = '#FEF2F2'
    compBorder = '#FECACA'
    compTitleColor = '#DC2626'
    compIcon = '✕ '
  } else if (assessment.level === 'warning') {
    compBg = '#FFFBEB'
    compBorder = '#FDE68A'
    compTitleColor = '#D97706'
    compIcon = '⚠ '
  } else if (assessment.level === 'unverified') {
    compBg = '#F8FAFC'
    compBorder = '#E2E8F0'
    compTitleColor = '#64748B'
    compIcon = 'ℹ '
  }

  ctx.fillStyle = compBg
  ctx.fillRect(PADDING_X, compY, contentWidth, layout.compatibilityHeight)
  ctx.strokeStyle = compBorder
  ctx.strokeRect(PADDING_X, compY, contentWidth, layout.compatibilityHeight)

  // Tiêu đề tương thích
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = 'bold 14px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = compTitleColor
  ctx.fillText(
    `${compIcon}${assessment.title.toUpperCase()}`,
    PADDING_X + 20,
    compY + 16
  )

  let compTextY = compY + 44

  if (layout.compatibilityLines.length > 0 || layout.missingComponentsLines.length > 0) {
    ctx.font = '13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'

    for (const compLine of layout.compatibilityLines) {
      if (compLine.severity === 'error') {
        ctx.fillStyle = '#991B1B'
      } else if (compLine.severity === 'warning') {
        ctx.fillStyle = '#92400E'
      } else {
        ctx.fillStyle = '#334155'
      }

      for (const line of compLine.textLines) {
        ctx.fillText(line, PADDING_X + 20, compTextY)
        compTextY += 22
      }
    }

    if (layout.missingComponentsLines.length > 0) {
      ctx.fillStyle = '#475569'
      for (const line of layout.missingComponentsLines) {
        ctx.fillText(line, PADDING_X + 20, compTextY)
        compTextY += 22
      }
    }
  } else {
    // Thông báo an toàn
    ctx.font = '500 13px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
    ctx.fillStyle = '#166534'
    ctx.fillText(
      assessment.guidanceMessage || 'Chưa phát hiện xung đột giữa các linh kiện đã chọn.',
      PADDING_X + 20,
      compTextY
    )
  }

  // 8. Footer & Ghi chú pháp lý
  const footY = layout.footerTop
  ctx.strokeStyle = '#E2E8F0'
  ctx.beginPath()
  ctx.moveTo(PADDING_X, footY)
  ctx.lineTo(CANVAS_WIDTH - PADDING_X, footY)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = '500 12px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#64748B'

  let discY = footY + 16
  for (const line of layout.footerDisclaimerLines) {
    ctx.fillText(line, PADDING_X, discY)
    discY += 20
  }

  // Dòng bản quyền
  discY += 12
  ctx.font = '600 12px "Inter", "Segoe UI", Roboto, Arial, sans-serif'
  ctx.fillStyle = '#94A3B8'
  ctx.fillText(
    '© ' + new Date().getFullYear() + ' RiuTek. Nền tảng xây dựng cấu hình PC chuyên nghiệp • https://riutek.store',
    PADDING_X,
    discY
  )
}

/**
 * Xuất snapshot cấu hình PC thành Canvas
 */
export async function renderPCBuildToCanvas(
  snapshot: PCBuildExportSnapshot,
  signal?: AbortSignal
): Promise<HTMLCanvasElement> {
  // Pass 1: Đo lường kích thước
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = CANVAS_WIDTH
  measureCanvas.height = 100
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas 2D.')
  }

  const layout = computeLayout(measureCtx, snapshot)

  if (layout.totalHeight > MAX_CANVAS_HEIGHT) {
    throw new Error(
      `Cấu hình quá dài để kết xuất ảnh (chiều cao ${layout.totalHeight}px vượt quá giới hạn an toàn ${MAX_CANVAS_HEIGHT}px).`
    )
  }

  // Pass 2: Khởi tạo Canvas chính xác chiều cao và render
  const renderCanvas = document.createElement('canvas')
  renderCanvas.width = CANVAS_WIDTH
  renderCanvas.height = layout.totalHeight

  await drawToCanvas(renderCanvas, snapshot, layout, signal)

  return renderCanvas
}

/**
 * Chuyển đổi canvas thành Blob PNG chuẩn
 */
export async function exportPCBuildToPngBlob(
  snapshot: PCBuildExportSnapshot,
  signal?: AbortSignal
): Promise<Blob> {
  const canvas = await renderPCBuildToCanvas(snapshot, signal)

  if (signal?.aborted) {
    throw new DOMException('Thao tác xuất ảnh đã bị hủy.', 'AbortError')
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Không thể tạo file ảnh PNG từ Canvas.'))
        }
      },
      'image/png',
      1.0
    )
  })
}

/**
 * Tải file Blob về máy người dùng an toàn
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Giải phóng Object URL sau 30 giây để đảm bảo download hoàn tất trên mọi trình duyệt
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Bỏ qua lỗi dọn dẹp nếu đã được revoke
    }
  }, 30000)
}

/**
 * Tạo tên file sạch, an toàn cho hệ thống tệp
 */
export function generateExportFilename(
  buildName?: string | null,
  date: Date = new Date()
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  const timestamp = `${yyyy}${mm}${dd}-${hh}${min}`

  if (!buildName || !buildName.trim()) {
    return `riutek-cau-hinh-${timestamp}.png`
  }

  // Loại bỏ dấu tiếng Việt và ký tự đặc biệt
  const sanitized = buildName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  if (!sanitized) {
    return `riutek-cau-hinh-${timestamp}.png`
  }

  return `riutek-${sanitized}-${timestamp}.png`
}
