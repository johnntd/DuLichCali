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
    
    // Initialize service forms
    function initializeServiceForms() {
        const travelForm = document.getElementById('travel-form');
        const airportForm = document.getElementById('airport-form');
        
        // Show travel form by default
        travelForm.classList.add('active');
        airportForm.classList.remove('active');
        
        // Add event listener for service type change
        document.getElementById('service-type').addEventListener('change', function() {
            if (this.value === 'travel') {
                travelForm.classList.add('active');
                airportForm.classList.remove('active');
            } else {
                travelForm.classList.remove('active');
                airportForm.classList.add('active');
            }
        });
    }
    
    // Call initialization functions
    initializeServiceForms();
    translatePage();
    
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
    
    // Rest of your existing code for cost calculations, form submissions, etc.
    // ... (keep all the remaining code from your original script.js)
});
