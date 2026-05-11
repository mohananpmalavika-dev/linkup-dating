const crypto = require('crypto');
const https = require('https');

const DEFAULT_CURRENCY = 'INR';
const ORDER_STATUS_VALUES = new Set([
  'created',
  'payment_authorized',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'payment_failed'
]);
const PAYMENT_STATUS_VALUES = new Set([
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded'
]);

let schemaReadyPromise = null;

const sanitizeText = (value, { maxLength = 255, allowEmpty = false } = {}) => {
  if (value === null || value === undefined) {
    return allowEmpty ? '' : null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return allowEmpty ? '' : null;
  }

  return normalized.slice(0, maxLength);
};

const normalizeCurrency = (value) => {
  const normalized = sanitizeText(value, { maxLength: 10 }) || DEFAULT_CURRENCY;
  return normalized.toUpperCase();
};

const parsePositiveInteger = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseAmountSubunits = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }

  return Math.round(parsed);
};

const parseAmountFromMajor = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }

  return Math.round(parsed * 100);
};

const resolveAmountSubunits = (subunitValue, majorValue, fieldName) => {
  const explicitSubunits = parseAmountSubunits(subunitValue, `${fieldName}Subunits`);
  if (explicitSubunits !== null) {
    return explicitSubunits;
  }

  return parseAmountFromMajor(majorValue, fieldName);
};

const normalizeJsonObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
};

const formatAmountDisplay = (subunits, currency = DEFAULT_CURRENCY) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const amount = Number(subunits || 0) / 100;

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    return `${normalizedCurrency} ${amount.toFixed(2)}`;
  }
};

const generateOrderId = () =>
  `ord_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;

const generateInvoiceNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${datePart}-${suffix}`;
};

const paymentConfig = () => {
  const razorpayKeyId = sanitizeText(process.env.RAZORPAY_KEY_ID, { maxLength: 255 }) || '';
  const razorpayKeySecret = sanitizeText(process.env.RAZORPAY_KEY_SECRET, { maxLength: 255 }) || '';
  const razorpayEnabled = Boolean(razorpayKeyId && razorpayKeySecret);

  return {
    stripe: {
      enabled: false,
      publishableKey: ''
    },
    razorpay: {
      enabled: razorpayEnabled,
      keyId: razorpayEnabled ? razorpayKeyId : '',
      mode: sanitizeText(process.env.RAZORPAY_MODE, { maxLength: 50 }) || 'test',
      verificationEndpoint: '/api/orders/verify-payment'
    },
    security: {
      tokenizedOnly: true,
      threeDSecure: 'gateway-managed',
      rawCardStorage: false
    }
  };
};

const isRawCardDataPresent = (payload = {}) => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const stack = [payload];
  const blockedKeys = new Set([
    'cardnumber',
    'card_number',
    'pan',
    'primaryaccountnumber',
    'cvv',
    'cvc',
    'securitycode',
    'expiry',
    'expirymonth',
    'expiryyear',
    'expmonth',
    'expyear'
  ]);

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (blockedKeys.has(String(key).toLowerCase())) {
        return true;
      }

      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return false;
};

const normalizeLineItem = (item = {}, fallbackCurrency = DEFAULT_CURRENCY, index = 0) => {
  const itemName =
    sanitizeText(
      item.name ||
      item.title ||
      item.productName ||
      item.product_name ||
      item.label,
      { maxLength: 255 }
    );

  if (!itemName) {
    throw new Error(`Item ${index + 1} is missing a name`);
  }

  const quantity = parsePositiveInteger(item.quantity, 1);
  if (!quantity) {
    throw new Error(`Item ${index + 1} quantity must be at least 1`);
  }

  const unitAmount = resolveAmountSubunits(
    item.unitAmountSubunits ?? item.unit_amount_subunits ?? item.priceSubunits ?? item.price_subunits,
    item.unitAmount ?? item.unit_amount ?? item.price,
    `items[${index}].unitAmount`
  );

  if (unitAmount === null) {
    throw new Error(`Item ${index + 1} is missing a unit amount`);
  }

  const totalAmountCandidate = resolveAmountSubunits(
    item.totalAmountSubunits ?? item.total_amount_subunits,
    item.totalAmount ?? item.total_amount,
    `items[${index}].totalAmount`
  );

  const computedTotal = unitAmount * quantity;
  if (totalAmountCandidate !== null && totalAmountCandidate !== computedTotal) {
    throw new Error(`Item ${index + 1} total amount does not match quantity x unit amount`);
  }

  return {
    productId: parsePositiveInteger(item.productId ?? item.product_id, null),
    sellerUserId: parsePositiveInteger(item.sellerUserId ?? item.seller_id ?? item.sellerId, null),
    itemName,
    itemDescription: sanitizeText(item.description ?? item.itemDescription, { maxLength: 2000 }) || '',
    sku: sanitizeText(item.sku, { maxLength: 100 }) || '',
    quantity,
    unitAmount,
    totalAmount: computedTotal,
    currency: normalizeCurrency(item.currency || fallbackCurrency),
    metadata: normalizeJsonObject(item.metadata)
  };
};

