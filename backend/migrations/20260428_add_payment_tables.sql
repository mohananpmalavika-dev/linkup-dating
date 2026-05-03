-- Migration: Add Payment & Subscription Tables
-- Date: 2026-04-28
-- Purpose: Support Razorpay payment processing and subscription management

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 1,
  features JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments (Razorpay transactions)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  razorpay_order_id VARCHAR(255) UNIQUE NOT NULL,
  razorpay_payment_id VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, authorized, completed, failed, refunded
  discount_code VARCHAR(100),
  refund_id VARCHAR(255),
  refunded_amount DECIMAL(10, 2),
  failed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS discount_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS refund_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS failed_reason TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Subscriptions (User subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  plan_id INTEGER REFERENCES subscription_plans(id),
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE,
  renewal_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, paused
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_method VARCHAR(50), -- razorpay, upi, card, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Keep this table compatible with the legacy dating subscription endpoints
-- and the newer Razorpay-backed subscription page.
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES subscription_plans(id),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

ALTER TABLE subscriptions ALTER COLUMN plan_id DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN renewal_date DROP NOT NULL;

UPDATE subscriptions
SET plan = COALESCE(plan, 'free'),
    started_at = COALESCE(started_at, start_date),
    expires_at = COALESCE(expires_at, end_date),
    end_date = COALESCE(end_date, expires_at),
    renewal_date = COALESCE(renewal_date, expires_at, end_date)
WHERE plan IS NULL
   OR started_at IS NULL
   OR expires_at IS NULL
   OR end_date IS NULL
   OR renewal_date IS NULL;

-- Refund Requests
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(255),
  refund_id VARCHAR(255),
  amount DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'pending', -- pending, processed, rejected, failed
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  gst_amount DECIMAL(10, 2),
  gst_percent DECIMAL(5, 2) DEFAULT 18.0,
  pdf_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, viewed, paid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Discount Codes
CREATE TABLE IF NOT EXISTS discount_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'percentage',
  value DECIMAL(10, 2) NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  valid_until TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  one_per_user BOOLEAN DEFAULT TRUE,
  applicable_plans INTEGER[] DEFAULT '{}',
  min_amount DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_discount_code ON payments(discount_code);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_date ON subscriptions(renewal_date);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment_id ON refund_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);

-- Add premium columns to dating_profiles if not exist
ALTER TABLE dating_profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_dating_profiles_is_premium ON dating_profiles(is_premium);
CREATE INDEX IF NOT EXISTS idx_dating_profiles_premium_until ON dating_profiles(premium_until);

-- Add payment columns to users if not exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(12, 2) DEFAULT 0;

-- Seed subscription plans
INSERT INTO subscription_plans (name, description, price, duration_months, active)
SELECT 'Premium Monthly', 'Unlimited swipes, message before match, see who liked you', 99.00, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium Monthly');

INSERT INTO subscription_plans (name, description, price, duration_months, active)
SELECT 'Premium Quarterly', 'Unlimited swipes, message before match, see who liked you - Save 17%', 499.00, 3, TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium Quarterly');

INSERT INTO subscription_plans (name, description, price, duration_months, active)
SELECT 'Premium Yearly', 'Unlimited swipes, message before match, see who liked you - Save 33%', 999.00, 12, TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium Yearly');

-- Add comments for clarity
COMMENT ON TABLE payments IS 'Razorpay payment transactions for premium subscriptions';
COMMENT ON TABLE subscriptions IS 'User subscriptions and premium access periods';
COMMENT ON TABLE refund_requests IS 'Refund requests from users within 48-hour window';
COMMENT ON TABLE invoices IS 'GST invoices for payments made by users';
COMMENT ON COLUMN payments.status IS 'Payment status: pending, authorized, completed, failed, refunded';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, cancelled, expired, paused';
COMMENT ON COLUMN subscriptions.auto_renew IS 'Whether subscription auto-renews on expiry';
