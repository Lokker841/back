const { PrismaClient } = require('@prisma/client');
const urls = [
  'postgresql://sportgid:sportgid_pass@127.0.0.1:5432/sportgid',
  'postgresql://sportgid:sportgid_pass@127.0.0.1:5432/sportgid?sslmode=disable',
  'postgresql://sportgid@127.0.0.1:5432/sportgid',
];
(async () => {
  for (const url of urls) {
    const p = new PrismaClient({ datasources: { db: { url } } });
    try { await p.$connect(); console.log('OK:', url); await p.$disconnect(); }
    catch(e) { console.log('FAIL:', url, '->', e.message.slice(0,80)); }
  }
})();