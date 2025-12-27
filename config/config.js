module.exports = {
  // Trạng thái payment
  PAYMENT_STATUS: {
    PENDING: 'pending',           // Chờ thanh toán
    PROCESSING: 'processing',     // Đang xử lý
    COMPLETED: 'completed',       // Thành công
    FAILED: 'failed',            // Thất bại
    CANCELLED: 'cancelled',       // Đã hủy
    REFUNDED: 'refunded'         // Đã hoàn tiền
  },
  
  // Phương thức thanh toán
  PAYMENT_METHODS: {
    CASH: 'cash',
    MOMO: 'momo',
    ZALOPAY: 'zalopay',
    VNPAY: 'vnpay',
    BANK: 'bank'
  },
  
  // Timeout cho payment (15 phút)
  PAYMENT_TIMEOUT: 15 * 60 * 1000,
  
  // Loại giao dịch
  TRANSACTION_TYPES: {
    PAYMENT: 'payment',
    REFUND: 'refund'
  }
};