const parseOrderDraft = (payload = {}, user = {}) => {
  const currency = normalizeCurrency(payload.currency);
  const items = Array.isArray(payload.items)
    ? payload.items.map((item, index) => normalizeLineItem(item, currency, index))
    : [];

  if (items.length === 0) {
    throw new Error('At least one order item is required');
  }

  const subtotalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
  const providedSubtotal = resolveAmountSubunits(
    payload.subtotalAmountSubunits ?? payload.subtotal_amount_subunits,
    payload.subtotalAmount ?? payload.subtotal_amount,
    'subtotalAmount'
  );

  if (providedSubtotal !== null && providedSubtotal !== subtotalAmount) {
    throw new Error('Subtotal does not match the provided items');
  }

  const taxAmount = resolveAmountSubunits(
    payload.taxAmountSubunits ?? payload.tax_amount_subunits,
    payload.taxAmount ?? payload.tax_amount,
    'taxAmount'
  ) || 0;

  const shippingAmount = resolveAmountSubunits(
    payload.shippingAmountSubunits ?? payload.shipping_amount_subunits,
    payload.shippingAmount ?? payload.shipping_amount,
    'shippingAmount'
  ) || 0;

  const discountAmount = resolveAmountSubunits(
    payload.discountAmountSubunits ?? payload.discount_amount_subunits,
    payload.discountAmount ?? payload.discount_amount,
    'discountAmount'
  ) || 0;

  const totalAmount = subtotalAmount + taxAmount + shippingAmount - discountAmount;
  if (totalAmount < 0) {
    throw new Error('Discount cannot exceed the order total');
  }

  const providedTotal = resolveAmountSubunits(
    payload.totalAmountSubunits ?? payload.total_amount_subunits ?? payload.amountSubunits ?? payload.amount_subunits,
    payload.totalAmount ?? payload.total_amount ?? payload.amount,
    'totalAmount'
  );

  if (providedTotal !== null && providedTotal !== totalAmount) {
    throw new Error('Total amount does not match the item and fee breakdown');
  }

  const paymentProvider =
    sanitizeText(payload.paymentProvider ?? payload.payment_provider, { maxLength: 50 })?.toLowerCase() ||
    'manual';
  const normalizedPaymentProvider = paymentProvider === 'razorpay' ? 'razorpay' : 'manual';

  return {
    currency,
    items,
    subtotalAmount,
    taxAmount,
    shippingAmount,
    discountAmount,
    totalAmount,
    paymentProvider: normalizedPaymentProvider,
    paymentMethod:
      sanitizeText(payload.paymentMethod ?? payload.payment_method, { maxLength: 50 }) || null,
    customerName:
      sanitizeText(payload.customerName ?? payload.customer_name, { maxLength: 255 }) || null,
    customerEmail:
      sanitizeText(payload.customerEmail ?? payload.customer_email, { maxLength: 255 }) || user.email || null,
    customerPhone:
      sanitizeText(payload.customerPhone ?? payload.customer_phone, { maxLength: 50 }) || null,
    billingAddress: normalizeJsonObject(payload.billingAddress ?? payload.billing_address),
    shippingAddress: normalizeJsonObject(payload.shippingAddress ?? payload.shipping_address),
    notes: sanitizeText(payload.notes, { maxLength: 2000 }) || null,
    metadata: normalizeJsonObject(payload.metadata)
  };
};

