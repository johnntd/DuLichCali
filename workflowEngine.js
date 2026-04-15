/**
 * Du Lịch Cali — Workflow Engine v1.0
 *
 * True multi-step state-machine for all service types.
 * Replaces the old FLOW_STEPS/flowState system in chat.js.
 *
 * Workflows: food_order · airport_pickup · airport_dropoff
 *            nail_appointment · hair_appointment · tour_request
 *
 * Public API:
 *   DLCWorkflow.detectIntent(text)           → intent key | null
 *   DLCWorkflow.isActive()                   → boolean
 *   DLCWorkflow.startWorkflow(intent, seed)  → void
 *   DLCWorkflow.process(text)                → string | {type:'finalize'} | null
 *   DLCWorkflow.finalize()                   → Promise<orderId>
 *   DLCWorkflow.cancel()                     → void
 *   DLCWorkflow.getDraft()                   → object | null
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'dlc_wf_draft';

  // Tracks the last rejected single-word address so the re-ask question can reference it
  var _addrAmbigName = null;

  // ── Formatters ─────────────────────────────────────────────────────────────

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso + 'T12:00:00');
      var lang = (draft && draft.lang) || 'en';
      var cs = CONFIRM_STRINGS[lang] || CONFIRM_STRINGS.vi;
      var DOW = cs.dateDows;
      var MON = cs.dateMonths;
      if (lang === 'vi') {
        return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()];
      }
      return DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate();
    } catch (e) { return iso; }
  }

  function fmtTime(hhmm) {
    if (!hhmm) return '—';
    try {
      var parts = hhmm.split(':');
      var h = parseInt(parts[0]), m = parseInt(parts[1] || 0);
      var p = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12 || 12;
      return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + p;
    } catch (e) { return hhmm; }
  }

  function fmtPhone(p) {
    if (!p) return '';
    var d = String(p).replace(/\D/g, '');
    return d.length === 10 ? '(' + d.slice(0,3) + ') ' + d.slice(3,6) + '-' + d.slice(6) : p;
  }

  function genId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var id = 'DLC-';
    for (var i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // ── Multilingual strings for confirmation UI, summaries, and questions ────────
  var CONFIRM_STRINGS = {
    vi: {
      cancelled:     'Đã hủy. Bạn cần tôi giúp gì khác không?',
      corrUpdated:   '✅ Đã cập nhật — ',
      corrContinue:  'Đã cập nhật. Vui lòng tiếp tục: ',
      reShowQ:       '\n\nBạn có muốn xác nhận không?\nGõ "có" để đặt hoặc "không" để chỉnh sửa.',
      confirmReady:  '\n\n✅ Thông tin đầy đủ! Bạn có muốn xác nhận không?',
      confirmOrEdit: 'Bạn muốn xác nhận hay chỉnh sửa?',
      chipOk:        '✅ Xác nhận đặt chỗ',   chipOkVal: 'xác nhận',
      chipEdit:      '✏️ Chỉnh sửa thông tin', chipEditVal: 'không',
      priceFrom:     'Giá từ: ',

      dateDows:   ['CN','T2','T3','T4','T5','T6','T7'],
      dateMonths: ['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6',
                   'tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'],

      fld_passengers:'Số người', fld_requestedDate:'Ngày',
      fld_arrivalTime:'Giờ đến', fld_departureTime:'Giờ đi',
      fld_requestedTime:'Giờ hẹn', fld_airport:'Sân bay',
      fld_airline:'Hãng bay', fld_customerName:'Tên',
      fld_customerPhone:'Điện thoại', fld_dropoffAddress:'Địa chỉ đến',
      fld_pickupAddress:'Điểm đón', fld_address:'Địa chỉ giao',
      fld_quantity:'Số lượng', fld_serviceType:'Dịch vụ',
      fld_days:'Số ngày', fld_destination:'Điểm đến',
      fld_fulfillment:'Hình thức nhận', fld_variant:'Loại', fld_lodging:'Chỗ ở',

      hdFood:'📋 Tóm tắt đơn hàng:', hdPickup:'📋 Tóm tắt đặt đón sân bay:',
      hdDropoff:'📋 Tóm tắt đặt ra sân bay:', hdRide:'📋 Tóm tắt đặt xe riêng cao cấp:',
      hdNail:'📋 Tóm tắt lịch hẹn nail:', hdHair:'📋 Tóm tắt lịch hẹn tóc:',
      hdTour:'📋 Tóm tắt yêu cầu tour:',

      sfRestaurant:'• Nhà hàng:  ', sfDish:'• Món:       ', sfQty:'• Số lượng:  ',
      sfVariant:'• Loại:      ', sfFulfillment:'• Nhận hàng: ',
      sfDelivery:'Giao hàng tận nơi', sfPickupSelf:'Tự đến lấy',
      sfAddress:'• Địa chỉ:   ', sfDate:'• Ngày:      ', sfTime:'• Giờ:       ',
      sfName:'• Tên:       ', sfPhone:'• SĐT:       ', sfNotes:'• Ghi chú:   ',
      sfAirport:'• Sân bay:      ', sfTerminal:'• Terminal:     ',
      sfFlight:'• Chuyến bay:   ', sfArrivalDate:'• Ngày đến:     ',
      sfArrivalTime:'• Giờ đón:      ', sfPassengers:'• Hành khách:   ',
      sfPassengersUnit:' người', sfLuggage:'• Hành lý:      ',
      sfLuggageCarryOn:'Xách tay (không ký gửi)', sfLuggageChecked:' kiện',
      sfDropoffAddr:'• Điểm đến:     ', sfPickupAddr:'• Điểm đón:     ',
      sfDepDate:'• Ngày bay:     ', sfDepTime:'• Giờ cất cánh: ',
      sfService:'• Dịch vụ:   ', sfRegion:'• Khu vực:   ',
      sfDest:'• Điểm đến:  ', sfDays:'• Số ngày:   ', sfDaysUnit:' ngày',
      sfFrom:'• Xuất phát: ', sfLodging:'• Chỗ ở:     ',
      sfHotel:'  Khách sạn: ', sfArea:'  Khu vực:   ',
      sfBudget:'  Ngân sách: ', sfBooking:'  Đặt phòng: ',
      sfPickupFrom:'• Điểm đón:   ', sfDropoffTo:'• Điểm đến:   ',
      sfLodgeHotel:'Khách sạn', sfLodgeAirbnb:'Airbnb', sfLodgeNone:'Tự túc',
      sfAreaStrip:'The Strip', sfAreaDT:'Downtown', sfAreaOff:'Off Strip',
      sfAreaCC:'City Center', sfAreaBeach:'Near Beach', sfAreaAirport:'Near Airport',
      sfBudgBudget:'Tiết kiệm', sfBudgMid:'Tầm trung', sfBudgPrem:'Cao cấp',
      sfModeVendor:'Du Lịch Cali hỗ trợ đặt', sfModeSelf:'Tự đặt',

      priceTotal:'💰 Tổng: $', priceEst:'💰 Ước tính: ',
      priceTransport:'💰 Ước tính transport: ', priceCompare:'💰 So sánh giá (',
      priceUber:'', priceDLC:'   DuLịchCali:  ~$',
      priceSave:'  ← tiết kiệm ~$', priceApprox:'   ⚠️ Giá sơ bộ — đội sẽ xác nhận sau khi đặt.',
      driverWait:'⏱ Tài xế chờ tại cửa Arrivals/Baggage Claim.',

      qFoodItem:'Bạn muốn đặt món gì?\n(VD: Chả Giò, Chuối Đậu Nấu Ốc)',
      qFoodQtyPre:'Bạn muốn đặt bao nhiêu ', qFoodQtyPost:'?', qFoodQtyMin:'Tối thiểu: ',
      qFoodFulfillment:'Bạn muốn tự đến lấy (pickup) hay giao hàng tận nơi (delivery)?',
      qFoodDate:'Bạn muốn nhận vào ngày nào?\n(VD: thứ Bảy, 15/4, "ngày mai")',
      qFoodTime:'Mấy giờ bạn muốn lấy/nhận?\n(VD: 2pm, 14:00)',
      qName:'Tên của bạn là gì?', qPhone:'Số điện thoại liên lạc?',
      qAddress:'Địa chỉ giao hàng của bạn?',
      qNotes:'Có yêu cầu đặc biệt nào không? (Gõ "không" nếu không có)',
      qNotesShort:'Yêu cầu đặc biệt?\n(Gõ "không" nếu không có)',

      qAirportPickup:'✈️ Bạn đến sân bay nào?',
      qAirportNear:'\n(Gần bạn nhất: ', qAirportList:'\n(LAX · SNA · ONT · BUR · SFO · SJC · OAK...)',
      qAirportDropoff:'✈️ Bạn cần đưa tới sân bay nào?',
      qAirline:'Hãng bay và số hiệu chuyến? (VD: United 714)\nGõ "bỏ qua" nếu chưa có.',
      qAirlineShort:'Hãng bay và số hiệu chuyến? (Gõ "bỏ qua" nếu chưa có)',
      qArrivalDate:'Ngày đến? (VD: 15/4, thứ Sáu)',
      qArrivalTime:'Mấy giờ cần tài xế có mặt tại sân bay? (VD: 2:30 CH, 14:30)',
      qPassengers:'Có bao nhiêu hành khách?',
      qTerminal:'Cổng/Terminal bạn đến? (VD: Terminal 4, TBIT)\nGõ "không biết" nếu chưa rõ.',
      qTerminalDrop:'Cổng/Terminal cần đến? (VD: Terminal 2, TBIT)\nGõ "không biết" nếu chưa rõ.',
      qLuggage:'Có bao nhiêu kiện hành lý ký gửi? (Gõ "0" nếu chỉ xách tay)',
      qDropoffAddr:'Địa chỉ điểm đến sau sân bay?',
      qDropoffAddrHint:'\n(thành phố hoặc địa chỉ cụ thể)',
      qPickupAddr:'Địa chỉ đón bạn (điểm xuất phát)?',
      qCurrentLoc:'\n(Vị trí hiện tại: ', qCurrentLocUse:' — gõ "đây" để dùng)',
      qNameLead:'Tên hành khách chính?',

      qRidePickup:'📍 Địa chỉ đón bạn?',
      qRidePickupEx:'\n(Thành phố hoặc địa chỉ cụ thể — VD: San Jose, 1234 Main St, Orange County...)',
      qRideDropoff:'🏁 Điểm đến của bạn?\n(Thành phố hoặc địa chỉ cụ thể)',
      qRideDate:'Ngày đi? (VD: 15/4, thứ Sáu, ngày mai)',
      qRideTime:'Mấy giờ xuất phát? (VD: 9:00 AM, 14:30)',
      qNameSelf:'Tên của bạn?',
      qEmail:'📧 Email để nhận xác nhận đặt xe?\n(Gõ "bỏ qua" nếu không muốn cung cấp)',

      qNailService:'Bạn muốn làm dịch vụ gì?\n1. Manicure (móng tay)\n2. Pedicure (móng chân)\n3. Gel Nails\n4. Acrylic\n5. Full Set\n(hoặc Mani+Pedi, Dip Powder...)',
      qHairService:'Bạn muốn làm gì?\n1. Cắt tóc\n2. Nhuộm tóc\n3. Uốn / Duỗi\n4. Keratin Treatment\n5. Balayage / Highlights',
      qRegion:'Bạn ở khu vực nào tại California?',
      qApptDate:'Ngày nào bạn muốn hẹn?', qApptTime:'Giờ nào? (VD: 10am, 2:30pm)',
      qNailNotes:'Màu sắc, kiểu nail, hoặc yêu cầu đặc biệt?\n(Gõ "không" nếu không có)',
      qHairNotes:'Kiểu tóc, màu muốn nhuộm, hoặc yêu cầu đặc biệt?\n(Gõ "không" nếu không có)',

      qTourDest:'🗺️ Bạn muốn đi đâu?\n(Las Vegas · Yosemite · San Francisco · Napa · Big Sur · Grand Canyon...)',
      qTourDate:'Ngày khởi hành dự kiến?', qTourDays:'Chuyến đi bao nhiêu ngày?',
      qTourPassengers:'Nhóm bạn có bao nhiêu người?',
      qTourFrom:'Điểm xuất phát của bạn ở đâu?\n(thành phố hoặc địa chỉ)',
      qTourLodging:'Bạn có cần hỗ trợ chỗ ở không?',
      qTourAreaVegas:'Bạn muốn ở khu vực nào tại Las Vegas?',
      qTourAreaSF:'Bạn muốn ở khu vực nào tại San Francisco?',
      qTourArea:'Bạn muốn ở khu vực nào?',
      qTourBudget:'Ngân sách khách sạn mỗi đêm?',
      qTourBooking:'Bạn muốn tự đặt khách sạn, hay nhờ Du Lịch Cali hỗ trợ đặt giúp?',
      qTourContact:'Tên liên lạc chính?',
      hotelIntro:'Đây là các khách sạn phù hợp với yêu cầu của bạn:\n\n',

      errTimePast:      '❌ Giờ đó đã qua rồi. Vui lòng chọn giờ sau.',
      errAptTimeTooSoon:'❌ Đặt đón sân bay cần trước ít nhất 2 giờ. Vui lòng chọn giờ sau.',
      errRideTimeTooSoon:'❌ Đặt xe cần trước ít nhất 1 giờ. Vui lòng chọn giờ sau.',
      errAptNotFeasible:'❌ Tài xế gần nhất dự kiến tới sân bay lúc {time}. Vui lòng chọn từ {time} trở đi.',
      qGpsPickupFull:   '\n📍 Tôi thấy bạn đang ở:\n',
      qGpsPickupUse:    '\nGõ "đây" để dùng địa điểm này, hoặc nhập địa chỉ khác.',
      qAddrClarify:     '📍 Địa chỉ đó có vẻ chưa đủ cụ thể. Vui lòng cung cấp địa chỉ đường phố hoặc tên đầy đủ\n(VD: 123 Main St San Jose, hoặc Marriott San Jose Downtown)',
    },
    en: {
      cancelled:     'Cancelled. How else can I help you?',
      corrUpdated:   '✅ Updated — ',
      corrContinue:  'Updated. Let\'s continue: ',
      reShowQ:       '\n\nWould you like to confirm? Type "yes" to book or "no" to edit.',
      confirmReady:  '\n\n✅ All set! Would you like to confirm your booking?',
      confirmOrEdit: 'Would you like to confirm or make changes?',
      chipOk:        '✅ Confirm booking',  chipOkVal: 'yes',
      chipEdit:      '✏️ Edit details',     chipEditVal: 'no',
      priceFrom:     'Est. starting from: ',

      dateDows:   ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      dateMonths: ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'],

      fld_passengers:'Passengers', fld_requestedDate:'Date',
      fld_arrivalTime:'Arrival time', fld_departureTime:'Departure time',
      fld_requestedTime:'Time', fld_airport:'Airport',
      fld_airline:'Flight', fld_customerName:'Name',
      fld_customerPhone:'Phone', fld_dropoffAddress:'Drop-off address',
      fld_pickupAddress:'Pickup address', fld_address:'Delivery address',
      fld_quantity:'Quantity', fld_serviceType:'Service',
      fld_days:'Days', fld_destination:'Destination',
      fld_fulfillment:'Fulfillment', fld_variant:'Variant', fld_lodging:'Lodging',

      hdFood:'📋 Order summary:', hdPickup:'📋 Airport pickup summary:',
      hdDropoff:'📋 Airport drop-off summary:', hdRide:'📋 Private ride summary:',
      hdNail:'📋 Nail appointment summary:', hdHair:'📋 Hair appointment summary:',
      hdTour:'📋 Tour request summary:',

      sfRestaurant:'• Restaurant:  ', sfDish:'• Item:        ', sfQty:'• Quantity:    ',
      sfVariant:'• Variant:     ', sfFulfillment:'• Fulfillment: ',
      sfDelivery:'Delivery', sfPickupSelf:'Pickup',
      sfAddress:'• Address:     ', sfDate:'• Date:        ', sfTime:'• Time:        ',
      sfName:'• Name:        ', sfPhone:'• Phone:       ', sfNotes:'• Notes:       ',
      sfAirport:'• Airport:      ', sfTerminal:'• Terminal:     ',
      sfFlight:'• Flight:       ', sfArrivalDate:'• Arrival date: ',
      sfArrivalTime:'• Pickup time:  ', sfPassengers:'• Passengers:   ',
      sfPassengersUnit:' people', sfLuggage:'• Luggage:      ',
      sfLuggageCarryOn:'Carry-on only', sfLuggageChecked:' checked bags',
      sfDropoffAddr:'• Drop-off:     ', sfPickupAddr:'• Pickup from:  ',
      sfDepDate:'• Flight date:  ', sfDepTime:'• Departure:    ',
      sfService:'• Service:     ', sfRegion:'• Region:      ',
      sfDest:'• Destination: ', sfDays:'• Days:        ', sfDaysUnit:' days',
      sfFrom:'• Departing:   ', sfLodging:'• Lodging:     ',
      sfHotel:'  Hotel:       ', sfArea:'  Area:        ',
      sfBudget:'  Budget:      ', sfBooking:'  Booking:     ',
      sfPickupFrom:'• Pickup:      ', sfDropoffTo:'• Drop-off:    ',
      sfLodgeHotel:'Hotel', sfLodgeAirbnb:'Airbnb', sfLodgeNone:'Self-arranged',
      sfAreaStrip:'The Strip', sfAreaDT:'Downtown', sfAreaOff:'Off Strip',
      sfAreaCC:'City Center', sfAreaBeach:'Near Beach', sfAreaAirport:'Near Airport',
      sfBudgBudget:'Budget', sfBudgMid:'Mid-range', sfBudgPrem:'Premium',
      sfModeVendor:'Du Lịch Cali will book', sfModeSelf:'Self-booking',

      priceTotal:'💰 Total: $', priceEst:'💰 Estimate: ',
      priceTransport:'💰 Est. transport: ', priceCompare:'💰 Price comparison (',
      priceUber:'', priceDLC:'   DuLịchCali: ~$',
      priceSave:'', priceApprox:'   ⚠️ Rough estimate — team will confirm after booking.',
      driverWait:'⏱ Driver waits at Arrivals/Baggage Claim.',

      qFoodItem:'What would you like to order?\n(e.g., Egg Rolls, Chuối Đậu Nấu Ốc)',
      qFoodQtyPre:'How many ', qFoodQtyPost:' would you like?', qFoodQtyMin:'Minimum: ',
      qFoodFulfillment:'Pickup or delivery?',
      qFoodDate:'What date would you like to pick up or receive?\n(e.g., Saturday, 4/15, "tomorrow")',
      qFoodTime:'What time? (e.g., 2pm, 2:30 PM)',
      qName:'What is your name?', qPhone:'Contact phone number?',
      qAddress:'Your delivery address?',
      qNotes:'Any special requests? (Type "none" if no)',
      qNotesShort:'Special requests?\n(Type "none" if none)',

      qAirportPickup:'✈️ Which airport are you arriving at?',
      qAirportNear:'\n(Nearest to you: ', qAirportList:'\n(LAX · SNA · ONT · BUR · SFO · SJC · OAK...)',
      qAirportDropoff:'✈️ Which airport do you need to go to?',
      qAirline:'Airline and flight number? (e.g., United 714)\nType "skip" if not available yet.',
      qAirlineShort:'Airline and flight number? (Type "skip" if not available)',
      qArrivalDate:'Arrival date? (e.g., 4/15, Friday)',
      qArrivalTime:'What time do you need the driver at the airport? (e.g., 2:30 PM, 14:30)',
      qPassengers:'How many passengers?',
      qTerminal:'Gate/Terminal? (e.g., Terminal 4, TBIT)\nType "unknown" if not sure.',
      qTerminalDrop:'Gate/Terminal to go to? (e.g., Terminal 2, TBIT)\nType "unknown" if not sure.',
      qLuggage:'How many checked bags? (Type "0" for carry-on only)',
      qDropoffAddr:'Drop-off address after the airport?',
      qDropoffAddrHint:'\n(city or specific address)',
      qPickupAddr:'Your pickup address (starting point)?',
      qCurrentLoc:'\n(Current location: ', qCurrentLocUse:' — type "here" to use)',
      qNameLead:'Lead passenger name?',

      qRidePickup:'📍 Your pickup address?',
      qRidePickupEx:'\n(City or specific address — e.g., San Jose, 1234 Main St, Orange County...)',
      qRideDropoff:'🏁 Your destination?\n(City or specific address)',
      qRideDate:'Departure date? (e.g., 4/15, Friday, tomorrow)',
      qRideTime:'Departure time? (e.g., 9:00 AM, 2:30 PM)',
      qNameSelf:'Your name?',
      qEmail:'📧 Email for booking confirmation?\n(Type "skip" if you prefer not to share)',

      qNailService:'What service would you like?\n1. Manicure\n2. Pedicure\n3. Gel Nails\n4. Acrylic\n5. Full Set\n(or Mani+Pedi, Dip Powder...)',
      qHairService:'What service would you like?\n1. Haircut\n2. Hair Color\n3. Perm / Straighten\n4. Keratin Treatment\n5. Balayage / Highlights',
      qRegion:'Which California region are you in?',
      qApptDate:'Which date would you like?', qApptTime:'What time? (e.g., 10am, 2:30pm)',
      qNailNotes:'Nail color, design, or special requests?\n(Type "none" if none)',
      qHairNotes:'Style, color preferences, or special requests?\n(Type "none" if none)',

      qTourDest:'🗺️ Where would you like to go?\n(Las Vegas · Yosemite · San Francisco · Napa · Big Sur · Grand Canyon...)',
      qTourDate:'Expected departure date?', qTourDays:'How many days is the trip?',
      qTourPassengers:'How many people in your group?',
      qTourFrom:'Where are you departing from?\n(city or address)',
      qTourLodging:'Do you need lodging assistance?',
      qTourAreaVegas:'Which area of Las Vegas would you prefer?',
      qTourAreaSF:'Which area of San Francisco would you prefer?',
      qTourArea:'Which area would you like to stay in?',
      qTourBudget:'Hotel budget per night?',
      qTourBooking:'Would you like to book hotels yourself, or have Du Lịch Cali handle it?',
      qTourContact:'Primary contact name?',
      hotelIntro:'Here are hotels matching your preferences:\n\n',

      errTimePast:      '❌ That time has already passed. Please choose a later time.',
      errAptTimeTooSoon:'❌ Airport pickups require at least 2 hours advance notice. Please choose a later time.',
      errRideTimeTooSoon:'❌ Rides require at least 1 hour advance notice. Please choose a later time.',
      errAptNotFeasible:'❌ The nearest available driver can reach the airport by {time}. Please choose {time} or later.',
      qGpsPickupFull:   '\n📍 Found your current location:\n',
      qGpsPickupUse:    '\nType "here" to use this, or enter a different address.',
      qAddrClarify:     '📍 That address needs more detail. Please provide a full street address or landmark name\n(e.g., 123 Main St San Jose, or Marriott San Jose Downtown)',
    },
    es: {
      cancelled:     'Cancelado. ¿En qué más puedo ayudarte?',
      corrUpdated:   '✅ Actualizado — ',
      corrContinue:  'Actualizado. Continuemos: ',
      reShowQ:       '\n\n¿Deseas confirmar? Escribe "sí" para reservar o "no" para editar.',
      confirmReady:  '\n\n✅ ¡Listo! ¿Deseas confirmar la reserva?',
      confirmOrEdit: '¿Confirmas o quieres hacer cambios?',
      chipOk:        '✅ Confirmar reserva', chipOkVal: 'sí',
      chipEdit:      '✏️ Editar detalles',   chipEditVal: 'no',
      priceFrom:     'Desde aproximadamente: ',

      dateDows:   ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
      dateMonths: ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'],

      fld_passengers:'Pasajeros', fld_requestedDate:'Fecha',
      fld_arrivalTime:'Hora de llegada', fld_departureTime:'Hora de salida',
      fld_requestedTime:'Hora', fld_airport:'Aeropuerto',
      fld_airline:'Vuelo', fld_customerName:'Nombre',
      fld_customerPhone:'Teléfono', fld_dropoffAddress:'Dirección de destino',
      fld_pickupAddress:'Dirección de recogida', fld_address:'Dirección de entrega',
      fld_quantity:'Cantidad', fld_serviceType:'Servicio',
      fld_days:'Días', fld_destination:'Destino',
      fld_fulfillment:'Entrega', fld_variant:'Variante', fld_lodging:'Alojamiento',

      hdFood:'📋 Resumen del pedido:', hdPickup:'📋 Resumen — recogida en aeropuerto:',
      hdDropoff:'📋 Resumen — traslado al aeropuerto:', hdRide:'📋 Resumen — viaje privado:',
      hdNail:'📋 Resumen — cita de uñas:', hdHair:'📋 Resumen — cita de peluquería:',
      hdTour:'📋 Resumen — solicitud de tour:',

      sfRestaurant:'• Restaurante: ', sfDish:'• Plato:       ', sfQty:'• Cantidad:    ',
      sfVariant:'• Variante:    ', sfFulfillment:'• Entrega:     ',
      sfDelivery:'A domicilio', sfPickupSelf:'Recogida en tienda',
      sfAddress:'• Dirección:   ', sfDate:'• Fecha:       ', sfTime:'• Hora:        ',
      sfName:'• Nombre:      ', sfPhone:'• Teléfono:    ', sfNotes:'• Notas:       ',
      sfAirport:'• Aeropuerto:    ', sfTerminal:'• Terminal:      ',
      sfFlight:'• Vuelo:         ', sfArrivalDate:'• Fecha llegada: ',
      sfArrivalTime:'• Hora de recogida:', sfPassengers:'• Pasajeros:     ',
      sfPassengersUnit:' personas', sfLuggage:'• Equipaje:      ',
      sfLuggageCarryOn:'Solo equipaje de mano', sfLuggageChecked:' maletas',
      sfDropoffAddr:'• Destino:       ', sfPickupAddr:'• Recogida en:   ',
      sfDepDate:'• Fecha vuelo:   ', sfDepTime:'• Hora salida:   ',
      sfService:'• Servicio:    ', sfRegion:'• Región:      ',
      sfDest:'• Destino:     ', sfDays:'• Días:        ', sfDaysUnit:' días',
      sfFrom:'• Salida desde:', sfLodging:'• Alojamiento: ',
      sfHotel:'  Hotel:       ', sfArea:'  Zona:        ',
      sfBudget:'  Presupuesto: ', sfBooking:'  Reserva:     ',
      sfPickupFrom:'• Recogida:    ', sfDropoffTo:'• Destino:     ',
      sfLodgeHotel:'Hotel', sfLodgeAirbnb:'Airbnb', sfLodgeNone:'Por cuenta propia',
      sfAreaStrip:'The Strip', sfAreaDT:'Downtown', sfAreaOff:'Off Strip',
      sfAreaCC:'City Center', sfAreaBeach:'Cerca de la playa', sfAreaAirport:'Cerca del aeropuerto',
      sfBudgBudget:'Económico', sfBudgMid:'Precio medio', sfBudgPrem:'Premium',
      sfModeVendor:'Du Lịch Cali gestionará la reserva', sfModeSelf:'Reserva propia',

      priceTotal:'💰 Total: $', priceEst:'💰 Estimado: ',
      priceTransport:'💰 Est. transporte: ', priceCompare:'💰 Comparación de precios (',
      priceUber:'', priceDLC:'   DuLịchCali: ~$',
      priceSave:'', priceApprox:'   ⚠️ Precio aproximado — el equipo confirmará tras la reserva.',
      driverWait:'⏱ El conductor espera en Llegadas/Recogida de equipaje.',

      qFoodItem:'¿Qué deseas pedir?\n(ej: Chả Giò, Chuối Đậu Nấu Ốc)',
      qFoodQtyPre:'¿Cuántas ', qFoodQtyPost:' deseas?', qFoodQtyMin:'Mínimo: ',
      qFoodFulfillment:'¿Recoger en tienda o entrega a domicilio?',
      qFoodDate:'¿Qué fecha deseas recoger o recibir?\n(ej: sábado, 15/4, "mañana")',
      qFoodTime:'¿A qué hora? (ej: 2pm, 14:00)',
      qName:'¿Cuál es tu nombre?', qPhone:'¿Número de teléfono de contacto?',
      qAddress:'¿Tu dirección de entrega?',
      qNotes:'¿Alguna solicitud especial? (Escribe "no" si no hay)',
      qNotesShort:'¿Solicitudes especiales?\n(Escribe "no" si no hay)',

      qAirportPickup:'✈️ ¿En qué aeropuerto llegas?',
      qAirportNear:'\n(El más cercano a ti: ', qAirportList:'\n(LAX · SNA · ONT · BUR · SFO · SJC · OAK...)',
      qAirportDropoff:'✈️ ¿A qué aeropuerto necesitas ir?',
      qAirline:'¿Aerolínea y número de vuelo? (ej: United 714)\nEscribe "omitir" si aún no lo tienes.',
      qAirlineShort:'¿Aerolínea y número de vuelo? (Escribe "omitir" si aún no lo tienes)',
      qArrivalDate:'¿Fecha de llegada? (ej: 15/4, viernes)',
      qArrivalTime:'¿A qué hora necesitas al conductor en el aeropuerto? (ej: 2:30 PM, 14:30)',
      qPassengers:'¿Cuántos pasajeros?',
      qTerminal:'¿Terminal? (ej: Terminal 4, TBIT)\nEscribe "no sé" si no estás seguro.',
      qTerminalDrop:'¿Terminal al que vas? (ej: Terminal 2, TBIT)\nEscribe "no sé" si no estás seguro.',
      qLuggage:'¿Cuántas maletas facturadas? (Escribe "0" si solo llevas equipaje de mano)',
      qDropoffAddr:'¿Dirección de destino tras el aeropuerto?',
      qDropoffAddrHint:'\n(ciudad o dirección específica)',
      qPickupAddr:'¿Tu dirección de recogida (punto de salida)?',
      qCurrentLoc:'\n(Ubicación actual: ', qCurrentLocUse:' — escribe "aquí" para usarla)',
      qNameLead:'¿Nombre del pasajero principal?',

      qRidePickup:'📍 ¿Tu dirección de recogida?',
      qRidePickupEx:'\n(Ciudad o dirección — ej: San Jose, 1234 Main St, Orange County...)',
      qRideDropoff:'🏁 ¿Tu destino?\n(Ciudad o dirección específica)',
      qRideDate:'¿Fecha de salida? (ej: 15/4, viernes, mañana)',
      qRideTime:'¿Hora de salida? (ej: 9:00 AM, 2:30 PM)',
      qNameSelf:'¿Tu nombre?',
      qEmail:'📧 ¿Email para la confirmación de reserva?\n(Escribe "omitir" si prefieres no compartirlo)',

      qNailService:'¿Qué servicio deseas?\n1. Manicure\n2. Pedicure\n3. Gel Nails\n4. Acrylic\n5. Full Set\n(o Mani+Pedi, Dip Powder...)',
      qHairService:'¿Qué servicio deseas?\n1. Corte de cabello\n2. Tinte\n3. Permanente / Alisado\n4. Tratamiento de Keratina\n5. Balayage / Reflejos',
      qRegion:'¿En qué región de California te encuentras?',
      qApptDate:'¿Qué fecha deseas?', qApptTime:'¿A qué hora? (ej: 10am, 2:30pm)',
      qNailNotes:'¿Color de uñas, diseño o solicitudes especiales?\n(Escribe "no" si no hay)',
      qHairNotes:'¿Estilo, color o solicitudes especiales?\n(Escribe "no" si no hay)',

      qTourDest:'🗺️ ¿A dónde deseas ir?\n(Las Vegas · Yosemite · San Francisco · Napa · Big Sur · Grand Canyon...)',
      qTourDate:'¿Fecha de salida prevista?', qTourDays:'¿Cuántos días dura el viaje?',
      qTourPassengers:'¿Cuántas personas hay en tu grupo?',
      qTourFrom:'¿Desde dónde sales?\n(ciudad o dirección)',
      qTourLodging:'¿Necesitas ayuda con el alojamiento?',
      qTourAreaVegas:'¿Qué zona de Las Vegas prefieres?',
      qTourAreaSF:'¿Qué zona de San Francisco prefieres?',
      qTourArea:'¿Qué zona prefieres?',
      qTourBudget:'¿Presupuesto de hotel por noche?',
      qTourBooking:'¿Deseas reservar el hotel tú mismo o prefieres que Du Lịch Cali lo gestione?',
      qTourContact:'¿Nombre del contacto principal?',
      hotelIntro:'Aquí hay hoteles que coinciden con tus preferencias:\n\n',

      errTimePast:      '❌ Esa hora ya pasó. Por favor elige una hora posterior.',
      errAptTimeTooSoon:'❌ Los traslados al aeropuerto requieren al menos 2 horas de anticipación. Elige otra hora.',
      errRideTimeTooSoon:'❌ Los viajes requieren al menos 1 hora de anticipación. Elige otra hora.',
      errAptNotFeasible:'❌ El conductor más cercano puede llegar al aeropuerto a las {time}. Por favor elige las {time} o más tarde.',
      qGpsPickupFull:   '\n📍 Encontré tu ubicación actual:\n',
      qGpsPickupUse:    '\nEscribe "aquí" para usarla, o ingresa otra dirección.',
      qAddrClarify:     '📍 Esa dirección necesita más detalle. Por favor proporciona una dirección completa\n(ej: 123 Main St San Jose, o Marriott San Jose Downtown)',
    },
  };

  // Helper: get a string in the current draft language (default vi)
  function S(key) {
    var lang = (draft && draft.lang) || 'en';
    var tbl = CONFIRM_STRINGS[lang] || CONFIRM_STRINGS.vi;
    return tbl[key] !== undefined ? tbl[key] : (CONFIRM_STRINGS.vi[key] || '');
  }

  // ── Starting-price lookup for nail / hair services ──────────────────────────
  var NAIL_PRICE_FROM = {
    'Manicure':    '$18+',
    'Pedicure':    '$28+',
    'Mani + Pedi': '$48+',
    'Gel Nails':   '$30+',
    'Acrylic':     '$40+',
    'Full Set':    '$40+',
    'Dip Powder':  '$45+',
  };
  var HAIR_PRICE_FROM = {
    'Cắt tóc':              '$18+',
    'Nhuộm tóc':            '$60+',
    'Uốn / Duỗi':           '$80+',
    'Keratin Treatment':    '$150+',
    'Balayage / Highlights':'$80+',
    'Toner / Toning':       '$40+',
  };

  // ── Field Extractors ───────────────────────────────────────────────────────

  var X = {

    quantity: function(text) {
      // "a tray" or "one tray" → 1; "2 trays" → 2
      var trayM = text.match(/(\d+)\s*tray/i);
      if (trayM) return parseInt(trayM[1]);
      if (/\btray\b/i.test(text)) return 1;
      var m = text.match(/(\d+)\s*(?:cuốn|cái|tô|phần|piece|roll|order|chiếc|serving|bowl)/i)
           || text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 1 || n > 9999) ? null : n;
    },

    foodVariant: function(text) {
      var t = text.toLowerCase();
      // Eggroll: raw vs fresh-cooked
      if (/raw|sống|chưa chiên|uncooked/.test(t)) return 'Sống (Raw)';
      if (/\bfresh\b|tươi\b/.test(t) && !/unfresh/.test(t)) return 'Tươi (Fresh)';
      if (/fried|chiên|chín|cooked|sẵn/.test(t)) return 'Chiên Sẵn (Fried)';
      // Bún Chả variants
      if (/lá\s*lốt|la\s*lot|lolot|betel|leaf/.test(t)) return 'Chả Lá Lốt';
      if (/chả\s*viên|cha\s*vien|patties|patty|\bviên\b/.test(t)) return 'Chả Viên';
      // Phở variants
      if (/tái.*viên|rare.*meatball|viên.*tái|meatball.*rare/.test(t)) return 'Tái + Bò Viên';
      if (/\btái\b|rare\s*beef|\btai\b/.test(t)) return 'Tái';
      return null;
    },

    fulfillment: function(text) {
      var t = text.toLowerCase();
      if (/pickup|tự lấy|\blấy\b|pick.?up|đến lấy/.test(t)) return 'pickup';
      if (/delivery|giao|ship|mang.?đến|giao.?hàng/.test(t)) return 'delivery';
      return null;
    },

    date: function(text) {
      var today = new Date();
      var t = text.toLowerCase();

      if (/hôm nay|today/.test(t)) return AIEngine.localISODate(today);
      if (/ngày mai|tomorrow/.test(t)) {
        var tm = new Date(today); tm.setDate(tm.getDate() + 1);
        return AIEngine.localISODate(tm);
      }

      var DOW_VI = ['chủ nhật','thứ hai','thứ ba','thứ tư','thứ năm','thứ sáu','thứ bảy'];
      var DOW_EN = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      var DOW_SH = ['sun','mon','tue','wed','thu','fri','sat'];
      for (var i = 0; i < 7; i++) {
        if (t.indexOf(DOW_VI[i]) !== -1 || t.indexOf(DOW_EN[i]) !== -1 ||
            new RegExp('\\b' + DOW_SH[i] + '\\b').test(t)) {
          var dd = new Date(today);
          var diff = i - dd.getDay();
          if (diff <= 0) diff += 7;
          dd.setDate(dd.getDate() + diff);
          return AIEngine.localISODate(dd);
        }
      }

      // M/D — parse at local noon to avoid UTC-midnight off-by-one
      var m = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
      if (m) {
        var yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : today.getFullYear();
        var d2 = new Date(yr + '-' + pad(m[1]) + '-' + pad(m[2]) + 'T12:00:00');
        if (!isNaN(d2)) return AIEngine.localISODate(d2);
      }

      // "April 10" — parse at local noon to avoid UTC-midnight off-by-one
      var MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
        january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
      var m2 = text.match(/([a-zA-Z]+)\s+(\d{1,2})/i) || text.match(/(\d{1,2})\s+([a-zA-Z]+)/i);
      if (m2) {
        var word = m2[1].toLowerCase(), num = parseInt(m2[2]);
        var word2 = m2[2] ? m2[2].toLowerCase() : '', num2 = parseInt(m2[1]);
        var mo = MONTHS[word] || MONTHS[word2];
        var dy = MONTHS[word] ? num : (MONTHS[word2] ? num2 : null);
        if (mo && dy) {
          var d3 = new Date(today.getFullYear() + '-' + pad(mo) + '-' + pad(dy) + 'T12:00:00');
          if (!isNaN(d3)) return AIEngine.localISODate(d3);
        }
      }
      return null;
    },

    time: function(text) {
      var m = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      if (m) {
        var h = parseInt(m[1]), min = parseInt(m[2]);
        var p = (m[3] || '').toLowerCase();
        if (p === 'pm' && h < 12) h += 12;
        if (p === 'am' && h === 12) h = 0;
        if (h > 23 || min > 59) return null;
        return pad(h) + ':' + pad(min);
      }
      m = text.match(/(\d{1,2})\s*(?:h|g|giờ)?\s*(am|pm|sáng|chiều|tối|sa|ch)\b/i);
      if (m) {
        var h2 = parseInt(m[1]);
        var p2 = (m[2] || '').toLowerCase();
        if (/pm|chiều|tối|ch/.test(p2) && h2 < 12) h2 += 12;
        if (/am|sáng|sa/.test(p2) && h2 === 12) h2 = 0;
        if (h2 < 0 || h2 > 23) return null;
        return pad(h2) + ':00';
      }
      // bare number like "3" treated as hour — only if 1-12
      m = text.match(/^(\d{1,2})(?:\s*(?:h|g|giờ))?$/);
      if (m) {
        var h3 = parseInt(m[1]);
        if (h3 >= 1 && h3 <= 12) return pad(h3) + ':00';
      }
      return null;
    },

    phone: function(text) {
      var m = text.match(/\+?1?\s*\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
      if (!m) return null;
      var digits = m[0].replace(/\D/g,'').replace(/^1/,'');
      return digits.length === 10 ? digits : null;
    },

    name: function(text) {
      var clean = text.trim()
        .replace(/^(tôi là|tên tôi là|my name is|i am|i'm|name:|tên:)\s+/i, '').trim();
      if (clean.length < 2 || clean.length > 50) return null;
      if (/\d/.test(clean)) return null;
      if (clean.split(/\s+/).length > 6) return null;
      // Exclude bare airport codes (all-caps 2-4 letters: SFO, LAX, etc.)
      if (/^[A-Z]{2,4}$/.test(clean)) return null;
      return clean;
    },

    address: function(text) {
      var clean = text.trim();
      if (clean.length < 4) return null;
      if (/\d/.test(clean)) return clean;
      if (/\b(st|ave|blvd|dr|ln|way|ct|rd|đường|số)\b/i.test(clean)) return clean;
      if (clean.length >= 4) return clean;
      return null;
    },

    airport: function(text) {
      var t = text.toUpperCase();
      if (/\bLAX\b|LOS ANGELES INT/i.test(t)) return 'LAX';
      if (/\bSNA\b|JOHN WAYNE|ORANGE COUNTY/i.test(t)) return 'SNA';
      if (/\bONT\b|ONTARIO/i.test(t)) return 'ONT';
      if (/\bSFO\b|SAN FRANCISCO INT/i.test(t)) return 'SFO';
      if (/\bSJC\b|SAN JOSE INT/i.test(t)) return 'SJC';
      if (/\bOAK\b|OAKLAND/i.test(t)) return 'OAK';
      if (/\bBUR\b|BURBANK|BOB HOPE/i.test(t)) return 'BUR';
      if (/\bLGB\b|LONG BEACH/i.test(t)) return 'LGB';
      if (/\bPSP\b|PALM SPRINGS/i.test(t)) return 'PSP';
      if (/\bSAN\b|SAN DIEGO INT/i.test(t)) return 'SAN';
      if (/\bSMF\b|SACRAMENTO/i.test(t)) return 'SMF';
      return null;
    },

    passengers: function(text) {
      var m = text.match(/(\d+)\s*(?:người|people|pax|passenger|person|khách|guest)/i)
           || text.match(/nhóm\s*(\d+)/i)
           || text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 1 || n > 30) ? null : n;
    },

    days: function(text) {
      var m = text.match(/(\d+)\s*(?:ngày|day|night|đêm)/i) || text.match(/^(\d+)$/);
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 1 || n > 30) ? null : n;
    },

    yesNo: function(text) {
      var t = text.trim().toLowerCase();
      if (/^(yes|yeah|yep|ok|okay|xác nhận|đồng ý|có\b|ừ|đúng|correct|right|confirm|sure|được)/.test(t)) return true;
      if (/^(no|nope|không\b|chưa|cancel|hủy|sai|wrong|change|thay đổi|sửa)/.test(t)) return false;
      return null;
    },

    foodItem: function(text) {
      // Dynamic: read from live MARKETPLACE data so prices/items stay in sync
      var t = text.toLowerCase();
      var businesses = (window.MARKETPLACE && window.MARKETPLACE.businesses) ? window.MARKETPLACE.businesses : [];
      var foodVendors = businesses.filter(function(b) {
        return b.vendorType === 'foodvendor' && b.active !== false;
      });
      for (var e = 0; e < foodVendors.length; e++) {
        var biz = foodVendors[e];
        var products = (biz.products || []).filter(function(p) { return p.active !== false; });
        for (var i = 0; i < products.length; i++) {
          var p = products[i];
          var terms = [
            (p.name || '').toLowerCase(),
            (p.nameEn || '').toLowerCase(),
            (p.displayNameVi || '').toLowerCase(),
            (p.id || '').replace(/-/g, ' '),
          ];
          var matched = terms.some(function(term) {
            if (!term) return false;
            if (t.includes(term)) return true;
            // Require at least 2 significant words to all match (avoids false positives)
            var words = term.split(/\s+/).filter(function(w) { return w.length >= 4; });
            return words.length >= 2 && words.every(function(w) { return t.includes(w); });
          });
          if (!matched) continue;
          // Build variant info from live data
          var pricedV = (p.variants || []).filter(function(v) {
            return v && typeof v === 'object' && v.price != null && Number(v.price) > 0;
          });
          var labelledV = (p.variants || []).filter(function(v) {
            return v && typeof v === 'object' && (v.label || v.labelEn);
          });
          var hasVariant = pricedV.length > 0 || labelledV.length > 0;
          var variantOpts = pricedV.length > 0
            ? pricedV.map(function(v) { return (v.labelEn || v.label) + ' ($' + Number(v.price).toFixed(2) + ')'; }).join(' hoặc ')
            : labelledV.map(function(v) { return v.labelEn || v.label; }).filter(Boolean).join(' hoặc ');
          return {
            id:              p.id,
            name:            p.name || p.nameEn || '',
            nameEn:          p.nameEn || '',
            price:           Number(p.pricePerUnit || 0),
            unit:            p.unit || 'phần',
            unitEn:          p.unitEn || 'serving',
            minOrder:        Number(p.minimumOrderQty || 1),
            vendorId:        biz.id,
            vendorName:      biz.name,
            hasVariant:      hasVariant,
            variantOptions:  variantOpts,
            variantQuestion: hasVariant
              ? 'Bạn muốn loại nào?\n• ' + variantOpts.replace(' hoặc ', '\n• ')
              : null,
          };
        }
      }
      return null;
    },

    nailService: function(text) {
      var t = text.toLowerCase();
      if (/^1$|manicure|móng tay|\bmani\b/.test(t)) return 'Manicure';
      if (/^2$|pedicure|móng chân|\bpedi\b/.test(t)) return 'Pedicure';
      if (/mani.?pedi/.test(t)) return 'Mani + Pedi';
      if (/^3$|\bgel\b/.test(t)) return 'Gel Nails';
      if (/^4$|acrylic/.test(t)) return 'Acrylic';
      if (/^5$|full.?set|bộ móng/.test(t)) return 'Full Set';
      if (/dip|powder/.test(t)) return 'Dip Powder';
      return null;
    },

    hairService: function(text) {
      var t = text.toLowerCase();
      if (/^1$|cắt|\bhaircut\b|\bcut\b/.test(t)) return 'Cắt tóc';
      if (/^2$|nhuộm|\bcolor\b|colour/.test(t)) return 'Nhuộm tóc';
      if (/^3$|uốn|duỗi|\bperm\b|straighten/.test(t)) return 'Uốn / Duỗi';
      if (/^4$|keratin/.test(t)) return 'Keratin Treatment';
      if (/^5$|balayage|highlight/.test(t)) return 'Balayage / Highlights';
      if (/toner|toning/.test(t)) return 'Toner / Toning';
      return null;
    },

    destination: function(text) {
      var t = text.toLowerCase();
      if (/yosemite/.test(t)) return { id:'yosemite', name:'Yosemite National Park' };
      if (/\bvegas\b|las vegas/.test(t)) return { id:'lasvegas', name:'Las Vegas' };
      if (/san francisco|sf\b|frisco|golden gate|cầu vàng/.test(t)) return { id:'sanfrancisco', name:'San Francisco' };
      if (/napa valley|\bnapa\b/.test(t)) return { id:'napa', name:'Napa Valley' };
      if (/big sur/.test(t)) return { id:'bigsur', name:'Big Sur' };
      if (/monterey/.test(t)) return { id:'monterey', name:'Monterey' };
      if (/santa barbara/.test(t)) return { id:'santabarbara', name:'Santa Barbara' };
      if (/palm springs/.test(t)) return { id:'palmsprings', name:'Palm Springs' };
      if (/joshua tree/.test(t)) return { id:'joshuatree', name:'Joshua Tree' };
      if (/grand canyon/.test(t)) return { id:'grandcanyon', name:'Grand Canyon' };
      if (/san diego/.test(t)) return { id:'sandiego', name:'San Diego' };
      if (/los angeles|\bla\b/.test(t)) return { id:'losangeles', name:'Los Angeles' };
      if (/17.?mile|pebble beach/.test(t)) return { id:'17mile', name:'17-Mile Drive' };
      if (/\bsolvang\b/.test(t)) return { id:'solvang', name:'Solvang' };
      if (/sequoia|kings canyon/.test(t)) return { id:'sequoia', name:'Sequoia / Kings Canyon' };
      if (/disneyland/.test(t)) return { id:'disneyland', name:'Disneyland' };
      return null;
    },

    lodging: function(text) {
      var t = text.toLowerCase();
      if (/\b(không cần|tự túc|none|no lodging|self.?book|tôi tự đặt)\b/.test(t)) return 'none';
      if (/^(không|no)$/i.test(t.trim())) return 'none';
      if (/\b(airbnb|nhà thuê|house rental|home rental|thuê nhà)\b/.test(t)) return 'airbnb';
      // Strip / casino / resort → hotel
      if (/\b(strip|the strip|on the strip|vegas strip|casino|resort)\b/.test(t)) return 'hotel';
      if (/\b(hotel|khách sạn|motel|lodge|inn|hostel)\b/.test(t)) return 'hotel';
      if (/\b(4[\s-]?star|5[\s-]?star|four[\s-]?star|five[\s-]?star|luxury|sang trọng|cao cấp|budget hotel)\b/.test(t)) return 'hotel';
      if (/\b(cần\b|need|muốn|có\b|yes\b|chỗ ở|chỗ ngủ|overnight|stay)\b/.test(t)) return 'hotel';
      return null;
    },

    hotelArea: function(text) {
      var t = text.toLowerCase();
      if (/\b(strip|the strip|on the strip|vegas strip|mid.?strip|south.?strip|north.?strip)\b/.test(t)) return 'strip';
      if (/\b(downtown|fremont|fremont street|old vegas)\b/.test(t)) return 'downtown';
      if (/\b(off.?strip|off the strip|henderson|summerlin)\b/.test(t)) return 'off_strip';
      if (/\b(near airport|airport area)\b/.test(t)) return 'airport';
      if (/\b(city center|union square|trung tâm|fisherman|wharf|pier)\b/.test(t)) return 'city_center';
      if (/\b(beach|biển|waterfront)\b/.test(t)) return 'beach';
      return null;
    },

    hotelBudget: function(text) {
      var t = text.toLowerCase();
      if (/\b(budget|cheap|affordable|rẻ|tiết kiệm|economy|value)\b/.test(t)) return 'budget';
      if (/\b(luxury|5[\s-]?star|five[\s-]?star|upscale|premium|sang trọng|cao cấp|vip)\b/.test(t)) return 'premium';
      if (/\b(mid.?range|moderate|trung bình|4[\s-]?star|four[\s-]?star|reasonable|decent|standard)\b/.test(t)) return 'midrange';
      var nums = (text.match(/\$\s*(\d+)/g)||[]).map(function(s){return parseInt(s.replace(/\D/g,''));});
      if (nums.length) {
        var avg = nums.reduce(function(a,b){return a+b;},0)/nums.length;
        return avg < 110 ? 'budget' : avg < 220 ? 'midrange' : 'premium';
      }
      return null;
    },

    bookingMode: function(text) {
      var t = text.toLowerCase();
      if (/\b(tự|myself|self|tôi tự|tự đặt|tự lo|book myself|tôi sẽ đặt)\b/.test(t)) return 'self';
      if (/\b(vendor|giúp|lo cho|handle|nhờ|book for me|du lịch cali lo|các bạn lo|hộ tôi)\b/.test(t)) return 'vendor';
      if (/\b(tôi chọn|chọn|i want|i choose|muốn ở)\b/.test(t)) return 'vendor';
      return null;
    },

    luggage: function(text) {
      var t = text.trim().toLowerCase();
      if (/^(0|không có|none|no|xách tay|không)$/.test(t)) return 0;
      var m = text.match(/(\d+)\s*(?:kiện|bag|bags|suitcase|vali|piece|chiếc)/i);
      // Do NOT match bare numbers — a user saying "12" likely means passengers, not luggage
      var n = m ? parseInt(m[1]) : NaN;
      return (isNaN(n) || n < 0 || n > 50) ? null : n;
    },

    terminal: function(text) {
      var t = text.trim();
      if (/không biết|bỏ qua|skip|chưa biết|chưa|không nhớ/i.test(t)) return '';
      if (/TBIT|Tom Bradley|international terminal/i.test(t)) return 'TBIT (Tom Bradley Intl)';
      var m = t.match(/\b(?:terminal|cổng|T)\s*([1-9][0-9]?|[A-E])\b/i);
      if (m) return 'Terminal ' + m[1].toUpperCase();
      if (/^T?[1-9][A-Z]?$/i.test(t)) return 'Terminal ' + t.toUpperCase().replace(/^T/, '');
      return null;
    },

    region: function(text) {
      var t = text.toLowerCase();
      if (/bay area|san jose|sjc|san francisco|sfo|oakland|fremont|santa clara|sunnyvale|milpitas|cupertino|palo alto/.test(t)) return 'Bay Area';
      if (/orange county|\boc\b|anaheim|irvine|garden grove|santa ana|westminster|fountain valley|los angeles|\bla\b|san diego|socal|southern/.test(t)) return 'Southern CA';
      if (/^1$/.test(t.trim())) return 'Bay Area';
      if (/^2$/.test(t.trim())) return 'Southern CA';
      return null;
    },
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // ── Correction Detection ───────────────────────────────────────────────────
  // Returns true when the message looks like the user is correcting a
  // previously supplied value rather than answering a new question.
  function isCorrectionText(text) {
    return /thay đổi|sửa lại|sửa thành|đổi thành|đổi lại|nhầm|lầm rồi|thực ra|actually|wait,?\s|change.*to|no[,.\s]|không phải|không là|là \d+ người|đổi.*người|đổi.*ngày|update|not \d|lại \d|nhóm \d+ người/i
           .test(text);
  }

  // ── Field label map (for correction acknowledgements) — uses S() for i18n ──
  function fmtFieldLabel(key) {
    return S('fld_' + key) || key;
  }

  function fmtFieldVal(key, val) {
    if (val === null || val === undefined) return '—';
    if (key === 'requestedDate') return fmtDate(val);
    if (key === 'arrivalTime' || key === 'requestedTime' || key === 'departureTime') return fmtTime(val);
    if (typeof val === 'object' && val.name) return val.name;
    return String(val);
  }

  // ── Hotel Suggestion Data ──────────────────────────────────────────────────

  var HOTEL_SUGGESTIONS = {
    lasvegas: {
      strip: [
        { name:'Bellagio',          area:'Mid Strip',   budgetTier:'premium',  stars:5, priceFrom:180, priceTo:380, highlight:'Đài phun nước huyền thoại, sòng bạc sang trọng' },
        { name:'The Cosmopolitan',  area:'Mid Strip',   budgetTier:'premium',  stars:5, priceFrom:160, priceTo:350, highlight:'Thiết kế hiện đại, nhà hàng nổi tiếng' },
        { name:'MGM Grand',         area:'South Strip', budgetTier:'midrange', stars:4, priceFrom:90,  priceTo:220, highlight:'Casino lớn nhất Mỹ, đa dạng nhà hàng & show' },
        { name:'Paris Las Vegas',   area:'Mid Strip',   budgetTier:'midrange', stars:4, priceFrom:80,  priceTo:195, highlight:'Tháp Eiffel thu nhỏ, view The Strip đẹp' },
        { name:'New York-New York', area:'South Strip', budgetTier:'midrange', stars:4, priceFrom:70,  priceTo:165, highlight:'Roller coaster, nhiều show, không khí sôi động' },
        { name:'Excalibur Hotel',   area:'South Strip', budgetTier:'budget',   stars:3, priceFrom:45,  priceTo:120, highlight:'Thân thiện gia đình, vị trí tốt trên Strip' },
        { name:'Luxor Las Vegas',   area:'South Strip', budgetTier:'budget',   stars:3, priceFrom:50,  priceTo:130, highlight:'Thiết kế kim tự tháp độc đáo, giá hợp lý' },
      ],
      downtown: [
        { name:'Golden Nugget',     area:'Fremont St',  budgetTier:'midrange', stars:4, priceFrom:60,  priceTo:150, highlight:'Khách sạn nổi tiếng nhất Downtown Las Vegas' },
      ],
      off_strip: [
        { name:'Red Rock Casino Resort', area:'Summerlin', budgetTier:'midrange', stars:4, priceFrom:70, priceTo:160, highlight:'Gần Red Rock Canyon, yên tĩnh hơn Strip' },
      ],
    },
    sanfrancisco: {
      city_center: [
        { name:'Hotel Nikko SF',         area:'Union Square', budgetTier:'midrange', stars:4, priceFrom:140, priceTo:280, highlight:'Trung tâm thành phố, gần cửa hàng' },
        { name:'Marriott Union Square',  area:'Union Square', budgetTier:'premium',  stars:4, priceFrom:200, priceTo:400, highlight:'Gần cửa hàng, nhà hàng, giao thông thuận tiện' },
      ],
      beach: [
        { name:"Hyatt Fisherman's Wharf", area:"Fisherman's Wharf", budgetTier:'midrange', stars:4, priceFrom:160, priceTo:320, highlight:"Gần Fisherman's Wharf và Ghirardelli Square" },
      ],
    },
    yosemite: {
      city_center: [
        { name:'Yosemite Valley Lodge', area:'Yosemite Valley', budgetTier:'midrange', stars:3, priceFrom:180, priceTo:325, highlight:'Ngay trong công viên, gần Yosemite Falls' },
        { name:'Tenaya Lodge',          area:'Fish Camp',       budgetTier:'premium',  stars:4, priceFrom:220, priceTo:450, highlight:'Resort cao cấp, gần lối vào phía Nam' },
      ],
    },
    grandcanyon: {
      city_center: [
        { name:'El Tovar Hotel',        area:'South Rim',       budgetTier:'premium',  stars:4, priceFrom:200, priceTo:350, highlight:'Khách sạn lịch sử ngay tại vành miệng' },
        { name:'Bright Angel Lodge',    area:'South Rim',       budgetTier:'budget',   stars:3, priceFrom:80,  priceTo:160, highlight:'Cạnh bờ vực, hướng tới đoàn hiking' },
      ],
    },
  };

  function getHotelSuggestions(destId, area, budgetTier) {
    var dest = destId && HOTEL_SUGGESTIONS[destId];
    if (!dest) return [];
    var hotels = [];
    if (area && dest[area]) {
      hotels = dest[area].slice();
    } else {
      var keys = Object.keys(dest);
      for (var i = 0; i < keys.length; i++) hotels = hotels.concat(dest[keys[i]]);
    }
    if (budgetTier) {
      var filtered = hotels.filter(function(h){ return h.budgetTier === budgetTier; });
      if (filtered.length > 0) hotels = filtered;
    }
    return hotels.slice(0, 5);
  }

  // ── Rough estimate helpers ─────────────────────────────────────────────────

  // Max service radius for airport and private-ride bookings (miles)
  var MAX_SERVICE_MILES = 120;
  // Bay Area airports fallback (used when _activeDrivers not yet loaded)
  var BAY_AREA_AIRPORTS = { SFO: true, OAK: true, SJC: true, SMF: true };
  // Airport code → DLC region ID (matches drivers[].regions array values)
  var AIRPORT_REGION = {
    SFO: 'bayarea', OAK: 'bayarea', SJC: 'bayarea', SMF: 'bayarea',
    LAX: 'socal',   SNA: 'socal',   BUR: 'socal',   LGB: 'socal',   ONT: 'socal',
    SAN: 'sandiego', PSP: 'palmsprings',
  };

  /**
   * Detect which fleet region a tour pickup address belongs to.
   * Uses live DLCRegion config (airport codes + keywords) — no hardcoded lists.
   *
   * Priority:
   *  1. Airport code match against DLCRegion.all[rid].airports  → rid
   *  2. DLCRegion keyword/city detection                        → region.id
   *  3. Default                                                 → 'oc'
   */
  function _detectTourRegion(startingPoint) {
    if (!startingPoint) return 'oc';
    var t = startingPoint;
    // Check each region's airport codes from live config
    if (window.DLCRegion && window.DLCRegion.all) {
      var allRegions = window.DLCRegion.all;
      for (var rid in allRegions) {
        var airports = allRegions[rid].airports || [];
        if (airports.some(function(code) {
          return new RegExp('\\b' + code + '\\b', 'i').test(t);
        })) return rid;
      }
    }
    // Keyword/city-based detection (includes airport common names from regions.js keywords)
    var region = (window.DLCRegion) ? window.DLCRegion.detectFromText(t) : null;
    return region ? region.id : 'oc';
  }

  /**
   * Returns the best vehicle name for a tour in the given region.
   * Uses live Firestore driver data (window._activeDrivers) when available;
   * falls back to DLCRegion.all[regionId].vehicle.name config.
   */
  function _getTourVehicleForRegion(regionId) {
    var drivers = _driversForRegion(regionId);
    if (drivers.length) {
      // Pick the driver with the most seats — largest vehicle for tour groups
      var best = drivers.reduce(function(a, b) {
        var sa = (a.vehicle && a.vehicle.seats) ? parseInt(a.vehicle.seats) : 0;
        var sb = (b.vehicle && b.vehicle.seats) ? parseInt(b.vehicle.seats) : 0;
        return sb > sa ? b : a;
      });
      if (best.vehicle && best.vehicle.make) {
        return [best.vehicle.make, best.vehicle.model].filter(Boolean).join(' ');
      }
    }
    // Fall back to region config when no driver data is loaded
    if (window.DLCRegion && window.DLCRegion.all && window.DLCRegion.all[regionId]) {
      var cfg = window.DLCRegion.all[regionId].vehicle;
      if (cfg && cfg.name) return cfg.name;
    }
    return null;
  }

  // Returns active+compliant drivers for the given region from window._activeDrivers
  function _driversForRegion(regionId) {
    if (!regionId) return [];
    var pool = window._activeDrivers || [];
    return pool.filter(function(d) {
      return d.complianceStatus === 'approved' &&
             (d.regions || []).indexOf(regionId) >= 0;
    });
  }

  // Returns capacity warning string for a given airport + passenger count, or null if OK
  function _capacityWarning(airport, pax) {
    var paxN = parseInt(pax) || 0;
    if (!paxN) return null;
    var regionId  = AIRPORT_REGION[airport] || null;
    var drivers   = _driversForRegion(regionId);
    if (drivers.length > 0) {
      // Real data: find max seats across region drivers
      var maxSeats = 0;
      drivers.forEach(function(d) {
        var s = d.vehicle && d.vehicle.seats ? parseInt(d.vehicle.seats) : 0;
        if (s > maxSeats) maxSeats = s;
      });
      if (paxN > maxSeats) {
        return '\n⚠️ ' + paxN + ' passengers exceeds the largest available vehicle (' + maxSeats + ' seats) — team will arrange multiple vehicles.';
      }
      return null; // at least one driver can handle it
    }
    // Fallback when driver data not loaded yet: use regional heuristic
    var fallbackMax = BAY_AREA_AIRPORTS[airport] ? 7 : 12;
    if (paxN > fallbackMax) {
      return '\n⚠️ ' + paxN + ' passengers — team will confirm vehicle availability before dispatch.';
    }
    return null;
  }
  // Deadhead rate: driver drives empty to/from airport; charged at $0.80/mile (fuel + time)
  var DEADHEAD_PER_MILE = 0.80;

  // Vague-address guard: single-word/phrase inputs that are not real addresses.
  // Any extract() for pickup/dropoff that matches this returns null → re-ask.
  var VAGUE_ADDR_RE = /^(home|my home|my house|house|my place|nhà|nhà tôi|nhà của tôi|mi casa|casa|work|my work|office|my office|there|chỗ đó|this place|chỗ này|destination|điểm đến|nơi đến|nearby|near there|somewhere|over there|đó|đây|a hotel|the hotel|the place|chỗ nào đó)$/i;

  // Soft-vague guard: partial/generic place names that cannot be navigated to without
  // more specificity (hotel names without address, "near X", "X area"). Only fires
  // when the input contains NO digits (real addresses almost always have a street number).
  var VAGUE_ADDR_SOFT_RE = /^(near\s+\S.{0,40}|the\s+[a-z]+\s*$|around\s+\S.{0,40}|somewhere\s+in\s+\S.{0,30}|\w+\s+area\s*$|\w+\s+vicinity\s*$|close\s+to\s+\S.{0,30}|gần\s+\S.{0,30}|khu\s+vực\s+\S.{0,30}|cerca\s+de\s+\S.{0,30})$/i;

  // Single-word California/Nevada/major-US city names that are valid standalone navigation targets.
  // A single-word input NOT in this list is treated as a potential business/landmark name
  // that needs city or street context before a driver can navigate to it.
  var KNOWN_SINGLE_WORD_CITIES_RE = /^(anaheim|irvine|fullerton|torrance|compton|pasadena|burbank|glendale|inglewood|gardena|hawthorne|lakewood|cerritos|norwalk|downey|pomona|ontario|riverside|corona|fontana|upland|claremont|temecula|murrieta|escondido|carlsbad|oceanside|encinitas|coronado|malibu|calabasas|oxnard|ventura|tustin|orange|placentia|brea|westminster|stanton|cypress|huntington|newport|rosemead|covina|azusa|glendora|duarte|arcadia|monrovia|alhambra|whittier|montebello|paramount|lynwood|bellflower|artesia|lawndale|wilmington|carson|victorville|hesperia|highland|redlands|yucaipa|banning|beaumont|hemet|perris|menifee|norco|chino|montclair|walnut|irwindale|yorba|bakersfield|delano|wasco|shafter|taft|arvin|tehachapi|mojave|lancaster|palmdale|fresno|clovis|selma|sanger|reedley|kingsburg|hanford|lemoore|tulare|porterville|visalia|stockton|lodi|manteca|tracy|turlock|modesto|ceres|merced|atwater|vacaville|fairfield|vallejo|napa|petaluma|hayward|fremont|milpitas|sunnyvale|cupertino|campbell|saratoga|alameda|berkeley|richmond|concord|antioch|livermore|pleasanton|dublin|monterey|salinas|gilroy|hollister|watsonville|capitola|aptos|eureka|arcata|ukiah|chico|redding|oroville|auburn|truckee|tahoe|reno|henderson|sparks|phoenix|scottsdale|tempe|mesa|chandler|gilbert|peoria|seattle|tacoma|bellevue|redmond|kirkland|portland|beaverton|hillsboro|denver|aurora|chicago|dallas|irving|plano|frisco|garland|miami|hialeah|honolulu|kailua|kaneohe|sacramento|roseville|folsom|oxnard|chatsworth|reseda|tarzana|encino|northridge|moorpark|camarillo|ojai|solvang|lompoc|goleta|carpinteria|paramount|compton|gardena|lawndale|hawthorne|inglewood|redondo|hermosa|manhattan|torrance|carson|culver|burbank|glendale|monrovia)$/i;

  // Returns true for single-token inputs (no spaces, no comma, no digit, 4–30 chars) that are
  // NOT recognised standalone city names → likely a business/landmark needing city context.
  function _isAmbiguousAddr(s) {
    if (!s || /\d/.test(s) || /,/.test(s) || /\s/.test(s)) return false;
    if (s.length < 4 || s.length > 30) return false;
    return !KNOWN_SINGLE_WORD_CITIES_RE.test(s);
  }

  // Returns a language-appropriate clarification question for an ambiguous place name.
  function _addrClarifyQuestion(name) {
    var lang = (draft && draft.lang) || 'en';
    if (lang === 'vi') {
      return '"' + name + '" ở đâu? Vui lòng thêm tên thành phố hoặc địa chỉ đầy đủ\n(ví dụ: "' + name + ', San Jose, CA" hoặc số nhà + đường phố)';
    }
    if (lang === 'es') {
      return '¿Dónde está "' + name + '"? Por favor añade la ciudad o dirección completa\n(p.ej. "' + name + ', San Jose, CA" o una dirección de calle)';
    }
    return 'Where is "' + name + '" located? Please add the city or full street address\n(e.g. "' + name + ', San Jose, CA" or "1350 Main St, Milpitas, CA")';
  }

  // Maps airport codes to their city name for use with estimateCityToCity
  var AIRPORT_CITY = {
    'lax': 'Los Angeles',   'sna': 'Orange County',  'lgb': 'Long Beach',
    'ont': 'Ontario',       'bur': 'Burbank',         'sfo': 'San Francisco',
    'oak': 'Oakland',       'sjc': 'San Jose',        'smf': 'Sacramento',
    'san': 'San Diego',     'las': 'Las Vegas',       'pdx': 'Portland',
    'sea': 'Seattle',       'phx': 'Phoenix',         'den': 'Denver',
    'jfk': 'New York',      'ord': 'Chicago',         'dfw': 'Dallas',
  };

  // Extract just the city name from a full address for distance lookup
  function _cityFromAddress(addr) {
    if (!addr) return null;
    // "123 Main St, San Jose, CA 95121" → "San Jose"
    var m = addr.match(/,\s*([^,\d][^,]+?),?\s*(?:CA|California)?\s*\d{0,5}\s*$/i);
    if (m) return m[1].trim();
    // "San Jose, CA" or plain city name
    var m2 = addr.match(/^([^,]+?)(?:,\s*[A-Z]{2})?$/i);
    if (m2) return m2[1].trim();
    return addr;
  }

  function estimateTransfer(passengers, airport, destAddress) {
    if (!passengers) return null;
    if (typeof DLCPricing !== 'undefined') {
      // If we have an actual destination address, use city-to-city routing for accuracy
      if (destAddress && DLCPricing.estimateCityToCity) {
        var airportCode = (airport || '').toLowerCase().trim();
        var airportCity = AIRPORT_CITY[airportCode] || 'Los Angeles';
        var destCity = _cityFromAddress(destAddress);
        var r2 = DLCPricing.estimateCityToCity({ from: airportCity, to: destCity, passengers: passengers });
        if (r2 && r2.total) {
          // Add 2-way deadhead: driver's empty drive from customer's area → airport (and back)
          // Deadhead miles ≈ distance from customer's location to the airport
          var deadheadMiles = 0;
          if (window.DLCLocation && typeof DLCLocation.distanceToAirportMiles === 'function') {
            deadheadMiles = DLCLocation.distanceToAirportMiles(airport) || 0;
          }
          var deadheadCost = Math.round(deadheadMiles * DEADHEAD_PER_MILE);
          var total = r2.total + deadheadCost;
          return '~$' + total + ' (' + r2.vehicle + ')';
        }
      }
      // Fallback: OC-distance-based estimate (only accurate for SoCal trips)
      if (DLCPricing.estimateTransfer) {
        var r = DLCPricing.estimateTransfer({ airport: airport||'LAX', fromCity: 'Orange County', passengers: passengers, direction: 'pickup' });
        if (r) return '~$' + r.total + ' (' + r.vehicle + ')';
      }
    }
    var base = passengers <= 4 ? 65 : passengers <= 7 ? 85 : 110;
    return '~$' + base + '–$' + (base + 25) + ' (ước tính sơ bộ)';
  }

  function estimateTour(passengers, days, destId, regionId) {
    if (!passengers || !days) return null;
    if (typeof DLCPricing !== 'undefined' && DLCPricing.estimateTour) {
      var vehicleOverride = _getTourVehicleForRegion(regionId);
      var r = DLCPricing.estimateTour({ destId: destId||'lasvegas', passengers: passengers, days: days, lodging: null, regionId: regionId||null, vehicleOverride: vehicleOverride||null });
      return r ? '~$' + r.total + ' (~$' + r.perPerson + '/người · ' + r.vehicle + ')' : null;
    }
    return null;
  }

  // Returns pricing for a private ride (A→B), including 2-way deadhead cost
  function estimateRide(passengers, fromAddr, toAddr) {
    var p = Math.max(1, passengers || 2);
    if (typeof DLCPricing !== 'undefined') {
      // Use city-to-city routing for accuracy
      var fromCity = _cityFromAddress(fromAddr) || fromAddr || '';
      var toCity   = _cityFromAddress(toAddr)   || toAddr   || '';
      var r = null;
      if (DLCPricing.estimateCityToCity && fromCity && toCity) {
        r = DLCPricing.estimateCityToCity({ from: fromCity, to: toCity, passengers: p });
      }
      if (!r) {
        // Fallback to OC-distance-based lookup
        var rf = DLCPricing.estimateTransfer({ fromCity: fromCity, airport: toCity, passengers: p, direction: 'dropoff' });
        if (rf && rf.miles) r = { miles: rf.miles, total: rf.total, vehicle: rf.vehicle };
      }
      if (r && r.miles) {
        var cmp = DLCPricing.transferCostWithComparison(r.miles, p);
        // 2-way deadhead: driver returns empty after dropoff (≈ same distance as main trip)
        var deadheadCost = Math.round(r.miles * DEADHEAD_PER_MILE);
        return {
          ourPrice:     (cmp ? cmp.ourPrice : r.total) + deadheadCost,
          uberEst:      cmp ? cmp.uberEstimate : Math.round((r.total || 0) / 0.8),
          savings:      cmp ? (cmp.uberEstimate - ((cmp.ourPrice || 0) + deadheadCost)) : 0,
          vehicle:      r.vehicle || (DLCPricing.getVehicle ? DLCPricing.getVehicle(p) : (p > 3 ? 'Mercedes Van' : 'Tesla Model Y')),
          miles:        r.miles,
          deadheadCost: deadheadCost,
          approx:       false,
        };
      }
    }
    // Fallback rough estimate — 3-tier vehicle selection
    var vehicleName = (DLCPricing && DLCPricing.getVehicle) ? DLCPricing.getVehicle(p)
                    : (p > 7 ? 'Mercedes Van' : p > 3 ? 'Toyota Sienna' : 'Tesla Model Y');
    var minFare = vehicleName === 'Mercedes Van' ? 150 : vehicleName === 'Toyota Sienna' ? 120 : 100;
    var uberEst = Math.round(minFare / 0.8);
    return {
      ourPrice: minFare,
      uberEst:  uberEst,
      savings:  uberEst - minFare,
      vehicle:  vehicleName,
      miles:    null,
      approx:   true,
    };
  }

  // ── Maps & Address Helpers ─────────────────────────────────────────────────

  function buildMapsLink(address) {
    if (!address) return null;
    return 'https://maps.google.com/?q=' + encodeURIComponent(address);
  }

  // Multi-stop Google Maps Directions link (mobile-friendly, no API key needed).
  // origin/destination can be address strings or airport names.
  function buildRouteLink(origin, destination) {
    if (!origin && !destination) return null;
    if (!origin) return buildMapsLink(destination);
    if (!destination) return buildMapsLink(origin);
    return 'https://www.google.com/maps/dir/' + encodeURIComponent(origin) + '/' + encodeURIComponent(destination);
  }

  // Haversine distance in km (local copy — location.js keeps its version private).
  function _haversineKm(lat1, lng1, lat2, lng2) {
    var R    = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // GPS-based feasibility check for airport rides.
  // Returns suggested earliest viable time string (e.g. "7:30 PM") if infeasible,
  // or null if feasible / insufficient data to determine.
  // Only fires for same-day bookings when fresh driver GPS is available (< 30 min).
  function _airportFeasibility(airportCode, bookMins, nowMins) {
    var airports = window.DLCLocation && DLCLocation.AIRPORTS;
    var apt      = airports && airports[airportCode];
    if (!apt) return null;

    var pool     = window._activeDrivers || [];
    var FRESH_MS = 30 * 60 * 1000; // 30-minute freshness threshold
    var now      = Date.now();
    var minEta   = Infinity;

    pool.forEach(function(d) {
      if (d.complianceStatus !== 'approved') return;
      if (!d.driverLat || !d.driverLng || !d.driverLocAt) return;
      // Resolve Firestore Timestamp or plain seconds-based object
      var locMs = d.driverLocAt.toMillis ? d.driverLocAt.toMillis()
                : (d.driverLocAt.seconds ? d.driverLocAt.seconds * 1000 : Number(d.driverLocAt));
      if (now - locMs > FRESH_MS) return; // stale GPS — skip
      var km  = _haversineKm(d.driverLat, d.driverLng, apt.lat, apt.lng);
      var eta = Math.ceil((km / 80) * 60) + 10; // 80 km/h + 10 min prep buffer
      if (eta < minEta) minEta = eta;
    });

    if (minEta === Infinity) return null; // no fresh GPS data — cannot determine
    if (minEta <= (bookMins - nowMins)) return null; // feasible

    // Build suggested time string
    var viableMins = nowMins + minEta;
    var vH   = Math.floor(viableMins / 60) % 24;
    var vM   = viableMins % 60;
    var ampm = vH >= 12 ? 'PM' : 'AM';
    var h12  = vH % 12 || 12;
    return h12 + ':' + (vM < 10 ? '0' : '') + vM + ' ' + ampm;
  }

  var AIRPORT_LOCATIONS = {
    LAX: { name:'Los Angeles International Airport', address:'1 World Way, Los Angeles, CA 90045' },
    SNA: { name:'John Wayne Airport',                address:'18601 Airport Way, Santa Ana, CA 92707' },
    ONT: { name:'Ontario International Airport',     address:'2900 E Airport Dr, Ontario, CA 91761' },
    BUR: { name:'Hollywood Burbank Airport',         address:'2627 N Hollywood Way, Burbank, CA 91505' },
    LGB: { name:'Long Beach Airport',                address:'4100 Donald Douglas Dr, Long Beach, CA 90808' },
    SFO: { name:'San Francisco International Airport', address:'San Francisco, CA 94128' },
    SJC: { name:'San Jose International Airport',    address:'1701 Airport Blvd, San Jose, CA 95110' },
    OAK: { name:'Oakland International Airport',     address:'1 Airport Dr, Oakland, CA 94621' },
    PSP: { name:'Palm Springs International Airport', address:'3400 E Tahquitz Canyon Way, Palm Springs, CA 92262' },
    SAN: { name:'San Diego International Airport',   address:'3225 N Harbor Dr, San Diego, CA 92101' },
    SMF: { name:'Sacramento International Airport',  address:'6900 Airport Blvd, Sacramento, CA 95837' },
  };

  function buildAirportMapsLink(airportCode, terminal) {
    var ap = AIRPORT_LOCATIONS[airportCode];
    if (!ap) return null;
    var query = terminal ? ap.name + ' ' + terminal : ap.name;
    return 'https://maps.google.com/?q=' + encodeURIComponent(query);
  }

  // ── Vehicle recommendation message (injected after passengers collected) ──────

  // Returns a short vehicle recommendation string in the current draft language,
  // or null if DLCPricing is unavailable.
  function _getVehicleRecMsg(pax) {
    if (!pax) return null;
    var p = Math.max(1, parseInt(pax) || 1);
    if (typeof DLCPricing === 'undefined' || !DLCPricing.getVehicle) return null;
    var v     = DLCPricing.getVehicle(p);
    var seats = (DLCPricing.VEHICLE_SEATS && DLCPricing.VEHICLE_SEATS[v]) ||
                (v === 'Tesla Model Y' ? 4 : v === 'Toyota Sienna' ? 7 : 12);
    var lang  = (draft && draft.lang) || 'en';
    if (lang === 'vi') {
      if (v === 'Tesla Model Y') return '🚗 Tesla Model Y (' + seats + ' chỗ) — phù hợp cho nhóm ' + p + ' người.';
      if (v === 'Toyota Sienna') return '🚐 Toyota Sienna (' + seats + ' chỗ) — phù hợp cho nhóm ' + p + ' người.';
      return '🚐 Mercedes Van (' + seats + ' chỗ) — phù hợp nhóm lớn ' + p + ' người.';
    }
    if (lang === 'es') {
      if (v === 'Tesla Model Y') return '🚗 Tesla Model Y (' + seats + ' plazas) — perfecto para ' + p + ' pasajero' + (p > 1 ? 's' : '') + '.';
      if (v === 'Toyota Sienna') return '🚐 Toyota Sienna (' + seats + ' plazas) — ideal para tu grupo de ' + p + '.';
      return '🚐 Mercedes Van (' + seats + ' plazas) — ideal para grupos de ' + p + '.';
    }
    // English (default)
    var pStr = p + ' passenger' + (p > 1 ? 's' : '');
    if (v === 'Tesla Model Y') return '🚗 Tesla Model Y (' + seats + ' seats) — perfect for ' + pStr + '.';
    if (v === 'Toyota Sienna') return '🚐 Toyota Sienna (' + seats + ' seats) — recommended for ' + pStr + '.';
    return '🚐 Mercedes Van (' + seats + ' seats) — ready for your group of ' + p + '.';
  }

  // ── Workflow Definitions ───────────────────────────────────────────────────

  var WORKFLOWS = {

    food_order: {
      label: 'Đặt Món Ăn',
      intro: '🥟 Tôi sẽ giúp bạn đặt món. Gõ "hủy" bất cứ lúc nào để thoát.\n',
      detectKeywords: /(?:\border\b|đặt\s*(?:mua\s*|hàng\s*)?(?:\d+\s*)?|muốn\s+(?:đặt|mua|order)|can\s+i\s+(?:order|get)|i\s+(?:want|need)\s+to|cho\s+(?:tôi|mình)|i'd\s+like)\s*\d*\s*(?:a\s+)?(?:tray\s+of\s+)?(?:egg.?roll|chả\s*giò|cha\s*gio|chuối\s*đậu|chuoi\s*dau|ốc\b|snail|bún\s*chả|bun\s*cha|bún\s*đậu|bun\s*dau|phở|pho\b)|\b(?:egg.?roll|chả\s*giò|cha\s*gio|bún\s*chả|bun\s*cha|phở\s*bắc|pho\s*bac|chuối\s*đậu)\b.*\b(?:order|đặt|mua|\d+\s*(?:cuốn|phần|tô|piece|tray))\b/i,
      fields: [
        {
          key: 'item',
          question: function() { return S('qFoodItem'); },
          extract: function(t) { return X.foodItem(t); },
          optional: false,
        },
        {
          key: 'quantity',
          question: function(f) {
            var item = f.item || {};
            var lang = (draft && draft.lang) || 'en';
            var unitLabel = (lang !== 'vi' && item.unitEn) ? item.unitEn : (item.unit||'cái');
            return S('qFoodQtyPre') + unitLabel + S('qFoodQtyPost') +
              (item.minOrder ? ' (' + S('qFoodQtyMin') + item.minOrder + ' ' + unitLabel + ')' : '');
          },
          extract: function(t) { return X.quantity(t); },
          optional: false,
          validate: function(v, f) {
            var min = (f.item||{}).minOrder || 1;
            if (v < min) return '❗ ' + S('qFoodQtyMin') + min + ' ' + ((f.item||{}).unit||'cái') + '.';
            return null;
          },
        },
        {
          key: 'variant',
          question: function(f) {
            var item = f.item || {};
            if (!item.hasVariant) return null;
            return item.variantQuestion || ('Bạn muốn chọn loại nào?\n• ' + (item.variantOptions || ''));
          },
          extract: function(t) { return X.foodVariant(t); },
          optional: function(f) { return !(f.item && f.item.hasVariant); },
          showIf: function(f) { return !!(f.item && f.item.hasVariant); },
        },
        {
          key: 'fulfillment',
          question: function() { return S('qFoodFulfillment'); },
          extract: function(t) { return X.fulfillment(t); },
          optional: false,
        },
        {
          key: 'requestedDate',
          question: function() { return S('qFoodDate'); },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return S('qFoodTime'); },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return S('qName'); },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return S('qPhone'); },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'address',
          question: function() { return S('qAddress'); },
          extract: function(t) { return X.address(t); },
          optional: false,
          showIf: function(f) { return f.fulfillment === 'delivery'; },
        },
        {
          key: 'notes',
          question: function() { return S('qNotes'); },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var item = f.item || {};
        var unitPrice = item.price || 0;
        var sub = (unitPrice * (f.quantity||0)).toFixed(2);
        var lang = (draft && draft.lang) || 'en';
        var unitLabel = (lang !== 'vi' && item.unitEn) ? item.unitEn : (item.unit||'cái');
        var lines = [
          S('hdFood'),
          item.vendorName ? S('sfRestaurant') + item.vendorName : null,
          S('sfDish') + (item.name||''),
          S('sfQty') + f.quantity + ' ' + unitLabel,
          f.variant ? S('sfVariant') + f.variant : null,
          S('sfFulfillment') + (f.fulfillment==='delivery' ? S('sfDelivery') : S('sfPickupSelf')),
          f.address  ? S('sfAddress') + f.address : null,
          S('sfDate') + fmtDate(f.requestedDate),
          S('sfTime') + fmtTime(f.requestedTime),
          S('sfName') + (f.customerName||''),
          S('sfPhone') + fmtPhone(f.customerPhone),
          f.notes    ? S('sfNotes') + f.notes : null,
          '',
          unitPrice > 0 ? S('priceTotal') + sub + ' (' + f.quantity + ' × $' + unitPrice + '/' + unitLabel + ')' : null,
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    airport_pickup: {
      label: 'Đón Tại Sân Bay',
      intro: '✈️ Tôi sẽ giúp bạn đặt dịch vụ đón sân bay. Gõ "hủy" để thoát.\n',
      detectKeywords: /pick.?up.*airport|airport.*pick.?up|đón.*sân bay|sân bay.*đón|từ.*sân bay|bay về|bay đến|cần đón.*sân bay/i,
      fields: [
        {
          key: 'airport',
          question: function() {
            if (window.DLCLocation && typeof DLCLocation.airportsWithinMiles === 'function') {
              var nearby = DLCLocation.airportsWithinMiles(MAX_SERVICE_MILES);
              if (nearby && nearby.length > 0) {
                var list = nearby.map(function(a) { return a.code; }).join(' · ');
                return S('qAirportPickup') + S('qAirportNear') + list + ')';
              } else if (nearby !== null) {
                // Location known but no airports within range
                return S('qAirportPickup') + '\n⚠️ No airports within our 120-mile service area near your location. Please call (408) 916-3439.';
              }
            }
            return S('qAirportPickup') + S('qAirportList');
          },
          extract: function(t) {
            var code = X.airport(t);
            if (!code) return null;
            // Reject airports outside 120-mile service radius when location is known
            if (window.DLCLocation && typeof DLCLocation.distanceToAirportMiles === 'function' &&
                DLCLocation.state && DLCLocation.state.lat) {
              var dist = DLCLocation.distanceToAirportMiles(code);
              if (dist !== null && dist > MAX_SERVICE_MILES) return null;
            }
            return code;
          },
          optional: false,
        },
        {
          key: 'airline',
          question: function() { return S('qAirline'); },
          extract: function(t) {
            if (/bỏ qua|skip|chưa|không biết|omitir/i.test(t)) return '';
            // Require actual flight-number format (e.g. "United 714", "AA 2034")
            var m = t.match(/\b([A-Z]{2,3})\s*(\d{2,4})\b/i);
            if (m) return (m[1] + ' ' + m[2]).trim().toUpperCase();
            // Accept airline name without number only if it contains a known carrier word
            if (/\b(united|delta|american|southwest|alaska|jetblue|spirit|frontier|hawaiian|lufthansa|korean|vietnam|vietjet|bamboo|pacific)\b/i.test(t)) {
              return t.trim().slice(0, 40);
            }
            return null;  // bare codes like "SFO" are not flight numbers
          },
          optional: true,
        },
        {
          key: 'requestedDate',
          question: function() { return S('qArrivalDate'); },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'arrivalTime',
          question: function() { return S('qArrivalTime'); },
          extract: function(t) { return X.time(t); },
          validate: function(val, f) {
            if (!f.requestedDate) return null;
            var today = new Date();
            if (f.requestedDate !== AIEngine.localISODate(today)) return null;
            var parts    = val.split(':');
            var bookMins = parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
            var nowMins  = today.getHours() * 60 + today.getMinutes();
            if (bookMins <= nowMins)      return S('errTimePast');
            if (bookMins - nowMins < 120) return S('errAptTimeTooSoon');
            // GPS-based feasibility: check if any driver can reach the airport in time
            var suggestTime = f.airport ? _airportFeasibility(f.airport, bookMins, nowMins) : null;
            if (suggestTime) return S('errAptNotFeasible').replace(/\{time\}/g, suggestTime);
            return null;
          },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return S('qPassengers'); },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'terminal',
          question: function() { return S('qTerminal'); },
          extract: function(t) { return X.terminal(t); },
          optional: true,
        },
        {
          key: 'luggageCount',
          question: function() { return S('qLuggage'); },
          extract: function(t) { return X.luggage(t); },
          optional: true,
        },
        {
          key: 'dropoffAddress',
          question: function() {
            if (_addrAmbigName) return _addrClarifyQuestion(_addrAmbigName);
            var hint = '';
            if (window.DLCLocation && DLCLocation.pickupHint()) {
              hint = S('qCurrentLoc') + DLCLocation.pickupHint() + S('qCurrentLocUse');
            }
            return S('qDropoffAddr') + hint + S('qDropoffAddrHint');
          },
          extract: function(t) {
            if (/\bđây\b|\bhere\b|aquí|chỗ tôi|vị trí.*tôi|current.?loc/i.test(t)) {
              var loc = window.DLCLocation && DLCLocation.pickupHint();
              if (loc) { _addrAmbigName = null; return loc; }
            }
            var _trimmed = t.trim();
            // Exclude bare airport codes (3 uppercase letters) and short tokens
            if (/^[A-Z]{2,4}$/.test(_trimmed)) return null;
            // Reject clearly vague terms — driver cannot navigate to these
            if (VAGUE_ADDR_RE.test(_trimmed)) return null;
            // Reject partial/generic place names without a street number
            if (!(/\d/.test(_trimmed)) && VAGUE_ADDR_SOFT_RE.test(_trimmed)) return null;
            // Single-word ambiguity check BEFORE X.address() — X.address accepts any string ≥4 chars
            if (_isAmbiguousAddr(_trimmed)) { _addrAmbigName = _trimmed; return null; }
            var _addr = X.address(t);
            if (_addr) { _addrAmbigName = null; return _addr; }
            _addrAmbigName = null;
            if (_trimmed.length >= 5) return _trimmed;
            return null;
          },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return S('qNameLead'); },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return S('qPhone'); },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'customerEmail',
          question: function() { return S('qEmail'); },
          extract: function(t) {
            if (/^(bỏ qua|skip|omitir|không|no|none|n\/a|-)$/i.test(t.trim())) return '';
            var m = t.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
            return m ? m[0].toLowerCase() : ''; // treat non-email input as skip
          },
          optional: true,
        },
        {
          key: 'notes',
          question: function() { return S('qNotesShort'); },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|no hay)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateTransfer(f.passengers, f.airport, f.dropoffAddress);
        var capWarn = _capacityWarning(f.airport, f.passengers);
        var lines = [
          S('hdPickup'),
          S('sfAirport') + (f.airport||''),
          f.terminal      ? S('sfTerminal') + f.terminal : null,
          f.airline       ? S('sfFlight') + f.airline : null,
          S('sfArrivalDate') + fmtDate(f.requestedDate),
          S('sfArrivalTime') + fmtTime(f.arrivalTime),
          S('sfPassengers') + (f.passengers||'') + S('sfPassengersUnit'),
          f.luggageCount !== undefined && f.luggageCount !== null
            ? S('sfLuggage') + (f.luggageCount === 0 ? S('sfLuggageCarryOn') : f.luggageCount + S('sfLuggageChecked')) : null,
          S('sfDropoffAddr') + (f.dropoffAddress||''),
          S('sfName') + (f.customerName||''),
          S('sfPhone') + fmtPhone(f.customerPhone),
          f.notes         ? S('sfNotes') + f.notes : null,
          '',
          est             ? S('priceEst') + est : null,
          capWarn,
          S('driverWait'),
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    airport_dropoff: {
      label: 'Ra Sân Bay',
      intro: '✈️ Tôi sẽ giúp bạn đặt dịch vụ đưa ra sân bay. Gõ "hủy" để thoát.\n',
      detectKeywords: /drop.?off.*airport|airport.*drop.?off|đưa.*sân bay|ra sân bay|đi airport|đi sân bay|cần xe ra sân bay/i,
      fields: [
        {
          key: 'airport',
          question: function() {
            if (window.DLCLocation && typeof DLCLocation.airportsWithinMiles === 'function') {
              var nearby = DLCLocation.airportsWithinMiles(MAX_SERVICE_MILES);
              if (nearby && nearby.length > 0) {
                var list = nearby.map(function(a) { return a.code; }).join(' · ');
                return S('qAirportDropoff') + S('qAirportNear') + list + ')';
              } else if (nearby !== null) {
                return S('qAirportDropoff') + '\n⚠️ No airports within our 120-mile service area near your location. Please call (408) 916-3439.';
              }
            }
            return S('qAirportDropoff') + S('qAirportList');
          },
          extract: function(t) {
            var code = X.airport(t);
            if (!code) return null;
            // Reject airports outside 120-mile service radius when location is known
            if (window.DLCLocation && typeof DLCLocation.distanceToAirportMiles === 'function' &&
                DLCLocation.state && DLCLocation.state.lat) {
              var dist = DLCLocation.distanceToAirportMiles(code);
              if (dist !== null && dist > MAX_SERVICE_MILES) return null;
            }
            return code;
          },
          optional: false,
        },
        {
          key: 'airline',
          question: function() { return S('qAirlineShort'); },
          extract: function(t) {
            if (/bỏ qua|skip|chưa|không biết|omitir/i.test(t)) return '';
            // Require actual flight-number format (e.g. "United 714", "AA 2034")
            var m = t.match(/\b([A-Z]{2,3})\s*(\d{2,4})\b/i);
            if (m) return (m[1] + ' ' + m[2]).trim().toUpperCase();
            // Accept airline name without number only if it contains a known carrier word
            if (/\b(united|delta|american|southwest|alaska|jetblue|spirit|frontier|hawaiian|lufthansa|korean|vietnam|vietjet|bamboo|pacific)\b/i.test(t)) {
              return t.trim().slice(0, 40);
            }
            return null;  // bare codes like "SFO" are not flight numbers
          },
          optional: true,
        },
        {
          key: 'requestedDate',
          question: function() { return S('qRideDate'); },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'departureTime',
          question: function() { return S('qRideTime'); },
          extract: function(t) { return X.time(t); },
          validate: function(val, f) {
            if (!f.requestedDate) return null;
            var today = new Date();
            if (f.requestedDate !== AIEngine.localISODate(today)) return null;
            var parts    = val.split(':');
            var bookMins = parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
            var nowMins  = today.getHours() * 60 + today.getMinutes();
            if (bookMins <= nowMins)      return S('errTimePast');
            if (bookMins - nowMins < 120) return S('errAptTimeTooSoon');
            // GPS-based feasibility: check if any driver can reach the pickup in time
            // For dropoff, driver needs to reach customer (not airport), but airport
            // proximity is a reasonable proxy — use same check for consistency.
            var suggestTime = f.airport ? _airportFeasibility(f.airport, bookMins, nowMins) : null;
            if (suggestTime) return S('errAptNotFeasible').replace(/\{time\}/g, suggestTime);
            return null;
          },
          optional: false,
        },
        {
          key: 'pickupAddress',
          question: function() {
            if (_addrAmbigName) return _addrClarifyQuestion(_addrAmbigName);
            var hint = '';
            if (window.DLCLocation && DLCLocation.pickupHint()) {
              hint = S('qCurrentLoc') + DLCLocation.pickupHint() + S('qCurrentLocUse');
            }
            return S('qPickupAddr') + hint;
          },
          extract: function(t) {
            if (/\bđây\b|\bhere\b|aquí|chỗ tôi|vị trí.*tôi|current.?loc/i.test(t)) {
              var loc = window.DLCLocation && DLCLocation.pickupHint();
              if (loc) { _addrAmbigName = null; return loc; }
            }
            var _trimmed = t.trim();
            // Exclude bare airport codes (3 uppercase letters) and short tokens
            if (/^[A-Z]{2,4}$/.test(_trimmed)) return null;
            // Reject clearly vague terms — driver cannot navigate to these
            if (VAGUE_ADDR_RE.test(_trimmed)) return null;
            // Reject partial/generic place names without a street number
            if (!(/\d/.test(_trimmed)) && VAGUE_ADDR_SOFT_RE.test(_trimmed)) return null;
            // Single-word ambiguity check BEFORE X.address() — X.address accepts any string ≥4 chars
            if (_isAmbiguousAddr(_trimmed)) { _addrAmbigName = _trimmed; return null; }
            var _addr = X.address(t);
            if (_addr) { _addrAmbigName = null; return _addr; }
            _addrAmbigName = null;
            if (_trimmed.length >= 5) return _trimmed;
            return null;
          },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return S('qPassengers'); },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'terminal',
          question: function() { return S('qTerminalDrop'); },
          extract: function(t) { return X.terminal(t); },
          optional: true,
        },
        {
          key: 'luggageCount',
          question: function() { return S('qLuggage'); },
          extract: function(t) { return X.luggage(t); },
          optional: true,
        },
        {
          key: 'customerName',
          question: function() { return S('qNameLead'); },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return S('qPhone'); },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'customerEmail',
          question: function() { return S('qEmail'); },
          extract: function(t) {
            if (/^(bỏ qua|skip|omitir|không|no|none|n\/a|-)$/i.test(t.trim())) return '';
            var m = t.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
            return m ? m[0].toLowerCase() : '';
          },
          optional: true,
        },
        {
          key: 'notes',
          question: function() { return S('qNotesShort'); },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|no hay)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateTransfer(f.passengers, f.airport, f.pickupAddress);
        var capWarn = _capacityWarning(f.airport, f.passengers);
        var lines = [
          S('hdDropoff'),
          S('sfAirport') + (f.airport||''),
          f.terminal      ? S('sfTerminal') + f.terminal : null,
          f.airline       ? S('sfFlight') + f.airline : null,
          S('sfDepDate') + fmtDate(f.requestedDate),
          S('sfDepTime') + fmtTime(f.departureTime),
          S('sfPickupAddr') + (f.pickupAddress||''),
          S('sfPassengers') + (f.passengers||'') + S('sfPassengersUnit'),
          f.luggageCount !== undefined && f.luggageCount !== null
            ? S('sfLuggage') + (f.luggageCount === 0 ? S('sfLuggageCarryOn') : f.luggageCount + S('sfLuggageChecked')) : null,
          S('sfName') + (f.customerName||''),
          S('sfPhone') + fmtPhone(f.customerPhone),
          f.notes         ? S('sfNotes') + f.notes : null,
          '',
          est             ? S('priceEst') + est : null,
          capWarn,
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    private_ride: {
      label: 'Xe Riêng Cao Cấp',
      intro: '🚗 Tôi sẽ giúp bạn đặt xe riêng cao cấp. Gõ "hủy" bất cứ lúc nào để thoát.\n',
      detectKeywords: /\bxe riêng\b|private.?ride|luxury.?ride|đặt xe.*điểm|thuê xe điểm đến/i,
      fields: [
        {
          key: 'pickupAddress',
          question: function() {
            if (_addrAmbigName) return _addrClarifyQuestion(_addrAmbigName);
            // If we have a full reverse-geocoded address, surface it prominently
            var gpsPlace = window.DLCLocation && DLCLocation.state && DLCLocation.state.place;
            if (gpsPlace) {
              return S('qRidePickup') + S('qGpsPickupFull') + gpsPlace + S('qGpsPickupUse');
            }
            // Coarse city hint fallback
            var hint = '';
            if (window.DLCLocation && DLCLocation.pickupHint()) {
              hint = S('qCurrentLoc') + DLCLocation.pickupHint() + S('qCurrentLocUse');
            }
            return S('qRidePickup') + hint + S('qRidePickupEx');
          },
          extract: function(t) {
            if (/\bđây\b|\bhere\b|aquí|chỗ tôi|vị trí.*tôi|current.?loc/i.test(t)) {
              // Prefer full GPS address; fall back to coarse city hint
              var loc = (window.DLCLocation && DLCLocation.state && DLCLocation.state.place)
                     || (window.DLCLocation && DLCLocation.pickupHint());
              if (loc) {
                if (draft && draft.collectedFields) draft.collectedFields._pickupSource = 'gps';
                _addrAmbigName = null;
                return loc;
              }
            }
            var _trimmed = t.trim();
            // Exclude bare airport codes (3 uppercase letters) and short tokens
            if (/^[A-Z]{2,4}$/.test(_trimmed)) return null;
            // Reject clearly vague terms — driver cannot navigate to these
            if (VAGUE_ADDR_RE.test(_trimmed)) return null;
            // Reject partial/generic place names without a street number
            if (!(/\d/.test(_trimmed)) && VAGUE_ADDR_SOFT_RE.test(_trimmed)) return null;
            // Single-word ambiguity check BEFORE X.address() — X.address accepts any string ≥4 chars
            if (_isAmbiguousAddr(_trimmed)) { _addrAmbigName = _trimmed; return null; }
            var _addr = X.address(t);
            if (_addr) { _addrAmbigName = null; return _addr; }
            _addrAmbigName = null;
            if (_trimmed.length >= 5) return _trimmed;
            return null;
          },
          optional: false,
        },
        {
          key: 'dropoffAddress',
          question: function() {
            if (_addrAmbigName) return _addrClarifyQuestion(_addrAmbigName);
            return S('qRideDropoff');
          },
          extract: function(t) {
            var _trimmed = t.trim();
            if (VAGUE_ADDR_RE.test(_trimmed)) return null;
            // Reject partial/generic place names without a street number
            if (!(/\d/.test(_trimmed)) && VAGUE_ADDR_SOFT_RE.test(_trimmed)) return null;
            // Single-word ambiguity check BEFORE X.address() — X.address accepts any string ≥4 chars
            if (_isAmbiguousAddr(_trimmed)) { _addrAmbigName = _trimmed; return null; }
            var _addr = X.address(t);
            if (_addr) { _addrAmbigName = null; return _addr; }
            _addrAmbigName = null;
            return _trimmed.length >= 3 ? _trimmed : null;
          },
          optional: false,
        },
        {
          key: 'requestedDate',
          question: function() { return S('qRideDate'); },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return S('qRideTime'); },
          extract: function(t) { return X.time(t); },
          validate: function(val, f) {
            if (!f.requestedDate) return null;
            var today = new Date();
            if (f.requestedDate !== AIEngine.localISODate(today)) return null;
            var parts = val.split(':');
            var bookMins = parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
            var nowMins  = today.getHours() * 60 + today.getMinutes();
            if (bookMins <= nowMins)        return S('errTimePast');
            if (bookMins - nowMins < 60)    return S('errRideTimeTooSoon');
            return null;
          },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return S('qPassengers'); },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return S('qNameSelf'); },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return S('qPhone'); },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'customerEmail',
          question: function() { return S('qEmail'); },
          extract: function(t) {
            if (/^(bỏ qua|skip|omitir|không|no|none|n\/a|-)$/i.test(t.trim())) return '';
            var m = t.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
            return m ? m[0].toLowerCase() : '';
          },
          optional: true,
        },
        {
          key: 'notes',
          question: function() { return S('qNotesShort'); },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|no hay)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var est = estimateRide(f.passengers, f.pickupAddress, f.dropoffAddress);
        // Resolve vehicle label for display
        var vehicleLabel = (est && est.vehicle) ||
                           (DLCPricing && DLCPricing.getVehicle ? DLCPricing.getVehicle(f.passengers) : null);
        var vehicleSeats = vehicleLabel && DLCPricing && DLCPricing.VEHICLE_SEATS
                         ? DLCPricing.VEHICLE_SEATS[vehicleLabel] : null;
        // 120-mile service range warning
        var rangeWarn = (est && est.miles && est.miles > MAX_SERVICE_MILES)
          ? '\n⚠️ This trip is ~' + est.miles + ' miles — our team will confirm availability and final pricing.'
          : null;
        var lines = [
          S('hdRide'),
          S('sfPickupFrom') + (f.pickupAddress || ''),
          S('sfDropoffTo') + (f.dropoffAddress || ''),
          S('sfDate') + fmtDate(f.requestedDate),
          S('sfTime') + fmtTime(f.requestedTime),
          S('sfPassengers') + (f.passengers || '') + S('sfPassengersUnit'),
          vehicleLabel ? '🚗 ' + vehicleLabel + (vehicleSeats ? ' (' + vehicleSeats + ' seats)' : '') : null,
          S('sfName') + (f.customerName || ''),
          S('sfPhone') + fmtPhone(f.customerPhone),
          f.notes ? S('sfNotes') + f.notes : null,
          '',
        ];
        if (est) {
          lines.push(S('priceCompare') + est.vehicle + '):');
          lines.push(S('priceUber') + est.uberEst + ' (1-way, no deadhead)');
          lines.push(S('priceDLC') + est.ourPrice + ' (incl. 2-way driver)' + (est.savings > 0 ? S('priceSave') + est.savings : ''));
          if (est.approx) lines.push(S('priceApprox'));
          if (rangeWarn) lines.push(rangeWarn);
        }
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

    nail_appointment: {
      label: 'Đặt Lịch Nail',
      intro: '💅 Tôi sẽ giúp bạn đặt lịch nail. Gõ "hủy" để thoát.\n',
      detectKeywords: /\b(?:đặt\s+)?(?:lịch\s+)?(?:nail|manicure|pedicure|gel nail|acrylic|dip powder|mani\b|pedi\b)\b|đặt.*nail|tiệm nail/i,
      fields: [
        {
          key: 'serviceType',
          question: function() { return S('qNailService'); },
          extract: function(t) { return X.nailService(t); },
          optional: false,
        },
        {
          key: 'region',
          question: function() { return S('qRegion'); },
          extract: function(t) { return X.region(t); },
          optional: true,
          chips: function() {
            return [
              { label: '🌉 Bay Area (San Jose / SF)',   value: 'Bay Area' },
              { label: '☀️ Southern CA (OC / LA)',      value: 'Southern CA' },
            ];
          },
        },
        {
          key: 'requestedDate',
          question: function() { return S('qApptDate'); },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return S('qApptTime'); },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return S('qNameSelf'); },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return S('qPhone'); },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return S('qNailNotes'); },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|no hay)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var priceEst = f.serviceType ? NAIL_PRICE_FROM[f.serviceType] : null;
        return [
          S('hdNail'),
          S('sfService') + (f.serviceType||''),
          f.region    ? S('sfRegion') + f.region : null,
          S('sfDate') + fmtDate(f.requestedDate),
          S('sfTime') + fmtTime(f.requestedTime),
          S('sfName') + (f.customerName||''),
          S('sfPhone') + fmtPhone(f.customerPhone),
          f.notes     ? S('sfNotes') + f.notes : null,
          '',
          priceEst    ? '💰 ' + S('priceFrom') + priceEst : null,
        ].filter(function(v) { return v !== null; }).join('\n');
      },
    },

    hair_appointment: {
      label: 'Đặt Lịch Tóc',
      intro: '✂️ Tôi sẽ giúp bạn đặt lịch làm tóc. Gõ "hủy" để thoát.\n',
      detectKeywords: /\b(?:đặt\s+)?(?:lịch\s+)?(?:cắt tóc|nhuộm tóc|hair salon|tiệm tóc|keratin|balayage|uốn tóc|duỗi tóc|haircut|hair cut|hair color)\b|đặt.*tóc/i,
      fields: [
        {
          key: 'serviceType',
          question: function() { return S('qHairService'); },
          extract: function(t) { return X.hairService(t); },
          optional: false,
        },
        {
          key: 'region',
          question: function() { return S('qRegion'); },
          extract: function(t) { return X.region(t); },
          optional: true,
          chips: function() {
            return [
              { label: '🌉 Bay Area (San Jose / SF)',   value: 'Bay Area' },
              { label: '☀️ Southern CA (OC / LA)',      value: 'Southern CA' },
            ];
          },
        },
        {
          key: 'requestedDate',
          question: function() { return S('qApptDate'); },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'requestedTime',
          question: function() { return S('qApptTime'); },
          extract: function(t) { return X.time(t); },
          optional: false,
        },
        {
          key: 'customerName',
          question: function() { return S('qNameSelf'); },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return S('qPhone'); },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return S('qHairNotes'); },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|no hay)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var priceEst = f.serviceType ? HAIR_PRICE_FROM[f.serviceType] : null;
        return [
          S('hdHair'),
          S('sfService') + (f.serviceType||''),
          f.region    ? S('sfRegion') + f.region : null,
          S('sfDate') + fmtDate(f.requestedDate),
          S('sfTime') + fmtTime(f.requestedTime),
          S('sfName') + (f.customerName||''),
          S('sfPhone') + fmtPhone(f.customerPhone),
          f.notes     ? S('sfNotes') + f.notes : null,
          '',
          priceEst    ? '💰 ' + S('priceFrom') + priceEst : null,
        ].filter(function(v) { return v !== null; }).join('\n');
      },
    },

    tour_request: {
      label: 'Đặt Tour Du Lịch',
      intro: '🗺️ Tôi sẽ giúp bạn lên kế hoạch tour. Gõ "hủy" để thoát.\n',
      detectKeywords: /\b(?:đặt\s+)?tour\b.*\b(?:yosemite|vegas|las vegas|san francisco|napa|big sur|monterey|santa barbara|palm springs|joshua tree|grand canyon|san diego|sequoia|solvang|disneyland|17.?mile)\b|\b(?:yosemite|las vegas|grand canyon)\b.*\b(?:tour|đặt|đi|chuyến)\b/i,
      fields: [
        {
          key: 'destination',
          question: function() { return S('qTourDest'); },
          extract: function(t) { return X.destination(t); },
          optional: false,
        },
        {
          key: 'requestedDate',
          question: function() { return S('qTourDate'); },
          extract: function(t) { return X.date(t); },
          optional: false,
        },
        {
          key: 'days',
          question: function() { return S('qTourDays'); },
          extract: function(t) { return X.days(t); },
          optional: false,
        },
        {
          key: 'passengers',
          question: function() { return S('qTourPassengers'); },
          extract: function(t) { return X.passengers(t) || X.quantity(t); },
          optional: false,
        },
        {
          key: 'startingPoint',
          question: function() { return S('qTourFrom'); },
          extract: function(t) { return t.trim().length >= 2 ? t.trim() : null; },
          optional: false,
        },
        {
          key: 'lodging',
          question: function() { return S('qTourLodging'); },
          extract: function(t) { return X.lodging(t); },
          optional: true,
          chips: function() {
            return [
              { label: '🏨 Có, cần khách sạn', value: 'hotel' },
              { label: '🏠 Airbnb / Nhà thuê',  value: 'airbnb' },
              { label: '✅ Không cần (tự túc)', value: 'không cần chỗ ở' },
            ];
          },
        },
        {
          key: 'hotelArea',
          question: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            if (dest === 'lasvegas') return S('qTourAreaVegas');
            if (dest === 'sanfrancisco') return S('qTourAreaSF');
            return S('qTourArea');
          },
          extract: function(t) { return X.hotelArea(t); },
          optional: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            return f.lodging !== 'hotel' || !HOTEL_SUGGESTIONS[dest];
          },
          showIf: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            return f.lodging === 'hotel' && !!HOTEL_SUGGESTIONS[dest];
          },
          chips: function(f) {
            var dest = typeof f.destination === 'object' ? f.destination.id : '';
            if (dest === 'lasvegas') return [
              { label: '✨ The Strip',              value: 'strip' },
              { label: '🏙️ Downtown (Fremont St)',  value: 'downtown' },
              { label: '🏷️ Off Strip (rẻ hơn)',    value: 'off_strip' },
            ];
            if (dest === 'sanfrancisco') return [
              { label: '🏙️ City Center',            value: 'city_center' },
              { label: "🐟 Fisherman's Wharf",      value: 'beach' },
            ];
            return null;
          },
        },
        {
          key: 'hotelBudget',
          question: function() { return S('qTourBudget'); },
          extract: function(t) { return X.hotelBudget(t); },
          optional: function(f) { return f.lodging !== 'hotel'; },
          showIf: function(f) { return f.lodging === 'hotel'; },
          chips: function() {
            return [
              { label: '💰 Tiết kiệm (~$50-120/đêm)',  value: 'budget' },
              { label: '⭐ Tầm trung (~$120-220/đêm)', value: 'midrange' },
              { label: '✨ Cao cấp ($220+/đêm)',        value: 'premium' },
              { label: 'Không có sở thích đặc biệt',   value: 'midrange' },
            ];
          },
        },
        {
          key: 'bookingMode',
          question: function() { return S('qTourBooking'); },
          extract: function(t) { return X.bookingMode(t); },
          optional: function(f) { return f.lodging !== 'hotel'; },
          showIf: function(f) { return f.lodging === 'hotel'; },
          chips: function() {
            return [
              { label: '🤝 Du Lịch Cali lo giúp tôi',   value: 'vendor' },
              { label: '🔗 Tôi tự đặt (cần gợi ý link)', value: 'self' },
            ];
          },
        },
        {
          key: 'chosenHotel',
          question: null,
          extract: function(t) {
            var m = t.match(/(?:muốn ở|chọn|ở|stay at|book)\s+([A-Za-zÀ-ỹ\s\-&'The]+?)(?:,|\s*nhờ|\s*và|\s*$)/i);
            if (m && m[1] && m[1].trim().length >= 3) return m[1].trim().slice(0,60);
            return null;
          },
          optional: true,
          showIf: function(f) { return f.lodging === 'hotel'; },
        },
        {
          key: 'customerName',
          question: function() { return S('qTourContact'); },
          extract: function(t) { return X.name(t); },
          optional: false,
        },
        {
          key: 'customerPhone',
          question: function() { return S('qPhone'); },
          extract: function(t) { return X.phone(t); },
          optional: false,
        },
        {
          key: 'notes',
          question: function() { return S('qNotesShort'); },
          extract: function(t) { return /^(không|no|none|n\/a|skip|-|no hay)$/i.test(t.trim()) ? '' : t.trim(); },
          optional: true,
        },
      ],
      summary: function(f) {
        var dest = typeof f.destination === 'object' ? f.destination.name : (f.destination||'');
        var destId = typeof f.destination === 'object' ? f.destination.id : '';
        var est = estimateTour(f.passengers, f.days, destId, _detectTourRegion(f.startingPoint));
        var lodgeLabelMap = { hotel: S('sfLodgeHotel'), airbnb: S('sfLodgeAirbnb'), none: S('sfLodgeNone') };
        var areaLabelMap  = { strip: S('sfAreaStrip'), downtown: S('sfAreaDT'), off_strip: S('sfAreaOff'), city_center: S('sfAreaCC'), beach: S('sfAreaBeach'), airport: S('sfAreaAirport') };
        var budgLabelMap  = { budget: S('sfBudgBudget'), midrange: S('sfBudgMid'), premium: S('sfBudgPrem') };
        var lodgeLabel = lodgeLabelMap[f.lodging] || (f.lodging||'');
        var areaLabel  = areaLabelMap[f.hotelArea] || (f.hotelArea||'');
        var budgLabel  = budgLabelMap[f.hotelBudget] || (f.hotelBudget||'');
        var modeLabel  = f.bookingMode === 'vendor' ? S('sfModeVendor') : (f.bookingMode === 'self' ? S('sfModeSelf') : '');
        var lines = [
          S('hdTour'),
          S('sfDest') + dest,
          S('sfDate') + fmtDate(f.requestedDate),
          S('sfDays') + (f.days||'') + S('sfDaysUnit'),
          S('sfPassengers') + (f.passengers||'') + S('sfPassengersUnit'),
          S('sfFrom') + (f.startingPoint||''),
          lodgeLabel                      ? S('sfLodging') + lodgeLabel  : null,
          f.chosenHotel                   ? S('sfHotel') + f.chosenHotel : null,
          areaLabel && !f.chosenHotel     ? S('sfArea') + areaLabel      : null,
          budgLabel && !f.chosenHotel     ? S('sfBudget') + budgLabel    : null,
          modeLabel                       ? S('sfBooking') + modeLabel   : null,
          S('sfName') + (f.customerName||''),
          S('sfPhone') + fmtPhone(f.customerPhone),
          f.notes ? S('sfNotes') + f.notes : null,
          '',
          est ? S('priceTransport') + est : null,
        ];
        return lines.filter(function(v) { return v !== null; }).join('\n');
      },
    },

  };

  // ── Draft Persistence ──────────────────────────────────────────────────────

  function saveDraft(d) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {}
  }

  function loadDraft() {
    try {
      var r = sessionStorage.getItem(STORAGE_KEY);
      return r ? JSON.parse(r) : null;
    } catch(e) { return null; }
  }

  function clearDraft() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  // ── Engine State ───────────────────────────────────────────────────────────

  var draft = loadDraft();

  function isActive()  { return draft !== null; }
  function getDraft()  { return draft; }

  // ── Intent Detection ───────────────────────────────────────────────────────

  function detectIntent(text) {
    var keys = Object.keys(WORKFLOWS);
    for (var i = 0; i < keys.length; i++) {
      if (WORKFLOWS[keys[i]].detectKeywords.test(text)) return keys[i];
    }
    return null;
  }

  // ── Extract all possible fields from text ──────────────────────────────────

  function extractAllFromText(text, intent) {
    var wf = WORKFLOWS[intent];
    if (!wf) return {};
    var collected = {};
    var baseFields = Object.assign({}, draft ? draft.collectedFields : {});

    for (var i = 0; i < wf.fields.length; i++) {
      var fd = wf.fields[i];
      var merged = Object.assign({}, baseFields, collected);

      if (merged[fd.key] !== undefined) continue;
      if (!fd.extract) continue;
      if (fd.key === 'notes') continue; // notes is free-text; never populate via bonus extraction
      if (fd.showIf && !fd.showIf(merged)) continue;

      try {
        var val = fd.extract(text, merged);
        if (val !== null && val !== undefined) {
          // Run validation — skip if invalid (will be asked explicitly later)
          if (fd.validate) {
            var err = fd.validate(val, merged);
            if (err) continue;
          }
          collected[fd.key] = val;
        }
      } catch(e) {}
    }
    return collected;
  }

  // ── Extract fields that OVERWRITE already-collected values (corrections) ───
  // Used only when isCorrectionText() is true.  Unlike extractAllFromText,
  // this DOES re-examine already-collected fields so that "change 6 → 3 people"
  // can update an existing passengers value.
  function extractCorrectedFields(text, intent) {
    var wf = WORKFLOWS[intent];
    if (!wf || !draft) return {};
    var updates = {};
    var currentFields = draft.collectedFields;

    for (var i = 0; i < wf.fields.length; i++) {
      var fd = wf.fields[i];
      if (!fd.extract) continue;
      if (fd.showIf && !fd.showIf(currentFields)) continue;
      if (currentFields[fd.key] === undefined) continue; // only update *existing* fields

      try {
        var val = fd.extract(text, currentFields);
        if (val === null || val === undefined) continue;
        // Ignore if same as current
        if (JSON.stringify(val) === JSON.stringify(currentFields[fd.key])) continue;
        // Validate
        if (fd.validate) {
          var err = fd.validate(val, Object.assign({}, currentFields, updates));
          if (err) continue;
        }
        updates[fd.key] = val;
      } catch(e) {}
    }
    return updates;
  }

  // ── Find next required field missing ──────────────────────────────────────

  function findNextField(intent) {
    var wf = WORKFLOWS[intent];
    if (!wf) return null;
    var f = draft.collectedFields;
    for (var i = 0; i < wf.fields.length; i++) {
      var fd = wf.fields[i];
      if (fd.showIf && !fd.showIf(f)) continue;
      var isOptional = typeof fd.optional === 'function' ? fd.optional(f) : fd.optional;
      if (isOptional) continue;
      if (f[fd.key] === undefined) return fd;
    }
    return null;
  }

  function getQ(fd) {
    if (!fd.question) return null;
    return typeof fd.question === 'function' ? fd.question(draft.collectedFields) : fd.question;
  }

  // ── Start Workflow ─────────────────────────────────────────────────────────

  function startWorkflow(intent, seedText, lang) {
    var wf = WORKFLOWS[intent];
    if (!wf) return false;

    _addrAmbigName = null;  // clear any stale ambig state from prior workflow

    draft = {
      intent:          intent,
      label:           wf.label,
      collectedFields: {},
      awaitingField:   null,
      awaitingConfirm: false,
      lang:            lang || 'en',
      createdAt:       Date.now(),
      updatedAt:       Date.now(),
    };

    if (seedText) {
      var seeded = extractAllFromText(seedText, intent);
      Object.assign(draft.collectedFields, seeded);
    }

    saveDraft(draft);
    return true;
  }

  // ── Main Process ───────────────────────────────────────────────────────────

  function process(userText) {
    if (!draft) return null;
    draft.updatedAt = Date.now();

    // Auto-detect language from user input and update draft.lang if different.
    // Only on the first few turns (before many fields are collected) to avoid
    // flipping language mid-flow. Relies on AIEngine.detectLang being available.
    if (userText && Object.keys(draft.collectedFields).length <= 1 &&
        window.AIEngine && typeof AIEngine.detectLang === 'function') {
      var _detectedLang = AIEngine.detectLang(userText);
      if (_detectedLang && _detectedLang !== draft.lang) {
        draft.lang = _detectedLang;
      }
    }

    // Cancel
    if (/^(hủy|cancel|quit|thoát|dừng|thôi|stop)\b/i.test((userText||'').trim())) {
      clearDraft(); draft = null;
      return S('cancelled');
    }

    var wf = WORKFLOWS[draft.intent];
    if (!wf) { clearDraft(); draft = null; return null; }

    // ── Mid-flow correction: user is updating a previously answered field ──
    // Check BEFORE awaiting-confirm so "actually 3 people" works at any stage.
    if (!draft.awaitingConfirm && isCorrectionText(userText) &&
        Object.keys(draft.collectedFields).length > 0) {
      var corr = extractCorrectedFields(userText, draft.intent);
      if (Object.keys(corr).length > 0) {
        Object.assign(draft.collectedFields, corr);
        draft.awaitingField = null;    // re-evaluate which field to ask next
        var corrKeys = Object.keys(corr);
        var corrAck = S('corrUpdated') + corrKeys.map(function(k) {
          return fmtFieldLabel(k) + ': ' + fmtFieldVal(k, corr[k]);
        }).join(', ') + '.';
        saveDraft(draft);
        // Fall through to normal field-finding logic below (do not return here).
        // We prepend the ack by storing it and appending to the next question.
        draft._correctionAck = corrAck;
      }
    }

    // ── Awaiting confirmation ──────────────────────────────────────────────
    if (draft.awaitingConfirm) {
      var yn = X.yesNo(userText);
      if (yn === true) {
        return { type: 'finalize' };
      } else if (yn === false) {
        draft.awaitingConfirm = false;
        // Also try to pick up new values / corrections from this reply
        var corrAtConf = extractCorrectedFields(userText, draft.intent);
        var newAtConf  = extractAllFromText(userText, draft.intent);
        Object.assign(draft.collectedFields, corrAtConf, newAtConf);
        var next2 = findNextField(draft.intent);
        if (!next2) {
          // All fields still complete — re-show summary
          draft.awaitingConfirm = true;
          saveDraft(draft);
          return wf.summary(draft.collectedFields) + S('reShowQ');
        }
        draft.awaitingField = next2.key;
        saveDraft(draft);
        return S('corrContinue') + (getQ(next2)||'');
      } else {
        return { type:'message', text: S('confirmOrEdit'), chips:[
          { label: S('chipOk'),   value: S('chipOkVal') },
          { label: S('chipEdit'), value: S('chipEditVal') },
        ]};
      }
    }

    // ── Extract awaited field first ────────────────────────────────────────
    var _justCollected = null;
    if (draft.awaitingField) {
      var awFd = null;
      for (var i = 0; i < wf.fields.length; i++) {
        if (wf.fields[i].key === draft.awaitingField) { awFd = wf.fields[i]; break; }
      }
      if (awFd && awFd.extract) {
        var val = awFd.extract(userText, draft.collectedFields);
        if (val !== null && val !== undefined) {
          if (awFd.validate) {
            var err = awFd.validate(val, draft.collectedFields);
            if (err) { saveDraft(draft); return err; }
          }
          _justCollected = draft.awaitingField;
          draft.collectedFields[draft.awaitingField] = val;
          draft.awaitingField = null;
        }
      }
    }

    // Vehicle recommendation: inject after passengers collected for ride workflows
    if (_justCollected === 'passengers' &&
        (draft.intent === 'airport_pickup' || draft.intent === 'airport_dropoff' || draft.intent === 'private_ride')) {
      var _vrec = _getVehicleRecMsg(draft.collectedFields.passengers);
      if (_vrec) draft._vehicleRec = _vrec;
    }

    // ── Proactively extract any other bonus fields ─────────────────────────
    // Only run when user's message has 4+ words — avoids contaminating short
    // single-field answers (e.g. "SFO", "12", "18:30") into unrelated fields.
    var _wordCount = (userText || '').trim().split(/\s+/).length;
    if (_wordCount >= 4) {
      var extras = extractAllFromText(userText, draft.intent);
      Object.assign(draft.collectedFields, extras);
    }

    // ── Find next missing required field ──────────────────────────────────
    var nextFd = findNextField(draft.intent);
    if (nextFd) {
      draft.awaitingField = nextFd.key;
      saveDraft(draft);
      var q = getQ(nextFd);
      if (!q) {
        // Skip fields with no question (auto-handled) — recurse
        draft.collectedFields[nextFd.key] = '';
        return process(userText);
      }
      // Prepend vehicle recommendation (fires once after passengers collected)
      var vrec = draft._vehicleRec || '';
      delete draft._vehicleRec;
      if (vrec) q = vrec + '\n' + q;
      // Prepend any correction acknowledgment
      var ack = draft._correctionAck || '';
      delete draft._correctionAck;
      if (ack) q = ack + '\n' + q;

      // Build chips if field defines them
      var fieldChips = null;
      if (nextFd.chips) {
        try { fieldChips = typeof nextFd.chips === 'function' ? nextFd.chips(draft.collectedFields) : nextFd.chips; } catch(e) {}
      }
      // For bookingMode: also inject hotel suggestions when lodging=hotel
      var fieldHotels = null;
      if (nextFd.key === 'bookingMode' && draft.collectedFields.lodging === 'hotel') {
        var destId = typeof draft.collectedFields.destination === 'object' ? draft.collectedFields.destination.id : '';
        var sugg = getHotelSuggestions(destId, draft.collectedFields.hotelArea, draft.collectedFields.hotelBudget);
        if (sugg.length) fieldHotels = sugg;
      }
      if ((fieldChips && fieldChips.length) || fieldHotels) {
        var richText = fieldHotels ? S('hotelIntro') + q : q;
        return { type:'message', text:richText, chips:fieldChips||null, hotels:fieldHotels||null };
      }
      return q;
    }

    // ── All required fields collected ──────────────────────────────────────
    draft.awaitingConfirm = true;
    draft.awaitingField   = null;
    var ackFinal = draft._correctionAck || '';
    delete draft._correctionAck;
    saveDraft(draft);
    var summaryText = (ackFinal ? ackFinal + '\n\n' : '') +
      wf.summary(draft.collectedFields) + S('confirmReady');
    return { type:'message',
      text: summaryText,
      chips: [
        { label: S('chipOk'),   value: S('chipOkVal') },
        { label: S('chipEdit'), value: S('chipEditVal') },
      ],
    };
  }

  // ── Finalize ───────────────────────────────────────────────────────────────

  async function finalize() {
    if (!draft) throw new Error('No active workflow');
    if (typeof firebase === 'undefined' || !firebase.firestore) throw new Error('Firestore unavailable');

    var fv = firebase.firestore.FieldValue;
    var db = firebase.firestore();
    var f  = draft.collectedFields;
    var orderId = genId();
    var trackingToken = null;
    var finalPriceEst     = null;  // set for nail/hair — returned to caller
    var finalApptInfo     = null;  // set for nail/hair — returned to caller
    var finalDispatchState = null; // set for ride intents — returned to caller

    if (draft.intent === 'food_order') {
      var item     = typeof f.item === 'object' ? f.item : {};
      var vendorId = item.vendorId || 'nha-bep-emily';
      var subtotal = (item.price||0) * (f.quantity||0);
      var deliveryAddr = f.fulfillment === 'delivery' ? (f.address||'') : null;
      var deliveryMapsLink = deliveryAddr ? buildMapsLink(deliveryAddr) : null;

      // Build rich notification body
      var msgLines = [
        '📦 ' + (f.quantity||0) + ' × ' + (item.name||''),
        f.variant               ? '   Loại: ' + f.variant : null,
        '📅 ' + fmtDate(f.requestedDate) + ' lúc ' + fmtTime(f.requestedTime),
        f.fulfillment === 'delivery'
          ? ('🚗 Giao đến: ' + (deliveryAddr||'') + (deliveryMapsLink ? '\n   Map: ' + deliveryMapsLink : ''))
          : '🏪 Khách tự đến lấy',
        '👤 ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        f.notes                 ? '📝 ' + f.notes : null,
        '💰 Tổng: $' + subtotal.toFixed(2),
        '🔖 Mã đơn: ' + orderId,
      ];
      var msg = msgLines.filter(function(v){return v!==null;}).join('\n');

      await db.collection('vendors').doc(vendorId).collection('bookings').add({
        type:'food_order', bookingId:orderId, vendorId,
        itemId:item.id||'', itemName:item.name||'', quantity:f.quantity||0,
        variant:f.variant||'', fulfillment:f.fulfillment||'pickup',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        subtotal, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        deliveryAddress:deliveryAddr,
        notes:f.notes||'', status:'pending', source:'ai_chat',
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc(vendorId).collection('notifications').add({
        type:'new_order',
        title:'🛒 Đơn hàng mới — ' + (f.customerName||''),
        message: msg,
        bookingId:orderId, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        itemName:item.name||'', quantity:f.quantity||0, subtotal,
        requestedDate:f.requestedDate||'', fulfillment:f.fulfillment||'pickup',
        deliveryAddress:deliveryAddr||'', deliveryMapsLink:deliveryMapsLink||'',
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'airport_pickup' || draft.intent === 'airport_dropoff') {
      var isPickup      = draft.intent === 'airport_pickup';
      var timeField     = isPickup ? f.arrivalTime : f.departureTime;
      var datetime      = (f.requestedDate && timeField) ? f.requestedDate + 'T' + timeField + ':00' : (f.requestedDate||'');
      var addrField     = isPickup ? (f.dropoffAddress||'') : (f.pickupAddress||'');
      trackingToken     = genId().replace('DLC-','')+genId().replace('DLC-','');

      // ── Availability check: notify customer if slot looks busy, but always book ──
      var _apAvailNote = null;
      if (window.DLCRideAvail && f.requestedDate && timeField) {
        var _apRegion = AIRPORT_REGION[f.airport] || null;
        if (_apRegion) {
          try {
            var _apAvail = await DLCRideAvail.check(f.requestedDate, timeField, _apRegion, null);
            if (!_apAvail.available && _apAvail.reason !== 'error' && _apAvail.reason !== 'no_db') {
              _apAvailNote = _apAvail.reason; // 'no_schedule' | 'fully_booked'
            }
          } catch(e) { /* fail open */ }
        }
      }

      var airportMapsLink  = buildAirportMapsLink(f.airport, f.terminal);
      var addrMapsLink     = buildMapsLink(addrField);
      var luggageStr       = f.luggageCount === 0 ? 'Xách tay' : (f.luggageCount ? f.luggageCount + ' kiện' : '');
      var timeLabel        = isPickup ? 'Đón khách' : 'Cất cánh';
      // Full-trip route link: airport → dropoff (pickup) or pickup → airport (dropoff)
      var airportAddr      = (AIRPORT_LOCATIONS[f.airport] && (AIRPORT_LOCATIONS[f.airport].address || AIRPORT_LOCATIONS[f.airport].name)) || f.airport;
      var routeLink        = isPickup ? buildRouteLink(airportAddr, addrField) : buildRouteLink(addrField, airportAddr);
      // Infer pickup source
      var pickupSrc        = 'airport'; // for pickup, always at airport; for dropoff, from customer address
      if (!isPickup) {
        pickupSrc = (window.DLCLocation && DLCLocation.state && DLCLocation.state.place &&
                     addrField === DLCLocation.state.place) ? 'gps' : 'typed';
      }

      var driverBriefLines = [
        (isPickup ? '✈️ ĐÓN SÂN BAY' : '✈️ ĐƯA RA SÂN BAY') + ' — ' + orderId,
        '',
        '👤 Khách: ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        '🛫 Sân bay: ' + (f.airport||'') + (f.terminal ? ' · ' + f.terminal : ''),
        f.airline       ? '✈️  Bay: ' + f.airline : null,
        '📅 ' + fmtDate(f.requestedDate) + ' · ' + timeLabel + ': ' + fmtTime(timeField),
        '👥 ' + (f.passengers||1) + ' người' + (luggageStr ? ' · ' + luggageStr : ''),
        isPickup
          ? ('📍 Điểm đến: ' + addrField)
          : ('🚗 Đón tại: ' + addrField),
        routeLink       ? '🗺️ Tuyến đường: ' + routeLink : null,
        f.notes         ? '📝 ' + f.notes : null,
        isPickup        ? '⏱ Chờ tại cửa Arrivals/Baggage Claim.' : null,
      ];
      var driverBrief = driverBriefLines.filter(function(v){return v!==null;}).join('\n');

      // Phase 4: driver eligibility matching
      var ridRegionId   = AIRPORT_REGION[f.airport] || null;
      var eligDrivers   = _driversForRegion(ridRegionId);
      var eligIds       = eligDrivers.map(function(d){ return d.id || d.driverId || ''; }).filter(Boolean);
      var preAssigned   = eligDrivers.length === 1 ? eligDrivers[0] : null;
      var airBookStatus = 'dispatching'; // Phase 13: all rides go through offer/accept flow

      // Compute estimated price for airport booking (parse number from estimate string)
      var airEstStr = estimateTransfer(f.passengers||1, f.airport, addrField);
      var airPriceMatch = typeof airEstStr === 'string' && airEstStr.match(/~?\$(\d+)/);
      var airPrice = airPriceMatch ? parseInt(airPriceMatch[1], 10) : null;
      // Capacity-matched vehicle type
      var airVehicleType = DLCPricing && DLCPricing.getVehicle ? DLCPricing.getVehicle(f.passengers||1) : null;

      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken,
        status:airBookStatus, serviceType:isPickup?'pickup':'dropoff', datetime,
        airport:f.airport||'', airline:f.airline||'', terminal:f.terminal||'',
        // Normalized address fields (ride-intake compatible names)
        dropoffAddress: isPickup ? addrField : '',
        pickupAddress:  isPickup ? '' : addrField,
        address:addrField,  // keep for backwards compat
        passengers:f.passengers||1, luggageCount:f.luggageCount||0,
        vehicleType: airVehicleType||null,  // capacity-matched vehicle
        // Normalized customer fields (ride-intake compatible names)
        customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        name:f.customerName||'', phone:f.customerPhone||'',  // keep for backwards compat
        customerEmail:f.customerEmail||'',
        // Normalized date fields (ride-intake compatible split fields)
        arrivalDate:   isPickup ? (f.requestedDate||'') : '',
        arrivalTime:   isPickup ? (f.arrivalTime||'')   : '',
        departureDate: isPickup ? '' : (f.requestedDate||''),
        departureTime: isPickup ? '' : (f.departureTime||''),
        estimatedPrice: airPrice,
        notes:f.notes||'', source:'ai_chat',
        eligibleDriverIds: eligIds,
        driver: null, // set when driver accepts offer (Phase 13)
        vehicleLat:null,vehicleLng:null,vehicleHeading:null,etaMinutes:null,
        routeLink:    routeLink||null,   // full-trip navigation link for driver
        pickupSource: pickupSrc,         // 'airport' | 'gps' | 'typed'
        // If availability check flagged a conflict, hold for admin confirmation
        status: _apAvailNote ? 'pending_confirm' : airBookStatus,
        availabilityNote: _apAvailNote ? ('Slot may be busy (' + _apAvailNote + '). Please confirm with customer.') : null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:(isPickup?'✈️ Đón sân bay':'✈️ Ra sân bay')+' — '+(f.customerName||''),
        message: driverBrief,
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', airport:f.airport||'', terminal:f.terminal||'',
        airline:f.airline||'', passengers:f.passengers||1, luggageCount:f.luggageCount||0,
        pickupAddress:isPickup?'':addrField, dropoffAddress:isPickup?addrField:'',
        airportMapsLink:airportMapsLink||'', addrMapsLink:addrMapsLink||'',
        routeLink:routeLink||'',
        eligibleDriverCount:eligIds.length, assignedDriverId:preAssigned?preAssigned.id:null,
        read:false, createdAt:fv.serverTimestamp(),
      });
      // Phase 4: rideNotifications for driver dispatch — always write (driver needs to see all rides)
      db.collection('rideNotifications').add({
        bookingId:        orderId,
        serviceType:      isPickup ? 'pickup' : 'dropoff',  // matches booking doc serviceType
        serviceLabel:     isPickup ? '✈ Đón Sân Bay' : '✈ Ra Sân Bay',
        type:             isPickup ? 'airport_pickup' : 'airport_dropoff',
        eligibleDriverIds:eligIds,
        assignedDriverId: preAssigned ? (preAssigned.id||'') : null,
        status:           'new',  // must be 'new' — matches driver-admin.html query
        airport:          f.airport||'',
        airline:          f.airline||'',
        terminal:         f.terminal||'',
        arrivalDate:      f.requestedDate||null,
        arrivalTime:      isPickup ? (f.arrivalTime||null) : (f.departureTime||null),
        pickupAddress:    isPickup ? null : addrField,
        dropoffAddress:   isPickup ? addrField : null,
        passengers:       f.passengers||1,
        estimatedPrice:   null,
        estimatedMiles:   null,
        routeLink:        routeLink||null,
        customerName:     f.customerName||'',
        customerPhone:    f.customerPhone||'',
        createdAt:        fv.serverTimestamp(),
      }).catch(function(e){ console.warn('[rideNotif] write failed:', e.message); });
      // Phase 13: write dispatch queue doc to trigger automatic driver offer flow
      db.collection('dispatchQueue').doc(orderId + '_0').set({
        bookingId: orderId, skipDriverIds: [], attempt: 1, status: 'pending',
        createdAt: fv.serverTimestamp(),
      }).catch(function(e){ console.warn('[dispatchQueue] write failed:', e.message); });
      finalDispatchState = {
        status: _apAvailNote ? 'pending_confirm' : airBookStatus,
        eligibleCount: eligIds.length,
        preAssigned: null,
        availNote: _apAvailNote || null, // 'no_schedule' | 'fully_booked' | null
      };
      // Phase 5A: queue confirmation email (non-blocking, no-op if no email)
      if (typeof DLCNotifications !== 'undefined') {
        DLCNotifications.queueRideConfirmation({
          bookingId: orderId, customerEmail: f.customerEmail||'',
          customerName: f.customerName||'', name: f.customerName||'',
          serviceType: isPickup ? 'pickup' : 'dropoff',
          airport: f.airport||'', airline: f.airline||'', terminal: f.terminal||'',
          datetime: datetime, address: addrField,
          passengers: f.passengers||1, trackingToken: trackingToken||'',
          status: airBookStatus,
          driver: null,
        }, draft.lang || 'en');
        // Phase 5B: in-app notifications (admin + customer)
        if (DLCNotifications.queueRideBookedNotification) {
          DLCNotifications.queueRideBookedNotification({
            bookingId: orderId,
            serviceType: isPickup ? 'airport_pickup' : 'airport_dropoff',
            customerName: f.customerName||'', customerPhone: f.customerPhone||'',
            datetime: datetime, passengers: f.passengers||1,
          }, draft.lang || 'en');
        }
      }

    } else if (draft.intent === 'nail_appointment' || draft.intent === 'hair_appointment') {
      var isNail    = draft.intent === 'nail_appointment';
      var svcEmoji  = isNail ? '💅' : '✂️';
      var svcLabel2 = isNail ? 'Nail' : 'Tóc';
      finalPriceEst = f.serviceType ? (isNail ? NAIL_PRICE_FROM[f.serviceType] : HAIR_PRICE_FROM[f.serviceType]) : null;
      finalApptInfo = { service: f.serviceType || null, date: f.requestedDate || null, time: f.requestedTime || null, region: f.region || null };

      // Resolve vendor ID: nail always 'luxurious-nails'; hair by region
      var apptVendorId = isNail ? 'luxurious-nails'
        : (/oc|orange/i.test(f.region||'') ? 'cali-hair-oc' : 'viet-hair-bayarea');

      var apptMsgLines = [
        svcEmoji + ' LỊCH HẸN ' + svcLabel2.toUpperCase() + ' — ' + orderId,
        '',
        '💆 Dịch vụ: ' + (f.serviceType||''),
        f.region      ? '📍 Khu vực: ' + f.region : null,
        '📅 ' + fmtDate(f.requestedDate) + ' lúc ' + fmtTime(f.requestedTime),
        '👤 ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        f.notes       ? '📝 ' + f.notes : null,
      ];
      var apptMsg = apptMsgLines.filter(function(v){return v!==null;}).join('\n');

      var apptNotifDoc = {
        type:'new_appointment',
        title: svcEmoji + ' Lịch hẹn ' + svcLabel2 + ' — ' + (f.customerName||''),
        message: apptMsg,
        bookingId:orderId, customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        serviceType:f.serviceType||'', region:f.region||'',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        read:false, createdAt:fv.serverTimestamp(),
      };
      var apptBookingDoc = {
        bookingId:orderId, type:draft.intent, vendorId:apptVendorId,
        serviceType:f.serviceType||'', services:[f.serviceType||''],
        region:f.region||'',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', status:'confirmed', source:'ai_chat',
        priceEst: finalPriceEst || null,
        createdAt:fv.serverTimestamp(),
      };
      await db.collection('bookings').doc(orderId).set(apptBookingDoc);
      // Also write to vendor's own subcollection so vendor-admin can see it
      db.collection('vendors').doc(apptVendorId).collection('bookings').doc(orderId).set(apptBookingDoc)
        .catch(function(e){ console.warn('[vendor-booking] write failed:', e.message); });
      // Notify vendor directly so their popup fires
      db.collection('vendors').doc(apptVendorId).collection('notifications').add(apptNotifDoc)
        .catch(function(e){ console.warn('[vendor-notif] write failed:', e.message); });
      // Also notify admin
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add(apptNotifDoc);

    } else if (draft.intent === 'tour_request') {
      var dest   = typeof f.destination === 'object' ? f.destination : { id:'', name:String(f.destination||'') };
      var lodging = f.lodging || 'none';
      trackingToken = genId().replace('DLC-','')+genId().replace('DLC-','');

      // Detect pickup region from startingPoint — determines which fleet (OC vs Bay Area) to dispatch
      var tourRegionId = _detectTourRegion(f.startingPoint);

      var startMapsLink = buildMapsLink(f.startingPoint);
      var lodgeLabel2 = { hotel:'Khách sạn', airbnb:'Airbnb', none:'Tự túc' }[lodging] || lodging;

      var tourMsgLines = [
        '🗺️ TOUR ' + (dest.name||'').toUpperCase() + ' — ' + orderId,
        '',
        '📍 Xuất phát: ' + (f.startingPoint||'') + (startMapsLink ? '\n   Map: ' + startMapsLink : ''),
        '🏁 Điểm đến: ' + (dest.name||''),
        '📅 Khởi hành: ' + fmtDate(f.requestedDate) + ' · ' + (f.days||1) + ' ngày',
        '👥 ' + (f.passengers||1) + ' người',
        '🏨 Chỗ ở: ' + lodgeLabel2 +
          (f.chosenHotel ? ' — ' + f.chosenHotel : '') +
          (f.hotelArea && !f.chosenHotel ? ' (' + f.hotelArea + ')' : '') +
          (f.bookingMode === 'vendor' ? ' — nhờ DLC đặt' : ''),
        '👤 ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        f.notes ? '📝 ' + f.notes : null,
      ];
      var tourMsg = tourMsgLines.filter(function(v){return v!==null;}).join('\n');

      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken,
        status:'pending', serviceType:dest.id||'tour', datetime:f.requestedDate||'',
        address:f.startingPoint||'', passengers:f.passengers||1, days:f.days||1,
        lodging, hotelArea:f.hotelArea||'', hotelBudget:f.hotelBudget||'',
        chosenHotel:f.chosenHotel||'', bookingMode:f.bookingMode||'',
        name:f.customerName||'', phone:f.customerPhone||'',
        notes:f.notes||'', source:'ai_chat',
        region:tourRegionId,  // fleet region derived from pickup address
        driver:null,vehicleLat:null,vehicleLng:null,vehicleHeading:null,etaMinutes:null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:'🗺️ Tour ' + (dest.name||'') + ' — ' + (f.customerName||''),
        message: tourMsg,
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', destination:dest.name||'',
        passengers:f.passengers||1, days:f.days||1,
        lodging, hotelArea:f.hotelArea||'', chosenHotel:f.chosenHotel||'', bookingMode:f.bookingMode||'',
        region:tourRegionId,
        read:false, createdAt:fv.serverTimestamp(),
      });

    } else if (draft.intent === 'private_ride') {
      var datetime = (f.requestedDate && f.requestedTime)
        ? f.requestedDate + 'T' + f.requestedTime + ':00'
        : (f.requestedDate || '');
      var rideEst      = estimateRide(f.passengers, f.pickupAddress, f.dropoffAddress);
      var prRouteLink  = buildRouteLink(f.pickupAddress, f.dropoffAddress);
      trackingToken    = genId().replace('DLC-','') + genId().replace('DLC-','');

      // ── Availability check: notify customer if slot looks busy, but always book ──
      var _prAvailNote = null;
      if (window.DLCRideAvail && f.requestedDate && f.requestedTime) {
        var _prRegion = (window.DLCRegion && window.DLCRegion.current) ? window.DLCRegion.current.id : null;
        if (_prRegion) {
          try {
            var _prAvail = await DLCRideAvail.check(f.requestedDate, f.requestedTime, _prRegion, null);
            if (!_prAvail.available && _prAvail.reason !== 'error' && _prAvail.reason !== 'no_db') {
              _prAvailNote = _prAvail.reason;
            }
          } catch(e) { /* fail open */ }
        }
      }
      // Infer pickupSource: was GPS used for pickup?
      var prPickupSrc  = (f._pickupSource === 'gps') ? 'gps'
                       : (window.DLCLocation && DLCLocation.state && DLCLocation.state.place &&
                          f.pickupAddress === DLCLocation.state.place) ? 'gps' : 'typed';

      var rideBriefLines = [
        '🚗 XE RIÊNG CAO CẤP — ' + orderId,
        '',
        '👤 Khách: ' + (f.customerName||'') + ' · ' + fmtPhone(f.customerPhone),
        '📍 Đón tại: ' + (f.pickupAddress||''),
        '🏁 Điểm đến: ' + (f.dropoffAddress||''),
        prRouteLink ? '🗺️ Tuyến đường: ' + prRouteLink : null,
        '📅 ' + fmtDate(f.requestedDate) + ' · ' + fmtTime(f.requestedTime),
        '👥 ' + (f.passengers||1) + ' người · ' + rideEst.vehicle,
        rideEst.ourPrice
          ? '💰 DLC ~$' + rideEst.ourPrice + (rideEst.uberEst ? ' (Uber ~$' + rideEst.uberEst + ')' : '')
          : null,
        f.notes ? '📝 ' + f.notes : null,
      ];
      var rideBrief = rideBriefLines.filter(function(v){return v!==null;}).join('\n');

      // Phase 4: driver eligibility matching for private rides (all compliant active drivers)
      var prEligDrivers  = (window._activeDrivers || []).filter(function(d){ return d.complianceStatus === 'approved'; });
      var prEligIds      = prEligDrivers.map(function(d){ return d.id||''; }).filter(Boolean);
      var prPreAssigned  = prEligDrivers.length === 1 ? prEligDrivers[0] : null;
      var prBookStatus   = 'dispatching'; // Phase 13: all rides go through offer/accept flow

      var prVehicleType = DLCPricing && DLCPricing.getVehicle ? DLCPricing.getVehicle(f.passengers||1) : (rideEst ? rideEst.vehicle : null);
      await db.collection('bookings').doc(orderId).set({
        bookingId:orderId, trackingToken,
        status:prBookStatus, serviceType:'private_ride', datetime,
        pickupAddress:f.pickupAddress||'', dropoffAddress:f.dropoffAddress||'',
        // Normalized date fields (ride-intake compatible split fields)
        rideDate: f.requestedDate||'',
        rideTime: f.requestedTime||'',
        passengers:f.passengers||1,
        vehicleType: prVehicleType||null,  // capacity-matched vehicle
        // Normalized customer fields
        customerName:f.customerName||'', customerPhone:f.customerPhone||'',
        name:f.customerName||'', phone:f.customerPhone||'',  // keep for backwards compat
        customerEmail:f.customerEmail||'',
        notes:f.notes||'', source:'ai_chat',
        estimatedPrice: rideEst ? rideEst.ourPrice : null,
        estimatedMiles: rideEst ? rideEst.miles : null,
        eligibleDriverIds: prEligIds,
        driver: null, // set when driver accepts offer (Phase 13)
        vehicleLat:null, vehicleLng:null, vehicleHeading:null, etaMinutes:null,
        routeLink:    prRouteLink||null,  // full-trip navigation link for driver
        pickupSource: prPickupSrc,        // 'gps' | 'typed'
        // Hold for admin confirmation if availability check flagged a conflict
        status: _prAvailNote ? 'pending_confirm' : prBookStatus,
        availabilityNote: _prAvailNote ? ('Slot may be busy (' + _prAvailNote + '). Please confirm with customer.') : null,
        createdAt:fv.serverTimestamp(),
      });
      await db.collection('vendors').doc('admin-dlc').collection('notifications').add({
        type:'new_booking',
        title:'🚗 Xe riêng — ' + (f.customerName||''),
        message: rideBrief,
        bookingId:orderId, customerPhone:f.customerPhone||'',
        requestedDate:f.requestedDate||'', requestedTime:f.requestedTime||'',
        pickupAddress:f.pickupAddress||'', dropoffAddress:f.dropoffAddress||'',
        routeLink:prRouteLink||'',
        passengers:f.passengers||1, estimatedPrice:rideEst ? rideEst.ourPrice : null,
        eligibleDriverCount:prEligIds.length, assignedDriverId:prPreAssigned?prPreAssigned.id:null,
        read:false, createdAt:fv.serverTimestamp(),
      });
      // Phase 4: rideNotifications — always write so drivers see all rides
      db.collection('rideNotifications').add({
        bookingId:        orderId,
        serviceType:      'private_ride',
        serviceLabel:     '🚗 Xe Riêng',
        type:             'private_ride',
        eligibleDriverIds:prEligIds,
        assignedDriverId: prPreAssigned ? (prPreAssigned.id||'') : null,
        status:           'new',  // must be 'new' — matches driver-admin.html query
        pickupAddress:    f.pickupAddress||'',
        dropoffAddress:   f.dropoffAddress||'',
        arrivalDate:      f.requestedDate||null,
        arrivalTime:      f.requestedTime||null,
        passengers:       f.passengers||1,
        estimatedPrice:   rideEst ? rideEst.ourPrice : null,
        estimatedMiles:   rideEst ? rideEst.miles : null,
        routeLink:        prRouteLink||null,
        customerName:     f.customerName||'',
        customerPhone:    f.customerPhone||'',
        createdAt:        fv.serverTimestamp(),
      }).catch(function(e){ console.warn('[rideNotif] write failed:', e.message); });
      // Phase 13: write dispatch queue doc to trigger automatic driver offer flow
      db.collection('dispatchQueue').doc(orderId + '_0').set({
        bookingId: orderId, skipDriverIds: [], attempt: 1, status: 'pending',
        createdAt: fv.serverTimestamp(),
      }).catch(function(e){ console.warn('[dispatchQueue] write failed:', e.message); });
      finalDispatchState = {
        status: _prAvailNote ? 'pending_confirm' : prBookStatus,
        eligibleCount: prEligIds.length,
        preAssigned: null,
        availNote: _prAvailNote || null,
      };
      // Phase 5A: queue confirmation email (non-blocking, no-op if no email)
      if (typeof DLCNotifications !== 'undefined') {
        DLCNotifications.queueRideConfirmation({
          bookingId: orderId, customerEmail: f.customerEmail||'',
          customerName: f.customerName||'', name: f.customerName||'',
          serviceType: 'private_ride',
          pickupAddress: f.pickupAddress||'', dropoffAddress: f.dropoffAddress||'',
          datetime: datetime, passengers: f.passengers||1,
          estimatedPrice: rideEst ? rideEst.ourPrice : null,
          trackingToken: trackingToken||'',
          status: prBookStatus,
          driver: null,
        }, draft.lang || 'en');
        // Phase 5B: in-app notifications (admin + customer)
        if (DLCNotifications.queueRideBookedNotification) {
          DLCNotifications.queueRideBookedNotification({
            bookingId: orderId, serviceType: 'private_ride',
            customerName: f.customerName||'', customerPhone: f.customerPhone||'',
            datetime: datetime, passengers: f.passengers||1,
          }, draft.lang || 'en');
        }
      }
    }

    clearDraft(); draft = null;
    return { id: orderId, token: trackingToken || null, priceEst: finalPriceEst, appt: finalApptInfo, dispatchState: finalDispatchState };
  }

  function cancel() { clearDraft(); draft = null; _addrAmbigName = null; }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.DLCWorkflow = {
    isActive:       isActive,
    getDraft:       getDraft,
    detectIntent:   detectIntent,
    startWorkflow:  startWorkflow,
    process:        process,
    finalize:       finalize,
    cancel:         cancel,
    WORKFLOWS:      WORKFLOWS,
    _X:             X,
  };

})();
