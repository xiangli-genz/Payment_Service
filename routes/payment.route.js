const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const serviceAuth = require('../middleware/serviceAuth.middleware');

// ===== PUBLIC ROUTES (từ Main App) =====

// Tạo payment
router.post('/create', paymentController.create);

// Lấy thông tin payment
router.get('/:id', paymentController.getById);

// Lấy payment theo booking
router.get('/booking/:bookingId', paymentController.getByBookingId);

// ===== CALLBACK ROUTES (từ Payment Gateways) =====

// MoMo IPN callback
router.post('/callback/momo', paymentController.momoCallback);

// ZaloPay callback
router.post('/callback/zalopay', paymentController.zalopayCallback);

// VNPay return URL
router.get('/callback/vnpay', paymentController.vnpayCallback);

module.exports = router;