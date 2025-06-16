const firebaseConfig = {
      apiKey: "AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ",
      authDomain: "dulichcali-booking-calendar.firebaseapp.com",
      projectId: "dulichcali-booking-calendar",
      storageBucket: "dulichcali-booking-calendar.appspot.com",
      messagingSenderId: "623460884698",
      appId: "1:623460884698:web:a08bd435c453a7b4db05e3"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    function initAutocomplete() {
      const input = document.getElementById('address');
      if (google.maps.places && input) {
        new google.maps.places.Autocomplete(input);
      }
      new google.maps.Map(document.getElementById("map"), {
        center: { lat: 33.7456, lng: -117.8678 },
        zoom: 7
      });
    }

    function toggleServiceType() {
      const type = document.getElementById('serviceType').value;
      const label = document.getElementById('addressLabel');
      label.innerText = (type === 'pickup') ? 'Địa chỉ đến' : 'Địa chỉ đón';
      updateEstimate();
    }

    function updateEstimate() {
      const passengers = parseInt(document.getElementById('passengers').value) || 1;
      const airport = document.getElementById('airport').value;
      const address = document.getElementById('address').value;
      const serviceType = document.getElementById('serviceType').value;
      const origin = (serviceType === 'pickup') ? airport : address;
      const destination = (serviceType === 'pickup') ? address : airport;

      if (!origin || !destination) return;

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
            let cost = (passengers < 4) ? Math.max(40, miles * 2.5) : (miles > 75 ? Math.max(150, miles * 2.5 * 2) : Math.max(100, miles * 2.5));
            const vehicle = (passengers > 3) ? 'Mercedes Van' : 'Tesla Model Y';
            document.getElementById('estimateDisplay').value = `$${Math.round(cost)}`;
            document.getElementById('vehicleDisplay').value = `${vehicle}`;
          }
        }
      });
    }

  async function submitBooking(event) {
  event.preventDefault();
  const form = document.getElementById('bookingForm');
  const datetime = document.getElementById('datetime').value;
  const slotRef = db.collection('bookings').doc(datetime);

  const doc = await slotRef.get();
  if (doc.exists) {
    document.getElementById('slotWarning').innerText = 'Khung giờ đã được đặt. Vui lòng chọn giờ khác.';
    return false;
  }

  await slotRef.set({ booked: true });

  // Allow native form submission to Formspree after booking is saved
  form.removeEventListener('submit', submitBooking);
  form.submit();
  }
