const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://sportgid:sportgid_pass@127.0.0.1:5432/sportgid' }
  }
});
p.$connect()
  .then(() => { console.log('Prisma connected!'); return p.$disconnect(); })
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
