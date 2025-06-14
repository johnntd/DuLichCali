import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

window.firebaseApp = initializeApp({
  apiKey: "AIzaSyAqedC3BuDKq9zlqfRN6Oamuy_sPE8eN_k",
  authDomain: "dulichcalifornia-b8059.firebaseapp.com",
  projectId: "dulichcalifornia-b8059",
  storageBucket: "dulichcalifornia-b8059.firebasestorage.app",
  messagingSenderId: "925284621075",
  appId: "1:925284621075:web:65e6125a1bed22206dd8e6"
});
window.db = getFirestore(window.firebaseApp);
console.log('Firebase initialized successfully');

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Cost Calculation Logic
const distances = {
  'Disneyland': 60,
  'California Adventure': 60,
  'Universal Studios': 100,
  'San Diego Zoo': 190,
  'SeaWorld': 190,
  'LegoLand': 140,
  'Las Vegas': 540,
  'Grand Canyon': 960,
  'San Francisco': 860,
  'Yosemite': 700,
  'Lake Tahoe': 960,
  'Reno': 1000,
  'Silicon Valley': 760
};

const admissionFees = {
  'San Diego Zoo': { adult: 70, kid: 70 },
  'SeaWorld': { adult: 90, kid: 90 },
  'LegoLand': { adult: 100, kid: 100 },
  'Las Vegas': { adult: 0, kid: 0 },
  'Grand Canyon': { adult: 25, kid: 25 },
  'San Francisco': { adult: 0, kid: 0 },
  'Yosemite': { adult: 20, kid: 20 },
  'Lake Tahoe': { adult: 0, kid: 0 },
  'Reno': { adult: 0, kid: 0 },
  'Silicon Valley': { adult: 20, kid: 20 },
  'Disneyland': { regular: { adult: 150, kid: 100 }, vip: { adult: 300, kid: 200 }, express: { adult: 200, kid: 150 } },
  'California Adventure': { regular: { adult: 150, kid: 100 }, vip: { adult: 300, kid: 200 }, express: { adult: 200, kid: 150 } },
  'Universal Studios': { regular: { adult: 120, kid: 80 }, vip: { adult: 250, kid: 180 }, express: { adult: 180, kid: 130 } }
};

const lodgingCosts = {
  'Disneyland': { hotel: 200, airbnb: 150 },
  'California Adventure': { hotel: 200, airbnb: 150 },
  'Universal Studios': { hotel: 180, airbnb: 130 },
  'San Diego Zoo': { hotel: 160, airbnb: 120 },
  'SeaWorld': { hotel: 160, airbnb: 120 },
  'LegoLand': { hotel: 160, airbnb: 120 },
  'Las Vegas': { hotel: 120, airbnb: 100 },
  'Grand Canyon': { hotel: 140, airbnb: 110 },
  'San Francisco': { hotel: 250, airbnb: 200 },
  'Yosemite': { hotel: 180, airbnb: 140 },
  'Lake Tahoe': { hotel: 200, airbnb: 160 },
  'Reno': { hotel: 130, airbnb: 100 },
  'Silicon Valley': { hotel: 250, airbnb: 200 }
};

async function calculateDistance(address) {
  if (!address) return 0;
  try {
    const geocoder = new google.maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK') {
          const origin = { lat: 33.8121, lng: -117.9190 }; // Santa Ana
          const destination = results[0].geometry.location;
          const service = new google.maps.DistanceMatrixService();
          service.getDistanceMatrix({
            origins: [origin],
            destinations: [destination],
            travelMode: 'DRIVING'
          }, (response, status) => {
            if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
              const distance = response.rows[0].elements[0].distance.value / 1609.34; // Meters to miles
              resolve(distance);
            } else {
              console.error('Distance Matrix Error:', status, response);
              resolve(0);
            }
          });
        } else {
          console.error('Geocode Error:', status);
          resolve(0);
        }
      });
    });
  } catch (err) {
    console.error('Google Maps Error:', err);
    return 0;
  }
}

