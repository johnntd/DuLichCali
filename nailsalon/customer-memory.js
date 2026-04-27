// nailsalon/customer-memory.js
// Shared returning-customer lookup and greeting helper for salon receptionist pages.
(function (root) {
  'use strict';

  function normalizePhone(input) {
    if (input == null) return null;
    var raw = String(input);
    var pi = root.PhoneIntake || null;
    var normalized = pi && typeof pi.normalizeSpokenPhoneNumber === 'function'
      ? pi.normalizeSpokenPhoneNumber(raw)
      : null;
    var digits = normalized || raw.replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    return digits.length === 10 ? digits : null;
  }

  function vendorIdFromBiz(biz) {
    return (biz && (biz.id || biz.slug || biz.vendorId)) || '';
  }

  function valueFromRecord(record) {
    if (!record) return null;
    if (typeof record.data === 'function') {
      var data = record.data() || {};
      if (!data.id && record.id) data.id = record.id;
      return data;
    }
    return record;
  }

  function createdMillis(record) {
    var d = record && (record.createdAt || record.updatedAt || record.requestedDate || record.date);
    if (!d) return 0;
    if (d.toMillis) return d.toMillis();
    if (typeof d === 'number') return d;
    var parsed = Date.parse(d);
    return isNaN(parsed) ? 0 : parsed;
  }

  function serviceFromRecord(record) {
    if (!record) return null;
    if (Array.isArray(record.services) && record.services.length) return record.services.join(' + ');
    if (Array.isArray(record.selectedServices) && record.selectedServices.length) return record.selectedServices.join(' + ');
    return record.serviceType || record.service || null;
  }

  function safeCustomer(record, vendorId, phone) {
    var data = valueFromRecord(record);
    if (!data) return null;
    var recVendor = data.vendorId || data.vendor_id || vendorId;
    if (vendorId && recVendor && recVendor !== vendorId) return null;
    var recPhone = normalizePhone(data.customerPhone || data.phone || data.customer_phone || '');
    if (!recPhone || recPhone !== phone) return null;
    return {
      name: data.customerName || data.name || null,
      lastService: serviceFromRecord(data),
      lastStaff: data.staff || data.technician || data.stylist || null,
      lastAppointmentDate: data.requestedDate || data.date || null,
      vendorId: recVendor || vendorId || null
    };
  }

  function fromRecords(records, vendorId, phone) {
    var matches = (records || [])
      .map(function (r) { return valueFromRecord(r); })
      .filter(function (r) { return !!safeCustomer(r, vendorId, phone); })
      .sort(function (a, b) { return createdMillis(b) - createdMillis(a); });
    return matches.length ? safeCustomer(matches[0], vendorId, phone) : null;
  }

  function findReturningSalonCustomerInRecords(records, biz, phone) {
    return fromRecords(records || [], vendorIdFromBiz(biz), normalizePhone(phone));
  }

  function lookupReturningSalonCustomer(opts) {
    opts = opts || {};
    var biz = opts.biz || {};
    var vendorId = opts.vendorId || vendorIdFromBiz(biz);
    var phone = normalizePhone(opts.phone);
    if (!phone || !vendorId) return Promise.resolve(null);

    if (opts.records) {
      return Promise.resolve(fromRecords(opts.records, vendorId, phone));
    }

    var db = opts.db || root.dlcDb;
    if (!db || !db.collection) return Promise.resolve(null);

    var bookingsRef = db.collection('vendors').doc(vendorId).collection('bookings');

    function query(field) {
      return bookingsRef
        .where(field, '==', phone)
        .get()
        .then(function (snap) {
          return (snap && snap.docs ? snap.docs : [])
            .map(function (doc) { return valueFromRecord(doc); })
            .map(function (data) {
              if (data && !data.vendorId) data.vendorId = vendorId;
              return data;
            });
        });
    }

    function scanVendorBookings() {
      if (!bookingsRef.get) return Promise.resolve([]);
      return bookingsRef.get().then(function (snap) {
        return (snap && snap.docs ? snap.docs : [])
          .map(function (doc) { return valueFromRecord(doc); })
          .map(function (data) {
            if (data && !data.vendorId) data.vendorId = vendorId;
            return data;
          });
      });
    }

    var fields = ['customerPhoneNormalized', 'phoneNormalized', 'normalizedPhone', 'customerPhone', 'phone'];

    function tryNextField(index) {
      if (index >= fields.length) return scanVendorBookings();
      return query(fields[index]).then(function (docs) {
        return docs.length ? docs : tryNextField(index + 1);
      })
      .catch(function () { return tryNextField(index + 1); });
    }

    return tryNextField(0)
      .then(function (docs) { return fromRecords(docs, vendorId, phone); })
      .catch(function () { return null; });
  }

  function buildReturningCustomerGreeting(customer, lang) {
    customer = customer || {};
    lang = lang || 'en';
    var name = customer.name || '';
    var service = customer.lastService || null;
    var staff = customer.lastStaff || null;

    if (lang === 'vi') {
      if (name && service && staff) {
        return 'Dạ chào anh/chị ' + name + ', lần trước mình đặt ' + service + ' với ' + staff + '. Hôm nay mình muốn đặt lại dịch vụ đó với ' + staff + ', hay chọn dịch vụ khác ạ?';
      }
      if (name) return 'Dạ chào anh/chị ' + name + ', hôm nay mình muốn đặt dịch vụ gì ạ?';
      return null;
    }

    if (lang === 'es') {
      if (name && service && staff) {
        return 'Bienvenido de nuevo, ' + name + '. La última vez reservó ' + service + ' con ' + staff + '. ¿Quiere reservar lo mismo otra vez o prefiere algo diferente?';
      }
      if (name) return 'Bienvenido de nuevo, ' + name + '. ¿Qué le gustaría reservar hoy?';
      return null;
    }

    if (name && service && staff) {
      return 'Welcome back, ' + name + '. Last time you booked ' + service + ' with ' + staff + '. Would you like the same service with ' + staff + ' again, or something different today?';
    }
    if (name) return 'Welcome back, ' + name + '. What would you like to book today?';
    return null;
  }

  var api = {
    normalizePhone: normalizePhone,
    findReturningSalonCustomerInRecords: findReturningSalonCustomerInRecords,
    lookupReturningSalonCustomer: lookupReturningSalonCustomer,
    buildReturningCustomerGreeting: buildReturningCustomerGreeting
  };

  root.SalonCustomerMemory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
