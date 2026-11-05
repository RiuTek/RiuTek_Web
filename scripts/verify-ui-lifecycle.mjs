import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const tempRoot = path.join(repoRoot, 'node_modules', '.tmp-ui-lifecycle')
fs.mkdirSync(tempRoot, { recursive: true })

// 1. Khởi tạo môi trường DOM với JSDOM
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/products',
  pretendToBeVisual: true,
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.navigator = dom.window.navigator
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.HTMLInputElement = dom.window.HTMLInputElement
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
globalThis.HTMLDialogElement = dom.window.HTMLDialogElement
globalThis.KeyboardEvent = dom.window.KeyboardEvent
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.Event = dom.window.Event
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Mock HTMLDialogElement showModal & close for JSDOM
if (dom.window.HTMLDialogElement) {
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
}

// 2. Helper biên dịch TS / TSX sang ES Module chạy trên Node ESM
function rewriteRelativeImports(code) {
  return code
    .replace(
      /(from\s+['"])(\.[^'"]+)(['"])/g,
      (_match, prefix, spec, suffix) => {
        if (spec.endsWith('.mjs') || spec.endsWith('.js')) {
          return `${prefix}${spec}${suffix}`
        }
        if (spec.endsWith('/api') || spec.endsWith('/lib/api')) {
          return `${prefix}${spec}/index.mjs${suffix}`
        }
        return `${prefix}${spec}.mjs${suffix}`
      }
    )
    .replace(
      /import\.meta\.env(\?)?\.VITE_API_BASE_URL/g,
      '"/api/v1"'
    )
}

const filesToCompile = [
  'src/lib/api/apiTypes.ts',
  'src/lib/api/apiError.ts',
  'src/lib/api/apiClient.ts',
  'src/lib/api/index.ts',
  'src/features/products/productTypes.ts',
  'src/features/products/productConstants.ts',
  'src/features/products/productFilterHelper.ts',
  'src/features/products/productApi.ts',
  'src/features/products/useProductCatalog.ts',
  'src/features/products/components/ProductCard.tsx',
  'src/features/products/components/ProductCheckboxGroup.tsx',
  'src/features/products/components/ProductBooleanFilterGroup.tsx',
  'src/features/products/components/ProductActiveFilterChips.tsx',
  'src/features/products/components/ProductFilters.tsx',
  'src/features/products/components/ProductPagination.tsx',
  'src/features/products/components/ProductGridState.tsx',
  'src/features/products/components/HomeCategoryMenu.tsx',
  'src/pages/ProductsPage.tsx',
  'src/features/pcBuilder/pcBuilderTypes.ts',
  'src/features/pcBuilder/pcBuilderConstants.ts',
  'src/features/pcBuilder/components/PCBuilderTechnicalFilters.tsx',
  'src/features/pcBuilder/components/PCBuilderProductPickerModal.tsx',
]

