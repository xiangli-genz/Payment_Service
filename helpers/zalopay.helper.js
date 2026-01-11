const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');

const ZALOPAY_CONFIG = {
  appId: process.env.ZALOPAY_APP_ID,
  key1: process.env.ZALOPAY_KEY1,
  key2: process.env.ZALOPAY_KEY2,
  endpoint: process.env.ZALOPAY_ENDPOINT,
  callbackUrl: process.env.ZALOPAY_CALLBACK_URL,
  returnUrl: process.env.ZALOPAY_RETURN_URL // THÊM RETURN URL
};

console.log('🔵 ZaloPay Config:', {
  appId: ZALOPAY_CONFIG.appId,
  endpoint: ZALOPAY_CONFIG.endpoint,
  callbackUrl: ZALOPAY_CONFIG.callbackUrl,
  returnUrl: ZALOPAY_CONFIG.returnUrl, // LOG RETURN URL
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
      description
    } = paymentData;
    
    const transID = `${moment().format('YYMMDD')}_${Date.now().toString().slice(-6)}`;
    const appTime = Date.now();
    
    // ✅ THÊM redirecturl vào embedData
    const embedData = JSON.stringify({
      redirecturl: ZALOPAY_CONFIG.returnUrl
    });
    
    // Items - để mảng rỗng
    const items = JSON.stringify([]);
    
    // Tạo data string để hash
    const data = `${ZALOPAY_CONFIG.appId}|${transID}|${orderId}|${amount}|${appTime}|${embedData}|${items}`;
    
    console.log('🔵 ZaloPay MAC Data:', data);
    
    const mac = crypto
      .createHmac('sha256', ZALOPAY_CONFIG.key1)
      .update(data)
      .digest('hex');

    console.log('🔵 ZaloPay MAC:', mac);
    
    const requestBody = {
      app_id: parseInt(ZALOPAY_CONFIG.appId),
      app_trans_id: transID,
      app_user: orderId,
      app_time: appTime,
      amount: amount,
      embed_data: embedData, // ✅ Có redirecturl bên trong
      item: items,
      description: description || `Thanh toan don hang ${orderId}`,
      bank_code: '',
      mac: mac,
      callback_url: ZALOPAY_CONFIG.callbackUrl
    };
    
    console.log('🔵 ZaloPay Request Body:', requestBody);
    console.log('🔵 ZaloPay Request Param Types:', {
      app_id_type: typeof requestBody.app_id,
      app_trans_id_type: typeof requestBody.app_trans_id,
      app_user_type: typeof requestBody.app_user,
      app_time_type: typeof requestBody.app_time,
      amount_type: typeof requestBody.amount,
      embed_data_type: typeof requestBody.embed_data,
      item_type: typeof requestBody.item,
      mac_type: typeof requestBody.mac
    });
    console.log('🔵 Calling endpoint:', ZALOPAY_CONFIG.endpoint);
    
    const response = await axios.post(ZALOPAY_CONFIG.endpoint, null, {
      params: requestBody,
      timeout: 30000
    });
    
    console.log('🔵 ZaloPay Response:', response.data);
    
    if (response.data.return_code === 1) {
      return {
        success: true,
        orderUrl: response.data.order_url,
        zpTransToken: response.data.zp_trans_token,
        transId: transID,
        response: response.data
      };
    } else {
      const errorMessages = {
        '-1': 'Hệ thống bảo trì',
        '-2': 'Tham số không hợp lệ', 
        '-3': 'Số tiền không hợp lệ',
        '-4': 'Đơn hàng đã tồn tại',
        '-401': 'MAC không hợp lệ - Sai key hoặc format data',
        '-402': 'app_id không hợp lệ'
      };

      const errorMsg = errorMessages[response.data.return_code] || response.data.return_message || 'Unknown error';
      
      console.error('❌ ZaloPay Error:', {
        return_code: response.data.return_code,
        return_message: response.data.return_message,
        sub_return_code: response.data.sub_return_code,
        sub_return_message: response.data.sub_return_message
      });

      return {
        success: false,
        error: errorMsg,
        response: response.data
      };
    }
    
  } catch (error) {
    console.error('❌ ZaloPay Exception:', {
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
      isValid,
      receivedMac: reqMac,
      calculatedMac: mac
    });
    
    if (isValid) {
      const data = JSON.parse(dataStr);
      
      console.log('✅ ZaloPay Payment Data:', data);
      
      return {
        valid: true,
        success: true,
        transactionId: data.zp_trans_id,
        orderId: data.app_user, // orderId được lưu trong app_user
        amount: data.amount,
        appTransId: data.app_trans_id,
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