// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_SECURE_API_KEY",
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

// Current language (default to Vietnamese)
let currentLanguage = 'vi';

// Admission fees and other data structures
const admissionFees = {
    // Your admission fees data
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize date pickers
    flatpickr(".datepicker", {
        locale: "vn",
        minDate: "today",
        disable: [],
        dateFormat: "d/m/Y"
    });
    
    // Load booked dates from Firebase
    loadBookedDates();
    
    // Set up service type toggle
    document.getElementById('serviceType').addEventListener('change', function() {
        document.getElementById('travelService').classList.toggle('active', this.value === 'travel');
        document.getElementById('airportService').classList.toggle('active', this.value === 'airport');
    });
    
    // Set up language toggle
    document.getElementById('languageToggle').addEventListener('click', function() {
        currentLanguage = currentLanguage === 'en' ? 'vi' : 'en';
        this.textContent = currentLanguage === 'en' ? 'Tiếng Việt' : 'English';
        translatePage();
    });
    
    // Load saved form data
    loadFormData();
    
    // Initialize all other functionality
    initFormValidation();
    initCostCalculation();
    initAutocomplete();
    initPayPalButton();
});

// All other functions (loadBookedDates, translatePage, calculateCost, etc.)
// would go here in the script.js file

function showLoader() {
    document.getElementById('loader').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

function validateForm(formId) {
    // Form validation implementation
}

function calculateCost() {
    // Cost calculation implementation
}

// Continue with all other functions...
