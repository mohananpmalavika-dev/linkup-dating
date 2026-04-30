/**
 * Call Wallet Service - Credits management API
 */

import { apiCall } from '../utils/api';

const BASE_URL = '/calling/wallet';

const callWalletService = {
  // Get wallet balance
  async getBalance() {
    const response = await apiCall(`${BASE_URL}/balance`, 'GET');
    return response;
  },

  // Get available credit packages
  async getPackages() {
    const response = await apiCall(`${BASE_URL}/packages`, 'GET');
    return response;
  },

  // Initialize credit purchase
  async initiatePurchase(packageId) {
    const response = await apiCall(`${BASE_URL}/purchase/initiate`, 'POST', {
      packageId
    });
    return response;
  },

  // Verify payment and add credits
  async verifyPurchase(orderId, paymentId, credits) {
    const response = await apiCall(`${BASE_URL}/purchase/verify`, 'POST', {
      orderId,
      paymentId,
      credits
    });
    return response;
  },

  // Deduct credits when call starts
  async deductCredits(sessionId, estimatedMinutes, callType = 'voice') {
    const response = await apiCall(`${BASE_URL}/deduct`, 'POST', {
      sessionId,
      estimatedMinutes,
      callType
    });
    return response;
  },

  // Refund unused credits after call
  async refundCredits(sessionId, actualDurationSeconds, totalCharged) {
    const response = await apiCall(`${BASE_URL}/refund`, 'POST', {
      sessionId,
      actualDurationSeconds,
      totalCharged
    });
    return response;
  }
};

export default callWalletService;
