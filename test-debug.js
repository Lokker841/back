const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://sportgid:sportgid_pass@127.0.0.1:5432/sportgid' } },
  log: ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty',
});
p.$connect()
  .then(() => { console.log('SUCCESS'); return p.$disconnect(); })
  .catch(e => { console.error('CODE:', e.errorCode); console.error('MSG:', e.message.slice(0, 300)); });