# Razorpay Payment Integration Guide

## Overview
This guide explains the Razorpay payment integration for call credit purchases in the DatingHub app. Users can now purchase call credits securely using Razorpay's payment gateway.

## Setup Instructions

### 1. Razorpay Account Setup
1. Create a Razorpay account at https://razorpay.com
2. Complete KYC verification
3. Get your API keys from Dashboard → Settings → API Keys
   - **Key ID** (public key)
   - **Key Secret** (secret key - keep this private!)

### 2. Environment Variables

#### Backend (.env file)
Add the following to your backend `.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxx (for testing) or rzp_live_xxxxx (for production)
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_MODE=test (or 'live' for production)
```

#### Frontend (.env file)
Add the following to your frontend `.env` file:

```env
# Razorpay Public Key
REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxx (for testing) or rzp_live_xxxxx (for production)
```

### 3. Database Requirements

Ensure the following tables exist in your PostgreSQL database:

- `call_credits` - User call credits wallet
- `call_earnings` - Transaction history for credit purchases
- `call_settings` - Configuration settings (already created by migration)

### 4. Running the Application

After setting up environment variables:

```bash
# Backend
cd backend
npm install
npm start

# Frontend (in another terminal)
cd ..
npm install
npm start
```

## How It Works

### Purchase Flow

1. **User clicks "Buy"** on a credit package
   - Package card is selected
   - Razorpay payment modal opens

2. **Modal displays:**
   - Package details (credits, bonus, total)
   - Price in INR
   - User email/phone (prefilled from localStorage)

3. **User clicks "Pay"**
   - Frontend initiates purchase: `POST /calling/wallet/purchase/initiate`
   - Backend creates Razorpay order with amount and package details
   - Frontend receives order ID and Razorpay key

4. **Razorpay checkout opens**
   - User enters payment details
   - Payment is processed

5. **Payment verification**
   - Frontend verifies payment with backend: `POST /calling/wallet/purchase/verify`
   - Backend validates signature using HMAC-SHA256
   - Backend verifies payment status with Razorpay API
   - Credits are added to user's wallet

6. **Success notification**
   - User sees success message with credits added
   - Balance updates in real-time
   - Transaction recorded in database

## API Endpoints

### Purchase Initiation
```
POST /calling/wallet/purchase/initiate
Headers: Authorization (from auth middleware)
Body: { packageId: number }

Response: {
  success: true,
  orderId: "order_xxxxx",
  amount: 50,
  credits: 50,
  baseCredits: 50,
  bonusCredits: 0,
  key: "rzp_test_xxxxx"
}
```

### Payment Verification
```
POST /calling/wallet/purchase/verify
Headers: Authorization (from auth middleware)
Body: { 
  orderId: "order_xxxxx",
  paymentId: "pay_xxxxx",
  signatureId: "signature_xxxxx",
  credits: 50
}

Response: {
  success: true,
  balance: 150,
  creditsAdded: 50,
  message: "50 credits added to your account!"
}
```

### Get Balance
```
GET /calling/wallet/balance
Headers: Authorization (from auth middleware)

Response: {
  success: true,
  balance: 100,
  totalSpent: 50,
  totalPurchased: 150
}
```

### Get Packages
```
GET /calling/wallet/packages

Response: {
  success: true,
  enabled: true,
  packages: [
    { id: 1, credits: 50, price: 50, bonus: 0, label: 'Starter' },
    ...
  ],
  minPurchase: 50
}
```

## Component Structure

### RazorpayPayment Component (`src/components/RazorpayPayment.jsx`)
- Handles payment modal UI
- Loads Razorpay script dynamically
- Manages payment flow
- Calls backend APIs
- Returns success/error callbacks

### CallingDashboard Component (`src/components/CallingDashboard.jsx`)
- Updated to use RazorpayPayment component
- Manages balance and packages state
- Handles payment success/error
- Updates UI after successful payment

## Testing

### Test Mode
Use Razorpay test keys for development:
- Key ID: `rzp_test_xxxxx`
- Key Secret: `rzp_test_secret_xxx`

### Test Payment Methods
Razorpay provides test card numbers for different scenarios:
- Success: 4111 1111 1111 1111
- Decline: 4222 2222 2222 2222
- etc. (see Razorpay docs)

### Test OTP
For cards requiring OTP verification, use: **112233**

## Error Handling

The system handles the following error scenarios:

1. **Missing/Invalid Package ID** → 400 error
2. **User not authenticated** → 401 error
3. **Razorpay order creation fails** → 500 error with details
4. **Payment signature mismatch** → 400 error
5. **Payment not captured** → 400 error
6. **Insufficient funds** → 400 error (if implemented)

## Security Features

1. **HMAC-SHA256 Signature Verification** - Ensures payment authenticity
2. **Server-side verification** - Confirms payment status with Razorpay API
3. **API Key authentication** - Requires user authentication
4. **Secure credit storage** - Credits stored in database with user context
5. **Transaction logging** - All purchases logged for audit trail

## Database Schema

### call_credits table
```sql
CREATE TABLE call_credits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  credits_balance DECIMAL(12,2) DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  total_purchased DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### call_earnings table
```sql
CREATE TABLE call_earnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount DECIMAL(10,2),
  type VARCHAR(50), -- 'credit_purchase', 'call_revenue', 'refund', etc.
  status VARCHAR(50), -- 'pending', 'completed', 'failed'
  reference_id VARCHAR(100), -- Razorpay order/payment ID
  call_session_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Future Enhancements

1. Webhook verification for async payment confirmations
2. Refund handling
3. Multiple payment gateway support (Stripe, UPI)
4. Subscription-based credits
5. Coupon integration with payment
6. Payment history UI

## Troubleshooting

### Razorpay script not loading
- Check CORS settings in browser console
- Verify internet connection
- Clear browser cache

### Order creation fails
- Check if Razorpay API keys are correct
- Verify backend can access Razorpay API
- Check for RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in env

### Payment verification fails
- Verify signature in backend logs
- Check if payment ID matches order ID
- Ensure RAZORPAY_KEY_SECRET is correct

### Credits not added
- Check database connection
- Verify user is authenticated
- Check call_credits table has user entry
- Review backend logs for SQL errors

## Support

For issues:
1. Check Razorpay API docs: https://razorpay.com/docs/
2. Review error messages in browser/server logs
3. Verify all environment variables are set
4. Test with Razorpay test credentials
