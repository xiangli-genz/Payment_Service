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
      return res.status(400).json({
        resultCode: 1,
        message: 'Invalid signature'
      });
    }
    
    const { orderId, resultCode } = req.body;
    const payment = await Payment.findOne({ paymentCode: orderId });
    
    if (!payment) {
      return res.status(404).json({
        resultCode: 2,
        message: 'Payment not found'
      });
    }
    
    if (verification.success) {
      payment.status = config.PAYMENT_STATUS.COMPLETED;
      payment.transactionId = verification.transactionId;
      payment.gatewayResponse = req.body;
      payment.paidAt = new Date();
      
      await payment.save();
      
      await updateBookingPaymentStatus(payment.bookingId, {
        paymentId: payment._id,
        paymentCode: payment.paymentCode,
        amount: payment.amount,
        provider: 'momo'
      });
      
      console.log('✅ MoMo payment completed:', payment.paymentCode);
    } else {
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = req.body;
      await payment.save();
      
      console.log('❌ MoMo payment failed:', payment.paymentCode, 'ResultCode:', resultCode);
    }
    
    return res.json({ 
      resultCode: 0,
      message: 'Success'
    });
    
  } catch (error) {
    console.error('❌ MoMo callback error:', error);
    return res.status(500).json({
      resultCode: 3,
      message: 'Callback processing failed'
    });
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

// ===== [GET] /api/payments/callback/vnpay =====
module.exports.vnpayCallback = async (req, res) => {
  try {
    console.log('=== VNPAY CALLBACK ===', req.query);
    
    const verification = vnpayHelper.verifyCallback(req.query);
    
    if (!verification.valid) {
      console.log('❌ VNPay invalid signature');
      return res.redirect(`${process.env.FRONTEND_FAILED_URL}?error=invalid_signature`);
    }
    
    const payment = await Payment.findOne({ paymentCode: verification.orderId });
    
    if (!payment) {
      console.log('❌ VNPay payment not found:', verification.orderId);
      return res.redirect(`${process.env.FRONTEND_FAILED_URL}?error=payment_not_found`);
    }
    
    if (verification.success) {
      payment.status = config.PAYMENT_STATUS.COMPLETED;
      payment.transactionId = verification.transactionId;
      payment.gatewayResponse = req.query;
      payment.paidAt = new Date();
      
      await payment.save();
      
      await updateBookingPaymentStatus(payment.bookingId, {
        paymentId: payment._id,
        paymentCode: payment.paymentCode,
        amount: payment.amount,
        provider: 'vnpay'
      });
      
      console.log('✅ VNPay payment completed:', payment.paymentCode);
      
      return res.redirect(`${process.env.FRONTEND_SUCCESS_URL}?bookingId=${payment.bookingId}&paymentCode=${payment.paymentCode}`);
    } else {
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = req.query;
      await payment.save();
      
      console.log('❌ VNPay payment failed:', payment.paymentCode);
      
      return res.redirect(`${process.env.FRONTEND_FAILED_URL}?bookingId=${payment.bookingId}&error=payment_failed`);
    }
    
  } catch (error) {
    console.error('❌ VNPay callback error:', error);
    return res.redirect(`${process.env.FRONTEND_FAILED_URL}?error=system_error`);
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