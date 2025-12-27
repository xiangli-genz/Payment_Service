const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');

const ZALOPAY_CONFIG = {
  appId: process.env.ZALOPAY_APP_ID,
  key1: process.env.ZALOPAY_KEY1,
  key2: process.env.ZALOPAY_KEY2,
  endpoint: process.env.ZALOPAY_ENDPOINT,
  callbackUrl: `${process.env.PAYMENT_RETURN_URL}/zalopay/callback`
};

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
    
    const data = `${ZALOPAY_CONFIG.appId}|${transId}|${orderId}|${amount}|${appTime}|${embedDataStr}|${itemsStr}`;
    
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
    
    const response = await axios.post(ZALOPAY_CONFIG.endpoint, null, {
      params: requestBody
    });
    
    return {
      success: response.data.return_code === 1,
      orderUrl: response.data.order_url,
      zpTransToken: response.data.zp_trans_token,
      transId: transId,
      response: response.data
    };
    
  } catch (error) {
    console.error('ZaloPay payment error:', error);
    return {
      success: false,
      error: error.message
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
    
    if (isValid) {
      const data = JSON.parse(dataStr);
      return {
        valid: true,
        success: true,
        transactionId: data.zp_trans_id,
        orderId: data.app_trans_id,
        amount: data.amount
      };
    }
    
    return {
      valid: false,
      success: false
    };
    
  } catch (error) {
    console.error('ZaloPay verify error:', error);
    return {
      valid: false,
      success: false,
      error: error.message
    };
  }
};