const crypto = require('crypto');
const querystring = require('qs');
const moment = require('moment');

const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE,
  hashSecret: process.env.VNPAY_HASH_SECRET,
  url: process.env.VNPAY_URL,
  returnUrl: process.env.VNPAY_RETURN_URL
};

/**
 * Sort object theo chuẩn VNPay (giống code mẫu)
 */
function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

/**
 * Tạo payment URL với VNPay
 * Theo đúng code mẫu từ VNPay
 */
exports.createPayment = (paymentData) => {
  try {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    
    const {
      orderId,
      amount,
      orderInfo,
      ipAddr = '127.0.0.1',
      bankCode = ''
    } = paymentData;
    
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    
    let locale = 'vn';
    let currCode = 'VND';
    
    // Tạo vnp_Params theo đúng thứ tự code mẫu VNPay
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = VNPAY_CONFIG.tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = orderInfo;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = VNPAY_CONFIG.returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    
    if (bankCode !== null && bankCode !== '') {
      vnp_Params['vnp_BankCode'] = bankCode;
    }

    // Sort object theo chuẩn VNPay
    vnp_Params = sortObject(vnp_Params);

    // Tạo signData
    let signData = querystring.stringify(vnp_Params, { encode: false });
    
    // Tạo HMAC SHA512
    let hmac = crypto.createHmac("sha512", VNPAY_CONFIG.hashSecret);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    
    vnp_Params['vnp_SecureHash'] = signed;
    
    // Tạo URL
    let vnpUrl = VNPAY_CONFIG.url + '?' + querystring.stringify(vnp_Params, { encode: false });

    console.log('📤 VNPay Payment Data:', {
      orderId,
      amount: amount * 100,
      createDate,
      tmnCode: VNPAY_CONFIG.tmnCode,
      returnUrl: VNPAY_CONFIG.returnUrl
    });
    console.log('📤 VNPay Sign Data:', signData);
    console.log('📤 VNPay Secure Hash:', signed);
    console.log('📤 VNPay URL:', vnpUrl);

    return {
      success: true,
      paymentUrl: vnpUrl,
      orderId: orderId
    };
    
  } catch (error) {
    console.error('❌ VNPay payment error:', error);
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
    let vnp_Params = { ...callbackData };
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", VNPAY_CONFIG.hashSecret);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    console.log('🔐 VNPay Verify:', {
      receivedHash: secureHash,
      calculatedHash: signed,
      isValid: secureHash === signed
    });

    const isValid = secureHash === signed;
    const isSuccess = vnp_Params['vnp_ResponseCode'] === '00';

    return {
      valid: isValid,
      success: isSuccess,
      transactionId: vnp_Params['vnp_TransactionNo'],
      orderId: vnp_Params['vnp_TxnRef'],
      amount: parseInt(vnp_Params['vnp_Amount']) / 100,
      responseCode: vnp_Params['vnp_ResponseCode'],
      message: vnp_Params['vnp_OrderInfo'],
      bankCode: vnp_Params['vnp_BankCode'],
      cardType: vnp_Params['vnp_CardType'],
      payDate: vnp_Params['vnp_PayDate']
    };
    
  } catch (error) {
    console.error('❌ VNPay verify error:', error);
    return {
      valid: false,
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify IPN callback
 */
exports.verifyIPN = (callbackData) => {
  try {
    let vnp_Params = { ...callbackData };
    let secureHash = vnp_Params['vnp_SecureHash'];
    
    let orderId = vnp_Params['vnp_TxnRef'];
    let rspCode = vnp_Params['vnp_ResponseCode'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", VNPAY_CONFIG.hashSecret);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    
    const isValid = secureHash === signed;
    
    if (!isValid) {
      return {
        valid: false,
        RspCode: '97',
        Message: 'Invalid Checksum'
      };
    }
    
    return {
      valid: true,
      success: rspCode === '00',
      orderId: orderId,
      transactionId: vnp_Params['vnp_TransactionNo'],
      amount: parseInt(vnp_Params['vnp_Amount']) / 100,
      responseCode: rspCode,
      RspCode: '00',
      Message: 'Confirm Success'
    };
    
  } catch (error) {
    console.error('❌ VNPay IPN verify error:', error);
    return {
      valid: false,
      RspCode: '99',
      Message: 'Unknown error'
    };
  }
};