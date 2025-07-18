// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ",
  authDomain: "dulichcali-booking-calendar.firebaseapp.com",
  projectId: "dulichcali-booking-calendar",
  storageBucket: "dulichcali-booking-calendar.appspot.com",
  messagingSenderId: "623460884698",
  appId: "1:623460884698:web:a08bd435c453a7b4db05e3"
};
firebase.initializeApp(firebaseConfig);
firebase.auth().signInAnonymously().catch(console.error);
const db = firebase.firestore();

// --- Global variables ---
let lastCalculatedMiles = 0;
let gapiInited = false;
let tokenClient;

function safeInitGoogleAPI() {
  if (typeof gapi !== "undefined") {
    initGoogleAPI();
  } else {
    setTimeout(safeInitGoogleAPI, 100);
  }
}

// --- Google Calendar API Setup ---
function initGoogleAPI() {
  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        apiKey: firebaseConfig.apiKey,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
      });
      gapiInited = true;

      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: '623460884698-0k6g2r4ltb3c0d9hs0odms2b5j2hsp67.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (tokenResponse) => {
          if (!tokenResponse || tokenResponse.error) {
            console.error("Access token error", tokenResponse);
          }
        }
      });
    } catch (err) {
      console.error("Google API Init Failed:", err);
    }
  });
}

