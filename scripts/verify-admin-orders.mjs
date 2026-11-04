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
  path.join(os.tmpdir(), 'riutek-admin-orders-verify-')
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
        if (spec === '../../lib/api' || spec === '../lib/api') {
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
  'src/features/admin/adminTypes.ts',
  'src/features/admin/adminConstants.ts',
  'src/features/admin/adminGuardHelper.ts',
  'src/features/admin/adminApi.ts',
  'src/features/admin/adminOrderHelper.ts',
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
  const orderConstantsMod = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/orders/orderConstants.mjs'))
      .href
  )
  const guardMod = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/admin/adminGuardHelper.mjs'))
      .href
  )
  const adminApiMod = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/admin/adminApi.mjs')).href
  )
  const adminOrderMod = await import(
    pathToFileURL(path.join(tempRoot, 'src/features/admin/adminOrderHelper.mjs'))
      .href
  )

  const { ApiError } = apiMod
  const { UserRole } = authTypesMod

  const ORDER_ID_A = '11111111-1111-4111-8111-111111111111'
  const ORDER_ID_B = '22222222-2222-4222-8222-222222222222'

  function makeDetailDto(overrides = {}) {
    return {
      id: ORDER_ID_A,
      orderNumber: 'ORD-20261104-001',
      status: 'Confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      currency: 'VND',
      customerName: 'Nguyễn Văn A',
      customerEmail: 'nguyenvana@example.com',
      customerPhone: '0901234567',
      shippingAddress: '123 Lê Lợi, Quận 1, TP.HCM',
      totalAmount: 15000000,
      discountAmount: 500000,
      finalAmount: 14500000,
      notes: 'Giao giờ hành chính <script>alert(1)</script>',
      createdAt: '2026-11-04T08:00:00Z',
      items: [
        {
          productId: '33333333-3333-4333-8333-333333333333',
          productName: 'AMD Ryzen 7 7800X3D (Snapshot)',
          productSku: 'CPU-R7-7800X3D',
          unitPrice: 10000000,
          quantity: 1,
          totalPrice: 10000000,
        },
        {
          productId: '44444444-4444-4444-8444-444444444444',
          productName: 'RAM DDR5 32GB 6000MHz (Snapshot)',
          productSku: 'RAM-D5-32G',
          unitPrice: 2500000,
          quantity: 2,
          totalPrice: 5000000,
        },
      ],
      ...overrides,
    }
  }

  function makeSummaryDto(overrides = {}) {
    return {
      id: ORDER_ID_A,
      orderNumber: 'ORD-20261104-001',
      status: 'Confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      customerName: 'Nguyễn Văn A',
      customerEmail: 'nguyenvana@example.com',
      customerPhone: '0901234567',
      currency: 'VND',
      finalAmount: 14500000,
      itemCount: 2,
      createdAt: '2026-11-04T08:00:00Z',
      updatedAt: null,
      ...overrides,
    }
  }

  // ============================================================================
  // GROUP 1: Auth / Staff Guard, Role Badge, 401 Single-Refresh, 403 No-Retry, Account Switch
  // ============================================================================
  console.log('--- [1/8] Testing Auth/Staff Guard, Role Badge & Token Refresh ---')
  {
    // Badge labels: Staff must NOT be labeled "Admin"
    assert.equal(
      guardMod.getAdminRoleBadgeLabel(UserRole.Staff),
      'Nhân viên'
    )
    assert.equal(guardMod.getAdminRoleBadgeLabel('Staff'), 'Nhân viên')
    assert.equal(
      guardMod.getAdminRoleBadgeLabel(UserRole.Admin),
      'Quản trị viên'
    )
    assert.equal(guardMod.getAdminRoleBadgeLabel('Admin'), 'Quản trị viên')

    // Access resolution for checking / unavailable / guest / Customer / Staff / Admin
    for (const nonAllowed of [
      {
        authStatus: 'checking',
        isAuthenticated: false,
        user: null,
        expected: 'checking',
      },
      {
        authStatus: 'unavailable',
        isAuthenticated: false,
        user: null,
        expected: 'unavailable',
      },
      {
        authStatus: 'anonymous',
        isAuthenticated: false,
        user: null,
        expected: 'redirect_login',
      },
      {
        authStatus: 'authenticated',
        isAuthenticated: true,
        user: { id: 'cust-1', role: UserRole.Customer },
        expected: 'forbidden',
      },
    ]) {
      const res = guardMod.resolveAdminAccessState({
        authStatus: nonAllowed.authStatus,
        isAuthenticated: nonAllowed.isAuthenticated,
        user: nonAllowed.user,
        currentPathWithSearch: '/admin/orders?status=Confirmed',
      })
      assert.equal(res.status, nonAllowed.expected)
      assert.equal(res.canExecuteAdminAction, false)

      let privateCalls = 0
      await assert.rejects(async () => {
        await guardMod.executeWithAdminAuth({
          authStatus: nonAllowed.authStatus,
          user: nonAllowed.user,
          getAccessToken: async () => 'token',
          operation: async () => {
            privateCalls += 1
            return 'ok'
          },
        })
      })
      assert.equal(privateCalls, 0, 'Must never call private API for non-manager')
    }

    // Both Admin and Staff are allowed to call all 3 managed APIs
    for (const role of [UserRole.Admin, UserRole.Staff]) {
      const res = guardMod.resolveAdminAccessState({
        authStatus: 'authenticated',
        isAuthenticated: true,
        user: { id: `mgr-${role}`, role },
        currentPathWithSearch: '/admin/orders',
      })
      assert.equal(res.status, 'allowed')
      assert.equal(res.canExecuteAdminAction, true)
    }

    // 401 refreshes token at most once; 403 never retries
    let tokenCalls = []
    let opCalls401 = 0
    const resAfterRefresh = await guardMod.executeWithAdminAuth({
      authStatus: 'authenticated',
      user: { id: 'staff-1', role: UserRole.Staff },
      getAccessToken: async (forceRefresh) => {
        tokenCalls.push(forceRefresh)
        return forceRefresh ? 'fresh-token' : 'stale-token'
      },
      operation: async (token) => {
        opCalls401 += 1
        if (token === 'stale-token') {
          throw new ApiError({ status: 401, message: 'Unauthorized' })
        }
        return `success-with-${token}`
      },
    })
    assert.equal(resAfterRefresh, 'success-with-fresh-token')
    assert.deepEqual(tokenCalls, [false, true])
    assert.equal(opCalls401, 2)

    // 403 must NOT retry or force refresh
    let tokenCalls403 = []
    let opCalls403 = 0
    await assert.rejects(
      async () => {
        await guardMod.executeWithAdminAuth({
          authStatus: 'authenticated',
          user: { id: 'staff-1', role: UserRole.Staff },
          getAccessToken: async (forceRefresh) => {
            tokenCalls403.push(forceRefresh)
            return 'valid-token'
          },
          operation: async () => {
            opCalls403 += 1
            throw new ApiError({
              status: 403,
              code: 'OrderManagement.Forbidden',
              message: 'Forbidden',
            })
          },
        })
      },
      (err) => err instanceof ApiError && err.status === 403
    )
    assert.deepEqual(tokenCalls403, [false])
    assert.equal(opCalls403, 1)

    // Switching user while waiting for token refresh aborts before second operation call
    let currentOwner = 'staff-1'
    let opCallsSwitch = 0
    await assert.rejects(
      async () => {
        await guardMod.executeWithAdminAuth({
          authStatus: 'authenticated',
          user: { id: 'staff-1', role: UserRole.Staff },
          isContextCurrent: () => currentOwner === 'staff-1',
          getAccessToken: async (forceRefresh) => {
            if (forceRefresh) {
              currentOwner = 'staff-2'
            }
            return 'token'
          },
          operation: async () => {
            opCallsSwitch += 1
            throw new ApiError({ status: 401, message: 'Expired' })
          },
        })
      },
      (err) => err.name === 'AbortError'
    )
    assert.equal(opCallsSwitch, 1)
  }

  // ============================================================================
  // GROUP 2: API Contract Verification (GET /orders/admin, GET /orders/admin/{id}, PATCH /orders/admin/{id}/status)
  // ============================================================================
  console.log('--- [2/8] Testing 3 Managed Order API Contracts ---')
  {
    const origFetch = globalThis.fetch
    const recordedRequests = []

    try {
      globalThis.fetch = async (url, init) => {
        const headers = new Headers(init?.headers)
        recordedRequests.push({
          url: String(url),
          method: init?.method ?? 'GET',
          auth: headers.get('Authorization'),
          contentType: headers.get('Content-Type'),
          body: init?.body ? JSON.parse(String(init.body)) : null,
        })

        if (String(url).includes('/status')) {
          return new Response(
            JSON.stringify(makeDetailDto({ status: 'Processing' })),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        }

        if (String(url).includes(`/orders/admin/${ORDER_ID_A}`)) {
          return new Response(JSON.stringify(makeDetailDto()), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(
          JSON.stringify({
            items: [makeSummaryDto()],
            pageIndex: 2,
            pageSize: 20,
            totalCount: 25,
            totalPages: 2,
            hasPreviousPage: true,
            hasNextPage: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 2a. GET /orders/admin with filters & search trimmed to <= 150 chars
      const longSearch = `  ${'A'.repeat(170)}  `
      const listRes = await adminApiMod.getManagedOrders(
        {
          pageIndex: 2,
          pageSize: 20,
          status: 'Confirmed',
          paymentMethod: 'COD',
          paymentStatus: 'Pending',
          search: longSearch,
        },
        'jwt-staff-token'
      )
      assert.equal(listRes.items.length, 1)
      assert.equal('totalAmount' in listRes.items[0], false)
      assert.equal('shippingAddress' in listRes.items[0], false)
      assert.equal('items' in listRes.items[0], false)

      const req1 = recordedRequests[0]
      assert.ok(req1.url.startsWith('/api/v1/orders/admin?'))
      assert.ok(!req1.url.startsWith('/api/v1/orders?'))
      const parsedUrl1 = new URL(req1.url, 'http://localhost')
      assert.equal(parsedUrl1.searchParams.get('pageIndex'), '2')
      assert.equal(parsedUrl1.searchParams.get('pageSize'), '20')
      assert.equal(parsedUrl1.searchParams.get('status'), 'Confirmed')
      assert.equal(parsedUrl1.searchParams.get('paymentMethod'), 'COD')
      assert.equal(parsedUrl1.searchParams.get('paymentStatus'), 'Pending')
      assert.equal(parsedUrl1.searchParams.get('search')?.length, 150)

      // 2b. GET /orders/admin when filters are undefined ("All"): must omit optional params
      await adminApiMod.getManagedOrders({}, 'jwt-staff-token')
      const req2 = recordedRequests[1]
      const parsedUrl2 = new URL(req2.url, 'http://localhost')
      assert.equal(parsedUrl2.searchParams.get('pageIndex'), '1')
      assert.equal(parsedUrl2.searchParams.get('pageSize'), '20')
      assert.equal(parsedUrl2.searchParams.has('status'), false)
      assert.equal(parsedUrl2.searchParams.has('paymentMethod'), false)
      assert.equal(parsedUrl2.searchParams.has('paymentStatus'), false)
      assert.equal(parsedUrl2.searchParams.has('search'), false)

      // 2c. GET /orders/admin/{id} uses /orders/admin/{id} and rejects non-UUID
      await assert.rejects(
        () => adminApiMod.getManagedOrderById('not-a-uuid', 'jwt-staff-token'),
        (err) => err instanceof ApiError && err.status === 400
      )
      const detailRes = await adminApiMod.getManagedOrderById(
        ORDER_ID_A,
        'jwt-staff-token'
      )
      assert.equal(detailRes.id, ORDER_ID_A)
      assert.equal(
        recordedRequests[2].url,
        `/api/v1/orders/admin/${ORDER_ID_A}`
      )

      // 2d. PATCH /orders/admin/{id}/status sends exact JSON { expectedStatus, newStatus }
      const patchRes = await adminApiMod.updateManagedOrderStatus(
        ORDER_ID_A,
        {
          expectedStatus: 'Confirmed',
          newStatus: 'Processing',
        },
        'jwt-staff-token'
      )
      assert.equal(patchRes.status, 'Processing')
      const reqPatch = recordedRequests[3]
      assert.equal(reqPatch.method, 'PATCH')
      assert.equal(
        reqPatch.url,
        `/api/v1/orders/admin/${ORDER_ID_A}/status`
      )
      assert.equal(reqPatch.contentType, 'application/json')
      assert.deepEqual(reqPatch.body, {
        expectedStatus: 'Confirmed',
        newStatus: 'Processing',
      })
    } finally {
      globalThis.fetch = origFetch
    }
  }

  // ============================================================================
  // GROUP 3: Table-Driven Action Matrix (7 OrderStatus × 3 PaymentMethod × 4 PaymentStatus + Unknown Enums)
  // ============================================================================
  console.log('--- [3/8] Testing 7x3x4 Action Matrix + Unknown Enums ---')
  {
    let testedCombinations = 0

    for (const status of adminOrderMod.VALID_ORDER_STATUSES) {
      for (const paymentMethod of adminOrderMod.VALID_PAYMENT_METHODS) {
        for (const paymentStatus of adminOrderMod.VALID_PAYMENT_STATUSES) {
          testedCombinations += 1
          const resolution = adminOrderMod.resolveManagedOrderActions({
            status,
            paymentMethod,
            paymentStatus,
          })

          const targets = resolution.actions.map((a) => a.targetStatus)
          const isOnlinePaid =
            paymentMethod !== 'COD' && paymentStatus === 'Completed'

          if (status === 'PendingPayment') {
            assert.deepEqual(targets, [])
            assert.equal(resolution.canMutate, false)
            assert.equal(resolution.isReadOnly, true)
            if (paymentMethod === 'Stripe' && paymentStatus === 'Pending') {
              assert.ok(
                resolution.stripePendingNotice?.includes(
                  'Chờ khách hoàn tất thanh toán'
                )
              )
            }
          } else if (status === 'Confirmed') {
            if (isOnlinePaid) {
              assert.deepEqual(targets, ['Processing'])
              assert.equal(
                resolution.paidOnlineCancelNotice,
                adminOrderMod.PAID_ONLINE_CANCEL_UNSUPPORTED_NOTICE
              )
            } else {
              assert.deepEqual(targets, ['Processing', 'Cancelled'])
              assert.equal(resolution.paidOnlineCancelNotice, null)
            }
            assert.equal(resolution.canMutate, true)
          } else if (status === 'Processing') {
            if (isOnlinePaid) {
              assert.deepEqual(targets, ['Shipping'])
              assert.equal(
                resolution.paidOnlineCancelNotice,
                adminOrderMod.PAID_ONLINE_CANCEL_UNSUPPORTED_NOTICE
              )
            } else {
              assert.deepEqual(targets, ['Shipping', 'Cancelled'])
              assert.equal(resolution.paidOnlineCancelNotice, null)
            }
            assert.equal(resolution.canMutate, true)
          } else if (status === 'Shipping') {
            assert.deepEqual(targets, ['Completed'])
            assert.equal(resolution.canMutate, true)
            if (paymentMethod === 'COD') {
              assert.equal(
                resolution.actions[0].confirmDescription,
                adminOrderMod.COD_COMPLETE_CONFIRM_MESSAGE
              )
            }
          } else {
            // Completed, Cancelled, Refunded
            assert.deepEqual(targets, [])
            assert.equal(resolution.canMutate, false)
            assert.equal(resolution.isReadOnly, true)
          }

          // Customer helper must remain untouched and distinct
          const customerCancel = orderConstantsMod.canCustomerCancelOrder({
            status,
            paymentMethod,
            paymentStatus,
          })
          if (status === 'Processing' && paymentMethod === 'COD') {
            assert.equal(
              customerCancel,
              false,
              'Customer cannot cancel Processing COD, whereas Admin/Staff can'
            )
          }
        }
      }
    }
    assert.equal(testedCombinations, 7 * 3 * 4)

    // Unknown enums -> safe read-only, no crash, no guessed actions
    for (const unknownCase of [
      { status: 'AwaitingCourier', paymentMethod: 'COD', paymentStatus: 'Pending' },
      { status: 'Confirmed', paymentMethod: 'Crypto', paymentStatus: 'Pending' },
      { status: 'Confirmed', paymentMethod: 'Stripe', paymentStatus: 'Authorized' },
    ]) {
      const res = adminOrderMod.resolveManagedOrderActions(unknownCase)
      assert.equal(res.isKnownEnums, false)
      assert.equal(res.isReadOnly, true)
      assert.equal(res.canMutate, false)
      assert.deepEqual(res.actions, [])
    }
  }

  // ============================================================================
  // GROUP 4: COD Production Submit Flow (Confirmed -> Processing -> Shipping -> Completed & Cancel)
  // ============================================================================
  console.log('--- [4/8] Testing COD Production Submit Flow ---')
  {
    let serverOrder = makeDetailDto({
      status: 'Confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
    })
    const patchPayloads = []

    const coord = adminOrderMod.createManagedOrderDetailCoordinator({
      getContext: () => ({
        authStatus: 'authenticated',
        user: { id: 'admin-1', role: UserRole.Admin },
        getAccessToken: async () => 'token-admin',
        orderId: ORDER_ID_A,
      }),
      fetchOrderById: async () => ({ ...serverOrder }),
      patchOrderStatus: async (_id, body) => {
        patchPayloads.push(body)
        assert.equal(Object.keys(body).sort().join(','), 'expectedStatus,newStatus')
        assert.equal(serverOrder.status, body.expectedStatus)
        serverOrder = {
          ...serverOrder,
          status: body.newStatus,
          paymentStatus:
            body.newStatus === 'Completed' && serverOrder.paymentMethod === 'COD'
              ? 'Completed'
              : serverOrder.paymentStatus,
        }
        return { ...serverOrder }
      },
    })

    await coord.loadOrderDetail()
    assert.equal(coord.getState().order?.status, 'Confirmed')
    assert.equal(coord.getState().order?.paymentStatus, 'Pending')

    // Step 1: Confirmed -> Processing
    const snap1 = coord.openConfirmDialog('Processing')
    assert.ok(snap1)
    await coord.submitConfirmedStatusChange()
    assert.equal(coord.getState().order?.status, 'Processing')
    assert.equal(coord.getState().order?.paymentStatus, 'Pending')

    // Step 2: Processing -> Shipping
    const snap2 = coord.openConfirmDialog('Shipping')
    assert.ok(snap2)
    await coord.submitConfirmedStatusChange()
    assert.equal(coord.getState().order?.status, 'Shipping')
    assert.equal(coord.getState().order?.paymentStatus, 'Pending')

    // Step 3: Shipping -> Completed (BE marks COD paymentStatus Completed)
    const snap3 = coord.openConfirmDialog('Completed')
    assert.ok(snap3)
    assert.equal(
      snap3.confirmDescription,
      adminOrderMod.COD_COMPLETE_CONFIRM_MESSAGE
    )
    await coord.submitConfirmedStatusChange()
    assert.equal(coord.getState().order?.status, 'Completed')
    assert.equal(coord.getState().order?.paymentStatus, 'Completed')
    assert.deepEqual(patchPayloads, [
      { expectedStatus: 'Confirmed', newStatus: 'Processing' },
      { expectedStatus: 'Processing', newStatus: 'Shipping' },
      { expectedStatus: 'Shipping', newStatus: 'Completed' },
    ])

    // COD cancellation at Confirmed/Processing: sends only 1 PATCH, keeps paymentStatus Pending
    serverOrder = makeDetailDto({
      status: 'Processing',
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
    })
    await coord.loadOrderDetail()
    const cancelSnap = coord.openConfirmDialog('Cancelled')
    assert.ok(cancelSnap)
    await coord.submitConfirmedStatusChange()
    assert.equal(coord.getState().order?.status, 'Cancelled')
    assert.equal(coord.getState().order?.paymentStatus, 'Pending')
    assert.equal(patchPayloads.length, 4)
    coord.dispose()
  }

  // ============================================================================
  // GROUP 5: Stripe Flow (PendingPayment -> Webhook Confirmed/Completed -> Fulfillment; Conflict on Customer Cancel)
  // ============================================================================
  console.log('--- [5/8] Testing Stripe Production Flow & Webhook/Customer Cancel Conflict ---')
  {
    let serverOrder = makeDetailDto({
      status: 'PendingPayment',
      paymentMethod: 'Stripe',
      paymentStatus: 'Pending',
    })
    let patchCalls = 0

    const coord = adminOrderMod.createManagedOrderDetailCoordinator({
      getContext: () => ({
        authStatus: 'authenticated',
        user: { id: 'staff-1', role: UserRole.Staff },
        getAccessToken: async () => 'token-staff',
        orderId: ORDER_ID_A,
      }),
      fetchOrderById: async () => ({ ...serverOrder }),
      patchOrderStatus: async (_id, body) => {
        patchCalls += 1
        if (serverOrder.status !== body.expectedStatus) {
          throw new ApiError({
            status: 409,
            code: 'Order.StatusConflict',
            description: "Order status changed from the expected state.",
            message: 'Conflict',
          })
        }
        serverOrder = {
          ...serverOrder,
          status: body.newStatus,
        }
        return { ...serverOrder }
      },
    })

    await coord.loadOrderDetail()
    // PendingPayment cannot open any confirm dialog or submit
    assert.equal(coord.openConfirmDialog('Processing'), null)
    assert.equal(coord.openConfirmDialog('Cancelled'), null)
    assert.equal(await coord.submitConfirmedStatusChange(), null)
    assert.equal(patchCalls, 0)

    // Webhook completes payment -> admin reloads -> Confirmed + Completed
    serverOrder = makeDetailDto({
      status: 'Confirmed',
      paymentMethod: 'Stripe',
      paymentStatus: 'Completed',
    })
    await coord.loadOrderDetail()
    assert.equal(coord.getState().order?.status, 'Confirmed')
    assert.equal(coord.getState().order?.paymentStatus, 'Completed')

    // Paid Stripe order must NOT allow Cancelled
    assert.equal(coord.openConfirmDialog('Cancelled'), null)

    // Advance Confirmed -> Processing -> Shipping -> Completed keeping paymentStatus Completed
    for (const nextStatus of ['Processing', 'Shipping', 'Completed']) {
      assert.ok(coord.openConfirmDialog(nextStatus))
      await coord.submitConfirmedStatusChange()
      assert.equal(coord.getState().order?.status, nextStatus)
      assert.equal(coord.getState().order?.paymentStatus, 'Completed')
    }

    // Scenario: Staff opens dialog on Confirmed/Failed order, but webhook/customer changed order to Cancelled -> 409 -> auto reload -> Cancelled read-only
    serverOrder = makeDetailDto({
      status: 'Confirmed',
      paymentMethod: 'Stripe',
      paymentStatus: 'Failed',
    })
    await coord.loadOrderDetail()
    assert.ok(coord.openConfirmDialog('Processing'))

    // External transition to Cancelled happens before staff clicks confirm submit
    serverOrder = makeDetailDto({
      status: 'Cancelled',
      paymentMethod: 'Stripe',
      paymentStatus: 'Failed',
    })
    const res409 = await coord.submitConfirmedStatusChange()
    assert.equal(res409, null)
    assert.equal(coord.getState().confirmSnapshot, null)
    assert.equal(coord.getState().order?.status, 'Cancelled')
    assert.equal(coord.getState().isStale, false)
    assert.deepEqual(
      adminOrderMod.resolveManagedOrderActions(coord.getState().order).actions,
      []
    )
    coord.dispose()
  }

  // ============================================================================
  // GROUP 6: Concurrency, Double-Click, Out-of-Order GET vs PATCH, A->B->A, Account Switch & Unmount
  // ============================================================================
  console.log('--- [6/8] Testing Concurrency, Double-Click & Out-of-Order Guards ---')
  {
    // 6a. Double-click before rerender sends ONLY 1 PATCH; pending older GET resolving after PATCH never overwrites PATCH result
    let patchCount = 0
    const patchDef = createDeferred()
    const slowGetDef = createDeferred()
    let getCallNum = 0

    const coord = adminOrderMod.createManagedOrderDetailCoordinator({
      getContext: () => ({
        authStatus: 'authenticated',
        user: { id: 'admin-1', role: UserRole.Admin },
        getAccessToken: async () => 'token',
        orderId: ORDER_ID_A,
      }),
      fetchOrderById: async () => {
        getCallNum += 1
        if (getCallNum === 1) {
          return makeDetailDto({ status: 'Confirmed' })
        }
        return slowGetDef.promise
      },
      patchOrderStatus: async () => {
        patchCount += 1
        return patchDef.promise
      },
    })

    await coord.loadOrderDetail()
    coord.openConfirmDialog('Processing')

    // Start a slow GET before PATCH? No, if a slow GET is in flight and user submits, or if we test double-click on submitConfirmedStatusChange:
    const p1 = coord.submitConfirmedStatusChange()
    const p2 = coord.submitConfirmedStatusChange()

    patchDef.resolve(makeDetailDto({ status: 'Processing' }))
    const [r1, r2] = await Promise.all([p1, p2])
    assert.equal(patchCount, 1, 'Double click must only send 1 PATCH')
    assert.equal(r1?.status, 'Processing')
    assert.equal(r2, null)
    assert.equal(coord.getState().order?.status, 'Processing')
    coord.dispose()

    // 6b. Pending GET started before PATCH completes AFTER PATCH -> must NOT overwrite PATCH result;
    // also verify stale confirm dialog cannot update wrong order, and late finally after dispose/context switch does not mutate state.
    let fetchCount2 = 0
    const pendingGetDef = createDeferred()
    const patchDef2 = createDeferred()
    let currentOrderId2 = ORDER_ID_A

    const coord2 = adminOrderMod.createManagedOrderDetailCoordinator({
      getContext: () => ({
        authStatus: 'authenticated',
        user: { id: 'admin-1', role: UserRole.Admin },
        getAccessToken: async () => 'token',
        orderId: currentOrderId2,
      }),
      fetchOrderById: async () => {
        fetchCount2 += 1
        if (fetchCount2 === 1) {
          return makeDetailDto({ id: ORDER_ID_A, status: 'Confirmed' })
        }
        return pendingGetDef.promise
      },
      patchOrderStatus: async () => patchDef2.promise,
    })

    await coord2.loadOrderDetail()
    // Start a slow GET (fetchCount2 === 2) while order is already in state
    const slowGetPromise = coord2.loadOrderDetail()
    await Promise.resolve()
    // Open confirm dialog and submit PATCH while slow GET is still pending
    coord2.openConfirmDialog('Processing')
    const patchPromise2 = coord2.submitConfirmedStatusChange()

    // PATCH completes first with 'Processing'
    patchDef2.resolve(makeDetailDto({ id: ORDER_ID_A, status: 'Processing' }))
    await patchPromise2
    assert.equal(coord2.getState().order?.status, 'Processing')

    // Now the older slow GET resolves with stale 'Confirmed' -> must be ignored!
    pendingGetDef.resolve(makeDetailDto({ id: ORDER_ID_A, status: 'Confirmed' }))
    await slowGetPromise
    assert.equal(
      coord2.getState().order?.status,
      'Processing',
      'Older GET resolving after PATCH must never overwrite PATCH result'
    )

    // Stale confirm dialog opened on Order A must NOT update when orderId switches to Order B
    coord2.openConfirmDialog('Shipping')
    assert.equal(coord2.getState().confirmSnapshot?.orderId, ORDER_ID_A)
    currentOrderId2 = ORDER_ID_B
    const staleSubmitRes = await coord2.submitConfirmedStatusChange()
    assert.equal(staleSubmitRes, null)
    assert.equal(coord2.getState().confirmSnapshot, null)

    // 6c. List Filter A vs Filter B out-of-order response
    const listDefA = createDeferred()
    const listDefB = createDeferred()
    let listCallIdx = 0
    const listCoord = adminOrderMod.createManagedOrderListCoordinator({
      getAuthContext: () => ({
        authStatus: 'authenticated',
        user: { id: 'admin-1', role: UserRole.Admin },
        getAccessToken: async () => 'token',
      }),
      fetchOrders: async (params) => {
        listCallIdx += 1
        if (params.status === 'Confirmed') return listDefA.promise
        return listDefB.promise
      },
    })

    const loadAPromise = listCoord.loadOrders({
      pageIndex: 1,
      status: 'Confirmed',
      search: '',
    })
    const loadBPromise = listCoord.loadOrders({
      pageIndex: 1,
      status: 'Shipping',
      search: '',
    })

    // Filter B resolves first, then stale Filter A resolves later
    listDefB.resolve({
      items: [makeSummaryDto({ status: 'Shipping', orderNumber: 'ORD-B' })],
      pageIndex: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    })
    await loadBPromise
    assert.equal(listCoord.getState().data?.items[0].orderNumber, 'ORD-B')

    listDefA.resolve({
      items: [makeSummaryDto({ status: 'Confirmed', orderNumber: 'ORD-A' })],
      pageIndex: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    })
    await loadAPromise
    assert.equal(
      listCoord.getState().data?.items[0].orderNumber,
      'ORD-B',
      'Stale Filter A response must never overwrite Filter B'
    )
    listCoord.dispose()

    // 6d. Detail A -> B -> A and Account Switch / Unmount
    let activeOrderId = ORDER_ID_A
    let activeUserId = 'admin-1'
    const defA1 = createDeferred()
    const defB1 = createDeferred()
    const defA2 = createDeferred()
    let callSeq = 0

    const navCoord = adminOrderMod.createManagedOrderDetailCoordinator({
      getContext: () => ({
        authStatus: 'authenticated',
        user: { id: activeUserId, role: UserRole.Admin },
        getAccessToken: async () => 'token',
        orderId: activeOrderId,
      }),
      fetchOrderById: async () => {
        callSeq += 1
        if (callSeq === 1) return defA1.promise
        if (callSeq === 2) return defB1.promise
        return defA2.promise
      },
    })

    const pA1 = navCoord.loadOrderDetail()
    await Promise.resolve()
    activeOrderId = ORDER_ID_B
    const pB1 = navCoord.loadOrderDetail()
    await Promise.resolve()
    activeOrderId = ORDER_ID_A
    const pA2 = navCoord.loadOrderDetail()
    await Promise.resolve()

    defA2.resolve(makeDetailDto({ id: ORDER_ID_A, orderNumber: 'ORD-A-FRESH' }))
    await pA2
    assert.equal(navCoord.getState().order?.orderNumber, 'ORD-A-FRESH')

    // Now old A1 and B1 resolve late -> must be ignored!
    defA1.resolve(makeDetailDto({ id: ORDER_ID_A, orderNumber: 'ORD-A-STALE' }))
    defB1.resolve(makeDetailDto({ id: ORDER_ID_B, orderNumber: 'ORD-B-STALE' }))
    await Promise.all([pA1, pB1])
    assert.equal(navCoord.getState().order?.orderNumber, 'ORD-A-FRESH')

    // Account switch clears previous user's order immediately
    activeUserId = 'staff-2'
    navCoord.syncContext()
    assert.equal(navCoord.getState().order, null)
    navCoord.dispose()
    coord2.dispose()
  }

  // ============================================================================
  // GROUP 7: 409 Conflict, Ambiguous Network/5xx Outcome, Recovery GET & 200 Safe Replay
  // ============================================================================
  console.log('--- [7/8] Testing 409 Conflict, Ambiguous Outcome Recovery & 200 Safe Replay ---')
  {
    let serverOrder = makeDetailDto({
      status: 'Confirmed',
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
    })
    let patchBehavior = 'network_error_after_server_apply'
    let getBehavior = 'fail_once'
    let patchCalls = 0
    let getCalls = 0

    const coord = adminOrderMod.createManagedOrderDetailCoordinator({
      getContext: () => ({
        authStatus: 'authenticated',
        user: { id: 'admin-1', role: UserRole.Admin },
        getAccessToken: async () => 'token',
        orderId: ORDER_ID_A,
      }),
      fetchOrderById: async () => {
        getCalls += 1
        if (getCalls > 1 && getBehavior === 'fail_once') {
          getBehavior = 'ok'
          throw new ApiError({
            status: 503,
            message: 'Temporary server error during recovery',
          })
        }
        return { ...serverOrder }
      },
      patchOrderStatus: async (_id, body) => {
        patchCalls += 1
        if (patchBehavior === 'network_error_after_server_apply') {
          // Server actually applied the state, but response was lost in network timeout
          serverOrder = { ...serverOrder, status: body.newStatus }
          throw new ApiError({
            status: 0,
            message: 'Network timeout',
            isNetworkError: true,
          })
        }
        if (patchBehavior === 'safe_replay_200') {
          return { ...serverOrder }
        }
        throw new ApiError({
          status: 409,
          code: 'Order.PaidOrderRequiresRefund',
          message: 'Paid order requires refund',
        })
      },
    })

    await coord.loadOrderDetail()
    coord.openConfirmDialog('Processing')

    // Submit -> network error after server already applied Processing
    const resNet = await coord.submitConfirmedStatusChange()
    assert.equal(resNet, null)
    assert.equal(patchCalls, 1, 'Must never auto-retry PATCH on network error')
    assert.equal(coord.getState().isOutcomeAmbiguous, true)
    assert.equal(
      coord.openConfirmDialog('Processing'),
      null,
      'Actions must be locked while outcome is ambiguous'
    )

    // First recovery GET fails -> actions MUST stay locked!
    const rec1 = await coord.recoverOrderState()
    assert.equal(rec1, null)
    assert.equal(coord.getState().isOutcomeAmbiguous, true)
    assert.equal(coord.openConfirmDialog('Shipping'), null)

    // Second recovery GET succeeds -> unlocks actions and shows real server status ('Processing')!
    const rec2 = await coord.recoverOrderState()
    assert.equal(rec2?.status, 'Processing')
    assert.equal(coord.getState().isOutcomeAmbiguous, false)
    assert.equal(coord.getState().isStale, false)
    assert.equal(patchCalls, 1, 'Recovery only uses GET, never sends a 2nd PATCH')

    // 200 Safe Replay: BE returns 200 OK when status already matches newStatus -> treated as success, no fake 409
    patchBehavior = 'safe_replay_200'
    serverOrder = { ...serverOrder, status: 'Shipping' }
    coord.openConfirmDialog('Shipping')
    const replayRes = await coord.submitConfirmedStatusChange()
    assert.equal(replayRes?.status, 'Shipping')
    assert.equal(coord.getState().mutationError, null)
    assert.ok(coord.getState().mutationSuccessMessage)
    coord.dispose()

    // Verify all 4 409 error codes map accurately and never auto-PATCH
    for (const conflictCode of [
      'Order.StatusConflict',
      'Order.ConcurrencyConflict',
      'Order.InvalidStatusTransition',
      'Order.PaidOrderRequiresRefund',
    ]) {
      let conflictPatchCount = 0
      const cCoord = adminOrderMod.createManagedOrderDetailCoordinator({
        getContext: () => ({
          authStatus: 'authenticated',
          user: { id: 'admin-1', role: UserRole.Admin },
          getAccessToken: async () => 'token',
          orderId: ORDER_ID_A,
        }),
        fetchOrderById: async () =>
          makeDetailDto({
            status: 'Confirmed',
            paymentMethod: 'COD',
            paymentStatus: 'Pending',
          }),
        patchOrderStatus: async () => {
          conflictPatchCount += 1
          throw new ApiError({
            status: 409,
            code: conflictCode,
            message: conflictCode,
          })
        },
      })
      await cCoord.loadOrderDetail()
      cCoord.openConfirmDialog('Processing')
      await cCoord.submitConfirmedStatusChange()
      assert.equal(conflictPatchCount, 1, `Must not auto-PATCH on ${conflictCode}`)
      assert.equal(cCoord.getState().confirmSnapshot, null)
      assert.equal(cCoord.getState().mutationErrorCode, conflictCode)
      if (conflictCode === 'Order.PaidOrderRequiresRefund') {
        assert.equal(
          cCoord.getState().mutationError,
          adminOrderMod.PAID_ONLINE_CANCEL_UNSUPPORTED_NOTICE
        )
      }
      cCoord.dispose()
    }
  }

  // ============================================================================
  // GROUP 8: List/Detail UX State Helpers (Query Normalization, Page Reset, Currency, Nav Active, Error vs Empty)
  // ============================================================================
  console.log('--- [8/8] Testing List/Detail UX Helpers, Currency & Nav Active ---')
  {
    // Strict positive integer & enum allowlist normalization
    const norm1 = adminOrderMod.normalizeManagedOrdersQuery(
      '?page=-5&status=All&paymentMethod=Invalid&paymentStatus=Pending&search=%20%20ORD-123%20%20'
    )
    assert.equal(norm1.pageIndex, 1)
    assert.equal(norm1.status, undefined)
    assert.equal(norm1.paymentMethod, undefined)
    assert.equal(norm1.paymentStatus, 'Pending')
    assert.equal(norm1.search, 'ORD-123')

    const norm2 = adminOrderMod.normalizeManagedOrdersQuery(
      '?page=1abc&status=Confirmed'
    )
    assert.equal(norm2.pageIndex, 1)
    assert.equal(norm2.status, 'Confirmed')

    // Changing any filter resets pageIndex to 1
    const resetQuery = adminOrderMod.applyManagedOrdersFilterChange(
      {
        pageIndex: 4,
        status: 'Confirmed',
        paymentMethod: 'COD',
        paymentStatus: undefined,
        search: '090',
      },
      { status: 'Shipping' }
    )
    assert.equal(resetQuery.pageIndex, 1)
    assert.equal(resetQuery.status, 'Shipping')

    // Back link preserves sanitized filters
    assert.equal(
      adminOrderMod.resolveBackToOrdersHref(
        '?status=Confirmed&page=3&paymentMethod=all'
      ),
      '/admin/orders?status=Confirmed&page=3'
    )

    // Currency formatting: VND vs foreign currencies (must NOT apply VND symbol to USD)
    const vndFormatted = adminOrderMod.formatOrderCurrency(14500000, 'VND')
    assert.ok(vndFormatted.includes('14.500.000'))
    const usdFormatted = adminOrderMod.formatOrderCurrency(125.5, 'USD')
    assert.ok(
      usdFormatted.includes('US$') || usdFormatted.includes('$') || usdFormatted.includes('USD')
    )
    assert.ok(!usdFormatted.includes('₫'))

    // Admin nav item active on both /admin/orders and /admin/orders/:orderId
    assert.equal(
      guardMod.isAdminNavItemActive('/admin/orders', '/admin/orders'),
      true
    )
    assert.equal(
      guardMod.isAdminNavItemActive(
        '/admin/orders',
        `/admin/orders/${ORDER_ID_A}`
      ),
      true
    )
    assert.equal(
      guardMod.isAdminNavItemActive('/admin/orders', '/admin/products'),
      false
    )

    // Empty vs 500/403 in list coordinator: server error must NOT be treated as empty list
    const errListCoord = adminOrderMod.createManagedOrderListCoordinator({
      getAuthContext: () => ({
        authStatus: 'authenticated',
        user: { id: 'admin-1', role: UserRole.Admin },
        getAccessToken: async () => 'token',
      }),
      fetchOrders: async () => {
        throw new ApiError({ status: 500, message: 'Internal Server Error' })
      },
    })
    await errListCoord.loadOrders({ pageIndex: 1, search: '' })
    assert.equal(errListCoord.getState().data, null)
    assert.ok(errListCoord.getState().error)
    errListCoord.dispose()
  }

  console.log('ALL 8 RUNTIME TEST GROUPS PASSED SUCCESSFULLY!')
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}
