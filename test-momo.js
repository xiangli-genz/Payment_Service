require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

async function testMoMo() {
  console.log('🚀 Starting MoMo Test...\n');

  const cfg = {
    endpoint: process.env.MOMO_ENDPOINT,
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    secretKey: process.env.MOMO_SECRET_KEY,
    returnUrl: process.env.MOMO_RETURN_URL || process.env.FRONTEND_SUCCESS_URL,
    ipnUrl: process.env.MOMO_CALLBACK_URL
  };

  console.log('📋 Config:', {
    endpoint: cfg.endpoint,
    partnerCode: cfg.partnerCode,
    returnUrl: cfg.returnUrl,
    ipnUrl: cfg.ipnUrl
  });

  const amount = 50000;
  const orderId = `TEST_MOMO_${Date.now()}`;
  const requestId = `${orderId}_${Date.now()}`;
  const requestType = 'captureWallet';
  const extraData = '';
  const momoAmount = parseInt(amount);

  const rawSignature = `accessKey=${cfg.accessKey}&amount=${momoAmount}&extraData=${extraData}&ipnUrl=${cfg.ipnUrl}&orderId=${orderId}&orderInfo=Test%20Payment&partnerCode=${cfg.partnerCode}&redirectUrl=${cfg.returnUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = crypto.createHmac('sha256', cfg.secretKey).update(rawSignature).digest('hex');

  const requestBody = {
    partnerCode: cfg.partnerCode,
    accessKey: cfg.accessKey,
    requestId: requestId,
    amount: momoAmount,
    orderId: orderId,
    orderInfo: 'Test Payment',
    redirectUrl: cfg.returnUrl,
    ipnUrl: cfg.ipnUrl,
    extraData: extraData,
    requestType: requestType,
    signature: signature,
    lang: 'vi'
  };

  console.log('🔐 Raw Signature:', rawSignature);
  console.log('🔐 Signature:', signature);
  console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));

  try {
    const res = await axios.post(cfg.endpoint, requestBody, { timeout: 30000 });
    console.log('\n📥 Response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('\n❌ Exception:', err.message);
    if (err.response) console.error('Response Data:', err.response.data);
  }
}

if (require.main === module) testMoMo();