const ensureCommerceSchema = async (db) => {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL DEFAULT 'created',
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        subtotal_amount INTEGER NOT NULL DEFAULT 0,
        tax_amount INTEGER NOT NULL DEFAULT 0,
        shipping_amount INTEGER NOT NULL DEFAULT 0,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        total_amount INTEGER NOT NULL DEFAULT 0,
        payment_provider VARCHAR(50) NOT NULL DEFAULT 'manual',
        payment_method VARCHAR(50),
        payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
        gateway_order_id VARCHAR(255),
        gateway_payment_id VARCHAR(255),
        gateway_signature VARCHAR(255),
        invoice_number VARCHAR(64) NOT NULL,
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        billing_address JSONB DEFAULT '{}',
        shipping_address JSONB DEFAULT '{}',
        notes TEXT,
        metadata JSONB DEFAULT '{}',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS buyer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'created',
      ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      ADD COLUMN IF NOT EXISTS subtotal_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS shipping_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS gateway_signature VARCHAR(255),
      ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(64),
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS shipping_address JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER,
        seller_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        item_name VARCHAR(255) NOT NULL,
        item_description TEXT,
        sku VARCHAR(100),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_amount INTEGER NOT NULL DEFAULT 0,
        total_amount INTEGER NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS product_id INTEGER,
      ADD COLUMN IF NOT EXISTS seller_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS item_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS item_description TEXT,
      ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
      ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS unit_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_amount INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_id_unique
      ON orders(order_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_number_unique
      ON orders(invoice_number);

      CREATE INDEX IF NOT EXISTS idx_orders_buyer_user_id
      ON orders(buyer_user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_orders_payment_status
      ON orders(payment_status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id);

      CREATE INDEX IF NOT EXISTS idx_order_items_seller_user_id
      ON order_items(seller_user_id);
    `);
  })();

  try {
    await schemaReadyPromise;
  } catch (error) {
    schemaReadyPromise = null;
    throw error;
  }
};

const razorpayApiRequest = (method, path, payload = null) => {
  const config = paymentConfig();
  const { razorpay } = config;

  if (!razorpay.enabled) {
    throw new Error('Razorpay is not configured on this server');
  }

  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : '';
    const request = https.request(
      {
        hostname: 'api.razorpay.com',
        port: 443,
        path,
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');

        response.on('data', (chunk) => {
          raw += chunk;
        });

        response.on('end', () => {
          let parsed = {};

          if (raw) {
            try {
              parsed = JSON.parse(raw);
            } catch (error) {
              return reject(new Error(`Unexpected Razorpay response: ${raw.slice(0, 200)}`));
            }
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            return resolve(parsed);
          }

          const message =
            parsed?.error?.description ||
            parsed?.error?.reason ||
            parsed?.error ||
            `Razorpay request failed with status ${response.statusCode}`;

          return reject(new Error(message));
        });
      }
    );

    request.on('error', reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
};

const createRazorpayOrder = async ({ amount, currency, receipt, notes = {} }) =>
  razorpayApiRequest('POST', '/v1/orders', {
    amount,
    currency,
    receipt: String(receipt).slice(0, 40),
    notes
  });

const fetchRazorpayOrderPayments = async (gatewayOrderId) =>
  razorpayApiRequest('GET', `/v1/orders/${encodeURIComponent(gatewayOrderId)}/payments`);

const verifyRazorpaySignature = ({ serverOrderId, paymentId, signature }) => {
  const secret = sanitizeText(process.env.RAZORPAY_KEY_SECRET, { maxLength: 255 }) || '';
  if (!secret) {
    throw new Error('Razorpay is not configured on this server');
  }

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${serverOrderId}|${paymentId}`)
    .digest('hex');
  const providedSignature = String(signature || '');

  if (generatedSignature.length !== providedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(generatedSignature),
    Buffer.from(providedSignature)
  );
};

const serializeOrder = (row, items = []) => ({
  recordId: row.id,
  orderId: row.order_id,
  status: row.status,
  paymentStatus: row.payment_status,
  paymentProvider: row.payment_provider,
  paymentMethod: row.payment_method,
  currency: row.currency,
  subtotalAmount: Number(row.subtotal_amount) || 0,
  taxAmount: Number(row.tax_amount) || 0,
  shippingAmount: Number(row.shipping_amount) || 0,
  discountAmount: Number(row.discount_amount) || 0,
  totalAmount: Number(row.total_amount) || 0,
  displayTotals: {
    subtotal: formatAmountDisplay(row.subtotal_amount, row.currency),
    tax: formatAmountDisplay(row.tax_amount, row.currency),
    shipping: formatAmountDisplay(row.shipping_amount, row.currency),
    discount: formatAmountDisplay(row.discount_amount, row.currency),
    total: formatAmountDisplay(row.total_amount, row.currency)
  },
  invoiceNumber: row.invoice_number,
  customer: {
    name: row.customer_name,
    email: row.customer_email,
    phone: row.customer_phone
  },
  billingAddress: normalizeJsonObject(row.billing_address),
  shippingAddress: normalizeJsonObject(row.shipping_address),
  notes: row.notes,
  metadata: normalizeJsonObject(row.metadata),
  gateway: {
    orderId: row.gateway_order_id || null,
    paymentId: row.gateway_payment_id || null,
    signatureVerified: Boolean(row.gateway_signature && row.payment_status === 'paid')
  },
  items: items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    sellerUserId: item.seller_user_id,
    name: item.item_name,
    description: item.item_description,
    sku: item.sku,
    quantity: Number(item.quantity) || 0,
    unitAmount: Number(item.unit_amount) || 0,
    totalAmount: Number(item.total_amount) || 0,
    currency: item.currency || row.currency,
    displayUnitAmount: formatAmountDisplay(item.unit_amount, item.currency || row.currency),
    displayTotalAmount: formatAmountDisplay(item.total_amount, item.currency || row.currency),
    metadata: normalizeJsonObject(item.metadata)
  })),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  paidAt: row.paid_at
});

