document.addEventListener('DOMContentLoaded', function() {
    // Language toggle functionality
    const languageBtn = document.getElementById('language-btn');
    let currentLanguage = 'vi'; // Default to Vietnamese
    
    // Translations object
    const translations = {
        'vi': {
            'main-title': 'Dịch Vụ Du Lịch California',
            'package-label': 'Gói Du Lịch:',
            'extra-dest-label': 'Điểm Đến Bổ Sung (tùy chọn, phân cách bằng dấu phẩy):',
            'travel-date-label': 'Ngày Đi:',
            'return-date-label': 'Ngày Về:',
            'pickup-time-label': 'Giờ Đón:',
            'ticket-type-label': 'Loại Vé:',
            'num-travelers-label': 'Số Lượng Khách (1-12):',
            'adults-label': 'Người Lớn:',
            'kids-label': 'Trẻ Em (3-9 tuổi):',
            'lodging-label': 'Chỗ Ở:',
            'dropoff-address-label': 'Địa Chỉ Đến:',
            'airport-pickup-label': 'Đón Từ Sân Bay:',
            'name-label': 'Họ Tên:',
            'phone-label': 'Số Điện Thoại:',
            'email-label': 'Email:',
            'pickup-address-label': 'Địa Chỉ Đón (nếu khác Orange County):',
            'estimate-title': 'Ước Tính Chi Phí',
            'service-direction-label': 'Loại Dịch Vụ:',
            'airport-label': 'Sân Bay:',
            'dropoff-address-airport-label': 'Địa Chỉ Đến:',
            'pickup-address-airport-label': 'Địa Chỉ Đón:',
            'service-date-label': 'Ngày Dịch Vụ:',
            'service-time-label': 'Giờ:',
            'num-passengers-label': 'Số Lượng Hành Khách (1-12):',
            'name-airport-label': 'Họ Tên:',
            'phone-airport-label': 'Số Điện Thoại:',
            'estimate-title-airport': 'Ước Tính Chi Phí'
        },
        'en': {
            'main-title': 'California Travel Services',
            'package-label': 'Travel Package:',
            'extra-dest-label': 'Extra Destinations (optional, comma separated):',
            'travel-date-label': 'Departure Date:',
            'return-date-label': 'Return Date:',
            'pickup-time-label': 'Pickup Time:',
            'ticket-type-label': 'Ticket Type:',
            'num-travelers-label': 'Number of Travelers (1-12):',
            'adults-label': 'Adults:',
            'kids-label': 'Kids (3-9 years):',
            'lodging-label': 'Lodging:',
            'dropoff-address-label': 'Drop-off Address:',
            'airport-pickup-label': 'Airport Pickup:',
            'name-label': 'Full Name:',
            'phone-label': 'Phone Number:',
            'email-label': 'Email:',
            'pickup-address-label': 'Pickup Address (if outside Orange County):',
            'estimate-title': 'Cost Estimate',
            'service-direction-label': 'Service Type:',
            'airport-label': 'Airport:',
            'dropoff-address-airport-label': 'Drop-off Address:',
            'pickup-address-airport-label': 'Pickup Address:',
            'service-date-label': 'Service Date:',
            'service-time-label': 'Time:',
            'num-passengers-label': 'Number of Passengers (1-12):',
            'name-airport-label': 'Full Name:',
            'phone-airport-label': 'Phone Number:',
            'estimate-title-airport': 'Cost Estimate'
        }
    };
    
    languageBtn.addEventListener('click', function() {
        currentLanguage = currentLanguage === 'vi' ? 'en' : 'vi';
        languageBtn.textContent = currentLanguage === 'vi' ? 'English ' : 'Tiếng Việt ';
        languageBtn.innerHTML += '<i class="fas fa-language"></i>';
        translatePage();
    });
    
    function translatePage() {
        const elements = document.querySelectorAll('[id$="-label"], #main-title, #estimate-title, #estimate-title-airport');
        elements.forEach(element => {
            const id = element.id;
            if (translations[currentLanguage][id]) {
                element.textContent = translations[currentLanguage][id];
            }
        });
        
        // Update select options
        if (currentLanguage === 'en') {
            document.getElementById('service-type').innerHTML = `
                <option value="travel" selected>Travel Package</option>
                <option value="airport">Airport Service</option>
            `;
            document.getElementById('travel-package').innerHTML = `
                <option value="">-- Select package --</option>
                <option value="custom">Custom Destinations</option>
                <option value="disney">Disneyland Adventure (Disneyland + California Adventure)</option>
                <option value="san-diego">San Diego Family Fun (San Diego Zoo, SeaWorld, LegoLand)</option>
                <option value="universal">Universal Hollywood (Universal Studios)</option>
                <option value="parks">National Parks Explorer (Grand Canyon, Yosemite)</option>
                <option value="city">City Getaway (Las Vegas, San Francisco, Reno)</option>
            `;
            document.getElementById('lodging').innerHTML = `
                <option value="none">Not Needed</option>
                <option value="airbnb">Airbnb</option>
                <option value="hotel">Hotel</option>
            `;
            document.getElementById('airport-pickup').innerHTML = `
                <option value="none">Not Needed</option>
                <option value="LAX">LAX (Los Angeles)</option>
                <option value="SNA">SNA (Orange County)</option>
                <option value="LGB">LGB (Long Beach)</option>
            `;
            document.getElementById('service-direction').innerHTML = `
                <option value="pickup">Pickup from airport</option>
                <option value="dropoff">Dropoff to airport</option>
            `;
            document.getElementById('airport').innerHTML = `
                <option value="LAX">LAX (Los Angeles)</option>
                <option value="SNA">SNA (Orange County)</option>
                <option value="LGB">LGB (Long Beach)</option>
            `;
        } else {
            document.getElementById('service-type').innerHTML = `
                <option value="travel" selected>Gói Du Lịch</option>
                <option value="airport">Dịch Vụ Sân Bay</option>
            `;
            document.getElementById('travel-package').innerHTML = `
                <option value="">-- Chọn gói --</option>
                <option value="custom">Điểm Đến Tùy Chỉnh</option>
                <option value="disney">Disneyland Adventure (Disneyland + California Adventure)</option>
                <option value="san-diego">San Diego Family Fun (San Diego Zoo, SeaWorld, LegoLand)</option>
                <option value="universal">Universal Hollywood (Universal Studios)</option>
                <option value="parks">National Parks Explorer (Grand Canyon, Yosemite)</option>
                <option value="city">City Getaway (Las Vegas, San Francisco, Reno)</option>
            `;
            document.getElementById('lodging').innerHTML = `
                <option value="none">Không Cần</option>
                <option value="airbnb">Airbnb</option>
                <option value="hotel">Khách Sạn</option>
            `;
            document.getElementById('airport-pickup').innerHTML = `
                <option value="none">Không Cần</option>
                <option value="LAX">LAX (Los Angeles)</option>
                <option value="SNA">SNA (Orange County)</option>
                <option value="LGB">LGB (Long Beach)</option>
            `;
            document.getElementById('service-direction').innerHTML = `
                <option value="pickup">Đón từ sân bay</option>
                <option value="dropoff">Đưa đến sân bay</option>
            `;
            document.getElementById('airport').innerHTML = `
                <option value="LAX">LAX (Los Angeles)</option>
                <option value="SNA">SNA (Orange County)</option>
                <option value="LGB">LGB (Long Beach)</option>
            `;
        }
    }
    
    // Service type toggle
    const serviceType = document.getElementById('service-type');
    const travelForm = document.getElementById('travel-form');
    const airportForm = document.getElementById('airport-form');
    
    serviceType.addEventListener('change', function() {
        if (this.value === 'travel') {
            travelForm.classList.add('active');
            airportForm.classList.remove('active');
        } else {
            travelForm.classList.remove('active');
            airportForm.classList.add('active');
        }
    });
    
    // Initialize date pickers with disabled dates
    const today = new Date();
    const disabledDates = [];
    
    // Fetch booked dates from Firebase
    function fetchBookedDates() {
        const ref = database.ref('bookings');
        ref.once('value', (snapshot) => {
            const bookings = snapshot.val();
            if (bookings) {
                Object.keys(bookings).forEach(key => {
                    const booking = bookings[key];
                    if (booking.date) {
                        disabledDates.push(booking.date);
                    }
                    if (booking.travelDate && booking.returnDate) {
                        // Add all dates between travel and return
                        const start = new Date(booking.travelDate);
                        const end = new Date(booking.returnDate);
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                            disabledDates.push(new Date(d).toISOString().split('T')[0]);
                        }
                    }
                });
            }
            
            // Initialize date pickers after fetching booked dates
            initializeDatePickers();
        });
    }
    
    function initializeDatePickers() {
        flatpickr('.datepicker', {
            minDate: 'today',
            disable: disabledDates,
            dateFormat: 'Y-m-d',
            locale: currentLanguage === 'vi' ? {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
                    longhand: ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]
                },
                months: {
                    shorthand: ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"],
                    longhand: ["Tháng Một", "Tháng Hai", "Tháng Ba", "Tháng Tư", "Tháng Năm", "Tháng Sáu", "Tháng Bảy", "Tháng Tám", "Tháng Chín", "Tháng Mười", "Tháng Mười Một", "Tháng Mười Hai"]
                }
            } : undefined
        });
    }
    
    fetchBookedDates();
    
    // Travel package form logic
    const travelPackage = document.getElementById('travel-package');
    const themeParkOptions = document.getElementById('theme-park-options');
    const nonThemeParkGroup = document.getElementById('non-theme-park-group');
    const themeParkTravelers = document.getElementById('theme-park-travelers');
    const lodging = document.getElementById('lodging');
    const dropoffAddressGroup = document.getElementById('dropoff-address-group');
    const mealOptions = document.getElementById('meal-options');
    const adultsInput = document.getElementById('adults');
    const kidsInput = document.getElementById('kids');
    const numTravelersInput = document.getElementById('num-travelers');
    
    travelPackage.addEventListener('change', function() {
        const isThemePark = ['disney', 'universal', 'san-diego'].includes(this.value);
        const isBayArea = this.value === 'city' && document.getElementById('extra-destinations').value.includes('San Francisco') || 
                         this.value === 'city' && document.getElementById('extra-destinations').value.includes('Silicon Valley');
        
        themeParkOptions.style.display = isThemePark ? 'block' : 'none';
        nonThemeParkGroup.style.display = isThemePark ? 'none' : 'block';
        themeParkTravelers.style.display = isThemePark ? 'block' : 'none';
        mealOptions.style.display = isBayArea ? 'block' : 'none';
        
        updateCostEstimate();
    });
    
    lodging.addEventListener('change', function() {
        dropoffAddressGroup.style.display = this.value === 'none' ? 'block' : 'none';
        updateCostEstimate();
    });
    
    // Calculate total travelers for theme parks
    adultsInput.addEventListener('input', updateTravelers);
    kidsInput.addEventListener('input', updateTravelers);
    
    function updateTravelers() {
        const adults = parseInt(adultsInput.value) || 0;
        const kids = parseInt(kidsInput.value) || 0;
        numTravelersInput.value = adults + kids;
        updateCostEstimate();
    }
    
    // Airport service form logic
    const serviceDirection = document.getElementById('service-direction');
    const airportDropoffAddressGroup = document.getElementById('airport-dropoff-address-group');
    const airportPickupAddressGroup = document.getElementById('airport-pickup-address-group');
    
    serviceDirection.addEventListener('change', function() {
        if (this.value === 'pickup') {
            airportDropoffAddressGroup.style.display = 'block';
            airportPickupAddressGroup.style.display = 'none';
        } else {
            airportDropoffAddressGroup.style.display = 'none';
            airportPickupAddressGroup.style.display = 'block';
        }
        updateAirportCostEstimate();
    });
    
    // Cost calculation for travel package
    const distanceMap = {
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
    
    const ticketPrices = {
        'Disneyland': {
            'regular': { adult: 150, kid: 100 },
            'express': { adult: 200, kid: 150 },
            'vip': { adult: 300, kid: 200 }
        },
        'Universal Studios': {
            'regular': { adult: 120, kid: 80 },
            'express': { adult: 180, kid: 130 },
            'vip': { adult: 250, kid: 180 }
        },
        'San Diego Zoo': { adult: 70, kid: 70 },
        'SeaWorld': { adult: 90, kid: 90 },
        'LegoLand': { adult: 100, kid: 100 },
        'Grand Canyon': { adult: 25, kid: 25 },
        'Yosemite': { adult: 20, kid: 20 },
        'Silicon Valley': { adult: 20, kid: 20 }
    };
    
    function updateCostEstimate() {
        const package = travelPackage.value;
        const extraDests = document.getElementById('extra-destinations').value.split(',').map(d => d.trim()).filter(d => d);
        const travelDate = new Date(document.getElementById('travel-date').value);
        const returnDate = new Date(document.getElementById('return-date').value);
        const lodgingType = lodging.value;
        const numTravelers = parseInt(numTravelersInput.value) || 1;
        const adults = parseInt(adultsInput.value) || 0;
        const kids = parseInt(kidsInput.value) || 0;
        const airportPickup = document.getElementById('airport-pickup').value;
        const meals = document.getElementById('meals').checked;
        const ticketType = document.querySelector('input[name="ticket-type"]:checked').value;
        
        // Calculate number of days
        let days = 1;
        if (travelDate && returnDate && returnDate > travelDate) {
            days = Math.ceil((returnDate - travelDate) / (1000 * 60 * 60 * 24)) + 1;
        }
        
        // Transportation cost
        let transportCost = 0;
        let furthestDistance = 0;
        
        // Get destinations from package
        let destinations = [];
        switch(package) {
            case 'disney':
                destinations = ['Disneyland', 'California Adventure'];
                break;
            case 'san-diego':
                destinations = ['San Diego Zoo', 'SeaWorld', 'LegoLand'];
                break;
            case 'universal':
                destinations = ['Universal Studios'];
                break;
            case 'parks':
                destinations = ['Grand Canyon', 'Yosemite'];
                break;
            case 'city':
                destinations = ['Las Vegas', 'San Francisco', 'Reno'];
                break;
            case 'custom':
                destinations = extraDests;
                break;
        }
        
        // Add extra destinations
        destinations = [...destinations, ...extraDests];
        
        // Find furthest destination
        destinations.forEach(dest => {
            if (distanceMap[dest] && distanceMap[dest] > furthestDistance) {
                furthestDistance = distanceMap[dest];
            }
        });
        
        if (furthestDistance > 0) {
            transportCost = furthestDistance * 2 * 2.50 * days; // Round trip * $2.50/mile * days
            
            // Mercedes surcharge for >3 travelers
            if (numTravelers > 3) {
                transportCost *= 1.2; // 20% surcharge
                transportCost += 30 * days; // $30/day surcharge
            }
        }
        
        // Airport pickup cost
        let airportCost = 0;
        if (airportPickup !== 'none') {
            // Base cost assumption (simplified for demo)
            // In a real app, you'd calculate distance from pickup address to airport
            if (numTravelers < 4) {
                switch(airportPickup) {
                    case 'LAX':
                        airportCost = 100;
                        break;
                    case 'LGB':
                        airportCost = 80;
                        break;
                    case 'SNA':
                        airportCost = 50;
                        break;
                }
            } else {
                // For >3 travelers, use distance calculation with surcharge
                // Simplified for demo - would use Google Maps API in real app
                airportCost = 100; // Base
                if (numTravelers > 3) {
                    airportCost *= 1.2;
                    airportCost += 30;
                }
            }
        }
        
        // Admission tickets cost
        let ticketsCost = 0;
        if (package === 'disney') {
            const ticketPrice = ticketPrices['Disneyland'][ticketType];
            ticketsCost = (adults * ticketPrice.adult) + (kids * ticketPrice.kid);
        } else if (package === 'universal') {
            const ticketPrice = ticketPrices['Universal Studios'][ticketType];
            ticketsCost = (adults * ticketPrice.adult) + (kids * ticketPrice.kid);
        } else if (package === 'san-diego') {
            ticketsCost += (adults + kids) * ticketPrices['San Diego Zoo'].adult;
            ticketsCost += (adults + kids) * ticketPrices['SeaWorld'].adult;
            ticketsCost += (adults + kids) * ticketPrices['LegoLand'].adult;
        } else {
            // For other packages, calculate based on destinations
            destinations.forEach(dest => {
                if (ticketPrices[dest]) {
                    ticketsCost += (adults + kids) * ticketPrices[dest].adult;
                }
            });
        }
        
        // Lodging cost (simplified)
        let lodgingCost = 0;
        if (lodgingType !== 'none') {
            // Simplified calculation - in real app you'd use current market prices
            const basePrice = destinations.includes('San Francisco') || destinations.includes('Silicon Valley') ? 200 : 150;
            
            if (lodgingType === 'hotel') {
                const roomsNeeded = Math.ceil(numTravelers / 5);
                lodgingCost = basePrice * roomsNeeded * days;
            } else if (lodgingType === 'airbnb') {
                lodgingCost = basePrice * (1 + (numTravelers / 4)) * days;
            }
        }
        
        // Meals cost
        let mealsCost = 0;
        if (meals && (destinations.includes('San Francisco') || destinations.includes('Silicon Valley'))) {
            mealsCost = 35 * numTravelers * days;
        }
        
        // Update display
        document.getElementById('transport-cost').textContent = 
            currentLanguage === 'vi' ? `Vận Chuyển: $${transportCost.toFixed(2)}` : `Transportation: $${transportCost.toFixed(2)}`;
        document.getElementById('tickets-cost').textContent = 
            currentLanguage === 'vi' ? `Vé Tham Quan: $${ticketsCost.toFixed(2)}` : `Admission Tickets: $${ticketsCost.toFixed(2)}`;
        
        if (lodgingCost > 0) {
            document.getElementById('lodging-cost').style.display = 'block';
            document.getElementById('lodging-cost').textContent = 
                currentLanguage === 'vi' ? `Chỗ Ở: $${lodgingCost.toFixed(2)}` : `Lodging: $${lodgingCost.toFixed(2)}`;
        } else {
            document.getElementById('lodging-cost').style.display = 'none';
        }
        
        if (mealsCost > 0) {
            document.getElementById('meals-cost').style.display = 'block';
            document.getElementById('meals-cost').textContent = 
                currentLanguage === 'vi' ? `Bữa Ăn: $${mealsCost.toFixed(2)}` : `Meals: $${mealsCost.toFixed(2)}`;
        } else {
            document.getElementById('meals-cost').style.display = 'none';
        }
        
        if (airportCost > 0) {
            document.getElementById('airport-cost').style.display = 'block';
            document.getElementById('airport-cost').textContent = 
                currentLanguage === 'vi' ? `Đón Sân Bay: $${airportCost.toFixed(2)}` : `Airport Pickup: $${airportCost.toFixed(2)}`;
        } else {
            document.getElementById('airport-cost').style.display = 'none';
        }
        
        const total = transportCost + ticketsCost + lodgingCost + mealsCost + airportCost;
        document.getElementById('total-cost').textContent = 
            currentLanguage === 'vi' ? `Tổng Cộng: $${total.toFixed(2)}` : `Total: $${total.toFixed(2)}`;
        
        // Show PayPal button if total > 0
        if (total > 0) {
            document.getElementById('paypal-button-container-travel').style.display = 'block';
            renderPayPalButton(total);
        } else {
            document.getElementById('paypal-button-container-travel').style.display = 'none';
        }
    }
    
    // Cost calculation for airport service
    function updateAirportCostEstimate() {
        const direction = serviceDirection.value;
        const airport = document.getElementById('airport').value;
        const numPassengers = parseInt(document.getElementById('num-passengers').value) || 1;
        
        // Simplified cost calculation - in real app you'd use Google Maps API
        let baseCost = 0;
        switch(airport) {
            case 'LAX':
                baseCost = 100;
                break;
            case 'LGB':
                baseCost = 80;
                break;
            case 'SNA':
                baseCost = 50;
                break;
        }
        
        // Mercedes surcharge for >3 passengers
        let surcharge = 0;
        if (numPassengers > 3) {
            baseCost *= 1.2; // 20% surcharge
            surcharge = 30;
        }
        
        const total = baseCost + surcharge;
        
        // Update display
        document.getElementById('base-cost-airport').textContent = 
            currentLanguage === 'vi' ? `Cước Phí Cơ Bản: $${baseCost.toFixed(2)}` : `Base Fee: $${baseCost.toFixed(2)}`;
        
        if (surcharge > 0) {
            document.getElementById('surcharge-airport').style.display = 'block';
            document.getElementById('surcharge-airport').textContent = 
                currentLanguage === 'vi' ? `Phụ Thu Mercedes: $${surcharge.toFixed(2)}` : `Mercedes Surcharge: $${surcharge.toFixed(2)}`;
        } else {
            document.getElementById('surcharge-airport').style.display = 'none';
        }
        
        document.getElementById('total-cost-airport').textContent = 
            currentLanguage === 'vi' ? `Tổng Cộng: $${total.toFixed(2)}` : `Total: $${total.toFixed(2)}`;
    }
    
    // Event listeners for cost updates
    document.getElementById('travel-date').addEventListener('change', updateCostEstimate);
    document.getElementById('return-date').addEventListener('change', updateCostEstimate);
    document.getElementById('num-travelers').addEventListener('input', updateCostEstimate);
    document.getElementById('airport-pickup').addEventListener('change', updateCostEstimate);
    document.getElementById('meals').addEventListener('change', updateCostEstimate);
    document.querySelectorAll('input[name="ticket-type"]').forEach(radio => {
        radio.addEventListener('change', updateCostEstimate);
    });
    document.getElementById('extra-destinations').addEventListener('input', updateCostEstimate);
    
    document.getElementById('airport').addEventListener('change', updateAirportCostEstimate);
    document.getElementById('num-passengers').addEventListener('input', updateAirportCostEstimate);
    
    // PayPal button rendering
    function renderPayPalButton(amount) {
        paypal.Buttons({
            createOrder: function(data, actions) {
                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            value: amount.toFixed(2)
                        }
                    }]
                });
            },
            onApprove: function(data, actions) {
                return actions.order.capture().then(function(details) {
                    alert('Payment completed by ' + details.payer.name.given_name);
                    submitTravelForm();
                });
            }
        }).render('#paypal-button-container-travel');
    }
    
    // Form submission
    document.getElementById('travel-form').addEventListener('submit', function(e) {
        e.preventDefault();
        if (document.getElementById('paypal-button-container-travel').style.display === 'block') {
            // Wait for PayPal payment
            return;
        }
        submitTravelForm();
    });
    
    function submitTravelForm() {
        const formData = {
            serviceType: 'travel',
            package: travelPackage.value,
            extraDestinations: document.getElementById('extra-destinations').value,
            travelDate: document.getElementById('travel-date').value,
            returnDate: document.getElementById('return-date').value,
            pickupTime: document.getElementById('pickup-time').value,
            adults: adultsInput.value,
            kids: kidsInput.value,
            lodging: lodging.value,
            dropoffAddress: document.getElementById('dropoff-address').value,
            airportPickup: document.getElementById('airport-pickup').value,
            customerName: document.getElementById('customer-name').value,
            customerPhone: document.getElementById('customer-phone').value,
            customerEmail: document.getElementById('customer-email').value,
            pickupAddress: document.getElementById('pickup-address').value,
            meals: document.getElementById('meals').checked,
            ticketType: document.querySelector('input[name="ticket-type"]:checked').value,
            timestamp: new Date().toISOString()
        };
        
        // Send to Formspree
        fetch('https://formspree.io/f/xeokgbpo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (response.ok) {
                // Save to Firebase
                const ref = database.ref('bookings').push();
                ref.set(formData)
                    .then(() => {
                        window.location.href = 'thankyou.html';
                    })
                    .catch(error => {
                        console.error('Firebase error:', error);
                        window.location.href = 'thankyou.html';
                    });
            } else {
                alert(currentLanguage === 'vi' ? 'Gửi thất bại. Vui lòng thử lại.' : 'Submission failed. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert(currentLanguage === 'vi' ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Connection error. Please try again.');
        });
    }
    
    document.getElementById('airport-form').addEventListener('submit', function(e) {
        e.preventDefault();
        submitAirportForm();
    });
    
    function submitAirportForm() {
        const formData = {
            serviceType: 'airport',
            direction: serviceDirection.value,
            airport: document.getElementById('airport').value,
            dropoffAddress: document.getElementById('dropoff-address-airport').value,
            pickupAddress: document.getElementById('pickup-address-airport').value,
            serviceDate: document.getElementById('service-date').value,
            serviceTime: document.getElementById('service-time').value,
            numPassengers: document.getElementById('num-passengers').value,
            customerName: document.getElementById('customer-name-airport').value,
            customerPhone: document.getElementById('customer-phone-airport').value,
            timestamp: new Date().toISOString()
        };
        
        // Send to Formspree
        fetch('https://formspree.io/f/xeokgbpo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (response.ok) {
                // Save to Firebase
                const ref = database.ref('bookings').push();
                ref.set(formData)
                    .then(() => {
                        window.location.href = 'thankyou.html';
                    })
                    .catch(error => {
                        console.error('Firebase error:', error);
                        window.location.href = 'thankyou.html';
                    });
            } else {
                alert(currentLanguage === 'vi' ? 'Gửi thất bại. Vui lòng thử lại.' : 'Submission failed. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert(currentLanguage === 'vi' ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Connection error. Please try again.');
        });
    }
    
    // Initialize autocomplete for address fields
    function initAutocomplete() {
        const addressFields = [
            'dropoff-address',
            'pickup-address',
            'dropoff-address-airport',
            'pickup-address-airport'
        ];
        
        addressFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                const autocomplete = new google.maps.places.Autocomplete(input, {
                    types: ['geocode']
                });
                
                autocomplete.addListener('place_changed', function() {
                    const place = autocomplete.getPlace();
                    if (place && place.formatted_address) {
                        input.value = place.formatted_address;
                    }
                    
                    // Update cost estimates when address changes
                    if (fieldId.includes('airport')) {
                        updateAirportCostEstimate();
                    } else {
                        updateCostEstimate();
                    }
                });
            }
        });
    }
    
    // Initialize when Google Maps API is loaded
    window.initAutocomplete = initAutocomplete;
});
