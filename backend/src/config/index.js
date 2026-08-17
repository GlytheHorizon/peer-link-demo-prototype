require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'peerlink-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d'
};