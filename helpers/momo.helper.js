const crypto = require('crypto');
const axios = require('axios');

const MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE,
  accessKey: process.env.MOMO_ACCESS_KEY,
  secretKey: process.env.MOMO_SECRET_KEY,
  endpoint: process.env.MOMO_ENDPOINT,
  returnUrl: process.env.MOMO_RETURN_URL || process.env.FRONTEND_SUCCESS_URL,
  ipnUrl: process.env.MOMO_CALLBACK_URL
};

console.log('🔵 MoMo Config Loaded:', {
  partnerCode: MOMO_CONFIG.partnerCode,
  endpoint: MOMO_CONFIG.endpoint,
  hasAccessKey: !!MOMO_CONFIG.accessKey,
  hasSecretKey: !!MOMO_CONFIG.secretKey,
  returnUrl: MOMO_CONFIG.returnUrl,
  ipnUrl: MOMO_CONFIG.ipnUrl
});

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
    
    // QUAN TRỌNG: requestId phải unique
    const requestId = `${orderId}_${Date.now()}`;
    const requestType = 'captureWallet';
    
    // QUAN TRỌNG: Amount phải là số nguyên
    const momoAmount = parseInt(amount);
    
    console.log('📤 MoMo Request Info:', {
      orderId,
      requestId,
      amount: momoAmount,
      orderInfo
    });
    
    // Tạo rawSignature theo đúng format của MoMo
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${momoAmount}&extraData=${extraData}&ipnUrl=${MOMO_CONFIG.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${MOMO_CONFIG.returnUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    console.log('🔐 MoMo Raw Signature:', rawSignature);
    
    // Tạo signature HMAC SHA256
    const signature = crypto
      .createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');
    
    console.log('🔐 MoMo Signature:', signature);
    
    const requestBody = {
      partnerCode: MOMO_CONFIG.partnerCode,
      accessKey: MOMO_CONFIG.accessKey,
      requestId: requestId,
      amount: momoAmount,
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: MOMO_CONFIG.returnUrl,
      ipnUrl: MOMO_CONFIG.ipnUrl,
      extraData: extraData,
      requestType: requestType,
      signature: signature,
      lang: 'vi'
    };
    
    console.log('📤 MoMo Request Body:', JSON.stringify(requestBody, null, 2));
    
    // Gửi request tới MoMo
    const response = await axios.post(MOMO_CONFIG.endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('📥 MoMo Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.resultCode === 0) {
      return {
        success: true,
        payUrl: response.data.payUrl,
        qrCodeUrl: response.data.qrCodeUrl,
        deeplink: response.data.deeplink,
        deeplinkMiniApp: response.data.deeplinkMiniApp,
        requestId: requestId,
        response: response.data
      };
    } else {
      console.error('❌ MoMo Error Response:', {
        resultCode: response.data.resultCode,
        message: response.data.message,
        localMessage: response.data.localMessage
      });
      
      return {
        success: false,
        error: response.data.message || response.data.localMessage,
        resultCode: response.data.resultCode,
        response: response.data
      };
    }
    
  } catch (error) {
    console.error('❌ MoMo Exception:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
};

/**
 * Verify IPN callback từ MoMo
 */
exports.verifyCallback = (callbackData) => {
  try {
    console.log('📥 MoMo Callback Data:', callbackData);
    
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
    
    // Tạo rawSignature để verify
    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    
    console.log('🔐 MoMo Verify Raw Signature:', rawSignature);
    
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest('hex');
    
    console.log('🔐 MoMo Expected Signature:', expectedSignature);
    console.log('🔐 MoMo Received Signature:', signature);
    
    const isValid = signature === expectedSignature;
    const isSuccess = resultCode === 0;
    
    console.log('✅ MoMo Verification:', {
      isValid,
      isSuccess,
      resultCode,
      message
    });
    
    return {
      valid: isValid,
      success: isSuccess,
      transactionId: transId,
      orderId: orderId,
      message: message
    };
    
  } catch (error) {
    console.error('❌ MoMo verify error:', error);
    return {
      valid: false,
      success: false,
      error: error.message
    };
  }
};