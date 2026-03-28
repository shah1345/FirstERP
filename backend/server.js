const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');

const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/replacements', require('./routes/replacements'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/company', require('./routes/company'));
app.use('/api/reports', require('./routes/reports')); // ← ADD THIS LINE
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/outlets', require('./routes/outlets'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/outlet-ops', require('./routes/outletOps'));
app.use('/api/production', require('./routes/production')); 
app.use('/api/super', require('./routes/superAdmin'));
app.use('/api/vendors', require('./routes/vendors'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Battery POS API is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    await testConnection();
    app.listen(PORT, () => {
        console.log(`
⚡ Battery POS Server Running
🌐 URL: http://localhost:${PORT}
📡 API: http://localhost:${PORT}/api
🔑 Default Login: admin@batterypos.com / admin123
    `);
    });
}

startServer();