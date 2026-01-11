require('dotenv').config();
const vnpayHelper = require('./helpers/vnpay.helper');

async function testVNPay() {
  console.log('🚀 Testing VNPay Direct...\n');
  
  const testData = {
    orderId: `TEST_VNPAY_${Date.now()}`,
    amount: 50000,
    orderInfo: 'Thanh toan test VNPay',
    ipAddr: '127.0.0.1'
  };
  
  console.log('📋 Test Data:', testData);
  console.log('');
  
  const result = vnpayHelper.createPayment(testData);
  
  console.log('');
  console.log('📊 Result:', result);
  console.log('');
  
  if (result.success) {
    console.log('✅ SUCCESS!');
    console.log('');
    console.log('🔗 Payment URL:');
    console.log(result.paymentUrl);
    console.log('');
    console.log('👉 Copy URL này vào browser để test:');
    console.log(result.paymentUrl);
  } else {
    console.log('❌ FAILED!');
    console.log('Error:', result.error);
  }
}

testVNPay();