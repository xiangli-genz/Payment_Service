const mongoose = require('mongoose');
const config = require('../config/config');

const paymentSchema = new mongoose.Schema(
  {
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    
    // Liên kết với booking
    bookingId: {
      type: String,
      required: true,
      index: true
    },
    bookingCode: String,
    
    // Thông tin thanh toán
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    
    method: {
      type: String,
      enum: Object.values(config.PAYMENT_METHODS),
      required: true
    },
    
    status: {
      type: String,
      enum: Object.values(config.PAYMENT_STATUS),
      default: config.PAYMENT_STATUS.PENDING,
      index: true
    },
    
    // Thông tin khách hàng
    customerName: String,
    customerPhone: String,
    customerEmail: String,
    
    // Thông tin giao dịch từ payment gateway
    transactionId: String,        // ID từ MoMo/ZaloPay/VNPay
    gatewayResponse: Object,      // Response đầy đủ từ gateway
    
    // Thời gian
    expiresAt: {
      type: Date,
      index: true
    },
    paidAt: Date,
    
    // Metadata
    metadata: {
      type: Object,
      default: {}
    },
    
    // Hoàn tiền
    refundAmount: {
      type: Number,
      default: 0
    },
    refundedAt: Date,
    refundReason: String,
    
    deleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: Date
  },
  {
    timestamps: true
  }
);

// Index compound
paymentSchema.index({ 
  bookingId: 1, 
  status: 1, 
  deleted: 1 
});

// TTL Index: Tự động xóa payment pending sau 24h
paymentSchema.index(
  { expiresAt: 1 }, 
  { 
    expireAfterSeconds: 86400,
    partialFilterExpression: { 
      status: config.PAYMENT_STATUS.PENDING 
    }
  }
);

// Pre save middleware
paymentSchema.pre('save', function(next) {
  // Set expiresAt cho payment mới
  if (this.isNew && this.status === config.PAYMENT_STATUS.PENDING) {
    this.expiresAt = new Date(Date.now() + config.PAYMENT_TIMEOUT);
  }
  
  // Set paidAt khi completed
  if (this.status === config.PAYMENT_STATUS.COMPLETED && !this.paidAt) {
    this.paidAt = new Date();
    this.expiresAt = null;
  }
  
  next();
});

// Static methods
paymentSchema.statics.findByBookingId = function(bookingId) {
  return this.findOne({
    bookingId: bookingId,
    deleted: false
  }).sort({ createdAt: -1 });
};

paymentSchema.statics.findByTransactionId = function(transactionId) {
  return this.findOne({
    transactionId: transactionId,
    deleted: false
  });
};

// Instance methods
paymentSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

paymentSchema.methods.canRefund = function() {
  return this.status === config.PAYMENT_STATUS.COMPLETED && 
         this.refundAmount === 0;
};

const Payment = mongoose.model('Payment', paymentSchema, 'payments');

module.exports = Payment;