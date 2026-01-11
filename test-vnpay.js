require('dotenv').config();
const vnpayHelper = require('./helpers/vnpay.helper');

console.log('🚀 VNPay Debug Test\n');

// Kiểm tra config
console.log('📋 Configuration Check:');
console.log('--------------------------------------------------');
console.log('VNPAY_TMN_CODE:', process.env.VNPAY_TMN_CODE);
console.log('VNPAY_HASH_SECRET:', process.env.VNPAY_HASH_SECRET ? `${process.env.VNPAY_HASH_SECRET.substring(0, 10)}...` : 'NOT SET');
console.log('VNPAY_URL:', process.env.VNPAY_URL);
console.log('VNPAY_RETURN_URL:', process.env.VNPAY_RETURN_URL);
console.log('--------------------------------------------------\n');

// Kiểm tra config có đầy đủ không
if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET || !process.env.VNPAY_URL) {
  console.error('❌ Thiếu config VNPay trong file .env!');
  console.log('\nVui lòng thêm vào file .env:');
  console.log('VNPAY_TMN_CODE=DEMOV210');
  console.log('VNPAY_HASH_SECRET=RAOEXHYVSDDIIENYWSLDIIZTANXUXZFJ');
  console.log('VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
  console.log('VNPAY_RETURN_URL=http://localhost:3003/api/payments/callback/vnpay');
  process.exit(1);
}

// Tạo payment data mẫu
const paymentData = {
  orderId: `TEST${Date.now()}`,
  amount: 100000, // 100,000 VND
  orderInfo: 'Thanh toan don hang test',
  ipAddr: '127.0.0.1',
  bankCode: '' // Để trống để hiện tất cả ngân hàng
};

console.log('📤 Creating Payment URL...');
console.log('Payment Data:', JSON.stringify(paymentData, null, 2));
console.log('--------------------------------------------------\n');

const result = vnpayHelper.createPayment(paymentData);

if (result.success) {
  console.log('\n✅ SUCCESS! Payment URL Created\n');
  console.log('--------------------------------------------------');
  console.log('Payment URL:');
  console.log(result.paymentUrl);
  console.log('--------------------------------------------------\n');
  
  console.log('📝 VNPay Sandbox Test Information:');
  console.log('--------------------------------------------------');
  console.log('Ngân hàng: NCB');
  console.log('Số thẻ: 9704198526191432198');
  console.log('Tên chủ thẻ: NGUYEN VAN A');
  console.log('Ngày phát hành: 07/15');
  console.log('Mã OTP: 123456');
  console.log('--------------------------------------------------\n');
  
  console.log('🔗 Copy URL trên vào browser để test thanh toán');
  console.log('🔗 Hoặc mở trực tiếp bằng lệnh:');
  console.log(`   open "${result.paymentUrl}"`);
  
} else {
  console.log('\n❌ FAILED!\n');
  console.log('Error:', result.error);
  
  console.log('\n💡 Troubleshooting:');
  console.log('1. Kiểm tra file .env có đầy đủ config không');
  console.log('2. Đảm bảo đã cài đặt package "qs": npm install qs');
  console.log('3. Kiểm tra VNPAY_HASH_SECRET có đúng không (32 ký tự)');
  console.log('4. Kiểm tra VNPAY_TMN_CODE (thường là 8 ký tự)');
}

console.log('\n');

// Test verify callback (giả lập)
console.log('🔐 Testing Callback Verification...');
console.log('--------------------------------------------------');

const mockCallback = {
  vnp_Amount: '10000000', // 100,000 * 100
  vnp_BankCode: 'NCB',
  vnp_BankTranNo: 'VNP01234567',
  vnp_CardType: 'ATM',
  vnp_OrderInfo: 'Thanh toan don hang test',
  vnp_PayDate: '20240115120000',
  vnp_ResponseCode: '00',
  vnp_TmnCode: process.env.VNPAY_TMN_CODE,
  vnp_TransactionNo: '14012345',
  vnp_TransactionStatus: '00',
  vnp_TxnRef: 'TEST123456',
  vnp_SecureHash: 'dummy_hash_for_test'
};

console.log('Mock Callback Data:', JSON.stringify(mockCallback, null, 2));
console.log('\nNote: Đây là test verify logic, không phải callback thật');
console.log('--------------------------------------------------\n');