async function updateCostEstimate() {
  try {
    const selectedDestinations = Array.from(destinations.selectedOptions).map(opt => opt.value);
    const numDays = parseInt(document.getElementById('num-days').value) || 1;
    const numTravelers = parseInt(numTravelers.value) || 0;
    const numAdults = parseInt(numAdults.value) || 0;
    const numKids = parseInt(numKids.value) || 0;
    const ticket = document.querySelector('#ticket-type select').value;
    const isMercedes = numTravelers > 3;
    const lodgingType = lodging.value;
    const hasMeals = document.getElementById('meals').checked;
    const hasAirportPickup = airportPickup.checked;
    const pickupAddress = document.getElementById('dropoff-address-input').value;

    let transportCost = 0;
    let admissionCost = 0;
    let mealsCost = 0;
    let lodgingCost = 0;

    // Transportation Cost
    const maxDistance = Math.max(...selectedDestinations.map(d => distances[d] || 0));
    transportCost = maxDistance * 2.5 * numDays;
    if (isMercedes) {
      transportCost += 30 * numDays;
      transportCost *= 1.2;
    }

    // Airport Pickup Cost
    if (hasAirportPickup && lodgingType === 'none' && pickupAddress) {
      const zip = pickupAddress.match(/\d{5}/)?.[0];
      if (zip?.startsWith('90')) {
        transportCost += 100;
      } else if (zip?.startsWith('908')) {
        transportCost += 80;
      } else if (zip?.match(/^926|^927|^928/) || pickupAddress.includes('Anaheim') || pickupAddress.includes('Irvine') || pickupAddress.includes('Huntington Beach')) {
        transportCost += 50;
      } else {
        const distance = await calculateDistance(pickupAddress);
        transportCost += distance * 2.5;
      }
      if (numTravelers > 4) {
        transportCost += 30;
        transportCost *= 1.2;
      }
    } else if (hasAirportPickup) {
      transportCost += 50;
      if (numTravelers > 4) {
        transportCost += 30;
        transportCost *= 1.2;
      }
    }

    // Admission Cost
    for (const dest of selectedDestinations) {
      if (['Disneyland', 'California Adventure', 'Universal Studios'].includes(dest)) {
        admissionCost += numAdults * admissionFees[dest][ticket].adult + numKids * admissionFees[dest][ticket].kid;
      } else {
        admissionCost += numTravelers * (admissionFees[dest]?.adult || 0);
      }
    }

    // Meals Cost
    if (hasMeals && selectedDestinations.some(d => ['San Francisco', 'Silicon Valley'].includes(d))) {
      mealsCost = 35 * numTravelers * numDays;
    }

    // Lodging Cost
    if (lodgingType !== 'none') {
      const primaryDest = selectedDestinations[0];
      let baseCost = lodgingCosts[primaryDest]?.[lodgingType] || 150;
      if (numTravelers > 5) baseCost *= Math.ceil(numTravelers / 5);
      if (lodgingType === 'airbnb') baseCost += numTravelers * 20;
      lodgingCost = baseCost * numDays;
    }

    // Update UI
    document.getElementById('transport-cost').textContent = transportCost.toFixed(2);
    document.getElementById('admission-cost').textContent = admissionCost.toFixed(2);
    document.getElementById('meals-cost').textContent = mealsCost.toFixed(2);
    document.getElementById('lodging-cost').textContent = lodgingCost.toFixed(2);
    document.getElementById('total-cost').textContent = (transportCost + admissionCost + mealsCost + lodgingCost).toFixed(2);

    // PayPal Button
    const paypalContainer = document.getElementById('paypal-button-container');
    const paypalFallback = document.getElementById('paypal-fallback');
    if (window.paypal) {
      console.log('PayPal SDK loaded successfully');
      try {
        paypalContainer.innerHTML = '';
        paypalFallback.classList.add('hidden');
        paypal.Buttons({
          createOrder: (data, actions) => {
            return actions.order.create({
              purchase_units: [{
                amount: {
                  value: (admissionCost + lodgingCost).toFixed(2),
                  breakdown: {
                    item_total: { value: (admissionCost + lodgingCost).toFixed(2), currency_code: 'USD' }
                  }
                }
              }]
            });
          },
          onApprove: (data, actions) => {
            return actions.order.capture().then(() => {
              document.getElementById('travel-package-form').dataset.paymentStatus = 'completed';
              document.getElementById('travel-package-form').submit();
            });
          },
          onError: (err) => {
            console.error('PayPal Button Error:', err);
            paypalContainer.innerHTML = '<p>Lỗi khi tải thanh toán PayPal. Vui lòng thử lại hoặc gửi yêu cầu mà không thanh toán trước.</p>';
            paypalFallback.classList.remove('hidden');
          }
        }).render('#paypal-button-container');
      } catch (err) {
        console.error('PayPal SDK Error:', err);
        paypalContainer.innerHTML = '<p>Lỗi khi tải PayPal. Vui lòng gửi yêu cầu và thanh toán sau.</p>';
        paypalFallback.classList.remove('hidden');
      }
    } else {
      console.error('PayPal SDK not loaded');
      paypalContainer.innerHTML = '<p>PayPal hiện không khả dụng. Vui lòng gửi yêu cầu và thanh toán sau.</p>';
      paypalFallback.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Cost Estimate Error:', err);
    alert(currentLang === 'vi' ? 'Lỗi khi tính toán chi phí. Vui lòng thử lại.' : 'Error calculating cost. Please try again.');
  }
}

async function updateAirportCostEstimate() {
  try {
    const serviceType = airportServiceType.value;
    const address = document.getElementById('airport-address').value;
    const numPeople = parseInt(document.querySelector('#airport-form input[name="num_people"]').value) || 0;
    const isMercedes = numPeople > 4;

    let transportCost = 0;
    if (numPeople < 4) {
      const zip = address.match(/\d{5}/)?.[0];
      if (zip?.startsWith('90')) {
        transportCost = 100;
      } else if (zip?.startsWith('908')) {
        transportCost = 80;
      } else if (zip?.match(/^926|^927|^928/) || address.includes('Anaheim') || address.includes('Irvine') || address.includes('Huntington Beach')) {
        transportCost = 50;
      } else {
        transportCost = 150;
      }
    } else {
      const distance = await calculateDistance(address);
      transportCost = distance * 2.5;
    }

    if (isMercedes) {
      transportCost += 30;
      transportCost *= 1.2;
    }

    document.getElementById('airport-transport-cost').textContent = transportCost.toFixed(2);
    document.getElementById('airport-total-cost').textContent = transportCost.toFixed(2);
  } catch (err) {
    console.error('Airport Cost Estimate Error:', err);
    alert(currentLang === 'vi' ? 'Lỗi khi tính toán chi phí sân bay. Vui lòng thử lại.' : 'Error calculating airport cost. Please try again.');
  }
}

// Debounced versions
const debouncedUpdateCostEstimate = debounce(updateCostEstimate, 500);
const debouncedUpdateAirportCostEstimate = debounce(updateAirportCostEstimate, 500);

// Language Toggle
const translations = {
  vi: {
    title: "Du Lịch California",
    langToggle: "Chuyển sang Tiếng Anh",
    serviceLabel: "Chọn Dịch Vụ:",
    travel: "Gói Du Lịch",
    airport: "Dịch Vụ Sân Bay",
    date: "Ngày Đi:",
    time: "Giờ Đi:",
    name: "Tên Khách Hàng:",
    phone: "Số Điện Thoại:",
    email: "Email:",
    airportLabel: "Sân Bay:",
    packageLabel: "Gói Du Lịch:",
    destinations: "Chọn Điểm Đến:",
    ticketType: "Loại Vé (Disneyland/Universal):",
    travelers: "Số Người (1–12):",
    adults: "Số Người Lớn:",
    kids: "Số Trẻ Em:",
    days: "Số Ngày:",
    lodging: "Lưu Trú:",
    dropoff: "Địa Chỉ Đưa Đón:",
    meals: "Bữa Ăn Tự Chọn (Khu vực Vịnh):",
    airportPickup: "Đón Sân Bay:",
    costEstimate: "Ước Tính Chi Phí",
    transport: "Phí Vận Chuyển:",
    admission: "Phí Vé:",
    mealsCost: "Phí Bữa Ăn:",
    lodgingCost: "Phí Lưu Trú:",
    total: "Tổng Cộng:",
    submit: "Gửi Yêu Cầu",
    serviceType: "Loại Dịch Vụ:",
    address: "Địa Chỉ:",
    people: "Số Người (1–12):",
    payLater: "Thanh Toán Sau"
  },
  en: {
    title: "California Travel",
    langToggle: "Switch to Vietnamese",
    serviceLabel: "Select Service:",
    travel: "Travel Package",
    airport: "Airport Service",
    date: "Date:",
    time: "Time:",
    name: "Customer Name:",
    phone: "Phone Number:",
    email: "Email:",
    airportLabel: "Airport:",
    packageLabel: "Travel Package:",
    destinations: "Select Destinations:",
    ticketType: "Ticket Type (Disneyland/Universal):",
    travelers: "Number of Travelers (1–12):",
    adults: "Number of Adults:",
    kids: "Number of Kids:",
    days: "Number of Days:",
    lodging: "Lodging:",
    dropoff: "Drop-off Address:",
    meals: "Optional Meals (Bay Area):",
    airportPickup: "Airport Pickup:",
    costEstimate: "Cost Estimate",
    transport: "Transportation Cost:",
    admission: "Admission Cost:",
    mealsCost: "Meals Cost:",
    lodgingCost: "Lodging Cost:",
    total: "Total:",
    submit: "Submit Request",
    serviceType: "Service Type:",
    address: "Address:",
    people: "Number of People (1–12):",
    payLater: "Pay Later"
  }
};

let currentLang = localStorage.getItem('lang') || 'vi';
const langToggle = document.getElementById('lang-toggle');
langToggle.addEventListener('click', () => {
  currentLang = currentLang === 'vi' ? 'en' : 'vi';
  localStorage.setItem('lang', currentLang);
  updateLanguage();
});

function updateLanguage() {
  document.querySelector('h1').textContent = translations[currentLang].title;
  langToggle.textContent = translations[currentLang].langToggle;
  document.querySelector('label[for="service-type"]').textContent = translations[currentLang].serviceLabel;
  document.getElementById('service-type').options[0].text = translations[currentLang].travel;
  document.getElementById('service-type').options[1].text = translations[currentLang].airport;
  document.querySelector('#travel-form h2').textContent = translations[currentLang].travel;
  document.querySelector('#airport-form h2').textContent = translations[currentLang].airport;
  document.querySelectorAll('#travel-form label').forEach((label, i) => {
    const keys = ['date', 'time', 'name', 'phone', 'email', 'airportLabel', 'packageLabel', 'destinations', 'ticketType', 'travelers', 'adults', 'kids', 'days', 'lodging', 'dropoff', 'meals', 'airportPickup'];
    if (i < keys.length) label.textContent = translations[currentLang][keys[i]];
  });
  document.querySelectorAll('#airport-form label').forEach((label, i) => {
    const keys = ['serviceType', 'airportLabel', 'address', 'people', 'date', 'time', 'name', 'phone'];
    if (i < keys.length) label.textContent = translations[currentLang][keys[i]];
  });
  document.querySelector('#travel-form button[type="submit"]').textContent = translations[currentLang].submit;
  document.querySelector('#airport-form button[type="submit"]').textContent = translations[currentLang].submit;
  document.getElementById('pay-later').textContent = translations[currentLang].payLater;
  document.querySelector('#cost-estimate h3').textContent = translations[currentLang].costEstimate;
  document.querySelector('#airport-cost-estimate h3').textContent = translations[currentLang].costEstimate;
  document.querySelector('#cost-estimate p:nth-child(2)').innerHTML = `${translations[currentLang].transport} $<span id="transport-cost">0</span>`;
  document.querySelector('#cost-estimate p:nth-child(3)').innerHTML = `${translations[currentLang].admission} $<span id="admission-cost">0</span>`;
  document.querySelector('#cost-estimate p:nth-child(4)').innerHTML = `${translations[currentLang].mealsCost} $<span id="meals-cost">0</span>`;
  document.querySelector('#cost-estimate p:nth-child(5)').innerHTML = `${translations[currentLang].lodgingCost} $<span id="lodging-cost">0</span>`;
  document.querySelector('#cost-estimate p:nth-child(6)').innerHTML = `${translations[currentLang].total} $<span id="total-cost">0</span>`;
  document.querySelector('#airport-cost-estimate p:nth-child(2)').innerHTML = `${translations[currentLang].transport} $<span id="airport-transport-cost">0</span>`;
  document.querySelector('#airport-cost-estimate p:nth-child(3)').innerHTML = `${translations[currentLang].total} $<span id="airport-total-cost">0</span>`;
}

// Service Toggle
const serviceType = document.getElementById('service-type');
const travelForm = document.getElementById('travel-form');
const airportForm = document.getElementById('airport-form');
serviceType.addEventListener('change', () => {
  travelForm.classList.toggle('hidden', serviceType.value !== 'travel');
  airportForm.classList.toggle('hidden', serviceType.value !== 'airport');
  if (serviceType.value === 'travel') debouncedUpdateCostEstimate();
  else debouncedUpdateAirportCostEstimate();
});

// Travel Package Logic
const packageType = document.getElementById('package-type');
const destinations = document.getElementById('destinations');
const ticketType = document.getElementById('ticket-type');
const travelersInput = document.getElementById('travelers-input');
const adultKidInput = document.getElementById('adult-kid-input');
const numTravelers = document.getElementById('num-travelers');
const numAdults = document.getElementById('num-adults');
const numKids = document.getElementById('num-kids');
const lodging = document.getElementById('lodging');
const dropoffAddress = document.getElementById('dropoff-address');
const mealsOption = document.getElementById('meals-option');
const airportPickup = document.getElementById('airport-pickup');
const airportPickupDetails = document.getElementById('airport-pickup-details');

const packageDestinations = {
  disneyland: ['Disneyland', 'California Adventure'],
  sandiego: ['San Diego Zoo', 'SeaWorld', 'LegoLand'],
  universal: ['Universal Studios'],
  national: ['Grand Canyon', 'Yosemite'],
  city: ['Las Vegas', 'San Francisco', 'Reno']
};

packageType.addEventListener('change', () => {
  const isCustom = packageType.value === 'custom';
  destinations.disabled = !isCustom;
  if (!isCustom) {
    Array.from(destinations.options).forEach(opt => {
      opt.selected = packageDestinations[packageType.value]?.includes(opt.value);
    });
  }
  updateTravelerInput();
  updateMealsOption();
  debouncedUpdateCostEstimate();
});

destinations.addEventListener('change', () => {
  updateTravelerInput();
  updateMealsOption();
  debouncedUpdateCostEstimate();
});

function updateTravelerInput() {
  const selectedDestinations = Array.from(destinations.selectedOptions).map(opt => opt.value);
  const isThemePark = selectedDestinations.some(d => ['Disneyland', 'California Adventure', 'Universal Studios'].includes(d));
  ticketType.classList.toggle('hidden', !isThemePark);
  travelersInput.classList.toggle('hidden', isThemePark);
  adultKidInput.classList.toggle('hidden', !isThemePark);
  if (isThemePark) {
    numTravelers.value = (parseInt(numAdults.value) || 0) + (parseInt(numKids.value) || 0);
  }
  debouncedUpdateCostEstimate();
}

numAdults.addEventListener('input', () => {
  numTravelers.value = (parseInt(numAdults.value) || 0) + (parseInt(numKids.value) || 0);
  debouncedUpdateCostEstimate();
});

numKids.addEventListener('input', () => {
  numTravelers.value = (parseInt(numAdults.value) || 0) + (parseInt(numKids.value) || 0);
  debouncedUpdateCostEstimate();
});

numTravelers.addEventListener('input', debouncedUpdateCostEstimate);
document.getElementById('num-days').addEventListener('input', debouncedUpdateCostEstimate);
document.querySelector('#ticket-type select').addEventListener('change', debouncedUpdateCostEstimate);
lodging.addEventListener('change', () => {
  dropoffAddress.classList.toggle('hidden', lodging.value === 'none');
  debouncedUpdateCostEstimate();
});

document.getElementById('meals').addEventListener('change', debouncedUpdateCostEstimate);
airportPickup.addEventListener('change', () => {
  airportPickupDetails.classList.toggle('hidden', !airportPickup.checked);
  debouncedUpdateCostEstimate();
});

function updateMealsOption() {
  const selectedDestinations = Array.from(destinations.selectedOptions).map(opt => opt.value);
  mealsOption.classList.toggle('hidden', !selectedDestinations.some(d => ['San Francisco', 'Silicon Valley'].includes(d)));
}

// Airport Service Logic
const airportServiceType = document.getElementById('airport-service-type');
airportServiceType.addEventListener('change', debouncedUpdateAirportCostEstimate);
document.querySelector('#airport-form input[name="num_people"]').addEventListener('input', debouncedUpdateAirportCostEstimate);
document.querySelector('#airport-form select[name="airport"]').addEventListener('change', debouncedUpdateAirportCostEstimate);

async function updateCalendar() {
  const travelDate = document.getElementById('travel-date');
  const airportDate = document.querySelector('#airport-form input[name="date"]');
  try {
    const querySnapshot = await getDocs(collection(db, 'bookings'));
    const bookedDates = querySnapshot.docs.map(doc => doc.data().date);
    console.log('Booked dates:', bookedDates);
    const today = new Date();
    travelDate.min = today.toISOString().split('T')[0];
    airportDate.min = today.toISOString().split('T')[0];
    travelDate.addEventListener('input', () => {
      if (bookedDates.includes(travelDate.value)) {
        travelDate.setCustomValidity(currentLang === 'vi' ? 'Ngày này đã được đặt. Vui lòng chọn ngày khác.' : 'This date is already booked. Please select another date.');
      } else {
        travelDate.setCustomValidity('');
      }
      debouncedUpdateCostEstimate();
    });
    airportDate.addEventListener('input', () => {
      if (bookedDates.includes(airportDate.value)) {
        airportDate.setCustomValidity(currentLang === 'vi' ? 'Ngày này đã được đặt. Vui lòng chọn ngày khác.' : 'This date is already booked. Please select another date.');
      } else {
        airportDate.setCustomValidity('');
      }
      debouncedUpdateAirportCostEstimate();
    });
  } catch (err) {
    console.error('Firebase Calendar Error:', err);
  }
}

// Form Submission
document.getElementById('travel-package-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const paymentStatus = document.getElementById('travel-package-form').dataset.paymentStatus || 'pending';
    await addDoc(collection(db, 'bookings'), {
      date: document.getElementById('travel-date').value,
      type: 'travel',
      paymentStatus: paymentStatus
    });
    window.location.href = 'thankyou.html';
  } catch (err) {
    console.error('Firebase Error:', err);
    alert(currentLang === 'vi' ? 'Lỗi khi lưu đặt chỗ. Vui lòng thử lại.' : 'Error saving booking. Please try again.');
  }
});

