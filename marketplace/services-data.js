// Du Lịch Cali — Marketplace Services Data
// Central data file for multi-business service marketplace
// Exposed globally as window.MARKETPLACE

(function () {
  'use strict';

  var categories = {
    nails: {
      id: 'nails',
      slug: 'nailsalon',
      name: 'Nail Salon',
      nameVi: 'Tiệm Nail',
      tagline: 'Dịch vụ chăm sóc móng chuyên nghiệp',
      heroGradient: 'linear-gradient(135deg,#831843 0%,#9d174d 50%,#4c1d95 100%)',
      accent: '#ec4899'
    },
    hair: {
      id: 'hair',
      slug: 'hairsalon',
      name: 'Hair Salon',
      nameVi: 'Tiệm Tóc',
      tagline: 'Làm đẹp tóc theo phong cách hiện đại',
      heroGradient: 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#1e40af 100%)',
      accent: '#34d399'
    },
    food: {
      id: 'food',
      slug: 'foods',
      name: 'Food & Dining',
      nameVi: 'Ẩm Thực',
      tagline: 'Hương vị Việt đích thực tại California',
      heroGradient: 'linear-gradient(135deg,#7f1d1d 0%,#b45309 50%,#92400e 100%)',
      accent: '#fb923c'
    }
  };

  var businesses = [
    // ─── NAIL SALONS ────────────────────────────────────────────────────────────
    {
      id: 'dung-nails',
      category: 'nails',
      active: true,
      featured: true,
      featuredPriority: 2,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Gel nails & spa cao cấp — đặt lịch ngay',
      availabilityType: 'appointment',
      name: 'Dung Nails & Spa',
      tagline: 'Dịch vụ nail cao cấp · Bay Area',
      region: 'Bay Area',
      city: 'San Jose',
      address: 'San Jose, CA',
      phone: '4088596718',
      phoneDisplay: '408-859-6718',
      hosts: [
        {
          name: 'Dung Pham',
          phone: '4088596718',
          display: '408-859-6718',
          role: 'Owner & Nail Tech'
        }
      ],
      description:
        'Tiệm nail chuyên nghiệp hơn 10 năm kinh nghiệm tại Bay Area. Sản phẩm an toàn, đội ngũ lành nghề, không gian thoải mái.',
      heroGradient:
        'linear-gradient(135deg,#831843 0%,#9d174d 40%,#4c1d95 100%)',
      services: [
        { name: 'Manicure Cơ Bản',  price: '$20+', duration: '45 phút',  desc: 'Làm sạch dũa và sơn móng tay' },
        { name: 'Pedicure Cơ Bản',  price: '$30+', duration: '60 phút',  desc: 'Chăm sóc toàn diện bàn chân' },
        { name: 'Gel Nails',         price: '$35+', duration: '60 phút',  desc: 'Sơn gel bền màu 3-4 tuần' },
        { name: 'Acrylic Full Set',  price: '$45+', duration: '75 phút',  desc: 'Đắp acrylic tạo hình móng đẹp' },
        { name: 'Nail Art',          price: '$10+', duration: '+30 phút', desc: 'Vẽ hoa văn nghệ thuật' },
        { name: 'Spa Package',       price: '$65+', duration: '2 giờ',    desc: 'Manicure + pedicure + massage trọn gói' }
      ],
      hours: {
        'Thứ 2–6':    '9:00 AM – 7:00 PM',
        'Thứ 7':      '9:00 AM – 6:00 PM',
        'Chủ Nhật':   '10:00 AM – 5:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Lily',
        welcomeMessage:
          'Xin chào! Tôi là Lily, trợ lý tiệm Dung Nails. Tôi có thể giúp bạn đặt lịch, xem bảng giá hoặc trả lời thắc mắc. Bạn cần gì ạ?',
        quickReplies: ['Bảng giá', 'Đặt lịch', 'Giờ mở cửa', 'Địa chỉ'],
        systemExtra:
          'You are Lily, receptionist for Dung Nails & Spa in San Jose Bay Area. Owner: Dung Pham 408-859-6718. Specializes in manicure pedicure gel acrylic nails. Always friendly and professional. Answer in same language as customer (Vietnamese or English).'
      }
    },

    {
      id: 'beauty-nails-oc',
      category: 'nails',
      active: true,
      featured: true,
      featuredPriority: 2,
      featuredRegions: ['oc'],
      homepageActive: true,
      shortPromoText: 'Nail cao cấp Little Saigon — đặt lịch ngay',
      availabilityType: 'appointment',
      name: 'Beauty Nails OC',
      tagline: 'Phong cách sang trọng · Quận Cam',
      region: 'Orange County',
      city: 'Westminster',
      address: 'Westminster, CA',
      phone: '7142276007',
      phoneDisplay: '714-227-6007',
      hosts: [
        {
          name: 'Duy Hoa',
          phone: '7142276007',
          display: '714-227-6007',
          role: 'Owner'
        }
      ],
      description:
        'Điểm đến làm đẹp tin cậy tại Quận Cam. Không gian thoải mái, sản phẩm an toàn, thợ lành nghề.',
      heroGradient:
        'linear-gradient(135deg,#be185d 0%,#db2777 40%,#7c3aed 100%)',
      services: [
        { name: 'Manicure',        price: '$18+', duration: '40 phút',       desc: 'Chăm sóc và làm đẹp móng tay' },
        { name: 'Pedicure',        price: '$28+', duration: '55 phút',       desc: 'Chăm sóc và làm đẹp móng chân' },
        { name: 'Gel Color',       price: '$30+', duration: '55 phút',       desc: 'Sơn gel bền và đẹp' },
        { name: 'Full Set Acrylic',price: '$40+', duration: '70 phút',       desc: 'Bộ móng acrylic đầy đủ' },
        { name: 'Ombre Nails',     price: '$55+', duration: '90 phút',       desc: 'Móng gradient màu sắc hiện đại' },
        { name: 'Nail Art Design', price: '$8+',  duration: 'Tùy thiết kế',  desc: 'Nghệ thuật trang trí móng' }
      ],
      hours: {
        'Thứ 2–6':  '9:30 AM – 7:30 PM',
        'Thứ 7':    '9:00 AM – 7:00 PM',
        'Chủ Nhật': '10:00 AM – 6:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Amy',
        welcomeMessage:
          'Chào mừng đến Beauty Nails OC! Tôi là Amy, sẵn sàng hỗ trợ đặt lịch hoặc giải đáp thắc mắc. Bạn muốn biết gì ạ?',
        quickReplies: ['Bảng giá', 'Đặt lịch hẹn', 'Giờ hoạt động', 'Dịch vụ'],
        systemExtra:
          'You are Amy, receptionist for Beauty Nails OC in Westminster Orange County. Owner: Duy Hoa 714-227-6007. Specializes in nail services. Always warm and professional.'
      }
    },

    // ─── HAIR SALONS ─────────────────────────────────────────────────────────────
    {
      id: 'viet-hair-bayarea',
      category: 'hair',
      active: true,
      featured: true,
      featuredPriority: 3,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Cắt · Uốn · Nhuộm tóc Á Đông — tư vấn miễn phí',
      availabilityType: 'appointment',
      name: 'Việt Hair Studio',
      tagline: 'Phong cách Á Đông hiện đại · Bay Area',
      region: 'Bay Area',
      city: 'San Jose',
      address: 'San Jose, CA',
      phone: '4084397522',
      phoneDisplay: '408-439-7522',
      hosts: [
        {
          name: 'John',
          phone: '4084397522',
          display: '408-439-7522',
          role: 'Senior Stylist'
        }
      ],
      description:
        'Phong cách tóc kết hợp nghệ thuật Á Đông và xu hướng quốc tế. Stylist giàu kinh nghiệm tư vấn kiểu tóc phù hợp với khuôn mặt và phong cách.',
      heroGradient:
        'linear-gradient(135deg,#064e3b 0%,#065f46 40%,#1e40af 100%)',
      services: [
        { name: 'Cắt Tóc Nam',      price: '$20+',  duration: '30 phút',  desc: 'Cắt và tạo kiểu tóc nam' },
        { name: 'Cắt Tóc Nữ',       price: '$30+',  duration: '45 phút',  desc: 'Cắt tóc và tư vấn kiểu dáng' },
        { name: 'Uốn Tóc',          price: '$80+',  duration: '2-3 giờ',  desc: 'Uốn xoăn tự nhiên hoặc theo ý muốn' },
        { name: 'Duỗi/Thẳng Tóc',  price: '$100+', duration: '2-3 giờ',  desc: 'Duỗi tóc bóng mượt và bền' },
        { name: 'Nhuộm Tóc',        price: '$60+',  duration: '2 giờ',    desc: 'Nhuộm màu tóc thời thượng' },
        { name: 'Highlight',         price: '$80+',  duration: '2.5 giờ', desc: 'Tô sáng từng lọn tóc' }
      ],
      hours: {
        'Thứ 3–6':  '10:00 AM – 7:00 PM',
        'Thứ 7':    '9:00 AM – 6:00 PM',
        'Chủ Nhật': '10:00 AM – 5:00 PM',
        'Thứ 2':    'Nghỉ'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Mia',
        welcomeMessage:
          'Xin chào! Đây là Việt Hair Studio. Tôi là Mia, trợ lý đặt lịch. Tôi có thể giúp bạn đặt lịch, tư vấn kiểu tóc hoặc báo giá dịch vụ. Bạn cần hỗ trợ gì?',
        quickReplies: ['Đặt lịch cắt tóc', 'Bảng giá', 'Giờ mở cửa', 'Tư vấn kiểu tóc'],
        systemExtra:
          'You are Mia, receptionist for Việt Hair Studio in San Jose Bay Area. Senior stylist: John 408-439-7522. Specializes in Asian hair styling cuts perms straightening coloring. Respond in same language as customer.'
      }
    },

    {
      id: 'cali-hair-oc',
      category: 'hair',
      active: true,
      featured: true,
      featuredPriority: 3,
      featuredRegions: ['oc'],
      homepageActive: true,
      shortPromoText: 'Uốn Hàn Quốc · Nhuộm Balayage · Keratin',
      availabilityType: 'appointment',
      name: 'Cali Hair & Beauty',
      tagline: 'Kiểu tóc đẳng cấp · Little Saigon',
      region: 'Orange County',
      city: 'Garden Grove',
      address: 'Garden Grove, CA',
      phone: '7142276007',
      phoneDisplay: '714-227-6007',
      hosts: [
        {
          name: 'Duy Hoa',
          phone: '7142276007',
          display: '714-227-6007',
          role: 'Owner'
        }
      ],
      description:
        'Tọa lạc tại Little Saigon Garden Grove. Chuyên cắt uốn nhuộm và chăm sóc tóc theo phong cách Việt–Mỹ hiện đại. Đội ngũ thợ luôn cập nhật xu hướng mới.',
      heroGradient:
        'linear-gradient(135deg,#92400e 0%,#b45309 40%,#7c2d12 100%)',
      services: [
        { name: 'Cắt Tóc Nam',        price: '$18+',  duration: '25 phút',  desc: 'Cắt gọn và tạo kiểu chuyên nghiệp' },
        { name: 'Cắt Tóc Nữ',         price: '$28+',  duration: '45 phút',  desc: 'Tư vấn và cắt kiểu tóc phù hợp' },
        { name: 'Uốn Hàn Quốc',        price: '$120+', duration: '3 giờ',    desc: 'Kỹ thuật uốn xoăn phong cách Hàn' },
        { name: 'Keratin Treatment',    price: '$150+', duration: '3 giờ',    desc: 'Trị thẳng tóc bằng keratin cao cấp' },
        { name: 'Nhuộm Balayage',       price: '$100+', duration: '2.5 giờ', desc: 'Kỹ thuật nhuộm ombre tự nhiên' },
        { name: 'Deep Conditioning',    price: '$40+',  duration: '60 phút',  desc: 'Dưỡng tóc chuyên sâu phục hồi' }
      ],
      hours: {
        'Thứ 2–6':  '9:00 AM – 7:00 PM',
        'Thứ 7':    '8:30 AM – 7:00 PM',
        'Chủ Nhật': '10:00 AM – 6:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'appointment',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Sophie',
        welcomeMessage:
          'Chào bạn! Cali Hair & Beauty Little Saigon đây. Tôi là Sophie. Mình có thể đặt lịch, báo giá hoặc tư vấn kiểu tóc. Bạn muốn dịch vụ gì?',
        quickReplies: ['Đặt lịch', 'Báo giá nhuộm', 'Xem dịch vụ', 'Giờ làm việc'],
        systemExtra:
          'You are Sophie, receptionist for Cali Hair & Beauty in Garden Grove Orange County near Little Saigon. Owner: Duy Hoa 714-227-6007. Specializes in Vietnamese and Korean hair styling techniques.'
      }
    },

    // ─── FOOD & DINING ────────────────────────────────────────────────────────────
    {
      id: 'pho-bac-bayarea',
      category: 'food',
      active: true,
      featured: true,
      featuredPriority: 4,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Phở Hà Nội gia truyền — đặt bàn & catering',
      availabilityType: 'hours',
      name: 'Phở Bắc Bay Area',
      tagline: 'Phở gia truyền Hà Nội · Đặt bàn & Catering',
      region: 'Bay Area',
      city: 'San Jose',
      address: 'San Jose, CA',
      phone: '4084397522',
      phoneDisplay: '408-439-7522',
      hosts: [
        {
          name: 'John',
          phone: '4084397522',
          display: '408-439-7522',
          role: 'Manager'
        }
      ],
      description:
        'Hương vị phở Hà Nội chính gốc, nước dùng hầm xương bò 12 tiếng. Thực đơn phong phú với nhiều món truyền thống Việt Nam. Nhận đặt catering cho sự kiện và tiệc nhà.',
      heroGradient:
        'linear-gradient(135deg,#7f1d1d 0%,#991b1b 40%,#92400e 100%)',
      services: [
        { name: 'Phở Bò Đặc Biệt',     price: '$15',     duration: 'Phục vụ ngay',  desc: 'Phở bò tái chín gầu gân đặc biệt nhất' },
        { name: 'Bún Bò Huế',           price: '$14',     duration: 'Phục vụ ngay',  desc: 'Bún bò cay chuẩn vị Huế' },
        { name: 'Cơm Tấm Sườn',         price: '$16',     duration: 'Phục vụ ngay',  desc: 'Cơm tấm sườn nướng kèm bì chả' },
        { name: 'Bún Chả Hà Nội',       price: '$15',     duration: 'Phục vụ ngay',  desc: 'Bún chả thịt nướng phong cách Bắc' },
        { name: 'Gỏi Cuốn (2 cuốn)',    price: '$8',      duration: 'Phục vụ ngay',  desc: 'Gỏi cuốn tôm thịt tươi mát' },
        { name: 'Catering Đặt Hàng',    price: 'Liên hệ', duration: 'Đặt trước 24h', desc: 'Phục vụ tiệc nhà và sự kiện' }
      ],
      hours: {
        'Thứ 2–5':  '10:00 AM – 9:00 PM',
        'Thứ 6–7':  '9:00 AM – 10:00 PM',
        'Chủ Nhật': '9:00 AM – 9:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'reservation',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Mai',
        welcomeMessage:
          'Chào mừng đến Phở Bắc Bay Area! Tôi là Mai. Tôi có thể giúp bạn đặt bàn, xem thực đơn hoặc đặt catering. Bạn cần gì ạ?',
        quickReplies: ['Thực đơn', 'Đặt bàn', 'Giờ mở cửa', 'Đặt catering'],
        systemExtra:
          'You are Mai, receptionist for Phở Bắc Bay Area restaurant in San Jose. Manager: John 408-439-7522. Specializes in traditional Hanoi pho and Vietnamese food. Also offers catering. Respond warmly in same language used.'
      }
    },

    // ─── FOOD VENDORS (home-based / order-by-inquiry) ─────────────────────────────
    {
      id: 'nha-bep-cua-emily',
      category: 'food',
      vendorType: 'foodvendor',   // differentiates home vendor from restaurant
      active: true,
      featured: true,
      featuredPriority: 1,
      featuredRegions: ['bayarea'],
      homepageActive: true,
      shortPromoText: 'Chả giò handmade — đặt 30+ cuốn, giao tận nơi',
      availabilityType: 'order_window',
      name: 'Nhà Bếp Của Emily',
      tagline: 'Chả Giò Handmade · San Jose · Bay Area',
      region: 'Bay Area',
      city: 'San Jose',
      address: '2534 Clarebank Way, San Jose, CA 95121',
      phone: '4089312438',
      phoneDisplay: '408-931-2438',
      heroImage: '../nha-bep-emily-eggroll.jpg',
      hosts: [
        {
          name: 'Loan',
          phone: '4089312438',
          display: '408-931-2438',
          role: 'Owner & Home Chef'
        }
      ],
      description:
        'Mỗi cuốn chả giò là cả tâm huyết của gia đình Emily — nhân thịt heo, nấm hương và cà rốt tươi, gói bằng bánh tráng mỏng, chiên vàng giòn rụm. Làm thủ công từng mẻ, không chất bảo quản, hương vị đậm đà như bà nấu. Có hai lựa chọn: sống để bạn tự chiên tươi tại nhà — giòn tan theo ý bạn, hoặc tươi chín sẵn sàng thưởng thức ngay. Đặt hàng tối thiểu 30 cuốn. Liên hệ Loan để sắp xếp.',
      heroGradient:
        'linear-gradient(135deg,#78350f 0%,#92400e 50%,#7c2d12 100%)',
      orderEnabled: true,
      defaultDailyCapacity: 300,
      formspreeId: 'xeokgbpo',
      // ── Products (food vendor model — replaces services/hours) ─────────────────
      products: [
        {
          id: 'eggroll',
          name: 'Chả Giò (Eggroll)',
          nameEn: 'Eggroll',
          variants: [
            { id: 'raw',   label: 'Sống (Raw)',   labelEn: 'Raw — to fry fresh at home' },
            { id: 'fresh', label: 'Tươi (Fresh)', labelEn: 'Fresh — cooked & ready to serve' }
          ],
          pricePerUnit: 0.75,
          unit: 'cuốn',
          unitEn: 'piece',
          minimumOrderQty: 30,
          image: '../nha-bep-emily-eggroll.jpg',
          videoUrl: null,
          videoStatus: 'none',
          videoGeneratedAt: null,
          remotionTemplate: 'FoodPromo',
          subtitle: 'Handmade Eggrolls',
          shortTagline: 'Gói tay từng chiếc — giòn tan thơm phức',
          description: 'Chả giò nhân thịt heo, nấm hương và cà rốt tươi — gói bằng bánh tráng mỏng, chiên giòn vàng thơm phức. Làm thủ công từng mẻ với nguyên liệu sạch, không chất bảo quản. Perfect for family dinners, gatherings, and parties.',
          active: true,
          preparationInstructions: 'Chiên trong dầu nóng 350°F (175°C) trong 8–10 phút, lật đều. Khi vàng giòn là được. Không cần rã đông — chiên thẳng từ tủ lạnh cho kết quả giòn nhất.',
          reheatingInstructions:   'Lò nướng 325°F 5–7 phút, hoặc nồi chiên không dầu (air fryer) 320°F 4 phút. Tránh dùng lò vi sóng — làm mất độ giòn.',
          storageInstructions:     'Tủ lạnh: tối đa 3 ngày. Đông lạnh: tối đa 2 tháng (không cần rã đông trước khi chiên).',
          servingNotes:            'Ăn nóng khi mới chiên. Dùng kèm tương ớt, hoisin, hoặc nước chấm chua ngọt.',
          allergenNotes:           'Chứa: thịt heo, nấm hương, cà rốt, hành tây, bún tàu (miến). Vỏ bánh tráng gạo (không gluten). Không đậu phộng.'
        },
        {
          id: 'chuoi-dau-nau-oc',
          name: 'Chuối Đậu Nấu Ốc',
          nameEn: 'Northern Vietnamese Snail, Tofu & Green Banana Stew',
          variants: [],
          tags: ['Miền Bắc', 'Homemade', 'Thảo Dược', 'Comfort Food', 'Limited Batch'],
          pricePerUnit: 15,
          unit: 'phần',
          unitEn: 'serving',
          minimumOrderQty: 1,
          sortOrder: 1,
          image: '',
          videoUrl: null,
          videoStatus: 'none',
          videoGeneratedAt: null,
          remotionTemplate: 'FoodPromo',
          subtitle: 'Northern Vietnamese Snail Stew',
          shortTagline: 'Hương vị miền Bắc — chuối xanh, đậu phụ, ốc tươi',
          shortDescription: 'Traditional Northern Vietnamese specialty. Fresh snails, tofu & green banana in turmeric broth.',
          description: 'A traditional Northern Vietnamese specialty featuring fresh snails, tofu, and green banana simmered in a rich turmeric broth with herbs and chili. Savory, slightly tangy, and deeply comforting.',
          active: true,
          preparationInstructions: 'Hâm nóng trên bếp nhỏ lửa 5–8 phút. Thêm rau thơm tươi trước khi dùng để giữ hương vị.',
          reheatingInstructions:   'Hâm lại bằng nồi nhỏ lửa, không dùng lò vi sóng để tránh làm mất độ tươi của ốc.',
          storageInstructions:     'Tủ lạnh: tối đa 2 ngày. Không đông lạnh — ốc tươi sẽ mất kết cấu sau khi đông.',
          servingNotes:            'Dùng nóng với bún hoặc cơm trắng. Thêm mắm tôm và ớt tươi theo khẩu vị.',
          allergenNotes:           'Chứa: ốc (shellfish/snail), đậu phụ (đậu nành/soy), hành, ớt. Không gluten. Món chay không ăn được (có ốc).'
        }
      ],
      aiReceptionist: {
        enabled: true,
        name: 'Emily',
        welcomeMessage:
          'Xin chào! Nhà Bếp Của Emily đây. Chúng tôi làm chả giò handmade — giòn tan, thơm phức! Tôi có thể giúp bạn tìm hiểu sản phẩm, báo giá hoặc hướng dẫn đặt hàng. Bạn muốn biết gì ạ?',
        quickReplies: ['Giá chả giò?', 'Đặt hàng', 'Sống hay tươi?', 'Địa chỉ & liên hệ'],
        systemExtra:
          'You are the AI receptionist for Nhà Bếp Của Emily, a home-based Vietnamese food vendor in San Jose Bay Area. Contact: Loan at 408-931-2438. Address: 2534 Clarebank Way, San Jose, CA 95121. We sell handmade Vietnamese eggrolls (Chả Giò). Price: $0.75 per eggroll. Minimum order: 30 eggrolls ($22.50 total). Two options: Raw (Sống) — customers fry at home for maximum freshness and crunch; Fresh (Tươi) — cooked and ready to serve. Filling: pork, mushroom, carrot. No preservatives, handmade every batch. Max production: 300 per day. Order via the inquiry form on this page or call Loan directly. Be warm, friendly, and helpful. Answer in same language as customer (Vietnamese or English).'
      }
    },

    {
      id: 'com-tam-oc',
      category: 'food',
      active: true,
      featured: true,
      featuredPriority: 1,
      featuredRegions: ['oc'],
      homepageActive: true,
      shortPromoText: 'Cơm tấm sườn nướng Sài Gòn — đặt bàn & catering',
      availabilityType: 'hours',
      name: 'Cơm Tấm Dì Tám',
      tagline: 'Cơm tấm sườn nướng chuẩn Sài Gòn · Quận Cam',
      region: 'Orange County',
      city: 'Westminster',
      address: 'Westminster, CA',
      phone: '7142276007',
      phoneDisplay: '714-227-6007',
      hosts: [
        {
          name: 'Duy Hoa',
          phone: '7142276007',
          display: '714-227-6007',
          role: 'Manager'
        }
      ],
      description:
        'Cơm tấm sườn nướng công thức gia truyền từ Sài Gòn. Thịt ướp qua đêm nướng than hoa, hương vị thơm lừng không quên. Nhận catering sự kiện và tiệc tùng.',
      heroGradient:
        'linear-gradient(135deg,#dc2626 0%,#b45309 50%,#92400e 100%)',
      services: [
        { name: 'Cơm Tấm Đặc Biệt',   price: '$14',     duration: 'Phục vụ ngay',  desc: 'Sườn + chả + trứng + bì + đồ chua' },
        { name: 'Cơm Tấm Sườn Bì',    price: '$13',     duration: 'Phục vụ ngay',  desc: 'Sườn nướng than + bì + nước mắm' },
        { name: 'Hủ Tiếu Nam Vang',   price: '$14',     duration: 'Phục vụ ngay',  desc: 'Hủ tiếu nước trong veo chuẩn Nam Bộ' },
        { name: 'Bánh Mì Đặc Biệt',   price: '$8',      duration: 'Phục vụ ngay',  desc: 'Bánh mì Sài Gòn với nhân đặc biệt' },
        { name: 'Chả Giò (5 cuốn)',   price: '$10',     duration: 'Phục vụ ngay',  desc: 'Chả giò chiên vàng giòn rụm' },
        { name: 'Catering Sự Kiện',   price: 'Liên hệ', duration: 'Đặt trước 48h', desc: 'Cung cấp thức ăn cho sự kiện tiệc tùng' }
      ],
      hours: {
        'Thứ 2–6':  '10:00 AM – 9:30 PM',
        'Thứ 7':    '8:00 AM – 10:00 PM',
        'Chủ Nhật': '8:00 AM – 9:00 PM'
      },
      bookingEnabled: true,
      bookingType: 'reservation',
      formspreeId: 'xeokgbpo',
      aiReceptionist: {
        enabled: true,
        name: 'Lan',
        welcomeMessage:
          'Xin chào! Cơm Tấm Dì Tám đây! Tôi là Lan, sẵn sàng hỗ trợ đặt bàn, xem thực đơn hoặc hỏi về catering. Bạn cần gì ạ?',
        quickReplies: ['Xem thực đơn', 'Đặt bàn', 'Giờ mở cửa', 'Catering tiệc'],
        systemExtra:
          'You are Lan, receptionist for Cơm Tấm Dì Tám restaurant in Westminster Orange County. Manager: Duy Hoa 714-227-6007. Specializes in Southern Vietnamese food especially cơm tấm broken rice with grilled pork. Also does catering.'
      }
    }
  ];

  // ─── Helper Functions ──────────────────────────────────────────────────────────

  /**
   * Get all businesses for a category, optionally filtered by region.
   * @param {string} categoryId
   * @param {string|null} region
   * @returns {Array}
   */
  function getBusinesses(categoryId, region) {
    return businesses.filter(function (b) {
      if (b.category !== categoryId || !b.active) return false;
      if (region && b.region !== region) return false;
      return true;
    });
  }

  /**
   * Get a single business by id.
   * @param {string} id
   * @returns {Object|null}
   */
  function getBusiness(id) {
    for (var i = 0; i < businesses.length; i++) {
      if (businesses[i].id === id) return businesses[i];
    }
    return null;
  }

  /**
   * Get category metadata by id.
   * @param {string} id
   * @returns {Object|null}
   */
  function getCategoryMeta(id) {
    return categories[id] || null;
  }

  // ─── Expose globally ──────────────────────────────────────────────────────────
  window.MARKETPLACE = {
    categories: categories,
    businesses: businesses,
    getBusinesses: getBusinesses,
    getBusiness: getBusiness,
    getCategoryMeta: getCategoryMeta
  };
})();
