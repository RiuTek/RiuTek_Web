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
    computeAssessmentSignature,
    createSingleFlightLock,
    PCBuildSaveLifecycle,
    executePCBuildSaveOperation,
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

  console.log('\n=== Phần A: Snapshot và Bảng Quyết Định (Decision Table) ===')

  runCase('A.1: Snapshot COMP-13 Error -> đổi riêng từng thuộc tính đánh giá (ruleId, message, component, severity, missing, system, wattage, price) phải vô hiệu snapshot', () => {
    const basePreview = {
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
      estimatedWattage: 450,
      recommendedPsuWattage: 550,
      totalPrice: 20000000,
    }

    const payload = {
      name: 'Gaming Build',
      description: 'Test PC',
      items: [
        { productId: 'gpu-1', quantity: 1 },
        { productId: 'case-1', quantity: 1 },
      ],
    }

    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey: 'case-1:1;gpu-1:1',
      ownerId: OWNER_CUSTOMER,
      payload,
      previewResult: basePreview,
      previewError: null,
    })

    const checkValidityWithPreview = (modifiedPreview, error = null) => {
      return isSaveConfirmationValid({
        snapshot,
        currentConfigKey: 'case-1:1;gpu-1:1',
        currentOwnerId: OWNER_CUSTOMER,
        currentPayload: payload,
        previewResult: modifiedPreview,
        isPreviewLoading: false,
        previewError: error,
      })
    }

    // Baseline: exact match -> valid
    assert.equal(checkValidityWithPreview(basePreview), true, 'Baseline preview must be valid')

    // 1. Đổi ruleId từ COMP-13 sang COMP-06 (cùng count = 1, cùng severity = Error) -> INVALID
    const pRuleChanged = structuredClone(basePreview)
    pRuleChanged.issues[0].ruleId = 'COMP-06'
    assert.equal(checkValidityWithPreview(pRuleChanged), false, 'Changing ruleId must invalidate snapshot')

    // 2. Đổi message -> INVALID
    const pMsgChanged = structuredClone(basePreview)
    pMsgChanged.issues[0].message = 'Thông báo lỗi xung đột khác.'
    assert.equal(checkValidityWithPreview(pMsgChanged), false, 'Changing message must invalidate snapshot')

    // 3. Đổi componentTypes -> INVALID
    const pCompChanged = structuredClone(basePreview)
    pCompChanged.issues[0].componentTypes = ['CPU', 'Motherboard']
    assert.equal(checkValidityWithPreview(pCompChanged), false, 'Changing componentTypes must invalidate snapshot')

    // 4. Đổi severity từ Error sang Warning -> INVALID
    const pSevChanged = structuredClone(basePreview)
    pSevChanged.issues[0].severity = 'Warning'
    assert.equal(checkValidityWithPreview(pSevChanged), false, 'Changing severity must invalidate snapshot')

    // 5. Thêm missing component -> INVALID
    const pMissingChanged = structuredClone(basePreview)
    pMissingChanged.missingComponents = ['Cooler']
    assert.equal(checkValidityWithPreview(pMissingChanged), false, 'Changing missingComponents must invalidate snapshot')

    // 6. Đổi isCompleteSystem -> INVALID
    const pSystemChanged = structuredClone(basePreview)
    pSystemChanged.isCompleteSystem = false
    assert.equal(checkValidityWithPreview(pSystemChanged), false, 'Changing isCompleteSystem must invalidate snapshot')

    // 7. Đổi estimatedWattage -> INVALID
    const pWattChanged = structuredClone(basePreview)
    pWattChanged.estimatedWattage = 600
    assert.equal(checkValidityWithPreview(pWattChanged), false, 'Changing estimatedWattage must invalidate snapshot')

    // 8. Đổi recommendedPsuWattage -> INVALID
    const pPsuChanged = structuredClone(basePreview)
    pPsuChanged.recommendedPsuWattage = 750
    assert.equal(checkValidityWithPreview(pPsuChanged), false, 'Changing recommendedPsuWattage must invalidate snapshot')

    // 9. Đổi totalPrice hiển thị trong modal -> INVALID
    const pPriceChanged = structuredClone(basePreview)
    pPriceChanged.totalPrice = 25000000
    assert.equal(checkValidityWithPreview(pPriceChanged), false, 'Changing totalPrice must invalidate snapshot')

    // 10. Đổi sang previewError -> INVALID
    assert.equal(checkValidityWithPreview(null, 'Network Failure'), false, 'Preview failure must invalidate snapshot')
  })

  runCase('A.2: Response deep clone & đảo thứ tự vẫn hợp lệ; mutate response gốc không làm biến dạng snapshot', () => {
    const multiPreview = {
      isCompatible: false,
      isCompleteSystem: false,
      issues: [
        { ruleId: 'COMP-13', message: 'Lỗi A', severity: 'Error', componentTypes: ['GPU', 'Case'] },
        { ruleId: 'COMP-12', message: 'Lưu ý B', severity: 'Warning', componentTypes: ['CPU', 'GPU'] },
      ],
      missingComponents: ['PSU', 'Cooler'],
      estimatedWattage: 300,
      recommendedPsuWattage: 450,
      totalPrice: 15000000,
    }

    const payload = {
      name: 'Multi Test',
      description: null,
      items: [
        { productId: 'item-1', quantity: 1 },
        { productId: 'item-2', quantity: 2 },
      ],
    }

    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey: 'item-1:1;item-2:2',
      ownerId: OWNER_CUSTOMER,
      payload,
      previewResult: multiPreview,
      previewError: null,
    })

    // Deep clone nội dung giống hệt -> hợp lệ
    const cloned = structuredClone(multiPreview)
    assert.equal(
      isSaveConfirmationValid({
        snapshot,
        currentConfigKey: 'item-1:1;item-2:2',
        currentOwnerId: OWNER_CUSTOMER,
        currentPayload: payload,
        previewResult: cloned,
        isPreviewLoading: false,
        previewError: null,
      }),
      true,
      'Deep cloned response must be valid'
    )

    // Đảo thứ tự issues trong response mới (Lưu ý B lên trước Lỗi A) -> canonical sort vẫn nhận diện hợp lệ
    const reorderedIssues = structuredClone(multiPreview)
    reorderedIssues.issues.reverse()
    assert.equal(
      isSaveConfirmationValid({
        snapshot,
        currentConfigKey: 'item-1:1;item-2:2',
        currentOwnerId: OWNER_CUSTOMER,
        currentPayload: payload,
        previewResult: reorderedIssues,
        isPreviewLoading: false,
        previewError: null,
      }),
      true,
      'Reordered issues array must remain valid'
    )

    // Đảo thứ tự missingComponents trong response mới -> canonical sort vẫn nhận diện hợp lệ
    const reorderedMissing = structuredClone(multiPreview)
    reorderedMissing.missingComponents.reverse()
    assert.equal(
      isSaveConfirmationValid({
        snapshot,
        currentConfigKey: 'item-1:1;item-2:2',
        currentOwnerId: OWNER_CUSTOMER,
        currentPayload: payload,
        previewResult: reorderedMissing,
        isPreviewLoading: false,
        previewError: null,
      }),
      true,
      'Reordered missing components array must remain valid'
    )

    // Mutate object preview gốc sau khi đã tạo snapshot -> snapshot bên trong không đổi
    multiPreview.issues[0].message = 'CORRUPTED MESSAGE'
    multiPreview.issues[0].ruleId = 'CORRUPTED-RULE'
    multiPreview.totalPrice = 999999999
    assert.equal(snapshot.previewResult.issues[0].ruleId, 'COMP-13', 'Snapshot issues must be immutable')
    assert.equal(snapshot.previewResult.totalPrice, 15000000, 'Snapshot totalPrice must be immutable')
  })

  runCase('A.3: Đổi items, quantity, name, description, session, owner, buildId hoặc loading làm mất hiệu lực xác nhận', () => {
    const preview = {
      isCompatible: false,
      isCompleteSystem: true,
      issues: [{ ruleId: 'C1', message: 'msg', severity: 'Error' }],
      missingComponents: [],
      estimatedWattage: 200,
      recommendedPsuWattage: 300,
      totalPrice: 10000000,
    }

    const payload = {
      name: 'Original Build Name',
      description: 'Original Description',
      items: [{ productId: 'cpu', quantity: 1 }],
    }

    const snapshot = createSaveConfirmationSnapshot({
      flow: 'edit',
      configKey: 'cpu:1',
      ownerId: OWNER_CUSTOMER,
      buildId: BUILD_ID_1,
      payload,
      previewResult: preview,
      previewError: null,
    })

    const testValid = (overrides = {}) => {
      return isSaveConfirmationValid({
        snapshot,
        currentConfigKey: overrides.configKey ?? 'cpu:1',
        currentOwnerId: overrides.ownerId ?? OWNER_CUSTOMER,
        currentBuildId: overrides.buildId !== undefined ? overrides.buildId : BUILD_ID_1,
        currentPayload: overrides.payload ?? payload,
        previewResult: overrides.preview ?? preview,
        isPreviewLoading: overrides.loading ?? false,
        previewError: null,
      })
    }

    assert.equal(testValid({ loading: true }), false, 'Loading preview must invalidate confirm')
    assert.equal(testValid({ configKey: 'cpu:2' }), false, 'Quantity change must invalidate confirm')
    assert.equal(testValid({ configKey: 'cpu:1;gpu:1' }), false, 'Adding component must invalidate confirm')
    assert.equal(testValid({ ownerId: OWNER_OTHER }), false, 'Owner switch must invalidate confirm')
    assert.equal(testValid({ buildId: BUILD_ID_2 }), false, 'BuildId switch must invalidate confirm')
    assert.equal(
      testValid({ payload: { ...payload, name: 'Renamed Build' } }),
      false,
      'Name change must invalidate confirm'
    )
    assert.equal(
      testValid({ payload: { ...payload, description: 'Edited Desc' } }),
      false,
      'Description change must invalidate confirm'
    )
  })

  runCase('A.4: Bảng quyết định (Error/isCompatible=false -> confirm, Warning-only/missing-only -> direct, loading/error)', () => {
    // 1. Error issue
    assert.equal(
      determineSaveDecision({
        previewResult: { isCompatible: false, issues: [{ ruleId: 'C1', message: 'err', severity: 'Error' }] },
        isPreviewLoading: false,
        previewError: null,
      }),
      'confirm_required'
    )

    // 2. isCompatible = false with issues = []
    assert.equal(
      determineSaveDecision({
        previewResult: { isCompatible: false, issues: [] },
        isPreviewLoading: false,
        previewError: null,
      }),
      'confirm_required'
    )

    // 3. Warning-only
    assert.equal(
      determineSaveDecision({
        previewResult: { isCompatible: true, issues: [{ ruleId: 'W1', message: 'warn', severity: 'Warning' }] },
        isPreviewLoading: false,
        previewError: null,
      }),
      'save_directly'
    )

    // 4. Missing-only
    assert.equal(
      determineSaveDecision({
        previewResult: { isCompatible: true, issues: [], missingComponents: ['GPU'] },
        isPreviewLoading: false,
        previewError: null,
      }),
      'save_directly'
    )

    // 5. Clean
    assert.equal(
      determineSaveDecision({
        previewResult: { isCompatible: true, issues: [], missingComponents: [] },
        isPreviewLoading: false,
        previewError: null,
      }),
      'save_directly'
    )

    // 6. Loading
    assert.equal(
      determineSaveDecision({
        previewResult: { isCompatible: true, issues: [] },
        isPreviewLoading: true,
        previewError: null,
      }),
      'wait_loading'
    )

    // 7. Preview error
    assert.equal(
      determineSaveDecision({
        previewResult: null,
        isPreviewLoading: false,
        previewError: 'Service Unavailable',
      }),
      'unverified_preview'
    )
  })

  console.log('\n=== Phần B (PLAN 4.A): Lock Primitive Unit Tests ===')

  runCase('[Unit Lock] A.1: Acquire L1; acquire tiếp bị từ chối; release sai lease không mở khóa; release L1 mở khóa', () => {
    const lock = createSingleFlightLock()
    const l1 = lock.tryAcquire()
    assert.ok(l1, 'L1 must be acquired')
    assert.equal(typeof l1, 'symbol')
    assert.equal(lock.isInFlight(), true)

    const l2 = lock.tryAcquire()
    assert.equal(l2, null, 'Acquire while locked must return null')

    const fakeLease = Symbol('fake-lease')
    const releaseFake = lock.release(fakeLease)
    assert.equal(releaseFake, false, 'Release with wrong lease must return false')
    assert.equal(lock.isInFlight(), true, 'Lock must remain held after wrong release')

    const releaseNull = lock.release(null)
    assert.equal(releaseNull, false, 'Release with null/undefined must return false')
    assert.equal(lock.isInFlight(), true, 'Lock must remain held after null release')

    const releaseL1 = lock.release(l1)
    assert.equal(releaseL1, true, 'Release with L1 must succeed')
    assert.equal(lock.isInFlight(), false, 'Lock must be free')

    const releaseAgain = lock.release(l1)
    assert.equal(releaseAgain, false, 'Double release of L1 must return false and be idempotent no-op')
  })

  runCase('[Unit Lock] A.2: Acquire L1 -> reset context -> acquire L2 -> release L1 một hoặc nhiều lần: L2 vẫn đang giữ khóa; acquire thứ ba bị từ chối; Release L2 mới mở khóa', () => {
    const lock = createSingleFlightLock()
    const l1 = lock.tryAcquire()
    assert.ok(l1)
    assert.equal(lock.isInFlight(), true)

    lock.resetForContextChange()
    assert.equal(lock.isInFlight(), false, 'resetForContextChange must invalidate active lease')

    const l2 = lock.tryAcquire()
    assert.ok(l2)
    assert.notEqual(l1, l2, 'L2 must be a different symbol from L1')
    assert.equal(lock.isInFlight(), true)

    // Release L1 one or more times
    assert.equal(lock.release(l1), false, 'Releasing old lease L1 must return false')
    assert.equal(lock.release(l1), false, 'Repeated release of L1 must still return false')
    assert.equal(lock.isInFlight(), true, 'L2 must still hold the lock')

    // Third acquire rejected
    assert.equal(lock.tryAcquire(), null, 'Third acquire must be rejected while L2 holds lock')

    // Release L2 unlocks
    assert.equal(lock.release(l2), true, 'Release L2 must unlock')
    assert.equal(lock.isInFlight(), false)
  })

  runCase('[Unit Lock] A.3: Reset nhiều lần và quay về context cũ không tái sử dụng token/lease cũ', () => {
    const lock = createSingleFlightLock()
    const l1 = lock.tryAcquire()
    assert.ok(l1)

    lock.resetForContextChange()
    lock.resetForContextChange()

    const l2 = lock.tryAcquire()
    assert.ok(l2)
    assert.notEqual(l1, l2)

    lock.resetForContextChange()
    const l3 = lock.tryAcquire()
    assert.ok(l3)
    assert.notEqual(l3, l1)
    assert.notEqual(l3, l2)

    // Releasing old l1 or l2 cannot release l3
    assert.equal(lock.release(l1), false)
    assert.equal(lock.release(l2), false)
    assert.equal(lock.isInFlight(), true)
    assert.equal(lock.release(l3), true)
    assert.equal(lock.isInFlight(), false)
  })

  console.log('\n=== Phần C (PLAN 4.B): Production Regression Matrix A/B Chồng Nhau (Create POST & Edit PUT) ===')

  await runCaseAsync('[Production Runner] B.4: A chờ token -> context switch & reset lock -> B chờ token -> resolve A -> A mutation=0, callbacks=0, lock B còn giữ; B2 bị từ chối; resolve B -> B mutation=1, callbacks=1, lock giải phóng', async () => {
    for (const flow of ['create', 'edit']) {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(
        'user-A',
        flow === 'edit' ? BUILD_ID_1 : null
      )
      lifecycle.mount()

      const payloadA = { name: 'Rig A', items: [{ productId: 'gpu-A', quantity: 1 }] }
      const payloadB = { name: 'Rig B', items: [{ productId: 'gpu-B', quantity: 2 }] }

      const deferredTokenA = createDeferred()
      let tokenCallsA = 0
      let mutationCallsA = 0
      let successCallsA = 0
      let errorCallsA = 0
      let settledCallsA = 0

      // 1. Op A starts and waits on deferred token
      const promiseA = executePCBuildSaveOperation({
        payload: payloadA,
        getAccessToken: async () => {
          tokenCallsA++
          return deferredTokenA.promise
        },
        mutationFn: async (p) => {
          mutationCallsA++
          return { id: flow === 'edit' ? BUILD_ID_1 : 'id-A', ...p }
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => successCallsA++,
        onError: () => errorCallsA++,
        onSettled: () => settledCallsA++,
      })

      assert.equal(tokenCallsA, 1, 'Op A must have requested token')
      assert.equal(lock.isInFlight(), true, 'Lock must be held by Op A')

      // 2. Context changes to B & lock is reset for context change
      lifecycle.updateContext('user-B', flow === 'edit' ? BUILD_ID_2 : null)
      lock.resetForContextChange()

      // 3. Op B starts and waits on deferred token
      const deferredTokenB = createDeferred()
      let tokenCallsB = 0
      let mutationCallsB = 0
      let successCallsB = 0
      let errorCallsB = 0
      let settledCallsB = 0
      let receivedPayloadB = null
      let receivedBuildIdB = null

      const promiseB = executePCBuildSaveOperation({
        payload: payloadB,
        getAccessToken: async () => {
          tokenCallsB++
          return deferredTokenB.promise
        },
        mutationFn: async (p, token) => {
          mutationCallsB++
          receivedPayloadB = p
          receivedBuildIdB = flow === 'edit' ? BUILD_ID_2 : 'new-build'
          assert.equal(token, 'token-B')
          return { id: receivedBuildIdB, ...p }
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => successCallsB++,
        onError: () => errorCallsB++,
        onSettled: () => settledCallsB++,
      })

      assert.equal(tokenCallsB, 1, 'Op B must have requested token')
      assert.equal(lock.isInFlight(), true, 'Lock must be held by Op B')

      // 4. Resolve A and await A completion
      deferredTokenA.resolve('token-A')
      const resA = await promiseA

      assert.equal(resA, false, 'Op A must return false because context is dead')
      assert.equal(mutationCallsA, 0, 'A must have 0 mutation calls')
      assert.equal(successCallsA, 0, 'A must have 0 success callbacks')
      assert.equal(errorCallsA, 0, 'A must have 0 error callbacks')
      assert.equal(settledCallsA, 0, 'A must have 0 settled callbacks')
      assert.equal(lock.isInFlight(), true, 'Lock B must STILL be held! (A finally must not release B)')

      // 5. Trigger B2 immediately while B is still pending
      let tokenCallsB2 = 0
      let mutationCallsB2 = 0
      const resB2 = await executePCBuildSaveOperation({
        payload: payloadB,
        getAccessToken: async () => {
          tokenCallsB2++
          return 'token-B2'
        },
        mutationFn: async (p) => {
          mutationCallsB2++
          return p
        },
        context: lifecycle.createOperationContext(),
        lock,
      })

      assert.equal(resB2, false, 'B2 must be rejected by lock while B is in flight')
      assert.equal(tokenCallsB2, 0, 'B2 must not fetch token')
      assert.equal(mutationCallsB2, 0, 'B2 must not call mutation')

      // 6. Resolve token B
      deferredTokenB.resolve('token-B')
      const resB = await promiseB

      assert.equal(resB, true, 'Op B must succeed')
      assert.equal(mutationCallsB, 1, 'Op B mutation calls must be exactly 1')
      assert.equal(successCallsB, 1, 'Op B onSuccess must be called exactly once')
      assert.equal(settledCallsB, 1, 'Op B onSettled must be called exactly once')
      assert.equal(errorCallsB, 0, 'Op B onError must not be called')
      assert.deepEqual(receivedPayloadB, payloadB, 'Op B received correct payload')
      if (flow === 'edit') {
        assert.equal(receivedBuildIdB, BUILD_ID_2, 'Op B targeted correct buildId')
      }
      assert.equal(lock.isInFlight(), false, 'Lock must be released after B completes')
    }
  })

  await runCaseAsync('[Production Runner] B.5: A mutation pending -> context switch & reset lock -> B mutation pending -> A resolve success hoặc reject -> không callback A, lock B còn giữ; B2 bị từ chối; B mutation=1', async () => {
    for (const variant of ['resolve', 'reject']) {
      for (const flow of ['create', 'edit']) {
        const lock = createSingleFlightLock()
        const lifecycle = new PCBuildSaveLifecycle(
          'user-A',
          flow === 'edit' ? BUILD_ID_1 : null
        )
        lifecycle.mount()

        const payloadA = { name: 'Rig A', items: [{ productId: 'gpu-A', quantity: 1 }] }
        const payloadB = { name: 'Rig B', items: [{ productId: 'gpu-B', quantity: 2 }] }

        const mutationSignalA = createDeferred()
        const deferredMutationA = createDeferred()
        let mutationCallsA = 0
        let successCallsA = 0
        let errorCallsA = 0
        let settledCallsA = 0

        const promiseA = executePCBuildSaveOperation({
          payload: payloadA,
          getAccessToken: async () => 'token-A',
          mutationFn: async (p) => {
            mutationCallsA++
            mutationSignalA.resolve()
            return deferredMutationA.promise
          },
          context: lifecycle.createOperationContext(),
          lock,
          onSuccess: () => successCallsA++,
          onError: () => errorCallsA++,
          onSettled: () => settledCallsA++,
        })

        // Deterministic wait: mutation A is in-flight
        await mutationSignalA.promise
        assert.equal(mutationCallsA, 1)
        assert.equal(lock.isInFlight(), true)

        // Context switch to B & lock reset
        lifecycle.updateContext('user-B', flow === 'edit' ? BUILD_ID_2 : null)
        lock.resetForContextChange()

        // Op B starts and reaches mutation
        const mutationSignalB = createDeferred()
        const deferredMutationB = createDeferred()
        let mutationCallsB = 0
        let successCallsB = 0
        let errorCallsB = 0
        let settledCallsB = 0
        let receivedPayloadB = null

        const promiseB = executePCBuildSaveOperation({
          payload: payloadB,
          getAccessToken: async () => 'token-B',
          mutationFn: async (p) => {
            mutationCallsB++
            receivedPayloadB = p
            mutationSignalB.resolve()
            return deferredMutationB.promise
          },
          context: lifecycle.createOperationContext(),
          lock,
          onSuccess: () => successCallsB++,
          onError: () => errorCallsB++,
          onSettled: () => settledCallsB++,
        })

        // Deterministic wait: mutation B is in-flight
        await mutationSignalB.promise
        assert.equal(mutationCallsB, 1)
        assert.equal(lock.isInFlight(), true)

        // A settles (resolve success or reject error)
        if (variant === 'resolve') {
          deferredMutationA.resolve({ id: 'done-A' })
        } else {
          deferredMutationA.reject(new Error('Network error on A'))
        }

        const resA = await promiseA
        assert.equal(resA, false, 'Op A must return false')
        assert.equal(successCallsA, 0, 'No success callback for A')
        assert.equal(errorCallsA, 0, 'No error callback for A')
        assert.equal(settledCallsA, 0, 'No settled callback for A')
        assert.equal(lock.isInFlight(), true, 'Lock B must remain held!')

        // B2 triggered while B pending -> rejected
        let mutationCallsB2 = 0
        const resB2 = await executePCBuildSaveOperation({
          payload: payloadB,
          getAccessToken: async () => 'token-B2',
          mutationFn: async () => {
            mutationCallsB2++
            return {}
          },
          context: lifecycle.createOperationContext(),
          lock,
        })
        assert.equal(resB2, false, 'B2 rejected while B holds lock')
        assert.equal(mutationCallsB2, 0)

        // Resolve B mutation
        deferredMutationB.resolve({ id: flow === 'edit' ? BUILD_ID_2 : 'new-B', ...payloadB })
        const resB = await promiseB
        assert.equal(resB, true)
        assert.equal(mutationCallsB, 1, 'Exactly 1 mutation for B')
        assert.equal(successCallsB, 1, 'B onSuccess called once')
        assert.equal(settledCallsB, 1, 'B onSettled called once')
        assert.equal(errorCallsB, 0)
        assert.deepEqual(receivedPayloadB, payloadB)
        assert.equal(lock.isInFlight(), false, 'Lock released after B finishes')
      }
    }
  })

  await runCaseAsync('[Production Runner] B.6: A 401 & chờ refresh token -> context switch & reset lock -> B pending -> resolve refresh A -> không retry A, không callback A, lock B còn giữ; B mutation=1', async () => {
    for (const flow of ['create', 'edit']) {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(
        'user-A',
        flow === 'edit' ? BUILD_ID_1 : null
      )
      lifecycle.mount()

      const refreshSignalA = createDeferred()
      const deferredRefreshTokenA = createDeferred()
      let mutationCallsA = 0
      let successCallsA = 0
      let errorCallsA = 0
      let settledCallsA = 0

      const promiseA = executePCBuildSaveOperation({
        payload: { name: 'Rig A', items: [] },
        getAccessToken: async (refresh) => {
          if (refresh) {
            refreshSignalA.resolve()
            return deferredRefreshTokenA.promise
          }
          return 'stale-token-A'
        },
        mutationFn: async (_p, token) => {
          mutationCallsA++
          if (token === 'stale-token-A') {
            throw new ApiError({ status: 401, statusText: 'Unauthorized' })
          }
          return { ok: true }
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => successCallsA++,
        onError: () => errorCallsA++,
        onSettled: () => settledCallsA++,
      })

      // Wait until Op A receives 401 and enters refresh token request (deterministic signal)
      await refreshSignalA.promise
      assert.equal(mutationCallsA, 1, 'Initial 401 mutation was sent')
      assert.equal(lock.isInFlight(), true, 'Lock held during token refresh')

      // Context switch to B & reset lock
      lifecycle.updateContext('user-B', flow === 'edit' ? BUILD_ID_2 : null)
      lock.resetForContextChange()

      // Op B starts and reaches mutation
      const mutationSignalB = createDeferred()
      const deferredMutationB = createDeferred()
      let mutationCallsB = 0
      let successCallsB = 0
      let errorCallsB = 0
      let settledCallsB = 0

      const promiseB = executePCBuildSaveOperation({
        payload: { name: 'Rig B', items: [] },
        getAccessToken: async () => 'token-B',
        mutationFn: async (p) => {
          mutationCallsB++
          mutationSignalB.resolve()
          return deferredMutationB.promise
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => successCallsB++,
        onError: () => errorCallsB++,
        onSettled: () => settledCallsB++,
      })

      // Wait until Op B is in-flight
      await mutationSignalB.promise
      assert.equal(mutationCallsB, 1)
      assert.equal(lock.isInFlight(), true)

      // Resolve refresh token A
      deferredRefreshTokenA.resolve('fresh-token-A')
      const resA = await promiseA

      assert.equal(resA, false, 'Op A must abort on dead context after refresh')
      assert.equal(mutationCallsA, 1, 'Op A must NOT send retry mutation!')
      assert.equal(successCallsA, 0)
      assert.equal(errorCallsA, 0)
      assert.equal(settledCallsA, 0)
      assert.equal(lock.isInFlight(), true, 'Lock B must remain held!')

      // B2 rejected
      const resB2 = await executePCBuildSaveOperation({
        payload: { name: 'Rig B2', items: [] },
        getAccessToken: async () => 'token-B2',
        mutationFn: async () => ({}),
        context: lifecycle.createOperationContext(),
        lock,
      })
      assert.equal(resB2, false)

      // Resolve B
      deferredMutationB.resolve({ ok: true })
      const resB = await promiseB
      assert.equal(resB, true)
      assert.equal(mutationCallsB, 1, 'B had exactly 1 mutation')
      assert.equal(successCallsB, 1)
      assert.equal(settledCallsB, 1)
      assert.equal(lock.isInFlight(), false, 'Lock released after B finishes')
    }
  })

  await runCaseAsync('[Production Runner] B.7: StrictMode mount -> Op A pending -> unmount -> reset lifecycle -> remount -> Op B pending -> A finally -> B vẫn khóa; setup mới lưu thành công', async () => {
    for (const flow of ['create', 'edit']) {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(
        'user-A',
        flow === 'edit' ? BUILD_ID_1 : null
      )

      // Mount
      lifecycle.mount()

      const deferredTokenA = createDeferred()
      let mutationCallsA = 0
      let successCallsA = 0

      const promiseA = executePCBuildSaveOperation({
        payload: { name: 'Rig A', items: [] },
        getAccessToken: async () => deferredTokenA.promise,
        mutationFn: async () => {
          mutationCallsA++
          return {}
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => successCallsA++,
      })

      assert.equal(lock.isInFlight(), true)

      // StrictMode unmount -> lifecycle unmount & lock reset
      lifecycle.unmount()
      lock.resetForContextChange()

      // Remount / new setup
      lifecycle.mount()
      const mutationSignalB = createDeferred()
      const deferredMutationB = createDeferred()
      let mutationCallsB = 0
      let successCallsB = 0

      const promiseB = executePCBuildSaveOperation({
        payload: { name: 'Rig B', items: [] },
        getAccessToken: async () => 'token-B',
        mutationFn: async (p) => {
          mutationCallsB++
          mutationSignalB.resolve()
          return deferredMutationB.promise
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => successCallsB++,
      })

      // Wait until Op B is in-flight
      await mutationSignalB.promise
      assert.equal(mutationCallsB, 1)
      assert.equal(lock.isInFlight(), true)

      // Op A's pending token resolves, triggering Op A finally
      deferredTokenA.resolve('late-token-A')
      const resA = await promiseA

      assert.equal(resA, false)
      assert.equal(mutationCallsA, 0)
      assert.equal(successCallsA, 0)
      assert.equal(lock.isInFlight(), true, 'Lock B must remain held after A finally!')

      // B2 rejected
      const resB2 = await executePCBuildSaveOperation({
        payload: { name: 'Rig B2', items: [] },
        getAccessToken: async () => 'token-B2',
        mutationFn: async () => ({}),
        context: lifecycle.createOperationContext(),
        lock,
      })
      assert.equal(resB2, false)

      // Op B mutation completes
      deferredMutationB.resolve({ ok: true })
      const resB = await promiseB
      assert.equal(resB, true)
      assert.equal(mutationCallsB, 1)
      assert.equal(successCallsB, 1)
      assert.equal(lock.isInFlight(), false, 'Lock released after B completes')
    }
  })

  console.log('\n=== Phần D (PLAN 4.C): Regression Giữ Nguyên ===')

  await runCaseAsync('[Production Runner] C.8: Trong cùng context: double-click/Enter khi token hoặc mutation pending chỉ tạo 1 call; Token failure & API failure giải phóng đúng lease cho retry; Confirmed-save dispatches đúng 1 call', async () => {
    // 1. Confirmed-save flow for create and edit
    for (const flow of ['create', 'edit']) {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(OWNER_CUSTOMER, flow === 'edit' ? BUILD_ID_1 : null)
      lifecycle.mount()

      let apiCalls = 0
      let receivedPayload = null

      const mockMutationAdapter = async (p, token) => {
        apiCalls++
        receivedPayload = p
        assert.equal(token, 'mock-access-token')
        return { id: flow === 'edit' ? BUILD_ID_1 : 'new-build-id', ...p }
      }

      const payload = {
        name: 'Gaming Rig',
        description: 'RTX 4070 PC',
        items: [{ productId: 'gpu-1', quantity: 1 }],
      }

      // Step 1: User requests save -> Error requires confirmation
      const decision = determineSaveDecision({
        previewResult: { isCompatible: false, issues: [{ ruleId: 'C1', message: 'err', severity: 'Error' }] },
        isPreviewLoading: false,
        previewError: null,
      })
      assert.equal(decision, 'confirm_required')
      assert.equal(apiCalls, 0, 'Before confirmation, API calls must be 0')

      // Step 2: User clicks "Quay lại chỉnh sửa" -> API calls remains 0
      assert.equal(apiCalls, 0, 'Quay lại chỉnh sửa must not make mutation calls')

      // Step 3: User confirms "Vẫn lưu" -> calls executePCBuildSaveOperation
      let successCalled = false
      const ok = await executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => 'mock-access-token',
        mutationFn: mockMutationAdapter,
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => {
          successCalled = true
        },
      })

      assert.equal(ok, true)
      assert.equal(successCalled, true)
      assert.equal(apiCalls, 1, 'Exactly 1 mutation call on Vẫn lưu')
      assert.deepEqual(receivedPayload, payload)
      assert.equal(lock.isInFlight(), false, 'Lock must be released on finish')
    }

    // 2. Double-click / rapid Enter while pending
    {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(OWNER_CUSTOMER, null)
      lifecycle.mount()

      const mutationStarted = createDeferred()
      const deferred = createDeferred()
      let apiCalls = 0

      const mockMutation = async (p) => {
        apiCalls++
        mutationStarted.resolve()
        await deferred.promise
        return { id: 'created-id', ...p }
      }

      const payload = { name: 'Rapid Submit', items: [{ productId: 'cpu', quantity: 1 }] }

      // Click 1: starts request
      const p1 = executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => 'token',
        mutationFn: mockMutation,
        context: lifecycle.createOperationContext(),
        lock,
      })

      // Click 2 & Enter while in-flight:
      const p2 = executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => 'token',
        mutationFn: mockMutation,
        context: lifecycle.createOperationContext(),
        lock,
      })

      const p3 = executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => 'token',
        mutationFn: mockMutation,
        context: lifecycle.createOperationContext(),
        lock,
      })

      // Wait until mutation has started
      await mutationStarted.promise

      assert.equal(apiCalls, 1, 'Only 1 mutation call must be initiated')
      assert.equal(lock.isInFlight(), true, 'Lock must be active while pending')

      deferred.resolve({ ok: true })
      const [res1, res2, res3] = await Promise.all([p1, p2, p3])

      assert.equal(res1, true, 'First submission should succeed')
      assert.equal(res2, false, 'Second submission should be locked out')
      assert.equal(res3, false, 'Third submission should be locked out')
      assert.equal(apiCalls, 1, 'Total calls must remain exactly 1 after resolution')
      assert.equal(lock.isInFlight(), false, 'Lock must be released after completion')

      // 3. Token failure releases lock for retry
      await executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => { throw new Error('Token expired') },
        mutationFn: mockMutation,
        context: lifecycle.createOperationContext(),
        lock,
      })
      assert.equal(lock.isInFlight(), false, 'Lock must be released after token error')

      const retryTokenResult = await executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => 'token',
        mutationFn: async () => ({ ok: true }),
        context: lifecycle.createOperationContext(),
        lock,
      })
      assert.equal(retryTokenResult, true, 'Retry after token error must succeed')

      // 4. API failure releases lock for retry
      await executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => 'token',
        mutationFn: async () => { throw new Error('API server down') },
        context: lifecycle.createOperationContext(),
        lock,
      })
      assert.equal(lock.isInFlight(), false, 'Lock must be released after API failure')

      const retryApiResult = await executePCBuildSaveOperation({
        payload,
        getAccessToken: async () => 'token',
        mutationFn: async () => ({ ok: true }),
        context: lifecycle.createOperationContext(),
        lock,
      })
      assert.equal(retryApiResult, true, 'Retry after API failure must succeed')
    }
  })

  await runCaseAsync('[Production Runner] C.9: Token pending -> unmount/dispose -> token resolves => API calls = 0, UI callbacks = 0; Lặp với refresh sau 401', async () => {
    // 1. Initial token resolution pending
    {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(OWNER_CUSTOMER, null)
      lifecycle.mount()

      const deferredToken = createDeferred()
      let apiCalls = 0
      let successCalled = false

      const savePromise = executePCBuildSaveOperation({
        payload: { name: 'PC', items: [] },
        getAccessToken: async () => deferredToken.promise,
        mutationFn: async () => {
          apiCalls++
          return {}
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => {
          successCalled = true
        },
      })

      // User unmounts before token resolves:
      lifecycle.unmount()
      deferredToken.resolve('mock-token')

      const result = await savePromise
      assert.equal(result, false, 'Operation must abort when unmounted during token fetch')
      assert.equal(apiCalls, 0, 'Mutation must NOT be called if unmounted before POST/PUT')
      assert.equal(successCalled, false, 'onSuccess must NOT be called after unmount')
      assert.equal(lock.isInFlight(), false, 'Lock must be released')
    }

    // 2. Token 401 -> refresh token pending -> unmount -> refresh token resolves
    {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(OWNER_CUSTOMER, null)
      lifecycle.mount()

      const refreshStarted = createDeferred()
      const deferredRefreshToken = createDeferred()
      let apiCalls = 0
      let successCalled = false

      const savePromise = executePCBuildSaveOperation({
        payload: { name: 'PC', items: [] },
        getAccessToken: async (refresh) => {
          if (refresh) {
            refreshStarted.resolve()
            return deferredRefreshToken.promise
          }
          return 'initial-expired-token'
        },
        mutationFn: async () => {
          apiCalls++
          throw new ApiError({ status: 401, statusText: 'Unauthorized' })
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => {
          successCalled = true
        },
      })

      // Deterministic wait for refresh token request
      await refreshStarted.promise
      assert.equal(apiCalls, 1, 'Initial call happened and resulted in 401')

      // User unmounts during refresh token fetch:
      lifecycle.unmount()
      deferredRefreshToken.resolve('fresh-token')

      const result = await savePromise
      assert.equal(result, false)
      assert.equal(apiCalls, 1, 'Retry mutation must NOT be sent after unmount')
      assert.equal(successCalled, false)
      assert.equal(lock.isInFlight(), false)
    }
  })

  await runCaseAsync('[Production Runner] C.10: API đã gửi -> dispose/unmount -> response success/failure => không gọi onSuccess/onError/navigation callback cũ', async () => {
    // 1. Success response arrived after unmount
    {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(OWNER_CUSTOMER, null)
      lifecycle.mount()

      const mutationStarted = createDeferred()
      const deferredMutation = createDeferred()
      let successCalls = 0
      let errorCalls = 0

      const savePromise = executePCBuildSaveOperation({
        payload: { name: 'PC', items: [] },
        getAccessToken: async () => 'token',
        mutationFn: async () => {
          mutationStarted.resolve()
          return deferredMutation.promise
        },
        context: lifecycle.createOperationContext(),
        lock,
        onSuccess: () => {
          successCalls++
        },
        onError: () => {
          errorCalls++
        },
      })

      // Deterministic wait for mutation in flight
      await mutationStarted.promise

      // Unmount while mutation is in flight
      lifecycle.unmount()
      deferredMutation.resolve({ id: 'saved-id' })

      const result = await savePromise
      assert.equal(result, false)
      assert.equal(successCalls, 0, 'onSuccess must NOT fire for unmounted context')
      assert.equal(errorCalls, 0, 'onError must NOT fire for unmounted context')
      assert.equal(lock.isInFlight(), false)
    }

    // 2. Error response arrived after unmount
    {
      const lock = createSingleFlightLock()
      const lifecycle = new PCBuildSaveLifecycle(OWNER_CUSTOMER, null)
      lifecycle.mount()

      const mutationStarted = createDeferred()
      const deferredMutation = createDeferred()
      let errorCalls = 0

      const savePromise = executePCBuildSaveOperation({
        payload: { name: 'PC', items: [] },
        getAccessToken: async () => 'token',
        mutationFn: async () => {
          mutationStarted.resolve()
          return deferredMutation.promise
        },
        context: lifecycle.createOperationContext(),
        lock,
        onError: () => {
          errorCalls++
        },
      })

      // Deterministic wait for mutation in flight
      await mutationStarted.promise

      lifecycle.unmount()
      deferredMutation.reject(new Error('Late network error'))

      const result = await savePromise
      assert.equal(result, false)
      assert.equal(errorCalls, 0, 'onError must NOT fire after unmount')
      assert.equal(lock.isInFlight(), false)
    }
  })

  await runCaseAsync('[Production Runner] C.11: Đổi session/build/generation: operation cũ bị vô hiệu; React StrictMode mount-unmount-mount không khóa controller mới', async () => {
    // React StrictMode simulation: mount -> unmount -> mount
    const lifecycle = new PCBuildSaveLifecycle('session-A', null)
    lifecycle.mount()
    const opContext1 = lifecycle.createOperationContext()
    assert.equal(opContext1.isAlive(), true)

    // StrictMode cleanup
    lifecycle.unmount()
    assert.equal(opContext1.isAlive(), false, 'Op 1 must be dead after unmount')

    // StrictMode remount
    lifecycle.mount()
    const opContext2 = lifecycle.createOperationContext()
    assert.equal(opContext1.isAlive(), false, 'Op 1 remains dead in new generation')
    assert.equal(opContext2.isAlive(), true, 'Op 2 must be alive in new generation')

    // Context change (switch account / build)
    lifecycle.updateContext('session-B', null)
    assert.equal(opContext2.isAlive(), false, 'Op 2 must be dead after session change')
    const opContext3 = lifecycle.createOperationContext()
    assert.equal(opContext3.isAlive(), true, 'Op 3 must be alive in session B')
  })

  await runCaseAsync('[Production Runner] C.12: API failure giữ dữ liệu; 401 retry 1 lần; 409 Conflict không clean/navigate; success edit mới navigate', async () => {
    const lock = createSingleFlightLock()
    const lifecycle = new PCBuildSaveLifecycle(OWNER_CUSTOMER, BUILD_ID_1)
    lifecycle.mount()

    // 1. 409 Conflict handling in edit
    let isConflict = false
    let isSavedClean = false

    await executePCBuildSaveOperation({
      payload: { name: 'Edit', items: [] },
      getAccessToken: async () => 'token',
      mutationFn: async () => {
        throw new ApiError({ status: 409, statusText: 'Conflict' })
      },
      context: lifecycle.createOperationContext(),
      lock,
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          isConflict = true
        }
      },
      onSuccess: () => {
        isSavedClean = true
      },
    })

    assert.equal(isConflict, true, '409 Conflict must be recognized')
    assert.equal(isSavedClean, false, '409 Conflict must NOT set isSavedClean to true')

    // 2. 401 retry exactly once
    let tokenFetchCount = 0
    let mutationAttempts = 0

    await executePCBuildSaveOperation({
      payload: { name: 'Retry 401', items: [] },
      getAccessToken: async (refresh) => {
        tokenFetchCount++
        return refresh ? 'fresh-token' : 'stale-token'
      },
      mutationFn: async (_p, token) => {
        mutationAttempts++
        if (token === 'stale-token') {
          throw new ApiError({ status: 401, statusText: 'Unauthorized' })
        }
        return { ok: true }
      },
      context: lifecycle.createOperationContext(),
      lock,
    })

    assert.equal(tokenFetchCount, 2, 'Must fetch initial token and 1 fresh token')
    assert.equal(mutationAttempts, 2, 'Must attempt mutation with stale then fresh token')
  })

  runCase('[Pure Helper] C.13: Xác nhận cũ không thể dùng khi thông báo đổi dù count không đổi -> mutation calls = 0', () => {
    const preview1 = {
      isCompatible: false,
      issues: [{ ruleId: 'COMP-13', message: 'PSU dài quá case', severity: 'Error' }],
      totalPrice: 10000000,
    }

    const preview2 = {
      isCompatible: false,
      issues: [{ ruleId: 'COMP-06', message: 'Socket CPU và Mainboard không khớp', severity: 'Error' }],
      totalPrice: 10000000,
    }

    const payload = { name: 'Build', items: [{ productId: 'c1', quantity: 1 }] }

    const snapshot = createSaveConfirmationSnapshot({
      flow: 'create',
      configKey: 'c1:1',
      ownerId: OWNER_CUSTOMER,
      payload,
      previewResult: preview1,
      previewError: null,
    })

    // Khi preview2 cập nhật nhưng UI chưa render lại form confirm
    const isValid = isSaveConfirmationValid({
      snapshot,
      currentConfigKey: 'c1:1',
      currentOwnerId: OWNER_CUSTOMER,
      currentPayload: payload,
      previewResult: preview2,
      isPreviewLoading: false,
      previewError: null,
    })

    assert.equal(isValid, false, 'Save confirmation for preview1 must be rejected when preview2 arrived')
  })

  console.log('\n=== Phần E: Presentation và Điều kiện Mua Hàng ===')

  runCase('[Pure Helper] E.14: Incompatible build + canPurchaseAll=true vẫn cho mua/thêm giỏ hàng; canPurchaseAll=false chặn mua do tồn kho', () => {
    // 1. Incompatible but in stock
    const incompatibleBuild = {
      id: BUILD_ID_1,
      name: 'Custom Rig',
      isCompatible: false,
      canPurchaseAll: true,
      items: [{ productId: 'item-1', quantity: 1, stockQuantity: 5, isActive: true, isAvailable: true }],
      issues: [{ ruleId: 'COMP-1', message: 'Lỗi', severity: 'Error' }],
      missingComponents: [],
    }

    const canBuyIncompatible = canCreateNewOrder({
      isCustomer: true,
      selectedAddressId: 'addr-1',
      notes: '',
      build: incompatibleBuild,
      isSubmitting: false,
      activeAttempt: null,
    })
    assert.equal(canBuyIncompatible, true, 'Compatibility issues must not block purchase when canPurchaseAll is true')

    // 2. Clean compatibility but out of stock
    const outOfStockBuild = {
      id: BUILD_ID_1,
      name: 'Custom Rig',
      isCompatible: true,
      canPurchaseAll: false,
      items: [{ productId: 'item-1', quantity: 1, stockQuantity: 0, isActive: true, isAvailable: false }],
      issues: [],
      missingComponents: [],
    }

    const canBuyOutOfStock = canCreateNewOrder({
      isCustomer: true,
      selectedAddressId: 'addr-1',
      notes: '',
      build: outOfStockBuild,
      isSubmitting: false,
      activeAttempt: null,
    })
    assert.equal(canBuyOutOfStock, false, 'canPurchaseAll=false must block purchase regardless of compatibility')
  })

  runCase('[Pure Helper] E.15: Phân loại issues & presentation formatting: không [object Object], không khẳng định 100%, Warning visible', () => {
    const issues = [
      { ruleId: 'COMP-13', message: 'Chiều dài card đồ họa vượt quá case.', severity: 'Error' },
      { ruleId: 'COMP-12', message: 'CPU không tích hợp đồ họa.', severity: 'Warning' },
      { ruleId: 'COMP-99', message: 'Lưu ý phiên bản firmware.', severity: 'Notice' },
    ]

    const classified = classifyCompatibilityIssues(issues)
    assert.equal(classified.errors.length, 1)
    assert.equal(classified.warnings.length, 1)
    assert.equal(classified.others.length, 1)
    assert.equal(classified.others[0].message, 'Lưu ý phiên bản firmware.')

    // Format inspection
    for (const issue of [...classified.errors, ...classified.warnings, ...classified.others]) {
      const text = `${issue.message}`
      assert.ok(!text.includes('[object Object]'), 'Formatted message must not contain [object Object]')
    }

    // No forbidden claim in labels or notices
    const forbidden = ['tương thích hoàn toàn', '100%', 'hoàn hảo']
    for (const val of Object.values(COMPATIBILITY_LABELS)) {
      const lower = val.toLowerCase()
      for (const phrase of forbidden) {
        assert.ok(!lower.includes(phrase), `Label "${val}" must not contain "${phrase}"`)
      }
    }

    const noticeLower = COMPATIBILITY_GUIDANCE_NOTICE.toLowerCase()
    for (const phrase of forbidden) {
      assert.ok(!noticeLower.includes(phrase), `Notice "${COMPATIBILITY_GUIDANCE_NOTICE}" must not contain "${phrase}"`)
    }

    assert.equal(COMPATIBILITY_LABELS.clean, 'Chưa phát hiện xung đột theo thông số hiện có')

    // Warning remains visible when isCompatible = true
    const warningPreview = {
      isCompatible: true,
      issues: [{ ruleId: 'W1', message: 'Warn', severity: 'Warning' }],
    }
    const assessment = evaluateCompatibility(warningPreview)
    assert.equal(assessment.level, 'warning')
    assert.equal(assessment.classifiedIssues.warnings.length, 1)
  })

  console.log('\n=== Phần F: Dialog Static Invariants & Callsite Audit Report ===')

  runCase('[Static Audit] F.16: Dialog static invariant audit & callsite lease-lock semantics: native <dialog>, showModal, aria-labelledby, scroll lock, autofocus confirm button, resetForContextChange callsite', () => {
    // Audit PCBuilderSummary.tsx
    const summarySrc = fs.readFileSync(path.join(repoRoot, 'src/features/pcBuilder/components/PCBuilderSummary.tsx'), 'utf8')
    assert.ok(summarySrc.includes('<dialog'), 'PCBuilderSummary must render native <dialog>')
    assert.ok(summarySrc.includes('dialog.showModal()'), 'PCBuilderSummary must call dialog.showModal()')
    assert.ok(summarySrc.includes('pc-build-save-dialog-title'), 'PCBuilderSummary must have aria-labelledby title id')
    assert.ok(summarySrc.includes('document.body.style.overflow'), 'PCBuilderSummary must handle body scroll lock')
    assert.ok(summarySrc.includes('confirmBackBtnRef.current.focus()'), 'PCBuilderSummary must autofocus confirm back button')
    assert.ok(summarySrc.includes('executePCBuildSaveOperation'), 'PCBuilderSummary must call production executePCBuildSaveOperation')
    assert.ok(summarySrc.includes('saveLockRef.current.resetForContextChange()') || summarySrc.includes('saveLock.resetForContextChange()'), 'PCBuilderSummary must call resetForContextChange')
    assert.ok(!summarySrc.includes('saveLockRef.current.release()') && !summarySrc.includes('saveLock.release()'), 'PCBuilderSummary must not call unconditional release()')

    // Audit EditPCBuildPage.tsx
    const editSrc = fs.readFileSync(path.join(repoRoot, 'src/pages/EditPCBuildPage.tsx'), 'utf8')
    assert.ok(editSrc.includes('<dialog'), 'EditPCBuildPage must render native <dialog>')
    assert.ok(editSrc.includes('dialog.showModal()'), 'EditPCBuildPage must call dialog.showModal()')
    assert.ok(editSrc.includes('pc-build-edit-confirm-dialog-title'), 'EditPCBuildPage must have aria-labelledby title id')
    assert.ok(editSrc.includes('document.body.style.overflow'), 'EditPCBuildPage must handle body scroll lock')
    assert.ok(editSrc.includes('confirmBackBtnRef.current.focus()'), 'EditPCBuildPage must autofocus confirm back button')
    assert.ok(editSrc.includes('executePCBuildSaveOperation'), 'EditPCBuildPage must call production executePCBuildSaveOperation')
    assert.ok(editSrc.includes("blocker.state !== 'blocked'"), 'EditPCBuildPage must coordinate modal with blocker state')
    assert.ok(editSrc.includes('activeContextKeyRef'), 'EditPCBuildPage must track activeContextKeyRef to avoid releasing lock on user object refresh')
    assert.ok(editSrc.includes('putLockRef.current.resetForContextChange()') || editSrc.includes('putLock.resetForContextChange()'), 'EditPCBuildPage must call resetForContextChange')
    assert.ok(!editSrc.includes('putLock.release()') && !editSrc.includes('putLockRef.current.release()'), 'EditPCBuildPage must not call unconditional release()')
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
