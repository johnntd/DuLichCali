/**
 * Du Lịch Cali — Destination Data
 * Single source of truth for destinations, AI chat context, cost estimates, and Remotion video data.
 */

const DESTINATIONS = [
  {
    id: 'lasvegas',
    name:    { vi: 'Las Vegas', en: 'Las Vegas' },
    state:   'Nevada',
    tagline: { vi: 'Thành phố ánh đèn không ngủ', en: 'The Entertainment Capital of the World' },
    summary: {
      vi: 'Las Vegas quyến rũ với những khách sạn xa hoa, show diễn đẳng cấp thế giới, ẩm thực phong phú và The Strip huyền thoại sáng rực suốt đêm.',
      en: 'Las Vegas dazzles with luxury hotels, world-class shows, incredible dining, and the legendary Strip that never sleeps.'
    },
    image:          'lasvegas.jpg',
    youtubeId:      'DDOgFWzPwIU', // Official Visit Las Vegas (LVCVA) campaign — verify at youtube.com/watch?v=DDOgFWzPwIU
    hook:           'Thành phố không bao giờ ngủ — ánh đèn rực rỡ, show diễn đỉnh cao và những trải nghiệm xa hoa chỉ có ở đây.',
    highlightTags:  ['The Strip', 'Bellagio', 'Fremont Street', 'Grand Canyon', 'World Buffets'],
    distance_miles: 270,
    duration:       { min: 2, max: 3, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #1a0a2e 0%, #3b1a6b 55%, #92400e 100%)',
    accent:         '#f59e0b',
    origin_for_tour: 'Las Vegas, NV, USA',
    highlights: [
      { name: 'The Strip',          vi: 'Đại lộ 6.8km với khách sạn và casino huyền thoại', en: '6.8km boulevard of iconic hotels & casinos', bestTime: 'Buổi tối', whyPopular: 'Trung tâm Las Vegas với hàng chục casino và khách sạn xa hoa — trái tim thành phố ánh đèn.', travelNotes: 'Đi bộ từ Bellagio đến New York-New York (~45 phút). Uber/Lyft cho đoạn dài hơn.' },
      { name: 'Bellagio Fountains', vi: 'Show nhạc nước miễn phí nổi tiếng thế giới',       en: 'World-famous free dancing fountains & music show', bestTime: 'Mỗi 30 phút, tối đẹp hơn ngày', whyPopular: 'Show nhạc nước vĩ đại nhất thế giới — Celine Dion, Pavarotti trên màn nước khổng lồ miễn phí.', travelNotes: 'Đứng trước Paris Las Vegas để có góc nhìn đẹp nhất. Show tối lung linh hơn nhiều.' },
      { name: 'Grand Canyon West',  vi: 'Kỳ quan thiên nhiên, cách 2 tiếng lái xe',          en: 'Natural wonder 2 hrs away — glass Skywalk', bestTime: 'Mar–Nov, tránh hè nóng', whyPopular: 'Kỳ quan thiên nhiên hàng đầu thế giới — Skywalk kính trong suốt nhìn xuống vực sâu 1.2km.', travelNotes: 'Cách Las Vegas 2 tiếng lái xe. Đặt vé Skywalk trước online. Mang nước và kem chống nắng.' },
      { name: 'Fremont Street',     vi: 'Phố cổ Las Vegas với màn hình LED khổng lồ',        en: 'Historic downtown with a massive LED canopy', bestTime: 'Tối sau 9pm (show LED mỗi giờ)', whyPopular: 'Màn hình LED dài 460m với show ánh sáng âm nhạc miễn phí — Las Vegas cổ điển đích thực.', travelNotes: 'Zip line trên phố giá $40–50. Old Downtown có vibe khác hẳn The Strip — bình dân hơn.' },
      { name: 'World Buffets',      vi: 'Buffet xa hoa với hàng trăm món quốc tế',           en: 'Legendary all-you-can-eat international spreads', bestTime: 'Bữa trưa (rẻ hơn tối)', whyPopular: 'Las Vegas có những buffet xa hoa nhất thế giới — hải sản tươi, thịt BBQ, sushi không giới hạn.', travelNotes: 'Wicked Spoon tại The Cosmopolitan được yêu thích nhất. Đặt trước vào cuối tuần.' },
    ],
    things_to_do: [
      'Dạo The Strip lúc hoàng hôn', 'Xem show Cirque du Soleil', 'Thăm Mob Museum',
      'Mua sắm tại Fashion Show Mall', 'Ăn buffet 5 sao', 'Chụp ảnh tại Welcome to Vegas sign'
    ],
    cost: {
      transport:         { min: 450, max: 650, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 60, mid: 150, luxury: 450 },
      airbnb_per_night:  { estimate: 110, disclaimer: true },
      food_per_day:      { budget: 30, mid: 65, luxury: 160 },
    },
  },

  {
    id: 'yosemite',
    name:    { vi: 'Yosemite', en: 'Yosemite' },
    state:   'California',
    tagline: { vi: 'Thung lũng đá granit hùng vĩ', en: "America's Most Spectacular Valley" },
    summary: {
      vi: 'Yosemite hấp dẫn bởi những vách đá granite khổng lồ, thác nước hùng vĩ, rừng Sequoia ngàn tuổi và bầu trời đêm đầy sao hoang dã.',
      en: 'Yosemite captivates with towering granite walls, spectacular waterfalls, ancient giant sequoias, and some of the darkest night skies in California.'
    },
    image:          'yosemite.jpg',
    youtubeId:      'REqXEsUP56o', // Giants of Yosemite — PARKLIGHT cinematic timelapse series — verify at youtube.com/watch?v=REqXEsUP56o
    hook:           'Những vách đá granit ngàn tuổi, thác nước hùng vĩ và bầu trời đêm trong vắt — thiên nhiên ở dạng thuần khiết nhất.',
    highlightTags:  ['Half Dome', 'El Capitan', 'Yosemite Falls', 'Mariposa Grove', 'Glacier Point'],
    distance_miles: 350,
    duration:       { min: 2, max: 4, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #064e3b 0%, #1a3c2a 55%, #3f6b4a 100%)',
    accent:         '#86efac',
    origin_for_tour: 'Yosemite National Park, CA, USA',
    highlights: [
      { name: 'Yosemite Falls',  vi: 'Thác nước cao nhất Bắc Mỹ — 739m',              en: "North America's tallest waterfall at 2,425 ft", bestTime: 'Apr–Jun (mùa xuân, nước nhiều nhất)', whyPopular: 'Thác cao nhất Bắc Mỹ với 3 tầng đổ xuống thung lũng granit — đẹp nhất lúc tuyết tan.', travelNotes: 'Trail đến chân thác 2.6km, dễ đi. Đến sáng sớm tránh đông. Thác có thể khô tháng 8–9.' },
      { name: 'Half Dome',       vi: 'Biểu tượng đá granit huyền thoại cao 2700m',    en: 'Iconic granite dome rising 4,737 ft above the valley', bestTime: 'May–Oct (dây cáp có từ Memorial Day)', whyPopular: 'Biểu tượng của Yosemite và cả nước Mỹ — xuất hiện trên logo Google Maps và hàng triệu ảnh nền.', travelNotes: 'Leo dây cáp cần permit lottery. Nhìn từ Valley View hoặc Tunnel View cũng rất đẹp.' },
      { name: 'El Capitan',      vi: 'Vách đá thẳng đứng dài nhất thế giới',          en: 'The world\'s largest exposed granite monolith', bestTime: 'Quanh năm', whyPopular: 'Vách đá granit trơn thẳng đứng lớn nhất thế giới — nổi tiếng toàn cầu qua phim Free Solo.', travelNotes: 'El Capitan Meadow là điểm ngắm tốt nhất. Mang ống nhòm xem người leo núi trực tiếp.' },
      { name: 'Mariposa Grove',  vi: 'Rừng cây gỗ đỏ Sequoia ngàn năm tuổi',         en: 'Ancient giant sequoias, some over 2,000 years old', bestTime: 'May–Nov (xe tram chạy)', whyPopular: '500+ cây Sequoia Giant, cổ nhất là Grizzly Giant 2700 năm tuổi với chu vi 28m.', travelNotes: 'Xe tram miễn phí từ bãi xe vào rừng. Trail 2km đến Grizzly Giant. Mang áo ấm.' },
      { name: 'Glacier Point',   vi: 'Điểm ngắm toàn cảnh thung lũng từ trên cao',   en: 'Breathtaking panoramic view of the entire valley', bestTime: 'Jun–Oct (đường mở)', whyPopular: 'View 360° toàn thung lũng Yosemite từ cao 2200m — Half Dome và El Capitan cùng một khung hình.', travelNotes: 'Lái xe 30 phút từ Valley. Đến trước hoàng hôn 1 tiếng để có chỗ tốt. Rất lạnh sau tối.' },
    ],
    things_to_do: [
      'Đi bộ đường mòn Mirror Lake', 'Chụp ảnh Tunnel View lúc bình minh',
      'Cắm trại dưới bầu trời sao', 'Khám phá Merced River',
      'Leo Half Dome (nâng cao)', 'Ngắm hoàng hôn tại Glacier Point'
    ],
    cost: {
      transport:        { min: 380, max: 550, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:  { budget: 120, mid: 220, luxury: 580 },
      airbnb_per_night: { estimate: 165, disclaimer: true },
      food_per_day:     { budget: 20, mid: 45, luxury: 90 },
    },
  },

  {
    id: 'sanfrancisco',
    name:    { vi: 'San Francisco', en: 'San Francisco' },
    state:   'California',
    tagline: { vi: 'Thành phố sương mù và cầu vàng', en: 'The City by the Bay' },
    summary: {
      vi: 'San Francisco quyến rũ bởi Cầu Cổng Vàng biểu tượng, khu phố Tàu sầm uất, xe điện leo đồi lịch sử và ẩm thực phong phú bên vịnh biển.',
      en: 'San Francisco enchants with the iconic Golden Gate Bridge, vibrant Chinatown, historic cable cars, Alcatraz island, and a world-class food scene.'
    },
    image:          'sanfrancisco.jpg',
    youtubeId:      'Vvata0OboBs', // Best of San Francisco in Beautiful 4K — verify at youtube.com/watch?v=Vvata0OboBs
    hook:           'Cầu Cổng Vàng, xe điện leo đồi, Alcatraz và ẩm thực đỉnh cao bên vịnh biển thơ mộng.',
    highlightTags:  ['Golden Gate', 'Alcatraz', 'Cable Cars', "Fisherman's Wharf", 'Chinatown'],
    distance_miles: 400,
    duration:       { min: 2, max: 4, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #0c2340 0%, #1e3a5f 55%, #9a3412 100%)',
    accent:         '#fb923c',
    origin_for_tour: 'San Francisco, CA, USA',
    highlights: [
      { name: 'Golden Gate Bridge', vi: 'Cây cầu treo biểu tượng dài 2.7km',              en: "America's most iconic bridge — 1.7 miles long", bestTime: 'Sáng sớm (ít sương nhất)', whyPopular: 'Cầu treo biểu tượng nhất thế giới màu cam đặc trưng — nhìn thấy từ khắp vịnh San Francisco.', travelNotes: 'Đi bộ qua cầu 45 phút. Battery Spencer bên Marin là góc chụp ảnh đẹp nhất. Gió rất mạnh.' },
      { name: "Fisherman's Wharf",  vi: 'Cảng cá sầm uất với hải sản tươi và sư tử biển', en: 'Vibrant waterfront with fresh seafood & sea lions', bestTime: 'Buổi sáng (hải sản tươi nhất)', whyPopular: 'Cảng lịch sử với cua Dungeness, tôm hùm tươi và sea lion nằm phơi nắng tại Pier 39.', travelNotes: 'Cua Dungeness ngon nhất Nov–Jun. Clam chowder bread bowl tại Boudin Bakery rất đặc trưng.' },
      { name: 'Alcatraz',           vi: 'Nhà tù huyền thoại trên đảo giữa vịnh',          en: 'Legendary island prison tour in the middle of the bay', bestTime: 'Đặt vé trước 2–3 tuần', whyPopular: 'Nhà tù liên bang lừng danh nhất nước Mỹ từng giam Al Capone — audio tour rùng mình và hấp dẫn.', travelNotes: 'Phà từ Pier 33 mỗi 30 phút. Audio tour bao gồm trong vé. Đặt trước vì hay hết vé.' },
      { name: 'Chinatown',          vi: 'Khu phố người Hoa lớn nhất nước Mỹ',             en: 'Oldest and largest Chinatown in North America', bestTime: 'Cuối tuần (đông vui, nhiều hàng)', whyPopular: 'Khu Chinatown cổ nhất và lớn nhất Bắc Mỹ — 150 năm lịch sử, ẩm thực Trung Hoa chính gốc.', travelNotes: 'Vào qua Dragon\'s Gate trên Grant Ave. Dim sum sáng tại Lai Hong Lounge được yêu thích.' },
      { name: 'Cable Cars',         vi: 'Xe điện leo đồi cổ kính — di sản lịch sử sống', en: 'Historic cable cars — a moving National Historic Landmark', bestTime: 'Buổi sáng (hàng chờ ít hơn)', whyPopular: 'Hệ thống xe điện leo đồi lịch sử duy nhất còn hoạt động — di sản quốc gia sống động của Mỹ.', travelNotes: 'Vé $8/lượt hoặc $24 all-day. Tuyến Powell-Hyde đẹp nhất, qua Lombard Street.' },
    ],
    things_to_do: [
      'Chụp ảnh Golden Gate lúc bình minh', 'Thăm Alcatraz Island',
      'Dạo Pier 39', 'Ăn dim sum ở Chinatown',
      'Đi xe điện đường Powell-Hyde', 'Ngắm toàn cảnh từ Twin Peaks'
    ],
    cost: {
      transport:        { min: 420, max: 600, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:  { budget: 130, mid: 260, luxury: 700 },
      airbnb_per_night: { estimate: 190, disclaimer: true },
      food_per_day:     { budget: 30, mid: 70, luxury: 180 },
    },
  },

  // ── 12 EXPANDED DESTINATIONS ──────────────────────────────────

  {
    id: 'losangeles',
    name:    { vi: 'Los Angeles', en: 'Los Angeles' },
    state:   'California',
    tagline: { vi: 'Thành phố điện ảnh và ánh sáng', en: 'City of Angels' },
    summary: {
      vi: 'Los Angeles thu hút bởi Hollywood huyền thoại, bãi biển Santa Monica thơ mộng, mua sắm Beverly Hills và văn hóa ẩm thực đa dạng nhất nước Mỹ.',
      en: 'Los Angeles captivates with iconic Hollywood, breathtaking Santa Monica beach, Beverly Hills luxury shopping, and the most diverse food scene in America.'
    },
    image:          'losangeles.jpg',
    youtubeId:      'iBZ5gWAa_MI',
    hook:           'Hollywood huyền thoại, Beverly Hills xa hoa và bãi biển dát vàng — thành phố của những giấc mơ.',
    highlightTags:  ['Hollywood', 'Beverly Hills', 'Santa Monica', 'Griffith Observatory', 'Venice Beach'],
    distance_miles: 35,
    duration:       { min: 1, max: 2, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #1a0533 0%, #2d1059 55%, #c2410c 100%)',
    accent:         '#f97316',
    origin_for_tour: 'Los Angeles, CA, USA',
    highlights: [
      { name: 'Hollywood Sign',       vi: 'Biểu tượng điện ảnh nhìn từ Griffith Observatory',    en: 'Iconic sign best viewed from Griffith Observatory hill', bestTime: 'Sáng sớm (ít sương, ít đông)', whyPopular: 'Biểu tượng điện ảnh lừng danh thế giới trên đồi Santa Monica — nhìn thấy từ khắp thành phố.', travelNotes: 'Nhìn từ Griffith Observatory đẹp nhất. Trail lên gần từ Bronson Canyon hoặc Lake Hollywood.' },
      { name: 'Beverly Hills',        vi: 'Khu phố mua sắm xa hoa nhất thế giới',                en: "World's most glamorous shopping destination — Rodeo Drive", bestTime: 'Thứ 2–5 (ít đông hơn cuối tuần)', whyPopular: 'Rodeo Drive — con phố xa hoa nhất thế giới với Gucci, Chanel, Louis Vuitton, Hermès.', travelNotes: 'Tự do dạo bộ Rodeo Drive (miễn phí). Xem biệt thự ngôi sao trên Mulholland Drive.' },
      { name: 'Santa Monica Beach',   vi: 'Bãi biển nổi tiếng với cầu tàu và công viên vui chơi', en: 'Famous pier, amusement park & golden beach', bestTime: 'May–Sep (ấm và nắng nhất)', whyPopular: 'Cầu tàu lịch sử với Pacific Park, bãi biển vàng và Route 66 kết thúc ngay tại đây.', travelNotes: 'Đỗ xe Main Street. Thuê xe đạp dọc Ocean Front Walk 22km đến Venice Beach.' },
      { name: 'Griffith Observatory', vi: 'Đài thiên văn với view toàn thành phố',               en: 'City panorama & Hollywood Sign backdrop', bestTime: 'Sau 6pm (thành phố lên đèn rực rỡ)', whyPopular: 'Đài thiên văn miễn phí vào cửa với view Hollywood Sign và toàn LA rực rỡ về đêm.', travelNotes: 'DASH Bus từ Los Feliz. Planetarium show $7/người. Đặt trước vào cuối tuần.' },
      { name: 'Venice Beach',         vi: 'Phố boardwalk nghệ sĩ độc đáo bên biển',             en: 'Bohemian boardwalk, street performers & skate park', bestTime: 'Cuối tuần trưa (nhộn nhịp nhất)', whyPopular: 'Boardwalk độc nhất vô nhị với gymnast, nghệ sĩ đường phố, sân skate và Muscle Beach.', travelNotes: 'Thuê e-scooter hoặc xe đạp dọc boardwalk. Tacos ngon nhất tại khu Windward Ave.' },
    ],
    things_to_do: [
      'Dạo Walk of Fame ở Hollywood', 'Mua sắm Rodeo Drive Beverly Hills',
      'Ngắm cảnh Griffith Observatory', 'Tắm biển Santa Monica',
      'Thăm The Getty Museum', 'Ăn tacos ở Grand Central Market'
    ],
    cost: {
      transport:         { min: 120, max: 200, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 110, mid: 230, luxury: 620 },
      airbnb_per_night:  { estimate: 175, disclaimer: true },
      food_per_day:      { budget: 25, mid: 60, luxury: 150 },
    },
  },

  {
    id: 'sandiego',
    name:    { vi: 'San Diego', en: 'San Diego' },
    state:   'California',
    tagline: { vi: 'Thành phố biển xanh và thời tiết lý tưởng', en: "America's Finest City" },
    summary: {
      vi: 'San Diego quyến rũ bởi bãi biển hoàn hảo, Vườn thú nổi tiếng thế giới, khu Old Town lịch sử và cuộc sống ngoài trời sôi động quanh năm.',
      en: "San Diego enchants with perfect beaches, the world-renowned Zoo, historic Old Town, and year-round outdoor living in America's sunniest city."
    },
    image:          'sandiego.jpg',
    youtubeId:      'HMqXkwIWtyQ',
    hook:           'Bãi biển hoàn hảo, vườn thú đẳng cấp thế giới và khí hậu lý tưởng 365 ngày — thiên đường phía Nam California.',
    highlightTags:  ['San Diego Zoo', 'Balboa Park', 'Coronado Beach', 'Gaslamp Quarter', 'Old Town'],
    distance_miles: 90,
    duration:       { min: 1, max: 2, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #0c3040 0%, #0e4c6e 55%, #0891b2 100%)',
    accent:         '#22d3ee',
    origin_for_tour: 'San Diego, CA, USA',
    highlights: [
      { name: 'San Diego Zoo',    vi: 'Một trong những vườn thú vĩ đại nhất thế giới',    en: "One of the world's most celebrated zoos — 12,000+ animals", bestTime: 'Buổi sáng (động vật hoạt động nhất)', whyPopular: 'Một trong 5 vườn thú vĩ đại nhất thế giới với 12,000 loài — gấu trúc khổng lồ cực được yêu thích.', travelNotes: 'Mua vé online tiết kiệm $5. Skyfari aerial tram bao gồm trong vé. Cần 4–5 tiếng tham quan.' },
      { name: 'Balboa Park',      vi: 'Công viên văn hóa rộng lớn với 17 bảo tàng',       en: 'Cultural park with 17 museums & Spanish Colonial architecture', bestTime: 'Thứ 3 đầu tháng (nhiều bảo tàng miễn phí)', whyPopular: 'Công viên 1200 mẫu với 17 bảo tàng, vườn cây và kiến trúc Tây Ban Nha tuyệt đẹp — vào cổng miễn phí.', travelNotes: 'Free Museum Tuesdays — mỗi bảo tàng miễn phí 1 ngày trong tháng. Bản đồ tại cổng vào.' },
      { name: 'Coronado Beach',   vi: 'Bãi biển cát vàng đẹp nhất California',            en: 'Golden-sand beach with iconic Hotel Del Coronado', bestTime: 'Jun–Sep (ấm và nắng nhất)', whyPopular: 'Bãi cát vàng rộng với Hotel Del Coronado Victorian từ 1888 — bối cảnh nhiều bộ phim Hollywood.', travelNotes: 'Phà từ Broadway Pier ~15 phút, tiện hơn lái xe. Thuê xe đạp quanh đảo Coronado rất thú vị.' },
      { name: 'Gaslamp Quarter',  vi: 'Khu vui chơi về đêm sầm uất nhất thành phố',      en: 'Vibrant nightlife district with Victorian-era architecture', bestTime: 'Tối thứ 6–7', whyPopular: '32 block nhà Victorian cuối thế kỷ 19 nay là trung tâm ẩm thực và giải trí đêm của San Diego.', travelNotes: 'Đặt nhà hàng trước vào cuối tuần. Đi bộ từ Convention Center vào ban đêm an toàn và vui.' },
      { name: 'La Jolla Cove',    vi: 'Vịnh san hô đẹp với hải cẩu và lặn biển',         en: 'Stunning coastal cove with sea lions & snorkeling', bestTime: 'Sáng sớm (sea lion đang ngủ, ít đông)', whyPopular: 'Vịnh nhỏ xinh với nước trong suốt — sea lion và sư tử biển nghỉ ngơi ngay trên bãi đá tự nhiên.', travelNotes: 'Đỗ xe Prospect St. Snorkeling cần kính mắt và ống thở. Nước 19–22°C quanh năm — không lạnh.' },
    ],
    things_to_do: [
      'Thăm San Diego Zoo', 'Khám phá Balboa Park',
      'Tắm biển Coronado', 'Dạo Little Italy ăn tối',
      'Thăm USS Midway Museum', 'Ngắm hoàng hôn tại La Jolla Cove'
    ],
    cost: {
      transport:         { min: 160, max: 260, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 100, mid: 200, luxury: 550 },
      airbnb_per_night:  { estimate: 160, disclaimer: true },
      food_per_day:      { budget: 22, mid: 50, luxury: 130 },
    },
  },

  {
    id: 'anaheim',
    name:    { vi: 'Anaheim · Disneyland', en: 'Anaheim & Disneyland' },
    state:   'California',
    tagline: { vi: 'Vương quốc diệu kỳ ngay cạnh nhà', en: 'The Happiest Place on Earth' },
    summary: {
      vi: 'Anaheim là nhà của Disneyland huyền thoại — "Nơi hạnh phúc nhất trên trái đất" với hàng chục trò chơi đỉnh cao, Disney California Adventure và những kỷ niệm gia đình không thể quên.',
      en: 'Home of the legendary Disneyland Resort with thrilling rides, Disney California Adventure park, Star Wars Galaxy\'s Edge, and magical family memories.'
    },
    image:          'anaheim.jpg',
    youtubeId:      'HEWRxOXidCU',
    hook:           'Disneyland — nơi phép thuật trở thành hiện thực, nụ cười trẻ thơ và những kỷ niệm gia đình vĩnh cửu.',
    highlightTags:  ['Disneyland', 'California Adventure', "Galaxy's Edge", 'Fantasyland', 'Downtown Disney'],
    distance_miles: 10,
    duration:       { min: 1, max: 2, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #0f172a 0%, #1e1b4b 55%, #7c3aed 100%)',
    accent:         '#a78bfa',
    origin_for_tour: 'Anaheim, CA, USA',
    highlights: [
      { name: 'Disneyland Park',          vi: 'Công viên Disney huyền thoại ra đời năm 1955', en: 'The original Disneyland opened by Walt Disney himself in 1955', bestTime: 'Thứ 2–4 (hàng chờ ngắn nhất)', whyPopular: 'Công viên Disney đầu tiên thế giới do Walt Disney mở 1955 — Space Mountain, Pirates, Haunted Mansion.', travelNotes: 'Tải app Disneyland để check wait times. Lightning Lane $20–25/người tiết kiệm xếp hàng đáng kể.' },
      { name: 'California Adventure',     vi: 'Avengers Campus, Cars Land và Radiator Springs', en: 'Avengers Campus, Cars Land & Guardians of the Galaxy ride', bestTime: 'Cùng ngày với Disneyland (Park Hopper)', whyPopular: 'Avengers Campus gặp Spider-Man thật, Cars Land lung linh ban đêm, Guardians of the Galaxy.', travelNotes: 'Radiator Springs Racers hàng dài nhất — đặt Lightning Lane ngay khi mở cổng 8am.' },
      { name: "Galaxy's Edge",            vi: 'Trải nghiệm Star Wars sống động như thật',     en: 'Most immersive Star Wars experience ever created', bestTime: 'Buổi tối (đèn neon Star Wars ấn tượng)', whyPopular: 'Thế giới Star Wars sống động nhất từng được tạo ra — làng Batuu, lightsaber, Millennium Falcon.', travelNotes: 'Lightsaber Workshop $220/người — đặt trước 2 tuần. Rise of the Resistance không cần Lightning Lane.' },
      { name: 'Fantasyland',              vi: 'Vùng đất cổ tích với Sleeping Beauty Castle',  en: 'Storybook land with iconic Sleeping Beauty Castle', bestTime: 'Tối (lâu đài sáng đèn rực rỡ nhất)', whyPopular: 'Tim của Disneyland với lâu đài Sleeping Beauty — Matterhorn, It\'s a Small World, Carousel.', travelNotes: 'Chụp ảnh lâu đài đẹp nhất sáng sớm khi vắng người. Matterhorn là coaster dành cho mọi tuổi.' },
      { name: 'Downtown Disney',          vi: 'Mua sắm và ăn uống miễn phí vào cổng',        en: 'Free-admission dining & shopping district', bestTime: 'Chiều tối (bầu không khí sôi động)', whyPopular: 'Khu ẩm thực và mua sắm miễn phí vào cổng — Ralph Brennan\'s Jazz Kitchen và Trader Sam\'s Bar.', travelNotes: 'Black Tap Craft Burgers nổi tiếng với CrazyShakes. Vào được mà không cần vé Disneyland.' },
    ],
    things_to_do: [
      'Đi tàu lượn Space Mountain', "Khám phá Galaxy's Edge",
      'Xem pháo hoa đêm Disneyland', 'Chụp ảnh với Mickey Mouse',
      'Thử Radiator Springs Racers', 'Ăn churros và Dole Whip'
    ],
    cost: {
      transport:         { min: 100, max: 160, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 130, mid: 250, luxury: 700 },
      airbnb_per_night:  { estimate: 180, disclaimer: true },
      food_per_day:      { budget: 40, mid: 80, luxury: 160 },
    },
  },

  {
    id: 'napavalley',
    name:    { vi: 'Napa Valley', en: 'Napa Valley' },
    state:   'California',
    tagline: { vi: 'Vùng rượu vang đẳng cấp thế giới', en: "World's Premier Wine Country" },
    summary: {
      vi: 'Napa Valley quyến rũ bởi những vườn nho trải dài, hơn 400 hầm rượu đẳng cấp, ẩm thực farm-to-table và phong cảnh thung lũng đẹp như tranh.',
      en: 'Napa Valley captivates with rolling vineyards, 400+ world-class wineries, farm-to-table dining, and breathtaking California wine country scenery.'
    },
    image:          'napavalley.jpg',
    youtubeId:      'V9K64GQ-yIY',
    hook:           'Những vườn nho trải dài vô tận, rượu vang đẳng cấp thế giới và bữa ăn farm-to-table giữa thiên nhiên.',
    highlightTags:  ['Wine Tasting', 'Castello di Amorosa', 'Hot Air Balloon', 'Oxbow Market', 'Vineyard'],
    distance_miles: 430,
    duration:       { min: 2, max: 3, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #1a0a00 0%, #4a1a00 55%, #7c2d12 100%)',
    accent:         '#dc2626',
    origin_for_tour: 'Napa, CA, USA',
    highlights: [
      { name: 'Wine Tasting',         vi: 'Thưởng thức rượu tại hơn 400 hầm rượu',          en: '400+ wineries from boutique to iconic estates', bestTime: 'Sep–Nov (crush season thu hoạch)', whyPopular: '400+ winery với Cabernet Sauvignon nổi tiếng nhất California — từ boutique đến icon như Opus One.', travelNotes: 'Đặt lịch tasting trước, không phải winery nào cũng nhận walk-in. Uber giữa các winery.' },
      { name: 'Castello di Amorosa',  vi: 'Lâu đài rượu vang thế kỷ 13 tái dựng kỳ vĩ',    en: 'Stunning recreation of a 13th-century Italian castle winery', bestTime: 'Quanh năm', whyPopular: 'Lâu đài Ý thế kỷ 13 được tái dựng 107 phòng — tour hầm tối và rượu vang Tuscan tuyệt hảo.', travelNotes: 'Tour + tasting $40–65/người. Đặt trước vào cuối tuần. Cách Napa 25 phút về phía bắc.' },
      { name: 'Hot Air Balloon',      vi: 'Bay khinh khí cầu ngắm thung lũng từ trên cao',  en: 'Sunrise balloon flight over the vineyards', bestTime: 'Quanh năm, sáng sớm lúc bình minh', whyPopular: 'Bay lúc mặt trời mọc trên vườn nho trải dài — trải nghiệm lãng mạn và phi thường nhất Napa.', travelNotes: 'Giá ~$250–300/người, bao gồm champagne brunch sau hạ cánh. Đặt trước ít nhất 1 tuần.' },
      { name: 'Oxbow Public Market',  vi: 'Chợ ẩm thực artisanal nổi tiếng của Napa',       en: 'Artisan market — local cheeses, oysters & wine bars', bestTime: 'Cuối tuần 8–11am', whyPopular: 'Chợ artisan nổi tiếng với cheese địa phương, oyster tươi, thịt muối và wine bar — trái tim ẩm thực Napa.', travelNotes: 'Hog Island Oyster Co. rất ngon. Fatted Calf cho charcuterie. Đến trước 10am để tránh đông.' },
      { name: 'Culinary Institute',   vi: 'Trường nấu ăn nổi tiếng nhất nước Mỹ',           en: "America's most famous culinary school, open for dining", bestTime: 'Thứ 5–Chủ nhật (nhà hàng mở)', whyPopular: 'CIA Greystone — trường nấu ăn danh giá nhất nước Mỹ, nhà hàng mở cửa cho khách đặt bàn.', travelNotes: 'Đặt bàn ít nhất 1 tháng trước. Cooking demos và cửa hàng mở cửa tự do tham quan.' },
    ],
    things_to_do: [
      'Wine tasting buổi sáng', 'Bay khinh khí cầu lúc bình minh',
      'Ăn tối fine dining', 'Dạo phố Napa Downtown',
      'Thăm lâu đài Castello di Amorosa', 'Mua cheese và artisan food tại Oxbow'
    ],
    cost: {
      transport:         { min: 500, max: 700, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 200, mid: 380, luxury: 900 },
      airbnb_per_night:  { estimate: 280, disclaimer: true },
      food_per_day:      { budget: 40, mid: 90, luxury: 250 },
    },
  },

  {
    id: 'laketahoe',
    name:    { vi: 'Lake Tahoe', en: 'Lake Tahoe' },
    state:   'California / Nevada',
    tagline: { vi: 'Hồ núi xanh ngắt trên dãy Sierra Nevada', en: 'The Jewel of the Sierra' },
    summary: {
      vi: 'Lake Tahoe hút hồn bởi làn nước trong vắt có thể nhìn thấy đáy 21m, bãi biển cát trắng mùa hè và resort trượt tuyết đẳng cấp mùa đông.',
      en: 'Lake Tahoe mesmerizes with crystal-clear water visible 70 feet deep, white sandy beaches in summer, and world-class ski resorts in winter.'
    },
    image:          'laketahoe.jpg',
    youtubeId:      'kkRWHC8GQRY',
    hook:           'Nước hồ xanh ngắt trong vắt nhìn thấy đáy, bãi cát trắng mùa hè và ski resort đỉnh cao mùa đông.',
    highlightTags:  ['Emerald Bay', 'Sand Harbor', 'Heavenly Resort', 'Skiing', 'Tahoe City'],
    distance_miles: 490,
    duration:       { min: 2, max: 3, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #0c2340 0%, #1e4976 55%, #0ea5e9 100%)',
    accent:         '#38bdf8',
    origin_for_tour: 'South Lake Tahoe, CA, USA',
    highlights: [
      { name: 'Emerald Bay',     vi: 'Vịnh ngọc lục bảo kỳ diệu — di tích quốc gia',       en: 'National Natural Landmark with Vikingsholm castle on island', bestTime: 'Jul–Sep (thuyền kayak được)', whyPopular: 'Vịnh đẹp nhất Sierra Nevada — di tích quốc gia với lâu đài Vikingsholm trên đảo nhỏ.', travelNotes: 'Bãi đậu xe Highway 89 hay chật. Đi bộ 1 dặm xuống bờ hồ. Chụp ảnh từ đường trên cao cũng rất đẹp.' },
      { name: 'Sand Harbor',     vi: 'Bãi biển hoàn hảo với nước trong như pha lê',         en: 'Perfect beach with crystal-clear water & smooth granite boulders', bestTime: 'Jun–Aug (bơi lội được)', whyPopular: 'Bãi cát trắng với đá granit và nước trong vắt nhìn thấy đáy 6m — đẹp nhất toàn vùng Tahoe.', travelNotes: 'Vào cổng $15/xe. Shakespeare Festival tháng 8 biểu diễn ngay trên bãi biển — đặt trước.' },
      { name: 'Heavenly Resort', vi: 'Ski resort lớn nhất Tahoe với gondola view hồ',       en: 'Largest ski resort — gondola ride with stunning lake panorama', bestTime: 'Nov–Apr (trượt tuyết), Jun–Sep (gondola)', whyPopular: 'Ski resort lớn nhất Tahoe với 97 đường trượt và gondola mùa hè cho view hồ tuyệt đẹp.', travelNotes: 'Vé gondola $38/người. Đỉnh gondola có quán bar Tamarack Lodge với view không thể bỏ lỡ.' },
      { name: 'Tahoe City',      vi: 'Thị trấn ven hồ với nhà hàng và thể thao nước',      en: 'Charming lakeside town with great dining & water sports', bestTime: 'Quanh năm', whyPopular: 'Thị trấn bên hồ với Fanny Bridge ngắm cá hồi, nhà hàng ven nước và kayak/SUP cho thuê dễ dàng.', travelNotes: 'Thuê kayak tại Tahoe Moon Properties ~$30/giờ. Tahoe House Bakery cho bữa sáng ngon nhất.' },
      { name: 'Lake Paddling',   vi: 'Kayak và SUP trên mặt hồ trong như gương',           en: 'Kayaking & paddleboarding on impossibly clear water', bestTime: 'Jun–Sep (nước ấm 20–22°C)', whyPopular: 'Nước Tahoe trong như pha lê — SUP và kayak nhìn thấy đáy rõ ở độ sâu 6m, cảm giác thần kỳ.', travelNotes: 'SUP cho thuê ~$25/giờ tại Sand Harbor. Mặc áo phao. Buổi sáng mặt hồ phẳng lặng nhất.' },
    ],
    things_to_do: [
      'Đi gondola Heavenly nhìn toàn cảnh hồ', 'Bơi tại Sand Harbor',
      'Trekking quanh Emerald Bay', 'Trượt tuyết mùa đông tại Heavenly',
      'Chèo kayak trên hồ', 'Ngắm hoàng hôn tại Timber Cove'
    ],
    cost: {
      transport:         { min: 550, max: 800, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 150, mid: 320, luxury: 750 },
      airbnb_per_night:  { estimate: 250, disclaimer: true },
      food_per_day:      { budget: 30, mid: 70, luxury: 180 },
    },
  },

  {
    id: 'monterey',
    name:    { vi: 'Monterey · Big Sur', en: 'Monterey & Big Sur' },
    state:   'California',
    tagline: { vi: 'Bờ biển thơ mộng nhất thế giới', en: "California's Most Dramatic Coastline" },
    summary: {
      vi: 'Monterey và Big Sur quyến rũ bởi đường Highway 1 huyền thoại, vách đá dựng đứng bên Thái Bình Dương, thủy cung biển tầm cỡ thế giới và rừng thông Cypress cổ kính.',
      en: 'Monterey and Big Sur captivate with legendary Highway 1, towering sea cliffs, world-class aquarium, and ancient Cypress forests meeting the Pacific Ocean.'
    },
    image:          'monterey.jpg',
    youtubeId:      'CX4lHnLT3U8',
    hook:           'Đường Highway 1 huyền thoại uốn lượn bên vách đá Thái Bình Dương, rừng Cypress ngàn tuổi và thủy cung biển kỳ diệu.',
    highlightTags:  ['Highway 1', 'Big Sur', 'Aquarium', 'Bixby Bridge', 'Cannery Row'],
    distance_miles: 330,
    duration:       { min: 2, max: 3, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #042f2e 0%, #134e4a 55%, #0f766e 100%)',
    accent:         '#2dd4bf',
    origin_for_tour: 'Monterey, CA, USA',
    highlights: [
      { name: 'Monterey Bay Aquarium', vi: 'Thủy cung biển vĩ đại nhất bờ Tây nước Mỹ',     en: "One of the world's finest aquariums — 35,000 ocean animals", bestTime: 'Thứ 2–4 (ít đông nhất)', whyPopular: 'Thủy cung hàng đầu bờ Tây với 35,000 loài — bể cá ngừ khổng lồ và rái cá biển cực đáng yêu.', travelNotes: 'Vé $55/người lớn. Mua online tiết kiệm $5. Tham quan trọn vẹn cần 3–4 tiếng.' },
      { name: 'Big Sur Coast',         vi: 'Vách đá hùng vĩ bên Thái Bình Dương',            en: 'Dramatic cliffs along the world\'s most scenic coastal highway', bestTime: 'Apr–Nov (đường ít sạt lở nhất)', whyPopular: '145km đường Highway 1 đẹp nhất thế giới — vách đá dựng đứng bên Thái Bình Dương hoang dã.', travelNotes: 'Check caltrans.ca.gov trước vì đường hay đóng sau mưa. Pfeiffer Beach đẹp nhất lúc hoàng hôn.' },
      { name: 'Bixby Creek Bridge',    vi: 'Cầu cổ vòm cao 80m trên vách đá biển',           en: 'Iconic 80m-high concrete arch bridge over ocean canyon', bestTime: 'Sáng sớm hoặc chiều tà', whyPopular: 'Cầu bê tông vòm cổ nhất California — được chụp ảnh nhiều nhất trên toàn tuyến Highway 1.', travelNotes: 'Bãi đỗ xe nhỏ bắc cầu. Drone thường được phép. Sương mù buổi sáng tạo hiệu ứng huyền bí.' },
      { name: 'Cannery Row',           vi: 'Phố lịch sử ven biển với nhà hàng hải sản',      en: 'Historic waterfront with great seafood restaurants & shops', bestTime: 'Chiều tối', whyPopular: 'Con phố lịch sử của nhà văn John Steinbeck — nhà hàng hải sản, winery nhỏ và cửa hàng đặc sản.', travelNotes: 'Monterey abalone và clam chowder bread bowl là đặc sản phải thử. Spado\'s Waterfront rất tốt.' },
      { name: 'Point Lobos',           vi: 'Khu bảo tồn biển với hải cẩu và cá voi',         en: 'Marine reserve with sea otters, sea lions & migrating whales', bestTime: 'Sáng sớm (hải cẩu đang ngủ)', whyPopular: 'Khu bảo tồn biển đẹp nhất California — sea otter, sea lion và cá voi mùa đông Jan–Mar.', travelNotes: 'Vào cổng $10/xe. Whalers Cove điểm snorkeling tốt nhất. Cá voi di cư tháng 12–3.' },
    ],
    things_to_do: [
      'Lái xe ngắm cảnh Highway 1', 'Thăm Monterey Bay Aquarium',
      'Chụp ảnh Bixby Bridge', 'Ngắm bình minh tại Point Lobos',
      'Ăn hải sản tươi tại Cannery Row', 'Trekking qua rừng Redwood'
    ],
    cost: {
      transport:         { min: 380, max: 550, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 140, mid: 280, luxury: 700 },
      airbnb_per_night:  { estimate: 200, disclaimer: true },
      food_per_day:      { budget: 30, mid: 65, luxury: 170 },
    },
  },

  {
    id: '17miledrive',
    name:    { vi: '17-Mile Drive', en: '17-Mile Drive & Pebble Beach' },
    state:   'California',
    tagline: { vi: 'Con đường ven biển đẹp nhất California', en: 'The Most Scenic Drive in California' },
    summary: {
      vi: '17-Mile Drive là con đường ven biển huyền thoại qua bán đảo Monterey, nổi tiếng với Lone Cypress ngàn tuổi, sân golf Pebble Beach đẳng cấp PGA và cảnh biển ngoạn mục.',
      en: '17-Mile Drive is a legendary private coastal route through Pebble Beach — famous for the ancient Lone Cypress, world-famous Pebble Beach Golf Links, and spectacular ocean scenery.'
    },
    image:          '17miledrive.jpg',
    youtubeId:      '8MBgXEJ_cSU',
    hook:           'Lone Cypress ngàn tuổi trơ trên mỏm đá biển, sân golf Pebble Beach đẳng cấp PGA và hoàng hôn nghẹt thở.',
    highlightTags:  ['Lone Cypress', 'Pebble Beach Golf', 'Seal Rocks', 'Bird Rock', 'Spanish Bay'],
    distance_miles: 335,
    duration:       { min: 1, max: 2, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #0f172a 0%, #1e3a5f 55%, #1d4ed8 100%)',
    accent:         '#60a5fa',
    origin_for_tour: 'Pebble Beach, CA, USA',
    highlights: [
      { name: 'Lone Cypress',       vi: 'Cây bách tùng cô đơn ngàn tuổi trên mỏm đá biển', en: 'Iconic ancient cypress tree perched on a granite headland', bestTime: 'Hoàng hôn', whyPopular: 'Cây cypress cô đơn trên mỏm đá — một trong những hình ảnh tự nhiên được chụp nhiều nhất California.', travelNotes: 'Bãi đỗ xe nhỏ cạnh điểm nhìn. Đến trước hoàng hôn 30 phút để có vị trí tốt. Gió mạnh trên mỏm đá.' },
      { name: 'Pebble Beach Golf',  vi: 'Sân golf đẹp nhất thế giới sát mép biển',          en: "World's most photographed golf course on the ocean's edge", bestTime: 'Quanh năm', whyPopular: 'Sân golf đẹp nhất thế giới sát mép biển — AT&T Pro-Am Tournament truyền hình toàn cầu hàng năm.', travelNotes: 'Xem từ bãi đỗ xe cạnh sân không cần vé golf. Ăn tại The Tap Room $50–100/người.' },
      { name: 'Seal Rocks',         vi: 'Quần thể hải cẩu sinh sống tự nhiên gần bờ',       en: 'Natural habitat with hundreds of barking sea lions', bestTime: 'Quanh năm', whyPopular: 'Đảo đá granite với hàng trăm sea lion kêu ồn ào — sinh sống tự nhiên hoàn toàn ngay gần bờ.', travelNotes: 'Nhìn từ bãi đỗ xe trên tuyến 17-Mile Drive. Ống nhòm giúp quan sát gần hơn nhiều.' },
      { name: 'Bird Rock',          vi: 'Đảo đá với ngàn con chim biển và hải cẩu',         en: 'Granite rock teeming with seabirds and sea lions', bestTime: 'Sáng sớm (chim hoạt động nhất)', whyPopular: 'Khối đá granite với hàng ngàn chim biển và sea lion — thiên nhiên hoang dã ngay bên con đường.', travelNotes: 'Mang ống nhòm. Sea lion đông nhất mùa sinh sản Nov–Jan. Không vào khu vực cấm.' },
      { name: 'Spanish Bay',        vi: 'Bãi biển hoang sơ với cồn cát tự nhiên',           en: 'Wild coastal beach with natural sand dunes', bestTime: 'Chiều tà (bagpiper thổi kèn)', whyPopular: 'Bãi biển hoang sơ với cồn cát tự nhiên — mỗi chiều có bagpiper thổi kèn Scottish dọc bờ biển.', travelNotes: 'Khu vực Resort Inn at Spanish Bay. Fire pit ngoài trời buổi tối view biển — thanh bình nhất.' },
    ],
    things_to_do: [
      'Lái xe toàn bộ 17-Mile Drive', 'Chụp ảnh Lone Cypress lúc hoàng hôn',
      'Xem hải cẩu tại Seal Rocks', 'Ghé The Lodge at Pebble Beach',
      'Thăm Pacific Grove Butterfly Town', 'Ngắm hươu biển ăn cỏ ven đường'
    ],
    cost: {
      transport:         { min: 380, max: 560, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 180, mid: 380, luxury: 1200 },
      airbnb_per_night:  { estimate: 250, disclaimer: true },
      food_per_day:      { budget: 35, mid: 75, luxury: 200 },
    },
  },

  {
    id: 'palmsprings',
    name:    { vi: 'Palm Springs · Joshua Tree', en: 'Palm Springs & Joshua Tree' },
    state:   'California',
    tagline: { vi: 'Sa mạc bí ẩn và thiên đường ngắm sao', en: 'Desert Oasis & Stargazing Paradise' },
    summary: {
      vi: 'Palm Springs quyến rũ bởi kiến trúc mid-century modern và resort đẳng cấp; Joshua Tree National Park bên cạnh là thiên đường cây xương rồng kỳ lạ và ngắm sao đêm đẹp nhất California.',
      en: 'Palm Springs enchants with iconic mid-century architecture and luxury resorts; nearby Joshua Tree National Park offers otherworldly cactus landscapes and the best stargazing in California.'
    },
    image:          'palmsprings.jpg',
    youtubeId:      'n4dE9LKRJXU',
    hook:           'Sa mạc bí ẩn với cây Joshua Tree kỳ lạ, bầu trời đêm đầy sao và Palm Springs resort xa hoa.',
    highlightTags:  ['Joshua Tree', 'Aerial Tramway', 'Palm Canyon', 'Desert Stars', 'Coachella Valley'],
    distance_miles: 110,
    duration:       { min: 1, max: 2, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #1c0a00 0%, #431407 55%, #92400e 100%)',
    accent:         '#f59e0b',
    origin_for_tour: 'Palm Springs, CA, USA',
    highlights: [
      { name: 'Joshua Tree NP',           vi: 'Rừng cây Joshua kỳ lạ và đá granit hàng triệu tuổi', en: 'Alien-landscape park with ancient Joshua trees & granite boulders', bestTime: 'Oct–Apr (dưới 35°C)', whyPopular: 'Công viên quốc gia với cây Joshua kỳ dị và đá granite khổng lồ — thiên đường chụp ảnh hoàng hôn.', travelNotes: 'Cách Palm Springs 45 phút. Mang đủ nước 2L+/người. Skull Rock Trail 2.7km dễ nhất cho người mới.' },
      { name: 'Aerial Tramway',           vi: 'Cáp treo lên núi 2600m ngắm sa mạc từ trên cao',     en: "World's largest rotating tramcar — desert views from 8,500 ft", bestTime: 'Quanh năm (trên đỉnh mát hơn 25°C)', whyPopular: 'Cáp treo quay lớn nhất thế giới — từ sa mạc nóng lên đỉnh núi 8,516ft mát mẻ chỉ 10 phút.', travelNotes: 'Vé ~$32/người. Nhà hàng Mountain Station cần đặt trước. Trekking trail 11km từ đỉnh.' },
      { name: 'Indian Canyons',           vi: 'Hẻm núi cọ xanh tươi giữa sa mạc khô cằn',          en: 'Oasis palm canyons cutting through the desert', bestTime: 'Nov–May (mát hơn)', whyPopular: '3 hẻm núi ốc đảo cọ xanh của người Agua Caliente giữa sa mạc khô — đẹp kỳ lạ và yên tĩnh.', travelNotes: 'Vé $12/người. Palm Canyon rộng và đẹp nhất. Hướng dẫn viên bản địa rất thú vị và hiếm gặp.' },
      { name: 'Stargazing',               vi: 'Bầu trời đêm trong vắt nhất California',             en: "Some of California's darkest skies — millions of stars visible", bestTime: 'Oct–Mar (khí quyển khô hơn)', whyPopular: 'International Dark Sky Park — bầu trời đêm trong vắt nhất Southern California, hàng triệu sao.', travelNotes: 'Cholla Cactus Garden sau 9pm miễn phí. App Star Walk giúp nhận diện sao. Mang áo ấm ban đêm.' },
      { name: 'Mid-Century Architecture', vi: 'Kiến trúc Modernist thập niên 50-60 đặc trưng',      en: "World's largest collection of mid-century modern architecture", bestTime: 'Thu–Xuân (điều tiết nhiệt tốt hơn)', whyPopular: 'Bộ sưu tập mid-century modern lớn nhất thế giới — nhà cũ của Frank Sinatra, Bob Hope, Elvis.', travelNotes: 'Palm Springs Architecture Tour mỗi thứ 7 sáng. Elvis Honeymoon Hideaway có thể thuê qua đêm.' },
    ],
    things_to_do: [
      'Khám phá Joshua Tree National Park', 'Đi cáp treo Aerial Tramway',
      'Ngắm sao đêm tại Cholla Cactus Garden', 'Dạo phố Palm Springs midcentury',
      'Trekking Indian Canyons', 'Ngâm hồ bơi resort dưới nắng sa mạc'
    ],
    cost: {
      transport:         { min: 200, max: 300, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 90, mid: 180, luxury: 480 },
      airbnb_per_night:  { estimate: 145, disclaimer: true },
      food_per_day:      { budget: 25, mid: 55, luxury: 140 },
    },
  },

  {
    id: 'sequoia',
    name:    { vi: 'Sequoia · Kings Canyon', en: 'Sequoia & Kings Canyon' },
    state:   'California',
    tagline: { vi: 'Rừng cây khổng lồ lâu đời nhất Trái Đất', en: "Home of the World's Largest Trees" },
    summary: {
      vi: 'Sequoia và Kings Canyon hấp dẫn bởi những cây Sequoia Giant cao hơn 80m, già hơn 2000 năm tuổi — trong đó có General Sherman lớn nhất thế giới và Kings Canyon sâu hơn Grand Canyon.',
      en: 'Sequoia and Kings Canyon amaze with Giant Sequoias towering over 80 meters — including General Sherman, the world\'s largest tree by volume — and a canyon deeper than the Grand Canyon.'
    },
    image:          'sequoia.jpg',
    youtubeId:      'zHpDaFImkxQ',
    hook:           'Những cây khổng lồ 2000 năm tuổi, cao 84m và General Sherman — cây lớn nhất Trái Đất tính theo thể tích.',
    highlightTags:  ['General Sherman', 'Giant Forest', 'Moro Rock', 'Kings Canyon', 'Crystal Cave'],
    distance_miles: 260,
    duration:       { min: 2, max: 3, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #052e16 0%, #14532d 55%, #166534 100%)',
    accent:         '#4ade80',
    origin_for_tour: 'Sequoia National Park, CA, USA',
    highlights: [
      { name: 'General Sherman Tree', vi: 'Cây lớn nhất Trái Đất — cao 84m, 2100 năm tuổi', en: "Earth's largest tree by volume — 84m tall, 2,100 years old", bestTime: 'May–Oct (đường vào mở)', whyPopular: 'Sinh vật lớn nhất Trái Đất tính theo thể tích — 1486 m³, nặng hơn 1,300 tấn, 2100 tuổi.', travelNotes: 'Bãi đậu xe → đường bộ 800m. Vào sáng sớm tránh đông người. Mát hơn thung lũng ~10°C.' },
      { name: 'Giant Forest',         vi: 'Rừng Sequoia dày đặc với hàng ngàn cây khổng lồ', en: 'Grove of thousands of towering Giant Sequoias', bestTime: 'Jun–Oct', whyPopular: 'Rừng đặc nhất của Giant Sequoia với Congress Trail 3.2km qua các cây lớn nhất mọi thời đại.', travelNotes: 'Xe tram miễn phí từ Lodgepole. Sequoia không được leo trèo — chỉ được đứng cạnh chụp ảnh.' },
      { name: 'Moro Rock',            vi: 'Khối granit khổng lồ với view toàn Sierra Nevada', en: 'Dome of granite with 360° views of the Sierra Nevada', bestTime: 'Sáng sớm hoặc hoàng hôn', whyPopular: 'Đỉnh đá granit với 350 bậc thang và view 360° Sierra Nevada — khung cảnh ngoạn mục nhất công viên.', travelNotes: 'Leo lên 15–20 phút. Không hợp người sợ độ cao — đường hẹp, thiếu lan can ở nhiều đoạn.' },
      { name: 'Kings Canyon',         vi: 'Hẻm núi sâu hơn Grand Canyon',                   en: 'Deeper than the Grand Canyon with pristine wilderness', bestTime: 'Jun–Sep (đường đủ điều kiện)', whyPopular: 'Hẻm núi sâu hơn Grand Canyon — Road\'s End là điểm kết thúc đường lái, bắt đầu vùng hoang dã.', travelNotes: 'Thêm 45 phút từ Sequoia. Cedar Grove Village có cửa hàng và campground. Trekking nguyên sinh.' },
      { name: 'Crystal Cave',         vi: 'Hang động đá vôi với thạch nhũ tuyệt đẹp',       en: 'Marble cave with stunning stalactites and stalagmites', bestTime: 'May–Nov (tour mở cửa)', whyPopular: 'Hang đá cẩm thạch duy nhất có thể tour trong Sequoia — thạch nhũ đẹp lung linh trong ánh đèn.', travelNotes: 'Vé $17/người tại recreation.gov. Tour 50 phút. Mang áo ấm — trong hang chỉ 12°C.' },
    ],
    things_to_do: [
      'Chụp ảnh bên General Sherman Tree', 'Leo Moro Rock ngắm Sierra Nevada',
      'Thăm Crystal Cave', 'Đi bộ Congress Trail',
      'Lái xe Kings Canyon Scenic Byway', 'Cắm trại dưới những cây khổng lồ'
    ],
    cost: {
      transport:         { min: 300, max: 450, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 100, mid: 200, luxury: 450 },
      airbnb_per_night:  { estimate: 160, disclaimer: true },
      food_per_day:      { budget: 25, mid: 55, luxury: 120 },
    },
  },

  {
    id: 'santabarbara',
    name:    { vi: 'Santa Barbara', en: 'Santa Barbara' },
    state:   'California',
    tagline: { vi: 'American Riviera — kiến trúc Tây Ban Nha thanh lịch', en: 'The American Riviera' },
    summary: {
      vi: 'Santa Barbara quyến rũ bởi kiến trúc Tây Ban Nha-Moorish trắng ngà bên bờ biển, State Street sầm uất, Mission Santa Barbara lịch sử và rượu vang Santa Ynez Valley tuyệt hảo.',
      en: "Santa Barbara enchants with whitewashed Spanish-Moorish architecture along a stunning coastline, upscale State Street, historic Mission, and excellent Santa Ynez Valley wines."
    },
    image:          'santabarbara.jpg',
    youtubeId:      'FHvBmR-Hn7Y',
    hook:           'Kiến trúc Tây Ban Nha trắng tinh bên biển xanh, nhà thờ mission lịch sử và rượu vang Santa Ynez đỉnh cao.',
    highlightTags:  ['Mission Santa Barbara', 'Stearns Wharf', 'State Street', 'Santa Ynez Wine', 'East Beach'],
    distance_miles: 110,
    duration:       { min: 1, max: 2, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #0c2461 0%, #1e4ed8 55%, #93c5fd 100%)',
    accent:         '#93c5fd',
    origin_for_tour: 'Santa Barbara, CA, USA',
    highlights: [
      { name: 'Mission Santa Barbara', vi: 'Nhà thờ Mission đẹp nhất California năm 1786',      en: 'The "Queen of the Missions" — California\'s most beautiful mission', bestTime: 'Quanh năm', whyPopular: '"Nữ hoàng các Mission" — nhà thờ đẹp nhất California được xây 1786, vẫn nguyên vẹn đến nay.', travelNotes: 'Vé tham quan $16/người. Vườn hồng sau nhà thờ rất đẹp. Đi bộ từ Downtown 15 phút.' },
      { name: 'Stearns Wharf',         vi: 'Cầu tàu cổ nhất California, view biển thơ mộng',    en: 'Oldest working wharf in California with wine tasting & seafood', bestTime: 'Buổi chiều tà (view hoàng hôn đẹp)', whyPopular: 'Cầu tàu cổ nhất California từ 1872 — wine tasting, hải sản tươi và view Thái Bình Dương.', travelNotes: 'Đỗ xe cuối cầu tàu. Brophy Bros là nhà hàng hải sản được đánh giá cao nhất trên cầu tàu.' },
      { name: 'State Street',          vi: 'Đại lộ mua sắm và ẩm thực sầm uất nhất thành phố', en: 'Main shopping & dining boulevard with Spanish Colonial charm', bestTime: 'Chiều tối (nhà hàng và bar sôi động)', whyPopular: 'Đại lộ mua sắm chính với kiến trúc Tây Ban Nha — boutique, nhà hàng fine dining và wine bar.', travelNotes: 'Đi bộ từ cầu tàu lên State Street 15 phút. Wine tasting tại El Paseo winery ngay trên phố.' },
      { name: 'Santa Ynez Wine',       vi: 'Vùng rượu vang phim Sideways nổi tiếng toàn cầu',   en: 'Wine country made famous by the movie "Sideways"', bestTime: 'Sep–Nov (thu hoạch nho)', whyPopular: 'Vùng rượu vang nổi danh toàn cầu qua phim Sideways — Pinot Noir và Chardonnay tuyệt hảo.', travelNotes: 'Cách Santa Barbara 30 phút về phía bắc. Ballard Inn và Firestone Vineyard được yêu thích nhất.' },
      { name: 'East Beach',            vi: 'Bãi biển dài cát trắng đẹp nhất thành phố',         en: 'Long white-sand beach with palm trees & volleyball courts', bestTime: 'Jun–Sep (ấm và nắng nhất)', whyPopular: 'Bãi biển dài nhất Santa Barbara với cát trắng và hàng cọ — không gian mở và sạch sẽ.', travelNotes: 'Bãi đậu xe trả phí theo giờ. Thuê xe đạp dọc bờ biển. Chase Palm Park xanh ngay cạnh bãi.' },
    ],
    things_to_do: [
      'Tham quan Mission Santa Barbara', 'Dạo bộ State Street',
      'Wine tasting Santa Ynez Valley', 'Ngắm hoàng hôn tại East Beach',
      'Đạp xe dọc bờ biển', 'Ăn hải sản tươi tại Stearns Wharf'
    ],
    cost: {
      transport:         { min: 200, max: 310, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 140, mid: 280, luxury: 700 },
      airbnb_per_night:  { estimate: 200, disclaimer: true },
      food_per_day:      { budget: 30, mid: 65, luxury: 170 },
    },
  },

  {
    id: 'solvang',
    name:    { vi: 'Solvang', en: 'Solvang' },
    state:   'California',
    tagline: { vi: 'Làng Đan Mạch cổ tích giữa California', en: "California's Danish Fairy-Tale Village" },
    summary: {
      vi: 'Solvang là ngôi làng Đan Mạch thu nhỏ ở California, nổi tiếng với kiến trúc half-timbered châu Âu cổ kính, những cối xay gió và bánh Danish pastry thơm ngon.',
      en: 'Solvang is a charming Danish village in California wine country, famous for European half-timbered architecture, windmills, and irresistible Danish pastries and aebleskiver.'
    },
    image:          'solvang.jpg',
    youtubeId:      'Y5s7bO_BXHE',
    hook:           'Ngôi làng Đan Mạch cổ tích với cối xay gió, bánh pastry thơm lừng và kiến trúc châu Âu giữa lòng California.',
    highlightTags:  ['Danish Architecture', 'Windmills', 'Aebleskiver', 'Santa Ynez Wine', 'Hans Christian Andersen'],
    distance_miles: 165,
    duration:       { min: 1, max: 1, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #312e81 0%, #4338ca 55%, #818cf8 100%)',
    accent:         '#a5b4fc',
    origin_for_tour: 'Solvang, CA, USA',
    highlights: [
      { name: 'Danish Architecture',   vi: 'Nhà cổ half-timbered châu Âu giữa lòng California', en: 'European half-timbered buildings that feel transplanted from Denmark', bestTime: 'Quanh năm', whyPopular: 'Toàn thành phố xây theo phong cách Đan Mạch — cảm giác bước vào châu Âu thế kỷ 19 giữa California.', travelNotes: 'Đi bộ Mission Drive và Copenhagen Drive là hai phố chính. Mọi góc đều đáng chụp ảnh.' },
      { name: 'Aebleskiver',           vi: 'Bánh cầu Đan Mạch truyền thống với bơ và mứt',      en: 'Traditional spherical Danish pancakes with butter & jam', bestTime: 'Buổi sáng (tươi nhất)', whyPopular: 'Bánh cầu Đan Mạch với bơ, đường bột và mứt dâu — đặc sản truyền thống chỉ có ở Solvang.', travelNotes: 'Solvang Restaurant là nơi bán aebleskiver ngon và lâu đời nhất. Ăn ngay khi còn nóng.' },
      { name: 'Windmills',             vi: 'Cối xay gió biểu tượng của làng Solvang',           en: 'Iconic Danish windmills — perfect Instagram backdrop', bestTime: 'Quanh năm', whyPopular: 'Những cối xay gió Đan Mạch cổ điển là biểu tượng của Solvang — xuất hiện trên mọi ảnh postcard.', travelNotes: '4 cối xay gió lớn rải rác trong thành phố. Cối xay gần Elverhøj Museum đẹp và to nhất.' },
      { name: 'H.C. Andersen Museum',  vi: 'Bảo tàng nhà văn Cô bé Nàng tiên cá',             en: 'Museum dedicated to the Little Mermaid author', bestTime: 'Thứ 3–Chủ nhật (mở cửa)', whyPopular: 'Bảo tàng tưởng niệm tác giả Cô Bé Nàng Tiên Cá — tranh minh họa gốc và câu chuyện lịch sử.', travelNotes: 'Vé miễn phí. Nằm trên Mission Drive. Nhỏ nhưng thú vị, ấm cúng và độc đáo.' },
      { name: 'Santa Ynez Wine',       vi: 'Rượu vang vùng Santa Ynez ngay cạnh Solvang',       en: 'World-class wine country surrounding the village', bestTime: 'Sep–Nov (thu hoạch nho)', whyPopular: 'Solvang là trung tâm vùng Santa Ynez Valley nổi tiếng — ghé winery ngay trong làng hoặc quanh vùng.', travelNotes: 'Holus Bolus và Gainey Vineyard gần nhất. Nhiều winery có tasting room ngay trên phố Solvang.' },
    ],
    things_to_do: [
      'Ăn aebleskiver truyền thống Đan Mạch', 'Chụp ảnh bên cối xay gió',
      'Thăm Hans Christian Andersen Museum', 'Wine tasting Santa Ynez',
      'Mua bánh pastry Đan Mạch tươi', 'Khám phá các cửa hàng đặc sản'
    ],
    cost: {
      transport:         { min: 260, max: 380, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 120, mid: 220, luxury: 500 },
      airbnb_per_night:  { estimate: 170, disclaimer: true },
      food_per_day:      { budget: 25, mid: 55, luxury: 140 },
    },
  },

  {
    id: 'grandcanyon',
    name:    { vi: 'Grand Canyon', en: 'Grand Canyon' },
    state:   'Arizona',
    outOfState: true,
    tagline: { vi: 'Kỳ quan thiên nhiên vĩ đại nhất thế giới', en: 'One of the Seven Natural Wonders' },
    summary: {
      vi: 'Grand Canyon choáng ngợp bởi hẻm núi sâu 1.6km, rộng 16km và dài 446km — kiệt tác thiên nhiên được điêu khắc bởi sông Colorado trong 6 triệu năm.',
      en: 'Grand Canyon overwhelms with its staggering 1-mile-deep, 10-mile-wide, 277-mile-long gorge — sculpted by the Colorado River over 6 million years of geological time.'
    },
    image:          'grandcanyon.jpg',
    youtubeId:      'EQsEUKDuZik',
    hook:           'Hẻm núi sâu 1.6km điêu khắc trong 6 triệu năm — vẻ đẹp hùng vĩ ngoài mọi ngôn từ, phải đến mới hiểu.',
    highlightTags:  ['South Rim', 'Skywalk', 'Colorado River', 'Bright Angel Trail', 'Helicopter Tour'],
    distance_miles: 490,
    duration:       { min: 1, max: 2, unit: 'ngày' },
    gradient:       'linear-gradient(160deg, #431407 0%, #7c2d12 55%, #c2410c 100%)',
    accent:         '#fb923c',
    origin_for_tour: 'Grand Canyon South Rim, AZ, USA',
    highlights: [
      { name: 'South Rim Views',       vi: 'Điểm ngắm cảnh hùng vĩ toàn cảnh hẻm núi',        en: 'Mather Point, Yavapai & Desert View — iconic panoramas', bestTime: 'Bình minh hoặc hoàng hôn', whyPopular: 'Mather Point, Yavapai và Desert View là 3 điểm ngắm biểu tượng nhất của South Rim — vĩ đại và choáng ngợp.', travelNotes: 'Đến trước bình minh để có chỗ đứng. Shuttle bus miễn phí dọc Rim Trail cả ngày.' },
      { name: 'Grand Canyon Skywalk',  vi: 'Cầu kính hình móng ngựa chìa ra hẻm núi 1.2km',   en: 'Glass horseshoe bridge extending 21m over the canyon', bestTime: 'Sáng sớm (ít đông nhất)', whyPopular: 'Cầu kính hình móng ngựa nhô ra 21m trên vực sâu 1.2km — nhìn thẳng xuống đáy hẻm núi qua kính.', travelNotes: 'Nằm ở Grand Canyon West (Hualapai Reservation), khác với South Rim. Vé riêng $60+/người.' },
      { name: 'Bright Angel Trail',    vi: 'Đường mòn huyền thoại xuống đáy hẻm núi',          en: 'Most famous hiking trail descending into the canyon', bestTime: 'Sáng sớm trước 8am (tránh nóng hè)', whyPopular: 'Trail huyền thoại nhất Grand Canyon xuống đáy hẻm với trạm nghỉ và nguồn nước.', travelNotes: 'Không leo xuống đáy trong ngày một (nguy hiểm hè). 3-Mile Resthouse là điểm hợp lý nhất.' },
      { name: 'Colorado River',        vi: 'Dòng sông đã điêu khắc nên kỳ quan trong 6 triệu năm', en: 'The mighty river that carved this wonder over millions of years', bestTime: 'Thấy từ South Rim Viewpoints', whyPopular: 'Dòng sông tạo ra Grand Canyon suốt 6 triệu năm — ánh bạc giữa lòng hẻm sâu nhìn từ trên cao.', travelNotes: 'River raft tour 1–14 ngày (đặt trước 1 năm). Trực thăng đến bờ sông từ Las Vegas $200+.' },
      { name: 'Helicopter Tour',       vi: 'Bay trực thăng ngắm Grand Canyon từ trên không',   en: 'Helicopter flightseeing for the ultimate perspective', bestTime: 'Sáng sớm (không khí mát, ít gió)', whyPopular: 'Bay trực thăng 30–50 phút ngắm toàn bộ Grand Canyon — góc nhìn không thể có từ trên bờ.', travelNotes: 'Giá ~$200–350/người từ South Rim. Papillon và Maverick là 2 công ty uy tín nhất. Đặt online.' },
    ],
    things_to_do: [
      'Ngắm cảnh South Rim lúc bình minh', 'Đi bộ đầu Bright Angel Trail',
      'Thăm Grand Canyon Skywalk', 'Bay trực thăng ngắm toàn cảnh',
      'Xem hoàng hôn tại Desert View', 'Cắm trại dưới bầu trời sao Arizona'
    ],
    cost: {
      transport:         { min: 550, max: 800, note: 'Khứ hồi từ Orange County' },
      hotel_per_night:   { budget: 100, mid: 200, luxury: 500 },
      airbnb_per_night:  { estimate: 160, disclaimer: true },
      food_per_day:      { budget: 25, mid: 55, luxury: 130 },
    },
  },
];

/** Airport pickup/dropoff service info */
const AIRPORTS = [
  { value: 'John Wayne Airport, Orange County, CA', label: 'John Wayne — SNA',  code: 'SNA', lat: 33.6762,  lng: -117.8675 },
  { value: 'Long Beach Airport, Long Beach, CA',    label: 'Long Beach — LGB',  code: 'LGB', lat: 33.8177,  lng: -118.1516 },
  { value: 'LAX Airport, Los Angeles, CA',          label: 'Los Angeles — LAX', code: 'LAX', lat: 33.9425,  lng: -118.4081 },
  { value: 'Ontario Airport, Ontario, CA',          label: 'Ontario — ONT',     code: 'ONT', lat: 34.0558,  lng: -117.6013 },
  { value: 'Burbank Airport, Burbank, CA',          label: 'Burbank — BUR',     code: 'BUR', lat: 34.2007,  lng: -118.3585 },
  { value: 'San Diego Airport, San Diego, CA',      label: 'San Diego — SAN',   code: 'SAN', lat: 32.7338,  lng: -117.1933 },
];

/** Static quick estimates for display (no Distance Matrix needed) */
const QUICK_ESTIMATES = {
  pickup:        { label: 'Đón sân bay',              range: 'từ $100',       detail: 'Phụ thuộc vào khoảng cách. Tesla (≤3 khách) hoặc Mercedes Van (≥4 khách).' },
  dropoff:       { label: 'Đưa sân bay',              range: 'từ $100',       detail: 'Phụ thuộc vào khoảng cách. Tesla (≤3 khách) hoặc Mercedes Van (≥4 khách).' },
  lasvegas:      { label: 'Tour Las Vegas',            range: '$450 – $650',   detail: 'Khứ hồi từ OC. 2–3 ngày. Không bao gồm chỗ ở.' },
  yosemite:      { label: 'Tour Yosemite',             range: '$380 – $550',   detail: 'Khứ hồi từ OC. 2–4 ngày. Không bao gồm chỗ ở.' },
  sanfrancisco:  { label: 'Tour San Francisco',        range: '$420 – $600',   detail: 'Khứ hồi từ OC. 2–4 ngày. Không bao gồm chỗ ở.' },
  losangeles:    { label: 'Tour Los Angeles',          range: '$120 – $200',   detail: 'Khứ hồi từ OC. 1–2 ngày. Không bao gồm chỗ ở.' },
  sandiego:      { label: 'Tour San Diego',            range: '$160 – $260',   detail: 'Khứ hồi từ OC. 1–2 ngày. Không bao gồm chỗ ở.' },
  anaheim:       { label: 'Tour Anaheim · Disneyland', range: '$100 – $160',   detail: 'Khứ hồi từ OC. 1–2 ngày. Không bao gồm vé vào cổng.' },
  napavalley:    { label: 'Tour Napa Valley',          range: '$500 – $700',   detail: 'Khứ hồi từ OC. 2–3 ngày. Không bao gồm chỗ ở.' },
  laketahoe:     { label: 'Tour Lake Tahoe',           range: '$550 – $800',   detail: 'Khứ hồi từ OC. 2–3 ngày. Không bao gồm chỗ ở.' },
  monterey:      { label: 'Tour Monterey · Big Sur',   range: '$380 – $550',   detail: 'Khứ hồi từ OC. 2–3 ngày. Không bao gồm chỗ ở.' },
  '17miledrive': { label: 'Tour 17-Mile Drive',        range: '$380 – $560',   detail: 'Khứ hồi từ OC. 1–2 ngày. Không bao gồm chỗ ở.' },
  palmsprings:   { label: 'Tour Palm Springs · Joshua Tree', range: '$200 – $300', detail: 'Khứ hồi từ OC. 1–2 ngày. Không bao gồm chỗ ở.' },
  sequoia:       { label: 'Tour Sequoia · Kings Canyon', range: '$300 – $450', detail: 'Khứ hồi từ OC. 2–3 ngày. Không bao gồm chỗ ở.' },
  santabarbara:  { label: 'Tour Santa Barbara',        range: '$200 – $310',   detail: 'Khứ hồi từ OC. 1–2 ngày. Không bao gồm chỗ ở.' },
  solvang:       { label: 'Tour Solvang',              range: '$260 – $380',   detail: 'Khứ hồi từ OC. 1 ngày. Không bao gồm chỗ ở.' },
  grandcanyon:   { label: 'Tour Grand Canyon',         range: '$550 – $800',   detail: 'Khứ hồi từ OC qua Arizona. 1–2 ngày. Không bao gồm chỗ ở.' },
};

/** Returns destination by id */
function getDestination(id) {
  return DESTINATIONS.find(d => d.id === id) || null;
}

/** Returns formatted cost summary string for a destination */
function getCostSummary(dest) {
  const t = dest.cost.transport;
  const h = dest.cost.hotel_per_night;
  return `Xe: $${t.min}–$${t.max} · Khách sạn: $${h.budget}–$${h.luxury}/đêm`;
}

/**
 * Builds AI system prompt context string from destination data.
 * Used by chat.js to give the AI agent full service knowledge.
 */
function buildAIContext() {
  const dests = DESTINATIONS.map(d => {
    const t = d.cost.transport;
    const h = d.cost.hotel_per_night;
    const highlights = d.highlights.slice(0, 3).map(h => h.name).join(', ');
    return `• ${d.name.en} (${d.state}): ${d.summary.en}
  Top attractions: ${highlights}
  Trip duration: ${d.duration.min}–${d.duration.max} ${d.duration.unit}
  Transportation cost: $${t.min}–$${t.max} round-trip from Orange County
  Hotels: $${h.budget}–$${h.luxury}/night`;
  }).join('\n');

  const airportList = AIRPORTS.map(a => a.code).join(', ');

  return `TOUR DESTINATIONS:
${dests}

AIRPORT TRANSFER SERVICE:
Airports: ${airportList}
Vehicles: Tesla Model Y (1–3 passengers), Mercedes Van (4–12 passengers)
Starting from $100, priced by distance.

CONTACT:
Duy Hoa: 714-227-6007
Dinh: 562-331-3809
Email: dulichcali21@gmail.com
Book online at: www.dulichcali21.com`;
}