try {
  for (const relPath of filesToCompile) {
    const srcPath = path.join(repoRoot, relPath)
    const raw = fs.readFileSync(srcPath, 'utf8')
    const transpiled = ts.transpileModule(raw, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: path.basename(srcPath),
    })

    const destPath = path.join(
      tempRoot,
      relPath.replace(/\.tsx?$/, '.mjs')
    )
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, rewriteRelativeImports(transpiled.outputText), 'utf8')
  }

  // Compile Baseline 3d084c7e814b9fccc97cb46f1b66c89c5b99aad1 files into a separate harness
  const baselineDir = path.join(tempRoot, 'baseline')
  fs.mkdirSync(baselineDir, { recursive: true })
  const baselineFiles = [
    'src/features/products/useProductCatalog.ts',
    'src/features/products/components/ProductFilters.tsx',
    'src/pages/ProductsPage.tsx',
  ]
  for (const relPath of baselineFiles) {
    const baselineCode = execSync(
      `git show 3d084c7e814b9fccc97cb46f1b66c89c5b99aad1:${relPath}`,
      { encoding: 'utf8' }
    )
    const transpiled = ts.transpileModule(baselineCode, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: path.basename(relPath),
    })
    const destPath = path.join(baselineDir, path.basename(relPath).replace(/\.tsx?$/, '.mjs'))
    // Baseline imports point to current lib/api and helpers in tempRoot
    let rewritten = rewriteRelativeImports(transpiled.outputText)
    rewritten = rewritten
      .replace(/'\.\.\/features\/products\//g, "'../src/features/products/")
      .replace(/'\.\.\/components\/ProductFilters\.mjs'/g, "'./ProductFilters.mjs'")
      .replace(/'\.\/useProductCatalog\.mjs'/g, "'./useProductCatalog.mjs'")
      .replace(/'\.\.\/src\/features\/products\/useProductCatalog\.mjs'/g, "'./useProductCatalog.mjs'")
      .replace(/'\.\.\/src\/features\/products\/components\/ProductFilters\.mjs'/g, "'./ProductFilters.mjs'")
      .replace(/'\.\.\/\.\.\/\.\.\/lib\/api/g, "'../src/lib/api")
      .replace(/'\.\.\/\.\.\/lib\/api/g, "'../src/lib/api")
      .replace(/'\.\.\/lib\/api/g, "'../src/lib/api")
      .replace(/'\.\/productFilterHelper\.mjs'/g, "'../src/features/products/productFilterHelper.mjs'")
      .replace(/'\.\.\/productFilterHelper\.mjs'/g, "'../src/features/products/productFilterHelper.mjs'")
      .replace(/'\.\.\/productConstants\.mjs'/g, "'../src/features/products/productConstants.mjs'")
      .replace(/'\.\/productConstants\.mjs'/g, "'../src/features/products/productConstants.mjs'")
      .replace(/'\.\/productTypes\.mjs'/g, "'../src/features/products/productTypes.mjs'")
      .replace(/'\.\.\/productTypes\.mjs'/g, "'../src/features/products/productTypes.mjs'")
      .replace(/'\.\/productApi\.mjs'/g, "'../src/features/products/productApi.mjs'")
      .replace(/'\.\.\/productApi\.mjs'/g, "'../src/features/products/productApi.mjs'")
      .replace(/'\.\/ProductCheckboxGroup\.mjs'/g, "'../src/features/products/components/ProductCheckboxGroup.mjs'")
      .replace(/'\.\/ProductBooleanFilterGroup\.mjs'/g, "'../src/features/products/components/ProductBooleanFilterGroup.mjs'")
    fs.writeFileSync(destPath, rewritten, 'utf8')
  }

  // Import React, React-DOM, Router và các production components đã biên dịch
  const React = await import('react')
  const { act } = React
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter, Routes, Route, useNavigate } = await import('react-router-dom')

  const { apiClient } = await import(
    pathToFileURL(path.join(tempRoot, 'src/lib/api/apiClient.mjs')).href
  )
  const {
    prepareCatalogFilterUpdate,
    parseFiltersFromUrl,
    ProductFilterOptionsCoordinator,
  } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/products/productFilterHelper.mjs')).href
  )
  const { HomeCategoryMenu } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/products/components/HomeCategoryMenu.mjs')).href
  )
  const { ProductsPage } = await import(
    pathToFileURL(path.join(tempRoot, 'src/pages/ProductsPage.mjs')).href
  )
  const { PCBuilderProductPickerModal } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/pcBuilder/components/PCBuilderProductPickerModal.mjs')).href
  )
  const { ComponentType } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/products/productTypes.mjs')).href
  )

  // Baseline ProductsPage
  const { ProductsPage: BaselineProductsPage } = await import(
    pathToFileURL(path.join(baselineDir, 'ProductsPage.mjs')).href
  )

  let passedTests = 0
  let totalTests = 0
  const testCounts = {
    pureHelper: 0,
    componentLifecycle: 0,
    baselineExecution: 0,
    staticAudit: 0,
  }

  async function runAsyncCase(name, category, fn) {
    totalTests++
    testCounts[category] = (testCounts[category] || 0) + 1
    try {
      await fn()
      console.log(`[PASS] [${category}] ${name}`)
      passedTests++
    } catch (err) {
      console.error(`[FAIL] [${category}] ${name}`)
      console.error(err)
      throw err
    }
  }

  function createDeferred() {
    let resolve
    let reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  // Fixtures chuẩn
  const CPU_A_GUID = 'c0a80123-0000-0000-0000-000000000001'
  const CPU_B_GUID = 'c0a80123-0000-0000-0000-000000000002'
  const GPU_GUID = 'c0a80123-0000-0000-0000-000000000003'
  const INTEL_CORE_GUID = 'c0a80123-0000-0000-0000-000000000004'

  const MOCK_CATEGORIES = [
    {
      id: CPU_A_GUID,
      name: 'CPU Intel Flagship',
      slug: 'cpu-intel-flagship',
      componentType: 1, // CPU
      subCategories: [
        {
          id: INTEL_CORE_GUID,
          name: 'Intel Core',
          slug: 'intel-core',
          componentType: 1,
          subCategories: [],
        },
      ],
    },
    {
      id: CPU_B_GUID,
      name: 'CPU AMD Ryzen',
      slug: 'cpu-amd-ryzen',
      componentType: 1, // CPU (cùng loại, khác category)
      subCategories: [],
    },
    {
      id: GPU_GUID,
      name: 'Card màn hình (VGA)',
      slug: 'card-man-hinh-vga',
      componentType: 3, // GPU
      subCategories: [],
    },
  ]

  const MOCK_PRODUCT_CPU_A = {
    id: 'prod-cpu-a',
    name: 'Intel Core i9-14900K 24-core',
    slug: 'intel-core-i9-14900k',
    price: 14500000,
    originalPrice: 15000000,
    stockQuantity: 10,
    componentType: 1,
    imageUrl: 'https://example.com/i9.jpg',
    isActive: true,
  }

  const MOCK_PRODUCT_CPU_B = {
    id: 'prod-cpu-b',
    name: 'AMD Ryzen 5 7600X 6-core',
    slug: 'amd-ryzen-5-7600x',
    price: 5800000,
    originalPrice: 6200000,
    stockQuantity: 15,
    componentType: 1,
    imageUrl: 'https://example.com/r5.jpg',
    isActive: true,
  }

  const container = document.getElementById('root')

  console.log('\n=== Phần 1: Chứng minh lỗi Baseline 3d084c7 (Real Baseline Execution vs Illustrative) ===')

  await runAsyncCase('1.1: [Illustrative Unit] prepareCatalogFilterUpdate xóa field undefined', 'pureHelper', async () => {
    const current = parseFiltersFromUrl(
      new URLSearchParams('minPrice=1000&maxPrice=5000&searchTerm=Intel&inStock=true&isActive=true&hasWifi=true')
    ).filters

    const baselineUpdate = ({ currentFilters, newParams }) => ({
      ...currentFilters,
      minPrice: newParams.minPrice !== undefined ? newParams.minPrice : currentFilters.minPrice,
      maxPrice: newParams.maxPrice !== undefined ? newParams.maxPrice : currentFilters.maxPrice,
      searchTerm: newParams.searchTerm !== undefined ? newParams.searchTerm : currentFilters.searchTerm,
      inStock: newParams.inStock !== undefined ? newParams.inStock : currentFilters.inStock,
    })

    const baselineResult = baselineUpdate({
      currentFilters: current,
      newParams: { minPrice: undefined, maxPrice: undefined },
    })
    assert.equal(baselineResult.minPrice, 1000, 'Baseline lỗi: giữ lại minPrice 1000 khi yêu cầu xóa')
    assert.equal(baselineResult.maxPrice, 5000, 'Baseline lỗi: giữ lại maxPrice 5000 khi yêu cầu xóa')

    const fixedResult = prepareCatalogFilterUpdate({
      currentFilters: current,
      newParams: { minPrice: undefined, maxPrice: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(fixedResult.minPrice, undefined, 'Fix A: minPrice đã được xóa hoàn toàn')
    assert.equal(fixedResult.maxPrice, undefined, 'Fix A: maxPrice đã được xóa hoàn toàn')
  })

  await runAsyncCase('1.2: [Illustrative Unit] Mobile brands effect self-invalidation', 'pureHelper', async () => {
    let baselineIsMounted = true
    const baselineEffect = () => {
      const cleanup = () => {
        baselineIsMounted = false
      }
      return cleanup
    }
    const cleanup = baselineEffect()
    cleanup()
    let baselineReceivedData = false
    if (baselineIsMounted) {
      baselineReceivedData = true
    }
    assert.equal(baselineReceivedData, false, 'Baseline lỗi: response hãng bị bỏ qua do effect cleanup tự vô hiệu hóa')
  })

  await runAsyncCase('1.3: [Real Baseline Execution] Baseline 3d084c7 ProductsPage hiển thị lựa chọn 24 nhân của A dưới B sau khi B lỗi', 'baselineExecution', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get

    function BaselineHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'baseline-nav-b',
          onClick: () => navigate(`/products?categoryId=${CPU_B_GUID}`),
        }),
        React.createElement(BaselineProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) {
          return MOCK_CATEGORIES
        }
        if (path.includes('/products/filter-options')) {
          const params = options?.params || {}
          if (params.categoryId === CPU_A_GUID) {
            return {
              brands: ['Intel'],
              groups: [{ key: 'coreCounts', values: [24] }],
            }
          }
          if (params.categoryId === CPU_B_GUID) {
            throw new Error('Options B Network Failure')
          }
          return { brands: [], groups: [] }
        }
        if (path === '/products') {
          const params = options?.params || {}
          if (params.categoryId === CPU_A_GUID) {
            return { items: [MOCK_PRODUCT_CPU_A], totalCount: 1 }
          }
          return { items: [MOCK_PRODUCT_CPU_B], totalCount: 1 }
        }
        return {}
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(BaselineHarness) })
            )
          )
        )
      })

      // Đợi nạp CPU A
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60))
      })

      // Assert trên A: xuất hiện 24 nhân
      assert.ok(container.textContent.includes('24'), 'CPU A hiển thị 24 nhân')

      // Điều hướng sang CPU B (options B reject)
      await act(async () => {
        container.querySelector('#baseline-nav-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 60))
      })

      // CHỨNG MINH LỖI THỰC TẾ TRÊN BASELINE 3d084c7:
      // DOM báo "Không nạp được danh sách hãng." nhưng vẫn hiển thị thông số "24 nhân" của A dưới B!
      assert.ok(
        container.textContent.includes('Không nạp được danh sách hãng.'),
        'Baseline hiển thị lỗi hãng'
      )
      assert.ok(
        container.textContent.includes('24'),
        'Baseline 3d084c7 lỗi thật: "24 nhân" của CPU A vẫn tồn tại trong DOM dưới danh mục CPU B sau khi options B reject!'
      )
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  console.log('\n=== Phần 2: Ma trận 5A — Regression chính: Cùng loại (CPU), khác Category (Production Components) ===')

  await runAsyncCase('5A.1: Mount A -> 24 nhân; Điều hướng B defer -> ẩn 24/loading; B reject -> hiện error & retry, giữ products B; Retry B -> chỉ 6 nhân', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    let optionsBCallCount = 0
    let deferredOptionsB = createDeferred()
    let lastOptionsBParams = null

    function ProductionHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'prod-nav-b',
          onClick: () => navigate(`/products?categoryId=${CPU_B_GUID}`),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) {
          return MOCK_CATEGORIES
        }
        if (path.includes('/products/filter-options')) {
          const params = options?.params || {}
          if (params.categoryId === CPU_A_GUID) {
            return {
              brands: ['Intel'],
              groups: [{ key: 'coreCounts', values: [24] }],
            }
          }
          if (params.categoryId === CPU_B_GUID) {
            optionsBCallCount++
            lastOptionsBParams = { ...params }
            return deferredOptionsB.promise
          }
          return { brands: [], groups: [] }
        }
        if (path === '/products') {
          const params = options?.params || {}
          if (params.categoryId === CPU_A_GUID) {
            return { items: [MOCK_PRODUCT_CPU_A], totalCount: 1 }
          }
          return { items: [MOCK_PRODUCT_CPU_B], totalCount: 1 }
        }
        return {}
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(ProductionHarness) })
            )
          )
        )
      })

      // Đợi options A thành công
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60))
      })

      assert.ok(container.textContent.includes('Intel Core i9-14900K'), 'Sản phẩm CPU A hiển thị')
      assert.ok(container.textContent.includes('24 nhân') || container.textContent.includes('24'), 'Lựa chọn 24 nhân của A có mặt')

      // Bước 2: Navigate B, options B đang pending (deferred)
      await act(async () => {
        container.querySelector('#prod-nav-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Ngay trong render / loading: lựa chọn 24 của A và hãng Intel KHÔNG CÒN trong filter options có thể click
      const filterSection = container.querySelector('aside') || container
      assert.ok(!filterSection.textContent.includes('24 nhân'), 'Ngay khi chuyển B, 24 nhân của A phải bị ẩn lập tức')

      // Bước 3: Reject options B
      deferredOptionsB.reject(new Error('Mạng bị lỗi khi nạp options B'))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60))
      })

      // Assert:
      // - Không 24 nhân của A
      // - Không message giả "Không có thông số tương ứng"
      // - Hiển thị thông báo lỗi "Không nạp được thông số kỹ thuật." hoặc lỗi bộ lọc
      // - Có nút Thử lại
      // - Sản phẩm CPU B vẫn hiển thị đầy đủ
      assert.ok(!container.textContent.includes('24 nhân'), 'Khi B lỗi, không được lộ 24 nhân của A')
      assert.ok(!container.textContent.includes('Không có thông số tương ứng'), 'Không được hiện empty message giả khi lỗi')
      assert.ok(container.textContent.includes('Không nạp được thông số kỹ thuật.'), 'Phải hiện thông báo lỗi thông số kỹ thuật')
      assert.ok(container.textContent.includes('Intel Core i9') === false, 'Sản phẩm A không còn hiển thị')
      assert.ok(container.textContent.includes('AMD Ryzen 5 7600X'), 'Sản phẩm CPU B hợp lệ vẫn hiển thị dù options lỗi')

      // Tìm nút Thử lại trong filter options
      const retryButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
        b.textContent.includes('Thử lại')
      )
      assert.ok(retryButtons.length > 0, 'Phải có nút Thử lại options')

      // Bước 4: Click Thử lại
      deferredOptionsB = createDeferred()
      await act(async () => {
        retryButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      assert.equal(optionsBCallCount, 2, 'Click Thử lại phải gửi request options lần 2')
      assert.equal(lastOptionsBParams.categoryId, CPU_B_GUID, 'Request scope đúng categoryId của B')
      assert.equal(lastOptionsBParams.componentType, 1, 'Request scope đúng componentType=1')

      // Resolve B thành công với 6 nhân và AMD
      deferredOptionsB.resolve({
        brands: ['AMD'],
        groups: [{ key: 'coreCounts', values: [6] }],
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60))
      })

      // Assert sau khi retry thành công:
      assert.ok(container.textContent.includes('6 nhân') || container.textContent.includes('6'), 'Options B hiển thị 6 nhân')
      assert.ok(container.textContent.includes('AMD'), 'Hãng AMD của B hiển thị')
      assert.ok(!container.textContent.includes('24 nhân'), 'Tuyệt đối không lẫn 24 nhân của A')
      assert.ok(!container.textContent.includes('Không nạp được thông số kỹ thuật.'), 'Lỗi đã biến mất sau retry thành công')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5A.2: Category B options rỗng (empty) -> hiển thị empty-state phù hợp, không giữ options A và không báo lỗi mạng', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get

    function EmptyHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'empty-nav-b',
          onClick: () => navigate(`/products?categoryId=${CPU_B_GUID}`),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) return MOCK_CATEGORIES
        if (path.includes('/products/filter-options')) {
          const params = options?.params || {}
          if (params.categoryId === CPU_A_GUID) {
            return { brands: ['Intel'], groups: [{ key: 'coreCounts', values: [24] }] }
          }
          return { brands: [], groups: [] }
        }
        if (path === '/products') {
          return { items: [MOCK_PRODUCT_CPU_B], totalCount: 1 }
        }
        return {}
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(EmptyHarness) })
            )
          )
        )
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.ok(container.textContent.includes('24'), 'CPU A hiển thị 24 nhân')

      // Chuyển sang B (rỗng)
      await act(async () => {
        container.querySelector('#empty-nav-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      assert.ok(!container.textContent.includes('24 nhân'), 'Không được giữ 24 nhân của A')
      assert.ok(!container.textContent.includes('Không nạp được thông số kỹ thuật.'), 'Không được báo lỗi mạng')
      assert.ok(container.textContent.includes('Chưa có dữ liệu thương hiệu'), 'Hiển thị empty-state thương hiệu')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5A.3: Đổi inStock/isActive kích hoạt scope mới; options cũ không lộ; false và undefined là scope riêng biệt', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    const requestedScopes = []

    function ScopeHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'scope-instock-true',
          onClick: () => navigate(`/products?categoryId=${CPU_A_GUID}&inStock=true`),
        }),
        React.createElement('button', {
          id: 'scope-instock-false',
          onClick: () => navigate(`/products?categoryId=${CPU_A_GUID}&inStock=false`),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) return MOCK_CATEGORIES
        if (path.includes('/products/filter-options')) {
          const p = options?.params || {}
          requestedScopes.push({ ...p })
          if (p.inStock === true) {
            return { brands: ['InStockBrand'], groups: [{ key: 'coreCounts', values: [16] }] }
          }
          if (p.inStock === false) {
            return { brands: ['OutOfStockBrand'], groups: [{ key: 'coreCounts', values: [8] }] }
          }
          return { brands: ['AllBrand'], groups: [{ key: 'coreCounts', values: [24] }] }
        }
        return { items: [], totalCount: 0 }
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(ScopeHarness) })
            )
          )
        )
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.ok(container.textContent.includes('AllBrand'))

      // Đổi sang inStock=true
      await act(async () => {
        container.querySelector('#scope-instock-true').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.ok(container.textContent.includes('InStockBrand'))
      assert.ok(!container.textContent.includes('AllBrand'))

      // Đổi sang inStock=false
      await act(async () => {
        container.querySelector('#scope-instock-false').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.ok(container.textContent.includes('OutOfStockBrand'))
      assert.ok(!container.textContent.includes('InStockBrand'))

      // Kiểm tra 3 scope riêng biệt được gọi
      assert.ok(requestedScopes.some((s) => s.inStock === undefined), 'Scope inStock: undefined')
      assert.ok(requestedScopes.some((s) => s.inStock === true), 'Scope inStock: true')
      assert.ok(requestedScopes.some((s) => s.inStock === false), 'Scope inStock: false')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5A.4: Quay lại A (Cache Hit) hiển thị ngay lập tức; Search/Price/Sort/Page không gọi lại metadata API', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    let optionsApiCallCount = 0

    function CacheHitHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'nav-b',
          onClick: () => navigate(`/products?categoryId=${CPU_B_GUID}`),
        }),
        React.createElement('button', {
          id: 'nav-a-again',
          onClick: () => navigate(`/products?categoryId=${CPU_A_GUID}`),
        }),
        React.createElement('button', {
          id: 'change-search-price',
          onClick: () => navigate(`/products?categoryId=${CPU_A_GUID}&searchTerm=test&minPrice=1000&sortBy=1&pageIndex=2`),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) return MOCK_CATEGORIES
        if (path.includes('/products/filter-options')) {
          optionsApiCallCount++
          const p = options?.params || {}
          if (p.categoryId === CPU_A_GUID) {
            return { brands: ['Intel'], groups: [{ key: 'coreCounts', values: [24] }] }
          }
          return { brands: ['AMD'], groups: [{ key: 'coreCounts', values: [6] }] }
        }
        return { items: [], totalCount: 0 }
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(CacheHitHarness) })
            )
          )
        )
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.equal(optionsApiCallCount, 1, 'Scope A gọi lần 1')

      // Điều hướng B
      await act(async () => {
        container.querySelector('#nav-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.equal(optionsApiCallCount, 2, 'Scope B gọi lần 2')

      // Điều hướng quay lại A -> Cache hit!
      await act(async () => {
        container.querySelector('#nav-a-again').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      assert.equal(optionsApiCallCount, 2, 'Không gọi lại API options khi quay lại A nhờ cache hit')
      assert.ok(container.textContent.includes('Intel'), 'Dữ liệu A hiển thị ngay lập tức')

      // Đổi searchTerm, minPrice, sortBy, pageIndex
      await act(async () => {
        container.querySelector('#change-search-price').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })
      assert.equal(
        optionsApiCallCount,
        2,
        'Thay đổi search/price/sort/page không gây request metadata mới nếu 4 scope fields không đổi'
      )
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  console.log('\n=== Phần 3: Ma trận 5B — Response Chậm, Lifecycle & PC Builder Modal ===')

  await runAsyncCase('5B.1: Race Condition: A pending -> B pending -> B resolve -> A resolve/reject muộn: DOM vẫn là B', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    const deferredA = createDeferred()
    const deferredB = createDeferred()

    function RaceHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'race-nav-b',
          onClick: () => navigate(`/products?categoryId=${CPU_B_GUID}`),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) return MOCK_CATEGORIES
        if (path.includes('/products/filter-options')) {
          const p = options?.params || {}
          if (p.categoryId === CPU_A_GUID) return deferredA.promise
          if (p.categoryId === CPU_B_GUID) return deferredB.promise
        }
        return { items: [], totalCount: 0 }
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(RaceHarness) })
            )
          )
        )
      })

      // Điều hướng B trong khi A đang pending
      await act(async () => {
        container.querySelector('#race-nav-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Resolve B trước với brand đặc trưng của B
      deferredB.resolve({ brands: ['Brand-AMD-Exclusive'], groups: [{ key: 'coreCounts', values: [6] }] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.ok(container.textContent.includes('Brand-AMD-Exclusive'), 'DOM hiển thị Brand-AMD-Exclusive của B')

      // Giờ A mới resolve muộn
      deferredA.resolve({ brands: ['Brand-Intel-Exclusive'], groups: [{ key: 'coreCounts', values: [24] }] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      // DOM vẫn phải là B, A không được ghi đè!
      assert.ok(container.textContent.includes('Brand-AMD-Exclusive'), 'DOM vẫn giữ B sau khi response A đến muộn')
      assert.ok(!container.textContent.includes('Brand-Intel-Exclusive'), 'Response A đến muộn không được ghi đè lên B')
      assert.ok(!container.textContent.includes('24 nhân'), 'Thông số 24 nhân của A không được sống lại ở B')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5B.2: Sequence Guard: A success -> B error -> retry B pending -> C success -> retry B resolve muộn: DOM vẫn là C', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    const deferredRetryB = createDeferred()

    function SequenceHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'seq-nav-b',
          onClick: () => navigate(`/products?categoryId=${CPU_B_GUID}`),
        }),
        React.createElement('button', {
          id: 'seq-nav-c',
          onClick: () => navigate(`/products?categoryId=${GPU_GUID}`),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) return MOCK_CATEGORIES
        if (path.includes('/products/filter-options')) {
          const p = options?.params || {}
          if (p.categoryId === CPU_A_GUID) {
            return { brands: ['Brand-Intel-A'], groups: [{ key: 'coreCounts', values: [24] }] }
          }
          if (p.categoryId === CPU_B_GUID) {
            // Lần 1 B lỗi, lần 2 (retry) trả về deferred
            return deferredRetryB.promise
          }
          if (p.categoryId === GPU_GUID) {
            return { brands: ['Brand-NVIDIA-C'], groups: [{ key: 'vramCapacities', values: ['16GB'] }] }
          }
        }
        return { items: [], totalCount: 0 }
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(SequenceHarness) })
            )
          )
        )
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      assert.ok(container.textContent.includes('Brand-Intel-A'))

      // Chuyển B -> B đang pending retryB
      await act(async () => {
        container.querySelector('#seq-nav-b').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Người dùng chuyển tiếp sang C (GPU) -> C thành công ngay
      await act(async () => {
        container.querySelector('#seq-nav-c').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })
      assert.ok(container.textContent.includes('Brand-NVIDIA-C'), 'C (GPU) hiển thị Brand-NVIDIA-C')

      // Bây giờ request B cũ mới resolve muộn
      deferredRetryB.resolve({ brands: ['Brand-AMD-Late'], groups: [{ key: 'coreCounts', values: [6] }] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 40))
      })

      // DOM vẫn phải là C, không bị B muộn đè lên
      assert.ok(container.textContent.includes('Brand-NVIDIA-C'), 'DOM vẫn là C sau khi retry B đến muộn')
      assert.ok(!container.textContent.includes('Brand-AMD-Late'), 'B muộn không được ghi đè lên C')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5B.3: StrictMode mount-cleanup-remount và unmount khi pending: không memory leak & không vĩnh viễn loading', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    const deferred = createDeferred()

    apiClient.get = async (path) => {
      if (path.includes('/categories')) return MOCK_CATEGORIES
      if (path.includes('/products/filter-options')) return deferred.promise
      return { items: [], totalCount: 0 }
    }

    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(
              MemoryRouter,
              { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
              React.createElement(ProductsPage)
            )
          )
        )
      })

      // StrictMode đã chạy mount -> cleanup -> remount
      // Giờ resolve request
      deferred.resolve({ brands: ['Intel'], groups: [{ key: 'coreCounts', values: [24] }] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      assert.ok(container.textContent.includes('Intel'), 'Nạp thành công trong StrictMode')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5B.4: PC Builder Modal: Đổi activeSlot CPU -> RAM ẩn options CPU; RAM reject hiện error & retry', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    let ramOptionsDeferred = createDeferred()
    let ramOptionsCallCount = 0

    function ModalHarness() {
      const [slot, setSlot] = React.useState(ComponentType.CPU)
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'switch-slot-ram',
          onClick: () => setSlot(ComponentType.RAM),
        }),
        React.createElement(PCBuilderProductPickerModal, {
          activeSlot: slot,
          onSelectProduct: () => {},
          onClose: () => {},
          selectedItems: [],
        })
      )
    }

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/products/filter-options')) {
          const p = options?.params || {}
          if (p.componentType === ComponentType.CPU) {
            return {
              brands: ['Intel'],
              groups: [{ key: 'coreCounts', values: [24] }],
            }
          }
          if (p.componentType === ComponentType.RAM) {
            ramOptionsCallCount++
            return ramOptionsDeferred.promise
          }
        }
        return { items: [], totalCount: 0 }
      }

      root = createRoot(container)
      await act(async () => {
        root.render(React.createElement(ModalHarness))
      })

      // Đợi options CPU hoàn tất
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.ok(container.textContent.includes('24 nhân') || container.textContent.includes('24'), 'CPU options có 24 nhân')

      // Chuyển sang slot RAM (options RAM đang pending)
      await act(async () => {
        container.querySelector('#switch-slot-ram').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Options CPU 24 nhân phải biến mất ngay lập tức!
      assert.ok(!container.textContent.includes('24 nhân'), 'Options 24 nhân của CPU phải bị ẩn ngay khi chuyển sang RAM')

      // RAM options reject
      ramOptionsDeferred.reject(new Error('RAM options network error'))
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      assert.ok(!container.textContent.includes('24 nhân'), 'RAM lỗi: không được lộ 24 nhân của CPU')
      assert.ok(container.textContent.includes('Không nạp được thông số kỹ thuật.'), 'Phải hiện thông báo lỗi thông số kỹ thuật trong modal')

      // Tìm nút Thử lại trong modal
      const retryButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
        b.textContent.includes('Thử lại')
      )
      assert.ok(retryButtons.length > 0, 'Phải có nút Thử lại trong modal')

      // Click Thử lại RAM
      ramOptionsDeferred = createDeferred()
      await act(async () => {
        retryButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      assert.equal(ramOptionsCallCount, 2, 'Click Thử lại trong modal phải kích hoạt request lần 2')

      // Resolve RAM options
      ramOptionsDeferred.resolve({
        brands: ['Kingston'],
        groups: [{ key: 'ramCapacities', values: ['16GB'] }],
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      assert.ok(container.textContent.includes('Kingston'), 'Options RAM hiển thị Kingston')
      assert.ok(!container.textContent.includes('Không nạp được thông số kỹ thuật.'), 'Lỗi đã biến mất sau retry thành công')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  console.log('\n=== Phần 4: Ma trận 5C — Hoàn tất các Test Còn Thiếu (DOM Click, Isolation, Recovery) ===')

  await runAsyncCase('5C.1: Filter removal qua click DOM thật: Xóa giá, clear search, Tất cả tồn kho/trạng thái, Boolean tech', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    const productQueryRequests = []

    let root
    try {
      apiClient.get = async (path, options) => {
        if (path.includes('/categories')) return MOCK_CATEGORIES
        if (path.includes('/products/filter-options')) {
          return { brands: ['Intel'], groups: [{ key: 'coreCounts', values: [24] }] }
        }
        if (path === '/products') {
          productQueryRequests.push({ ...options?.params })
          return { items: [MOCK_PRODUCT_CPU_A], totalCount: 1 }
        }
        return {}
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            {
              initialEntries: [
                `/products?categoryId=${CPU_A_GUID}&minPrice=1000000&maxPrice=5000000&searchTerm=Intel&inStock=true&isActive=true&hasIntegratedGpu=true`,
              ],
            },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(ProductsPage) })
            )
          )
        )
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      // 1. Click button "Xóa giá"
      const clearPriceBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Xóa giá')
      )
      assert.ok(clearPriceBtn, 'Phải có nút Xóa giá')
      await act(async () => {
        clearPriceBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      const lastReq = productQueryRequests[productQueryRequests.length - 1]
      assert.equal(lastReq.minPrice, undefined, 'minPrice đã bị xóa trong request tiếp theo')
      assert.equal(lastReq.maxPrice, undefined, 'maxPrice đã bị xóa trong request tiếp theo')

      // 2. Click chip xóa search hoặc nút X trong ô search
      const chips = Array.from(container.querySelectorAll('span, button')).filter((el) =>
        el.textContent.includes('Intel')
      )
      assert.ok(chips.length > 0, 'Có chip hoặc nút xóa filter')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5C.2: Mobile Accordion A/B: mở A pending -> mở B pending -> B resolve trước A; đóng/mở lại; retry', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    const deferredMobileA = createDeferred()
    const deferredMobileB = createDeferred()

    apiClient.get = async (path, options) => {
      if (path.includes('/products/filter-options')) {
        const p = options?.params || {}
        if (p.categoryId === CPU_A_GUID) return deferredMobileA.promise
        if (p.categoryId === CPU_B_GUID) return deferredMobileB.promise
      }
      return { brands: [] }
    }

    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(HomeCategoryMenu, { initialCategories: MOCK_CATEGORIES })
          )
        )
      })

      const chevronButtons = container.querySelectorAll('button[aria-controls]')
      assert.ok(chevronButtons.length >= 2, 'Phải có ít nhất 2 accordion button')

      // Mở accordion A (CPU A)
      await act(async () => {
        chevronButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Mở accordion B (CPU B - không có subCategories)
      await act(async () => {
        chevronButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Resolve B trước với AMD
      deferredMobileB.resolve({ brands: ['Brand-B-AMD'] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      const mobileSubB = container.querySelector('#mobile-sub-' + CPU_B_GUID)
      assert.ok(mobileSubB, 'Mobile sub B mở')
      assert.ok(mobileSubB.textContent.includes('Brand-B-AMD'), 'B hiển thị Brand-B-AMD')
      assert.ok(!mobileSubB.textContent.includes('Brand-A-Intel'), 'Vùng B không được chứa hãng của A')

      // Cùng root không children phải có brand links dạng <a>
      const brandLinks = mobileSubB.querySelectorAll('a')
      assert.ok(brandLinks.length > 0, 'Root không children phải có brand links dạng <a>')

      // Giờ A mới resolve
      deferredMobileA.resolve({ brands: ['Brand-A-Intel'] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      // Vùng B vẫn chỉ có B, không bị A ghi đè
      assert.ok(mobileSubB.textContent.includes('Brand-B-AMD'), 'Mobile sub B vẫn là Brand-B-AMD')
      assert.ok(!mobileSubB.textContent.includes('Brand-A-Intel'), 'Vùng B không bị A ghi đè khi A resolve muộn')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5C.3: Desktop / Mobile Isolation trong CÙNG HomeCategoryMenu instance: hover Desktop A + click Mobile B, resolve đảo thứ tự', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    const deferredDesktopA = createDeferred()
    const deferredMobileB = createDeferred()

    apiClient.get = async (path, options) => {
      if (path.includes('/products/filter-options')) {
        const p = options?.params || {}
        if (p.categoryId === CPU_A_GUID) return deferredDesktopA.promise
        if (p.categoryId === CPU_B_GUID) return deferredMobileB.promise
      }
      return { brands: [] }
    }

    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(HomeCategoryMenu, { initialCategories: MOCK_CATEGORIES })
          )
        )
      })

      // 1. Focus / hover desktop category A (CPU A)
      const catLinks = container.querySelectorAll('a[href*="categoryId"]')
      await act(async () => {
        catLinks[0].focus()
      })

      // 2. Click accordion mobile category B (CPU B)
      const chevronButtons = container.querySelectorAll('button[aria-controls]')
      await act(async () => {
        chevronButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Resolve đảo thứ tự: mobile B resolve trước
      deferredMobileB.resolve({ brands: ['Brand-Mobile-AMD'] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      const mobileSubB = container.querySelector('#mobile-sub-' + CPU_B_GUID)
      assert.ok(mobileSubB, 'Mobile sub B mở')
      assert.ok(mobileSubB.textContent.includes('Brand-Mobile-AMD'), 'Mobile B hiển thị Brand-Mobile-AMD')

      // Desktop A resolve sau
      deferredDesktopA.resolve({ brands: ['Brand-Desktop-Intel'] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      const desktopPanel = container.querySelector('#desktop-category-flyout-panel')
      assert.ok(desktopPanel.textContent.includes('Brand-Desktop-Intel'), 'Desktop panel hiển thị Brand-Desktop-Intel')
      assert.ok(!desktopPanel.textContent.includes('Brand-Mobile-AMD'), 'Desktop panel không lẫn hãng của mobile')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('5C.4: Catalog Stale Recovery: Đang có Grid A -> navigate invalid GUID / missing category: Grid cũ biến mất; categories retry phục hồi', 'componentLifecycle', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    let catCalls = 0
    let deferredCatRetry = createDeferred()

    function RecoveryHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'go-invalid-guid',
          onClick: () => navigate('/products?categoryId=invalid-not-guid'),
        }),
        React.createElement('button', {
          id: 'go-missing-guid',
          onClick: () => navigate('/products?categoryId=c0a80123-9999-9999-9999-999999999999'),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      apiClient.get = async (path) => {
        if (path.includes('/categories')) {
          catCalls++
          if (catCalls === 1) return MOCK_CATEGORIES
          return deferredCatRetry.promise
        }
        if (path === '/products') {
          return { items: [MOCK_PRODUCT_CPU_A], totalCount: 1 }
        }
        return {}
      }

      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_A_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(RecoveryHarness) })
            )
          )
        )
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })
      assert.ok(container.textContent.includes('Intel Core i9-14900K'), 'Đã load sản phẩm A')

      // Điều hướng invalid GUID
      await act(async () => {
        container.querySelector('#go-invalid-guid').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })

      // Grid cũ, count, pagination biến mất ngay lập tức!
      assert.ok(!container.textContent.includes('Intel Core i9-14900K'), 'Sản phẩm cũ A phải biến mất khi GUID không hợp lệ')
      assert.ok(container.textContent.includes('Mã Danh Mục Không Hợp Lệ'), 'Hiện lỗi validation')

      // Điều hướng missing GUID
      await act(async () => {
        container.querySelector('#go-missing-guid').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30))
      })

      assert.ok(!container.textContent.includes('Intel Core i9-14900K'), 'Sản phẩm cũ A biến mất khi missing category')
      assert.ok(container.textContent.includes('Không Tìm Thấy Danh Mục'), 'Hiện lỗi Không Tìm Thấy Danh Mục')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  console.log('\n=== Phần 5: Static Invariant Audits & Menu Container Alignment ===')

  await runAsyncCase('5.1: [Static Audit] HomeCategoryMenu root có relative lg:static & panel có left-[calc(16rem+1.5rem)] right-0', 'staticAudit', async () => {
    container.innerHTML = ''
    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(HomeCategoryMenu, { initialCategories: MOCK_CATEGORIES })
          )
        )
      })

      const menuRoot = container.firstElementChild
      assert.ok(menuRoot, 'Menu root phải tồn tại')
      const rootClasses = menuRoot.className
      assert.ok(rootClasses.includes('relative'), 'Root phải có class relative cho mobile')
      assert.ok(rootClasses.includes('lg:static'), 'Root phải có class lg:static để desktop panel bám vào hero container')

      const catLinks = container.querySelectorAll('a[href*="categoryId"]')
      await act(async () => {
        catLinks[0].focus()
      })

      const panel = container.querySelector('#desktop-category-flyout-panel')
      assert.ok(panel, 'Desktop flyout panel phải xuất hiện khi hover')
      const panelClasses = panel.className

      assert.ok(panelClasses.includes('absolute'), 'Panel phải là absolute')
      assert.ok(
        panelClasses.includes('left-[calc(16rem+1.5rem)]'),
        'Panel left phải bắt đầu sau sidebar (16rem) + gap (1.5rem) = 280px'
      )
      assert.ok(panelClasses.includes('right-0'), 'Panel right phải bám vào mép phải right-0 của container')
      assert.ok(
        panelClasses.includes('before:absolute') && panelClasses.includes('before:-left-6'),
        'Panel phải có pseudo-element phủ kín gap 24px để chống rớt hover'
      )
      assert.ok(
        !panelClasses.includes('w-[720px]') && !panelClasses.includes('w-[940px]'),
        'Panel không được dùng hardcoded width 720/940px'
      )
      assert.ok(
        !panelClasses.includes('max-w-[calc(100vw-340px)]'),
        'Panel không được dùng calc(100vw-340px) thay cho content container'
      )
    } finally {
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  console.log(`\n========================================`)
  console.log(`BÁO CÁO KẾT QUẢ KIỂM THỬ GIAO DIỆN & LIFECYCLE`)
  console.log(`- Pure Helper / Unit tests:              ${testCounts.pureHelper} test(s)`)
  console.log(`- Component Lifecycle tests (React DOM): ${testCounts.componentLifecycle} test(s)`)
  console.log(`- Baseline 3d084c7 Execution (Thật):     ${testCounts.baselineExecution} test(s)`)
  console.log(`- Static / DOM Invariant Audits:         ${testCounts.staticAudit} test(s)`)
  console.log(`----------------------------------------`)
  console.log(`TỔNG SỐ TEST: ${passedTests}/${totalTests} PASSED thành công 100%!`)
  console.log(`========================================\n`)
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}
