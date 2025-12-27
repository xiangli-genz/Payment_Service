const crypto = require('crypto');
const axios = require('axios');

const MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE,
  accessKey: process.env.MOMO_ACCESS_KEY,
  secretKey: process.env.MOMO_SECRET_KEY,
  endpoint: process.env.MOMO_ENDPOINT,
  returnUrl: process.env.PAYMENT_RETURN_URL,
  ipnUrl: `${process.env.PAYMENT_RETURN_URL}/momo/ipn`
};

/**
 * Tạo payment request với MoMo
 */
exports.createPayment = async (paymentData) => {
  try {
    const {
      orderId,
      amount,
      orderInfo,
      extraData = ''
    } = paymentData;
    
    const requestId = `${orderId}_${Date.now()}`;
    const requestType = 'captureWallet';
    
    // Tạo signature
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${MOMO_CONFIG.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${MOMO_CONFIG.returnUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = crypto
      .createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');
    
    const requestBody = {
      partnerCode: MOMO_CONFIG.partnerCode,
      accessKey: MOMO_CONFIG.accessKey,
      requestId: requestId,
      amount: amount,
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: MOMO_CONFIG.returnUrl,
      ipnUrl: MOMO_CONFIG.ipnUrl,
      extraData: extraData,
      requestType: requestType,
      signature: signature,
      lang: 'vi'
    };
    
    const response = await axios.post(MOMO_CONFIG.endpoint, requestBody);
    
    return {
      success: response.data.resultCode === 0,
      payUrl: response.data.payUrl,
      qrCodeUrl: response.data.qrCodeUrl,
      deeplink: response.data.deeplink,
      requestId: requestId,
      response: response.data
    };
    
  } catch (error) {
    console.error('MoMo payment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify IPN callback từ MoMo
 */
exports.verifyCallback = (callbackData) => {
  try {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature
    } = callbackData;
    
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');
    
    const isValid = signature === expectedSignature;
    const isSuccess = resultCode === 0;
    
    return {
      valid: isValid,
      success: isSuccess,
      transactionId: transId,
      message: message
    };
    
  } catch (error) {
    console.error('MoMo verify error:', error);
    return {
      valid: false,
      success: false,
      error: error.message
    };
  }
};