'use strict';

(function(root) {
  var DATA = root.MobileBarberData;
  var BOOKING = root.MobileBarberBooking;
  var STORAGE = {
    vendor: 'dlc_mobile_barber_vendor_overrides',
    services: 'dlc_mobile_barber_service_overrides',
    availability: 'dlc_mobile_barber_availability_overrides',
    bookings: 'dlc_mobile_barber_bookings',
    blocks: 'dlc_mobile_barber_unavailable_blocks',
    portfolio: 'dlc_mobile_barber_portfolio_overrides',
    reviews: 'dlc_mobile_barber_review_overrides',
    notified: 'dlc_mobile_barber_notified_booking_ids',
    ownerNotifications: 'dlc_mobile_barber_owner_notifications',
    sound: 'dlc_mobile_barber_sound_alerts'
  };

  var STRINGS = {
    en: {
      pageTitle: 'Mobile Barber Dashboard | Du Lich Cali',
      languageLabel: 'Choose language',
      dashboardKicker: 'Vendor dashboard',
      dashboardTitle: 'Mobile Barber Dashboard',
      dashboardSubtitle: '{business} can manage profile, services, hours, blocks, and booking requests here.',
      publicVendorLink: 'View Public Page',
      notificationTitle: 'Booking alerts',
      soundAlertsLabel: 'Sound alerts:',
      notificationPermissionLabel: 'Browser notifications:',
      lastBookingAlertLabel: 'Last booking alert:',
      enableSoundAlerts: 'Enable Sound Alerts',
      soundAlertsOn: 'On',
      soundAlertsOff: 'Off',
      soundAlertsBlocked: 'Needs enable',
      permissionGranted: 'Granted',
      permissionDenied: 'Denied',
      permissionDefault: 'Not requested',
      permissionUnsupported: 'Not supported',
      lastAlertNone: 'None yet',
      toggleSoundOn: 'Turn sound on',
      toggleSoundOff: 'Turn sound off',
      newBookingAlertTitle: 'New Mobile Barber Booking',
      newBarberBookingAlertTitle: 'New Barber Booking',
      newRideBookingAlertTitle: 'New Ride Booking',
      newTourBookingAlertTitle: 'New Tour Booking',
      notifBellAria: 'Open notification center',
      notifDrawerTitle: 'Notifications',
      notifMarkAllRead: 'Mark all read',
      notifCloseDrawer: 'Close notifications',
      notifEmpty: 'No notifications yet',
      viewBookingAction: 'View Booking',
      dismissAction: 'Dismiss',
      statToday: 'Today',
      statUpcoming: 'Upcoming',
      statPending: 'Pending',
      statInProgress: 'In progress',
      statCompleted: 'Completed today',
      filterAll: 'All',
      filterBarber: 'Barber',
      filterRide: 'Ride',
      filterTour: 'Tour',
      svcBarber: 'Barber',
      svcAirportPickup: 'Airport Pickup',
      svcAirportDropoff: 'Airport Drop-off',
      svcPrivateRide: 'Private Ride',
      svcTour: 'Tour',
      passengersLabel: 'Passengers',
      routeLabel: 'Route',
      durationDaysLabel: 'Duration (days)',
      navigateAction: 'Navigate',
      airportLabel: 'Airport',
      appointmentListTitle: 'Appointments',
      appointmentListHint: 'Tap a card above to switch the list.',
      appointmentListHintToday: 'Showing appointments scheduled for today.',
      appointmentListHintUpcoming: 'Showing future bookings not yet started.',
      appointmentListHintPending: 'Showing requests waiting for your confirmation.',
      appointmentListHintInProgress: 'Showing appointments currently in progress or traveling.',
      appointmentListHintCompleted: "Showing today's completed appointments.",
      confirmTextChip: 'TEXT CONFIRMATION REQUIRED',
      confirmTextChipAria: 'Customer requested SMS confirmation',
      confirmCallChip: 'CALL TO CONFIRM',
      confirmAppChip: 'APP NOTIFICATION',
      confirmationPreferenceLabel: 'Customer preference',
      confirmPrefText: 'SMS (text message)',
      confirmPrefCall: 'Phone call',
      confirmPrefApp: 'In-app notification',
      sendConfirmationTextAction: 'Send Confirmation Text',
      sendConfirmationTextAria: 'Open SMS compose with prefilled confirmation',
      smsConfirmationBody: 'Hi {customer},\n\nThis is {barber} Mobile Barber.\n\nConfirming your appointment:\n\nService: {service}\nDate: {date}\nTime: {time}\n\nReply YES to confirm.\n\nThank you.',
      vendorAiPreviewHeading: 'AI haircut preview',
      vendorAiPreviewBadge: 'AI-generated suggestion — review with customer',
      vendorAiPreviewSelfieAlt: 'Customer selfie (vendor-only)',
      vendorAiPreviewSelfieCaption: 'Customer selfie',
      vendorAiPreviewStyleAlt: 'Customer-selected haircut style',
      vendorAiPreviewStyleCaption: 'Selected style',
      vendorAiPreviewSummaryLabel: 'AI summary',
      vendorAiPreviewSuggestedNotes: 'Suggested cutting notes',
      vendorAiPreviewStyleLabel: 'Style',
      vendorAiPreviewMaintenanceLabel: 'Maintenance',
      vendorAiPreviewAudienceLabel: 'Style for',
      vendorAiPreviewAudienceMan: 'Man',
      vendorAiPreviewAudienceWoman: 'Woman',
      vendorAiPreviewAudienceChild: 'Child',
      vendorAiPreviewAudienceNeutral: 'Unspecified',
      vendorAiPreviewColorLabel: 'Color',
      vendorAiPreviewHighlightLabel: 'Highlights',
      vendorAiPreviewTextureLabel: 'Texture',
      vendorAiPreviewWhyLabel: 'Why it fits',
      vendorAiPreviewSafetyLabel: 'Safety note',
      vendorAiPreviewBarberRefNotes: 'Barber reference notes',
      vendorAiPreviewBarberInstructions: 'Your cutting notes',
      vendorAiPreviewBarberInstructionsPlaceholder: 'Add specific instructions, e.g. #3 sides, scissor on top, square neck.',
      vendorAiPreviewSaveNotesAction: 'Save cutting notes',
      vendorAiPreviewDeleteSelfie: 'Delete selfie (privacy)',
      vendorAiPreviewDeleteConfirm: 'Delete the customer selfie from this booking? This cannot be undone.',
      vendorAiPreviewSelfieDeleted: 'Selfie removed from booking.',
      todayTitle: "Today's appointments",
      pendingTitle: 'Pending confirmations',
      upcomingTitle: 'Upcoming bookings',
      filterUpcoming: 'Upcoming',
      filterAll: 'All',
      filterCompleted: 'Completed',
      filterCancelled: 'Cancelled',
      refreshButton: 'Refresh',
      settingsTitle: 'Settings',
      settingsHint: 'Profile, services, hours, blocks, payments, portfolio, and reviews. Tap a panel to expand.',
      settingsProfileTitle: 'Profile & contact',
      settingsProfileSub: 'Business name, barber, phone, email, service area',
      settingsServicesTitle: 'Services & pricing',
      settingsServicesSub: 'Service menu, prices, durations, buffers',
      settingsHoursTitle: 'Working hours',
      settingsHoursSub: 'Recurring weekly schedule',
      settingsBlocksTitle: 'Unavailable blocks',
      settingsBlocksSub: 'Days off, time off, vacation',
      settingsPaymentsTitle: 'Payments',
      settingsPaymentsSub: 'Cash, Zelle contact, and QR code',
      settingsPortfolioTitle: 'Portfolio images',
      settingsPortfolioSub: 'Photos shown on the public vendor page',
      settingsReviewsTitle: 'Reviews & responses',
      settingsReviewsSub: 'Customer reviews and your replies',
      settingsPromotionsTitle: 'Promotions & discounts',
      settingsPromotionsSub: 'Date-range, quantity-limited, or combined promos',
      promotionsTitle: 'Promotions',
      promotionsHint: 'Create date-range or quantity-limited promotions. Active promos automatically discount the customer\'s price and appear on your landing page.',
      promotionsAddButton: 'Add promotion',
      promotionNameLabel: 'Promotion name (e.g. "Father\'s Day 20% off")',
      promotionDescriptionLabel: 'Description (optional)',
      promotionDiscountLabel: 'Discount % (1 — 90)',
      promotionScopeLabel: 'Applies to',
      promotionScopeAll: 'All my services',
      promotionScopeSelected: 'Selected services only',
      promotionServicesLabel: 'Select services (hold Ctrl/Cmd to pick multiple)',
      promotionStartLabel: 'Start date (optional)',
      promotionEndLabel: 'End date (optional)',
      promotionMaxRedemptionsLabel: 'Max redemptions (0 = unlimited)',
      promotionCodeLabel: 'Promo code (optional)',
      promotionActiveLabel: 'Active',
      promotionDisplayOnCustomerLabel: 'Show on customer landing page',
      promotionsErrorName: 'Promotion name is required.',
      promotionsErrorDiscount: 'Discount must be between 1 and 90.',
      promotionsErrorDates: 'End date must be on or after start date.',
      promotionsErrorServices: 'Pick at least one service for a selected-services promo.',
      promotionsAdded: 'Promotion added.',
      promotionsRemoved: 'Promotion removed.',
      promotionsEmpty: 'No promotions yet. Create one above.',
      promotionsBadgeActive: 'Active',
      promotionsBadgeInactive: 'Inactive',
      promotionsRangeAny: 'No date limit',
      promotionsRedeemed: 'redeemed',
      promotionsUnlimited: 'Unlimited',
      promotionsScopeAll: 'All services',
      promotionsScopeSelected: 'Selected services',
      promotionsPauseAction: 'Pause',
      promotionsResumeAction: 'Resume',
      promotionsDeleteAction: 'Delete',
      promotionsDeleteConfirm: 'Delete this promotion? Customers will no longer see it.',
      promoChipApplied: '{pct}% promo applied',
      profileTitle: 'Profile and contact',
      saveButton: 'Save Profile',
      businessNameLabel: 'Business name',
      barberNameLabel: 'Barber name',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      serviceAreaLabel: 'Service areas',
      travelRadiusLabel: 'Travel radius miles',
      travelFeeLabel: 'Base travel fee',
      servicesManageTitle: 'Services and pricing',
      saveServiceButton: 'Save Service',
      serviceSelectLabel: 'Choose service',
      serviceNameLabel: 'Service name',
      servicePriceLabel: 'Price',
      serviceDurationLabel: 'Duration minutes',
      cleanupBufferLabel: 'Cleanup buffer minutes',
      travelBufferLabel: 'Travel buffer minutes',
      hoursTitle: 'Working hours',
      saveHoursButton: 'Save Hours',
      blocksTitle: 'Unavailable blocks',
      addBlockButton: 'Add Block',
      portfolioTitle: 'Portfolio images',
      portfolioUploadLabel: 'Upload portfolio image',
      portfolioTitleLabel: 'Image title',
      portfolioDescriptionLabel: 'Image description',
      portfolioOrderLabel: 'Display order',
      beforeImageLabel: 'Before image',
      afterImageLabel: 'After image',
      addPortfolioButton: 'Add Image',
      hideAction: 'Hide',
      showAction: 'Show',
      emptyPortfolio: 'No portfolio images yet.',
      reviewsManageTitle: 'Reviews and responses',
      reviewResponseLabel: 'Barber response',
      saveReviewResponsesButton: 'Save Responses',
      emptyReviews: 'No reviews yet.',
      blockDateLabel: 'Date',
      blockStartLabel: 'Start',
      blockEndLabel: 'End',
      blockReasonLabel: 'Reason',
      emptyBookings: 'No bookings in this section.',
      emptyBlocks: 'No unavailable blocks.',
      emptyServices: 'No services yet.',
      customerContact: 'Customer contact',
      customerAddress: 'Service address',
      customerNotes: 'Customer notes',
      appointmentDetails: 'Appointment',
      pricingDetails: 'Pricing',
      paymentDetails: 'Payment',
      paymentsTitle: 'Payments',
      savePaymentsButton: 'Save Payments',
      cashEnabledLabel: 'Cash enabled',
      zelleEnabledLabel: 'Zelle enabled',
      zellePhoneLabel: 'Zelle phone',
      zelleEmailLabel: 'Zelle email',
      zelleQrLabel: 'Upload Zelle QR image',
      zelleQrCurrent: 'Current QR image',
      zellePayPanelTitle: 'Pay with Zelle',
      zelleSendPaymentTo: 'Send payment to:',
      zelleNoInfo: 'Add Zelle phone, email, or QR in Settings > Payments.',
      serviceType: 'Service type',
      servicePrice: 'Service price',
      travelFee: 'Travel fee',
      amountDue: 'Total amount due',
      paymentMethod: 'Payment method',
      paymentStatus: 'Payment status',
      zelleNumber: 'Zelle number',
      vehicleWearCost: 'Vehicle/travel cost included',
      quoteType: 'Quote type',
      paymentNote: 'Payment note',
      paymentCash: 'Cash',
      paymentZelle: 'Zelle',
      paymentUnknown: 'Unknown',
      paymentPaid: 'Paid',
      paymentUnpaid: 'Unpaid',
      paymentRequested: 'Payment requested',
      paymentPending: 'Pending',
      paymentWaived: 'Waived',
      requestZellePaymentAction: 'Request Zelle Payment',
      requestPaymentAction: 'Request payment',
      markPaidAction: 'Mark paid',
      markUnpaidAction: 'Mark unpaid',
      setCashAction: 'Set cash',
      setZelleAction: 'Set Zelle',
      addPaymentNoteAction: 'Payment note',
      completeAction: 'Complete',
      customerCutHistory: 'Customer cut history',
      stylePreference: 'Style preference',
      previousService: 'Previous service',
      referencePhotos: 'Reference photos',
      mapLink: 'Map',
      acceptAction: 'Accept',
      rescheduleAction: 'Reschedule',
      cancelAction: 'Cancel',
      savedToast: 'Saved.',
      statusPending: 'Pending confirmation',
      statusConfirmed: 'Confirmed',
      statusVendorReview: 'Vendor review',
      statusRescheduled: 'Rescheduled',
      statusCancelled: 'Cancelled',
      statusCompleted: 'Completed',
      statusRejected: 'Declined',
      filterNeedsReview: 'Needs review',
      appointmentListHintNeedsReview: 'Showing owner bookings that need review before confirmation.',
      reviewQueueBadge: 'Needs review',
      reviewReasonLabel: 'Review reason',
      reviewConflictsLabel: 'Conflicts found',
      reviewReasonTimeConflict: 'Time conflict with another owner booking',
      reviewReasonOutsideServiceRadius: 'Outside service radius',
      reviewReasonVendorReviewRequired: 'Location or booking details need owner review',
      reviewReasonTourDailyCap: 'Tour daily cap reached',
      reviewReasonOutsideWorkingHours: 'Outside working hours',
      reviewReasonUnknown: 'Owner review required',
      reviewApproveAction: 'Approve',
      reviewRescheduleAction: 'Reschedule',
      reviewDeclineAction: 'Decline',
      reviewRescheduleDateLabel: 'New date',
      reviewRescheduleTimeLabel: 'New time',
      reviewApproveOverrideConfirm: 'This booking still needs review. Approve it anyway?',
      reviewDeclinePrompt: 'Optional decline reason',
      reviewApproveSuccess: 'Booking approved.',
      reviewRescheduleConfirmSuccess: 'Booking rescheduled and confirmed.',
      reviewRescheduleReviewSuccess: 'Booking rescheduled and kept in review.',
      reviewDeclineSuccess: 'Booking declined.',
      reviewApproveBlocked: 'This booking cannot be approved because the guard blocked it.',
      reviewGuardUnavailable: 'Booking guard is unavailable. Try again after refresh.',
      reviewOwnerOnly: 'Only the owner dashboard can review this booking.',
      reviewRescheduleMissing: 'Choose a new date and time.',
      minutesShort: 'min',
      dayMonday: 'Monday',
      dayTuesday: 'Tuesday',
      dayWednesday: 'Wednesday',
      dayThursday: 'Thursday',
      dayFriday: 'Friday',
      daySaturday: 'Saturday',
      daySunday: 'Sunday',
      activeLabel: 'Open'
    },
    vi: {
      pageTitle: 'Bảng Điều Khiển Thợ Cắt Tóc Tại Nhà | Du Lich Cali',
      languageLabel: 'Chọn ngôn ngữ',
      dashboardKicker: 'Bảng điều khiển vendor',
      dashboardTitle: 'Bảng Điều Khiển Mobile Barber',
      dashboardSubtitle: '{business} có thể quản lý hồ sơ, dịch vụ, giờ làm, ngày bận, và yêu cầu đặt lịch tại đây.',
      publicVendorLink: 'Xem Trang Công Khai',
      notificationTitle: 'Thông báo đặt lịch',
      soundAlertsLabel: 'Âm thanh báo lịch:',
      notificationPermissionLabel: 'Thông báo trình duyệt:',
      lastBookingAlertLabel: 'Báo lịch gần nhất:',
      enableSoundAlerts: 'Bật Âm Thanh Báo Lịch',
      soundAlertsOn: 'Bật',
      soundAlertsOff: 'Tắt',
      soundAlertsBlocked: 'Cần bật',
      permissionGranted: 'Đã cho phép',
      permissionDenied: 'Đã chặn',
      permissionDefault: 'Chưa xin quyền',
      permissionUnsupported: 'Không hỗ trợ',
      lastAlertNone: 'Chưa có',
      toggleSoundOn: 'Bật âm thanh',
      toggleSoundOff: 'Tắt âm thanh',
      newBookingAlertTitle: 'Lịch Mobile Barber Mới',
      newBarberBookingAlertTitle: 'Lịch Cắt Tóc Mới',
      newRideBookingAlertTitle: 'Lịch Đưa Đón Mới',
      newTourBookingAlertTitle: 'Lịch Tour Mới',
      notifBellAria: 'Mở trung tâm thông báo',
      notifDrawerTitle: 'Thông báo',
      notifMarkAllRead: 'Đánh dấu đã đọc',
      notifCloseDrawer: 'Đóng thông báo',
      notifEmpty: 'Chưa có thông báo',
      viewBookingAction: 'Xem Lịch',
      dismissAction: 'Bỏ qua',
      statToday: 'Hôm nay',
      statUpcoming: 'Sắp tới',
      statPending: 'Chờ xác nhận',
      statInProgress: 'Đang làm',
      statCompleted: 'Hoàn tất hôm nay',
      filterAll: 'Tất cả',
      filterBarber: 'Cắt tóc',
      filterRide: 'Đưa đón',
      filterTour: 'Tour',
      svcBarber: 'Cắt tóc',
      svcAirportPickup: 'Đón sân bay',
      svcAirportDropoff: 'Tiễn sân bay',
      svcPrivateRide: 'Xe riêng',
      svcTour: 'Tour du lịch',
      passengersLabel: 'Số khách',
      routeLabel: 'Lộ trình',
      durationDaysLabel: 'Số ngày',
      navigateAction: 'Chỉ đường',
      airportLabel: 'Sân bay',
      appointmentListTitle: 'Lịch hẹn',
      appointmentListHint: 'Bấm thẻ ở trên để chuyển danh sách.',
      appointmentListHintToday: 'Hiển thị lịch hẹn cho hôm nay.',
      appointmentListHintUpcoming: 'Hiển thị lịch sắp tới chưa bắt đầu.',
      appointmentListHintPending: 'Hiển thị yêu cầu đang chờ bạn xác nhận.',
      appointmentListHintInProgress: 'Hiển thị lịch đang làm hoặc đang trên đường.',
      appointmentListHintCompleted: 'Hiển thị lịch đã hoàn tất hôm nay.',
      confirmTextChip: 'CẦN XÁC NHẬN QUA TIN NHẮN',
      confirmTextChipAria: 'Khách yêu cầu xác nhận bằng SMS',
      confirmCallChip: 'GỌI ĐIỆN XÁC NHẬN',
      confirmAppChip: 'THÔNG BÁO TRONG APP',
      confirmationPreferenceLabel: 'Khách muốn xác nhận qua',
      confirmPrefText: 'Tin nhắn (SMS)',
      confirmPrefCall: 'Gọi điện',
      confirmPrefApp: 'Thông báo trong app',
      sendConfirmationTextAction: 'Gửi tin xác nhận',
      sendConfirmationTextAria: 'Mở ứng dụng SMS với nội dung xác nhận đã điền sẵn',
      smsConfirmationBody: 'Chào {customer},\n\nĐây là {barber} Mobile Barber.\n\nXác nhận lịch hẹn của bạn:\n\nDịch vụ: {service}\nNgày: {date}\nGiờ: {time}\n\nVui lòng trả lời YES để xác nhận.\n\nCảm ơn bạn.',
      vendorAiPreviewHeading: 'Xem trước kiểu tóc bằng AI',
      vendorAiPreviewBadge: 'Gợi ý do AI tạo — vui lòng xem cùng khách',
      vendorAiPreviewSelfieAlt: 'Ảnh selfie của khách (chỉ thợ xem được)',
      vendorAiPreviewSelfieCaption: 'Selfie của khách',
      vendorAiPreviewStyleAlt: 'Kiểu tóc khách đã chọn',
      vendorAiPreviewStyleCaption: 'Kiểu đã chọn',
      vendorAiPreviewSummaryLabel: 'Tóm tắt AI',
      vendorAiPreviewSuggestedNotes: 'Ghi chú cắt gợi ý',
      vendorAiPreviewStyleLabel: 'Kiểu tóc',
      vendorAiPreviewMaintenanceLabel: 'Mức chăm sóc',
      vendorAiPreviewAudienceLabel: 'Dành cho',
      vendorAiPreviewAudienceMan: 'Nam',
      vendorAiPreviewAudienceWoman: 'Nữ',
      vendorAiPreviewAudienceChild: 'Trẻ em',
      vendorAiPreviewAudienceNeutral: 'Không xác định',
      vendorAiPreviewColorLabel: 'Màu tóc',
      vendorAiPreviewHighlightLabel: 'Highlight',
      vendorAiPreviewTextureLabel: 'Kết cấu',
      vendorAiPreviewWhyLabel: 'Vì sao hợp',
      vendorAiPreviewSafetyLabel: 'Lưu ý an toàn',
      vendorAiPreviewBarberRefNotes: 'Ghi chú tham khảo cho thợ',
      vendorAiPreviewBarberInstructions: 'Ghi chú cắt của bạn',
      vendorAiPreviewBarberInstructionsPlaceholder: 'Thêm hướng dẫn cụ thể, ví dụ: số 3 hai bên, kéo trên đầu, vuông gáy.',
      vendorAiPreviewSaveNotesAction: 'Lưu ghi chú cắt',
      vendorAiPreviewDeleteSelfie: 'Xóa selfie (quyền riêng tư)',
      vendorAiPreviewDeleteConfirm: 'Xóa ảnh selfie của khách khỏi lịch hẹn? Không thể hoàn tác.',
      vendorAiPreviewSelfieDeleted: 'Đã xóa selfie khỏi lịch hẹn.',
      todayTitle: 'Lịch hẹn hôm nay',
      pendingTitle: 'Yêu cầu chờ xác nhận',
      upcomingTitle: 'Lịch hẹn sắp tới',
      filterUpcoming: 'Sắp tới',
      filterAll: 'Tất cả',
      filterCompleted: 'Hoàn tất',
      filterCancelled: 'Đã hủy',
      refreshButton: 'Làm mới',
      settingsTitle: 'Cài đặt',
      settingsHint: 'Hồ sơ, dịch vụ, giờ làm, ngày nghỉ, thanh toán, portfolio, và đánh giá. Bấm vào từng mục để mở rộng.',
      settingsProfileTitle: 'Hồ sơ & liên hệ',
      settingsProfileSub: 'Tên tiệm, thợ, số điện thoại, email, khu vực phục vụ',
      settingsServicesTitle: 'Dịch vụ & giá',
      settingsServicesSub: 'Danh mục dịch vụ, giá, thời lượng, thời gian đệm',
      settingsHoursTitle: 'Giờ làm việc',
      settingsHoursSub: 'Lịch hàng tuần lặp lại',
      settingsBlocksTitle: 'Khoảng thời gian không nhận lịch',
      settingsBlocksSub: 'Ngày nghỉ, giờ nghỉ, kỳ nghỉ',
      settingsPaymentsTitle: 'Thanh toán',
      settingsPaymentsSub: 'Tiền mặt, thông tin Zelle, và mã QR',
      settingsPortfolioTitle: 'Hình portfolio',
      settingsPortfolioSub: 'Hình hiển thị trên trang vendor',
      settingsReviewsTitle: 'Đánh giá & phản hồi',
      settingsReviewsSub: 'Đánh giá khách và phản hồi của bạn',
      settingsPromotionsTitle: 'Khuyến mãi & giảm giá',
      settingsPromotionsSub: 'Theo ngày, theo số lượng, hoặc kết hợp',
      promotionsTitle: 'Khuyến mãi',
      promotionsHint: 'Tạo khuyến mãi theo ngày hoặc theo số lượt. Khuyến mãi đang chạy sẽ tự động giảm giá cho khách và hiện trên trang chính.',
      promotionsAddButton: 'Thêm khuyến mãi',
      promotionNameLabel: 'Tên khuyến mãi (vd: "Cuối tuần Father\'s Day giảm 20%")',
      promotionDescriptionLabel: 'Mô tả (không bắt buộc)',
      promotionDiscountLabel: 'Phần trăm giảm (1 — 90)',
      promotionScopeLabel: 'Áp dụng cho',
      promotionScopeAll: 'Tất cả dịch vụ',
      promotionScopeSelected: 'Chỉ dịch vụ chọn',
      promotionServicesLabel: 'Chọn dịch vụ (giữ Ctrl/Cmd để chọn nhiều)',
      promotionStartLabel: 'Ngày bắt đầu (không bắt buộc)',
      promotionEndLabel: 'Ngày kết thúc (không bắt buộc)',
      promotionMaxRedemptionsLabel: 'Số lượt tối đa (0 = không giới hạn)',
      promotionCodeLabel: 'Mã khuyến mãi (không bắt buộc)',
      promotionActiveLabel: 'Đang chạy',
      promotionDisplayOnCustomerLabel: 'Hiển thị trên trang khách',
      promotionsErrorName: 'Phải có tên khuyến mãi.',
      promotionsErrorDiscount: 'Phần trăm giảm phải từ 1 đến 90.',
      promotionsErrorDates: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
      promotionsErrorServices: 'Chọn ít nhất một dịch vụ cho khuyến mãi theo dịch vụ.',
      promotionsAdded: 'Đã thêm khuyến mãi.',
      promotionsRemoved: 'Đã xóa khuyến mãi.',
      promotionsEmpty: 'Chưa có khuyến mãi. Tạo ở trên.',
      promotionsBadgeActive: 'Đang chạy',
      promotionsBadgeInactive: 'Tạm dừng',
      promotionsRangeAny: 'Không giới hạn ngày',
      promotionsRedeemed: 'đã dùng',
      promotionsUnlimited: 'Không giới hạn',
      promotionsScopeAll: 'Tất cả dịch vụ',
      promotionsScopeSelected: 'Dịch vụ chọn',
      promotionsPauseAction: 'Tạm dừng',
      promotionsResumeAction: 'Tiếp tục',
      promotionsDeleteAction: 'Xóa',
      promotionsDeleteConfirm: 'Xóa khuyến mãi này? Khách sẽ không còn thấy.',
      promoChipApplied: 'Đã áp khuyến mãi {pct}%',
      profileTitle: 'Hồ sơ và liên hệ',
      saveButton: 'Lưu Hồ Sơ',
      businessNameLabel: 'Tên doanh nghiệp',
      barberNameLabel: 'Tên thợ',
      phoneLabel: 'Điện thoại',
      emailLabel: 'Email',
      serviceAreaLabel: 'Khu vực phục vụ',
      travelRadiusLabel: 'Bán kính di chuyển (dặm)',
      travelFeeLabel: 'Phí di chuyển cơ bản',
      servicesManageTitle: 'Dịch vụ và giá',
      saveServiceButton: 'Lưu Dịch Vụ',
      serviceSelectLabel: 'Chọn dịch vụ',
      serviceNameLabel: 'Tên dịch vụ',
      servicePriceLabel: 'Giá',
      serviceDurationLabel: 'Thời lượng (phút)',
      cleanupBufferLabel: 'Thời gian dọn dẹp (phút)',
      travelBufferLabel: 'Thời gian di chuyển (phút)',
      hoursTitle: 'Giờ làm việc',
      saveHoursButton: 'Lưu Giờ',
      blocksTitle: 'Thời gian không nhận lịch',
      addBlockButton: 'Thêm Lịch Bận',
      portfolioTitle: 'Hình portfolio',
      portfolioUploadLabel: 'Tải hình portfolio',
      portfolioTitleLabel: 'Tiêu đề hình',
      portfolioDescriptionLabel: 'Mô tả hình',
      portfolioOrderLabel: 'Thứ tự hiển thị',
      beforeImageLabel: 'Hình trước',
      afterImageLabel: 'Hình sau',
      addPortfolioButton: 'Thêm Hình',
      hideAction: 'Ẩn',
      showAction: 'Hiện',
      emptyPortfolio: 'Chưa có hình portfolio.',
      reviewsManageTitle: 'Đánh giá và phản hồi',
      reviewResponseLabel: 'Phản hồi của thợ',
      saveReviewResponsesButton: 'Lưu Phản Hồi',
      emptyReviews: 'Chưa có đánh giá.',
      blockDateLabel: 'Ngày',
      blockStartLabel: 'Bắt đầu',
      blockEndLabel: 'Kết thúc',
      blockReasonLabel: 'Lý do',
      emptyBookings: 'Không có lịch trong mục này.',
      emptyBlocks: 'Chưa có thời gian không nhận lịch.',
      emptyServices: 'Chưa có dịch vụ.',
      customerContact: 'Liên hệ khách',
      customerAddress: 'Địa chỉ phục vụ',
      customerNotes: 'Ghi chú khách hàng',
      appointmentDetails: 'Lịch hẹn',
      pricingDetails: 'Giá tiền',
      paymentDetails: 'Thanh toán',
      paymentsTitle: 'Thanh toán',
      savePaymentsButton: 'Lưu Thanh Toán',
      cashEnabledLabel: 'Nhận tiền mặt',
      zelleEnabledLabel: 'Nhận Zelle',
      zellePhoneLabel: 'Số điện thoại Zelle',
      zelleEmailLabel: 'Email Zelle',
      zelleQrLabel: 'Tải mã QR Zelle',
      zelleQrCurrent: 'Mã QR hiện tại',
      zellePayPanelTitle: 'Thanh toán bằng Zelle',
      zelleSendPaymentTo: 'Gửi thanh toán đến:',
      zelleNoInfo: 'Thêm số điện thoại, email, hoặc mã QR Zelle trong Cài đặt > Thanh toán.',
      serviceType: 'Loại dịch vụ',
      servicePrice: 'Giá dịch vụ',
      travelFee: 'Phí di chuyển',
      amountDue: 'Tổng cần thu',
      paymentMethod: 'Cách thanh toán',
      paymentStatus: 'Trạng thái thanh toán',
      zelleNumber: 'Số Zelle',
      vehicleWearCost: 'Chi phí xe/di chuyển đã gồm',
      quoteType: 'Loại báo giá',
      paymentNote: 'Ghi chú thanh toán',
      paymentCash: 'Tiền mặt',
      paymentZelle: 'Zelle',
      paymentUnknown: 'Chưa rõ',
      paymentPaid: 'Đã thu',
      paymentUnpaid: 'Chưa thu',
      paymentRequested: 'Đã yêu cầu thanh toán',
      paymentPending: 'Đang chờ',
      paymentWaived: 'Đã miễn',
      requestZellePaymentAction: 'Yêu cầu thanh toán Zelle',
      requestPaymentAction: 'Yêu cầu thanh toán',
      markPaidAction: 'Đánh dấu đã thu',
      markUnpaidAction: 'Đánh dấu chưa thu',
      setCashAction: 'Chọn tiền mặt',
      setZelleAction: 'Chọn Zelle',
      addPaymentNoteAction: 'Ghi chú thanh toán',
      completeAction: 'Hoàn tất',
      customerCutHistory: 'Lịch sử cắt tóc của khách',
      stylePreference: 'Kiểu tóc ưa thích',
      previousService: 'Dịch vụ lần trước',
      referencePhotos: 'Ảnh tham khảo',
      mapLink: 'Bản đồ',
      acceptAction: 'Nhận lịch',
      rescheduleAction: 'Đổi lịch',
      cancelAction: 'Hủy',
      savedToast: 'Đã lưu.',
      statusPending: 'Chờ xác nhận',
      statusConfirmed: 'Đã xác nhận',
      statusVendorReview: 'Vendor xem xét',
      statusRescheduled: 'Đã đổi lịch',
      statusCancelled: 'Đã hủy',
      statusCompleted: 'Hoàn tất',
      statusRejected: 'Đã từ chối',
      filterNeedsReview: 'Cần xem xét',
      appointmentListHintNeedsReview: 'Đang hiển thị lịch của chủ cần xem xét trước khi xác nhận.',
      reviewQueueBadge: 'Cần xem xét',
      reviewReasonLabel: 'Lý do cần xem xét',
      reviewConflictsLabel: 'Xung đột tìm thấy',
      reviewReasonTimeConflict: 'Trùng giờ với lịch khác của chủ',
      reviewReasonOutsideServiceRadius: 'Ngoài bán kính phục vụ',
      reviewReasonVendorReviewRequired: 'Địa điểm hoặc thông tin đặt lịch cần chủ xem xét',
      reviewReasonTourDailyCap: 'Đã đạt giới hạn tour trong ngày',
      reviewReasonOutsideWorkingHours: 'Ngoài giờ làm việc',
      reviewReasonUnknown: 'Cần chủ xem xét',
      reviewApproveAction: 'Duyệt',
      reviewRescheduleAction: 'Đổi lịch',
      reviewDeclineAction: 'Từ chối',
      reviewRescheduleDateLabel: 'Ngày mới',
      reviewRescheduleTimeLabel: 'Giờ mới',
      reviewApproveOverrideConfirm: 'Lịch này vẫn cần xem xét. Vẫn duyệt lịch?',
      reviewDeclinePrompt: 'Lý do từ chối nếu có',
      reviewApproveSuccess: 'Đã duyệt lịch.',
      reviewRescheduleConfirmSuccess: 'Đã đổi lịch và xác nhận.',
      reviewRescheduleReviewSuccess: 'Đã đổi lịch và giữ trong mục xem xét.',
      reviewDeclineSuccess: 'Đã từ chối lịch.',
      reviewApproveBlocked: 'Không thể duyệt lịch này vì hệ thống kiểm tra đã chặn.',
      reviewGuardUnavailable: 'Chưa tải được Booking Guard. Vui lòng làm mới rồi thử lại.',
      reviewOwnerOnly: 'Chỉ bảng điều khiển của chủ mới được xem xét lịch này.',
      reviewRescheduleMissing: 'Chọn ngày và giờ mới.',
      minutesShort: 'phút',
      dayMonday: 'Thứ Hai',
      dayTuesday: 'Thứ Ba',
      dayWednesday: 'Thứ Tư',
      dayThursday: 'Thứ Năm',
      dayFriday: 'Thứ Sáu',
      daySaturday: 'Thứ Bảy',
      daySunday: 'Chủ Nhật',
      activeLabel: 'Mở'
    },
    es: {
      pageTitle: 'Panel de Barbero Móvil | Du Lich Cali',
      languageLabel: 'Elegir idioma',
      dashboardKicker: 'Panel del vendedor',
      dashboardTitle: 'Panel de Barbero Móvil',
      dashboardSubtitle: '{business} puede administrar perfil, servicios, horarios, bloqueos, y solicitudes de reserva aquí.',
      publicVendorLink: 'Ver Página Pública',
      notificationTitle: 'Alertas de reservas',
      soundAlertsLabel: 'Alertas con sonido:',
      notificationPermissionLabel: 'Notificaciones del navegador:',
      lastBookingAlertLabel: 'Última alerta:',
      enableSoundAlerts: 'Activar Sonido',
      soundAlertsOn: 'Activo',
      soundAlertsOff: 'Inactivo',
      soundAlertsBlocked: 'Necesita activar',
      permissionGranted: 'Permitido',
      permissionDenied: 'Denegado',
      permissionDefault: 'No solicitado',
      permissionUnsupported: 'No compatible',
      lastAlertNone: 'Ninguna',
      toggleSoundOn: 'Activar sonido',
      toggleSoundOff: 'Desactivar sonido',
      newBookingAlertTitle: 'Nueva Reserva de Barbero Móvil',
      newBarberBookingAlertTitle: 'Nueva Reserva de Barbero',
      newRideBookingAlertTitle: 'Nueva Reserva de Viaje',
      newTourBookingAlertTitle: 'Nueva Reserva de Tour',
      notifBellAria: 'Abrir centro de notificaciones',
      notifDrawerTitle: 'Notificaciones',
      notifMarkAllRead: 'Marcar todo leído',
      notifCloseDrawer: 'Cerrar notificaciones',
      notifEmpty: 'Aún no hay notificaciones',
      viewBookingAction: 'Ver Reserva',
      dismissAction: 'Descartar',
      statToday: 'Hoy',
      statUpcoming: 'Próximas',
      statPending: 'Pendientes',
      statInProgress: 'En curso',
      statCompleted: 'Completadas hoy',
      filterAll: 'Todos',
      filterBarber: 'Barbero',
      filterRide: 'Viaje',
      filterTour: 'Tour',
      svcBarber: 'Barbero',
      svcAirportPickup: 'Recogida aeropuerto',
      svcAirportDropoff: 'Entrega aeropuerto',
      svcPrivateRide: 'Viaje privado',
      svcTour: 'Tour',
      passengersLabel: 'Pasajeros',
      routeLabel: 'Ruta',
      durationDaysLabel: 'Duración (días)',
      navigateAction: 'Navegar',
      airportLabel: 'Aeropuerto',
      appointmentListTitle: 'Citas',
      appointmentListHint: 'Toca una tarjeta arriba para cambiar la lista.',
      appointmentListHintToday: 'Mostrando citas programadas para hoy.',
      appointmentListHintUpcoming: 'Mostrando reservas futuras aún no iniciadas.',
      appointmentListHintPending: 'Mostrando solicitudes esperando tu confirmación.',
      appointmentListHintInProgress: 'Mostrando citas en curso o en camino.',
      appointmentListHintCompleted: 'Mostrando las citas completadas de hoy.',
      confirmTextChip: 'CONFIRMACIÓN POR SMS REQUERIDA',
      confirmTextChipAria: 'Cliente solicitó confirmación por SMS',
      confirmCallChip: 'LLAMAR PARA CONFIRMAR',
      confirmAppChip: 'NOTIFICACIÓN EN APP',
      confirmationPreferenceLabel: 'Preferencia del cliente',
      confirmPrefText: 'SMS (mensaje de texto)',
      confirmPrefCall: 'Llamada',
      confirmPrefApp: 'Notificación en la app',
      sendConfirmationTextAction: 'Enviar SMS de confirmación',
      sendConfirmationTextAria: 'Abrir SMS con la confirmación rellenada',
      smsConfirmationBody: 'Hola {customer},\n\nSoy {barber} de Mobile Barber.\n\nConfirmando su cita:\n\nServicio: {service}\nFecha: {date}\nHora: {time}\n\nResponda YES para confirmar.\n\nGracias.',
      vendorAiPreviewHeading: 'Vista previa de corte con AI',
      vendorAiPreviewBadge: 'Sugerencia de AI — revise con el cliente',
      vendorAiPreviewSelfieAlt: 'Selfie del cliente (solo barbero)',
      vendorAiPreviewSelfieCaption: 'Selfie del cliente',
      vendorAiPreviewStyleAlt: 'Estilo elegido por el cliente',
      vendorAiPreviewStyleCaption: 'Estilo elegido',
      vendorAiPreviewSummaryLabel: 'Resumen AI',
      vendorAiPreviewSuggestedNotes: 'Notas de corte sugeridas',
      vendorAiPreviewStyleLabel: 'Estilo',
      vendorAiPreviewMaintenanceLabel: 'Mantenimiento',
      vendorAiPreviewAudienceLabel: 'Estilo para',
      vendorAiPreviewAudienceMan: 'Hombre',
      vendorAiPreviewAudienceWoman: 'Mujer',
      vendorAiPreviewAudienceChild: 'Niño/a',
      vendorAiPreviewAudienceNeutral: 'Sin especificar',
      vendorAiPreviewColorLabel: 'Color',
      vendorAiPreviewHighlightLabel: 'Mechas',
      vendorAiPreviewTextureLabel: 'Textura',
      vendorAiPreviewWhyLabel: 'Por qué le queda',
      vendorAiPreviewSafetyLabel: 'Nota de seguridad',
      vendorAiPreviewBarberRefNotes: 'Notas de referencia del barbero',
      vendorAiPreviewBarberInstructions: 'Sus notas de corte',
      vendorAiPreviewBarberInstructionsPlaceholder: 'Instrucciones específicas, p. ej. #3 a los lados, tijera arriba, nuca cuadrada.',
      vendorAiPreviewSaveNotesAction: 'Guardar notas de corte',
      vendorAiPreviewDeleteSelfie: 'Eliminar selfie (privacidad)',
      vendorAiPreviewDeleteConfirm: 'Eliminar la selfie del cliente de esta cita? No se puede deshacer.',
      vendorAiPreviewSelfieDeleted: 'Selfie eliminada de la cita.',
      todayTitle: 'Citas de hoy',
      pendingTitle: 'Confirmaciones pendientes',
      upcomingTitle: 'Reservas próximas',
      filterUpcoming: 'Próximas',
      filterAll: 'Todas',
      filterCompleted: 'Completadas',
      filterCancelled: 'Canceladas',
      refreshButton: 'Actualizar',
      settingsTitle: 'Ajustes',
      settingsHint: 'Perfil, servicios, horario, bloques, pagos, portafolio y reseñas. Toca un panel para expandir.',
      settingsProfileTitle: 'Perfil y contacto',
      settingsProfileSub: 'Nombre del negocio, barbero, teléfono, correo, área de servicio',
      settingsServicesTitle: 'Servicios y precios',
      settingsServicesSub: 'Menú de servicios, precios, duración, márgenes',
      settingsHoursTitle: 'Horario de trabajo',
      settingsHoursSub: 'Horario semanal recurrente',
      settingsBlocksTitle: 'Bloques no disponibles',
      settingsBlocksSub: 'Días libres, tiempo libre, vacaciones',
      settingsPaymentsTitle: 'Pagos',
      settingsPaymentsSub: 'Efectivo, contacto Zelle y QR',
      settingsPortfolioTitle: 'Imágenes del portafolio',
      settingsPortfolioSub: 'Fotos mostradas en la página pública del barbero',
      settingsReviewsTitle: 'Reseñas y respuestas',
      settingsReviewsSub: 'Reseñas de clientes y tus respuestas',
      settingsPromotionsTitle: 'Promociones y descuentos',
      settingsPromotionsSub: 'Por rango de fechas, cantidad limitada o combinado',
      promotionsTitle: 'Promociones',
      promotionsHint: 'Cree promociones por rango de fechas o cantidad limitada. Las activas descuentan el precio del cliente automáticamente y aparecen en la página principal.',
      promotionsAddButton: 'Agregar promoción',
      promotionNameLabel: 'Nombre de la promoción (ej: "Día del Padre 20% off")',
      promotionDescriptionLabel: 'Descripción (opcional)',
      promotionDiscountLabel: 'Descuento % (1 — 90)',
      promotionScopeLabel: 'Aplica a',
      promotionScopeAll: 'Todos mis servicios',
      promotionScopeSelected: 'Solo servicios seleccionados',
      promotionServicesLabel: 'Seleccionar servicios (Ctrl/Cmd para varios)',
      promotionStartLabel: 'Fecha de inicio (opcional)',
      promotionEndLabel: 'Fecha de fin (opcional)',
      promotionMaxRedemptionsLabel: 'Máximo de canjes (0 = ilimitado)',
      promotionCodeLabel: 'Código promo (opcional)',
      promotionActiveLabel: 'Activa',
      promotionDisplayOnCustomerLabel: 'Mostrar en la página del cliente',
      promotionsErrorName: 'El nombre de la promoción es obligatorio.',
      promotionsErrorDiscount: 'El descuento debe estar entre 1 y 90.',
      promotionsErrorDates: 'La fecha final debe ser igual o posterior a la inicial.',
      promotionsErrorServices: 'Elija al menos un servicio para una promoción por servicio.',
      promotionsAdded: 'Promoción agregada.',
      promotionsRemoved: 'Promoción eliminada.',
      promotionsEmpty: 'Aún no hay promociones. Cree una arriba.',
      promotionsBadgeActive: 'Activa',
      promotionsBadgeInactive: 'Inactiva',
      promotionsRangeAny: 'Sin límite de fecha',
      promotionsRedeemed: 'canjeados',
      promotionsUnlimited: 'Ilimitado',
      promotionsScopeAll: 'Todos los servicios',
      promotionsScopeSelected: 'Servicios elegidos',
      promotionsPauseAction: 'Pausar',
      promotionsResumeAction: 'Reanudar',
      promotionsDeleteAction: 'Eliminar',
      promotionsDeleteConfirm: '¿Eliminar esta promoción? Los clientes ya no la verán.',
      promoChipApplied: 'Promoción del {pct}% aplicada',
      profileTitle: 'Perfil y contacto',
      saveButton: 'Guardar Perfil',
      businessNameLabel: 'Nombre del negocio',
      barberNameLabel: 'Nombre del barbero',
      phoneLabel: 'Teléfono',
      emailLabel: 'Email',
      serviceAreaLabel: 'Áreas de servicio',
      travelRadiusLabel: 'Radio de viaje en millas',
      travelFeeLabel: 'Tarifa base de viaje',
      servicesManageTitle: 'Servicios y precios',
      saveServiceButton: 'Guardar Servicio',
      serviceSelectLabel: 'Elegir servicio',
      serviceNameLabel: 'Nombre del servicio',
      servicePriceLabel: 'Precio',
      serviceDurationLabel: 'Duración en minutos',
      cleanupBufferLabel: 'Tiempo de limpieza en minutos',
      travelBufferLabel: 'Tiempo de viaje en minutos',
      hoursTitle: 'Horario de trabajo',
      saveHoursButton: 'Guardar Horario',
      blocksTitle: 'Bloques no disponibles',
      addBlockButton: 'Agregar Bloque',
      portfolioTitle: 'Imágenes del portafolio',
      portfolioUploadLabel: 'Subir imagen del portafolio',
      portfolioTitleLabel: 'Título de la imagen',
      portfolioDescriptionLabel: 'Descripción de la imagen',
      portfolioOrderLabel: 'Orden de visualización',
      beforeImageLabel: 'Imagen antes',
      afterImageLabel: 'Imagen después',
      addPortfolioButton: 'Agregar Imagen',
      hideAction: 'Ocultar',
      showAction: 'Mostrar',
      emptyPortfolio: 'Todavía no hay imágenes.',
      reviewsManageTitle: 'Reseñas y respuestas',
      reviewResponseLabel: 'Respuesta del barbero',
      saveReviewResponsesButton: 'Guardar Respuestas',
      emptyReviews: 'Todavía no hay reseñas.',
      blockDateLabel: 'Fecha',
      blockStartLabel: 'Inicio',
      blockEndLabel: 'Fin',
      blockReasonLabel: 'Razón',
      emptyBookings: 'No hay reservas en esta sección.',
      emptyBlocks: 'No hay bloques no disponibles.',
      emptyServices: 'Todavía no hay servicios.',
      customerContact: 'Contacto del cliente',
      customerAddress: 'Dirección del servicio',
      customerNotes: 'Notas del cliente',
      appointmentDetails: 'Cita',
      pricingDetails: 'Precio',
      paymentDetails: 'Pago',
      paymentsTitle: 'Pagos',
      savePaymentsButton: 'Guardar Pagos',
      cashEnabledLabel: 'Efectivo activo',
      zelleEnabledLabel: 'Zelle activo',
      zellePhoneLabel: 'Telefono Zelle',
      zelleEmailLabel: 'Email Zelle',
      zelleQrLabel: 'Subir QR de Zelle',
      zelleQrCurrent: 'QR actual',
      zellePayPanelTitle: 'Pagar con Zelle',
      zelleSendPaymentTo: 'Enviar pago a:',
      zelleNoInfo: 'Agrega telefono, email o QR de Zelle en Ajustes > Pagos.',
      serviceType: 'Tipo de servicio',
      servicePrice: 'Precio del servicio',
      travelFee: 'Tarifa de viaje',
      amountDue: 'Total a pagar',
      paymentMethod: 'Metodo de pago',
      paymentStatus: 'Estado de pago',
      zelleNumber: 'Numero Zelle',
      vehicleWearCost: 'Costo de viaje incluido',
      quoteType: 'Tipo de cotización',
      paymentNote: 'Nota de pago',
      paymentCash: 'Efectivo',
      paymentZelle: 'Zelle',
      paymentUnknown: 'Desconocido',
      paymentPaid: 'Pagado',
      paymentUnpaid: 'No pagado',
      paymentRequested: 'Pago solicitado',
      paymentPending: 'Pendiente',
      paymentWaived: 'Exento',
      requestZellePaymentAction: 'Solicitar pago Zelle',
      requestPaymentAction: 'Solicitar pago',
      markPaidAction: 'Marcar pagado',
      markUnpaidAction: 'Marcar no pagado',
      setCashAction: 'Usar efectivo',
      setZelleAction: 'Usar Zelle',
      addPaymentNoteAction: 'Nota de pago',
      completeAction: 'Completar',
      customerCutHistory: 'Historial de cortes del cliente',
      stylePreference: 'Preferencia de estilo',
      previousService: 'Servicio anterior',
      referencePhotos: 'Fotos de referencia',
      mapLink: 'Mapa',
      acceptAction: 'Aceptar',
      rescheduleAction: 'Reprogramar',
      cancelAction: 'Cancelar',
      savedToast: 'Guardado.',
      statusPending: 'Pendiente de confirmación',
      statusConfirmed: 'Confirmada',
      statusVendorReview: 'Revisión del vendedor',
      statusRescheduled: 'Reprogramada',
      statusCancelled: 'Cancelada',
      statusCompleted: 'Completada',
      statusRejected: 'Rechazada',
      filterNeedsReview: 'Requiere revisión',
      appointmentListHintNeedsReview: 'Mostrando reservas del dueño que requieren revisión antes de confirmar.',
      reviewQueueBadge: 'Requiere revisión',
      reviewReasonLabel: 'Razón de revisión',
      reviewConflictsLabel: 'Conflictos encontrados',
      reviewReasonTimeConflict: 'Conflicto de horario con otra reserva del dueño',
      reviewReasonOutsideServiceRadius: 'Fuera del radio de servicio',
      reviewReasonVendorReviewRequired: 'La ubicación o los detalles requieren revisión del dueño',
      reviewReasonTourDailyCap: 'Límite diario de tours alcanzado',
      reviewReasonOutsideWorkingHours: 'Fuera del horario de trabajo',
      reviewReasonUnknown: 'Revisión del dueño requerida',
      reviewApproveAction: 'Aprobar',
      reviewRescheduleAction: 'Reprogramar',
      reviewDeclineAction: 'Rechazar',
      reviewRescheduleDateLabel: 'Nueva fecha',
      reviewRescheduleTimeLabel: 'Nueva hora',
      reviewApproveOverrideConfirm: 'Esta reserva aún requiere revisión. ¿Aprobar de todos modos?',
      reviewDeclinePrompt: 'Razón opcional de rechazo',
      reviewApproveSuccess: 'Reserva aprobada.',
      reviewRescheduleConfirmSuccess: 'Reserva reprogramada y confirmada.',
      reviewRescheduleReviewSuccess: 'Reserva reprogramada y mantenida en revisión.',
      reviewDeclineSuccess: 'Reserva rechazada.',
      reviewApproveBlocked: 'Esta reserva no se puede aprobar porque el guard la bloqueó.',
      reviewGuardUnavailable: 'Booking Guard no está disponible. Actualice e intente de nuevo.',
      reviewOwnerOnly: 'Solo el panel del dueño puede revisar esta reserva.',
      reviewRescheduleMissing: 'Elija una nueva fecha y hora.',
      minutesShort: 'min',
      dayMonday: 'Lunes',
      dayTuesday: 'Martes',
      dayWednesday: 'Miércoles',
      dayThursday: 'Jueves',
      dayFriday: 'Viernes',
      daySaturday: 'Sábado',
      daySunday: 'Domingo',
      activeLabel: 'Abierto'
    }
  };

  var DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  var STATUS_LABELS = {
    pending_barber_confirmation: 'statusPending',
    pending_confirmation: 'statusPending',
    confirmed: 'statusConfirmed',
    vendor_review: 'statusVendorReview',
    rescheduled: 'statusRescheduled',
    cancelled: 'statusCancelled',
    completed: 'statusCompleted',
    rejected: 'statusRejected'
  };
  var REVIEW_REASON_LABELS = {
    time_conflict: 'reviewReasonTimeConflict',
    outside_service_radius: 'reviewReasonOutsideServiceRadius',
    vendor_review_required: 'reviewReasonVendorReviewRequired',
    tour_daily_cap: 'reviewReasonTourDailyCap',
    outside_working_hours: 'reviewReasonOutsideWorkingHours'
  };
  var state = {
    lang: 'en',
    vendorId: '',
    vendor: null,
    ownerId: null,
    ownerMode: false,
    serviceTypeFilter: 'all',
    services: [],
    availability: null,
    bookings: [],
    blocks: [],
    portfolio: [],
    reviews: [],
    bookingFilter: 'upcoming',
    summaryFilter: 'today',
    bookingAlertUnsubscribe: null,
    bookingAlertRefreshTimer: null,
    bookingAlertInitialSnapshot: true,
    notifiedBookingIds: {},
    ownerNotifications: [],
    notificationDrawerOpen: false,
    notificationFilter: 'all',
    beforeUnloadBound: false,
    soundAlertsEnabled: true,
    soundReady: false,
    soundBlocked: false,
    lastBookingAlert: '',
    expandedBookingId: null
  };
  var audioCtx = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function trim(value) {
    return String(value == null ? '' : value).trim();
  }

  function t(key) {
    return (STRINGS[state.lang] && STRINGS[state.lang][key]) || STRINGS.en[key] || '';
  }

  function interpolate(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function(_, key) {
      return values[key] == null ? '' : values[key];
    });
  }

  function readJson(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      if (root.localStorage) root.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function readString(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw == null ? fallback : raw;
    } catch (e) {
      return fallback;
    }
  }

  function writeString(key, value) {
    try {
      if (root.localStorage) root.localStorage.setItem(key, String(value));
    } catch (e) {}
  }

  function notifiedStorageKey() {
    return STORAGE.notified + '_' + (state.vendorId || 'unknown');
  }

  function ownerNotificationsStorageKey() {
    return STORAGE.ownerNotifications + '_' + (state.ownerId || 'unknown');
  }

  function soundStorageKey() {
    return STORAGE.sound + '_' + (state.vendorId || 'unknown');
  }

  function getVendorId() {
    var params = new URLSearchParams(root.location.search);
    return params.get('vendorId') || params.get('id') || '';
  }

  function getTodayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function canUseFirestore() {
    return typeof root.firebase !== 'undefined' && root.firebase.firestore && root.firebase.apps && root.firebase.apps.length;
  }

  function noop() {}

  function firestoreDb() {
    return canUseFirestore() ? root.firebase.firestore() : null;
  }

  function seedSamplesOnce() {
    var db = firestoreDb();
    if (!db || !DATA || typeof DATA.seedFirestoreFromSamples !== 'function') return Promise.resolve();
    try {
      if (root.sessionStorage && root.sessionStorage.getItem('dlc_mb_seeded') === '1') return Promise.resolve();
    } catch (e) {}
    return DATA.seedFirestoreFromSamples(db).then(function() {
      try {
        if (root.sessionStorage) root.sessionStorage.setItem('dlc_mb_seeded', '1');
      } catch (e) {}
    });
  }

  function loadVendor() {
    var base = DATA && DATA.findVendorById ? DATA.findVendorById(state.vendorId) : null;
    var overrides = readJson(STORAGE.vendor, {});
    state.vendor = Object.assign({}, clone(base || {}), overrides[state.vendorId] || {});
  }

  // Owner mode: when the logged-in barber vendor belongs to an owner that
  // operates more than one business (e.g. Michael — barber + ride + tour),
  // the dashboard loads ALL of that owner's bookings, not just barber. A
  // single-business owner (e.g. Tim) keeps the normal per-vendor behavior.
  function resolveOwnerMode() {
    state.ownerId = null;
    state.ownerMode = false;
    if (!root.OwnerModel || !root.OwnerModel.resolveOwnerId) return;
    var oid = root.OwnerModel.resolveOwnerId({
      id: state.vendorId,
      ownerId: (state.vendor && state.vendor.ownerId) || null
    });
    if (!oid) return;
    state.ownerId = oid;
    state.ownerMode = !!(root.OwnerModel.ownerHasMultipleBusinesses
      && root.OwnerModel.ownerHasMultipleBusinesses(oid)
      && root.OwnerBookings && root.OwnerBookings.load);
    // The owner hub deep-links into a specific service via ?type=ride|tour|barber.
    if (state.ownerMode) {
      try {
        var t = new URLSearchParams(root.location.search).get('type');
        if (t && ['barber', 'ride', 'tour'].indexOf(t) !== -1) state.serviceTypeFilter = t;
      } catch (e) {}
    }
  }

  // Hydrate state.vendor from Firestore so the dashboard reflects the portal's
  // true persisted state across devices. Firestore is the source of truth for
  // vendor-owned fields (promotions, profile). loadVendor() runs first to give
  // an instant local baseline; this overlays the authoritative Firestore doc,
  // writes it through to the keyed localStorage map, and re-renders.
  function hydrateVendorFromFirestore() {
    var db = firestoreDb();
    if (!db || !state.vendorId) return Promise.resolve(state.vendor);
    return db.collection(DATA.COLLECTIONS.vendors).doc(state.vendorId).get()
      .then(function(doc) {
        if (!doc || !doc.exists) return state.vendor;
        var remote = doc.data() || {};
        // Last-write-wins by updatedAt. The local baseline (loadVendor) already
        // carries any edit this device just saved, which has a newer updatedAt.
        // A stale Firestore doc — or one whose write was rejected by the
        // security rule (e.g. a vendorIds[]-mapped owner) — must NEVER clobber
        // that fresher local state. Firestore wins only when it is strictly
        // newer, i.e. an edit saved on another device.
        var localTs = Date.parse((state.vendor && state.vendor.updatedAt) || '') || 0;
        var remoteTs = Date.parse(remote.updatedAt || '') || 0;
        state.vendor = remoteTs > localTs
          ? Object.assign({}, state.vendor, remote)
          : Object.assign({}, remote, state.vendor);
        var rows = readJson(STORAGE.vendor, {});
        rows[state.vendorId] = state.vendor;
        writeJson(STORAGE.vendor, rows);
        return state.vendor;
      })
      .catch(function() {
        return state.vendor;
      });
  }

  function loadServices() {
    var base = DATA && DATA.listServicesForVendor ? DATA.listServicesForVendor(state.vendorId).map(clone) : [];
    var overrides = readJson(STORAGE.services, {});
    state.services = (overrides[state.vendorId] || base).filter(function(service) {
      return service.vendorId === state.vendorId;
    });
  }

  function loadAvailability() {
    var baseRows = DATA && DATA.sampleAvailability ? DATA.sampleAvailability : [];
    var base = baseRows.find(function(row) { return row.vendorId === state.vendorId; }) || { vendorId: state.vendorId, weeklyHours: {} };
    var overrides = readJson(STORAGE.availability, {});
    state.availability = Object.assign({}, clone(base), overrides[state.vendorId] || {});
    state.availability.weeklyHours = state.availability.weeklyHours || {};
  }

  function loadBookings() {
    function normalizeRows(rows) {
      state.bookings = (rows || []).map(function(booking) {
        return BOOKING && BOOKING.withPaymentDefaults
          ? BOOKING.withPaymentDefaults(booking, state.vendor)
          : booking;
      });
      return state.bookings;
    }
    var localRows = function() {
      return normalizeRows(readJson(STORAGE.bookings, []).filter(function(booking) {
        return booking.vendorId === state.vendorId;
      }));
    };
    var db = firestoreDb();
    if (!db) return Promise.resolve(localRows());
    // Owner mode: pull barber + ride + tour bookings via the unified loader,
    // normalized into the same row shape the dashboard already renders.
    if (state.ownerMode && root.OwnerBookings && root.OwnerBookings.load) {
      return root.OwnerBookings.load(db, state.ownerId, {
        barberVendorIds: root.OwnerBookings.barberVendorIdsFor(state.ownerId)
      }).then(function(rows) {
        return normalizeRows(rows);
      }).catch(function() {
        return localRows();
      });
    }
    return db.collection(DATA.COLLECTIONS.bookings)
      .where('vendorId', '==', state.vendorId)
      .get()
      .then(function(snapshot) {
        var rows = [];
        snapshot.forEach(function(doc) {
          var data = doc.data() || {};
          data.id = data.id || doc.id;
          rows.push(data);
        });
        return normalizeRows(rows);
      })
      .catch(function() {
        return localRows();
      });
  }

  function loadBlocks() {
    var blocks = readJson(STORAGE.blocks, {});
    state.blocks = (blocks[state.vendorId] || []).slice();
  }

  function loadPortfolio() {
    var overrides = readJson(STORAGE.portfolio, {});
    var base = DATA && DATA.listPortfolioForVendor ? DATA.listPortfolioForVendor(state.vendorId, null, true).map(clone) : [];
    state.portfolio = (overrides[state.vendorId] || base).filter(function(image) {
      return image.vendorId === state.vendorId;
    }).sort(function(a, b) {
      return (Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
    });
  }

  function loadReviews() {
    var overrides = readJson(STORAGE.reviews, {});
    var base = DATA && DATA.listReviewsForVendor ? DATA.listReviewsForVendor(state.vendorId, null, true).map(clone) : [];
    state.reviews = (overrides[state.vendorId] || base).filter(function(review) {
      return review.vendorId === state.vendorId;
    });
  }

  function persistVendor() {
    var rows = readJson(STORAGE.vendor, {});
    rows[state.vendorId] = state.vendor;
    writeJson(STORAGE.vendor, rows);
    if (canUseFirestore()) {
      root.firebase.firestore().collection(DATA.COLLECTIONS.vendors).doc(state.vendorId).set(state.vendor, { merge: true });
    }
  }

  function persistServices() {
    var rows = readJson(STORAGE.services, {});
    rows[state.vendorId] = state.services;
    writeJson(STORAGE.services, rows);
  }

  function persistAvailability() {
    var rows = readJson(STORAGE.availability, {});
    rows[state.vendorId] = state.availability;
    writeJson(STORAGE.availability, rows);
    // Publish working hours to Firestore so the customer landing, AI agent,
    // and manual booking on any device read the vendor's live hours — same
    // merge pattern as persistVendorPromotions. Blocks/hours used to live in
    // this browser's localStorage only, so no customer device could see them.
    if (!canUseFirestore() || !state.vendorId) return;
    root.firebase.firestore().collection(DATA.COLLECTIONS.vendors).doc(state.vendorId)
      .set({ availability: state.availability, updatedAt: new Date().toISOString() }, { merge: true })
      .catch(function(err) {
        if (root.console) root.console.error('[mobile-barber-dashboard] save availability failed', err);
      });
  }

  function persistBlocks() {
    var rows = readJson(STORAGE.blocks, {});
    rows[state.vendorId] = state.blocks;
    writeJson(STORAGE.blocks, rows);
    // Publish calendar blocks to Firestore so the booking guard on every
    // customer device (manual + AI) treats the vendor's blocked slots as
    // unavailable. Field name matches checkAvailability's `unavailableBlocks`.
    if (!canUseFirestore() || !state.vendorId) return;
    root.firebase.firestore().collection(DATA.COLLECTIONS.vendors).doc(state.vendorId)
      .set({ unavailableBlocks: state.blocks, updatedAt: new Date().toISOString() }, { merge: true })
      .catch(function(err) {
        if (root.console) root.console.error('[mobile-barber-dashboard] save blocks failed', err);
      });
  }

  function persistPortfolio() {
    var rows = readJson(STORAGE.portfolio, {});
    rows[state.vendorId] = state.portfolio;
    writeJson(STORAGE.portfolio, rows);
  }

  function persistReviews() {
    var rows = readJson(STORAGE.reviews, {});
    rows[state.vendorId] = state.reviews;
    writeJson(STORAGE.reviews, rows);
  }

  function bookingById(bookingId) {
    return (state.bookings || []).filter(function(b) {
      return b.id === bookingId || b.bookingId === bookingId;
    })[0] || null;
  }

  // Owner mode routes writes to the row's own collection (barber →
  // mobileBarberBookings, ride/airport → bookings, tour → travel_bookings).
  // Outside owner mode every row is a barber booking, so this returns the
  // barber collection and existing behavior is unchanged.
  function targetCollectionFor(bookingId) {
    var b = bookingById(bookingId);
    if (b && b.sourceCollection) return b.sourceCollection;
    return DATA.COLLECTIONS.bookings;
  }

  function isInactiveStatus(status) {
    return ['cancelled', 'completed', 'rejected', 'expired', 'no_show'].indexOf(String(status || '').toLowerCase()) >= 0;
  }

  function updateBookingStatus(bookingId, status) {
    var booking = bookingById(bookingId);
    var isBarber = !booking || !booking.serviceType || booking.serviceType === 'barber';
    var all = readJson(STORAGE.bookings, []);
    all = all.map(function(b) {
      if (b.id !== bookingId) return b;
      return Object.assign({}, b, { status: status, updatedAt: new Date().toISOString() });
    });
    writeJson(STORAGE.bookings, all);
    var writePromise = canUseFirestore()
      ? root.firebase.firestore().collection(targetCollectionFor(bookingId)).doc(bookingId).set({
          status: status,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      : Promise.resolve();
    writePromise.then(function() {
      // Barber status-change SMS only; ride/tour notifications are Phase 2.
      if (isBarber && booking && root.DLCNotifications && typeof root.DLCNotifications.queueMobileBarberStatusChange === 'function') {
        try {
          root.DLCNotifications.queueMobileBarberStatusChange(
            Object.assign({}, booking, { status: status }),
            state.vendor || {},
            status,
            state.lang || 'en'
          );
        } catch (e) {
          if (root.console) root.console.warn('[mobile-barber-dashboard] notify failed', e);
        }
      }
    }).catch(function(err) {
      if (root.console) root.console.error('[mobile-barber-dashboard] status write failed', err);
    });
    loadBookings().then(render);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  // Inline SVG icon helpers (MBIcons). Degrade gracefully to text-only if the
  // icon module failed to load so labels are never lost.
  function icoMarkup(name) {
    var I = (typeof window !== 'undefined') && window.MBIcons;
    return (I && I.markup) ? I.markup(name) : '';
  }
  function icoLabel(node, name, text) {
    var I = (typeof window !== 'undefined') && window.MBIcons;
    if (I && I.label) return I.label(node, name, text);
    node.textContent = (text == null) ? '' : String(text);
    return node;
  }

  function setTranslatedText() {
    document.querySelectorAll('[data-i18n]').forEach(function(node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
  }

  function showToast(key) {
    var toast = document.getElementById('mbDashboardToast');
    toast.textContent = t(key || 'savedToast');
    toast.hidden = false;
    root.setTimeout(function() { toast.hidden = true; }, 1800);
  }

  function notificationPermissionLabel() {
    if (!('Notification' in root)) return t('permissionUnsupported');
    return t({
      granted: 'permissionGranted',
      denied: 'permissionDenied',
      default: 'permissionDefault'
    }[root.Notification.permission] || 'permissionDefault');
  }

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (root.AudioContext || root.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    return audioCtx;
  }

  function renderNotificationControls() {
    var soundState = document.getElementById('mbSoundAlertState');
    var permission = document.getElementById('mbNotificationPermissionState');
    var last = document.getElementById('mbLastBookingAlert');
    var toggle = document.getElementById('mbToggleSoundAlerts');
    var enable = document.querySelector('[data-action="enableSoundAlerts"]');
    if (soundState) {
      soundState.textContent = state.soundBlocked ? t('soundAlertsBlocked') : (state.soundAlertsEnabled ? t('soundAlertsOn') : t('soundAlertsOff'));
    }
    if (permission) permission.textContent = notificationPermissionLabel();
    if (last) last.textContent = state.lastBookingAlert || t('lastAlertNone');
    if (toggle) toggle.textContent = state.soundAlertsEnabled ? t('toggleSoundOff') : t('toggleSoundOn');
    if (enable) enable.hidden = state.soundReady && !state.soundBlocked;
  }

  function notificationIcon(serviceType) {
    return serviceType === 'ride' ? 'car' : (serviceType === 'tour' ? 'compass' : 'scissors');
  }

  function renderNotificationDrawer() {
    var bell = document.getElementById('mbNotifBell');
    var badge = document.getElementById('mbNotifBadge');
    var drawer = document.getElementById('mbNotifDrawer');
    var list = document.getElementById('mbNotifList');
    var tabs = document.getElementById('mbNotifTabs');
    var close = document.querySelector('[data-action="closeNotifDrawer"] .mb-notif-drawer__close') || document.querySelector('.mb-notif-drawer__close');
    if (bell) {
      bell.hidden = !state.ownerMode;
      bell.setAttribute('aria-label', t('notifBellAria'));
    }
    if (close) close.setAttribute('aria-label', t('notifCloseDrawer'));
    if (!state.ownerMode) {
      if (drawer) drawer.hidden = true;
      return;
    }
    var unread = (state.ownerNotifications || []).filter(function(item) { return !item.read; }).length;
    if (badge) {
      badge.textContent = String(unread > 99 ? '99+' : unread);
      badge.hidden = unread === 0;
    }
    if (drawer) {
      drawer.hidden = !state.notificationDrawerOpen;
      drawer.classList.toggle('mb-notif-drawer--open', !!state.notificationDrawerOpen);
    }
    if (tabs) {
      var defs = [
        { key: 'all', label: 'filterAll' },
        { key: 'barber', label: 'filterBarber' },
        { key: 'ride', label: 'filterRide' },
        { key: 'tour', label: 'filterTour' }
      ];
      tabs.innerHTML = '';
      defs.forEach(function(def) {
        var btn = el('button', 'mb-notif-tabs__btn');
        var active = (state.notificationFilter || 'all') === def.key;
        btn.type = 'button';
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.classList.toggle('mb-notif-tabs__btn--active', active);
        btn.textContent = t(def.label);
        btn.addEventListener('click', function() {
          state.notificationFilter = def.key;
          renderNotificationDrawer();
        });
        tabs.appendChild(btn);
      });
    }
    if (!list) return;
    var filter = state.notificationFilter || 'all';
    var rows = (state.ownerNotifications || []).filter(function(item) {
      return filter === 'all' || item.serviceType === filter;
    });
    list.innerHTML = '';
    if (!rows.length) {
      var empty = el('p', 'mb-notif-empty');
      empty.textContent = t('notifEmpty');
      list.appendChild(empty);
      return;
    }
    rows.forEach(function(item) {
      var row = el('button', 'mb-notif-item');
      row.type = 'button';
      row.classList.toggle('mb-notif-item--unread', !item.read);
      row.setAttribute('data-notif-id', item.id);
      var icon = el('span', 'mb-notif-item__icon mb-ico');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = icoMarkup(notificationIcon(item.serviceType));
      var body = el('span', 'mb-notif-item__body');
      var title = el('strong');
      var message = el('span');
      title.textContent = item.title || t(alertTitleKeyFor(item));
      message.textContent = item.message || '';
      body.appendChild(title);
      body.appendChild(message);
      var dot = el('span', 'mb-notif-item__dot');
      dot.setAttribute('aria-hidden', 'true');
      row.appendChild(icon);
      row.appendChild(body);
      row.appendChild(dot);
      row.addEventListener('click', function() { openBookingFromNotification(item); });
      list.appendChild(row);
    });
  }

  function openNotificationDrawer() {
    if (!state.ownerMode) return;
    if (!state.soundReady) unlockSoundAlerts();
    state.notificationDrawerOpen = true;
    renderNotificationDrawer();
  }

  function closeNotificationDrawer() {
    state.notificationDrawerOpen = false;
    renderNotificationDrawer();
  }

  function unlockSoundAlerts() {
    state.soundAlertsEnabled = true;
    state.soundBlocked = false;
    writeString(soundStorageKey(), 'on');
    if ('Notification' in root && root.Notification.permission === 'default' && root.Notification.requestPermission) {
      try {
        root.Notification.requestPermission().then(renderNotificationControls).catch(noop);
      } catch (e) {}
    }
    var ctx = getAudioCtx();
    if (!ctx) {
      state.soundReady = false;
      state.soundBlocked = true;
      renderNotificationControls();
      return Promise.resolve(false);
    }
    var ready = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    return ready.then(function() {
      state.soundReady = ctx.state !== 'suspended';
      renderNotificationControls();
      return state.soundReady;
    }).catch(function() {
      state.soundReady = false;
      state.soundBlocked = true;
      renderNotificationControls();
      return false;
    });
  }

  function playBookingChime() {
    if (!state.soundAlertsEnabled) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    function doPlay() {
      try {
        [523.25, 659.25, 783.99].forEach(function(freq, i) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          var start = ctx.currentTime + i * 0.18;
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.24, start + 0.035);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.58);
        });
        state.soundReady = true;
        state.soundBlocked = false;
      } catch (e) {
        state.soundBlocked = true;
      }
      renderNotificationControls();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(doPlay).catch(function() {
        state.soundReady = false;
        state.soundBlocked = true;
        renderNotificationControls();
      });
    } else {
      doPlay();
    }
  }

  function mapUrl(booking) {
    var address = [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  }

  function statusLabel(status) {
    return t(STATUS_LABELS[status] || 'statusPending');
  }

  function formatMoney(value) {
    return '$' + Number(value || 0).toFixed(0);
  }

  function formatTime12Hour(value) {
    return BOOKING && BOOKING.formatTime12Hour ? BOOKING.formatTime12Hour(value) : String(value || '');
  }

  function bookingStartMillis(booking) {
    var raw = [booking.requestedDate || '', booking.startTime || '00:00'].join('T');
    var parsed = Date.parse(raw);
    return isNaN(parsed) ? 0 : parsed;
  }

  function isUpcomingBooking(booking, now) {
    var status = booking.status || '';
    return status !== 'cancelled' && status !== 'completed' && bookingStartMillis(booking) >= now.getTime();
  }

  function filteredBookings(now) {
    now = now || new Date();
    var rows = (state.bookings || []).slice();
    if (state.bookingFilter === 'completed') rows = rows.filter(function(b) { return b.status === 'completed'; });
    else if (state.bookingFilter === 'cancelled') rows = rows.filter(function(b) { return b.status === 'cancelled'; });
    else if (state.bookingFilter === 'upcoming') rows = rows.filter(function(b) { return isUpcomingBooking(b, now); });
    return rows.sort(function(a, b) { return bookingStartMillis(a) - bookingStartMillis(b); });
  }

  function serviceForBooking(booking) {
    return (state.services || []).filter(function(service) {
      return service.id === booking.serviceId;
    })[0] || {};
  }

  function paymentMethodLabel(method) {
    method = BOOKING && BOOKING.normalizePaymentMethod ? BOOKING.normalizePaymentMethod(method) : (method || 'unknown');
    return t({ cash: 'paymentCash', zelle: 'paymentZelle', unknown: 'paymentUnknown' }[method] || 'paymentUnknown');
  }

  function paymentStatusLabel(status) {
    status = BOOKING && BOOKING.normalizePaymentStatus ? BOOKING.normalizePaymentStatus(status) : (status || 'unpaid');
    return t({ paid: 'paymentPaid', unpaid: 'paymentUnpaid', payment_requested: 'paymentRequested', pending: 'paymentPending', waived: 'paymentWaived' }[status] || 'paymentUnpaid');
  }

  function paymentMethodCode(method) {
    return BOOKING && BOOKING.normalizePaymentMethod ? BOOKING.normalizePaymentMethod(method) : String(method || 'cash').toLowerCase();
  }

  function paymentStatusCode(status) {
    return BOOKING && BOOKING.normalizePaymentStatus ? BOOKING.normalizePaymentStatus(status) : String(status || 'unpaid').toLowerCase();
  }

  function paymentChip(kind, code, label) {
    var chip = el('span', 'mb-payment-chip mb-payment-chip--' + kind + ' mb-payment-chip--' + String(code || '').replace(/[^a-z0-9_-]/gi, ''));
    chip.textContent = label;
    return chip;
  }

  function vendorZelleInfo() {
    var vendor = state.vendor || {};
    return {
      qr: trim(vendor.zelleQrUrl),
      phone: trim(vendor.zellePhone) || trim(vendor.phone),
      email: trim(vendor.zelleEmail) || trim(vendor.email)
    };
  }

  function zellePaymentPanel() {
    var info = vendorZelleInfo();
    var panel = el('div', 'mb-zelle-panel');
    var title = el('h4');
    title.textContent = t('zellePayPanelTitle');
    panel.appendChild(title);
    if (info.qr) {
      var img = document.createElement('img');
      img.src = info.qr;
      img.alt = t('zelleQrCurrent');
      panel.appendChild(img);
    }
    var label = el('p', 'mb-zelle-panel__label');
    label.textContent = t('zelleSendPaymentTo');
    panel.appendChild(label);
    var value = el('p', 'mb-zelle-panel__value');
    if (info.qr) value.textContent = info.phone || info.email || '';
    else value.textContent = info.phone || info.email || t('zelleNoInfo');
    panel.appendChild(value);
    if (info.phone && info.email && !info.qr) {
      var email = el('p', 'mb-zelle-panel__value');
      email.textContent = info.email;
      panel.appendChild(email);
    }
    return panel;
  }

  function confirmationPreferenceLabel(pref) {
    var key = { text: 'confirmPrefText', call: 'confirmPrefCall', app: 'confirmPrefApp' }[String(pref || '').toLowerCase()] || 'confirmPrefText';
    return t(key);
  }

  // Phone-friendly digits only (preserves leading + if present).
  function smsAddress(phone) {
    var s = String(phone || '').trim();
    if (!s) return '';
    var plus = s.charAt(0) === '+' ? '+' : '';
    return plus + s.replace(/[^\d]/g, '');
  }

  function buildConfirmationSmsHref(booking) {
    var customerPhone = smsAddress(booking.customerPhone);
    if (!customerPhone) return '#';
    var body = buildConfirmationSmsBody(booking);
    // iOS uses ?&body=; Android tolerates ?body=. ?&body= works for both.
    return 'sms:' + customerPhone + '?&body=' + encodeURIComponent(body);
  }

  function buildConfirmationSmsBody(booking) {
    var firstName = String(booking.customerName || '').trim().split(/\s+/)[0] || 'there';
    var barber = (state.vendor && (state.vendor.barberName || state.vendor.businessName)) || 'your barber';
    var serviceName = booking.serviceName || '';
    var date = booking.requestedDate || '';
    var time = formatTime12Hour(booking.startTime) || booking.startTime || '';
    return interpolate(t('smsConfirmationBody'), {
      customer: firstName,
      barber: barber,
      service: serviceName,
      date: date,
      time: time
    });
  }

  function detailSection(title, rows) {
    var section = el('div', 'mb-booking-card__section');
    var heading = el('h4');
    var dl = el('dl', 'mb-booking-card__details');
    heading.textContent = title;
    rows.forEach(function(row) {
      if (row[1] == null || row[1] === '') return;
      var wrap = el('div');
      var dt = el('dt');
      var dd = el('dd');
      dt.textContent = row[0];
      if (row[1] && row[1].nodeType) dd.appendChild(row[1]);
      else dd.textContent = row[1];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    });
    section.appendChild(heading);
    section.appendChild(dl);
    return section;
  }

  function updateBookingPatch(bookingId, patch) {
    var now = new Date().toISOString();
    patch = Object.assign({}, patch || {}, { updatedAt: now });
    var all = readJson(STORAGE.bookings, []);
    all = all.map(function(b) {
      return b.id === bookingId ? Object.assign({}, b, patch) : b;
    });
    writeJson(STORAGE.bookings, all);
    state.bookings = state.bookings.map(function(b) {
      return b.id === bookingId ? (BOOKING.withPaymentDefaults ? BOOKING.withPaymentDefaults(Object.assign({}, b, patch), state.vendor) : Object.assign({}, b, patch)) : b;
    });
    render();
    if (canUseFirestore()) {
      return root.firebase.firestore().collection(targetCollectionFor(bookingId)).doc(bookingId).set(patch, { merge: true })
        .catch(function(err) {
          if (root.console) root.console.error('[mobile-barber-dashboard] booking patch failed', err);
          throw err;
        });
    }
    return Promise.resolve();
  }

  function updateBookingPayment(bookingId, patch) {
    if (patch.paymentMethod != null && BOOKING && BOOKING.normalizePaymentMethod) {
      patch.paymentMethod = BOOKING.normalizePaymentMethod(patch.paymentMethod);
    }
    if (patch.paymentStatus != null && BOOKING && BOOKING.normalizePaymentStatus) {
      patch.paymentStatus = BOOKING.normalizePaymentStatus(patch.paymentStatus);
    }
    updateBookingPatch(bookingId, patch);
  }

  // Map a booking status onto one of six visual buckets used by the row
  // (pending / confirmed / traveling / completed / cancelled / repeat).
  function statusBucket(status) {
    switch (status) {
      case 'pending_confirmation':
      case 'pending_barber_confirmation':
      case 'vendor_review': return 'pending';
      case 'confirmed': return 'confirmed';
      case 'in_progress':
      case 'traveling':    return 'traveling';
      case 'completed':    return 'completed';
      case 'cancelled':    return 'cancelled';
      case 'rejected':     return 'cancelled';
      default:             return 'pending';
    }
  }

  function reviewReasonKey(reason) {
    return REVIEW_REASON_LABELS[String(reason || '').toLowerCase()] || 'reviewReasonUnknown';
  }

  function reviewReasonLabel(booking) {
    return t(reviewReasonKey(booking && booking.reviewReason));
  }

  function isOwnerReviewBooking(booking) {
    return !!(state.ownerMode && booking && booking.status === 'vendor_review');
  }

  function ownerCanReviewBooking(booking) {
    if (!isOwnerReviewBooking(booking) || !state.ownerId) return false;
    if (booking.ownerId && booking.ownerId !== state.ownerId) return false;
    if (booking.serviceType === 'barber' && root.OwnerBookings && root.OwnerBookings.barberVendorIdsFor) {
      var ids = root.OwnerBookings.barberVendorIdsFor(state.ownerId) || [];
      return ids.indexOf(booking.vendorId) >= 0;
    }
    return true;
  }

  function addMinutesToTime(time, minutes) {
    var raw = String(time || '').slice(0, 5);
    var m = raw.match(/^(\d{1,2}):([0-5]\d)$/);
    if (!m) return '';
    var total = Number(m[1]) * 60 + Number(m[2]) + Number(minutes || 0);
    total = Math.max(0, Math.min(1439, total));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  function reviewGuardRequest(booking, overrides) {
    overrides = overrides || {};
    var service = serviceForBooking(booking);
    var requestedDate = overrides.requestedDate || booking.requestedDate || booking.date || booking.travel_date || '';
    var startTime = overrides.startTime || booking.startTime || booking.time || '';
    var duration = Number(booking.durationMinutes || booking.serviceDurationMinutes || service.durationMinutes || 60);
    var endTime = overrides.endTime || booking.endTime || addMinutesToTime(startTime, duration);
    return Object.assign({}, booking, overrides, {
      ownerId: state.ownerId || booking.ownerId || '',
      serviceType: serviceTypeForBooking(booking),
      vendorId: booking.vendorId || state.vendorId || '',
      requestedDate: requestedDate,
      startTime: startTime,
      endTime: endTime,
      serviceDurationMinutes: duration,
      durationMinutes: duration,
      source: 'owner_dashboard_review'
    });
  }

  function ownerReviewRowsExcept(bookingId) {
    return (state.bookings || []).filter(function(row) {
      var id = row.id || row.bookingId || '';
      return id !== bookingId;
    });
  }

  function validateReviewBooking(booking, overrides) {
    if (!root.BookingGuard || typeof root.BookingGuard.validateUnifiedBookingRequest !== 'function') {
      showToast('reviewGuardUnavailable');
      return Promise.resolve({ disposition: 'block', reason: 'invalid_request', conflicts: [] });
    }
    return root.BookingGuard.validateUnifiedBookingRequest(reviewGuardRequest(booking, overrides), {
      existingBookings: ownerReviewRowsExcept(booking.id || booking.bookingId || '')
    });
  }

  function clearReviewPatch(extra) {
    return Object.assign({
      reviewReason: null,
      reviewConflicts: [],
      reviewDisposition: null
    }, extra || {});
  }

  function approveReviewBooking(bookingId) {
    var booking = bookingById(bookingId);
    if (!ownerCanReviewBooking(booking)) {
      showToast('reviewOwnerOnly');
      return;
    }
    validateReviewBooking(booking).then(function(result) {
      if (result.disposition === 'block') {
        showToast('reviewApproveBlocked');
        return;
      }
      if (result.disposition === 'review' && (!root.confirm || !root.confirm(t('reviewApproveOverrideConfirm')))) return;
      updateBookingPatch(bookingId, clearReviewPatch({ status: 'confirmed' }))
        .then(function() { showToast('reviewApproveSuccess'); });
    }).catch(function(err) {
      if (root.console) root.console.error('[mobile-barber-dashboard] review approve failed', err);
      showToast('reviewApproveBlocked');
    });
  }

  function rescheduleReviewBooking(bookingId) {
    var booking = bookingById(bookingId);
    if (!ownerCanReviewBooking(booking)) {
      showToast('reviewOwnerOnly');
      return;
    }
    var dateEl = document.getElementById('mbReviewDate-' + bookingId);
    var timeEl = document.getElementById('mbReviewTime-' + bookingId);
    var requestedDate = dateEl && dateEl.value;
    var startTime = timeEl && timeEl.value;
    if (!requestedDate || !startTime) {
      showToast('reviewRescheduleMissing');
      return;
    }
    var service = serviceForBooking(booking);
    var duration = Number(booking.durationMinutes || booking.serviceDurationMinutes || service.durationMinutes || 60);
    var endTime = addMinutesToTime(startTime, duration);
    validateReviewBooking(booking, {
      requestedDate: requestedDate,
      startTime: startTime,
      endTime: endTime,
      serviceDurationMinutes: duration,
      durationMinutes: duration
    }).then(function(result) {
      if (result.disposition === 'block') {
        showToast('reviewApproveBlocked');
        return;
      }
      var patch = {
        requestedDate: requestedDate,
        startTime: startTime,
        endTime: endTime,
        durationMinutes: duration,
        serviceDurationMinutes: duration
      };
      if (result.disposition === 'confirm') {
        patch = clearReviewPatch(Object.assign(patch, { status: 'confirmed' }));
      } else {
        patch.status = 'vendor_review';
        patch.reviewReason = result.reason || 'vendor_review_required';
        patch.reviewConflicts = result.conflicts || [];
        patch.reviewDisposition = result.disposition || 'review';
      }
      updateBookingPatch(bookingId, patch).then(function() {
        showToast(result.disposition === 'confirm' ? 'reviewRescheduleConfirmSuccess' : 'reviewRescheduleReviewSuccess');
      });
    }).catch(function(err) {
      if (root.console) root.console.error('[mobile-barber-dashboard] review reschedule failed', err);
      showToast('reviewApproveBlocked');
    });
  }

  function declineReviewBooking(bookingId) {
    var booking = bookingById(bookingId);
    if (!ownerCanReviewBooking(booking)) {
      showToast('reviewOwnerOnly');
      return;
    }
    var reason = root.prompt ? root.prompt(t('reviewDeclinePrompt'), booking.declineReason || '') : '';
    if (reason == null) return;
    updateBookingPatch(bookingId, clearReviewPatch({
      status: 'rejected',
      declineReason: trim(reason)
    })).then(function() {
      showToast('reviewDeclineSuccess');
    });
  }

  function buildReviewActions(booking) {
    var panel = el('div', 'mb-review-actions');
    panel.setAttribute('data-review-actions', booking.id || '');
    var reschedule = el('div', 'mb-review-actions__reschedule');
    var dateLabel = el('label', 'mb-field mb-review-actions__field');
    var dateText = el('span');
    var dateInput = el('input');
    dateText.textContent = t('reviewRescheduleDateLabel');
    dateInput.id = 'mbReviewDate-' + booking.id;
    dateInput.type = 'date';
    dateInput.value = booking.requestedDate || '';
    dateLabel.appendChild(dateText);
    dateLabel.appendChild(dateInput);
    var timeLabel = el('label', 'mb-field mb-review-actions__field');
    var timeText = el('span');
    var timeInput = el('input');
    timeText.textContent = t('reviewRescheduleTimeLabel');
    timeInput.id = 'mbReviewTime-' + booking.id;
    timeInput.type = 'time';
    timeInput.value = String(booking.startTime || '').slice(0, 5);
    timeLabel.appendChild(timeText);
    timeLabel.appendChild(timeInput);
    reschedule.appendChild(dateLabel);
    reschedule.appendChild(timeLabel);
    panel.appendChild(reschedule);
    var row = el('div', 'mb-review-actions__buttons');
    [
      ['reviewApproveAction', approveReviewBooking],
      ['reviewRescheduleAction', rescheduleReviewBooking],
      ['reviewDeclineAction', declineReviewBooking]
    ].forEach(function(pair) {
      var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
      btn.type = 'button';
      btn.setAttribute('data-review-action', pair[0]);
      btn.textContent = t(pair[0]);
      btn.addEventListener('click', function() { pair[1](booking.id); });
      row.appendChild(btn);
    });
    panel.appendChild(row);
    return panel;
  }

  function bookingCard(booking) {
    // Compact list row + click-to-expand detail panel. The function name
    // stays bookingCard() so existing callers (renderBookingList, viewBooking,
    // realtime alerts) keep working without changes.
    var row = el('article', 'mb-booking-row');
    var bucket = statusBucket(booking.status);
    row.classList.add('mb-booking-row--' + bucket);
    if (isOwnerReviewBooking(booking)) row.classList.add('mb-booking-row--vendor-review');
    row.id = 'mbBookingCard-' + String(booking.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    row.setAttribute('data-booking-id', booking.id || '');
    row.setAttribute('data-status', booking.status || '');
    var isExpanded = state.expandedBookingId === booking.id;
    if (isExpanded) row.classList.add('mb-booking-row--expanded');

    var service = serviceForBooking(booking);
    var duration = booking.durationMinutes || service.durationMinutes || '';
    var total = booking.amountDue != null ? booking.amountDue : Number(booking.servicePrice || 0) + Number(booking.travelFee || 0);
    var zelleInfo = vendorZelleInfo();
    var zellePhone = booking.zellePhone || zelleInfo.phone || '';
    var payMethod = paymentMethodCode(booking.paymentMethod);
    var payStatus = paymentStatusCode(booking.paymentStatus);
    var locationStr = [booking.city, booking.zip].filter(Boolean).join(' • ');
    var serviceStr = booking.serviceName
      || (booking.serviceLabelKey ? t(booking.serviceLabelKey) : '')
      || booking.serviceId || '';

    // Head — single tappable button so the whole row toggles expansion
    var head = el('button', 'mb-booking-row__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

    // Owner mode: a per-row service-type badge (scissors/car/compass) so barber, ride, and
    // tour rows are distinguishable at a glance in the unified list.
    if (state.ownerMode && booking.serviceType) {
      var typeIcon = booking.serviceType === 'ride' ? 'car'
        : booking.serviceType === 'tour' ? 'compass' : 'scissors';
      var typeBadge = el('span', 'mb-booking-row__type mb-type-badge mb-ico mb-type-badge--' + booking.serviceType);
      typeBadge.innerHTML = icoMarkup(typeIcon);
      typeBadge.setAttribute('aria-label', t('filter' + booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)));
      head.appendChild(typeBadge);
    }

    var pill = el('span', 'mb-booking-row__status mb-status-pill mb-status-pill--' + bucket);
    pill.textContent = statusLabel(booking.status);
    head.appendChild(pill);

    var time = el('span', 'mb-booking-row__time');
    time.textContent = formatTime12Hour(booking.startTime) || booking.requestedDate || '';
    head.appendChild(time);

    var meat = el('span', 'mb-booking-row__meat');
    var who = el('strong', 'mb-booking-row__customer');
    who.textContent = booking.customerName || '—';
    meat.appendChild(who);
    var svc = el('span', 'mb-booking-row__service');
    svc.textContent = serviceStr;
    meat.appendChild(svc);
    if (locationStr) {
      var loc = el('span', 'mb-booking-row__city');
      loc.textContent = locationStr;
      meat.appendChild(loc);
    }
    head.appendChild(meat);

    var price = el('span', 'mb-booking-row__price');
    price.textContent = formatMoney(total);
    head.appendChild(price);

    // Confirmation preference chip — highlighted when customer wants TEXT
    // so the vendor can see at a glance which rows need an SMS confirmation.
    var pref = String(booking.confirmationPreference || 'text').toLowerCase();
    if (pref === 'text') {
      var smsChip = el('span', 'mb-confirmation-chip mb-confirmation-chip--text');
      smsChip.setAttribute('aria-label', t('confirmTextChipAria'));
      icoLabel(smsChip, 'smartphone', t('confirmTextChip'));
      head.appendChild(smsChip);
    } else if (pref === 'call') {
      var callChip = el('span', 'mb-confirmation-chip mb-confirmation-chip--call');
      icoLabel(callChip, 'phone', t('confirmCallChip'));
      head.appendChild(callChip);
    } else if (pref === 'app') {
      var appChip = el('span', 'mb-confirmation-chip mb-confirmation-chip--app');
      icoLabel(appChip, 'bell', t('confirmAppChip'));
      head.appendChild(appChip);
    }

    // Promo chip — surfaces when a vendor promotion discounted this booking.
    if (booking.promoApplied && Number(booking.discountPercent || 0) > 0) {
      var promoChip = el('span', 'mb-confirmation-chip mb-promo-chip');
      icoLabel(promoChip, 'ticket', interpolate(t('promoChipApplied') || '{pct}% promo applied', { pct: Number(booking.discountPercent || 0) }));
      head.appendChild(promoChip);
    }

    if (isOwnerReviewBooking(booking)) {
      var reviewChip = el('span', 'mb-confirmation-chip mb-review-chip');
      reviewChip.textContent = t('reviewQueueBadge') + ': ' + reviewReasonLabel(booking);
      head.appendChild(reviewChip);
    }

    var chevron = el('span', 'mb-booking-row__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.classList.add('mb-ico');
    chevron.innerHTML = icoMarkup('chevron-down');
    head.appendChild(chevron);

    head.addEventListener('click', function() {
      toggleBookingRow(booking.id);
    });
    row.appendChild(head);

    // Detail panel — built lazily but always in DOM (hidden when collapsed)
    var detail = el('div', 'mb-booking-row__detail');
    detail.hidden = !isExpanded;

    var actions = el('div', 'mb-booking-card__actions mb-booking-row__actions');
    if (trim(booking.address)) {
      var link = el('a', 'mb-button mb-button--ghost mb-button--sm');
      link.href = mapUrl(booking);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = t('mapLink');
      actions.appendChild(link);
    }
    // Navigate (turn-by-turn) — ride rows carry a precomputed routeLink.
    if (trim(booking.routeLink)) {
      var nav = el('a', 'mb-button mb-button--ghost mb-button--sm');
      nav.href = booking.routeLink;
      nav.target = '_blank';
      nav.rel = 'noopener';
      nav.textContent = t('navigateAction');
      actions.appendChild(nav);
    }
    // SMS confirmation launcher — opens the vendor's native SMS app composing
    // to the customer with a prefilled confirmation template. Shown only when
    // (a) the customer asked for text confirmation AND (b) we have a phone.
    if (pref === 'text' && trim(booking.customerPhone)) {
      var smsBtn = el('a', 'mb-button mb-button--primary mb-button--sm mb-sms-button');
      smsBtn.href = buildConfirmationSmsHref(booking);
      icoLabel(smsBtn, 'smartphone', t('sendConfirmationTextAction'));
      smsBtn.setAttribute('aria-label', t('sendConfirmationTextAria'));
      actions.appendChild(smsBtn);
    }
    if (isOwnerReviewBooking(booking)) {
      actions.appendChild(buildReviewActions(booking));
    } else {
      [
        ['confirmed', 'acceptAction'],
        ['rescheduled', 'rescheduleAction'],
        ['cancelled', 'cancelAction'],
        ['completed', 'completeAction']
      ].forEach(function(pair) {
        var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
        btn.type = 'button';
        btn.textContent = t(pair[1]);
        btn.addEventListener('click', function() { updateBookingStatus(booking.id, pair[0]); });
        actions.appendChild(btn);
      });
    }
    [
      ['paid', 'markPaidAction'],
      ['unpaid', 'markUnpaidAction']
    ].forEach(function(pair) {
      var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
      btn.type = 'button';
      btn.textContent = t(pair[1]);
      btn.addEventListener('click', function() { updateBookingPayment(booking.id, { paymentStatus: pair[0] }); });
      actions.appendChild(btn);
    });
    if (payMethod === 'zelle') {
      var requestBtn = el('button', 'mb-button mb-button--primary mb-button--sm');
      requestBtn.type = 'button';
      requestBtn.textContent = t('requestZellePaymentAction');
      requestBtn.addEventListener('click', function() {
        updateBookingPayment(booking.id, { paymentStatus: 'payment_requested', zellePhone: zellePhone });
      });
      actions.appendChild(requestBtn);
    }
    [
      ['cash', 'setCashAction'],
      ['zelle', 'setZelleAction']
    ].forEach(function(pair) {
      var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
      btn.type = 'button';
      btn.textContent = t(pair[1]);
      btn.addEventListener('click', function() { updateBookingPayment(booking.id, { paymentMethod: pair[0], zellePhone: zellePhone }); });
      actions.appendChild(btn);
    });
    var noteBtn = el('button', 'mb-button mb-button--ghost mb-button--sm');
    noteBtn.type = 'button';
    noteBtn.textContent = t('addPaymentNoteAction');
    noteBtn.addEventListener('click', function() {
      var note = root.prompt ? root.prompt(t('paymentNote'), booking.paymentNote || '') : null;
      if (note != null) updateBookingPayment(booking.id, { paymentNote: note });
    });
    actions.appendChild(noteBtn);

    detail.appendChild(detailSection(t('customerContact'), [
      ['Name', booking.customerName],
      [t('phoneLabel'), booking.customerPhone],
      [t('emailLabel'), booking.customerEmail],
      [t('confirmationPreferenceLabel'), confirmationPreferenceLabel(pref)]
    ]));
    detail.appendChild(detailSection(t('appointmentDetails'), [
      [t('serviceNameLabel'), serviceStr],
      [t('serviceType'), service.category || booking.serviceCategory || ''],
      [t('serviceDurationLabel'), duration ? duration + ' ' + t('minutesShort') : ''],
      [t('blockDateLabel'), booking.requestedDate],
      [t('blockStartLabel'), formatTime12Hour(booking.startTime)],
      [t('blockEndLabel'), formatTime12Hour(booking.endTime)],
      ['Status', statusLabel(booking.status)]
    ]));
    detail.appendChild(detailSection(t('customerAddress'), [
      [t('customerAddress'), [booking.address, booking.city, booking.zip].filter(Boolean).join(', ')]
    ]));
    // Owner mode: surface ride/tour-specific fields the barber schema lacks.
    if (booking.serviceType === 'ride') {
      detail.appendChild(detailSection(t('svcPrivateRide'), [
        [t('passengersLabel'), booking.passengers || ''],
        [t('serviceType'), booking.serviceLabelKey ? t(booking.serviceLabelKey) : ''],
        [t('airportLabel'), booking.airport || '']
      ]));
    } else if (booking.serviceType === 'tour') {
      detail.appendChild(detailSection(t('svcTour'), [
        [t('passengersLabel'), booking.passengers || ''],
        [t('durationDaysLabel'), booking.durationDays || '']
      ]));
    }
    if (isOwnerReviewBooking(booking)) {
      var conflictCount = Array.isArray(booking.reviewConflicts) ? booking.reviewConflicts.length : 0;
      detail.appendChild(detailSection(t('reviewQueueBadge'), [
        [t('reviewReasonLabel'), reviewReasonLabel(booking)],
        [t('reviewConflictsLabel'), conflictCount ? String(conflictCount) : '0']
      ]));
    }
    var pricingRows = [
      [t('servicePrice'), formatMoney(booking.servicePrice)],
      [t('travelFee'), formatMoney(booking.travelFee)],
      [t('vehicleWearCost'), booking.vehicleWearCost ? formatMoney(booking.vehicleWearCost) : formatMoney(0)]
    ];
    if (booking.promoApplied && Number(booking.discountPercent || 0) > 0) {
      pricingRows.push(['Original', formatMoney(booking.originalPrice || total)]);
      pricingRows.push([(t('promoChipApplied') || 'Promo')
        .replace('{pct}', Number(booking.discountPercent || 0)), booking.promotionName || '']);
    }
    pricingRows.push([t('amountDue'), formatMoney(total)]);
    pricingRows.push([t('quoteType'), booking.quoteType || 'standard']);
    detail.appendChild(detailSection(t('pricingDetails'), pricingRows));
    detail.appendChild(detailSection(t('paymentDetails'), [
      [t('paymentMethod'), paymentChip('method', payMethod, paymentMethodLabel(payMethod))],
      [t('paymentStatus'), paymentChip('status', payStatus, paymentStatusLabel(payStatus))],
      [t('zelleNumber'), payMethod === 'zelle' ? zellePhone : ''],
      [t('paymentNote'), booking.paymentNote]
    ]));
    if (payMethod === 'zelle' && payStatus !== 'paid') {
      detail.appendChild(zellePaymentPanel());
    }
    if (trim(booking.notes)) {
      var notes = el('p');
      notes.textContent = t('customerNotes') + ': ' + booking.notes;
      detail.appendChild(notes);
    }
    if (trim(booking.aiConversationSummary)) {
      var aiSummary = el('p');
      aiSummary.textContent = 'AI: ' + booking.aiConversationSummary;
      detail.appendChild(aiSummary);
    }
    if (trim(booking.stylePreference) || trim(booking.previousServiceName) || trim(booking.rebookedFromBookingId)) {
      var history = el('p');
      history.textContent = t('customerCutHistory') + ': ' + [
        trim(booking.previousServiceName) ? t('previousService') + ' ' + booking.previousServiceName : '',
        trim(booking.stylePreference) ? t('stylePreference') + ' ' + booking.stylePreference : '',
        trim(booking.rebookedFromBookingId) ? booking.rebookedFromBookingId : ''
      ].filter(Boolean).join(' • ');
      detail.appendChild(history);
    }
    if (Array.isArray(booking.photoUrls) && booking.photoUrls.length) {
      var photos = el('p');
      photos.textContent = t('referencePhotos') + ': ' + booking.photoUrls.join(', ');
      detail.appendChild(photos);
    }
    // AI haircut preview block — only rendered when the customer opted in
    // and either uploaded a selfie OR picked a style. Selfie thumbnail is
    // vendor-only (Firestore rules already gate the booking doc).
    var hasAiPreview = trim(booking.selfieDataUrl) ||
      trim(booking.customerSelfieUrl) ||
      trim(booking.selectedAiStyleId) ||
      trim(booking.selectedHaircutImageUrl) ||
      trim(booking.selectedHaircutTitle) ||
      trim(booking.selectedStyleId) ||
      (Array.isArray(booking.recommendedStyles) && booking.recommendedStyles.length);
    if (hasAiPreview) {
      detail.appendChild(buildAiPreviewSection(booking));
    }
    detail.appendChild(actions);
    row.appendChild(detail);
    return row;
  }

  function buildAiPreviewSection(booking) {
    var section = el('div', 'mb-booking-card__section mb-booking-ai-preview');
    var heading = el('h4');
    heading.textContent = t('vendorAiPreviewHeading');
    section.appendChild(heading);

    var aiLabel = el('span', 'mb-confirmation-chip mb-confirmation-chip--app');
    icoLabel(aiLabel, 'sparkles', t('vendorAiPreviewBadge'));
    section.appendChild(aiLabel);

    var grid = el('div', 'mb-booking-ai-preview__grid');
    // Customer selfie (vendor-only, never publicly displayed)
    var selfieUrl = trim(booking.customerSelfieUrl) || trim(booking.selfieDataUrl);
    if (selfieUrl) {
      var selfieWrap = el('figure', 'mb-booking-ai-preview__media');
      var selfieImg = document.createElement('img');
      selfieImg.src = selfieUrl;
      selfieImg.alt = t('vendorAiPreviewSelfieAlt');
      selfieImg.loading = 'lazy';
      var caption = el('figcaption');
      caption.textContent = t('vendorAiPreviewSelfieCaption');
      selfieWrap.appendChild(selfieImg);
      selfieWrap.appendChild(caption);
      grid.appendChild(selfieWrap);
    }
    // Selected style preview (prefer canonical selectedAi* fields, fall back
    // to legacy selectedStyleId / selectedStylePreviewUrl mirrors).
    var styleImgUrl = trim(booking.selectedHaircutImageUrl) || trim(booking.selectedAiStyleImage) || trim(booking.selectedStylePreviewUrl);
    var styleNameTxt = trim(booking.selectedHaircutTitle) || trim(booking.selectedAiStyleName)
      || recommendationTitle(booking, booking.selectedAiStyleId || booking.selectedStyleId)
      || t('vendorAiPreviewStyleCaption');
    if (styleImgUrl) {
      var styleWrap = el('figure', 'mb-booking-ai-preview__media');
      var styleImg = document.createElement('img');
      styleImg.src = styleImgUrl;
      styleImg.alt = t('vendorAiPreviewStyleAlt');
      styleImg.loading = 'lazy';
      var styleCaption = el('figcaption');
      styleCaption.textContent = styleNameTxt;
      styleWrap.appendChild(styleImg);
      styleWrap.appendChild(styleCaption);
      grid.appendChild(styleWrap);
    }
    section.appendChild(grid);

    // Canonical AI hairstyle reference (style name + description + maintenance
    // + barber notes from the AI). Prefer the new selectedAi* fields, fall
    // back to data derived from recommendedStyles[] for older bookings.
    var legacyRec = (Array.isArray(booking.recommendedStyles) ? booking.recommendedStyles : [])
      .filter(function(r) { return r && r.styleId === (booking.selectedAiStyleId || booking.selectedStyleId); })[0];
    var aiName = styleNameTxt;
    var aiDesc = trim(booking.selectedHaircutDescription) || trim(booking.selectedAiStyleDescription) || (legacyRec && trim(legacyRec.explanation)) || '';
    var aiMaint = trim(booking.selectedHaircutMaintenanceLevel) || trim(booking.selectedAiMaintenanceLevel) || (legacyRec && trim(legacyRec.maintenance)) || '';
    var aiBarberNotes = trim(booking.selectedHaircutBarberNotes) || trim(booking.selectedAiBarberNotes) || (legacyRec && trim(legacyRec.barberNotes)) || '';
    // All-audience attributes (men / women / children + color / highlights /
    // texture). Prefer the canonical booking fields, fall back to the selected
    // entry in recommendedStyles[] for bookings written before those fields.
    var aiAudienceRaw = trim(booking.selectedAudienceType) || (legacyRec && trim(legacyRec.targetAudience)) || '';
    var aiColor = trim(booking.selectedColorRecommendation) || (legacyRec && trim(legacyRec.colorRecommendation)) || '';
    var aiHighlight = trim(booking.selectedHighlightRecommendation) || (legacyRec && trim(legacyRec.highlightRecommendation)) || '';
    var aiTexture = trim(booking.selectedTexturePreference) || (legacyRec && trim(legacyRec.curlStraightRecommendation)) || '';
    var aiWhy = (legacyRec && trim(legacyRec.whyItFitsFace)) || '';
    var aiSafety = (legacyRec && trim(legacyRec.safetyNotes)) || '';
    var aiAudienceTxt = aiAudienceRaw
      ? (t('vendorAiPreviewAudience' + aiAudienceRaw.charAt(0).toUpperCase() + aiAudienceRaw.slice(1)) || aiAudienceRaw)
      : '';
    var promptSnapshot = trim(booking.selectedHaircutPromptSnapshot);
    var source = trim(booking.selectedHaircutSource);
    // Safe row builder — label via <strong>, AI value via text node (never
    // injects AI-supplied HTML into the dashboard).
    function aiRefRow(parent, labelKey, value, cls) {
      var v = trim(value);
      if (!v) return;
      var p = el('p', cls || 'mb-booking-ai-preview__reference-meta');
      var s = document.createElement('strong');
      s.textContent = (t(labelKey) || '') + ': ';
      p.appendChild(s);
      p.appendChild(document.createTextNode(v));
      parent.appendChild(p);
    }
    if (aiName || aiDesc || aiMaint || aiBarberNotes || aiAudienceTxt || aiColor || aiHighlight || aiTexture) {
      var ref = el('div', 'mb-booking-ai-preview__reference');
      if (aiName) {
        var refStyle = el('p', 'mb-booking-ai-preview__reference-name');
        refStyle.innerHTML = '<strong>' + (t('vendorAiPreviewStyleLabel') || 'Style') + ':</strong> ' + aiName;
        ref.appendChild(refStyle);
      }
      aiRefRow(ref, 'vendorAiPreviewAudienceLabel', aiAudienceTxt, 'mb-booking-ai-preview__reference-meta');
      if (aiMaint) {
        var refMaint = el('p', 'mb-booking-ai-preview__reference-meta');
        refMaint.innerHTML = '<strong>' + (t('vendorAiPreviewMaintenanceLabel') || 'Maintenance') + ':</strong> ' + aiMaint;
        ref.appendChild(refMaint);
      }
      aiRefRow(ref, 'vendorAiPreviewColorLabel', aiColor, 'mb-booking-ai-preview__reference-meta');
      aiRefRow(ref, 'vendorAiPreviewHighlightLabel', aiHighlight, 'mb-booking-ai-preview__reference-meta');
      aiRefRow(ref, 'vendorAiPreviewTextureLabel', aiTexture, 'mb-booking-ai-preview__reference-meta');
      aiRefRow(ref, 'vendorAiPreviewWhyLabel', aiWhy, 'mb-booking-ai-preview__reference-desc');
      aiRefRow(ref, 'vendorAiPreviewSafetyLabel', aiSafety, 'mb-booking-ai-preview__notes');
      if (aiDesc) {
        var refDesc = el('p', 'mb-booking-ai-preview__reference-desc');
        refDesc.textContent = aiDesc;
        ref.appendChild(refDesc);
      }
      if (aiBarberNotes) {
        var refNotes = el('p', 'mb-booking-ai-preview__notes');
        refNotes.innerHTML = '<strong>' + (t('vendorAiPreviewBarberRefNotes') || 'Barber reference notes') + ':</strong> ' + aiBarberNotes;
        ref.appendChild(refNotes);
      }
      if (source || promptSnapshot) {
        var refSource = el('p', 'mb-booking-ai-preview__reference-meta');
        refSource.textContent = [source, promptSnapshot].filter(Boolean).join(' • ');
        ref.appendChild(refSource);
      }
      section.appendChild(ref);
    }

    // AI analysis summary
    if (trim(booking.aiAnalysisSummary)) {
      var summary = el('p', 'mb-booking-ai-preview__summary');
      summary.textContent = t('vendorAiPreviewSummaryLabel') + ': ' + booking.aiAnalysisSummary;
      section.appendChild(summary);
    }
    // Free-form barber cutting notes input (vendor writes here)
    var notesField = el('label', 'mb-booking-ai-preview__field');
    var notesLabelEl = el('span');
    notesLabelEl.textContent = t('vendorAiPreviewBarberInstructions');
    var notesInput = document.createElement('textarea');
    notesInput.rows = 2;
    notesInput.value = booking.barberCuttingNotes || '';
    notesInput.placeholder = t('vendorAiPreviewBarberInstructionsPlaceholder');
    notesInput.id = 'mbBarberCuttingNotes-' + String(booking.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    notesField.appendChild(notesLabelEl);
    notesField.appendChild(notesInput);
    section.appendChild(notesField);

    // Action row: save notes + privacy delete
    var aiActions = el('div', 'mb-booking-ai-preview__actions');
    var saveNotesBtn = el('button', 'mb-button mb-button--primary mb-button--sm');
    saveNotesBtn.type = 'button';
    saveNotesBtn.textContent = t('vendorAiPreviewSaveNotesAction');
    saveNotesBtn.addEventListener('click', function() {
      updateBookingPatch(booking.id, { barberCuttingNotes: notesInput.value });
      showToast(t('toastSaved'));
    });
    aiActions.appendChild(saveNotesBtn);

    if (trim(booking.selfieDataUrl)) {
      var deleteSelfie = el('button', 'mb-button mb-button--ghost mb-button--sm');
      deleteSelfie.type = 'button';
      icoLabel(deleteSelfie, 'trash', t('vendorAiPreviewDeleteSelfie'));
      deleteSelfie.addEventListener('click', function() {
        if (root.confirm && !root.confirm(t('vendorAiPreviewDeleteConfirm'))) return;
        updateBookingPatch(booking.id, { selfieDataUrl: '' });
        showToast(t('vendorAiPreviewSelfieDeleted'));
      });
      aiActions.appendChild(deleteSelfie);
    }
    section.appendChild(aiActions);

    return section;
  }

  function recommendationTitle(booking, styleId) {
    if (!styleId) return '';
    var recs = Array.isArray(booking.recommendedStyles) ? booking.recommendedStyles : [];
    var match = recs.filter(function(r) { return r && r.styleId === styleId; })[0];
    return match && match.title ? match.title : '';
  }

  function toggleBookingRow(bookingId) {
    if (!bookingId) return;
    state.expandedBookingId = state.expandedBookingId === bookingId ? null : bookingId;
    renderBookings();
  }

  function serviceTypeForBooking(booking) {
    var raw = booking && (booking.serviceType || booking.rawServiceType || booking.bookingType || '');
    var bucket = root.OwnerModel && root.OwnerModel.serviceBucket ? root.OwnerModel.serviceBucket(raw) : raw;
    if (bucket === 'barber' || bucket === 'ride' || bucket === 'tour') return bucket;
    if (booking && booking.sourceCollection === 'travel_bookings') return 'tour';
    return 'barber';
  }

  function notificationDedupeKey(booking) {
    var bookingId = booking && (booking.id || booking.bookingId || '');
    if (!bookingId) return '';
    return state.ownerMode ? serviceTypeForBooking(booking) + ':' + bookingId : bookingId;
  }

  function markBookingNotified(bookingOrId) {
    var key = typeof bookingOrId === 'object' ? notificationDedupeKey(bookingOrId) : bookingOrId;
    if (!key) return;
    state.notifiedBookingIds[key] = Date.now();
    var ids = Object.keys(state.notifiedBookingIds).sort(function(a, b) {
      return Number(state.notifiedBookingIds[b] || 0) - Number(state.notifiedBookingIds[a] || 0);
    }).slice(0, 80);
    var trimmed = {};
    ids.forEach(function(id) { trimmed[id] = state.notifiedBookingIds[id]; });
    state.notifiedBookingIds = trimmed;
    writeJson(notifiedStorageKey(), trimmed);
  }

  function shouldAlertForBooking(booking, changeType) {
    if (!booking) return false;
    if (!state.ownerMode && booking.vendorId !== state.vendorId) return false;
    if (state.ownerMode && booking.ownerId && booking.ownerId !== state.ownerId) return false;
    var bookingId = booking.id || booking.bookingId || '';
    var dedupeKey = notificationDedupeKey(booking);
    if (!bookingId || !dedupeKey || state.notifiedBookingIds[dedupeKey]) return false;
    var status = booking.status || '';
    var alertStatuses = {
      pending_barber_confirmation: true,
      pending_confirmation: true,
      vendor_review: true,
      confirmed: true
    };
    return changeType === 'added' || !!alertStatuses[status];
  }

  function formatAlertAddress(booking) {
    return [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');
  }

  function alertTitleKeyFor(booking) {
    if (!state.ownerMode) return 'newBookingAlertTitle';
    var serviceType = serviceTypeForBooking(booking);
    if (serviceType === 'ride') return 'newRideBookingAlertTitle';
    if (serviceType === 'tour') return 'newTourBookingAlertTitle';
    if (serviceType === 'barber') return 'newBarberBookingAlertTitle';
    return 'newBookingAlertTitle';
  }

  function displayServiceName(booking) {
    if (!booking) return '';
    if (booking.serviceLabelKey) return t(booking.serviceLabelKey);
    if (serviceTypeForBooking(booking) === 'barber') return booking.serviceName || booking.serviceId || t('svcBarber');
    if (serviceTypeForBooking(booking) === 'ride') return booking.serviceName || t('svcPrivateRide');
    if (serviceTypeForBooking(booking) === 'tour') return booking.serviceName || t('svcTour');
    return booking.serviceName || booking.serviceId || '';
  }

  function compactNotificationMessage(booking) {
    return [
      booking.customerName || booking.name || '',
      displayServiceName(booking),
      booking.requestedDate || '',
      formatTime12Hour(booking.startTime),
      statusLabel(booking.status)
    ].filter(Boolean).join(' • ');
  }

  function formatAlertMessage(booking) {
    if (state.ownerMode) return compactNotificationMessage(booking);
    var amount = booking.amountDue != null ? booking.amountDue : Number(booking.servicePrice || 0) + Number(booking.travelFee || 0);
    return [
      'Customer: ' + (booking.customerName || ''),
      'Phone: ' + (booking.customerPhone || ''),
      'Service: ' + (booking.serviceName || booking.serviceId || ''),
      'Date: ' + (booking.requestedDate || ''),
      'Time: ' + formatTime12Hour(booking.startTime),
      'Address: ' + formatAlertAddress(booking),
      'Payment: ' + paymentMethodLabel(booking.paymentMethod),
      'Amount Due: ' + formatMoney(amount)
    ].filter(function(line) { return !/: $/.test(line); }).join('\n');
  }

  function viewBooking(bookingId) {
    state.bookingFilter = 'all';
    renderBookings();
    root.setTimeout(function() {
      var card = null;
      document.querySelectorAll('[data-booking-id]').forEach(function(node) {
        if (node.getAttribute('data-booking-id') === String(bookingId)) card = node;
      });
      if (!card) return;
      card.classList.add('mb-booking-card--highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      root.setTimeout(function() { card.classList.remove('mb-booking-card--highlight'); }, 2800);
    }, 30);
  }

  function persistOwnerNotifications() {
    if (!state.ownerMode || !state.ownerId) return;
    writeJson(ownerNotificationsStorageKey(), state.ownerNotifications.slice(0, 120));
  }

  function addNotification(booking) {
    if (!state.ownerMode || !state.ownerId || !booking) return null;
    var id = notificationDedupeKey(booking);
    var bookingId = booking.id || booking.bookingId || '';
    if (!id || !bookingId) return null;
    var existing = (state.ownerNotifications || []).filter(function(item) { return item.id === id; })[0];
    if (existing) return existing;
    var entry = {
      id: id,
      ownerId: state.ownerId,
      serviceType: serviceTypeForBooking(booking),
      bookingId: bookingId,
      sourceCollection: booking.sourceCollection || DATA.COLLECTIONS.bookings,
      title: t(alertTitleKeyFor(booking)),
      message: compactNotificationMessage(booking),
      status: booking.status || '',
      read: false,
      createdAt: Date.now()
    };
    state.ownerNotifications.unshift(entry);
    state.ownerNotifications = state.ownerNotifications.slice(0, 120);
    persistOwnerNotifications();
    renderNotificationDrawer();
    return entry;
  }

  function markNotificationRead(id) {
    var changed = false;
    state.ownerNotifications = (state.ownerNotifications || []).map(function(item) {
      if (item.id !== id || item.read) return item;
      changed = true;
      return Object.assign({}, item, { read: true });
    });
    if (changed) persistOwnerNotifications();
    renderNotificationDrawer();
  }

  function markAllNotificationsRead() {
    var changed = false;
    state.ownerNotifications = (state.ownerNotifications || []).map(function(item) {
      if (item.read) return item;
      changed = true;
      return Object.assign({}, item, { read: true });
    });
    if (changed) persistOwnerNotifications();
    renderNotificationDrawer();
  }

  function openBookingFromNotification(item) {
    if (!item) return;
    markNotificationRead(item.id);
    state.serviceTypeFilter = item.serviceType || 'all';
    state.summaryFilter = item.status === 'pending_confirmation' || item.status === 'pending_barber_confirmation' || item.status === 'vendor_review'
      ? 'pending'
      : 'upcoming';
    closeNotificationDrawer();
    viewBooking(item.bookingId);
  }

  function showBookingAlert(booking) {
    var region = document.getElementById('mbBookingAlertRegion');
    if (!region) return;
    var bookingId = booking.id || booking.bookingId || '';
    var popup = el('article', 'mb-booking-alert');
    var title = el('h3');
    var message = el('pre');
    var actions = el('div', 'mb-booking-alert__actions');
    var view = el('button', 'mb-button mb-button--primary mb-button--sm');
    var dismiss = el('button', 'mb-button mb-button--ghost mb-button--sm');
    title.textContent = t(alertTitleKeyFor(booking));
    message.textContent = formatAlertMessage(booking);
    view.type = 'button';
    view.textContent = t('viewBookingAction');
    view.addEventListener('click', function() {
      popup.remove();
      if (state.ownerMode) {
        openBookingFromNotification({
          id: notificationDedupeKey(booking),
          bookingId: bookingId,
          serviceType: serviceTypeForBooking(booking),
          status: booking.status || ''
        });
      } else {
        viewBooking(bookingId);
      }
    });
    dismiss.type = 'button';
    dismiss.textContent = t('dismissAction');
    dismiss.addEventListener('click', function() { popup.remove(); });
    actions.appendChild(view);
    actions.appendChild(dismiss);
    popup.appendChild(title);
    popup.appendChild(message);
    popup.appendChild(actions);
    region.appendChild(popup);
    state.lastBookingAlert = [booking.customerName || bookingId, booking.requestedDate, formatTime12Hour(booking.startTime)].filter(Boolean).join(' • ');
    renderNotificationControls();
    if ('Notification' in root && root.Notification.permission === 'granted') {
      try {
        var nativeNotice = new root.Notification(t(alertTitleKeyFor(booking)), {
          body: state.ownerMode ? compactNotificationMessage(booking) : [booking.customerName || '', booking.serviceName || '', booking.requestedDate || '', formatTime12Hour(booking.startTime)].filter(Boolean).join(' • '),
          tag: 'mobile-barber-' + bookingId
        });
        nativeNotice.onclick = function() {
          try { root.focus(); } catch (e) {}
          if (state.ownerMode) {
            openBookingFromNotification({
              id: notificationDedupeKey(booking),
              bookingId: bookingId,
              serviceType: serviceTypeForBooking(booking),
              status: booking.status || ''
            });
          } else {
            viewBooking(bookingId);
          }
          nativeNotice.close();
        };
      } catch (e) {}
    }
    root.setTimeout(function() {
      if (popup && popup.parentNode) popup.remove();
    }, 45000);
  }

  function handleBookingAlert(booking, changeType) {
    var bookingId = booking && (booking.id || booking.bookingId || '');
    if (bookingId && (booking._alertInitialSnapshot || state.bookingAlertInitialSnapshot)) {
      markBookingNotified(booking);
      return;
    }
    if (!shouldAlertForBooking(booking, changeType)) {
      return;
    }
    markBookingNotified(booking);
    addNotification(booking);
    showBookingAlert(booking);
    playBookingChime();
  }

  function debounceBookingRefresh() {
    if (state.bookingAlertRefreshTimer) root.clearTimeout(state.bookingAlertRefreshTimer);
    state.bookingAlertRefreshTimer = root.setTimeout(function() {
      state.bookingAlertRefreshTimer = null;
      loadBookings().then(renderBookings);
    }, 250);
  }

  function unsubscribeBookingAlerts() {
    if (state.bookingAlertUnsubscribe) {
      try { state.bookingAlertUnsubscribe(); } catch (e) {}
      state.bookingAlertUnsubscribe = null;
    }
    if (state.bookingAlertRefreshTimer) {
      root.clearTimeout(state.bookingAlertRefreshTimer);
      state.bookingAlertRefreshTimer = null;
    }
  }

  function normalizeOwnerAlertBooking(data, sourceCollection, bucketHint) {
    if (bucketHint === 'barber' && root.OwnerBookings && root.OwnerBookings.normalizeBarber) {
      return root.OwnerBookings.normalizeBarber(data);
    }
    if (bucketHint === 'travel_tour' && root.OwnerBookings && root.OwnerBookings.normalizeTour) {
      return root.OwnerBookings.normalizeTour(data, sourceCollection);
    }
    if (bucketHint === 'ride_tour') {
      var bucket = root.OwnerModel && root.OwnerModel.serviceBucket ? root.OwnerModel.serviceBucket(data.serviceType) : data.serviceType;
      if (bucket === 'tour' && root.OwnerBookings && root.OwnerBookings.normalizeTour) return root.OwnerBookings.normalizeTour(data, sourceCollection);
      if (bucket === 'ride' && root.OwnerBookings && root.OwnerBookings.normalizeRide) return root.OwnerBookings.normalizeRide(data);
      return null;
    }
    data.sourceCollection = sourceCollection;
    return data;
  }

  function attachOwnerAlertListener(db, collectionName, query, unsubscribes, bucketHint) {
    var initial = true;
    var unsubscribe = query.limit(25).onSnapshot(function(snapshot) {
      snapshot.docChanges().forEach(function(change) {
        var data = change.doc.data() || {};
        data.id = data.id || change.doc.id;
        data = normalizeOwnerAlertBooking(data, collectionName, bucketHint);
        if (!data) return;
        data._alertInitialSnapshot = initial;
        handleBookingAlert(data, change.type);
      });
      initial = false;
      debounceBookingRefresh();
    }, function(err) {
      if (root.console) root.console.warn('[mobile-barber-dashboard] owner booking alert listener failed', collectionName, err);
    });
    unsubscribes.push(unsubscribe);
  }

  function subscribeOwnerBookingAlerts(db) {
    var unsubscribes = [];
    var barberIds = root.OwnerBookings && root.OwnerBookings.barberVendorIdsFor
      ? root.OwnerBookings.barberVendorIdsFor(state.ownerId)
      : [];
    barberIds.forEach(function(vendorId) {
      attachOwnerAlertListener(
        db,
        DATA.COLLECTIONS.bookings,
        db.collection(DATA.COLLECTIONS.bookings).where('vendorId', '==', vendorId),
        unsubscribes,
        'barber'
      );
    });
    attachOwnerAlertListener(
      db,
      'bookings',
      db.collection('bookings').where('ownerId', '==', state.ownerId),
      unsubscribes,
      'ride_tour'
    );
    attachOwnerAlertListener(
      db,
      'travel_bookings',
      db.collection('travel_bookings').where('ownerId', '==', state.ownerId),
      unsubscribes,
      'travel_tour'
    );
    state.bookingAlertUnsubscribe = function() {
      unsubscribes.forEach(function(fn) {
        try { fn(); } catch (e) {}
      });
    };
  }

  function subscribeBookingAlerts() {
    var db = firestoreDb();
    if (!db || !DATA || !DATA.COLLECTIONS || !DATA.COLLECTIONS.bookings || !state.vendorId) return;
    unsubscribeBookingAlerts();
    if (state.ownerMode && state.ownerId) {
      subscribeOwnerBookingAlerts(db);
      return;
    }
    state.bookingAlertInitialSnapshot = true;
    var query = db.collection(DATA.COLLECTIONS.bookings)
      .where('vendorId', '==', state.vendorId)
      .orderBy('createdAt', 'desc')
      .limit(25);
    state.bookingAlertUnsubscribe = query.onSnapshot(function(snapshot) {
      snapshot.docChanges().forEach(function(change) {
        var data = change.doc.data() || {};
        data.id = data.id || change.doc.id;
        handleBookingAlert(data, change.type);
      });
      state.bookingAlertInitialSnapshot = false;
      loadBookings().then(renderBookings);
    }, function(err) {
      if (root.console) root.console.warn('[mobile-barber-dashboard] booking alert listener failed', err);
      if (state.bookingAlertUnsubscribe) state.bookingAlertUnsubscribe();
      state.bookingAlertUnsubscribe = db.collection(DATA.COLLECTIONS.bookings)
        .where('vendorId', '==', state.vendorId)
        .limit(25)
        .onSnapshot(function(snapshot) {
          snapshot.docChanges().forEach(function(change) {
            var data = change.doc.data() || {};
            data.id = data.id || change.doc.id;
            handleBookingAlert(data, change.type);
          });
          state.bookingAlertInitialSnapshot = false;
          loadBookings().then(renderBookings);
        });
    });
  }

  // Owner-only All/Barber/Ride/Tour filter bar. Built once and inserted just
  // above the appointment list; hidden entirely for single-service vendors so
  // their dashboard is unchanged.
  function renderServiceTypeFilter() {
    var bar = document.getElementById('mbServiceTypeFilter');
    if (!state.ownerMode) {
      if (bar) bar.parentNode.removeChild(bar);
      return;
    }
    var list = document.getElementById('mbAppointmentList');
    if (!list) return;
    var titleEl = document.getElementById('mbAppointmentListTitle');
    var anchor = titleEl || list;
    if (!bar) {
      bar = el('div', 'mb-service-filter');
      bar.id = 'mbServiceTypeFilter';
      bar.setAttribute('role', 'tablist');
      anchor.parentNode.insertBefore(bar, anchor);
    }
    var defs = [
      { key: 'all', label: 'filterAll', icon: '' },
      { key: 'needs_review', label: 'filterNeedsReview', icon: '' },
      { key: 'barber', label: 'filterBarber', icon: 'scissors' },
      { key: 'ride', label: 'filterRide', icon: 'car' },
      { key: 'tour', label: 'filterTour', icon: 'compass' }
    ];
    bar.innerHTML = '';
    defs.forEach(function(def) {
      var btn = el('button', 'mb-service-filter__btn');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      var isActive = (state.serviceTypeFilter || 'all') === def.key;
      btn.classList.toggle('mb-service-filter__btn--active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (def.icon) { btn.classList.add('mb-ico'); icoLabel(btn, def.icon, t(def.label)); }
      else { btn.textContent = t(def.label); }
      btn.addEventListener('click', function() {
        state.serviceTypeFilter = def.key;
        if (def.key === 'needs_review') state.summaryFilter = 'needs_review';
        else if (state.summaryFilter === 'needs_review') state.summaryFilter = 'today';
        state.expandedBookingId = null;
        renderBookings();
      });
      bar.appendChild(btn);
    });
  }

  function renderBookingList(id, rows) {
    var list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = '';
    if (!rows.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyBookings');
      list.appendChild(empty);
      return;
    }
    rows.forEach(function(booking) {
      list.appendChild(bookingCard(booking));
    });
  }

  // Owner mode adds an All/Barber/Ride/Tour filter on top of the summary cards.
  // Outside owner mode (single-service vendors) this returns every booking, so
  // existing behavior is unchanged.
  function bookingsInScope() {
    var rows = state.bookings || [];
    if (state.ownerMode && state.serviceTypeFilter === 'needs_review') {
      rows = rows.filter(function(b) { return b.status === 'vendor_review'; });
    } else if (state.ownerMode && state.serviceTypeFilter && state.serviceTypeFilter !== 'all') {
      rows = rows.filter(function(b) { return b.serviceType === state.serviceTypeFilter; });
    }
    return rows;
  }

  // Bucket rows by summary-card filter. Sorting is by start time except for
  // completed_today which sorts most-recent first since the operator usually
  // wants to see the freshly finished bookings at the top.
  function bookingsForSummaryFilter(filter, now) {
    now = now || new Date();
    var today = getTodayIso();
    var scope = bookingsInScope();
    var active = scope.filter(function(b) {
      return !isInactiveStatus(b.status);
    });
    var rows;
    if (filter === 'needs_review') {
      rows = scope.filter(function(b) { return b.status === 'vendor_review'; });
    } else if (filter === 'today') {
      rows = active.filter(function(b) { return b.requestedDate === today; });
    } else if (filter === 'upcoming') {
      rows = active.filter(function(b) { return isUpcomingBooking(b, now); });
    } else if (filter === 'pending') {
      rows = active.filter(function(b) {
        return b.status === 'pending_confirmation' || b.status === 'pending_barber_confirmation' || b.status === 'vendor_review';
      });
    } else if (filter === 'in_progress') {
      rows = active.filter(function(b) {
        return b.status === 'in_progress' || b.status === 'traveling';
      });
    } else if (filter === 'completed_today') {
      rows = scope.filter(function(b) {
        return b.status === 'completed' && b.requestedDate === today;
      });
      return rows.sort(function(a, b) { return bookingStartMillis(b) - bookingStartMillis(a); });
    } else {
      rows = active;
    }
    return rows.sort(function(a, b) { return bookingStartMillis(a) - bookingStartMillis(b); });
  }

  function renderBookings() {
    var now = new Date();
    var today = getTodayIso();
    renderServiceTypeFilter();
    var scope = bookingsInScope();
    var active = scope.filter(function(booking) { return !isInactiveStatus(booking.status); });
    var todayRows = active.filter(function(booking) { return booking.requestedDate === today; });
    var upcomingRows = active.filter(function(booking) { return isUpcomingBooking(booking, now); });
    var pendingRows = active.filter(function(booking) {
      return booking.status === 'pending_confirmation' || booking.status === 'pending_barber_confirmation' || booking.status === 'vendor_review';
    });
    var inProgressRows = active.filter(function(booking) {
      return booking.status === 'in_progress' || booking.status === 'traveling';
    });
    var completedTodayRows = scope.filter(function(booking) {
      return booking.status === 'completed' && booking.requestedDate === today;
    });
    // Counters stay live and synced regardless of which filter is active.
    document.getElementById('mbStatToday').textContent = todayRows.length;
    document.getElementById('mbStatUpcoming').textContent = upcomingRows.length;
    document.getElementById('mbStatPending').textContent = pendingRows.length;
    var inProg = document.getElementById('mbStatInProgress');
    if (inProg) inProg.textContent = inProgressRows.length;
    var completed = document.getElementById('mbStatCompleted');
    if (completed) completed.textContent = completedTodayRows.length;

    // Single appointment list driven by the active summary card.
    var activeFilter = state.summaryFilter || 'today';
    var rows = bookingsForSummaryFilter(activeFilter, now);
    renderBookingList('mbAppointmentList', rows);
    var title = document.getElementById('mbAppointmentListTitle');
    if (title) title.textContent = summaryFilterTitle(activeFilter, rows.length);
    var hint = document.getElementById('mbAppointmentListHint');
    if (hint) hint.textContent = summaryFilterHint(activeFilter);
    // Sync card active states (CSS + ARIA).
    document.querySelectorAll('[data-summary-filter]').forEach(function(btn) {
      var isActive = btn.getAttribute('data-summary-filter') === activeFilter;
      btn.classList.toggle('mb-dashboard-stats__article--active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    // Legacy chip filter (now unused in DOM but tolerated).
    document.querySelectorAll('[data-booking-filter]').forEach(function(btn) {
      btn.classList.toggle('mb-button--primary', btn.getAttribute('data-booking-filter') === state.bookingFilter);
    });
  }

  function summaryFilterTitle(filter, count) {
    var labelKey;
    if (filter === 'today') labelKey = 'statToday';
    else if (filter === 'upcoming') labelKey = 'statUpcoming';
    else if (filter === 'pending') labelKey = 'statPending';
    else if (filter === 'in_progress') labelKey = 'statInProgress';
    else if (filter === 'completed_today') labelKey = 'statCompleted';
    else if (filter === 'needs_review') labelKey = 'filterNeedsReview';
    else labelKey = 'upcomingTitle';
    return t(labelKey) + ' (' + (count || 0) + ')';
  }

  function summaryFilterHint(filter) {
    var key;
    if (filter === 'today') key = 'appointmentListHintToday';
    else if (filter === 'upcoming') key = 'appointmentListHintUpcoming';
    else if (filter === 'pending') key = 'appointmentListHintPending';
    else if (filter === 'in_progress') key = 'appointmentListHintInProgress';
    else if (filter === 'completed_today') key = 'appointmentListHintCompleted';
    else if (filter === 'needs_review') key = 'appointmentListHintNeedsReview';
    else key = 'appointmentListHint';
    return t(key);
  }

  function setSummaryFilter(filter) {
    if (!filter) return;
    state.summaryFilter = filter;
    state.expandedBookingId = null;
    renderBookings();
    var list = document.getElementById('mbAppointmentList');
    if (list && typeof list.scrollIntoView === 'function') {
      try { list.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    }
  }

  function renderProfileForm() {
    document.getElementById('mbDashboardSubtitle').textContent = interpolate(t('dashboardSubtitle'), { business: state.vendor.businessName || '' });
    var publicLink = document.getElementById('mbPublicVendorLink');
    publicLink.href = '/mobile-barber/vendor/' + encodeURIComponent(state.vendorId);
    publicLink.textContent = t('publicVendorLink');
    document.getElementById('mbDashBusinessName').value = state.vendor.businessName || '';
    document.getElementById('mbDashBarberName').value = state.vendor.barberName || '';
    document.getElementById('mbDashPhone').value = state.vendor.phone || '';
    document.getElementById('mbDashEmail').value = state.vendor.email || '';
    document.getElementById('mbDashServiceAreas').value = (state.vendor.serviceAreas || []).join(', ');
    document.getElementById('mbDashTravelRadius').value = state.vendor.travelRadiusMiles || 0;
    document.getElementById('mbDashTravelFee').value = state.vendor.baseTravelFee || 0;
    var card = document.getElementById('mbDashboardVendorCard');
    if (card) {
      card.innerHTML = '<strong>Vendor:</strong> ' + [
        state.vendor.businessName || state.vendorId,
        state.vendor.barberName || '',
        state.vendor.region || (state.vendor.serviceAreas || []).slice(0, 2).join(', '),
        'Zelle: ' + (state.vendor.zellePhone || state.vendor.zelleEmail || state.vendor.phone || '')
      ].filter(Boolean).map(function(part) { return String(part).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }).join('<br>');
    }
  }

  function renderPaymentsForm() {
    var cash = document.getElementById('mbCashEnabled');
    var zelle = document.getElementById('mbZelleEnabled');
    var phone = document.getElementById('mbZellePhone');
    var email = document.getElementById('mbZelleEmail');
    var preview = document.getElementById('mbZelleQrPreview');
    if (!cash || !zelle || !phone || !email) return;
    cash.checked = state.vendor.cashEnabled !== false;
    zelle.checked = state.vendor.zelleEnabled !== false;
    phone.value = state.vendor.zellePhone || state.vendor.phone || '';
    email.value = state.vendor.zelleEmail || state.vendor.email || '';
    if (preview) {
      preview.innerHTML = '';
      if (state.vendor.zelleQrUrl) {
        var label = el('p');
        var img = document.createElement('img');
        label.textContent = t('zelleQrCurrent');
        img.src = state.vendor.zelleQrUrl;
        img.alt = t('zelleQrCurrent');
        preview.appendChild(label);
        preview.appendChild(img);
      }
    }
  }

  function renderServiceForm() {
    var select = document.getElementById('mbDashServiceSelect');
    var selected = select.value || (state.services[0] && state.services[0].id) || '';
    select.innerHTML = '';
    state.services.forEach(function(service) {
      var option = document.createElement('option');
      option.value = service.id;
      option.textContent = service.name;
      select.appendChild(option);
    });
    select.value = state.services.some(function(service) { return service.id === selected; }) ? selected : ((state.services[0] && state.services[0].id) || '');
    fillSelectedService();

    var list = document.getElementById('mbServicesManageList');
    list.innerHTML = '';
    if (!state.services.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyServices');
      list.appendChild(empty);
      return;
    }
    state.services.forEach(function(service) {
      var row = el('div', 'mb-service-admin-row');
      row.textContent = service.name + ' • $' + Number(service.price || 0).toFixed(0) + ' • ' + service.durationMinutes + ' ' + t('minutesShort');
      list.appendChild(row);
    });
  }

  function fillSelectedService() {
    var id = document.getElementById('mbDashServiceSelect').value;
    var service = state.services.find(function(row) { return row.id === id; }) || {};
    document.getElementById('mbDashServiceName').value = service.name || '';
    document.getElementById('mbDashServicePrice').value = service.price || 0;
    document.getElementById('mbDashServiceDuration').value = service.durationMinutes || 30;
    document.getElementById('mbDashCleanupBuffer').value = service.cleanupBufferMinutes || 0;
    document.getElementById('mbDashTravelBuffer').value = service.travelBufferMinutes || 0;
  }

  function renderHours() {
    var grid = document.getElementById('mbHoursGrid');
    grid.innerHTML = '';
    DAYS.forEach(function(day) {
      var row = el('div', 'mb-hours-row');
      var label = el('label');
      var active = document.createElement('input');
      var start = document.createElement('input');
      var end = document.createElement('input');
      var hours = state.availability.weeklyHours[day] || {};
      active.type = 'checkbox';
      active.checked = hours.active !== false;
      active.dataset.day = day;
      active.dataset.field = 'active';
      start.type = 'time';
      start.value = hours.start || '10:00';
      start.dataset.day = day;
      start.dataset.field = 'start';
      end.type = 'time';
      end.value = hours.end || '18:00';
      end.dataset.day = day;
      end.dataset.field = 'end';
      label.appendChild(active);
      label.appendChild(document.createTextNode(' ' + t('day' + day.charAt(0).toUpperCase() + day.slice(1))));
      row.appendChild(label);
      row.appendChild(start);
      row.appendChild(end);
      grid.appendChild(row);
    });
  }

  function renderBlocks() {
    var list = document.getElementById('mbBlocksList');
    list.innerHTML = '';
    if (!state.blocks.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyBlocks');
      list.appendChild(empty);
      return;
    }
    state.blocks.forEach(function(block) {
      var row = el('div', 'mb-service-admin-row');
      row.textContent = [block.date, block.startTime, block.endTime, block.reason].filter(Boolean).join(' • ');
      list.appendChild(row);
    });
  }

  function selectedFileName(id) {
    var input = document.getElementById(id);
    return input && input.files && input.files[0] ? input.files[0].name : '';
  }

  function renderPortfolio() {
    var list = document.getElementById('mbPortfolioManageList');
    list.innerHTML = '';
    if (!state.portfolio.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyPortfolio');
      list.appendChild(empty);
      return;
    }
    state.portfolio.forEach(function(image) {
      var row = el('div', 'mb-service-admin-row mb-portfolio-admin-row');
      var info = el('span');
      var toggle = el('button', 'mb-button mb-button--ghost mb-button--sm');
      info.textContent = [
        '#' + Number(image.displayOrder || 0),
        image.title,
        image.hidden ? t('hideAction') : ''
      ].filter(Boolean).join(' • ');
      toggle.type = 'button';
      toggle.textContent = image.hidden ? t('showAction') : t('hideAction');
      toggle.addEventListener('click', function() {
        image.hidden = !image.hidden;
        image.updatedAt = new Date().toISOString();
        persistPortfolio();
        renderPortfolio();
        showToast();
      });
      row.appendChild(info);
      row.appendChild(toggle);
      list.appendChild(row);
    });
  }

  function renderReviews() {
    var list = document.getElementById('mbReviewsManageList');
    list.innerHTML = '';
    if (!state.reviews.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyReviews');
      list.appendChild(empty);
      return;
    }
    state.reviews.forEach(function(review) {
      var row = el('label', 'mb-review-admin-row');
      var title = el('span');
      var response = document.createElement('textarea');
      title.textContent = (review.customerName || review.id) + ' • ' + Number(review.rating || 0).toFixed(1) + ' ★';
      response.rows = 3;
      response.dataset.reviewId = review.id;
      response.value = review.vendorResponse || '';
      row.appendChild(title);
      row.appendChild(document.createTextNode(t('reviewResponseLabel')));
      row.appendChild(response);
      list.appendChild(row);
    });
  }

  function addPortfolioImage() {
    var title = trim(document.getElementById('mbPortfolioTitleInput').value);
    var imageFile = selectedFileName('mbPortfolioUpload');
    var beforeFile = selectedFileName('mbPortfolioBeforeUpload');
    var afterFile = selectedFileName('mbPortfolioAfterUpload');
    if (!title || (!imageFile && !beforeFile && !afterFile)) return;
    state.portfolio.push({
      id: 'portfolio-' + Date.now().toString(36),
      vendorId: state.vendorId,
      title: title,
      description: trim(document.getElementById('mbPortfolioDescription').value),
      imageUrl: imageFile,
      beforeImageUrl: beforeFile,
      afterImageUrl: afterFile,
      alt: title,
      displayOrder: Number(document.getElementById('mbPortfolioOrder').value || (state.portfolio.length + 1) * 10),
      hidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    persistPortfolio();
    renderPortfolio();
    showToast();
  }

  // ── Promotions (Settings → Promotions accordion) ─────────────────────
  function togglePromoServicesField() {
    var scope = (document.querySelector('input[name="mbPromoScope"]:checked') || {}).value || 'all';
    var field = document.getElementById('mbPromoServicesField');
    if (field) field.hidden = scope !== 'selected';
  }

  function populatePromoServicesSelect() {
    var select = document.getElementById('mbPromoServices');
    if (!select) return;
    select.innerHTML = '';
    (state.services || []).filter(function(s) { return s.active !== false; }).forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name + ' · $' + Number(s.price || 0).toFixed(0);
      select.appendChild(opt);
    });
  }

  function readPromoForm() {
    var scope = (document.querySelector('input[name="mbPromoScope"]:checked') || {}).value || 'all';
    var selectedIds = [];
    if (scope === 'selected') {
      var select = document.getElementById('mbPromoServices');
      if (select) {
        for (var i = 0; i < select.options.length; i++) {
          if (select.options[i].selected) selectedIds.push(select.options[i].value);
        }
      }
    }
    return {
      name: trim(document.getElementById('mbPromoName').value),
      description: trim(document.getElementById('mbPromoDescription').value),
      discountPercent: Number(document.getElementById('mbPromoDiscount').value || 0),
      applyToScope: scope,
      appliesToServiceIds: selectedIds,
      startDate: trim(document.getElementById('mbPromoStart').value),
      endDate: trim(document.getElementById('mbPromoEnd').value),
      maxRedemptions: Number(document.getElementById('mbPromoMaxRedemptions').value || 0),
      promoCode: trim(document.getElementById('mbPromoCode').value),
      active: !!document.getElementById('mbPromoActive').checked,
      displayOnCustomerPage: !!document.getElementById('mbPromoDisplayOnCustomerPage').checked
    };
  }

  function resetPromoForm() {
    ['mbPromoName', 'mbPromoDescription', 'mbPromoDiscount', 'mbPromoStart', 'mbPromoEnd', 'mbPromoMaxRedemptions', 'mbPromoCode'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var scope = document.querySelector('input[name="mbPromoScope"][value="all"]');
    if (scope) scope.checked = true;
    var active = document.getElementById('mbPromoActive');
    if (active) active.checked = true;
    var disp = document.getElementById('mbPromoDisplayOnCustomerPage');
    if (disp) disp.checked = true;
    togglePromoServicesField();
    var err = document.getElementById('mbPromoFormError');
    if (err) { err.hidden = true; err.textContent = ''; }
  }

  function showPromoError(msg) {
    var err = document.getElementById('mbPromoFormError');
    if (!err) return;
    if (!msg) { err.hidden = true; err.textContent = ''; return; }
    err.hidden = false;
    err.textContent = msg;
  }

  function addPromotionFromForm() {
    var draft = readPromoForm();
    if (!draft.name) { showPromoError(t('promotionsErrorName') || 'Promotion name is required.'); return; }
    if (!draft.discountPercent || draft.discountPercent < 1 || draft.discountPercent > 90) {
      showPromoError(t('promotionsErrorDiscount') || 'Discount must be between 1 and 90.');
      return;
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      showPromoError(t('promotionsErrorDates') || 'End date must be on or after start date.');
      return;
    }
    if (draft.applyToScope === 'selected' && (!draft.appliesToServiceIds || !draft.appliesToServiceIds.length)) {
      showPromoError(t('promotionsErrorServices') || 'Pick at least one service for a selected-services promo.');
      return;
    }
    var now = new Date().toISOString();
    var promo = {
      id: 'promo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      vendorId: state.vendorId || (state.vendor && state.vendor.id) || '',
      name: draft.name,
      description: draft.description,
      discountPercent: draft.discountPercent,
      applyToScope: draft.applyToScope,
      appliesToServiceIds: draft.appliesToServiceIds,
      startDate: draft.startDate,
      endDate: draft.endDate,
      maxRedemptions: draft.maxRedemptions || 0,
      currentRedemptions: 0,
      active: draft.active,
      promoCode: draft.promoCode,
      displayOnCustomerPage: draft.displayOnCustomerPage !== false,
      createdAt: now,
      updatedAt: now
    };
    // Final validator pass — defends against any schema-level edge.
    if (DATA && typeof DATA.validatePromotion === 'function') {
      var v = DATA.validatePromotion(promo);
      if (!v.valid) { showPromoError(v.errors[0]); return; }
    }
    if (!Array.isArray(state.vendor.promotions)) state.vendor.promotions = [];
    state.vendor.promotions.push(promo);
    state.vendor.updatedAt = now;
    persistVendorPromotions();
    resetPromoForm();
    renderPromotionsList();
    showToast(t('promotionsAdded') || 'Promotion added.');
  }

  function deletePromotion(promoId) {
    if (!Array.isArray(state.vendor.promotions)) return;
    state.vendor.promotions = state.vendor.promotions.filter(function(p) { return p.id !== promoId; });
    state.vendor.updatedAt = new Date().toISOString();
    persistVendorPromotions();
    renderPromotionsList();
    showToast(t('promotionsRemoved') || 'Promotion removed.');
  }

  function togglePromotionActive(promoId, active) {
    if (!Array.isArray(state.vendor.promotions)) return;
    state.vendor.promotions = state.vendor.promotions.map(function(p) {
      if (p.id !== promoId) return p;
      return Object.assign({}, p, { active: !!active, updatedAt: new Date().toISOString() });
    });
    persistVendorPromotions();
    renderPromotionsList();
  }

  function persistVendorPromotions() {
    // Mirror into local storage for offline / static-fallback rendering.
    // STORAGE.vendor is a map keyed by vendorId (same shape persistVendor
    // and loadVendor use). Writing the raw vendor object here corrupted the
    // map so loadVendor() could no longer find it on reload — which made
    // every added/enabled promotion vanish on the next load.
    if (state.vendor && state.vendorId) {
      var rows = readJson(STORAGE.vendor, {});
      rows[state.vendorId] = state.vendor;
      writeJson(STORAGE.vendor, rows);
    }
    // Push to Firestore via the same merge pattern used by saveProfile.
    if (!canUseFirestore() || !state.vendorId) return;
    var patch = { promotions: state.vendor.promotions || [], updatedAt: state.vendor.updatedAt };
    root.firebase.firestore().collection(DATA.COLLECTIONS.vendors).doc(state.vendorId)
      .set(patch, { merge: true })
      .catch(function(err) {
        if (root.console) root.console.error('[mobile-barber-dashboard] save promotions failed', err);
      });
  }

  function renderPromotionsList() {
    var list = document.getElementById('mbPromotionsManageList');
    if (!list) return;
    list.innerHTML = '';
    var promos = (state.vendor && Array.isArray(state.vendor.promotions)) ? state.vendor.promotions : [];
    if (!promos.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('promotionsEmpty') || 'No promotions yet. Create one above.';
      list.appendChild(empty);
      return;
    }
    promos.forEach(function(promo) {
      var card = el('article', 'mb-promo-card');
      var head = el('div', 'mb-promo-card__head');
      var title = el('strong'); title.textContent = (promo.discountPercent || 0) + '% — ' + (promo.name || '');
      var badge = el('span', 'mb-promo-card__badge mb-promo-card__badge--' + (promo.active ? 'on' : 'off'));
      badge.textContent = promo.active ? (t('promotionsBadgeActive') || 'Active') : (t('promotionsBadgeInactive') || 'Inactive');
      head.appendChild(title); head.appendChild(badge);
      card.appendChild(head);
      var meta = el('p', 'mb-promo-card__meta');
      var range = [promo.startDate, promo.endDate].filter(Boolean).join(' → ') || (t('promotionsRangeAny') || 'No date limit');
      var redemption = (promo.maxRedemptions > 0)
        ? ((promo.currentRedemptions || 0) + '/' + promo.maxRedemptions + ' ' + (t('promotionsRedeemed') || 'redeemed'))
        : (t('promotionsUnlimited') || 'Unlimited');
      var scopeLabel = promo.applyToScope === 'selected'
        ? ((t('promotionsScopeSelected') || 'Selected services') + ' (' + (promo.appliesToServiceIds || []).length + ')')
        : (t('promotionsScopeAll') || 'All services');
      meta.textContent = scopeLabel + ' · ' + range + ' · ' + redemption;
      card.appendChild(meta);
      if (trim(promo.description)) {
        var desc = el('p', 'mb-promo-card__desc');
        desc.textContent = promo.description;
        card.appendChild(desc);
      }
      var actions = el('div', 'mb-promo-card__actions');
      var toggle = el('button', 'mb-button mb-button--ghost mb-button--sm');
      toggle.type = 'button';
      toggle.textContent = promo.active ? (t('promotionsPauseAction') || 'Pause') : (t('promotionsResumeAction') || 'Resume');
      toggle.addEventListener('click', function() { togglePromotionActive(promo.id, !promo.active); });
      actions.appendChild(toggle);
      var del = el('button', 'mb-button mb-button--ghost mb-button--sm');
      del.type = 'button';
      icoLabel(del, 'trash', t('promotionsDeleteAction') || 'Delete');
      del.addEventListener('click', function() {
        if (root.confirm && !root.confirm(t('promotionsDeleteConfirm') || 'Delete this promotion? Customers will no longer see it.')) return;
        deletePromotion(promo.id);
      });
      actions.appendChild(del);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function saveReviewResponses() {
    var byId = {};
    document.querySelectorAll('#mbReviewsManageList textarea[data-review-id]').forEach(function(input) {
      byId[input.dataset.reviewId] = input.value;
    });
    state.reviews = state.reviews.map(function(review) {
      if (!Object.prototype.hasOwnProperty.call(byId, review.id)) return review;
      return Object.assign({}, review, {
        vendorResponse: trim(byId[review.id]),
        updatedAt: new Date().toISOString()
      });
    });
    persistReviews();
    renderReviews();
    showToast();
  }

  function saveProfile() {
    state.vendor.businessName = trim(document.getElementById('mbDashBusinessName').value);
    state.vendor.barberName = trim(document.getElementById('mbDashBarberName').value);
    state.vendor.phone = trim(document.getElementById('mbDashPhone').value);
    state.vendor.email = trim(document.getElementById('mbDashEmail').value);
    state.vendor.serviceAreas = trim(document.getElementById('mbDashServiceAreas').value).split(',').map(trim).filter(Boolean);
    state.vendor.travelRadiusMiles = Number(document.getElementById('mbDashTravelRadius').value || 0);
    state.vendor.baseTravelFee = Number(document.getElementById('mbDashTravelFee').value || 0);
    state.vendor.updatedAt = new Date().toISOString();
    persistVendor();
    renderProfileForm();
    showToast();
  }

  function savePayments() {
    var qrInput = document.getElementById('mbZelleQrUpload');
    var file = qrInput && qrInput.files && qrInput.files[0];
    var apply = function(qrUrl) {
      state.vendor.cashEnabled = document.getElementById('mbCashEnabled').checked;
      state.vendor.zelleEnabled = document.getElementById('mbZelleEnabled').checked;
      state.vendor.zellePhone = trim(document.getElementById('mbZellePhone').value);
      state.vendor.zelleEmail = trim(document.getElementById('mbZelleEmail').value);
      if (qrUrl != null) state.vendor.zelleQrUrl = qrUrl;
      state.vendor.updatedAt = new Date().toISOString();
      persistVendor();
      renderPaymentsForm();
      showToast();
    };
    if (file && root.MobileBarberAIPreview && typeof root.MobileBarberAIPreview.compressImage === 'function') {
      root.MobileBarberAIPreview.compressImage(file).then(apply).catch(function(err) {
        if (root.console) root.console.error('[mobile-barber-dashboard] zelle qr compress failed', err);
        apply(null);
      });
    } else {
      apply(null);
    }
  }

  function saveService() {
    var id = document.getElementById('mbDashServiceSelect').value;
    state.services = state.services.map(function(service) {
      if (service.id !== id) return service;
      return Object.assign({}, service, {
        name: trim(document.getElementById('mbDashServiceName').value),
        price: Number(document.getElementById('mbDashServicePrice').value || 0),
        durationMinutes: Number(document.getElementById('mbDashServiceDuration').value || 0),
        cleanupBufferMinutes: Number(document.getElementById('mbDashCleanupBuffer').value || 0),
        travelBufferMinutes: Number(document.getElementById('mbDashTravelBuffer').value || 0)
      });
    });
    persistServices();
    renderServiceForm();
    showToast();
  }

  function saveHours() {
    state.availability.weeklyHours = state.availability.weeklyHours || {};
    document.querySelectorAll('#mbHoursGrid input').forEach(function(input) {
      var day = input.dataset.day;
      var field = input.dataset.field;
      state.availability.weeklyHours[day] = state.availability.weeklyHours[day] || {};
      state.availability.weeklyHours[day][field] = field === 'active' ? input.checked : input.value;
    });
    state.availability.updatedAt = new Date().toISOString();
    persistAvailability();
    showToast();
  }

  function addBlock() {
    var block = {
      id: 'block-' + Date.now().toString(36),
      vendorId: state.vendorId,
      date: document.getElementById('mbBlockDate').value,
      startTime: document.getElementById('mbBlockStart').value,
      endTime: document.getElementById('mbBlockEnd').value,
      reason: trim(document.getElementById('mbBlockReason').value),
      createdAt: new Date().toISOString()
    };
    if (!block.date || !block.startTime || !block.endTime) return;
    state.blocks.push(block);
    persistBlocks();
    renderBlocks();
    showToast();
  }

  function render() {
    setTranslatedText();
    document.title = t('pageTitle');
    document.documentElement.lang = state.lang;
    document.getElementById('mbDashboardLanguage').setAttribute('aria-label', t('languageLabel'));
    document.querySelectorAll('.mb-language__button').forEach(function(btn) {
      btn.classList.toggle('mb-language__button--active', btn.getAttribute('data-lang') === state.lang);
    });
    renderProfileForm();
    renderPaymentsForm();
    renderServiceForm();
    populatePromoServicesSelect();
    renderPromotionsList();
    renderHours();
    renderBlocks();
    renderPortfolio();
    renderReviews();
    renderBookings();
    renderNotificationControls();
    renderNotificationDrawer();
  }

  function setLang(lang) {
    if (!STRINGS[lang]) return;
    state.lang = lang;
    try {
      root.localStorage.setItem('dlcLang', lang);
      root.localStorage.setItem('dlc_lang', lang);
    } catch (e) {}
    render();
  }

  function bind() {
    document.querySelectorAll('[data-lang]').forEach(function(btn) {
      btn.addEventListener('click', function() { setLang(btn.getAttribute('data-lang')); });
    });
    document.querySelector('[data-action="refresh"]').addEventListener('click', function() {
      loadBookings().then(renderBookings);
    });
    document.querySelectorAll('[data-booking-filter]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.bookingFilter = btn.getAttribute('data-booking-filter') || 'upcoming';
        renderBookings();
      });
    });
    document.querySelectorAll('[data-summary-filter]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setSummaryFilter(btn.getAttribute('data-summary-filter'));
      });
      btn.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSummaryFilter(btn.getAttribute('data-summary-filter'));
        }
      });
    });
    document.querySelector('[data-action="saveProfile"]').addEventListener('click', saveProfile);
    document.querySelector('[data-action="savePayments"]').addEventListener('click', savePayments);
    document.querySelector('[data-action="saveService"]').addEventListener('click', saveService);
    document.querySelector('[data-action="saveHours"]').addEventListener('click', saveHours);
    document.querySelector('[data-action="addBlock"]').addEventListener('click', addBlock);
    document.querySelector('[data-action="addPortfolio"]').addEventListener('click', addPortfolioImage);
    var addPromoBtn = document.querySelector('[data-action="addPromotion"]');
    if (addPromoBtn) addPromoBtn.addEventListener('click', addPromotionFromForm);
    document.querySelectorAll('input[name="mbPromoScope"]').forEach(function(r) {
      r.addEventListener('change', togglePromoServicesField);
    });
    document.querySelector('[data-action="saveReviewResponses"]').addEventListener('click', saveReviewResponses);
    document.querySelector('[data-action="enableSoundAlerts"]').addEventListener('click', unlockSoundAlerts);
    var notifBell = document.getElementById('mbNotifBell');
    if (notifBell) notifBell.addEventListener('click', openNotificationDrawer);
    document.querySelectorAll('[data-action="closeNotifDrawer"]').forEach(function(btn) {
      btn.addEventListener('click', closeNotificationDrawer);
    });
    var markAllRead = document.querySelector('[data-action="markAllNotificationsRead"]');
    if (markAllRead) markAllRead.addEventListener('click', markAllNotificationsRead);
    document.querySelector('[data-action="toggleSoundAlerts"]').addEventListener('click', function() {
      state.soundAlertsEnabled = !state.soundAlertsEnabled;
      state.soundBlocked = false;
      writeString(soundStorageKey(), state.soundAlertsEnabled ? 'on' : 'off');
      if (state.soundAlertsEnabled) unlockSoundAlerts();
      renderNotificationControls();
    });
    document.getElementById('mbDashServiceSelect').addEventListener('change', fillSelectedService);
    if (!state.beforeUnloadBound) {
      root.addEventListener('beforeunload', unsubscribeBookingAlerts);
      state.beforeUnloadBound = true;
    }
  }

  function initLang() {
    var params = new URLSearchParams(root.location.search);
    var lang = params.get('lang');
    if (STRINGS[lang]) return lang;
    try {
      var saved = root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang');
      if (STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }

  function init() {
    state.vendorId = getVendorId();
    state.lang = initLang();
    state.notifiedBookingIds = readJson(notifiedStorageKey(), {});
    state.soundAlertsEnabled = readString(soundStorageKey(), 'on') !== 'off';
    loadVendor();
    resolveOwnerMode();
    state.ownerNotifications = state.ownerMode ? readJson(ownerNotificationsStorageKey(), []) : [];
    if (!Array.isArray(state.ownerNotifications)) state.ownerNotifications = [];
    state.ownerNotifications = state.ownerNotifications.slice(0, 120);
    loadServices();
    loadAvailability();
    loadBlocks();
    loadPortfolio();
    loadReviews();
    bind();
    seedSamplesOnce().catch(noop).then(function() {
      return hydrateVendorFromFirestore();
    }).then(function() {
      return loadBookings();
    }).then(function() {
      render();
      subscribeBookingAlerts();
    });
  }

  function redirectToLogin(vendorId) {
    var dest = '/vendor-login.html';
    if (vendorId) dest += '?id=' + encodeURIComponent(vendorId);
    root.location.href = dest;
  }

  function gateAndInit() {
    var requestedVendorId = getVendorId();
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.error('[mobile-barber-dashboard] Firebase Auth SDK not loaded');
      redirectToLogin(requestedVendorId);
      return;
    }
    if (!requestedVendorId) {
      redirectToLogin('');
      return;
    }
    var auth = firebase.auth();
    var db = firebase.firestore();
    var unsub = auth.onAuthStateChanged(function(user) {
      unsub();
      if (!user) {
        redirectToLogin(requestedVendorId);
        return;
      }
      Promise.all([
        db.collection('vendorUsers').doc(user.uid).get(),
        db.collection('vendors').doc(requestedVendorId).get()
      ]).then(function(results) {
        var uDoc = results[0];
        var vDoc = results[1];
        if (!uDoc.exists) {
          console.warn('[mobile-barber-dashboard] no vendorUsers/{uid} mapping for', user.uid);
          auth.signOut().then(function() { redirectToLogin(requestedVendorId); });
          return;
        }
        var uData = uDoc.data() || {};
        var allowed = uData.vendorId === requestedVendorId
                   || (Array.isArray(uData.vendorIds) && uData.vendorIds.indexOf(requestedVendorId) >= 0);
        if (!allowed) {
          console.warn('[mobile-barber-dashboard] user not authorized for vendor', requestedVendorId);
          auth.signOut().then(function() { redirectToLogin(requestedVendorId); });
          return;
        }
        if (!vDoc.exists) {
          console.warn('[mobile-barber-dashboard] vendor doc missing for', requestedVendorId);
          redirectToLogin(requestedVendorId);
          return;
        }
        var vData = vDoc.data() || {};
        if (vData.adminStatus && vData.adminStatus !== 'active') {
          console.warn('[mobile-barber-dashboard] vendor adminStatus=', vData.adminStatus);
          auth.signOut().then(function() { redirectToLogin(requestedVendorId); });
          return;
        }
        init();
      }).catch(function(err) {
        console.error('[mobile-barber-dashboard] auth check failed', err);
        redirectToLogin(requestedVendorId);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gateAndInit);
  } else {
    gateAndInit();
  }
})(window);
