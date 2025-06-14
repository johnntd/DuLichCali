// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAqedC3BuDKq9zlqfRN6Oamuy_sPE8eN_k",
    authDomain: "dulichcalifornia-b8059.firebaseapp.com",
    projectId: "dulichcalifornia-b8059",
    storageBucket: "dulichcalifornia-b8059.appspot.com",
    messagingSenderId: "925284621075",
    appId: "1:925284621075:web:65e6125a1bed22206dd8e6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Language support
const translations = {
    en: {
        // English translations
    },
    vi: {
        // Vietnamese translations
    }
};

let currentLanguage = 'vi';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initDatePickers();
    initServiceToggle();
    initLanguageToggle();
    initFormValidation();
    initCostCalculators();
    loadBookedDates();
});

function initDatePickers() {
    flatpickr(".datepicker", {
        locale: "vn",
        minDate: "today",
        dateFormat: "d/m/Y"
    });
}

function loadBookedDates() {
    const bookingsRef = database.ref('bookings');
    bookingsRef.on('value', (snapshot) => {
        const bookedDates = [];
        snapshot.forEach((childSnapshot) => {
            const booking = childSnapshot.val();
            if (booking.date) bookedDates.push(booking.date);
        });
        flatpickr(".datepicker", { disable: bookedDates });
    });
}

function calculateTransportCost() {
    // Implementation based on your requirements
}

function updateCostDisplay() {
    // Update all cost fields
}

// Initialize PayPal button
function initPayPalButton() {
    paypal.Buttons({
        createOrder: function(data, actions) {
            return actions.order.create({
                purchase_units: [{
                    amount: {
                        value: document.getElementById('totalCost').textContent.replace('$', ''),
                        currency_code: 'USD'
                    },
                    payee: {
                        email_address: 'johnntd21@icloud.com'
                    }
                }]
            });
        },
        onApprove: function(data, actions) {
            return actions.order.capture().then(function(details) {
                document.getElementById('travelForm').submit();
            });
        }
    }).render('#paypalButtonContainer');
}
