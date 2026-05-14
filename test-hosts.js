const { PrismaClient } = require('@prisma/client');
const urls = [
  'postgresql://sportgid:sportgid_pass@127.0.0.1:5432/sportgid',
  'postgresql://sportgid:sportgid_pass@localhost:5432/sportgid',
  'postgresql://sportgid:sportgid_pass@host.docker.internal:5432/sportgid',
];
(async () => {
  for (const url of urls) {
    const p = new PrismaClient({ datasources: { db: { url } } });
    try { await p.$connect(); console.log('OK:', url); await p.$disconnect(); }
    catch(e) { console.log('FAIL:', url.split('@')[1], '->', e.errorCode); }
  }
})();