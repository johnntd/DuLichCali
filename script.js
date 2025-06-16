const firebaseConfig = {
  apiKey: "AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ",
  authDomain: "dulichcali-booking-calendar.firebaseapp.com",
  projectId: "dulichcali-booking-calendar",
  storageBucket: "dulichcali-booking-calendar.appspot.com",
  messagingSenderId: "623460884698",
  appId: "1:623460884698:web:a08bd435c453a7b4db05e3"
};

firebase.initializeApp(firebaseConfig);
firebase.auth().signInAnonymously().catch((error) => {
  console.error("Anonymous login failed:", error);
});

const db = firebase.firestore();

function initAutocomplete() {
  const input = document.getElementById('address');
  if (google.maps.places && input) {
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.addListener('place_changed', () => {
      updateEstimate();
    });
  }

  new google.maps.Map(document.getElementById("map"), {
    center: { lat: 33.7456, lng: -117.8678 },
    zoom: 8
  });
}
function toggleServiceType() {
  const type = document.getElementById('serviceType').value;
  const label = document.getElementById('addressLabel');
  label.innerText = (type === 'pickup') ? 'Địa chỉ đến' : 'Địa chỉ đón';
  updateEstimate();
}

function updateEstimate() {
  lastCalculatedMiles = 0; // Reset every time user updates input

  const passengers = parseInt(document.getElementById('passengers').value) || 1;
  const airport = document.getElementById('airport').value;
  const address = document.getElementById('address').value;
  const serviceType = document.getElementById('serviceType').value;
  const origin = (serviceType === 'pickup') ? airport : address;
  const destination = (serviceType === 'pickup') ? address : airport;

  if (!origin || !destination) {
    document.getElementById('estimateDisplay').value = "$0";
    document.getElementById('vehicleDisplay').value = "";
    return;
  }

  const distanceService = new google.maps.DistanceMatrixService();
  distanceService.getDistanceMatrix({
    origins: [origin],
    destinations: [destination],
    travelMode: google.maps.TravelMode.DRIVING
  }, (response, status) => {
    if (status === 'OK') {
      const element = response.rows[0].elements[0];
      if (element && element.status === 'OK') {
        const miles = element.distance.value / 1609.34;
        lastCalculatedMiles = miles;

        let cost = (passengers < 4)
          ? Math.max(40, miles * 2.5)
          : (miles > 75 ? Math.max(150, miles * 2.5 * 2) : Math.max(125, miles * 2.5));

        const vehicle = (passengers > 3) ? 'Mercedes Van' : 'Tesla Model Y';

        document.getElementById('estimateDisplay').value = `$${Math.round(cost)}`;
        document.getElementById('vehicleDisplay').value = `${vehicle}`;
      } else {
        // Invalid distance result
        document.getElementById('estimateDisplay').value = "$0";
        document.getElementById('vehicleDisplay').value = "";
      }
    } else {
      // Distance matrix failed
      console.error("DistanceMatrix error:", status);
      document.getElementById('estimateDisplay').value = "$0";
      document.getElementById('vehicleDisplay').value = "";
    }
  });
}

  let lastCalculatedMiles = 0;

  async function fetchUnavailableSlots(dateStr) {
  const snapshot = await db.collection('bookings').get();
  const unavailable = [];

  snapshot.forEach(doc => {
    const bookedTime = new Date(doc.id);
    const bookedDateStr = bookedTime.toISOString().split('T')[0];
    if (bookedDateStr === dateStr) {
      const distance = doc.data().distance || 10;
      const bufferMinutes = Math.ceil(distance * 2) + 15;
      const from = new Date(bookedTime.getTime() - bufferMinutes * 60000);
      const to = new Date(bookedTime.getTime() + bufferMinutes * 60000);
      unavailable.push({ from, to });
    }
  });

  return unavailable;
}

document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('datetime');
  const today = new Date();

  flatpickr(dateInput, {
    enableTime: true,
    time_24hr: false,
    dateFormat: "Y-m-d H:i",
    minDate: today,
    onOpen: async function(selectedDates, dateStr, instance) {
      const dateOnlyStr = (new Date()).toISOString().split('T')[0];
      const unavailableRanges = await fetchUnavailableSlots(dateOnlyStr);
      instance.set('disable', unavailableRanges);
    }
  });
});

async function submitBooking(event) {
  event.preventDefault();

  const form = document.getElementById('bookingForm');
  const datetime = document.getElementById('datetime').value;
  const selectedTime = new Date(datetime);
  const slotRef = db.collection('bookings').doc(datetime);

  const snapshot = await db.collection('bookings').get();

  for (const doc of snapshot.docs) {
    const bookedTime = new Date(doc.id);
    const distance = doc.data().distance || 10;
    const bufferMinutes = Math.ceil(distance * 2) + 15;

    const diff = Math.abs((selectedTime - bookedTime) / 60000);
    if (diff < bufferMinutes) {
      document.getElementById('slotWarning').innerText =
        `Khung giờ xung đột với lịch ${bookedTime.toLocaleTimeString()} (cần cách ${bufferMinutes} phút).`;
      return false;
    }
  }

  // 🧠 Add this to generate Vietnamese summary
  const name = document.getElementById('name').value;
  const phone = document.getElementById('phone').value;
  const airport = document.getElementById('airport').value;
  const address = document.getElementById('address').value;
  const serviceType = document.getElementById('serviceType').value;
  const timeString = selectedTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const summary = `Khách hàng: ${name}
Dịch vụ: ${serviceType === 'pickup' ? 'Đón tại sân bay' : 'Đưa đến sân bay'}
Sân bay: ${airport}
${serviceType === 'pickup' ? 'Địa chỉ đến' : 'Địa chỉ đón'}: ${address}
Số điện thoại: ${phone}
Thời gian: ${timeString}`;

  // Set the hidden input value to summary
  const hiddenInput = document.getElementById('bookingSummary');
  if (hiddenInput) {
    hiddenInput.value = summary;
  }

  await slotRef.set({
    booked: true,
    distance: lastCalculatedMiles
  });

  form.removeEventListener('submit', submitBooking);
  form.submit();
}
