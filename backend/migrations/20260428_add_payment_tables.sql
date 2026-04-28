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
  refund_id VARCHAR(255),
  refunded_amount DECIMAL(10, 2),
  failed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions (User subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  renewal_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, paused
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_method VARCHAR(50), -- razorpay, upi, card, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_date ON subscriptions(renewal_date);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment_id ON refund_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON invoices(payment_id);

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
VALUES
  ('Premium Monthly', 'Unlimited swipes, message before match, see who liked you', 99.00, 1, TRUE),
  ('Premium Quarterly', 'Unlimited swipes, message before match, see who liked you - Save 17%', 499.00, 3, TRUE),
  ('Premium Yearly', 'Unlimited swipes, message before match, see who liked you - Save 33%', 999.00, 12, TRUE)
ON CONFLICT (price, duration_months) DO NOTHING;

-- Add comments for clarity
COMMENT ON TABLE payments IS 'Razorpay payment transactions for premium subscriptions';
COMMENT ON TABLE subscriptions IS 'User subscriptions and premium access periods';
COMMENT ON TABLE refund_requests IS 'Refund requests from users within 48-hour window';
COMMENT ON TABLE invoices IS 'GST invoices for payments made by users';
COMMENT ON COLUMN payments.status IS 'Payment status: pending, authorized, completed, failed, refunded';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, cancelled, expired, paused';
COMMENT ON COLUMN subscriptions.auto_renew IS 'Whether subscription auto-renews on expiry';