const escapePdfText = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ');

const buildInvoicePdf = (order, items = []) => {
  const addressLines = (address = {}) =>
    Object.entries(normalizeJsonObject(address))
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${value}`);

  const lines = [
    'DatingHub Invoice',
    `Invoice Number: ${order.invoiceNumber}`,
    `Order ID: ${order.orderId}`,
    `Created: ${new Date(order.createdAt).toLocaleString('en-IN')}`,
    `Status: ${order.status}`,
    `Payment Status: ${order.paymentStatus}`,
    `Customer: ${order.customer?.name || 'Not provided'}`,
    `Email: ${order.customer?.email || 'Not provided'}`,
    `Phone: ${order.customer?.phone || 'Not provided'}`,
    'Shipping Address:'
  ];

  const shippingLines = addressLines(order.shippingAddress);
  if (shippingLines.length === 0) {
    lines.push('  Not provided');
  } else {
    shippingLines.forEach((line) => lines.push(`  ${line}`));
  }

  lines.push('Items:');
  items.forEach((item, index) => {
    lines.push(
      `  ${index + 1}. ${item.name} x${item.quantity} @ ${item.displayUnitAmount} = ${item.displayTotalAmount}`
    );
  });

  lines.push(`Subtotal: ${order.displayTotals.subtotal}`);
  lines.push(`Tax: ${order.displayTotals.tax}`);
  lines.push(`Shipping: ${order.displayTotals.shipping}`);
  lines.push(`Discount: ${order.displayTotals.discount}`);
  lines.push(`Total: ${order.displayTotals.total}`);

  if (order.notes) {
    lines.push(`Notes: ${order.notes}`);
  }

  const textCommands = lines
    .map((line, index) => `1 0 0 1 40 ${790 - index * 16} Tm (${escapePdfText(line)}) Tj`)
    .join('\n');

  const stream = `BT\n/F1 11 Tf\n${textCommands}\nET`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const normalizeOrderStatus = (value, fieldName = 'status') => {
  const normalized = sanitizeText(value, { maxLength: 30 })?.toLowerCase() || '';
  if (!ORDER_STATUS_VALUES.has(normalized)) {
    throw new Error(`Unsupported ${fieldName}`);
  }

  return normalized;
};

const normalizePaymentStatus = (value, fieldName = 'paymentStatus') => {
  const normalized = sanitizeText(value, { maxLength: 30 })?.toLowerCase() || '';
  if (!PAYMENT_STATUS_VALUES.has(normalized)) {
    throw new Error(`Unsupported ${fieldName}`);
  }

  return normalized;
};

module.exports = {
  buildInvoicePdf,
  createRazorpayOrder,
  ensureCommerceSchema,
  fetchRazorpayOrderPayments,
  formatAmountDisplay,
  generateInvoiceNumber,
  generateOrderId,
  isRawCardDataPresent,
  normalizeOrderStatus,
  normalizePaymentStatus,
  parseOrderDraft,
  paymentConfig,
  serializeOrder,
  verifyRazorpaySignature
};
