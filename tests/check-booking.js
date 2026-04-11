'use strict';
const path  = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../dulichcali-booking-calendar-6796caee41ac.json'))) });
const db = admin.firestore();

(async () => {
  // Get last 5 real bookings with full data
  const snap = await db.collection('bookings').orderBy('createdAt', 'desc').limit(5).get();
  snap.docs.forEach(d => {
    if (d.id.startsWith('TEST_')) return;
    const b = d.data();
    console.log('\n' + '─'.repeat(60));
    console.log('ID:', d.id);
    console.log('status:', b.status);
    console.log('serviceType:', b.serviceType);
    console.log('airport:', b.airport || '—');
    console.log('source:', b.source || '(not set)');
    console.log('driverId:', b.driverId || '(null)');
    console.log('customerName:', b.customerName || b.name || '—');
    const ts = b.createdAt ? b.createdAt.toDate().toISOString().replace('T',' ').slice(0,19) : '?';
    console.log('createdAt:', ts);
    // Show all keys
    console.log('fields:', Object.keys(b).join(', '));
  });
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
