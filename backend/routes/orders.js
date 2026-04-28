const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const {
  buildInvoicePdf,
  createRazorpayOrder,
  ensureCommerceSchema,
  fetchRazorpayOrderPayments,
  generateInvoiceNumber,
  generateOrderId,
  isRawCardDataPresent,
  normalizeOrderStatus,
  normalizePaymentStatus,
  parseOrderDraft,
  paymentConfig,
  serializeOrder,
  verifyRazorpaySignature
} = require('../utils/orderCommerce');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const getAuthenticatedUserId = (req) => req.user?.userId || req.user?.id || null;

const getPagination = (req, fallbackLimit = DEFAULT_LIMIT) => {
  const page = Math.max(DEFAULT_PAGE, Number.parseInt(req.query.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(req.query.limit, 10) || fallbackLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const buildPagination = (page, limit, totalItems) => {
  const normalizedTotal = Number(totalItems) || 0;
  const totalPages = normalizedTotal === 0 ? 0 : Math.ceil(normalizedTotal / limit);

  return {
    page,
    limit,
    totalItems: normalizedTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
};

const rejectRawCardPayload = (req, res) => {
  if (!isRawCardDataPresent(req.body)) {
    return false;
  }

  res.status(400).json({
    success: false,
    error: 'Raw card details are not accepted. Use tokenized gateway checkout only.'
  });

  return true;
};

const loadOrderItems = async (queryable, orderRecordIds = [], sellerUserId = null) => {
  if (!Array.isArray(orderRecordIds) || orderRecordIds.length === 0) {
    return new Map();
  }

  const params = [orderRecordIds];
  const filters = ['order_id = ANY($1::int[])'];

  if (sellerUserId) {
    params.push(sellerUserId);
    filters.push(`seller_user_id = $${params.length}`);
  }

  const itemsResult = await queryable.query(
    `SELECT *
     FROM order_items
     WHERE ${filters.join(' AND ')}
     ORDER BY created_at ASC, id ASC`,
    params
  );

  const itemsByOrderId = new Map();

  itemsResult.rows.forEach((item) => {
    const existing = itemsByOrderId.get(item.order_id) || [];
    existing.push(item);
    itemsByOrderId.set(item.order_id, existing);
  });

  return itemsByOrderId;
};

const loadOrderWithAccess = async (orderId, actorUserId, actorIsAdmin) => {
  const result = await db.query(
    `SELECT o.*,
            EXISTS (
              SELECT 1
              FROM order_items seller_items
              WHERE seller_items.order_id = o.id
                AND seller_items.seller_user_id = $2
            ) AS actor_is_seller
     FROM orders o
     WHERE o.order_id = $1
     LIMIT 1`,
    [orderId, actorUserId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const actorIsBuyer = Number(row.buyer_user_id) === Number(actorUserId);
  const actorIsSeller = actorIsAdmin ? true : Boolean(row.actor_is_seller);

  return {
    row,
    actorIsBuyer,
    actorIsSeller,
    actorIsAdmin
  };
};

const mapSyncedPaymentStatus = (currentStatus, paymentItem = null) => {
  if (!paymentItem) {
    return {
      paymentStatus: 'pending',
      orderStatus: currentStatus
    };
  }

  switch (paymentItem.status) {
    case 'captured':
      return {
        paymentStatus: 'paid',
        orderStatus: ['created', 'payment_authorized', 'payment_failed'].includes(currentStatus)
          ? 'confirmed'
          : currentStatus
      };
    case 'authorized':
      return {
        paymentStatus: 'authorized',
        orderStatus: ['created', 'payment_failed'].includes(currentStatus)
          ? 'payment_authorized'
          : currentStatus
      };
    case 'refunded':
      return {
        paymentStatus: 'refunded',
        orderStatus: 'refunded'
      };
    case 'failed':
      return {
        paymentStatus: 'failed',
        orderStatus: ['created', 'payment_authorized'].includes(currentStatus)
          ? 'payment_failed'
          : currentStatus
      };
    default:
      return {
        paymentStatus: 'pending',
        orderStatus: currentStatus
      };
  }
};

const getMostRelevantGatewayPayment = (payments = []) => {
  const prioritizedStatuses = ['captured', 'authorized', 'refunded', 'failed'];
  const ordered = Array.isArray(payments)
    ? payments.slice().sort((left, right) => (right.created_at || 0) - (left.created_at || 0))
    : [];

  for (const status of prioritizedStatuses) {
    const match = ordered.find((payment) => payment.status === status);
    if (match) {
      return match;
    }
  }

  return ordered[0] || null;
};

// GET USER'S ORDERS (as buyer)
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    await ensureCommerceSchema(db);

    const userId = getAuthenticatedUserId(req);
    const { page, limit, offset } = getPagination(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM orders
       WHERE buyer_user_id = $1`,
      [userId]
    );

    const ordersResult = await db.query(
      `SELECT *
       FROM orders
       WHERE buyer_user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const itemsByOrderId = await loadOrderItems(
      db,
      ordersResult.rows.map((row) => row.id)
    );

    res.json({
      success: true,
      orders: ordersResult.rows.map((row) =>
        serializeOrder(row, itemsByOrderId.get(row.id) || [])
      ),
      pagination: buildPagination(page, limit, countResult.rows[0]?.total)
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Failed to get user orders' });
  }
});

// GET SELLER'S ORDERS (as seller/admin)
router.get('/manage', authenticateToken, async (req, res) => {
  try {
    await ensureCommerceSchema(db);

    const userId = getAuthenticatedUserId(req);
    const { page, limit, offset } = getPagination(req);
    const isAdmin = Boolean(req.user?.isAdmin || req.user?.is_admin);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const countQuery = isAdmin
      ? `SELECT COUNT(*)::int AS total FROM orders`
      : `SELECT COUNT(DISTINCT o.id)::int AS total
         FROM orders o
         INNER JOIN order_items oi ON oi.order_id = o.id
         WHERE oi.seller_user_id = $1`;
    const countParams = isAdmin ? [] : [userId];
    const countResult = await db.query(countQuery, countParams);

    const ordersQuery = isAdmin
      ? `SELECT *
         FROM orders
         ORDER BY created_at DESC, id DESC
         LIMIT $1 OFFSET $2`
      : `SELECT DISTINCT o.*
         FROM orders o
         INNER JOIN order_items oi ON oi.order_id = o.id
         WHERE oi.seller_user_id = $1
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT $2 OFFSET $3`;
    const ordersParams = isAdmin ? [limit, offset] : [userId, limit, offset];
    const ordersResult = await db.query(ordersQuery, ordersParams);

    const itemsByOrderId = await loadOrderItems(
      db,
      ordersResult.rows.map((row) => row.id),
      isAdmin ? null : userId
    );

    res.json({
      success: true,
      orders: ordersResult.rows.map((row) =>
        serializeOrder(row, itemsByOrderId.get(row.id) || [])
      ),
      pagination: buildPagination(page, limit, countResult.rows[0]?.total)
    });
  } catch (error) {
    console.error('Get manage orders error:', error);
    res.status(500).json({ error: 'Failed to get managed orders' });
  }
});

// GET PAYMENT CONFIGURATION
router.get('/payment-config', authenticateToken, async (req, res) => {
  try {
    const config = paymentConfig();

    res.json({
      success: true,
      paymentGateways: {
        stripe: config.stripe,
        razorpay: config.razorpay
      },
      security: config.security
    });
  } catch (error) {
    console.error('Get payment config error:', error);
    res.status(500).json({ error: 'Failed to get payment configuration' });
  }
});

// CREATE ORDER
router.post('/', authenticateToken, async (req, res) => {
  if (rejectRawCardPayload(req, res)) {
    return;
  }

  let client;

  try {
    await ensureCommerceSchema(db);

    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const draft = parseOrderDraft(req.body, req.user);
    const config = paymentConfig();

    if (draft.paymentProvider === 'razorpay' && !config.razorpay.enabled) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay checkout is not configured on this server'
      });
    }

    const orderId = generateOrderId();
    const invoiceNumber = generateInvoiceNumber();
    let gatewayOrder = null;

    if (draft.paymentProvider === 'razorpay') {
      gatewayOrder = await createRazorpayOrder({
        amount: draft.totalAmount,
        currency: draft.currency,
        receipt: orderId,
        notes: {
          internalOrderId: orderId,
          invoiceNumber,
          buyerUserId: String(userId)
        }
      });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (
        order_id,
        buyer_user_id,
        status,
        currency,
        subtotal_amount,
        tax_amount,
        shipping_amount,
        discount_amount,
        total_amount,
        payment_provider,
        payment_method,
        payment_status,
        gateway_order_id,
        invoice_number,
        customer_name,
        customer_email,
        customer_phone,
        billing_address,
        shipping_address,
        notes,
        metadata,
        updated_at
      ) VALUES (
        $1, $2, 'created', $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP
      )
      RETURNING *`,
      [
        orderId,
        userId,
        draft.currency,
        draft.subtotalAmount,
        draft.taxAmount,
        draft.shippingAmount,
        draft.discountAmount,
        draft.totalAmount,
        draft.paymentProvider,
        draft.paymentMethod,
        gatewayOrder?.id || null,
        invoiceNumber,
        draft.customerName,
        draft.customerEmail,
        draft.customerPhone,
        JSON.stringify(draft.billingAddress),
        JSON.stringify(draft.shippingAddress),
        draft.notes,
        JSON.stringify(draft.metadata)
      ]
    );

    const insertedOrder = orderResult.rows[0];
    const insertedItems = [];

    for (const item of draft.items) {
      const itemResult = await client.query(
        `INSERT INTO order_items (
          order_id,
          product_id,
          seller_user_id,
          item_name,
          item_description,
          sku,
          quantity,
          unit_amount,
          total_amount,
          currency,
          metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        RETURNING *`,
        [
          insertedOrder.id,
          item.productId,
          item.sellerUserId,
          item.itemName,
          item.itemDescription,
          item.sku,
          item.quantity,
          item.unitAmount,
          item.totalAmount,
          item.currency,
          JSON.stringify(item.metadata)
        ]
      );

      insertedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order created',
      data: {
        ...serializeOrder(insertedOrder, insertedItems),
        checkout: gatewayOrder
          ? {
              provider: 'razorpay',
              keyId: config.razorpay.keyId,
              orderId: gatewayOrder.id,
              amount: gatewayOrder.amount,
              currency: gatewayOrder.currency,
              status: gatewayOrder.status
            }
          : null
      }
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Order rollback error:', rollbackError);
      }
    }

    console.error('Create order error:', error);

    const isValidationError = /required|must be|does not match|Unsupported|cannot exceed/i.test(error.message);
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      error: isValidationError ? error.message : 'Failed to create order'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

const verifyPaymentHandler = async (req, res) => {
  if (rejectRawCardPayload(req, res)) {
    return;
  }

  try {
    await ensureCommerceSchema(db);

    const userId = getAuthenticatedUserId(req);
    const isAdmin = Boolean(req.user?.isAdmin || req.user?.is_admin);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const publicOrderId = String(req.body.orderId || req.body.order_id || '').trim();
    const paymentId = String(req.body.paymentId || req.body.razorpay_payment_id || '').trim();
    const signature = String(req.body.signature || req.body.razorpay_signature || '').trim();
    const submittedGatewayOrderId = String(
      req.body.gatewayOrderId || req.body.gateway_order_id || req.body.razorpay_order_id || ''
    ).trim();

    if (!publicOrderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        error: 'orderId, paymentId, and signature are required'
      });
    }

    const orderAccess = await loadOrderWithAccess(publicOrderId, userId, isAdmin);
    if (!orderAccess) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!orderAccess.actorIsAdmin && !orderAccess.actorIsBuyer) {
      return res.status(403).json({ error: 'You are not allowed to verify this order payment' });
    }

    if (orderAccess.row.payment_provider !== 'razorpay') {
      return res.status(400).json({
        success: false,
        error: 'This order is not configured for Razorpay verification'
      });
    }

    if (!paymentConfig().razorpay.enabled) {
      return res.status(503).json({
        success: false,
        error: 'Razorpay verification is not configured on this server'
      });
    }

    if (!orderAccess.row.gateway_order_id) {
      return res.status(409).json({
        success: false,
        error: 'No gateway order is attached to this order'
      });
    }

    if (submittedGatewayOrderId && submittedGatewayOrderId !== orderAccess.row.gateway_order_id) {
      return res.status(400).json({
        success: false,
        error: 'Gateway order ID does not match the stored order'
      });
    }

    const signatureIsValid = verifyRazorpaySignature({
      serverOrderId: orderAccess.row.gateway_order_id,
      paymentId,
      signature
    });

    if (!signatureIsValid) {
      return res.status(400).json({
        success: false,
        error: 'Payment signature verification failed'
      });
    }

    const updatedOrderResult = await db.query(
      `UPDATE orders
       SET payment_status = 'paid',
           status = CASE
             WHEN status IN ('created', 'payment_authorized', 'payment_failed') THEN 'confirmed'
             ELSE status
           END,
           gateway_payment_id = $2,
           gateway_signature = $3,
           paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [orderAccess.row.id, paymentId, signature]
    );

    const itemsByOrderId = await loadOrderItems(db, [orderAccess.row.id]);

    res.json({
      success: true,
      message: 'Payment verified',
      order: serializeOrder(
        updatedOrderResult.rows[0],
        itemsByOrderId.get(orderAccess.row.id) || []
      )
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

router.post('/verify-payment', authenticateToken, verifyPaymentHandler);
router.post('/razorpay/verify', authenticateToken, verifyPaymentHandler);

// GET ORDER INVOICE
router.get('/:orderId/invoice', authenticateToken, async (req, res) => {
  try {
    await ensureCommerceSchema(db);

    const userId = getAuthenticatedUserId(req);
    const isAdmin = Boolean(req.user?.isAdmin || req.user?.is_admin);
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const orderAccess = await loadOrderWithAccess(orderId, userId, isAdmin);
    if (!orderAccess) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!orderAccess.actorIsAdmin && !orderAccess.actorIsBuyer) {
      return res.status(403).json({ error: 'You are not allowed to download this invoice' });
    }

    const itemsByOrderId = await loadOrderItems(db, [orderAccess.row.id]);
    const serializedOrder = serializeOrder(
      orderAccess.row,
      itemsByOrderId.get(orderAccess.row.id) || []
    );
    const pdfBuffer = buildInvoicePdf(serializedOrder, serializedOrder.items);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="invoice-${orderId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

// UPDATE ORDER STATUS
router.patch('/:orderId/status', authenticateToken, async (req, res) => {
  try {
    await ensureCommerceSchema(db);

    const userId = getAuthenticatedUserId(req);
    const isAdmin = Boolean(req.user?.isAdmin || req.user?.is_admin);
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const orderAccess = await loadOrderWithAccess(orderId, userId, isAdmin);
    if (!orderAccess) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const nextStatus = normalizeOrderStatus(req.body.status);
    let nextPaymentStatus = null;

    if (req.body.paymentStatus !== undefined || req.body.payment_status !== undefined) {
      nextPaymentStatus = normalizePaymentStatus(req.body.paymentStatus ?? req.body.payment_status);
    }

    const actorCanManageOrder = orderAccess.actorIsAdmin || orderAccess.actorIsSeller;
    const buyerCanCancel = orderAccess.actorIsBuyer && nextStatus === 'cancelled';

    if (!actorCanManageOrder && !buyerCanCancel) {
      return res.status(403).json({ error: 'You are not allowed to update this order' });
    }

    if (!actorCanManageOrder) {
      nextPaymentStatus = null;
    }

    const updatedOrderResult = await db.query(
      `UPDATE orders
       SET status = $2,
           payment_status = COALESCE($3, payment_status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [orderAccess.row.id, nextStatus, nextPaymentStatus]
    );

    const itemsByOrderId = await loadOrderItems(db, [orderAccess.row.id]);

    res.json({
      success: true,
      message: 'Order status updated',
      order: serializeOrder(
        updatedOrderResult.rows[0],
        itemsByOrderId.get(orderAccess.row.id) || []
      )
    });
  } catch (error) {
    console.error('Update order status error:', error);
    const isValidationError = /Unsupported/i.test(error.message);
    res.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : 'Failed to update order status'
    });
  }
});

// SYNC ORDER STATUS
router.patch('/:orderId/status/sync', authenticateToken, async (req, res) => {
  try {
    await ensureCommerceSchema(db);

    const userId = getAuthenticatedUserId(req);
    const isAdmin = Boolean(req.user?.isAdmin || req.user?.is_admin);
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const orderAccess = await loadOrderWithAccess(orderId, userId, isAdmin);
    if (!orderAccess) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!orderAccess.actorIsAdmin && !orderAccess.actorIsBuyer && !orderAccess.actorIsSeller) {
      return res.status(403).json({ error: 'You are not allowed to sync this order' });
    }

    let orderRow = orderAccess.row;
    let syncSource = 'local';

    if (orderRow.payment_provider === 'razorpay' && orderRow.gateway_order_id && paymentConfig().razorpay.enabled) {
      const paymentCollection = await fetchRazorpayOrderPayments(orderRow.gateway_order_id);
      const gatewayPayment = getMostRelevantGatewayPayment(paymentCollection.items || []);

      if (gatewayPayment) {
        const syncedStatuses = mapSyncedPaymentStatus(orderRow.status, gatewayPayment);
        const updatedOrderResult = await db.query(
          `UPDATE orders
           SET status = $2,
               payment_status = $3,
               payment_method = COALESCE($4, payment_method),
               gateway_payment_id = COALESCE($5, gateway_payment_id),
               paid_at = CASE
                 WHEN $3 = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP)
                 ELSE paid_at
               END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [
            orderRow.id,
            syncedStatuses.orderStatus,
            syncedStatuses.paymentStatus,
            gatewayPayment.method || null,
            gatewayPayment.id || null
          ]
        );

        orderRow = updatedOrderResult.rows[0];
        syncSource = 'razorpay';
      }
    }

    const itemsByOrderId = await loadOrderItems(
      db,
      [orderRow.id],
      orderAccess.actorIsSeller && !orderAccess.actorIsAdmin && !orderAccess.actorIsBuyer ? userId : null
    );

    res.json({
      success: true,
      message: 'Order status synced',
      syncSource,
      order: serializeOrder(orderRow, itemsByOrderId.get(orderRow.id) || [])
    });
  } catch (error) {
    console.error('Sync order status error:', error);
    res.status(500).json({ error: 'Failed to sync order status' });
  }
});

// REQUEST RETURN
router.post('/:orderId/returns', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    res.status(501).json({
      success: false,
      message: 'Return request workflow is not configured yet'
    });
  } catch (error) {
    console.error('Request return error:', error);
    res.status(500).json({ error: 'Failed to request return' });
  }
});

// UPDATE RETURN STATUS
router.patch('/:orderId/returns/:itemId', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    res.status(501).json({
      success: false,
      message: 'Return status workflow is not configured yet'
    });
  } catch (error) {
    console.error('Update return status error:', error);
    res.status(500).json({ error: 'Failed to update return status' });
  }
});

module.exports = router;
