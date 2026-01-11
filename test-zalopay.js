require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

async function testZaloPay() {
  const config = {
    appId: '2554',
    key1: 'sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn',
    endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
    callbackUrl: 'https://hyperemotively-nonimitative-katalina.ngrok-free.dev/api/payments/callback/zalopay'
  };

  const transId = `${Date.now()}`;
  const appTime = Date.now();
  const amount = 50000;
  const orderId = 'TEST123';
  
  const embedData = JSON.stringify({});
  const items = JSON.stringify([]);
  
  // Tạo MAC
  const data = `${config.appId}|${transId}|${orderId}|${amount}|${appTime}|${embedData}|${items}`;
  const mac = crypto.createHmac('sha256', config.key1).update(data).digest('hex');
  
  const params = {
    app_id: config.appId,
    app_trans_id: transId,
    app_user: orderId,
    app_time: appTime,
    amount: amount,
    embed_data: embedData,
    item: items,
    description: 'Test payment',
    mac: mac,
    callback_url: config.callbackUrl
  };

  console.log('📤 Request Params:', params);

  try {
    const response = await axios.post(config.endpoint, null, { params });
    console.log('✅ Response:', response.data);
    
    if (response.data.return_code === 1) {
      console.log('🔗 Payment URL:', response.data.order_url);
    } else {
      console.log('❌ Error:', response.data.return_message);
    }
  } catch (error) {
    console.error('❌ Exception:', error.response?.data || error.message);
  }
}

testZaloPay();