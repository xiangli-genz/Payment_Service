require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');

async function testZaloPay() {
  console.log('🚀 Starting ZaloPay Test...\n');
  
  // Config từ .env
  const config = {
    appId: process.env.ZALOPAY_APP_ID,
    key1: process.env.ZALOPAY_KEY1,
    key2: process.env.ZALOPAY_KEY2,
    endpoint: process.env.ZALOPAY_ENDPOINT,
    callbackUrl: process.env.ZALOPAY_CALLBACK_URL
  };

  console.log('📋 Config:', {
    appId: config.appId,
    endpoint: config.endpoint,
    callbackUrl: config.callbackUrl,
    hasKey1: !!config.key1,
    hasKey2: !!config.key2
  });
  console.log('');

  // Tạo transaction ID theo format YYMMDD_XXXXXX
  const transID = `${moment().format('YYMMDD')}_${Date.now().toString().slice(-6)}`;
  const appTime = Date.now();
  const amount = 50000;
  const orderId = `TEST_${Date.now()}`;
  
  const embedData = JSON.stringify({
    redirecturl: 'http://localhost:3000/payment-success'
  });
  
  const items = JSON.stringify([]);
  
  // Tạo MAC theo đúng format
  const data = `${config.appId}|${transID}|${orderId}|${amount}|${appTime}|${embedData}|${items}`;
  console.log('🔐 MAC Data String:', data);
  
  const mac = crypto.createHmac('sha256', config.key1).update(data).digest('hex');
  console.log('🔐 MAC Signature:', mac);
  console.log('');
  
  const params = {
    app_id: parseInt(config.appId),
    app_trans_id: transID,
    app_user: orderId,
    app_time: appTime,
    amount: amount,
    embed_data: embedData,
    item: items,
    description: 'Thanh toan test ZaloPay',
    bank_code: '',
    mac: mac,
    callback_url: config.callbackUrl
  };

  console.log('📤 Request Params:', JSON.stringify(params, null, 2));
  console.log('');

  try {
    console.log('⏳ Calling ZaloPay API...');
    const response = await axios.post(config.endpoint, null, { 
      params: params,
      timeout: 30000
    });
    
    console.log('');
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));
    console.log('');
    
    if (response.data.return_code === 1) {
      console.log('✅ SUCCESS!');
      console.log('🔗 Payment URL:', response.data.order_url);
      console.log('');
      console.log('👉 Copy URL này vào browser để test thanh toán:');
      console.log(response.data.order_url);
    } else {
      console.log('❌ FAILED!');
      console.log('Return Code:', response.data.return_code);
      console.log('Message:', response.data.return_message);
      console.log('Sub Code:', response.data.sub_return_code);
      console.log('Sub Message:', response.data.sub_return_message);
      
      // Giải thích lỗi
      if (response.data.return_code === -401) {
        console.log('');
        console.log('💡 Lỗi -401 = MAC không hợp lệ. Nguyên nhân có thể:');
        console.log('   1. Sai ZALOPAY_KEY1 trong .env');
        console.log('   2. Format data string không đúng');
        console.log('   3. app_id sai (phải là số nguyên)');
      }
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Exception:', error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
  }
}

testZaloPay();