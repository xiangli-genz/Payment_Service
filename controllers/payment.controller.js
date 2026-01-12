const Payment = require('../models/payment.model');
const config = require('../config/config');
const { generatePaymentCode } = require('../helpers/generate.helper');
const momoHelper = require('../helpers/momo.helper');
const zalopayHelper = require('../helpers/zalopay.helper');
const vnpayHelper = require('../helpers/vnpay.helper');
const axios = require('axios');

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;

// ===== [POST] /api/payments/create =====
module.exports.create = async (req, res) => {
  try {
    const { 
      bookingId, 
      bookingCode,
      amount, 
      method,
      customerName,
      customerPhone,
      customerEmail,
      metadata = {}
    } = req.body;
    
    console.log('=== CREATING PAYMENT ===');
    console.log('Booking ID:', bookingId);
    console.log('Amount:', amount);
    console.log('Method:', method);
    
    // Validate
    if (!bookingId || !amount || !method) {
      return res.status(400).json({
        code: 'error',
        message: 'Thiếu thông tin thanh toán bắt buộc!'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        code: 'error',
        message: 'Số tiền không hợp lệ!'
      });
    }
    
    if (!Object.values(config.PAYMENT_METHODS).includes(method)) {
      return res.status(400).json({
        code: 'error',
        message: 'Phương thức thanh toán không hợp lệ!'
      });
    }
    
    // Kiểm tra payment đã tồn tại chưa
    const existingPayment = await Payment.findByBookingId(bookingId);
    if (existingPayment && existingPayment.status === config.PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        code: 'error',
        message: 'Booking này đã được thanh toán!'
      });
    }
    
    // Tạo payment code
    const paymentCode = generatePaymentCode();
    
    // Tạo payment record
    const payment = new Payment({
      paymentCode,
      bookingId,
      bookingCode,
      amount,
      method,
      customerName,
      customerPhone,
      customerEmail,
      status: method === config.PAYMENT_METHODS.CASH ? 
              config.PAYMENT_STATUS.COMPLETED : 
              config.PAYMENT_STATUS.PENDING,
      metadata
    });
    
    await payment.save();
    
    console.log('✓ Payment created:', paymentCode);
    
    // Nếu là tiền mặt, đánh dấu luôn là completed
    if (method === config.PAYMENT_METHODS.CASH) {
      return res.status(201).json({
        code: 'success',
        message: 'Tạo payment thành công!',
        data: {
          paymentId: payment._id,
          paymentCode: payment.paymentCode,
          status: payment.status,
          method: payment.method
        }
      });
    }
    
    // Với payment online, tạo payment URL
    let paymentUrl = null;
    let gatewayResponse = null;
    
    try {
      const paymentData = {
        orderId: payment.paymentCode,
        amount: payment.amount,
        orderInfo: `Thanh toan dat ve ${bookingCode || bookingId}`,
        description: `Thanh toan booking ${bookingCode || bookingId}`
      };
      
      if (method === config.PAYMENT_METHODS.MOMO) {
        console.log('🔵 Creating MoMo payment...');
        const momoResult = await momoHelper.createPayment(paymentData);
        console.log('🔵 MoMo Result:', momoResult);
        
        if (momoResult.success) {
          paymentUrl = momoResult.payUrl;
          gatewayResponse = momoResult.response;
          payment.metadata.requestId = momoResult.requestId;
        } else {
          console.error('❌ MoMo failed:', momoResult.error);
        }
        
      } else if (method === config.PAYMENT_METHODS.ZALOPAY) {
        console.log('🔵 Creating ZaloPay payment...');
        const zalopayResult = await zalopayHelper.createPayment(paymentData);
        console.log('🔵 ZaloPay Result:', zalopayResult);
        
        if (zalopayResult.success) {
          paymentUrl = zalopayResult.orderUrl;
          gatewayResponse = zalopayResult.response;
          payment.metadata.transId = zalopayResult.transId;
        } else {
          console.error('❌ ZaloPay failed:', zalopayResult.error);
        }
        
      } else if (method === config.PAYMENT_METHODS.VNPAY) {
        console.log('🔵 Creating VNPay payment...');
        const vnpayResult = vnpayHelper.createPayment(paymentData);
        console.log('🔵 VNPay Result:', vnpayResult);
        
        if (vnpayResult.success) {
          paymentUrl = vnpayResult.paymentUrl;
          gatewayResponse = { url: vnpayResult.paymentUrl };
        } else {
          console.error('❌ VNPay failed:', vnpayResult.error);
        }
      }
      
      if (paymentUrl) {
        payment.metadata.paymentUrl = paymentUrl;
        payment.gatewayResponse = gatewayResponse;
        await payment.save();
        
        console.log('✅ Payment URL created:', paymentUrl);
      } else {
        console.error('❌ Failed to create payment URL');
      }
      
    } catch (gatewayError) {
      console.error('❌ Gateway error:', gatewayError);
      // Không throw error, vẫn trả về payment record
    }
    
    return res.status(201).json({
      code: 'success',
      message: 'Tạo payment thành công!',
      data: {
        paymentId: payment._id,
        paymentCode: payment.paymentCode,
        status: payment.status,
        method: payment.method,
        paymentUrl: paymentUrl,
        expiresAt: payment.expiresAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating payment:', error);
    return res.status(500).json({
      code: 'error',
      message: 'Không thể tạo payment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===== [GET] /api/payments/:id =====
module.exports.getById = async (req, res) => {
  try {
    const paymentId = req.params.id;
    
    const payment = await Payment.findOne({
      _id: paymentId,
      deleted: false
    });
    
    if (!payment) {
      return res.status(404).json({
        code: 'error',
        message: 'Payment không tồn tại!'
      });
    }
    
    return res.json({
      code: 'success',
      data: { payment }
    });
    
  } catch (error) {
    console.error('Error getting payment:', error);
    return res.status(500).json({
      code: 'error',
      message: 'Không thể lấy thông tin payment'
    });
  }
};

// ===== [GET] /api/payments/code/:paymentCode =====
module.exports.getByCode = async (req, res) => {
  try {
    const paymentCode = req.params.paymentCode;
    
    const payment = await Payment.findOne({
      paymentCode: paymentCode,
      deleted: false
    });
    
    if (!payment) {
      return res.status(404).json({
        code: 'error',
        message: 'Payment không tồn tại!'
      });
    }
    
    return res.json({
      code: 'success',
      data: { payment }
    });
    
  } catch (error) {
    console.error('Error getting payment by code:', error);
    return res.status(500).json({
      code: 'error',
      message: 'Không thể lấy thông tin payment'
    });
  }
};

// ===== [GET] /api/payments/booking/:bookingId =====
module.exports.getByBookingId = async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    
    const payment = await Payment.findByBookingId(bookingId);
    
    if (!payment) {
      return res.status(404).json({
        code: 'error',
        message: 'Chưa có payment cho booking này!'
      });
    }
    
    return res.json({
      code: 'success',
      data: { payment }
    });
    
  } catch (error) {
    console.error('Error getting payment by booking:', error);
    return res.status(500).json({
      code: 'error',
      message: 'Không thể lấy thông tin payment'
    });
  }
};

// ===== [POST] /api/payments/callback/momo =====
module.exports.momoCallback = async (req, res) => {
  try {
    console.log('=== MOMO CALLBACK ===', req.body);
    
    const verification = momoHelper.verifyCallback(req.body);
    
    if (!verification.valid) {
      console.error('❌ MoMo invalid signature');
      return res.status(400).json({
        resultCode: 1,
        message: 'Invalid signature'
      });
    }
    
    const { orderId, resultCode } = req.body;
    const payment = await Payment.findOne({ paymentCode: orderId });
    
    if (!payment) {
      console.error('❌ MoMo payment not found:', orderId);
      return res.status(404).json({
        resultCode: 2,
        message: 'Payment not found'
      });
    }
    
    console.log('📄 Found Payment:', {
      paymentCode: payment.paymentCode,
      currentStatus: payment.status,
      amount: payment.amount
    });
    
    if (verification.success) {
      payment.status = config.PAYMENT_STATUS.COMPLETED;
      payment.transactionId = verification.transactionId;
      payment.gatewayResponse = req.body;
      payment.paidAt = new Date();
      
      await payment.save();
      
      console.log('✅ MoMo payment completed:', payment.paymentCode);
      
      // Update booking
      try {
        await updateBookingPaymentStatus(payment.bookingId, {
          paymentId: payment._id,
          paymentCode: payment.paymentCode,
          amount: payment.amount,
          provider: 'momo',
          transactionId: verification.transactionId,
          paidAt: payment.paidAt
        });
        console.log('✅ Updated booking payment status:', payment.bookingId);
      } catch (bookingError) {
        console.error('❌ Failed to update booking:', bookingError.message);
      }
      
      return res.json({ 
        resultCode: 0,
        message: 'Success'
      });
      
    } else {
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = req.body;
      await payment.save();
      
      console.log('❌ MoMo payment failed:', payment.paymentCode, 'ResultCode:', resultCode);
      
      return res.json({ 
        resultCode: 0,
        message: 'Failed payment recorded'
      });
    }
    
  } catch (error) {
    console.error('❌ MoMo callback error:', error);
    return res.status(500).json({
      resultCode: 3,
      message: 'Callback processing failed'
    });
  }
};

// ===== [GET] /api/payments/return/momo - FIXED =====
module.exports.momoReturn = async (req, res) => {
  try {
    console.log('=== MOMO RETURN URL ===', req.query);
    
    const { orderId, resultCode, message } = req.query;
    
    // ✅ KHÔNG verify signature cho return URL
    // MoMo return URL không đảm bảo signature như IPN
    // Chỉ cần kiểm tra resultCode
    
    if (!orderId) {
      console.log('❌ MoMo missing orderId');
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?error=invalid_params&message=${encodeURIComponent('Thiếu thông tin giao dịch')}`
      );
    }
    
    const payment = await Payment.findOne({ 
      paymentCode: orderId,
      deleted: false 
    });
    
    if (!payment) {
      console.log('❌ MoMo payment not found:', orderId);
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?error=payment_not_found&paymentCode=${orderId}`
      );
    }
    
    console.log('📄 Found Payment:', {
      paymentCode: payment.paymentCode,
      currentStatus: payment.status,
      amount: payment.amount,
      resultCode: resultCode
    });
    
    // ✅ resultCode = 0 hoặc '0' là thành công
    if (resultCode == 0) {
      console.log('✅ MoMo return with success status');
      
      // ✅ Đợi callback cập nhật status (tối đa 5 giây)
      let attempts = 0;
      while (attempts < 10 && payment.status !== config.PAYMENT_STATUS.COMPLETED) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ✅ Dùng findOne thay vì reload()
        const updatedPayment = await Payment.findOne({ 
          paymentCode: orderId,
          deleted: false 
        });
        
        if (updatedPayment && updatedPayment.status === config.PAYMENT_STATUS.COMPLETED) {
          console.log('✅ Payment status updated to COMPLETED');
          break;
        }
        
        attempts++;
      }
      
      return res.redirect(
        `${process.env.FRONTEND_SUCCESS_URL}?bookingId=${payment.bookingId}&paymentCode=${payment.paymentCode}&amount=${payment.amount}`
      );
      
    } else {
      console.log('❌ MoMo return with failed status:', resultCode);
      
      const errorMessages = {
        '1': 'Giao dịch thất bại',
        '2': 'Giao dịch bị từ chối',
        '9': 'Giao dịch đang được xử lý',
        '10': 'Giao dịch không hợp lệ',
        '11': 'Truy cập bị từ chối',
        '12': 'Phiên bản API không được hỗ trợ',
        '13': 'Xác thực merchant thất bại',
        '20': 'Số tiền không hợp lệ',
        '21': 'Số tiền vượt quá hạn mức',
        '1001': 'Giao dịch bị timeout',
        '1002': 'Giao dịch bị từ chối bởi nhà phát hành',
        '1003': 'Giao dịch bị hủy bởi người dùng',
        '1004': 'Giao dịch thất bại do lỗi hệ thống',
        '1005': 'Giao dịch đã tồn tại',
        '1006': 'Người dùng từ chối xác nhận thanh toán'
      };
      
      const errorMessage = errorMessages[resultCode] || message || 'Thanh toán thất bại';
      
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?bookingId=${payment.bookingId}&error=payment_failed&responseCode=${resultCode}&message=${encodeURIComponent(errorMessage)}`
      );
    }
    
  } catch (error) {
    console.error('❌ MoMo return error:', error);
    return res.redirect(
      `${process.env.FRONTEND_FAILED_URL}?error=system_error&message=${encodeURIComponent(error.message)}`
    );
  }
};

// ===== [POST] /api/payments/callback/zalopay =====
module.exports.zalopayCallback = async (req, res) => {
  try {
    console.log('=== ZALOPAY CALLBACK RECEIVED ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const { data: dataStr, mac: reqMac } = req.body;
    
    if (!dataStr || !reqMac) {
      console.error('❌ Missing data or mac in callback');
      return res.json({ 
        return_code: -1, 
        return_message: 'Missing required fields' 
      });
    }
    
    const verification = zalopayHelper.verifyCallback(req.body);
    
    if (!verification.valid) {
      console.error('❌ Invalid MAC signature');
      return res.json({ 
        return_code: -1, 
        return_message: 'Invalid MAC' 
      });
    }
    
    console.log('✅ Signature verified successfully');
    
    const callbackData = JSON.parse(dataStr);
    console.log('📦 Callback Data:', callbackData);
    
    const payment = await Payment.findOne({ 
      paymentCode: verification.orderId,
      deleted: false 
    });
    
    if (!payment) {
      console.error('❌ Payment not found:', verification.orderId);
      return res.json({ 
        return_code: 2, 
        return_message: 'Order not found' 
      });
    }
    
    console.log('📄 Found Payment:', {
      paymentCode: payment.paymentCode,
      currentStatus: payment.status,
      amount: payment.amount
    });
    
    if (payment.status === config.PAYMENT_STATUS.COMPLETED) {
      console.log('⚠️ Payment already completed, skipping...');
      return res.json({ 
        return_code: 1, 
        return_message: 'Already processed' 
      });
    }
    
    if (verification.success) {
      payment.status = config.PAYMENT_STATUS.COMPLETED;
      payment.transactionId = verification.transactionId;
      payment.gatewayResponse = callbackData;
      payment.paidAt = new Date();
      
      await payment.save();
      
      console.log('✅ Payment marked as COMPLETED:', payment.paymentCode);
      
      try {
        await updateBookingPaymentStatus(payment.bookingId, {
          paymentId: payment._id,
          paymentCode: payment.paymentCode,
          amount: payment.amount,
          provider: 'zalopay',
          transactionId: verification.transactionId,
          paidAt: payment.paidAt
        });
        
        console.log('✅ Updated booking payment status:', payment.bookingId);
      } catch (bookingError) {
        console.error('❌ Failed to update booking:', bookingError.message);
      }
      
      return res.json({ 
        return_code: 1, 
        return_message: 'Success' 
      });
      
    } else {
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = callbackData;
      await payment.save();
      
      console.log('❌ ZaloPay payment failed:', payment.paymentCode);
      
      return res.json({ 
        return_code: 1, 
        return_message: 'Failed payment recorded' 
      });
    }
    
  } catch (error) {
    console.error('❌ ZaloPay callback error:', error);
    console.error('Stack:', error.stack);
    
    return res.json({ 
      return_code: 0, 
      return_message: 'Error processing callback' 
    });
  }
};

// ===== [GET] /api/payments/return/zalopay - FIXED =====
module.exports.zalopayReturn = async (req, res) => {
  try {
    console.log('=== ZALOPAY RETURN URL ===', req.query);
    
    // ✅ ĐÚNG THEO TÀI LIỆU: lowercase parameters
    const { status, apptransid, appid, pmcid, bankcode, amount, discountamount, checksum } = req.query;
    
    if (!apptransid) {
      console.log('❌ Missing apptransid');
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?error=invalid_params&message=${encodeURIComponent('Thiếu thông tin giao dịch')}`
      );
    }
    
    console.log('🔍 Looking for payment with transId:', apptransid);
    
    // ✅ TÌM PAYMENT THEO app_trans_id (260112_914987)
    // Cách 1: Tìm theo transId trong metadata (được lưu khi createPayment)
    let payment = await Payment.findOne({ 
      'metadata.transId': apptransid,
      deleted: false 
    });
    
    console.log('🔍 Search result (metadata.transId):', payment ? 'FOUND' : 'NOT FOUND');
    
    // Cách 2: Nếu không tìm thấy, tìm theo app_trans_id trong gatewayResponse (callback)
    if (!payment) {
      console.log('🔍 Trying gatewayResponse.app_trans_id...');
      payment = await Payment.findOne({
        'gatewayResponse.app_trans_id': apptransid,
        deleted: false
      });
      console.log('🔍 Search result (gatewayResponse):', payment ? 'FOUND' : 'NOT FOUND');
    }
    
    // Cách 3: Tìm payment ZaloPay mới nhất (vì có thể callback chưa về)
    if (!payment) {
      console.log('🔍 Trying latest ZaloPay payment...');
      payment = await Payment.findOne({
        method: 'zalopay',
        status: { $in: ['pending', 'processing', 'completed'] },
        deleted: false
      }).sort({ createdAt: -1 });
      
      if (payment) {
        console.log('⚠️ Found payment by fallback:', payment.paymentCode);
      }
    }
    
    if (!payment) {
      console.log('❌ ZaloPay payment not found for transId:', apptransid);
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?error=payment_not_found&transId=${apptransid}`
      );
    }
    
    console.log('📄 Found Payment:', {
      paymentCode: payment.paymentCode,
      currentStatus: payment.status,
      amount: payment.amount,
      returnStatus: status
    });
    
    // Status = 1 là thành công, status = -1 hoặc 2 là thất bại/hủy
    if (status === '1') {
      console.log('✅ ZaloPay return with success status');
      
      // ✅ Đợi callback cập nhật (tối đa 5 giây)
      let attempts = 0;
      while (attempts < 10 && payment.status !== config.PAYMENT_STATUS.COMPLETED) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ✅ Dùng findOne thay vì reload()
        payment = await Payment.findOne({ 
          'metadata.transId': apptransid,
          deleted: false 
        });
        
        if (payment && payment.status === config.PAYMENT_STATUS.COMPLETED) {
          console.log('✅ Payment status updated to COMPLETED');
          break;
        }
        
        attempts++;
      }
      
      return res.redirect(
        `${process.env.FRONTEND_SUCCESS_URL}?bookingId=${payment.bookingId}&paymentCode=${payment.paymentCode}&amount=${payment.amount}`
      );
      
    } else {
      console.log('❌ ZaloPay return with failed status:', status);
      
      const errorMessages = {
        '-1': 'Giao dịch thất bại',
        '2': 'Giao dịch bị hủy',
        '3': 'Giao dịch đang chờ xử lý'
      };
      
      const errorMessage = errorMessages[status] || 'Thanh toán thất bại';
      
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?bookingId=${payment.bookingId}&error=payment_failed&responseCode=${status}&message=${encodeURIComponent(errorMessage)}`
      );
    }
    
  } catch (error) {
    console.error('❌ ZaloPay return error:', error);
    return res.redirect(
      `${process.env.FRONTEND_FAILED_URL}?error=system_error&message=${encodeURIComponent(error.message)}`
    );
  }
};
// ===== [GET] /api/payments/callback/vnpay =====
module.exports.vnpayCallback = async (req, res) => {
  try {
    console.log('=== VNPAY CALLBACK RECEIVED ===');
    console.log('Query Params:', JSON.stringify(req.query, null, 2));
    
    const verification = vnpayHelper.verifyCallback(req.query);
    
    console.log('🔐 Verification Result:', {
      valid: verification.valid,
      success: verification.success,
      responseCode: verification.responseCode,
      orderId: verification.orderId
    });
    
    if (!verification.valid) {
      console.log('❌ VNPay invalid signature');
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?error=invalid_signature&message=${encodeURIComponent('Chữ ký không hợp lệ')}`
      );
    }
    
    // Tìm payment
    const payment = await Payment.findOne({ 
      paymentCode: verification.orderId,
      deleted: false 
    });
    
    if (!payment) {
      console.log('❌ VNPay payment not found:', verification.orderId);
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?error=payment_not_found&paymentCode=${verification.orderId}`
      );
    }
    
    console.log('📄 Found Payment:', {
      paymentCode: payment.paymentCode,
      currentStatus: payment.status,
      amount: payment.amount
    });
    
    // Kiểm tra response code từ VNPay
    if (verification.success && verification.responseCode === '00') {
      // Chỉ update nếu chưa completed
      if (payment.status !== config.PAYMENT_STATUS.COMPLETED) {
        payment.status = config.PAYMENT_STATUS.COMPLETED;
        payment.transactionId = verification.transactionId;
        payment.gatewayResponse = req.query;
        payment.paidAt = new Date();
        
        await payment.save();
        
        console.log('✅ VNPay payment completed:', payment.paymentCode);
        
        // Update booking status
        try {
          await updateBookingPaymentStatus(payment.bookingId, {
            paymentId: payment._id,
            paymentCode: payment.paymentCode,
            amount: payment.amount,
            provider: 'vnpay',
            transactionId: verification.transactionId,
            paidAt: payment.paidAt
          });
          console.log('✅ Updated booking payment status:', payment.bookingId);
        } catch (bookingError) {
          console.error('❌ Failed to update booking:', bookingError.message);
        }
      } else {
        console.log('⚠️ Payment already completed, skipping update');
      }
      
      // Redirect về success page
      return res.redirect(
        `${process.env.FRONTEND_SUCCESS_URL}?bookingId=${payment.bookingId}&paymentCode=${payment.paymentCode}&amount=${payment.amount}`
      );
      
    } else {
      // Payment failed hoặc bị hủy
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = req.query;
      await payment.save();
      
      console.log('❌ VNPay payment failed:', payment.paymentCode, 'ResponseCode:', verification.responseCode);
      
      // Mapping response code sang message
      const errorMessages = {
        '07': 'Giao dịch bị nghi ngờ gian lận',
        '09': 'Thẻ chưa đăng ký dịch vụ',
        '10': 'Xác thực thông tin thẻ không thành công',
        '11': 'Đã hết hạn chờ thanh toán',
        '12': 'Thẻ bị khóa',
        '13': 'Sai mật khẩu OTP',
        '24': 'Giao dịch bị hủy',
        '51': 'Tài khoản không đủ số dư',
        '65': 'Tài khoản vượt quá hạn mức giao dịch',
        '75': 'Ngân hàng thanh toán đang bảo trì',
        '79': 'Giao dịch vượt quá số lần nhập sai mật khẩu',
        '99': 'Lỗi không xác định'
      };
      
      const errorMessage = errorMessages[verification.responseCode] || 'Thanh toán thất bại';
      
      return res.redirect(
        `${process.env.FRONTEND_FAILED_URL}?bookingId=${payment.bookingId}&error=payment_failed&responseCode=${verification.responseCode}&message=${encodeURIComponent(errorMessage)}`
      );
    }
    
  } catch (error) {
    console.error('❌ VNPay callback error:', error);
    console.error('Stack:', error.stack);
    
    return res.redirect(
      `${process.env.FRONTEND_FAILED_URL}?error=system_error&message=${encodeURIComponent(error.message)}`
    );
  }
};

// ===== Helper function =====
async function updateBookingPaymentStatus(bookingId, paymentInfo) {
  if (!BOOKING_SERVICE_URL) {
    console.warn('⚠️ BOOKING_SERVICE_URL not configured');
    return;
  }
  
  try {
    await axios.patch(
      `${BOOKING_SERVICE_URL}/api/bookings/${bookingId}/payment-completed`,
      paymentInfo,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': SERVICE_TOKEN
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Updated booking payment status:', bookingId);
  } catch (error) {
    console.error('❌ Failed to update booking:', error.message);
    throw error;
  }
}