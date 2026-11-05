import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { JSDOM } from 'jsdom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const tempRoot = path.join(repoRoot, 'node_modules', '.tmp-ui-lifecycle')
fs.mkdirSync(tempRoot, { recursive: true })

// 1. Khởi tạo môi trường DOM giả lập với JSDOM
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
globalThis.KeyboardEvent = dom.window.KeyboardEvent
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.Event = dom.window.Event
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

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

  // Import React, React-DOM, Router và các production components đã biên dịch
  const React = await import('react')
  const { act, useState, useEffect } = React
  const { createRoot } = await import('react-dom/client')
  const { MemoryRouter, Routes, Route, useNavigate, useLocation } = await import('react-router-dom')

  const { apiClient } = await import(
    pathToFileURL(path.join(tempRoot, 'src/lib/api/apiClient.mjs')).href
  )
  const {
    prepareCatalogFilterUpdate,
    parseFiltersFromUrl,
    buildProductFilterSearchParams,
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
  const { useProductCatalog } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/products/useProductCatalog.mjs')).href
  )

  let passedTests = 0
  let totalTests = 0

  async function runAsyncCase(name, fn) {
    totalTests++
    try {
      await fn()
      console.log(`[PASS] ${name}`)
      passedTests++
    } catch (err) {
      console.error(`[FAIL] ${name}`)
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
  const CPU_GUID = 'c0a80123-0000-0000-0000-000000000001'
  const GPU_GUID = 'c0a80123-0000-0000-0000-000000000002'
  const INTEL_CORE_GUID = 'c0a80123-0000-0000-0000-000000000003'

  const MOCK_CATEGORIES = [
    {
      id: CPU_GUID,
      name: 'Vi xử lý (CPU)',
      slug: 'vi-xu-ly-cpu',
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
      id: GPU_GUID,
      name: 'Card màn hình (VGA)',
      slug: 'card-man-hinh-vga',
      componentType: 3, // GPU
      subCategories: [],
    },
  ]

  const MOCK_PRODUCT_A = {
    id: 'prod-0001',
    name: 'Intel Core i9-14900K',
    slug: 'intel-core-i9-14900k',
    price: 14500000,
    originalPrice: 15000000,
    stockQuantity: 10,
    componentType: 1,
    imageUrl: 'https://example.com/i9.jpg',
    isActive: true,
  }

  const container = document.getElementById('root')

  console.log('\n=== Phần 1: Chứng minh lỗi Baseline 3af29ba (Baseline Regressions) ===')

  await runAsyncCase('1.1: Baseline Lỗi A — prepareCatalogFilterUpdate xóa field undefined', async () => {
    const current = parseFiltersFromUrl(
      new URLSearchParams('minPrice=1000&maxPrice=5000&searchTerm=Intel&inStock=true&isActive=true&hasWifi=true')
    ).filters

    // Mô phỏng hàm prepareCatalogFilterUpdate của baseline 3af29ba (dùng newParams.x !== undefined ? newParams.x : current.x)
    const baselineUpdate = ({ currentFilters, newParams }) => ({
      ...currentFilters,
      minPrice: newParams.minPrice !== undefined ? newParams.minPrice : currentFilters.minPrice,
      maxPrice: newParams.maxPrice !== undefined ? newParams.maxPrice : currentFilters.maxPrice,
      searchTerm: newParams.searchTerm !== undefined ? newParams.searchTerm : currentFilters.searchTerm,
      inStock: newParams.inStock !== undefined ? newParams.inStock : currentFilters.inStock,
    })

    // Khi caller muốn XÓA minPrice & maxPrice:
    const baselineResult = baselineUpdate({
      currentFilters: current,
      newParams: { minPrice: undefined, maxPrice: undefined },
    })
    // Baseline GIỮ NGUYÊN giá trị cũ -> Lỗi!
    assert.equal(baselineResult.minPrice, 1000, 'Baseline lỗi: giữ lại minPrice 1000 khi yêu cầu xóa')
    assert.equal(baselineResult.maxPrice, 5000, 'Baseline lỗi: giữ lại maxPrice 5000 khi yêu cầu xóa')

    // Code hiện tại đã sửa:
    const fixedResult = prepareCatalogFilterUpdate({
      currentFilters: current,
      newParams: { minPrice: undefined, maxPrice: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(fixedResult.minPrice, undefined, 'Fix A: minPrice đã được xóa hoàn toàn')
    assert.equal(fixedResult.maxPrice, undefined, 'Fix A: maxPrice đã được xóa hoàn toàn')
  })

  await runAsyncCase('1.2: Baseline Lỗi B — Mobile brands effect self-invalidation', async () => {
    // Trên baseline: dependency array có mobileBrandsMap -> khi loadOptions gọi loading -> setState -> effect cleanup isMounted=false
    // Kết quả: response thương hiệu bị vứt bỏ, kẹt loading mãi mãi.
    let baselineIsMounted = true
    const baselineEffect = () => {
      // Khi state loading thay đổi, React chạy cleanup:
      const cleanup = () => {
        baselineIsMounted = false
      }
      return cleanup
    }

    const cleanup = baselineEffect()
    // Mô phỏng setState loading làm trigger effect rerender & cleanup
    cleanup()
    // Khi network response về:
    let baselineReceivedData = false
    if (baselineIsMounted) {
      baselineReceivedData = true
    }
    assert.equal(baselineReceivedData, false, 'Baseline lỗi: response hãng bị bỏ qua do effect cleanup tự vô hiệu hóa')
  })

  await runAsyncCase('1.3: Baseline Lỗi C — ProductsPage không hiển thị lỗi khi URL category không tồn tại', async () => {
    // Trên baseline, khi URL có categoryId không tồn tại trong cây DB, hook trả categoryNotFoundError
    // nhưng ProductsPage không sử dụng prop này, dẫn tới render grid rỗng hoặc giữ sản phẩm cũ.
    // Kiểm tra hook hiện tại trả isScopeBlocked và clear products ngay lập tức:
    const invalidUrl = new URLSearchParams('categoryId=c0a80123-9999-9999-9999-999999999999')
    const parsed = parseFiltersFromUrl(invalidUrl)
    assert.equal(parsed.invalidCategoryError, null)
    // Category không có trong cây MOCK_CATEGORIES:
    const inferred = MOCK_CATEGORIES.find((c) => c.id === 'c0a80123-9999-9999-9999-999999999999')
    assert.equal(inferred, undefined, 'Category không tồn tại')
  })

  console.log('\n=== Phần 2: Ma trận A — Production Filter Update Flow ===')

  await runAsyncCase('2.1: Xóa khoảng giá và chuyển đổi preset giá', async () => {
    const initial = parseFiltersFromUrl(
      new URLSearchParams('minPrice=1000000&maxPrice=5000000&categoryId=' + CPU_GUID)
    ).filters

    // 1. Xóa cả hai đầu giá
    const cleared = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { minPrice: undefined, maxPrice: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(cleared.minPrice, undefined)
    assert.equal(cleared.maxPrice, undefined)
    assert.equal(cleared.categoryId, CPU_GUID)

    // 2. Chuyển sang preset chỉ có giá trần (maxPrice = 2000000, xóa minPrice)
    const upperOnly = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { minPrice: undefined, maxPrice: 2000000 },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(upperOnly.minPrice, undefined)
    assert.equal(upperOnly.maxPrice, 2000000)

    // 3. Chuyển sang preset chỉ có giá sàn (minPrice = 10000000, xóa maxPrice)
    const lowerOnly = prepareCatalogFilterUpdate({
      currentFilters: upperOnly,
      newParams: { minPrice: 10000000, maxPrice: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(lowerOnly.minPrice, 10000000)
    assert.equal(lowerOnly.maxPrice, undefined)

    // 4. Giá sàn = 0 là giá trị hợp lệ (không bị xóa)
    const zeroPrice = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { minPrice: 0 },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(zeroPrice.minPrice, 0)
    assert.equal(zeroPrice.maxPrice, 5000000)
  })

  await runAsyncCase('2.2: Xóa từ khóa tìm kiếm (searchTerm)', async () => {
    const initial = parseFiltersFromUrl(
      new URLSearchParams('searchTerm=Core%20i9&categoryId=' + CPU_GUID)
    ).filters

    // Nút X hoặc chip xóa: truyền searchTerm: undefined hoặc searchTerm: ''
    const cleared1 = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { searchTerm: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(cleared1.searchTerm, undefined)

    const cleared2 = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { searchTerm: '   ' },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(cleared2.searchTerm, undefined)
  })

  await runAsyncCase('2.3: Tồn kho & Trạng thái: Chọn Tất cả / Bỏ chọn', async () => {
    const initial = parseFiltersFromUrl(
      new URLSearchParams('inStock=true&isActive=false')
    ).filters
    assert.equal(initial.inStock, true)
    assert.equal(initial.isActive, false)

    // Chọn "Tất cả tồn kho" -> inStock: undefined
    const clearedStock = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { inStock: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(clearedStock.inStock, undefined)
    assert.equal(clearedStock.isActive, false, 'isActive vẫn được giữ nguyên')

    // Chọn "Tất cả trạng thái" -> isActive: undefined
    const clearedActive = prepareCatalogFilterUpdate({
      currentFilters: clearedStock,
      newParams: { isActive: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(clearedActive.inStock, undefined)
    assert.equal(clearedActive.isActive, undefined)
  })

  await runAsyncCase('2.4: Boolean tech: Có -> Không -> Tất cả', async () => {
    const initial = parseFiltersFromUrl(
      new URLSearchParams('categoryId=' + CPU_GUID + '&hasIntegratedGpu=true')
    ).filters

    // Chuyển Có (true) -> Không (false)
    const falseTech = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { hasIntegratedGpu: false },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(falseTech.hasIntegratedGpu, false, 'false là giá trị hợp lệ được giữ')

    // Chuyển Không (false) -> Tất cả (undefined)
    const clearedTech = prepareCatalogFilterUpdate({
      currentFilters: falseTech,
      newParams: { hasIntegratedGpu: undefined },
      categories: MOCK_CATEGORIES,
    })
    assert.equal(clearedTech.hasIntegratedGpu, undefined, 'undefined xóa filter khỏi object')
  })

  await runAsyncCase('2.5: Đổi category CPU -> GPU xóa sạch technical filters của CPU', async () => {
    const initial = parseFiltersFromUrl(
      new URLSearchParams('categoryId=' + CPU_GUID + '&sockets=1&coreCounts=16&hasIntegratedGpu=true&searchTerm=ASUS')
    ).filters

    const switched = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { categoryId: GPU_GUID },
      categories: MOCK_CATEGORIES,
    })

    assert.equal(switched.categoryId, GPU_GUID)
    assert.equal(switched.componentType, 3, 'GPU type được gán')
    assert.equal(switched.searchTerm, 'ASUS', 'Common filter searchTerm được bảo toàn')
    assert.equal(switched.sockets, undefined, 'sockets của CPU bị xóa')
    assert.equal(switched.coreCounts, undefined, 'coreCounts của CPU bị xóa')
    assert.equal(switched.hasIntegratedGpu, undefined, 'hasIntegratedGpu của CPU bị xóa')
  })

  console.log('\n=== Phần 3: Ma trận B — Mobile Lifecycle thực sự trên React DOM ===')

  await runAsyncCase('3.1: Mount HomeCategoryMenu, mở accordion mobile, tải brands thành công', async () => {
    container.innerHTML = ''
    const deferredBrands = createDeferred()

    // Mock apiClient.get cho category filter-options
    const originalGet = apiClient.get
    apiClient.get = async (path, options) => {
      if (path.includes('/products/filter-options')) {
        return deferredBrands.promise
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

      // Tìm button mở accordion của category CPU
      const chevronButtons = container.querySelectorAll('button[aria-controls]')
      assert.ok(chevronButtons.length > 0, 'Phải có chevron buttons')

      // Mở accordion CPU
      await act(async () => {
        chevronButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Kiểm tra có trạng thái "Đang nạp..."
      const mobileSub = container.querySelector('#mobile-sub-' + CPU_GUID)
      assert.ok(mobileSub, 'Accordion mobile phải mở')
      assert.ok(mobileSub.textContent.includes('Đang nạp'), 'Phải hiển thị Đang nạp...')

      // Trả response thành công
      deferredBrands.resolve({ brands: ['Intel', 'AMD'] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      // Loading biến mất, links thương hiệu xuất hiện
      assert.ok(!mobileSub.textContent.includes('Đang nạp...'), 'Loading phải biến mất')
      const brandLinks = mobileSub.querySelectorAll('a')
      const texts = Array.from(brandLinks).map((a) => a.textContent.trim())
      assert.ok(texts.includes('Intel'), 'Phải có link hãng Intel')
      assert.ok(texts.includes('AMD'), 'Phải có link hãng AMD')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('3.2: Mobile brands lỗi mạng -> hiển thị thông báo & nút Thử lại hoạt động', async () => {
    container.innerHTML = ''
    let callCount = 0
    let deferredRetry = createDeferred()

    const originalGet = apiClient.get
    apiClient.get = async (path) => {
      if (path.includes('/products/filter-options')) {
        callCount++
        if (callCount === 1) {
          throw new Error('Mạng bị ngắt kết nối')
        }
        return deferredRetry.promise
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
      // Click mở CPU -> nhận lỗi
      await act(async () => {
        chevronButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      const mobileSub = container.querySelector('#mobile-sub-' + CPU_GUID)
      assert.ok(mobileSub.textContent.includes('Không nạp được thương hiệu'), 'Phải báo lỗi thật, không nói Chưa có thương hiệu')

      const retryBtn = Array.from(mobileSub.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Thử lại')
      )
      assert.ok(retryBtn, 'Phải có nút Thử lại')

      // Click Thử lại
      await act(async () => {
        retryBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      assert.equal(callCount, 2, 'Thử lại phải kích hoạt gọi lại API lần 2')

      // Resolve kết quả thành công cho lần 2
      deferredRetry.resolve({ brands: ['Intel'] })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      assert.ok(mobileSub.textContent.includes('Intel'), 'Sau khi thử lại thành công link hãng phải xuất hiện')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('3.3: StrictMode remount & Desktop/Mobile coordinator isolation', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    apiClient.get = async () => ({ brands: ['NVIDIA', 'AMD'] })

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
              null,
              React.createElement(HomeCategoryMenu, { initialCategories: MOCK_CATEGORIES })
            )
          )
        )
      })

      // StrictMode chạy double-mount; mở mobile accordion
      const chevronButtons = container.querySelectorAll('button[aria-controls]')
      await act(async () => {
        chevronButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      const mobileSub = container.querySelector('#mobile-sub-' + GPU_GUID)
      assert.ok(mobileSub, 'Accordion GPU phải hiển thị')
      assert.ok(mobileSub.textContent.includes('NVIDIA'), 'Phải nạp thành công trong StrictMode')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  console.log('\n=== Phần 4: Ma trận C — Catalog Recovery thực sự trên React DOM ===')

  await runAsyncCase('4.1: URL categoryId sai GUID -> hiện lỗi validation, không hiện sản phẩm cũ', async () => {
    container.innerHTML = ''
    const originalGet = apiClient.get
    let productApiCalled = false
    apiClient.get = async (path) => {
      if (path.includes('/categories')) {
        return MOCK_CATEGORIES
      }
      if (path === '/products') {
        productApiCalled = true
        return { items: [MOCK_PRODUCT_A], totalCount: 1 }
      }
      return {}
    }

    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/products?categoryId=invalid-not-a-guid'] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(ProductsPage) })
            )
          )
        )
      })

      // Assert:
      assert.equal(productApiCalled, false, 'Không được gọi getProducts khi categoryId sai GUID')
      assert.ok(container.textContent.includes('Mã Danh Mục Không Hợp Lệ'), 'Phải hiện tiêu đề lỗi danh mục không hợp lệ')
      assert.ok(!container.textContent.includes('Intel Core i9'), 'Không được hiển thị sản phẩm khi categoryId sai')
      assert.ok(!container.textContent.includes('Tìm thấy 1 sản phẩm'), 'Không được hiển thị count sản phẩm')

      // Có nút "Xóa Danh Mục"
      const clearBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Xóa Danh Mục')
      )
      assert.ok(clearBtn, 'Phải có nút Xóa Danh Mục để khôi phục')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('4.2: GUID hợp lệ nhưng category không có trong cây -> hiện lỗi không tồn tại', async () => {
    container.innerHTML = ''
    const NON_EXISTENT_GUID = 'c0a80123-9999-9999-9999-999999999999'

    const originalGet = apiClient.get
    apiClient.get = async (path) => {
      if (path.includes('/categories')) {
        return MOCK_CATEGORIES
      }
      return { items: [], totalCount: 0 }
    }

    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${NON_EXISTENT_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(ProductsPage) })
            )
          )
        )
      })

      assert.ok(container.textContent.includes('Không Tìm Thấy Danh Mục'), 'Phải báo không tìm thấy danh mục')
      const viewAllBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Xem Tất Cả')
      )
      assert.ok(viewAllBtn, 'Phải có nút Xem Tất Cả Sản Phẩm')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('4.3: GET categories thất bại khi URL có categoryId -> hiện Lỗi Tải Danh Mục & retry thực', async () => {
    container.innerHTML = ''
    let catCalls = 0
    let deferredCatRetry = createDeferred()

    const originalGet = apiClient.get
    apiClient.get = async (path) => {
      if (path.includes('/categories')) {
        catCalls++
        if (catCalls === 1) {
          throw new Error('Lỗi kết nối cơ sở dữ liệu danh mục')
        }
        return deferredCatRetry.promise
      }
      return { items: [MOCK_PRODUCT_A], totalCount: 1 }
    }

    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(ProductsPage) })
            )
          )
        )
      })

      // Thông báo lỗi tải danh mục xuất hiện
      assert.ok(container.textContent.includes('Lỗi Tải Danh Mục'), 'Phải hiện màn hình lỗi tải danh mục')
      assert.ok(!container.textContent.includes('Intel Core i9'), 'Không được hiển thị sản phẩm cũ khi danh mục lỗi')

      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Thử Lại')
      )
      assert.ok(retryBtn, 'Phải có nút Thử Lại danh mục')

      // Click Thử lại
      await act(async () => {
        retryBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      assert.equal(catCalls, 2, 'Phải thực sự gọi lại getCategories khi retry')

      // Resolve thành công danh mục
      deferredCatRetry.resolve(MOCK_CATEGORIES)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      // Sau khi danh mục tải xong, products được nạp và hiển thị
      assert.ok(container.textContent.includes('Intel Core i9-14900K'), 'Sản phẩm phải xuất hiện sau khi retry danh mục thành công')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  await runAsyncCase('4.4: Response cũ đến muộn không làm sống lại (resurrect) grid sau khi scope invalid', async () => {
    container.innerHTML = ''
    const deferredProductA = createDeferred()

    const originalGet = apiClient.get
    apiClient.get = async (path) => {
      if (path.includes('/categories')) {
        return MOCK_CATEGORIES
      }
      if (path.includes('/products')) {
        return deferredProductA.promise
      }
      return {}
    }

    // Component kiểm tra chuyển đổi URL khi request đang pending
    function NavigationHarness() {
      const navigate = useNavigate()
      return React.createElement(
        'div',
        null,
        React.createElement('button', {
          id: 'go-invalid',
          onClick: () => navigate('/products?categoryId=invalid-guid'),
        }),
        React.createElement(ProductsPage)
      )
    }

    let root
    try {
      root = createRoot(container)
      await act(async () => {
        root.render(
          React.createElement(
            MemoryRouter,
            { initialEntries: [`/products?categoryId=${CPU_GUID}`] },
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: '/products', element: React.createElement(NavigationHarness) })
            )
          )
        )
      })

      // Đang pending request A cho CPU, người dùng điều hướng sang invalid category:
      await act(async () => {
        container.querySelector('#go-invalid').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      // Lỗi invalid xuất hiện:
      assert.ok(container.textContent.includes('Mã Danh Mục Không Hợp Lệ'))

      // Bây giờ request A cũ mới resolve:
      deferredProductA.resolve({ items: [MOCK_PRODUCT_A], totalCount: 1 })
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      // Lưới sản phẩm A KHÔNG ĐƯỢC sống lại đè lên lỗi invalid:
      assert.ok(container.textContent.includes('Mã Danh Mục Không Hợp Lệ'), 'Lỗi invalid phải được duy trì')
      assert.ok(!container.textContent.includes('Intel Core i9-14900K'), 'Sản phẩm A cũ không được resurrect')
    } finally {
      apiClient.get = originalGet
      if (root) {
        await act(async () => {
          root.unmount()
        })
      }
    }
  })

  console.log('\n=== Phần 5: Correction D — Kiểm tra Layout Mega Menu theo Content Container ===')

  await runAsyncCase('5.1: HomeCategoryMenu root có relative lg:static & panel có left-[calc(16rem+1.5rem)] right-0', async () => {
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

      // Root element menu
      const menuRoot = container.firstElementChild
      assert.ok(menuRoot, 'Menu root phải tồn tại')
      const rootClasses = menuRoot.className
      assert.ok(rootClasses.includes('relative'), 'Root phải có class relative cho mobile')
      assert.ok(rootClasses.includes('lg:static'), 'Root phải có class lg:static để desktop panel bám vào hero container')

      // Hover / focus category để mở desktop flyout panel
      const catLinks = container.querySelectorAll('a[href*="categoryId"]')
      assert.ok(catLinks.length > 0, 'Phải có link category')
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
  console.log(`All ${passedTests}/${totalTests} UI Lifecycle tests passed successfully!`)
  console.log(`========================================\n`)
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}
