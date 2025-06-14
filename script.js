document.addEventListener('DOMContentLoaded', function() {
    // Initialize date pickers
    flatpickr(".datepicker", {
        locale: "vn",
        minDate: "today",
        dateFormat: "d/m/Y"
    });

    // Service type toggle
    const serviceType = document.getElementById('serviceType');
    serviceType.addEventListener('change', function() {
        document.getElementById('travelService').classList.toggle('active', this.value === 'travel');
        document.getElementById('airportService').classList.toggle('active', this.value === 'airport');
    });

    // Language toggle
    const languageToggle = document.getElementById('languageToggle');
    languageToggle.addEventListener('click', function() {
        const isVietnamese = this.textContent === 'English';
        this.textContent = isVietnamese ? 'Tiếng Việt' : 'English';
        
        // Update all text elements
        document.getElementById('mainTitle').textContent = isVietnamese ? 
            'California Travel & Airport Services' : 'Dịch Vụ Du Lịch & Đón Sân Bay California';
        document.getElementById('serviceTypeLabel').textContent = isVietnamese ? 
            'Select service type:' : 'Chọn loại dịch vụ:';
        document.getElementById('travelOption').textContent = isVietnamese ? 
            'Travel Package' : 'Gói Du Lịch';
        document.getElementById('airportOption').textContent = isVietnamese ? 
            'Airport Service' : 'Dịch Vụ Sân Bay';
    });

    // Form submission
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            document.getElementById('loader').style.display = 'flex';
            
            fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                if (response.ok) {
                    window.location.href = 'thankyou.html';
                } else {
                    throw new Error('Network response was not ok');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('There was an error submitting your request. Please try again.');
            })
            .finally(() => {
                document.getElementById('loader').style.display = 'none';
            });
        });
    });
});
