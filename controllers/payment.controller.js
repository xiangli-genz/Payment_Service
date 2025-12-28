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
        const momoResult = await momoHelper.createPayment(paymentData);
        if (momoResult.success) {
          paymentUrl = momoResult.payUrl;
          gatewayResponse = momoResult.response;
          payment.metadata.requestId = momoResult.requestId;
        }
      } else if (method === config.PAYMENT_METHODS.ZALOPAY) {
        const zalopayResult = await zalopayHelper.createPayment(paymentData);
        if (zalopayResult.success) {
          paymentUrl = zalopayResult.orderUrl;
          gatewayResponse = zalopayResult.response;
          payment.metadata.transId = zalopayResult.transId;
        }
      } else if (method === config.PAYMENT_METHODS.VNPAY) {
        const vnpayResult = vnpayHelper.createPayment(paymentData);
        if (vnpayResult.success) {
          paymentUrl = vnpayResult.paymentUrl;
          gatewayResponse = { url: vnpayResult.paymentUrl };
        }
      }
      
      if (paymentUrl) {
        payment.metadata.paymentUrl = paymentUrl;
        payment.gatewayResponse = gatewayResponse;
        await payment.save();
      }
      
    } catch (gatewayError) {
      console.error('Gateway error:', gatewayError);
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
        code: 'error',
        message: 'Invalid signature'
      });
    }
    
    const { orderId } = req.body;
    const payment = await Payment.findOne({ paymentCode: orderId });
    
    if (!payment) {
      return res.status(404).json({
        code: 'error',
        message: 'Payment not found'
      });
    }
    
    if (verification.success) {
      payment.status = config.PAYMENT_STATUS.COMPLETED;
      payment.transactionId = verification.transactionId;
      payment.gatewayResponse = req.body;
      payment.paidAt = new Date();
      
      await payment.save();
      
      // Callback to booking service
      await updateBookingPaymentStatus(payment.bookingId, {
        paymentId: payment._id,
        paymentCode: payment.paymentCode,
        amount: payment.amount,
        provider: 'momo'
      });
      
      console.log('✓ MoMo payment completed:', payment.paymentCode);
    } else {
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = req.body;
      await payment.save();
    }
    
    // ✅ Return for MoMo (JSON response required)
    return res.json({ resultCode: 0 });
    
  } catch (error) {
    console.error('MoMo callback error:', error);
    return res.status(500).json({
      code: 'error',
      message: 'Callback processing failed'
    });
  }
};

// ===== [POST] /api/payments/callback/zalopay =====
module.exports.zalopayCallback = async (req, res) => {
  try {
    console.log('=== ZALOPAY CALLBACK ===', req.body);
    
    const verification = zalopayHelper.verifyCallback(req.body);
    
    if (!verification.valid) {
      return res.json({ return_code: -1, return_message: 'Invalid MAC' });
    }
    
    const payment = await Payment.findOne({ paymentCode: verification.orderId });
    
    if (!payment) {
      return res.json({ return_code: 2, return_message: 'Order not found' });
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
        provider: 'zalopay'
      });
      
      console.log('✓ ZaloPay payment completed:', payment.paymentCode);
    } else {
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = req.body;
      await payment.save();
    }
    
    // ✅ Return for ZaloPay (JSON response required)
    return res.json({ return_code: 1, return_message: 'Success' });
    
  } catch (error) {
    console.error('ZaloPay callback error:', error);
    return res.json({ return_code: 0, return_message: 'Error' });
  }
};

// ===== [GET] /api/payments/callback/vnpay =====
module.exports.vnpayCallback = async (req, res) => {
  try {
    console.log('=== VNPAY CALLBACK ===', req.query);
    
    const verification = vnpayHelper.verifyCallback(req.query);
    
    if (!verification.valid) {
      return res.redirect(`${process.env.GATEWAY_URL}/payment/failed?error=invalid_signature`);
    }
    
    const payment = await Payment.findOne({ paymentCode: verification.orderId });
    
    if (!payment) {
      return res.redirect(`${process.env.GATEWAY_URL}/payment/failed?error=payment_not_found`);
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
      
      console.log('✓ VNPay payment completed:', payment.paymentCode);
      
      return res.redirect(`${process.env.GATEWAY_URL}/booking/success?bookingId=${payment.bookingId}`);
    } else {
      payment.status = config.PAYMENT_STATUS.FAILED;
      payment.gatewayResponse = req.query;
      await payment.save();
      
      return res.redirect(`${process.env.GATEWAY_URL}/payment/failed?bookingId=${payment.bookingId}`);
    }
    
  } catch (error) {
    console.error('VNPay callback error:', error);
    return res.redirect(`${process.env.GATEWAY_URL}/payment/failed?error=system_error`);
  }
};

// ===== Helper: Update booking payment status =====
async function updateBookingPaymentStatus(bookingId, paymentInfo) {
  try {
    await axios.patch(
      `${BOOKING_SERVICE_URL}/api/bookings/${bookingId}/payment-completed`,
      paymentInfo,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': SERVICE_TOKEN
        }
      }
    );
    
    console.log('✓ Updated booking payment status:', bookingId);
  } catch (error) {
    console.error('❌ Failed to update booking:', error.message);
  }
}