const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');

const ZALOPAY_CONFIG = {
  appId: process.env.ZALOPAY_APP_ID,
  key1: process.env.ZALOPAY_KEY1,
  key2: process.env.ZALOPAY_KEY2,
  endpoint: process.env.ZALOPAY_ENDPOINT,
  callbackUrl: process.env.ZALOPAY_CALLBACK_URL + '/zalopay'
};

console.log('🔵 ZaloPay Config:', {
  appId: ZALOPAY_CONFIG.appId,
  endpoint: ZALOPAY_CONFIG.endpoint,
  callbackUrl: ZALOPAY_CONFIG.callbackUrl,
  hasKey1: !!ZALOPAY_CONFIG.key1,
  hasKey2: !!ZALOPAY_CONFIG.key2
});

/**
 * Tạo payment request với ZaloPay
 */
exports.createPayment = async (paymentData) => {
  try {
    const {
      orderId,
      amount,
      description,
      embedData = {}
    } = paymentData;
    
    const transId = `${Date.now()}`;
    const appTime = Date.now();
    
    const embedDataStr = JSON.stringify(embedData);
    const itemsStr = JSON.stringify([]);
    
    // Tạo data string để hash
    const data = `${ZALOPAY_CONFIG.appId}|${transId}|${orderId}|${amount}|${appTime}|${embedDataStr}|${itemsStr}`;
    
    console.log('🔵 ZaloPay MAC Data:', data); // ← THÊM LOG
    
    const mac = crypto
      .createHmac('sha256', ZALOPAY_CONFIG.key1)
      .update(data)
      .digest('hex');
    
    const requestBody = {
      app_id: ZALOPAY_CONFIG.appId,
      app_trans_id: transId,
      app_user: orderId,
      app_time: appTime,
      amount: amount,
      embed_data: embedDataStr,
      item: itemsStr,
      description: description,
      mac: mac,
      callback_url: ZALOPAY_CONFIG.callbackUrl
    };
    
    console.log('🔵 ZaloPay Request Body:', requestBody); // ← THÊM LOG
    console.log('🔵 Calling endpoint:', ZALOPAY_CONFIG.endpoint); // ← THÊM LOG
    
    const response = await axios.post(ZALOPAY_CONFIG.endpoint, null, {
      params: requestBody  // ← QUAN TRỌNG: params, không phải data!
    });
    
    console.log('🔵 ZaloPay Response:', response.data); // ← THÊM LOG
    
    if (response.data.return_code === 1) {
      return {
        success: true,
        orderUrl: response.data.order_url,
        zpTransToken: response.data.zp_trans_token,
        transId: transId,
        response: response.data
      };
    } else {
      console.error('❌ ZaloPay Error:', response.data);
      return {
        success: false,
        error: response.data.return_message || 'Unknown error',
        response: response.data
      };
    }
    
  } catch (error) {
    console.error('❌ ZaloPay Exception:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
};

/**
 * Verify callback từ ZaloPay
 */
exports.verifyCallback = (callbackData) => {
  try {
    const dataStr = callbackData.data;
    const reqMac = callbackData.mac;
    
    const mac = crypto
      .createHmac('sha256', ZALOPAY_CONFIG.key2)
      .update(dataStr)
      .digest('hex');
    
    const isValid = mac === reqMac;
    
    console.log('🔐 ZaloPay Signature Verification:', {
      isValid
    });
    
    if (isValid) {
      const data = JSON.parse(dataStr);
      
      console.log('✅ ZaloPay Payment Data:', data);
      
      return {
        valid: true,
        success: true,
        transactionId: data.zp_trans_id,
        orderId: data.app_user, // orderId được lưu trong app_user
        amount: data.amount
      };
    }
    
    return {
      valid: false,
      success: false
    };
    
  } catch (error) {
    console.error('❌ ZaloPay verify error:', error);
    return {
      valid: false,
      success: false,
      error: error.message
    };
  }
};