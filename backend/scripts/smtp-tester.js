require('dotenv').config();
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const secure = process.env.SMTP_SECURE === 'true';
const testTo = process.argv[2] || user;

if (!host || !user || !pass) {
  console.error('FAIL: SMTP_HOST / SMTP_USER / SMTP_PASS are not set in .env');
  process.exit(1);
}

console.log(`Testing SMTP -> ${host}:${port} secure=${secure} user=${user}`);

const tx = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

tx.verify()
  .then(() => {
    console.log('VERIFY OK — attempting test send to', testTo);
    return tx.sendMail({
      from: process.env.SMTP_FROM || user,
      to: testTo,
      subject: 'PeerLink SMTP test',
      text: 'If you received this, SMTP is working from this machine.'
    });
  })
  .then((info) => {
    console.log('SEND OK — messageId:', info.messageId);
    process.exit(0);
  })
  .catch((err) => {
    console.error('SMTP ERROR:', err.message);
    if (err.response) console.error('SMTP RESPONSE:', err.response);
    process.exit(1);
  });
