const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const serviceAuth = require('../middleware/serviceAuth.middleware');

// ===== PUBLIC ROUTES =====

// Tạo payment
router.post('/create', paymentController.create);

// Lấy thông tin payment
router.get('/:id', paymentController.getById);

// Lấy payment theo payment code
router.get('/code/:paymentCode', paymentController.getByCode);

// Lấy payment theo booking
router.get('/booking/:bookingId', paymentController.getByBookingId);

// ===== CALLBACK ROUTES (từ Payment Gateways) =====

// MoMo IPN callback (server-to-server)
router.post('/callback/momo', paymentController.momoCallback);

// MoMo return URL (redirect user sau khi thanh toán)
router.get('/return/momo', paymentController.momoReturn);

// ZaloPay callback (server-to-server)
router.post('/callback/zalopay', paymentController.zalopayCallback);

// ZaloPay return URL (redirect user sau khi thanh toán)
router.get('/return/zalopay', paymentController.zalopayReturn);

// VNPay return URL (redirect user sau khi thanh toán)
router.get('/callback/vnpay', paymentController.vnpayCallback);

module.exports = router;