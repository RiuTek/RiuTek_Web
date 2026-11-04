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
    getProductFilterOptions,
  } = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/products/productApi.mjs')).href
  )
  const {
    TECHNICAL_GROUPS_BY_TYPE,
    PRICE_PRESETS,
    getGroupTitle,
    formatChoiceLabel,
    parseFiltersFromUrl,
    filterApplicableTechnicalFilters,
    inferComponentTypeFromCategory,
    buildProductFilterSearchParams,
    computeCanonicalQueryKey,
    ProductFilterOptionsCoordinator,
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

  console.log('\n=== Test Suite 1: Serialization, Roundtrip, Dedup & Edge Cases ===')

  runCase('1.1: Multi brands and sockets serialize to repeated keys without bracket suffix', () => {
    const params = {
      brands: ['Intel', 'AMD'],
      sockets: [1, 5],
      componentType: 'CPU',
    }
    const searchParams = buildProductFilterSearchParams(params)
    assert.deepEqual(searchParams.getAll('brands'), ['Intel', 'AMD'])
    assert.deepEqual(searchParams.getAll('sockets'), ['1', '5'])
    assert.equal(searchParams.get('componentType'), 'CPU')
    assert.ok(!searchParams.has('brands[]'))
    assert.ok(!searchParams.has('sockets[]'))
  })

  runCase('1.2: URL roundtrip maintains identical query parameters', () => {
    const original = {
      categoryId: '3',
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

  runCase('1.3: Casing & whitespace deduplication for brands', () => {
    const urlParams = new URLSearchParams()
    urlParams.append('brands', '  Intel  ')
    urlParams.append('brands', 'intel')
    urlParams.append('brands', 'AMD')
    urlParams.append('brands', 'amd')
    const { filters: parsed } = parseFiltersFromUrl(urlParams)
    // Should preserve first casing and eliminate duplicates case-insensitively
    assert.deepEqual(parsed.brands, ['Intel', 'AMD'])
  })

  runCase('1.4: Legacy scalar + plural union for brand and technical filters', () => {
    const urlParams = new URLSearchParams()
    urlParams.append('brand', 'Intel')
    urlParams.append('brands', 'AMD')
    urlParams.append('socket', '1')
    urlParams.append('sockets', '5')
    const { filters: parsed } = parseFiltersFromUrl(urlParams)
    assert.deepEqual(parsed.brands.sort(), ['AMD', 'Intel'])
    assert.deepEqual(parsed.sockets.sort(), [1, 5])
  })

  runCase('1.5: Boolean false and price 0 are preserved', () => {
    const params = {
      hasWifi: false,
      hasIntegratedGpu: false,
      minPrice: 0,
      maxPrice: 1000000,
    }
    const searchParams = buildProductFilterSearchParams(params)
    assert.equal(searchParams.get('hasWifi'), 'false')
    assert.equal(searchParams.get('hasIntegratedGpu'), 'false')
    assert.equal(searchParams.get('minPrice'), '0')
    assert.equal(searchParams.get('maxPrice'), '1000000')

    const { filters: parsed } = parseFiltersFromUrl(searchParams)
    assert.equal(parsed.hasWifi, false)
    assert.equal(parsed.hasIntegratedGpu, false)
    assert.equal(parsed.minPrice, 0)
    assert.equal(parsed.maxPrice, 1000000)
  })

  runCase('1.6: Malformed URL and numeric overflow handled safely without crash', () => {
    const urlParams = new URLSearchParams()
    urlParams.append('sockets', 'notanumber')
    urlParams.append('sockets', '-5')
    urlParams.append('sockets', '999999999999999999999999999') // int32 overflow
    urlParams.append('sockets', '5') // valid int (AM5 = 5)
    urlParams.append('componentType', 'MALICIOUS_INJECTION')
    urlParams.append('pageIndex', '-1')
    urlParams.append('minPrice', 'abc')

    const { filters: parsed } = parseFiltersFromUrl(urlParams)
    assert.deepEqual(parsed.sockets, [5])
    assert.equal(parsed.componentType, undefined)
    assert.equal(parsed.pageIndex, 1)
    assert.equal(parsed.minPrice, undefined)
  })

  console.log('\n=== Test Suite 2: Component Type Filtering & Category Inference ===')

  runCase('2.1: Type-specific technical group filtering', () => {
    const cpuApplicable = TECHNICAL_GROUPS_BY_TYPE[1] // ComponentType.CPU
    assert.deepEqual(cpuApplicable, ['sockets', 'coreCounts', 'memoryTypes', 'hasIntegratedGpu'])

    const gpuApplicable = TECHNICAL_GROUPS_BY_TYPE[3] // ComponentType.GPU
    assert.deepEqual(gpuApplicable, ['vramGbs', 'gpuLengthsMm', 'requires12VHPWR'])

    const ramApplicable = TECHNICAL_GROUPS_BY_TYPE[4] // ComponentType.RAM
    assert.deepEqual(ramApplicable, ['memoryTypes', 'ramFormFactors', 'ramCapacitiesGb', 'ramSpeedsMhz', 'hasRgb'])

    const caseApplicable = TECHNICAL_GROUPS_BY_TYPE[7] // ComponentType.Case
    assert.deepEqual(caseApplicable, ['motherboardFormFactors'])

    const coolerApplicable = TECHNICAL_GROUPS_BY_TYPE[8] // ComponentType.Cooler
    assert.deepEqual(coolerApplicable, ['sockets', 'coolerTypes', 'hasRgb'])
  })

  runCase('2.2: Switching CPU -> GPU strips sockets & memoryTypes but keeps common filters', () => {
    const cpuFilters = {
      brands: ['Intel', 'ASUS'],
      sockets: [1, 2],
      memoryTypes: [4],
      vramGbs: [12], // not applicable to CPU
      minPrice: 1000000,
    }
    const cleanedForCPU = filterApplicableTechnicalFilters(cpuFilters, 1)
    assert.deepEqual(cleanedForCPU.sockets, [1, 2])
    assert.deepEqual(cleanedForCPU.memoryTypes, [4])
    assert.equal(cleanedForCPU.vramGbs, undefined)
    assert.deepEqual(cleanedForCPU.brands, ['Intel', 'ASUS'])

    // When switching to GPU:
    const cleanedForGPU = filterApplicableTechnicalFilters(cpuFilters, 3)
    assert.equal(cleanedForGPU.sockets, undefined)
    assert.equal(cleanedForGPU.memoryTypes, undefined)
    assert.deepEqual(cleanedForGPU.vramGbs, [12])
    assert.deepEqual(cleanedForGPU.brands, ['Intel', 'ASUS'])
    assert.equal(cleanedForGPU.minPrice, 1000000)
  })

  runCase('2.3: Category and type inference from category tree', () => {
    const mockCategories = [
      { id: 'cat-cpu', name: 'CPU', slug: 'cpu', componentType: 1, subCategories: [] },
      {
        id: 'cat-gpu',
        name: 'VGA',
        slug: 'vga',
        componentType: 3,
        subCategories: [
          { id: 'cat-rtx', name: 'RTX 40 Series', slug: 'rtx', componentType: 3, subCategories: [] },
        ],
      },
      { id: 'cat-ram', name: 'RAM', slug: 'ram', componentType: 4, subCategories: [] },
    ]

    assert.equal(inferComponentTypeFromCategory(mockCategories, 'cat-cpu'), 1)
    assert.equal(inferComponentTypeFromCategory(mockCategories, 'cat-rtx'), 3)
    assert.equal(inferComponentTypeFromCategory(mockCategories, 'cat-ram'), 4)
    assert.equal(inferComponentTypeFromCategory(mockCategories, 'unknown'), undefined)
  })

  runCase('2.4: Deep link filter state parses full URL query accurately', () => {
    const url = 'https://riutek.vn/products?categoryId=cat-123&componentType=CPU&brands=Intel&brands=AMD&sockets=1&sockets=5&hasIntegratedGpu=true&minPrice=2000000'
    const searchParams = new URL(url).searchParams
    const { filters: parsed } = parseFiltersFromUrl(searchParams)

    assert.equal(parsed.categoryId, 'cat-123')
    assert.equal(parsed.componentType, 1) // CPU -> 1
    assert.deepEqual(parsed.brands, ['Intel', 'AMD'])
    assert.deepEqual(parsed.sockets, [1, 5])
    assert.equal(parsed.hasIntegratedGpu, true)
    assert.equal(parsed.minPrice, 2000000)
  })

  console.log('\n=== Test Suite 3: Checkbox Toggle, 20-Item Limit & Chip Removal ===')

  runCase('3.1: Enforces maximum 20 items per filter group', () => {
    const twentyOneItems = Array.from({ length: 25 }, (_, i) => i + 1)
    const params = {
      sockets: twentyOneItems,
      brands: twentyOneItems.map((n) => `Brand${n}`),
    }
    const searchParams = buildProductFilterSearchParams(params)
    assert.equal(searchParams.getAll('sockets').length, 20)
    assert.equal(searchParams.getAll('brands').length, 20)
  })

  runCase('3.2: Price presets format and values', () => {
    assert.ok(PRICE_PRESETS.length >= 5)
    for (const preset of PRICE_PRESETS) {
      assert.ok(typeof preset.id === 'string')
      assert.ok(typeof preset.label === 'string')
      if (preset.minPrice !== undefined && preset.maxPrice !== undefined) {
        assert.ok(preset.minPrice < preset.maxPrice)
      }
    }
  })

  runCase('3.3: Inverted price min > max prevention', () => {
    const searchParams = new URLSearchParams()
    searchParams.set('minPrice', '5000000')
    searchParams.set('maxPrice', '1000000')
    const { priceError } = parseFiltersFromUrl(searchParams)
    assert.ok(priceError !== null)
    assert.ok(priceError.includes('lớn hơn hoặc bằng'))
  })

  runCase('3.4: Group titles and choice label formatting', () => {
    assert.equal(getGroupTitle('sockets', 1), 'Socket')
    assert.equal(getGroupTitle('sockets', 8), 'Socket hỗ trợ')
    assert.equal(getGroupTitle('motherboardFormFactors', 7), 'Kích thước main hỗ trợ')
    assert.equal(getGroupTitle('vramGbs', 3), 'Dung lượng VRAM')

    assert.equal(formatChoiceLabel('vramGbs', 12), '12 GB')
    assert.equal(formatChoiceLabel('ramCapacitiesGb', 32), '32 GB')
    assert.equal(formatChoiceLabel('psuWattages', 750), '750 W')
    assert.equal(formatChoiceLabel('ramSpeedsMhz', 6000), '6000 MHz')
  })

  console.log('\n=== Test Suite 4: Shared Serializer Between Catalog & Modal ===')

  runCase('4.1: PCBuilder slot technical filters alignment with shared helper', () => {
    const testFilters = {
      brands: ['Intel', 'ASUS'],
      sockets: [1],
      vramGbs: [12],
      ramCapacitiesGb: [32],
    }
    const cpuSlotFilters = getSlotApplicableTechnicalFilters(1, testFilters)
    assert.deepEqual(cpuSlotFilters.sockets, [1])
    assert.equal(cpuSlotFilters.vramGbs, undefined)
    assert.equal(cpuSlotFilters.ramCapacitiesGb, undefined)

    const gpuSlotFilters = getSlotApplicableTechnicalFilters(3, testFilters)
    assert.equal(gpuSlotFilters.sockets, undefined)
    assert.deepEqual(gpuSlotFilters.vramGbs, [12])
    assert.equal(gpuSlotFilters.ramCapacitiesGb, undefined)

    const ramSlotFilters = getSlotApplicableTechnicalFilters(4, testFilters)
    assert.equal(ramSlotFilters.sockets, undefined)
    assert.equal(ramSlotFilters.vramGbs, undefined)
    assert.deepEqual(ramSlotFilters.ramCapacitiesGb, [32])
  })

  await runAsyncCase('4.2: Shared getProducts uses identical URL building without client-side filter', async () => {
    let capturedUrl = null
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (url) => {
        capturedUrl = url.toString()
        return new Response(
          JSON.stringify({
            items: [],
            totalCount: 150, // total > pageSize
            pageIndex: 1,
            pageSize: 10,
            totalPages: 15,
            hasPreviousPage: false,
            hasNextPage: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const res = await getProducts({
        componentType: 1, // CPU = 1
        brands: ['Intel', 'AMD'],
        sockets: [1, 2],
        pageIndex: 1,
        pageSize: 10,
      })

      assert.ok(capturedUrl.includes('/products'))
      assert.ok(capturedUrl.includes('componentType=1'))
      assert.ok(capturedUrl.includes('brands=Intel'))
      assert.ok(capturedUrl.includes('brands=AMD'))
      assert.ok(capturedUrl.includes('sockets=1'))
      assert.ok(capturedUrl.includes('sockets=2'))
      assert.equal(res.totalCount, 150)
      assert.equal(res.items.length, 0) // No client-side mock items fabricated
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  console.log('\n=== Test Suite 5: Options Coordinator & Race Condition Protection ===')

  await runAsyncCase('5.1: Scope guard keeps B when response for A arrives later', async () => {
    const coordinator = new ProductFilterOptionsCoordinator()

    const defA = createDeferred()
    const defB = createDeferred()

    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (url) => {
        const urlStr = url.toString()
        if (urlStr.includes('componentType=1')) {
          return defA.promise
        } else if (urlStr.includes('componentType=3')) {
          return defB.promise
        }
        return new Response(JSON.stringify({ brands: [], groups: [] }))
      }

      let receivedData = null
      let receivedScope = null

      const promiseA = coordinator.loadOptions(
        { componentType: 1, categoryId: 'cat-1' },
        (data) => {
          receivedData = data
          receivedScope = 'A'
        },
        () => {},
        () => {}
      )

      const promiseB = coordinator.loadOptions(
        { componentType: 3, categoryId: 'cat-2' },
        (data) => {
          receivedData = data
          receivedScope = 'B'
        },
        () => {},
        () => {}
      )

      // Response B arrives first
      defB.resolve(
        new Response(
          JSON.stringify({
            brands: ['ASUS'],
            groups: [{ key: 'vramGbs', values: [12] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      await promiseB
      assert.equal(receivedScope, 'B')
      assert.equal(receivedData.groups[0].key, 'vramGbs')

      // Response A arrives later
      defA.resolve(
        new Response(
          JSON.stringify({
            brands: ['Intel'],
            groups: [{ key: 'sockets', values: [1] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      await promiseA

      // Coordinator must NOT overwrite receivedData with stale A!
      assert.equal(receivedScope, 'B')
      assert.equal(receivedData.groups[0].key, 'vramGbs')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await runAsyncCase('5.2: Scope error recovery does not clobber newer scope', async () => {
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

      let activeState = 'none'
      let errorMessage = null

      const promiseA = coordinator.loadOptions(
        { componentType: 1 },
        () => { activeState = 'A' },
        (err) => { errorMessage = err.message },
        () => {}
      )

      const promiseB = coordinator.loadOptions(
        { componentType: 3 },
        () => { activeState = 'B' },
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
      assert.equal(activeState, 'B')

      // A rejects with network error
      defA.reject(new Error('Network error on A'))
      await promiseA

      // Error from stale request A should NOT trigger onError for the current active scope
      assert.equal(activeState, 'B')
      assert.equal(errorMessage, null)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await runAsyncCase('5.3: Caching avoids refetch when scope parameters are identical', async () => {
    const coordinator = new ProductFilterOptionsCoordinator()
    let networkFetchCount = 0

    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async () => {
        networkFetchCount++
        return new Response(
          JSON.stringify({
            brands: ['Intel'],
            groups: [{ key: 'sockets', values: [1] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      let data1 = null
      await coordinator.loadOptions(
        { componentType: 1, categoryId: 'cat-1' },
        (data) => { data1 = data },
        () => {},
        () => {}
      )
      assert.equal(networkFetchCount, 1)
      assert.equal(data1.brands[0], 'Intel')

      // Fetch again with same scope
      let data2 = null
      await coordinator.loadOptions(
        { componentType: 1, categoryId: 'cat-1' },
        (data) => { data2 = data },
        () => {},
        () => {}
      )
      assert.equal(networkFetchCount, 1) // Cached!
      assert.equal(data2.brands[0], 'Intel')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  console.log('\n=== Test Suite 6: Home Category Shortcuts & URL Generation ===')

  runCase('6.1: Filter shortcuts URL generation includes categoryId & technical filters', () => {
    const params = {
      categoryId: 'cat-10',
      componentType: 1,
      sockets: [1],
    }
    const searchParams = buildProductFilterSearchParams(params)
    assert.equal(searchParams.get('categoryId'), 'cat-10')
    assert.equal(searchParams.get('componentType'), '1')
    assert.deepEqual(searchParams.getAll('sockets'), ['1'])
  })

  runCase('6.2: Canonical query key determinism', () => {
    const key1 = computeCanonicalQueryKey({
      componentType: 1,
      brands: ['Intel', 'AMD'],
      sockets: [2, 1],
      minPrice: 1000,
    })
    const key2 = computeCanonicalQueryKey({
      sockets: [1, 2],
      brands: ['Intel', 'AMD'],
      minPrice: 1000,
      componentType: 1,
    })
    assert.equal(key1, key2)
  })

  console.log('\n=== Test Suite 7: Shared API URL Builder Scalar Regression ===')

  await runAsyncCase('7.1: Scalar endpoints (auth, orders, admin) remain unaffected', async () => {
    let requestedUrl = null
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async (url) => {
        requestedUrl = url.toString()
        return new Response(JSON.stringify({ data: { token: 'mock' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      await apiClient.get('/orders', {
        params: {
          page: 1,
          limit: 10,
          status: 'PENDING',
          search: 'cuong@example.com',
        },
      })

      assert.ok(requestedUrl.includes('page=1'))
      assert.ok(requestedUrl.includes('limit=10'))
      assert.ok(requestedUrl.includes('status=PENDING'))
      assert.ok(requestedUrl.includes('search=cuong%40example.com'))
      assert.ok(!requestedUrl.includes('page[]'))
      assert.ok(!requestedUrl.includes('status[]'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await runAsyncCase('7.2: Special characters (&, +, spaces) in brand names are properly encoded', async () => {
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
          brands: ['ASUS & ROG', 'G.Skill+Co', 'B&W Tech'],
        },
      })

      assert.ok(requestedUrl.includes('brands=ASUS+%26+ROG') || requestedUrl.includes('brands=ASUS%20%26%20ROG'))
      assert.ok(requestedUrl.includes('brands=G.Skill%2BCo'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  console.log('\n=== Static Audit: Invariants, Favicon & Components ===')

  runCase('Audit 1: Favicon files exist and are linked in index.html', () => {
    const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8')
    assert.ok(indexHtml.includes('/favicon.png'), 'index.html must link /favicon.png')
    assert.ok(indexHtml.includes('/apple-touch-icon.png'), 'index.html must link /apple-touch-icon.png')
    assert.ok(indexHtml.includes('/favicon-32x32.png'), 'index.html must link /favicon-32x32.png')

    assert.ok(fs.existsSync(path.join(repoRoot, 'public/favicon.png')), 'public/favicon.png must exist')
    assert.ok(fs.existsSync(path.join(repoRoot, 'public/apple-touch-icon.png')), 'public/apple-touch-icon.png must exist')
    assert.ok(fs.existsSync(path.join(repoRoot, 'public/favicon-32x32.png')), 'public/favicon-32x32.png must exist')
  })

  runCase('Audit 2: HomeCategoryMenu renders real categories with hover flyout and accessible attributes', () => {
    const homeMenuSrc = fs.readFileSync(
      path.join(repoRoot, 'src/features/products/components/HomeCategoryMenu.tsx'),
      'utf8'
    )
    assert.ok(homeMenuSrc.includes('optionsCoordinator') && homeMenuSrc.includes('loadOptions'), 'HomeCategoryMenu must call coordinator.loadOptions')
    assert.ok(homeMenuSrc.includes('aria-expanded'), 'HomeCategoryMenu must have aria-expanded')
    assert.ok(homeMenuSrc.includes('aria-controls'), 'HomeCategoryMenu must have aria-controls')
    assert.ok(homeMenuSrc.includes('ProductFilterOptionsCoordinator'), 'HomeCategoryMenu must use coordinator for scope guard')
  })

  runCase('Audit 3: ProductFilters renders native checkboxes and active chips', () => {
    const filtersSrc = fs.readFileSync(
      path.join(repoRoot, 'src/features/products/components/ProductFilters.tsx'),
      'utf8'
    )
    assert.ok(filtersSrc.includes('ProductCheckboxGroup'), 'ProductFilters must render ProductCheckboxGroup')
    assert.ok(filtersSrc.includes('ProductBooleanFilterGroup'), 'ProductFilters must render ProductBooleanFilterGroup')
    assert.ok(filtersSrc.includes('PRICE_PRESETS'), 'ProductFilters must provide price presets')
  })

  runCase('Audit 4: PCBuilderProductPickerModal integrates shared filter helper and filter options', () => {
    const modalSrc = fs.readFileSync(
      path.join(repoRoot, 'src/features/pcBuilder/components/PCBuilderProductPickerModal.tsx'),
      'utf8'
    )
    assert.ok(modalSrc.includes('ProductFilterOptionsCoordinator'), 'PCBuilderProductPickerModal must use ProductFilterOptionsCoordinator')
    assert.ok(modalSrc.includes('getSlotApplicableTechnicalFilters'), 'PCBuilderProductPickerModal must use slot applicable filters')
    assert.ok(modalSrc.includes('PCBuilderTechnicalFilters'), 'PCBuilderProductPickerModal must render PCBuilderTechnicalFilters')
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