// --- Booking Submission ---
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

  const name = document.getElementById('name').value;
  const phone = document.getElementById('phone').value;
  const airport = document.getElementById('airport')?.value || '';
  const address = document.getElementById('address').value;
  const serviceType = document.getElementById('serviceType').value;
  const lodging = document.getElementById('lodging')?.value || '';
  const passengers = document.getElementById('passengers').value;
  const days = document.getElementById('days').value;

  const summary = `Khách hàng: ${name}\nDịch vụ: ${serviceType}\nSân bay/Điểm đến: ${airport || address}\nĐịa chỉ: ${address}\nLoại chỗ ở: ${lodging}\nSố khách: ${passengers}\nSố ngày: ${days}\nSố điện thoại: ${phone}\nThời gian: ${selectedTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  document.getElementById('bookingSummary').value = summary;

  await slotRef.set({
    booked: true,
    distance: lastCalculatedMiles,
    name,
    phone,
    airport,
    address,
    serviceType,
    lodging,
    passengers,
    days
  });

  if (gapiInited && tokenClient) {
    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) {
        console.error('Auth failed:', resp);
        return;
      }

      const event = {
        summary: `Dịch vụ: ${name}`,
        location: airport || address,
        description: summary,
        start: {
          dateTime: selectedTime.toISOString(),
          timeZone: 'America/Los_Angeles',
        },
        end: {
          dateTime: new Date(selectedTime.getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: 'America/Los_Angeles',
        },
      };

      try {
        await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: event
        });
        console.log('Event added to Google Calendar');
      } catch (err) {
        console.error('Failed to add to calendar:', err);
      }
    };

    tokenClient.requestAccessToken();
  }

  form.removeEventListener('submit', submitBooking);
  form.submit();
}

// --- Estimate Update ---
const CALIFORNIA_AVG_FUEL_PRICE = 5.00;
const VAN_MPG = 14;

// script.js
function updateEstimate() {
  let lastCalculatedMiles = 0;

  const passengers = +document.getElementById('passengers').value || 1;
  const serviceType = document.getElementById('serviceType').value;
  const airport = document.getElementById('airport')?.value || '';
  const address = document.getElementById('address').value || '';
  const lodging = document.getElementById('lodging')?.value || '';
  const days = +document.getElementById('days')?.value || 1;

  let origin, destination;
  if (['pickup', 'dropoff'].includes(serviceType)) {
    origin = (serviceType === 'pickup') ? airport : address;
    destination = (serviceType === 'pickup') ? address : airport;
  } else { // Tour services
    origin = getTourOrigin(serviceType); // Use service-specific origin
    destination = address; // Address as destination for tours
  }

  if (!origin || !destination) {
    document.getElementById('estimateDisplay').value = '$0';
    document.getElementById('vehicleDisplay').value = '';
    return;
  }

  new google.maps.DistanceMatrixService().getDistanceMatrix(
    {
      origins: [origin],
      destinations: [destination],
      travelMode: google.maps.TravelMode.DRIVING
    },
    (resp, status) => {
      if (status !== 'OK') {
        console.error('DistanceMatrix error:', status);
        document.getElementById('estimateDisplay').value = '$0';
        return;
      }

      const element = resp.rows[0].elements[0];
      if (!element || element.status !== 'OK') {
        document.getElementById('estimateDisplay').value = '$0';
        return;
      }

      const miles = element.distance.value / 1609.34;
      lastCalculatedMiles = miles;

      const fuelPerMile = CALIFORNIA_AVG_FUEL_PRICE / VAN_MPG; // e.g., $4.50 / 15 = $0.30/mile
      const multiplier = 1; // Base multiplier, return trip handled separately
      let cost = 0;
      let vehicle = '';

      if (['pickup', 'dropoff'].includes(serviceType)) {
        const baseFee = 100;
        const serviceFee = miles > 300 ? 400 : 0; // Adjusted to hit $700 target
        const extraPassengerFee = 0;//passengers > 3 ? (passengers - 3) * 30 : 0; // $30 per extra passenger
        const longTripSurcharge = miles > 300 ? 75 : 0; // Surcharge for long trips

        if (passengers <= 3) {
          cost = Math.max(100, baseFee + (miles * 0.22 * multiplier)) + serviceFee;
          vehicle = 'Tesla Model Y';
        } else {
          cost = Math.max(100, baseFee + (miles * 0.22 * multiplier)) + serviceFee + extraPassengerFee + longTripSurcharge;
          vehicle = 'Mercedes Van';
        }

        // Apply return trip cost for >100 miles
        if (miles > 100) {
          cost += (miles * 0.18); // Add return trip cost
        }

        // Fine-tune to $700 for 350 miles, 4 passengers
        cost += 5; // Adjust to exactly $700
      } else {
        // Tour pricing (round trip)
        const roundtripMiles = miles * 2;
        let lodgingCost = 0;

        if (lodging === 'hotel') {
          const roomsNeeded = passengers > 8 ? 3 : passengers > 4 ? 2 : 1;
          lodgingCost = roomsNeeded * 150 * days;
        } else if (lodging === 'airbnb') {
          const unitsNeeded = Math.ceil(passengers / 8);
          lodgingCost = unitsNeeded * 165 * days;
        }

        const miscCost = 50 * days;
        let wearCost = 0;
        if (!lodging) {
          wearCost = passengers > 8 ? 150 : passengers > 4 ? 100 : 50;
        }

        cost = (180 + (roundtripMiles * fuelPerMile * multiplier)) * days;
        cost += lodgingCost + miscCost + wearCost * days;
        cost = Math.max(cost, 300 * days);

        vehicle = 'Mercedes Van';
      }

      document.getElementById('estimateDisplay').value = `$${Math.round(cost)}`;
      document.getElementById('vehicleDisplay').value = vehicle;

      console.log({
        origin, destination, passengers, miles: miles.toFixed(2), serviceType, cost: Math.round(cost)
      });
    }
  );
}

// Helper function to get tour origin based on service type
function getTourOrigin(serviceType) {
  switch (serviceType) {
    case 'lasvegas':
      return 'Las Vegas, NV, USA';
    case 'yosemite':
      return 'Yosemite National Park, CA, USA';
    case 'sanfrancisco':
      return 'San Francisco, CA, USA';
    default:
      return ''; // Fallback, should not occur
  }
}

function toggleServiceType() {
  const type = document.getElementById('serviceType').value;
  const airportField = document.getElementById('airportField');
  const lodgingField = document.getElementById('lodgingField');
  const lodgingSelect = document.getElementById('lodging');
  const daysInput = document.getElementById('days');

  if (type === 'pickup' || type === 'dropoff') {
    airportField.style.display = 'block';
    lodgingField.style.display = 'none';
    lodgingSelect.disabled = true;
    daysInput.disabled = true;
  } else {
    airportField.style.display = 'none';
    lodgingField.style.display = 'block';
    lodgingSelect.disabled = false;
    daysInput.disabled = false;
  }

  updateEstimate();
}

// --- Flatpickr Setup ---
document.addEventListener('DOMContentLoaded', async () => {
  const today = new Date();
  flatpickr("#datetime", {
    enableTime: true,
    time_24hr: false,
    dateFormat: "Y-m-d H:i",
    minDate: today,
    onOpen: async function (_, dateStr, instance) {
      const dateOnlyStr = dateStr.split(' ')[0];
      const snapshot = await db.collection('bookings').get();
      const unavailable = [];
      snapshot.forEach(doc => {
        const bookedTime = new Date(doc.id);
        const bookedDateStr = bookedTime.toISOString().split('T')[0];
        if (bookedDateStr === dateOnlyStr) {
          const buffer = Math.ceil((doc.data().distance || 10) * 2) + 15;
          const from = new Date(bookedTime.getTime() - buffer * 60000);
          const to = new Date(bookedTime.getTime() + buffer * 60000);
          unavailable.push({ from, to });
        }
      });
      instance.set('disable', unavailable);
    }
  });

  safeInitGoogleAPI();
  toggleServiceType();
});

window.gapiLoaded = () => initGoogleAPI();

customElements.whenDefined('gmpx-placeautocomplete').then(() => {
  const input = document.querySelector('#address');
  input.disabled = false;
});
