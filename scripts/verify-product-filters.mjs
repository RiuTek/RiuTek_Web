import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'riutek-product-filters-verify-')
)

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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
  'src/features/products/productApi.ts',
  'src/features/products/productFilterHelper.ts',
  'src/features/pcBuilder/pcBuilderTypes.ts',
  'src/features/pcBuilder/pcBuilderConstants.ts',
]

try {
  for (const relPath of filesToCompile) {
    const srcPath = path.join(repoRoot, relPath)
    const raw = fs.readFileSync(srcPath, 'utf8')
    const transpiled = ts.transpileModule(raw, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
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

  // Import transpiled modules
  const { apiClient } = await import(
    pathToFileURL(path.join(tempRoot, 'src/lib/api/apiClient.mjs')).href
  )
  const {
    getProducts,
  } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/products/productApi.mjs')).href
  )
  const {
    PRICE_PRESETS,
    getGroupTitle,
    formatChoiceLabel,
    parseFiltersFromUrl,
    inferComponentTypeFromCategory,
    buildProductFilterSearchParams,
    computeCanonicalQueryKey,
    ProductFilterOptionsCoordinator,
    toggleArrayFilterChoice,
    prepareProductQueryParams,
    prepareCatalogFilterUpdate,
  } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/products/productFilterHelper.mjs')).href
  )
  const {
    getSlotApplicableTechnicalFilters,
  } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/pcBuilder/pcBuilderConstants.mjs')).href
  )

  let passedTests = 0
  let totalTests = 0

  function runCase(name, fn) {
    totalTests++
    try {
      fn()
      console.log(`[PASS] ${name}`)
      passedTests++
    } catch (err) {
      console.error(`[FAIL] ${name}`)
      console.error(err)
      throw err
    }
  }

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

  const VALID_CPU_CAT_GUID = 'c0a80123-0000-0000-0000-000000000001'
  const VALID_GPU_CAT_GUID = 'c0a80123-0000-0000-0000-000000000002'
  const VALID_RAM_CAT_GUID = 'c0a80123-0000-0000-0000-000000000003'

  console.log('\n=== Test Suite 1: Correction 1 — Category Infer & ComponentType Request ===')

  await runAsyncCase('1.1: Category-only CPU GUID + socket: getProducts receives both categoryId & componentType', async () => {
    let capturedUrl = null
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (url) => {
        capturedUrl = url.toString()
        return new Response(
          JSON.stringify({
            items: [],
            totalCount: 1,
            pageIndex: 1,
            pageSize: 20,
            totalPages: 1,
            hasPreviousPage: false,
            hasNextPage: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const mockCategories = [
        { id: VALID_CPU_CAT_GUID, name: 'Bộ vi xử lý CPU', slug: 'cpu', componentType: 1, subCategories: [] },
      ]

      // URL only had categoryId & sockets (no componentType)
      const urlParams = new URLSearchParams()
      urlParams.set('categoryId', VALID_CPU_CAT_GUID)
      urlParams.append('sockets', '1')

      const { filters } = parseFiltersFromUrl(urlParams)
      assert.equal(filters.categoryId, VALID_CPU_CAT_GUID)
      assert.equal(filters.componentType, undefined) // Not in URL

      // Production flow resolves type and prepares query params
      const inferredType = inferComponentTypeFromCategory(mockCategories, filters.categoryId)
      assert.equal(inferredType, 1) // Inferred CPU (1)

      const queryParams = prepareProductQueryParams(filters, inferredType)
      assert.equal(queryParams.componentType, 1) // Crucial: explicitly assigned!
      assert.equal(queryParams.categoryId, VALID_CPU_CAT_GUID)
      assert.deepEqual(queryParams.sockets, [1])

      await getProducts(queryParams)

      assert.ok(capturedUrl.includes(`categoryId=${VALID_CPU_CAT_GUID}`))
      assert.ok(capturedUrl.includes('componentType=1'))
      assert.ok(capturedUrl.includes('sockets=1'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  runCase('1.2: Category inference takes precedence over mismatched legacy type in URL', () => {
    const mockCategories = [
      { id: VALID_GPU_CAT_GUID, name: 'Card màn hình', slug: 'vga', componentType: 3, subCategories: [] },
    ]
    // URL has conflicting legacy componentType=1 (CPU) but categoryId is GPU
    const urlParams = new URLSearchParams()
    urlParams.set('categoryId', VALID_GPU_CAT_GUID)
    urlParams.set('componentType', '1') // CPU
    urlParams.append('vramGbs', '12')
    urlParams.append('sockets', '1') // Not applicable to GPU

    const { filters } = parseFiltersFromUrl(urlParams)
    const inferred = inferComponentTypeFromCategory(mockCategories, filters.categoryId)
    assert.equal(inferred, 3) // GPU wins

    const queryParams = prepareProductQueryParams(filters, inferred)
    assert.equal(queryParams.componentType, 3)
    assert.deepEqual(queryParams.vramGbs, [12])
    assert.equal(queryParams.sockets, undefined) // CPU sockets cleaned out!
  })

  console.log('\n=== Test Suite 2: Categories Deferred, Loading & Invalid Category Validation ===')

  runCase('2.1: Strict GUID validation rejects malformed categoryId and sets error', () => {
    const searchParams = new URLSearchParams()
    searchParams.set('categoryId', 'not-a-valid-guid-123')
    const { filters, invalidCategoryError } = parseFiltersFromUrl(searchParams)

    assert.equal(filters.categoryId, '')
    assert.ok(invalidCategoryError !== null)
    assert.ok(invalidCategoryError.includes('GUID'))
  })

  runCase('2.2: Category not found in DB categories tree is detected', () => {
    const mockCategories = [
      { id: VALID_CPU_CAT_GUID, name: 'CPU', slug: 'cpu', componentType: 1, subCategories: [] },
    ]
    const nonExistentGuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    const foundType = inferComponentTypeFromCategory(mockCategories, nonExistentGuid)
    assert.equal(foundType, undefined)
  })

  console.log('\n=== Test Suite 3: Single-Select Checkbox & Transition State Updates ===')

  runCase('3.1: Ticking Category B replaces Category A (single-select checkbox)', () => {
    const mockCategories = [
      { id: VALID_CPU_CAT_GUID, name: 'CPU', slug: 'cpu', componentType: 1, subCategories: [] },
      { id: VALID_GPU_CAT_GUID, name: 'GPU', slug: 'gpu', componentType: 3, subCategories: [] },
    ]

    const initial = parseFiltersFromUrl(
      new URLSearchParams(`categoryId=${VALID_CPU_CAT_GUID}&sockets=1&brands=Intel&minPrice=1000`)
    ).filters

    // User ticks Category B
    const updated = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { categoryId: VALID_GPU_CAT_GUID },
      categories: mockCategories,
    })

    assert.equal(updated.categoryId, VALID_GPU_CAT_GUID)
    assert.equal(updated.componentType, 3) // Switched to GPU
    assert.equal(updated.sockets, undefined) // CPU sockets stripped!
    assert.deepEqual(updated.brands, ['Intel']) // Common filters kept
    assert.equal(updated.minPrice, 1000)
    assert.equal(updated.pageIndex, 1) // Page reset to 1
  })

  runCase('3.2: Ticking selected category again unchecks it and clears category-derived type', () => {
    const mockCategories = [
      { id: VALID_CPU_CAT_GUID, name: 'CPU', slug: 'cpu', componentType: 1, subCategories: [] },
    ]

    const initial = parseFiltersFromUrl(
      new URLSearchParams(`categoryId=${VALID_CPU_CAT_GUID}&sockets=1&brands=Intel`)
    ).filters

    // User unchecks category (categoryId: undefined)
    const updated = prepareCatalogFilterUpdate({
      currentFilters: initial,
      newParams: { categoryId: undefined },
      categories: mockCategories,
    })

    assert.equal(updated.categoryId, undefined)
    assert.equal(updated.componentType, undefined) // Type derived from category is cleared!
    assert.equal(updated.sockets, undefined) // Technical filters cleared
    assert.deepEqual(updated.brands, ['Intel']) // Brand preserved
    assert.equal(updated.pageIndex, 1)
  })

  runCase('3.3: Type-only legacy link without category preserves explicit type', () => {
    const initial = parseFiltersFromUrl(
      new URLSearchParams('componentType=1&sockets=1&brands=AMD')
    ).filters

    assert.equal(initial.categoryId, '')
    assert.equal(initial.componentType, 1)
    assert.deepEqual(initial.sockets, [1])

    const queryParams = prepareProductQueryParams(initial, initial.componentType)
    assert.equal(queryParams.componentType, 1)
    assert.deepEqual(queryParams.sockets, [1])
  })

  console.log('\n=== Test Suite 4: URL Roundtrip & Invariants ===')

  runCase('4.1: URL roundtrip maintains identical query parameters with valid GUID', () => {
    const original = {
      categoryId: VALID_RAM_CAT_GUID,
      componentType: 4, // RAM
      brands: ['Corsair', 'Kingston'],
      memoryTypes: [1, 2], // DDR4 (1), DDR5 (2)
      ramCapacitiesGb: [16, 32],
      ramSpeedsMhz: [3200, 6000],
      hasRgb: true,
      minPrice: 500000,
      maxPrice: 3000000,
      sortBy: 2,
      pageIndex: 2,
      pageSize: 20,
    }
    const urlParams = buildProductFilterSearchParams(original, false)
    const { filters: parsed } = parseFiltersFromUrl(urlParams)

    assert.equal(parsed.categoryId, original.categoryId)
    assert.equal(parsed.componentType, original.componentType)
    assert.deepEqual(parsed.brands, original.brands)
    assert.deepEqual(parsed.memoryTypes, original.memoryTypes)
    assert.deepEqual(parsed.ramCapacitiesGb, original.ramCapacitiesGb)
    assert.deepEqual(parsed.ramSpeedsMhz, original.ramSpeedsMhz)
    assert.equal(parsed.hasRgb, original.hasRgb)
    assert.equal(parsed.minPrice, original.minPrice)
    assert.equal(parsed.maxPrice, original.maxPrice)
    assert.equal(parsed.sortBy, original.sortBy)
    assert.equal(parsed.pageIndex, original.pageIndex)
    assert.equal(parsed.pageSize, original.pageSize)
  })

  console.log('\n=== Test Suite 5: Correction 2 — Modal & Catalog Max 20 Limit, Deduplication & Reject Boundary ===')

  runCase('5.1: toggleArrayFilterChoice allows up to 20, rejects 21st with warning, supports remove/add', () => {
    let current = Array.from({ length: 19 }, (_, i) => `Brand${i + 1}`)

    // 1. Add 20th item
    const res20 = toggleArrayFilterChoice(current, 'Brand20', 20)
    assert.equal(res20.isAdded, true)
    assert.equal(res20.isRejected, false)
    assert.equal(res20.nextValues.length, 20)
    current = res20.nextValues

    // 2. Try to add 21st item -> REJECTED!
    const res21 = toggleArrayFilterChoice(current, 'Brand21', 20)
    assert.equal(res21.isAdded, false)
    assert.equal(res21.isRejected, true)
    assert.ok(res21.warning !== null)
    assert.equal(res21.nextValues.length, 20) // Unchanged!

    // 3. Uncheck 1 item -> 19 items
    const resRemove = toggleArrayFilterChoice(current, 'Brand1', 20)
    assert.equal(resRemove.isRemoved, true)
    assert.equal(resRemove.nextValues.length, 19)
    current = resRemove.nextValues

    // 4. Add another item -> 20 items again
    const resAddAgain = toggleArrayFilterChoice(current, 'Brand21', 20)
    assert.equal(resAddAgain.isAdded, true)
    assert.equal(resAddAgain.nextValues.length, 20)
  })

  runCase('5.2: Brand case-insensitive deduplication and whitespace trimming', () => {
    const list = ['ASUS', 'Gigabyte']
    const resDuplicate = toggleArrayFilterChoice(list, '  asus  ', 20)
    // Toggling existing case-insensitive item removes it
    assert.equal(resDuplicate.isRemoved, true)
    assert.deepEqual(resDuplicate.nextValues, ['Gigabyte'])

    // Adding fresh item trims whitespace
    const resAdd = toggleArrayFilterChoice(resDuplicate.nextValues, '  MSI  ', 20)
    assert.equal(resAdd.isAdded, true)
    assert.deepEqual(resAdd.nextValues, ['Gigabyte', 'MSI'])
  })

  runCase('5.3: buildProductFilterSearchParams rejects >20 items without silent truncation', () => {
    const twentyOne = Array.from({ length: 21 }, (_, i) => i + 1)
    assert.throws(
      () => {
        buildProductFilterSearchParams({ sockets: twentyOne })
      },
      /vượt quá giới hạn tối đa/
    )
  })

  await runAsyncCase('5.4: getProducts adapter rejects >20 items without silent truncation', async () => {
    const twentyOne = Array.from({ length: 21 }, (_, i) => i + 1)
    await assert.rejects(
      async () => {
        await getProducts({ sockets: twentyOne })
      },
      /vượt quá giới hạn tối đa/
    )
  })

  console.log('\n=== Test Suite 6: Options Coordinator Race Condition & Sequence Guard ===')

  await runAsyncCase('6.1: Deferred A/B out-of-order: Response B then A maintains B as active state', async () => {
    const coordinator = new ProductFilterOptionsCoordinator()
    const defA = createDeferred()
    const defB = createDeferred()

    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (url) => {
        const urlStr = url.toString()
        if (urlStr.includes('componentType=1')) return defA.promise
        if (urlStr.includes('componentType=3')) return defB.promise
        return new Response(JSON.stringify({ brands: [], groups: [] }))
      }

      let activeResult = null
      let activeScope = null

      const promiseA = coordinator.loadOptions(
        { componentType: 1, categoryId: VALID_CPU_CAT_GUID },
        (data) => {
          activeResult = data
          activeScope = 'A'
        },
        () => {},
        () => {}
      )

      const promiseB = coordinator.loadOptions(
        { componentType: 3, categoryId: VALID_GPU_CAT_GUID },
        (data) => {
          activeResult = data
          activeScope = 'B'
        },
        () => {},
        () => {}
      )

      // B resolves first
      defB.resolve(
        new Response(
          JSON.stringify({ brands: ['NVIDIA', 'ASUS'], groups: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      await promiseB
      assert.equal(activeScope, 'B')
      assert.deepEqual(activeResult.brands, ['NVIDIA', 'ASUS'])

      // A resolves later
      defA.resolve(
        new Response(
          JSON.stringify({ brands: ['Intel', 'AMD'], groups: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      await promiseA

      // Stale A must NOT overwrite B!
      assert.equal(activeScope, 'B')
      assert.deepEqual(activeResult.brands, ['NVIDIA', 'ASUS'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await runAsyncCase('6.2: Scope error on stale request A does not clobber newer scope B', async () => {
    const coordinator = new ProductFilterOptionsCoordinator()
    const defA = createDeferred()
    const defB = createDeferred()

    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (url) => {
        const urlStr = url.toString()
        if (urlStr.includes('componentType=1')) return defA.promise
        return defB.promise
      }

      let activeScope = 'none'
      let errorMessage = null

      const promiseA = coordinator.loadOptions(
        { componentType: 1 },
        () => { activeScope = 'A' },
        (err) => { errorMessage = err.message },
        () => {}
      )

      const promiseB = coordinator.loadOptions(
        { componentType: 3 },
        () => { activeScope = 'B' },
        () => {},
        () => {}
      )

      // B resolves successfully
      defB.resolve(
        new Response(
          JSON.stringify({ brands: ['MSI'], groups: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      await promiseB
      assert.equal(activeScope, 'B')

      // A rejects with network error
      defA.reject(new Error('Network error on A'))
      await promiseA

      // Error from stale request A should NOT trigger onError for the current active scope
      assert.equal(activeScope, 'B')
      assert.equal(errorMessage, null)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  console.log('\n=== Test Suite 7: Correction 3 — Homepage Mega Menu & Mobile Brands Shortcuts ===')

  runCase('7.1: Menu filter-options scope does not inject implicit isActive or inStock', () => {
    const coordinator = new ProductFilterOptionsCoordinator()
    const scope = {
      componentType: 1,
      categoryId: VALID_CPU_CAT_GUID,
    }
    const scopeKey = coordinator.getScopeKey(scope)
    // Scope key format: componentType:categoryId:isActive:inStock
    assert.equal(scopeKey, `1:${VALID_CPU_CAT_GUID}::`)
    assert.ok(!scopeKey.includes('true'))
  })

  runCase('7.2: Homepage brand shortcuts URL includes categoryId, componentType & brands', () => {
    const searchParams = buildProductFilterSearchParams({
      categoryId: VALID_CPU_CAT_GUID,
      componentType: 1,
      brands: ['Intel'],
    })
    assert.equal(searchParams.get('categoryId'), VALID_CPU_CAT_GUID)
    assert.equal(searchParams.get('componentType'), '1')
    assert.deepEqual(searchParams.getAll('brands'), ['Intel'])
  })

  console.log('\n=== Test Suite 8: Regressions — API URL Builder, Encodings, Booleans & False/0 ===')

  runCase('8.1: Boolean false and price 0 are preserved in URL searchParams', () => {
    const searchParams = buildProductFilterSearchParams({
      hasWifi: false,
      hasIntegratedGpu: false,
      minPrice: 0,
      maxPrice: 1000000,
    })
    assert.equal(searchParams.get('hasWifi'), 'false')
    assert.equal(searchParams.get('hasIntegratedGpu'), 'false')
    assert.equal(searchParams.get('minPrice'), '0')
    assert.equal(searchParams.get('maxPrice'), '1000000')
  })

  await runAsyncCase('8.2: Special characters (&, +, spaces) in brand names are URL encoded', async () => {
    let requestedUrl = null
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (url) => {
        requestedUrl = url.toString()
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      await apiClient.get('/products', {
        params: {
          brands: ['ASUS & ROG', 'G.Skill+Co'],
        },
      })

      assert.ok(requestedUrl.includes('brands=ASUS+%26+ROG') || requestedUrl.includes('brands=ASUS%20%26%20ROG'))
      assert.ok(requestedUrl.includes('brands=G.Skill%2BCo'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  runCase('8.3: PCBuilder slot technical filters alignment', () => {
    const testFilters = {
      brands: ['Intel'],
      sockets: [1],
      vramGbs: [12],
    }
    const cpuSlotFilters = getSlotApplicableTechnicalFilters(1, testFilters)
    assert.deepEqual(cpuSlotFilters.sockets, [1])
    assert.equal(cpuSlotFilters.vramGbs, undefined)

    const gpuSlotFilters = getSlotApplicableTechnicalFilters(3, testFilters)
    assert.equal(gpuSlotFilters.sockets, undefined)
    assert.deepEqual(gpuSlotFilters.vramGbs, [12])
  })

  runCase('8.4: getGroupTitle labels match plan specifications', () => {
    assert.equal(getGroupTitle('sockets', 1), 'Socket')
    assert.equal(getGroupTitle('sockets', 8), 'Socket hỗ trợ')
    assert.equal(getGroupTitle('motherboardFormFactors', 7), 'Kích thước main hỗ trợ')
    assert.equal(getGroupTitle('memoryTypes', 2), 'Loại RAM hỗ trợ')
  })

  runCase('8.5: Price presets format and values', () => {
    assert.ok(PRICE_PRESETS.length >= 5)
    for (const preset of PRICE_PRESETS) {
      assert.ok(typeof preset.id === 'string')
      assert.ok(typeof preset.label === 'string')
      if (preset.minPrice !== undefined && preset.maxPrice !== undefined) {
        assert.ok(preset.minPrice < preset.maxPrice)
      }
    }
  })

  runCase('8.6: Inverted price min > max validation', () => {
    const searchParams = new URLSearchParams()
    searchParams.set('minPrice', '5000000')
    searchParams.set('maxPrice', '1000000')
    const { priceError } = parseFiltersFromUrl(searchParams)
    assert.ok(priceError !== null)
    assert.ok(priceError.includes('lớn hơn hoặc bằng'))
  })

  console.log('\n=== Static Invariant Audits ===')

  runCase('Audit 1: ProductFilters hides ComponentType and renders native checkbox category tree', () => {
    const filtersSrc = fs.readFileSync(
      path.join(repoRoot, 'src/features/products/components/ProductFilters.tsx'),
      'utf8'
    )
    assert.ok(!filtersSrc.includes('Loại linh kiện</span>'), 'Must hide ComponentType group label')
    assert.ok(filtersSrc.includes('type="checkbox"'), 'Must render checkbox inputs')
    assert.ok(filtersSrc.includes('Chọn một mục'), 'Must show single select hint')
    assert.ok(filtersSrc.includes('Tất cả danh mục'), 'Must render All Categories option')
  })

  runCase('Audit 2: HomeCategoryMenu does not render technical specs and has accessible IDs', () => {
    const homeMenuSrc = fs.readFileSync(
      path.join(repoRoot, 'src/features/products/components/HomeCategoryMenu.tsx'),
      'utf8'
    )
    assert.ok(!homeMenuSrc.includes('TECHNICAL_GROUPS_BY_TYPE'), 'Must not render specs shortcuts on homepage')
    assert.ok(homeMenuSrc.includes('aria-expanded'), 'Must have aria-expanded')
    assert.ok(homeMenuSrc.includes('aria-controls'), 'Must have aria-controls')
    assert.ok(homeMenuSrc.includes('desktop-category-flyout-panel'), 'Must have flyout panel id')
  })

  runCase('Audit 3: PCBuilderProductPickerModal uses toggleArrayFilterChoice with 20 limit', () => {
    const modalSrc = fs.readFileSync(
      path.join(repoRoot, 'src/features/pcBuilder/components/PCBuilderProductPickerModal.tsx'),
      'utf8'
    )
    assert.ok(modalSrc.includes('toggleArrayFilterChoice'), 'Must use shared toggleArrayFilterChoice')
    assert.ok(modalSrc.includes('limitWarning'), 'Must track limitWarning')
  })

  console.log(`\n========================================`)
  console.log(`All ${passedTests}/${totalTests} Product Filters tests passed!`)
  console.log(`========================================\n`)
} finally {
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  } catch {
    // Ignore temp cleanup errors
  }
}
