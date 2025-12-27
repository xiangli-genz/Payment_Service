module.exports.generatePaymentCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY${timestamp}${random}`;
};

module.exports.generateTransactionId = () => {
  return `TXN${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
};