document.getElementById('airport-service-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await addDoc(collection(db, 'bookings'), {
      date: document.querySelector('#airport-form input[name="date"]').value,
      type: 'airport',
      paymentStatus: 'pending'
    });
    window.location.href = 'thankyou.html';
  } catch (err) {
    console.error('Firebase Error:', err);
    alert(currentLang === 'vi' ? 'Lỗi khi lưu đặt chỗ. Vui lòng thử lại.' : 'Error saving booking. Please try again.');
  }
});

// Google Maps Autocomplete Initialization
function initAutocomplete() {
  try {
    const dropoffInput = document.getElementById('dropoff-address-input');
    const airportAddressInput = document.getElementById('airport-address');

    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not loaded');
      return;
    }

    const dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput, { types: ['address'] });
    const airportAutocomplete = new google.maps.places.Autocomplete(airportAddressInput, { types: ['address'] });

    dropoffAutocomplete.addListener('place_changed', () => {
      const place = dropoffAutocomplete.getPlace();
      if (place && place.formatted_address) {
        dropoffInput.value = place.formatted_address;
        console.log('Dropoff address selected:', place.formatted_address);
        debouncedUpdateCostEstimate();
      }
    });

    airportAutocomplete.addListener('place_changed', () => {
      const place = airportAutocomplete.getPlace();
      if (place && place.formatted_address) {
        airportAddressInput.value = place.formatted_address;
        console.log('Airport address selected:', place.formatted_address);
        debouncedUpdateAirportCostEstimate();
      }
    });
  } catch (err) {
    console.error('Google Maps Autocomplete Error:', err);
    alert(currentLang === 'vi' ? 'Lỗi khi tải autocomplete địa chỉ. Vui lòng nhập địa chỉ thủ công.' : 'Error loading address autocomplete. Please enter the address manually.');
  }
}

// Global initMap for Google Maps callback
window.initMap = function() {
  initAutocomplete();
  console.log('Google Maps API loaded and initialized');
};

// Initialize
window.addEventListener('load', () => {
  updateLanguage();
  updateCalendar();
  if (!window.google || !window.google.maps) {
    console.warn('Google Maps API not yet loaded; waiting for initMap callback');
  } else {
    initMap();
  }
  if (serviceType.value === 'travel') debouncedUpdateCostEstimate();
  else debouncedUpdateAirportCostEstimate();
});
