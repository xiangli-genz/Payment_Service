const crypto = require('crypto');
const querystring = require('querystring');
const moment = require('moment');

const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE,
  hashSecret: process.env.VNPAY_HASH_SECRET,
  url: process.env.VNPAY_URL,
  returnUrl: process.env.PAYMENT_RETURN_URL
};

/**
 * Tạo payment URL với VNPay
 */
exports.createPayment = (paymentData) => {
  try {
    const {
      orderId,
      amount,
      orderInfo,
      ipAddr = '127.0.0.1'
    } = paymentData;
    
    const createDate = moment().format('YYYYMMDDHHmmss');
    const expireDate = moment().add(15, 'minutes').format('YYYYMMDDHHmmss');
    
    let vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: VNPAY_CONFIG.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100
      vnp_ReturnUrl: VNPAY_CONFIG.returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    };
    
    // Sort params
    vnpParams = this.sortObject(vnpParams);
    
    const signData = querystring.stringify(vnpParams, { encode: false });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    vnpParams['vnp_SecureHash'] = signed;
    const paymentUrl = VNPAY_CONFIG.url + '?' + querystring.stringify(vnpParams, { encode: false });
    
    return {
      success: true,
      paymentUrl: paymentUrl,
      orderId: orderId
    };
    
  } catch (error) {
    console.error('VNPay payment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify callback từ VNPay
 */
exports.verifyCallback = (callbackData) => {
  try {
    let vnpParams = { ...callbackData };
    const secureHash = vnpParams['vnp_SecureHash'];
    
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];
    
    vnpParams = this.sortObject(vnpParams);
    
    const signData = querystring.stringify(vnpParams, { encode: false });
    const hmac = crypto.createHmac('sha512', VNPAY_CONFIG.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    
    const isValid = secureHash === signed;
    const isSuccess = vnpParams['vnp_ResponseCode'] === '00';
    
    return {
      valid: isValid,
      success: isSuccess,
      transactionId: vnpParams['vnp_TransactionNo'],
      orderId: vnpParams['vnp_TxnRef'],
      amount: parseInt(vnpParams['vnp_Amount']) / 100,
      message: vnpParams['vnp_OrderInfo']
    };
    
  } catch (error) {
    console.error('VNPay verify error:', error);
    return {
      valid: false,
      success: false,
      error: error.message
    };
  }
};

/**
 * Sort object by key
 */
exports.sortObject = (obj) => {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach(key => {
    sorted[key] = obj[key];
  });
  return sorted;
};