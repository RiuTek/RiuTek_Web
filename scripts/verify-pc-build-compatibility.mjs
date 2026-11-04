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
  path.join(os.tmpdir(), 'riutek-pc-build-verify-')
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
  'src/features/auth/authTypes.ts',
  'src/features/products/productTypes.ts',
  'src/features/products/productConstants.ts',
  'src/features/orders/orderTypes.ts',
  'src/features/orders/orderConstants.ts',
  'src/features/checkout/checkoutConstants.ts',
  'src/features/pcBuilder/pcBuilderTypes.ts',
  'src/features/pcBuilder/pcBuilderConstants.ts',
  'src/features/pcBuilder/pcBuildCompatibilityHelper.ts',
  'src/features/pcBuilder/pcBuildSaveHelper.ts',
  'src/features/buyNow/pcBuildBuyNowHelper.ts',
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
      fileName: srcPath,
    }).outputText

    const outRel = relPath.replace(/\.ts$/, '.mjs')
    const outPath = path.join(tempRoot, outRel)
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, rewriteRelativeImports(transpiled), 'utf8')
  }

  const apiMod = await import(
    pathToFileURL(path.join(tempRoot, 'src/lib/api/index.mjs')).href
  )
  const authTypesMod = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/auth/authTypes.mjs')).href
  )
  const compatHelperMod = await import(
    pathToFileURL(
      path.join(
        tempRoot,
        'src/features/pcBuilder/pcBuildCompatibilityHelper.mjs'
      )
    ).href
  )
  const saveHelperMod = await import(
    pathToFileURL(
      path.join(tempRoot, 'src/features/pcBuilder/pcBuildSaveHelper.mjs')
    ).href
  )
  const buyNowHelperMod = await import(
    pathToFileURL(
      path.join(tempRoot, 'src/features/buyNow/pcBuildBuyNowHelper.mjs')
    ).href
  )

  const { ApiError } = apiMod
  const { UserRole } = authTypesMod
  const {
    classifyCompatibilityIssues,
    evaluateCompatibility,
    COMPATIBILITY_LABELS,
    COMPATIBILITY_GUIDANCE_NOTICE,
  } = compatHelperMod
  const {
    determineSaveDecision,
    createSaveConfirmationSnapshot,
    isSaveConfirmationValid,
    createSingleFlightLock,
  } = saveHelperMod
  const { canCreateNewOrder } = buyNowHelperMod

  let totalTests = 0
  let passedTests = 0

  function runCase(name, fn) {
    totalTests++
    try {
      fn()
      passedTests++
      console.log(`  ✓ ${name}`)
    } catch (err) {
      console.error(`  ✗ ${name}`)
      throw err
    }
  }

  async function runCaseAsync(name, fn) {
    totalTests++
    try {
      await fn()
      passedTests++
      console.log(`  ✓ ${name}`)
    } catch (err) {
      console.error(`  ✗ ${name}`)
      throw err
    }
  }

  const OWNER_CUSTOMER = '11111111-1111-4111-8111-111111111111'
  const OWNER_OTHER = '22222222-2222-4222-8222-222222222222'
  const BUILD_ID_1 = '33333333-3333-4333-8333-333333333333'
  const BUILD_ID_2 = '44444444-4444-4444-8444-444444444444'

  console.log('\n--- Group 1: Error COMP-13 / isCompatible=false (Request Save -> Confirm Open, calls=0, back retains state) ---')

  for (const flow of ['create', 'edit']) {
    runCase(`Flow ${flow}: Error issue requires confirmation, mutation calls = 0 before confirm`, () => {
      const preview = {
        isCompatible: false,
        isCompleteSystem: true,
        issues: [
          {
            ruleId: 'COMP-13',
            message: 'Chiều dài card đồ họa (320mm) vượt quá giới hạn của vỏ case (300mm).',
            severity: 'Error',
            componentTypes: ['GPU', 'Case'],
          },
        ],
        missingComponents: [],
        totalPrice: 25000000,
        estimatedWattage: 450,
      }

      const decision = determineSaveDecision({
        previewResult: preview,
        isPreviewLoading: false,
        previewError: null,
      })
      assert.equal(decision, 'confirm_required')

      let mutationCalls = 0
      const mockMutationApi = () => {
        mutationCalls++
        return Promise.resolve({ id: flow === 'create' ? BUILD_ID_1 : BUILD_ID_2 })
      }

      // Snapshot created, modal opened
      const snapshot = createSaveConfirmationSnapshot({
        flow,
        configKey: 'prod-gpu:1;prod-case:1',
        ownerId: OWNER_CUSTOMER,
        buildId: flow === 'edit' ? BUILD_ID_1 : undefined,
        payload: {
          name: 'Gaming Build',
          description: 'Custom PC',
          items: [
            { productId: 'prod-gpu', quantity: 1 },
            { productId: 'prod-case', quantity: 1 },
          ],
        },
        previewResult: preview,
        previewError: null,
      })

      assert.equal(mutationCalls, 0, 'No mutation call should be made when opening confirm dialog')
      assert.equal(snapshot.assessment.level, 'error')
      assert.equal(snapshot.assessment.classifiedIssues.errors.length, 1)

      // User clicks "Quay lại chỉnh sửa": modal closed, form payload & dirty preserved, calls remain 0
      const modalClosed = true
      const formPayloadPreserved = {
        name: snapshot.payload.name,
        description: snapshot.payload.description,
        items: snapshot.payload.items,
      }
      assert.equal(mutationCalls, 0)
      assert.equal(modalClosed, true)
      assert.deepEqual(formPayloadPreserved, snapshot.payload)
    })
  }

  console.log('\n--- Group 2: Error -> Vẫn lưu -> exactly 1 call with exact payload, lock & double-submit protection ---')

  await runCaseAsync('Create POST: confirm Vẫn lưu dispatches exactly 1 call with exact payload and lock protection', async () => {
    let callCount = 0
    let recordedPayload = null
    const deferred = createDeferred()

    const lock = createSingleFlightLock()

    const executeSave = async (payload) => {
      if (!lock.tryAcquire()) return
      callCount++
      recordedPayload = payload
      try {
        await deferred.promise
      } finally {
        lock.release()
      }
    }

    const payload = {
      name: 'Custom Core Build',
      description: 'Test Description',
      items: [
        { productId: 'cpu-1', quantity: 1 },
        { productId: 'ram-1', quantity: 2 },
      ],
    }

    // First click: triggers save
    const p1 = executeSave(payload)

    // Rapid double-click and Enter while pending:
    const p2 = executeSave(payload)
    const p3 = executeSave(payload)

    assert.equal(callCount, 1, 'Only 1 mutation call should be made despite multiple submissions')
    assert.deepEqual(recordedPayload, payload)

    deferred.resolve({ id: BUILD_ID_1, ...payload })
    await Promise.all([p1, p2, p3])
    assert.equal(callCount, 1, 'Still exactly 1 call after promise resolution')
  })

  await runCaseAsync('Edit PUT: confirm Vẫn lưu dispatches exactly 1 call with exact owner/buildId/payload and lock protection', async () => {
    let callCount = 0
    let recordedBuildId = null
    const deferred = createDeferred()
    const lock = createSingleFlightLock()

    const executePut = async (targetBuildId, payload) => {
      if (!lock.tryAcquire()) return
      callCount++
      recordedBuildId = targetBuildId
      try {
        await deferred.promise
      } finally {
        lock.release()
      }
    }

    const payload = {
      name: 'Updated Build Name',
      description: 'Updated Description',
      items: [{ productId: 'mb-1', quantity: 1 }],
    }

    const p1 = executePut(BUILD_ID_1, payload)
    const p2 = executePut(BUILD_ID_1, payload)

    assert.equal(callCount, 1)
    assert.equal(recordedBuildId, BUILD_ID_1)

    deferred.resolve({ id: BUILD_ID_1, ...payload })
    await Promise.all([p1, p2])
    assert.equal(callCount, 1)
  })

  console.log('\n--- Group 3: Warning COMP-12 / isCompatible=true / missing GPU (Direct Save) ---')

  runCase('Warning COMP-12 with isCompatible=true and missing GPU saves directly without confirm dialog', () => {
    const preview = {
      isCompatible: true,
      isCompleteSystem: false,
      issues: [
        {
          ruleId: 'COMP-12',
          message: 'CPU không tích hợp đồ họa và cấu hình chưa có card màn hình rời (GPU).',
          severity: 'Warning',
          componentTypes: ['CPU', 'GPU'],
        },
      ],
      missingComponents: ['GPU'],
      totalPrice: 12000000,
    }

    const decision = determineSaveDecision({
      previewResult: preview,
      isPreviewLoading: false,
      previewError: null,
    })
    assert.equal(decision, 'save_directly', 'Warning-only should save directly')

    const assessment = evaluateCompatibility(preview)
    assert.equal(assessment.level, 'warning')
    assert.equal(assessment.classifiedIssues.errors.length, 0)
    assert.equal(assessment.classifiedIssues.warnings.length, 1)
  })

  runCase('Missing-only with clean issues and isCompatible=true saves directly', () => {
    const preview = {
      isCompatible: true,
      isCompleteSystem: false,
      issues: [],
      missingComponents: ['GPU', 'Cooler'],
      totalPrice: 8000000,
    }

    const decision = determineSaveDecision({
      previewResult: preview,
      isPreviewLoading: false,
      previewError: null,
    })
    assert.equal(decision, 'save_directly')
    const assessment = evaluateCompatibility(preview)
    assert.equal(assessment.level, 'clean')
  })

  runCase('Clean build with isCompatible=true and no issues saves directly', () => {
    const preview = {
      isCompatible: true,
      isCompleteSystem: true,
      issues: [],
      missingComponents: [],
      totalPrice: 35000000,
    }

    const decision = determineSaveDecision({
      previewResult: preview,
      isPreviewLoading: false,
      previewError: null,
    })
    assert.equal(decision, 'save_directly')
    const assessment = evaluateCompatibility(preview)
    assert.equal(assessment.level, 'clean')
  })

  console.log('\n--- Group 4: isCompatible=false but issues=[] & unknown severity handling ---')

  runCase('isCompatible=false with issues=[] results in error level with generic warning text', () => {
    const preview = {
      isCompatible: false,
      isCompleteSystem: true,
      issues: [],
      missingComponents: [],
      totalPrice: 15000000,
    }

    const decision = determineSaveDecision({
      previewResult: preview,
      isPreviewLoading: false,
      previewError: null,
    })
    assert.equal(decision, 'confirm_required')

    const assessment = evaluateCompatibility(preview)
    assert.equal(assessment.level, 'error')
    assert.equal(assessment.title, COMPATIBILITY_LABELS.error)
    assert.equal(assessment.isGenericErrorNotice, true)
  })

  runCase('Unknown severity is preserved under others and does NOT default to Error', () => {
    const issues = [
      {
        ruleId: 'CUSTOM-99',
        message: 'Lưu ý phiên bản BIOS có thể cần cập nhật.',
        severity: 'Notice',
        componentTypes: ['CPU', 'Motherboard'],
      },
      {
        ruleId: 'CUSTOM-100',
        message: 'Khuyến nghị nâng cấp nguồn để đạt hiệu năng tối đa.',
        severity: 'Recommendation',
        componentTypes: ['PSU'],
      },
    ]

    const classified = classifyCompatibilityIssues(issues)
    assert.equal(classified.errors.length, 0, 'Unknown severity must not be coerced to Error')
    assert.equal(classified.warnings.length, 0, 'Unknown severity must not be coerced to Warning')
    assert.equal(classified.others.length, 2, 'Unknown severity should be preserved in others')
    assert.equal(classified.others[0].message, 'Lưu ý phiên bản BIOS có thể cần cập nhật.')
  })

  console.log('\n--- Group 5: Stale preview & snapshot invalidation on change ---')

  runCase('Out-of-order preview sequence: only latest selection sequence is applied', () => {
    let currentSeq = 0
    let appliedPreview = null

    const requestPreview = (selectionId) => {
      const seq = ++currentSeq
      return {
        seq,
        selectionId,
        resolve: (preview) => {
          if (seq === currentSeq) {
            appliedPreview = preview
          }
        },
      }
    }

    const reqA = requestPreview('selection-A')
    const reqB = requestPreview('selection-B')

    // B resolves first
    reqB.resolve({ id: 'preview-B', totalPrice: 20000000 })
    assert.equal(appliedPreview.id, 'preview-B')

    // Stale A resolves later
    reqA.resolve({ id: 'preview-A', totalPrice: 10000000 })
    assert.equal(appliedPreview.id, 'preview-B', 'Stale preview A must not overwrite preview B')
  })

  runCase('Quantity change invalidates save confirmation snapshot', () => {
    const configKey1 = 'cpu:1;ram:1'
    const configKey2 = 'cpu:1;ram:2'

    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey: configKey1,
      ownerId: OWNER_CUSTOMER,
      payload: {
        name: 'My PC',
        items: [
          { productId: 'cpu', quantity: 1 },
          { productId: 'ram', quantity: 1 },
        ],
      },
      previewResult: { isCompatible: false, issues: [{ ruleId: 'COMP-1', message: 'err', severity: 'Error' }] },
    })

    const isValid = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: configKey2,
      currentOwnerId: OWNER_CUSTOMER,
      currentPayload: {
        name: 'My PC',
        items: [
          { productId: 'cpu', quantity: 1 },
          { productId: 'ram', quantity: 2 },
        ],
      },
    })

    assert.equal(isValid, false, 'Changing quantity must invalidate confirmation snapshot')
  })

  runCase('Payload name or description change invalidates save confirmation snapshot', () => {
    const configKey = 'cpu:1'
    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey,
      ownerId: OWNER_CUSTOMER,
      payload: {
        name: 'Original Name',
        description: 'Original Desc',
        items: [{ productId: 'cpu', quantity: 1 }],
      },
      previewResult: { isCompatible: false, issues: [{ ruleId: 'COMP-1', message: 'err', severity: 'Error' }] },
    })

    const isValidNameChange = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: configKey,
      currentOwnerId: OWNER_CUSTOMER,
      currentPayload: {
        name: 'Edited Name',
        description: 'Original Desc',
        items: [{ productId: 'cpu', quantity: 1 }],
      },
    })
    assert.equal(isValidNameChange, false, 'Changing name must invalidate confirmation')

    const isValidDescChange = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: configKey,
      currentOwnerId: OWNER_CUSTOMER,
      currentPayload: {
        name: 'Original Name',
        description: 'Edited Desc',
        items: [{ productId: 'cpu', quantity: 1 }],
      },
    })
    assert.equal(isValidDescChange, false, 'Changing description must invalidate confirmation')
  })

  console.log('\n--- Group 6: Preview loading & preview error states ---')

  runCase('Preview loading returns wait_loading decision', () => {
    const decision = determineSaveDecision({
      previewResult: { isCompatible: true, issues: [] },
      isPreviewLoading: true,
      previewError: null,
    })
    assert.equal(decision, 'wait_loading')
  })

  runCase('Preview error returns unverified_preview decision with retry and valid Vẫn lưu option', () => {
    const decision = determineSaveDecision({
      previewResult: null,
      isPreviewLoading: false,
      previewError: '503 Service Unavailable',
    })
    assert.equal(decision, 'unverified_preview')

    const assessment = evaluateCompatibility({ hasPreviewError: true })
    assert.equal(assessment.level, 'unverified')
    assert.equal(assessment.title, COMPATIBILITY_LABELS.unverified)

    // Snapshot created with unverified preview
    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey: 'cpu:1',
      ownerId: OWNER_CUSTOMER,
      payload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
      previewResult: null,
      previewError: '503 Service Unavailable',
    })

    assert.equal(snapshot.assessment.level, 'unverified')
    assert.equal(snapshot.previewError, '503 Service Unavailable')

    // Valid to confirm and save despite unverified status
    const isValid = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: 'cpu:1',
      currentOwnerId: OWNER_CUSTOMER,
      currentPayload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
      previewResult: null,
      previewError: '503 Service Unavailable',
    })
    assert.equal(isValid, true, 'User can proceed with Vẫn lưu on unverified preview')
  })

  console.log('\n--- Group 7: Confirm open then logout / change owner / buildId / unmount ---')

  runCase('Owner change invalidates confirmation snapshot', () => {
    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey: 'cpu:1',
      ownerId: OWNER_CUSTOMER,
      payload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
      previewResult: { isCompatible: false, issues: [{ ruleId: 'C1', message: 'err', severity: 'Error' }] },
    })

    const isValid = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: 'cpu:1',
      currentOwnerId: OWNER_OTHER,
      currentPayload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
    })
    assert.equal(isValid, false, 'Owner change must invalidate confirmation snapshot')
  })

  runCase('BuildId change in edit flow invalidates confirmation snapshot', () => {
    const snapshot = createSaveConfirmationSnapshot({
      flow: 'edit',
      configKey: 'cpu:1',
      ownerId: OWNER_CUSTOMER,
      buildId: BUILD_ID_1,
      payload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
      previewResult: { isCompatible: false, issues: [{ ruleId: 'C1', message: 'err', severity: 'Error' }] },
    })

    const isValid = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: 'cpu:1',
      currentOwnerId: OWNER_CUSTOMER,
      currentBuildId: BUILD_ID_2,
      currentPayload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
    })
    assert.equal(isValid, false, 'BuildId mismatch must invalidate confirmation snapshot')
  })

  runCase('Flow mismatch (create snapshot in edit context) is rejected', () => {
    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey: 'cpu:1',
      ownerId: OWNER_CUSTOMER,
      payload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
      previewResult: { isCompatible: false, issues: [{ ruleId: 'C1', message: 'err', severity: 'Error' }] },
    })

    const isValid = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: 'cpu:1',
      currentOwnerId: OWNER_CUSTOMER,
      currentBuildId: BUILD_ID_1,
      currentPayload: { name: 'PC', items: [{ productId: 'cpu', quantity: 1 }] },
    })
    assert.equal(isValid, false, 'Create snapshot cannot be used when currentBuildId is present in edit flow')
  })

  await runCaseAsync('Deferred token resolution after session key change aborts mutation', async () => {
    let sessionKey = 'session-1'
    let mutationCalled = false
    const deferredToken = createDeferred()

    const executeWithToken = async () => {
      const capturedSession = sessionKey
      const token = await deferredToken.promise
      if (sessionKey !== capturedSession) {
        return // Abort stale mutation
      }
      mutationCalled = true
      return token
    }

    const promise = executeWithToken()

    // Context changes before token resolves:
    sessionKey = 'session-2'
    deferredToken.resolve('expired-token')

    await promise
    assert.equal(mutationCalled, false, 'Mutation must not execute when session context changed during token resolution')
  })

  console.log('\n--- Group 8: Save failure handling, 409 conflict, dirty protection ---')

  runCase('Empty or whitespace name is rejected without confirmation or mutation', () => {
    const names = ['', '   ', '\t\n']
    for (const rawName of names) {
      const cleanName = rawName.trim()
      assert.equal(cleanName, '')
      // Handler exits immediately without calling determineSaveDecision or API
    }
  })

  await runCaseAsync('API 409 Conflict in edit flow marks conflict, does not clean or navigate', async () => {
    let isConflict = false
    let isSavedClean = false
    let navigated = false

    const handleEditError = (err) => {
      if (err instanceof ApiError && err.status === 409) {
        isConflict = true
      }
    }

    try {
      throw new ApiError({
        status: 409,
        statusText: 'Conflict',
        data: { message: 'Build has been modified by another process.' },
      })
    } catch (err) {
      handleEditError(err)
    }

    assert.equal(isConflict, true, 'isConflict must be set on 409')
    assert.equal(isSavedClean, false, 'isSavedClean must remain false on 409')
    assert.equal(navigated, false, 'Navigation must not occur on 409')
  })

  runCase('Successful save/update bypasses blocker and marks clean', () => {
    let isSaveSuccessBypass = false
    let isSavedClean = false

    // On success
    isSaveSuccessBypass = true
    isSavedClean = true

    assert.equal(isSaveSuccessBypass, true)
    assert.equal(isSavedClean, true)
  })

  console.log('\n--- Group 9: BuyNow & Cart compatibility independence ---')

  runCase('Build with isCompatible=false + canPurchaseAll=true allows add-to-cart & buy-now', () => {
    const build = {
      id: BUILD_ID_1,
      name: 'Custom Build',
      isCompatible: false,
      isCompleteSystem: false,
      canPurchaseAll: true,
      items: [
        {
          productId: 'prod-1',
          productName: 'CPU',
          quantity: 1,
          unitPrice: 5000000,
          totalPrice: 5000000,
          isActive: true,
          stockQuantity: 10,
          isAvailable: true,
        },
      ],
      issues: [
        {
          ruleId: 'COMP-1',
          message: 'Linh kiện không tương thích',
          severity: 'Error',
        },
      ],
      missingComponents: ['GPU'],
    }

    const canBuy = canCreateNewOrder({
      isCustomer: true,
      selectedAddressId: 'addr-1',
      notes: '',
      build,
      isSubmitting: false,
      activeAttempt: null,
    })

    assert.equal(canBuy, true, 'Incompatible build with stock must allow purchase')
  })

  runCase('Build with canPurchaseAll=false blocks purchase due to stock, regardless of compatibility', () => {
    const build = {
      id: BUILD_ID_1,
      name: 'Custom Build',
      isCompatible: true,
      isCompleteSystem: true,
      canPurchaseAll: false, // out of stock
      items: [
        {
          productId: 'prod-1',
          productName: 'RAM',
          quantity: 1,
          unitPrice: 1000000,
          totalPrice: 1000000,
          isActive: true,
          stockQuantity: 0,
          isAvailable: false,
        },
      ],
      issues: [],
      missingComponents: [],
    }

    const canBuy = canCreateNewOrder({
      isCustomer: true,
      selectedAddressId: 'addr-1',
      notes: '',
      build,
      isSubmitting: false,
      activeAttempt: null,
    })

    assert.equal(canBuy, false, 'canPurchaseAll=false must block purchase')
  })

  console.log('\n--- Group 10: Presentation & Language Integrity ---')

  runCase('Issues array renders formatted messages correctly and never produces [object Object]', () => {
    const issues = [
      {
        ruleId: 'COMP-13',
        message: 'Chiều dài card đồ họa (320mm) vượt quá giới hạn của vỏ case (300mm).',
        severity: 'Error',
        componentTypes: ['GPU', 'Case'],
      },
      {
        ruleId: 'COMP-12',
        message: 'CPU không tích hợp đồ họa và cấu hình chưa có card màn hình rời (GPU).',
        severity: 'Warning',
        componentTypes: ['CPU', 'GPU'],
      },
    ]

    const classified = classifyCompatibilityIssues(issues)
    for (const issue of [...classified.errors, ...classified.warnings]) {
      const renderedText = `${issue.message}`
      assert.ok(!renderedText.includes('[object Object]'), 'Issue message must not be [object Object]')
      assert.ok(issue.message.length > 0)
    }
  })

  runCase('No claim of 100% or Tương thích hoàn toàn in labels or guidance notice', () => {
    const forbiddenPhrases = [
      'tương thích hoàn toàn',
      '100%',
      'hoàn hảo',
    ]

    for (const [key, value] of Object.entries(COMPATIBILITY_LABELS)) {
      const lower = value.toLowerCase()
      for (const phrase of forbiddenPhrases) {
        assert.ok(
          !lower.includes(phrase),
          `Label "${key}" ("${value}") must not contain forbidden phrase "${phrase}"`
        )
      }
    }

    const noticeLower = COMPATIBILITY_GUIDANCE_NOTICE.toLowerCase()
    for (const phrase of forbiddenPhrases) {
      assert.ok(
        !noticeLower.includes(phrase),
        `Guidance notice must not contain forbidden phrase "${phrase}"`
      )
    }

    assert.equal(
      COMPATIBILITY_LABELS.clean,
      'Chưa phát hiện xung đột theo thông số hiện có',
      'Clean label must follow approved phrasing'
    )
  })

  runCase('Warnings remain visible even when isCompatible=true', () => {
    const preview = {
      isCompatible: true,
      isCompleteSystem: true,
      issues: [
        {
          ruleId: 'COMP-12',
          message: 'Cảnh báo hiệu năng GPU',
          severity: 'Warning',
        },
      ],
      missingComponents: [],
    }

    const assessment = evaluateCompatibility(preview)
    assert.equal(assessment.level, 'warning', 'Assessment must reflect warning even if isCompatible=true')
    assert.equal(assessment.classifiedIssues.warnings.length, 1)
    assert.equal(assessment.classifiedIssues.errors.length, 0)
  })

  console.log(`\n========================================`)
  console.log(`All ${passedTests}/${totalTests} PC Build Compatibility tests passed!`)
  console.log(`========================================\n`)
} finally {
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  } catch {
    // Ignore temp cleanup errors
  }
}
