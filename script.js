// main.js - Handles Google Maps, cost estimation, form submission, and Firebase logic

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ",
  authDomain: "dulichcali-booking-calendar.firebaseapp.com",
  projectId: "dulichcali-booking-calendar",
  storageBucket: "dulichcali-booking-calendar.appspot.com",
  messagingSenderId: "623460884698",
  appId: "1:623460884698:web:a08bd435c453a7b4db05e3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global Variables
let map, directionsService, directionsRenderer;

function initAutocomplete() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 33.6846, lng: -117.8265 },
    zoom: 8,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  const pickupInput = document.getElementById("pickup");
  const dropoffInput = document.getElementById("dropoff");

  if (pickupInput) {
    new google.maps.places.PlaceAutocompleteElement({ inputElement: pickupInput });
  }

  if (dropoffInput) {
    new google.maps.places.PlaceAutocompleteElement({ inputElement: dropoffInput });
  }
}

function calculateDistance(callback) {
  const pickup = document.getElementById("pickup")?.value;
  const dropoff = document.getElementById("dropoff")?.value;

  if (!pickup || !dropoff) return;

  const service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix(
    {
      origins: [pickup],
      destinations: [dropoff],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.IMPERIAL,
    },
    (response, status) => {
      if (status !== "OK") {
        console.error("Error with DistanceMatrixService:", status);
        return;
      }
      const distanceText = response.rows[0].elements[0].distance.text;
      const miles = parseFloat(distanceText.replace(/[^0-9.]/g, ""));
      callback(miles);
    }
  );
}

function estimateCost() {
  calculateDistance((miles) => {
    const guests = parseInt(document.getElementById("guests").value);
    let baseCost = 0;

    if (guests < 4) {
      baseCost = 40;
    } else {
      baseCost = miles > 75 ? 150 : 100;
    }

    const totalCost = miles * 2.5 + (miles > 75 ? baseCost : 0);
    document.getElementById("cost").value = `$${Math.round(totalCost)}`;
  });
}

document.getElementById("guests").addEventListener("change", estimateCost);
document.getElementById("pickup").addEventListener("change", estimateCost);
document.getElementById("dropoff").addEventListener("change", estimateCost);

// Handle booking form submission
async function handleFormSubmission(e) {
  e.preventDefault();

  const form = document.getElementById("booking-form");
  const formData = new FormData(form);
  const date = formData.get("date");
  const time = formData.get("time");

  const slotRef = db.collection("bookings").doc(`${date}_${time}`);
  const slot = await slotRef.get();

  if (slot.exists) {
    alert("This time slot is already booked.");
    return;
  }

  await slotRef.set({
    ...Object.fromEntries(formData),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  alert("Booking submitted!");
  form.reset();
}

document.getElementById("booking-form").addEventListener("submit", handleFormSubmission);
