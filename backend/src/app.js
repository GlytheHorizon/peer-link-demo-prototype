const express = require('express');
const cors = require('cors');
const config = require('./config');
const { protect } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '30mb' }));

// Lightweight request logging
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => res.json({ success: true, message: 'PeerLink API is running', data: { time: new Date().toISOString() } }));

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/tutors', require('./routes/tutorRoutes'));
app.use('/api/subjects', require('./routes/subjectRoutes'));
app.use('/api/matches', require('./routes/matchRoutes'));
app.use('/api/conversations', require('./routes/conversationRoutes'));
app.use('/api/messages', express.Router().get('/unread-count', protect, require('./controllers/messageController').unreadCount));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/evaluations', require('./routes/evaluationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/activity-logs', require('./routes/activityLogRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));

app.get('/api/roles', protect, (req, res) =>
  res.json({ success: true, message: 'Role check', data: { role: req.user.role } })
);

app.get('/api/tab-updates', protect, require('./controllers/tabUpdateController').getUpdates);

app.use(notFound);
app.use(errorHandler);

module.exports = app;