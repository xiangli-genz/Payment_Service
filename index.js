require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const paymentRoutes = require('./routes/payment.route');

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3003;

// ===== MIDDLEWARE =====
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.DATABASE, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✓ Payment Service: Connected to MongoDB');
})
.catch(err => {
  console.error('✗ Payment Service: MongoDB connection error:', err);
  process.exit(1);
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'payment-service',
    timestamp: new Date().toISOString()
  });
});

// ===== API ROUTES =====
app.use('/api/payments', paymentRoutes);

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('Payment Service Error:', err);
  
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      code: 'error',
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      code: 'error',
      message: 'API endpoint not found'
    });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`✓ Payment Service running on port ${PORT}`);
});

module.exports = app;