require('dotenv').config();
const momoHelper = require('./helpers/momo.helper');

async function testMoMo() {
  console.log('🚀 Testing MoMo Direct...\n');
  
  const testData = {
    orderId: `TEST_MOMO_${Date.now()}`,
    amount: 50000,
    orderInfo: 'Thanh toan test MoMo'
  };
  
  console.log('📋 Test Data:', testData);
  console.log('');
  
  const result = await momoHelper.createPayment(testData);
  
  console.log('');
  console.log('📊 Result:', JSON.stringify(result, null, 2));
  console.log('');
  
  if (result.success) {
    console.log('✅ SUCCESS!');
    console.log('');
    console.log('🔗 Payment URL:', result.payUrl);
    console.log('📱 QR Code URL:', result.qrCodeUrl);
    console.log('📲 Deeplink:', result.deeplink);
    console.log('');
    console.log('👉 Mở URL này để test thanh toán:');
    console.log(result.payUrl);
  } else {
    console.log('❌ FAILED!');
    console.log('Error:', result.error);
    console.log('Result Code:', result.resultCode);
    
    // Giải thích lỗi
    if (result.resultCode === 1001) {
      console.log('\n💡 Lỗi 1001: Giao dịch không tồn tại');
      console.log('   - Có thể do credentials không đúng');
      console.log('   - Hoặc format request sai');
    } else if (result.resultCode === 1004) {
      console.log('\n💡 Lỗi 1004: Amount không hợp lệ');
    } else if (result.resultCode === 1005) {
      console.log('\n💡 Lỗi 1005: URL không hợp lệ');
    } else if (result.resultCode === 10) {
      console.log('\n💡 Lỗi 10: Hệ thống đang bảo trì');
    }
  }
}

testMoMo();