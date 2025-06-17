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

  const summary = `Khách hàng: ${name}\nDịch vụ: ${serviceType}\nSân bay/Điểm đến: ${airport || address}\nĐịa chỉ: ${address}\nLoại chỗ ở: ${lodging}\nSố điện thoại: ${phone}\nThời gian: ${selectedTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  document.getElementById('bookingSummary').value = summary;

  await slotRef.set({
    booked: true,
    distance: lastCalculatedMiles,
    name,
    phone,
    airport,
    address,
    serviceType,
    lodging
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
function updateEstimate() {
  lastCalculatedMiles = 0;

  const passengers = parseInt(document.getElementById('passengers').value) || 1;
  const serviceType = document.getElementById('serviceType').value;
  const airport = document.getElementById('airport')?.value || '';
  const address = document.getElementById('address')?.value || '';
  const lodging = document.getElementById('lodging')?.value || '';
  const days = parseInt(document.getElementById('days')?.value) || 1;

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

        let cost = 0;

        if (['pickup', 'dropoff'].includes(serviceType)) {
          cost = (passengers < 4)
            ? Math.max(40, miles * 2.5)
            : (miles > 75 ? Math.max(150, miles * 2.5 * 2) : Math.max(125, miles * 2.5));
        } else {
          const fuelCost = miles * 2 * 2.5;
          let lodgingCost = 0;

          if (lodging === 'hotel') {
            const hotelRoomsNeeded = Math.min(2, Math.ceil(passengers / 4));
            lodgingCost = 150 * days * hotelRoomsNeeded;
          } else if (lodging === 'airbnb') {
            const airbnbUnitsNeeded = Math.min(2, Math.ceil(passengers / 8));
            lodgingCost = 165 * days * airbnbUnitsNeeded;
          }

          const vanCost = 100 * days;
          const passengerSurcharge = (passengers > 6) ? 150 : 0;
          const tolls = 50;

          cost = fuelCost + lodgingCost + vanCost + passengerSurcharge + tolls;
        }

        const vehicle = (passengers > 3) ? 'Mercedes Van' : 'Tesla Model Y';
        document.getElementById('estimateDisplay').value = `$${Math.round(cost)}`;
        document.getElementById('vehicleDisplay').value = `${vehicle}`;
      } else {
        document.getElementById('estimateDisplay').value = "$0";
        document.getElementById('vehicleDisplay').value = "";
      }
    } else {
      console.error("DistanceMatrix error:", status);
      document.getElementById('estimateDisplay').value = "$0";
      document.getElementById('vehicleDisplay').value = "";
    }
  });
}

// --- Toggle Service Type ---
function toggleServiceType() {
  const type = document.getElementById('serviceType').value;
  const addressLabel = document.getElementById('addressLabel');
  const airportField = document.getElementById('airportField');
  const lodgingField = document.getElementById('lodgingField');
  const daysInput = document.getElementById('days');

  if (type === 'pickup') {
    addressLabel.innerText = 'Địa chỉ đến';
    airportField.style.display = 'block';
    lodgingField.style.display = 'none';
    daysInput.disabled = true;
  } else if (type === 'dropoff') {
    addressLabel.innerText = 'Địa chỉ đón';
    airportField.style.display = 'block';
    lodgingField.style.display = 'none';
    daysInput.disabled = true;
  } else {
    addressLabel.innerText = 'Địa chỉ của bạn';
    airportField.style.display = 'none';
    lodgingField.style.display = 'block';
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
  console.log('Place Autocomplete ready');
  const input = document.querySelector('#address');
  input.disabled = false;
});
