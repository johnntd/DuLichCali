'use strict';
// ─────────────────────────────────────────────────────────────────────────
// AI Group Travel Concierge — client module  (travel-concierge.js?v=20260620zi)
//
// Powers /travel-concierge: multiple families plan one shared trip, answer
// intake (incl. per-family transportation), and get an AI day-by-day visual
// itinerary + a synchronized Family Arrival Plan. Mobile-first, isolated.
//
// AI: calls the `generateGroupTripPlan` callable (server-side keys). If that is
// unavailable or fails, falls back to a MOCK plan from window.TC_SAMPLES so the
// UI always works and never crashes (clearly labelled).
//
// PROVIDERS (mock-first, swappable): MapLinkProvider builds REAL Google/Apple
// Maps search URLs (allowed); PlaceMediaProvider uses safe placeholders;
// Travel/BusTicketProvider produce search links + "price pending verification"
// (never fake prices); ReservationLinkProvider only emits known/official links.
//
// LOGIN: family members log in with phone + password (the SAME unified DuLichCali
// customer account as Mobile Barber / Style Studio: derived email
// <phone>@mobile-barber.dulichcali21.local, Firebase email/password, LOCAL
// persistence). Viewing a real trip and voting/suggesting/selecting require login;
// demos are read-only local previews.
//
// LIVE RESEARCH: before planning, `researchTripHighlights` (Gemini + Google Search
// grounding) surfaces current/seasonal/trending picks (events, flower blooms,
// newly-popular spots) which are shown AND fed into the planner. All unverified.
//
// PERSIST/SHARE: trip saved to localStorage AND (when logged in) Firestore
// groupTrips/{tripId} (unguessable id = capability). Share via ?trip=<id>.
// ─────────────────────────────────────────────────────────────────────────
(function (root) {
  if (!root || !root.document) return;
  var doc = root.document;

  // ── i18n (vi / en / es) — UI chrome only; AI content arrives in the user's language ──
  var T = {
    en: {
      backHome: '← Back to Du Lich Cali',
      heroChip: 'AI Group Travel Concierge', heroTitle: 'Your AI travel agent for families and friends.',
      heroSub: 'Tell us who’s coming, where you want to go, and what you enjoy. AI discovers the best experiences, compares how to get there, recommends where to stay, and builds one shared plan your whole group can vote on.',
      heroFreeNote: 'Free to start · preview a full sample, no account needed · your plan is ready in about a minute.', heroTrySample: 'See a sample first', demoMeta: '{f} families · {d} days',
      liveSampleBadge: 'Live sample', whyFits: 'Why it fits your group', sampleMoreNote: 'Full plan has maps, food picks, bookings & a synced arrival plan for every family.', seeFullSample: 'See the full sample', otherSamples: 'Or try another',
      start: 'Build my group plan', step: 'Step', of: 'of', day: 'Day', watchClip: 'Watch clip',
      // Landing — Who/Where/What band
      wwwTitle: 'Tell us 3 things — AI does the homework', www_who: 'WHO is traveling', www_who_d: 'Families, kids, teens, seniors — we plan around everyone.', www_where: 'WHERE you want to go', www_where_d: 'One city or a multi-stop road trip.', www_what: 'WHAT you enjoy', www_what_d: 'Food, beaches, theme parks, culture, hidden gems.', wwwDo: 'AI does the homework — experiences, hotels, transport, schedule and costs.',
      // Landing — How it works
      hiwTitle: 'How it works', hiw1: 'Tell AI who’s traveling', hiw1d: 'Add each family — kids, teens, seniors, food, budget and pace.', hiw2: 'AI discovers the best experiences', hiw2d: 'Attractions, food, events, hidden gems, stays and transport options.', hiw3: 'Families vote & optimize together', hiw3d: 'Everyone votes 👍🤔👎❤️ and the AI re-optimizes the plan.', hiw4: 'Travel with shared maps, alerts & memories', hiw4d: 'Live group map, arrival alerts, a shared album and AI clips.',
      // Landing — Agent capability cards
      capTitle: 'What your AI travel agent does', capSub: 'Ten ways the concierge does the homework for your group.',
      cap_family: 'Multi-family planning', cap_family_d: 'Plans around every family’s kids, teens, seniors, budget and pace.',
      cap_experiences: 'Best experiences', cap_experiences_d: 'Memorable, family-fit experiences — not just a list of places.',
      cap_discover: 'Attractions, food & events', cap_discover_d: 'Restaurants, popular dishes, live events, hidden gems and stopovers.',
      cap_transport: 'Transport comparison', cap_transport_d: 'Car, flight, Hoàng Bus and DuLichCali rides — time, cost and best-for.',
      cap_stay: 'Stay intelligence', cap_stay_d: 'Best area plus hotels and Airbnb by budget, family-fit and location.',
      cap_vote: 'Group voting', cap_vote_d: 'Every family votes 👍🤔👎❤️ — skipped items don’t come back.',
      cap_optimize: 'AI keeps improving', cap_optimize_d: 'Re-optimize for kids, food, lower cost, less driving and more.',
      cap_live: 'Live maps & alerts', cap_live_d: 'Opt-in group map, ETAs and arrival/delay alerts during the trip.',
      cap_album: 'Album & AI Clips', cap_album_d: 'A shared album plus an AI social-clip package — captions and posts.',
      cap_costs: 'Shared trip costs', cap_costs_d: 'Total, per-family and per-person estimates by category.',
      // Landing — Trust
      trustTitle: 'Built by Du Lich Cali', trustSub: 'Vietnamese-American travel expertise for families and friends.', trust_noprice: 'No fake prices', trust_nobooking: 'No fake bookings', trust_nophotos: 'No AI-generated attraction or restaurant photos', trustNote: 'Estimates are clearly labeled; real photos come from Google Places & Wikipedia.',
      // Onboarding — optional details
      moreOptional: 'More details (optional)', moreOptionalHint: 'AI uses smart defaults — Moderate budget, balanced pace. Change these anytime.',
      // Immersive hero showcase — floating "AI discovers…" chips
      heroShowcaseLead: 'AI discovers…', disc_attractions: 'Attractions', disc_beaches: 'Beaches', disc_restaurants: 'Restaurants', disc_gems: 'Hidden gems', disc_events: 'Local events', disc_themeparks: 'Theme parks', disc_hotels: 'Hotels', disc_transport: 'Transport options', disc_voting: 'Group voting', disc_livemap: 'Live maps', disc_clips: 'AI clips',
      disc_sealife: 'Wildlife & sea lions', disc_nature: 'Nature & parks', disc_nightlife: 'Nightlife & shows', disc_icons: 'Iconic sights', discoverTitle: 'AI discovers your trip', discoverSub: 'Real places, real experiences — surfaced for your group.',
      // Capability card examples (animated preview)
      cap_family_ex: 'e.g. balances Disneyland for the 6-year-olds with a teen-friendly kayak tour', cap_experiences_ex: 'e.g. a harbor cruise the whole family remembers', cap_discover_ex: 'e.g. a Little Saigon phở spot you’d never find alone', cap_transport_ex: 'e.g. Hoàng Bus + a DuLichCali ride beats a 7-hour drive', cap_stay_ex: 'e.g. a family suite near the beach vs. by the parks', cap_vote_ex: 'e.g. the group skips the museum, so AI swaps in the zoo', cap_optimize_ex: 'e.g. “make it cheaper” trims $300 without losing the highlights', cap_live_ex: 'e.g. everyone sees who has arrived at the hotel', cap_album_ex: 'e.g. a ready-to-post recap reel of the trip', cap_costs_ex: 'e.g. each family sees their share, by category',
      // Popular destination showcase
      showcaseTitle: 'Popular trips to plan', showcaseSub: 'Tap one and the AI researches the real trip for your group — these are just ideas, nothing is forced.', bestForLabel: 'Best for', planThisTrip: 'Plan this trip', showcaseNote: 'Examples only — the AI plans every trip fresh from who’s traveling, when, and what you enjoy.',
      dest_sandiego_best: 'Families, beaches & animals', dest_oc_best: 'Theme parks & Little Saigon food', dest_sf_best: 'Icons, bay views & culture', dest_vegas_best: 'Shows, the Strip & day trips', dest_la_best: 'Movies, stars & the coast', dest_yosemite_best: 'Nature, hikes & big views',
      ctaBandTitle: 'Your next trip, designed by AI', ctaBandSub: 'Tell us who, where and what you love — get a shared, bookable plan in about a minute.',
      // Create
      createTitle: 'Create your group trip', groupName: 'Trip / group name', destination: 'Destination',
      dates: 'Travel dates', departureCity: 'Main departure area', numFamilies: 'How many families / groups?',
      tripStyle: 'Trip pace', budget: 'Overall budget', createBtn: 'Next: add families',
      style_relaxed: 'Relaxed', style_balanced: 'Balanced', style_packed: 'Packed',
      budget_budget: 'Budget', budget_moderate: 'Moderate', budget_luxury: 'Luxury',
      // Family intake
      familiesTitle: 'Who is coming?', familySub: 'Add each family or group — ages and needs shape the plan.',
      familyName: 'Family / group name', adults: 'Adults', childrenAges: 'Children ages (comma-separated)',
      seniors: 'Seniors', foodPrefs: 'Food preferences', interests: 'Activity interests',
      accessibility: 'Accessibility needs', napNeeds: 'Nap / rest needs', roomNeeds: 'Hotel room needs',
      addFamily: 'Add another family', removeFamily: 'Remove',
      // Transportation (per family)
      transportTitle: 'How will this family get there?', method: 'Travel method',
      m_car: 'Car', m_plane: 'Plane', m_bus: 'Bus', m_other: 'Other',
      origin: 'Starting city / address', travelers: 'Travelers', departureWindow: 'Preferred departure',
      arrivalDeadline: 'Arrival deadline', luggage: 'Luggage needs', carSeat: 'Toddler car seat needed',
      numCars: 'Number of cars', transportBudget: 'Transport budget',
      childrenLabel: 'Children', totalTravelers: 'Total travelers', overrideTravelers: 'Override traveler count', travelerMismatch: 'Manual count differs from the auto total ({auto}).', carSuggest: 'AI suggests {n} car(s) for {t} travelers', suvNote: 'With a toddler + luggage, an SUV or minivan is recommended.', groundTransport: 'Getting around at the destination', gt_rental_car: 'Rental car', gt_uber_lyft: 'Uber / Lyft', gt_pickup: 'Pickup', gt_shuttle: 'Shuttle',
      // Preferences
      prefsTitle: 'Fine-tune the plan', prefsSub: 'Tell the AI what matters most.',
      pace: 'Pace', kidPriority: 'Kid-friendly priority', foodiePriority: 'Foodie priority',
      photoPriority: 'Photo / video spots', minDriving: 'Minimize driving', hiddenGems: 'Include hidden gems',
      freeActivities: 'Include free activities', reservationActivities: 'Include reservation-required spots',
      backupPlans: 'Include backup plans', generate: 'Generate AI trip plan',
      // Generating / plan
      generating: 'Designing your group trip…', genFail: 'AI is busy — here is a sample plan you can edit.',
      tab_overview: 'Overview', ovReadyShort: 'ready', ovNext: 'Next', ovAllSet: "You're all set", ovFamilies: 'families',
      ovHighlights: 'Highlights', ovSeeAll: 'See all', ovTimeline: 'Your days', ovViewItinerary: 'View full itinerary',
      ovDiscoveries: 'AI Discoveries', ovConcierge: 'Ask the concierge', ovCuratingHighlights: 'AI is curating highlights…', ovQuickLinks: 'Jump to',
      ovChipStay: 'Stay', ovChipTransport: 'Transport', ovChipTickets: 'Tickets', ovChipFood: 'Food',
      ovAskOptimize: 'Optimize my plan', ovAskGems: 'Find hidden gems', ovAskBook: 'What should I book next?',
      season_spring: 'Spring', season_summer: 'Summer', season_fall: 'Fall', season_winter: 'Winter',
      tab_days: 'Days', tab_tasks: 'Tasks', tab_more: 'More', moreNavTitle: 'All sections', continuePlanning: 'Continue Planning',
      navTrips: 'Trips', navConcierge: 'AI Concierge', navShare: 'Share', navProfile: 'Profile', mustSee: 'Must See', topPick: 'Top Pick',
      ovToDo: 'to do', ovDone: 'done', ovTotalLc: 'total', ovFamilyLc: 'family', ovEstimated: 'Estimated', ovRemaining: 'Remaining',
      ovMemories: 'Memories', ovAddToTrip: 'Add to trip', ovReplace: 'Replace', ovReplaceCmd: 'Add {name} to the trip and swap out a similar lower-priority spot',
      tab_itinerary: 'Itinerary', tab_arrival: 'Family Arrival Plan', tab_group: 'Group',
      tab_journey: 'Journey', journeyTitle: 'Your journey', journeySub: 'Every stop, stay and ride as a node. Lock what you love 🔒 — the AI only replans around it.', jnNoPlan: 'Generate the trip first — your journey timeline appears here.', jnLock: 'Lock', jnUnlock: 'Unlock', jnLocked: 'Locked', jnImprove: 'Improve around this', jnImproving: 'Replanning this day (keeping locked items)…', jnAddAfter: 'Add after', jnReplanDay: 'Replan this day', jnReplanKeep: 'keeps 🔒 locked', jnReplanned: 'Day replanned — locked items kept', jnTransportNode: 'Transport', jnViewTransport: 'Compare transport', jnNodeMenu: 'Options', jnAddPh: 'Add a place / activity', jnAdd: 'Add',
      cmdPh: 'Tell the concierge what to change…', cmdGo: 'Ask AI', cmdBusy: 'Understanding your request…', cmdPlanTitle: 'Here’s what I’ll change', cmdNone: 'I couldn’t turn that into an edit — try rephrasing (e.g. “skip the zoo”, “add Disneyland day 2”, “find another Vietnamese dinner”).', cmdFail: 'Couldn’t interpret that right now — try again.', cmdDays: 'Replans day {d}', cmdApply: 'Apply changes', cmdApplied: 'Trip updated', cmdCancel: 'Cancel',
      cmdop_skip: 'Skip', cmdop_delete: 'Remove', cmdop_lock: 'Lock', cmdop_unlock: 'Unlock', cmdop_replace: 'Replace', cmdop_add: 'Add', cmdop_retime: 'Re-time', cmdop_replan_day: 'Replan', cmdop_stay_extra_night: 'Stay an extra night', cmdop_leave_earlier: 'Leave earlier', cmdop_change_return: 'Change return',
      rideBookingTitle: 'DuLichCali ride', rideBookedToast: 'Ride booked and added to your trip', rideRequestedToast: 'Ride requested — pending confirmation', rideNotCompleted: 'Ride booking not completed — nothing was added. You can try again.', rideBookedNote: 'DuLichCali ride booked', rideRequestedNote: 'DuLichCali ride requested', rideRequestMichael: 'Request Michael ride', rideBookDlc: 'Book with DuLichCali', rideViewRequest: 'View request', rideModifyRequest: 'Modify request', rideCancelRequest: 'Cancel request', rideViewTitle: 'Your ride request', rideRouteLabel: 'Route', ridePassengers: 'Passengers', rideCancelledNote: 'Ride request cancelled', rideCancelledToast: 'Ride request cancelled — you can request it again anytime', rideModifyNote: 'MODIFIED — replaces request #{id}; please cancel the previous booking',
      groupTravelersTitle: 'Who\'s travelling', travelersAdults: 'adults', travelersEdit: 'Edit travelers',
      summary: 'Trip summary', assumptions: 'Assumptions', warnings: 'Good to know',
      costRange: 'Estimated cost', meetup: 'Meetup', regenDay: 'Regenerate day',
      // Place card / modal
      whySelected: 'Why we picked it', bestTime: 'Best time', duration: 'Time here', parking: 'Parking',
      kidFriendly: 'Kid-friendly', walking: 'Walking', cost: 'Cost', details: 'Details', replace: 'Replace',
      mapG: 'Google Maps', mapA: 'Apple Maps', website: 'Website', reserve: 'Reserve', ticket: 'Tickets',
      backup: 'Backup nearby', tips: 'Tips', close: 'Close',
      walk_low: 'Low walking', walk_medium: 'Some walking', walk_high: 'Lots of walking',
      pending: 'Pending verification', unverified: 'AI suggestion — verify details before booking',
      // Vote / booking
      vote: 'Vote', v_like: 'Like', v_maybe: 'Maybe', v_skip: 'Skip', save: 'Save', saved: 'Saved',
      cons_loved: 'Group ❤', cons_liked: 'Group likes', cons_mixed: 'Mixed', cons_skip: 'Group skips', sortedByVotes: 'Sorted by your group\'s votes',
      tab_album: 'Album', tab_clips: 'AI Clips',
      albumTitle: 'Trip album', albumSub: 'Share trip photos & videos by link — tag, favorite and pick the best for an AI clip. Private items stay private.', albumDemo: 'The album opens once you create a real trip.', albumEmpty: 'No media yet — add a photo/video link to start your album.', albumAdd: 'Add media', albumAddHint: 'Paste a photo/video URL or a shared album link (Google Photos, Amazon Photos, etc.). Links only for now — no upload.', albumUrl: 'Photo / video / album link', albumUrlPh: 'https://… (image URL or shared album link)', albumCaption: 'Caption', albumCaptionPh: 'A short caption', albumPlace: 'Place', albumPlacePh: 'Where was this?', albumNoDay: 'No specific day', albumVisibility: 'Who can see it', albumAddBtn: 'Add to album', albumAdded: 'Added to the album', albumOpen: 'Open', albumLink: 'Media link', albumFav: 'Favorite', albumSelect: 'Use in clip', albumPrivacyNote: 'Only trip members can see the album. Private items are visible only to you and the trip owner. Nothing is posted anywhere.',
      vis_group: 'All trip members', vis_private: 'Only me', vis_selected_only: 'Only if picked for a clip',
      clipsTitle: 'AI social clips', clipsSub: 'AI builds a ready-to-shoot package (storyboard, captions, voiceover, hashtags, per-platform posts) from the media you pick. It never renders or posts a video.', clipsSelectHint: '{n} media selected — tick "Use in clip" on album items to include them.', clipsNeedSelect: 'Pick at least one album item first (Use in clip).', clipNeedConsent: 'Please confirm consent to use the selected media first.', clipPlatform: 'Platform', clipMood: 'Mood', clipLength: 'Length', clipConsent: 'I confirm everyone in the selected photos/videos is OK using them. Private items are never used unless I picked them.', clipGenerate: 'Build clip package', clipWorking: 'Building your clip package…', clipFail: 'Could not build the package right now — try again.', clipStoryboard: 'Storyboard', clipVoiceover: 'Voiceover script', clipOverlays: 'Text overlays', clipHashtags: 'Hashtags', clipExportNote: 'This is an export package for your editor / social video tool — no video is rendered or posted here.',
      clipPost_tiktok: 'TikTok', clipPost_instagram: 'Instagram', clipPost_youtube: 'YouTube', clipPost_facebook: 'Facebook',
      clipmood_fun: 'Fun', clipmood_cinematic: 'Cinematic', clipmood_heartfelt: 'Heartfelt', clipmood_energetic: 'Energetic',
      cliplen_short: 'Short (~15–30s)', cliplen_medium: 'Medium (~30–60s)', cliplen_long: 'Long (1–3 min)',
      youAre: 'You are:', pickFamilyHint: 'Pick your family above to vote.',
      suggestionsTitle: 'Group suggestions', addSuggestion: 'Suggest a place or activity', suggestionPh: 'e.g. Sunset dinner at the pier', suggest: 'Add', suggestedBy: 'by', noSuggestions: 'No suggestions yet — add one!',
      booking: 'Booking', b_not_needed: 'Not needed', b_needed: 'Needed', b_booked: 'Booked', b_skipped: 'Skipped',
      markBooked: 'Mark booked', markArrived: 'Mark arrived', completed: 'Done',
      // Arrival plan
      recDeparture: 'Recommended departure', eta: 'Estimated arrival', route: 'Route', restStops: 'Rest stops',
      ticketSearch: 'Search tickets', status: 'Status', st_planning: 'Planning', st_booked: 'Booked',
      st_on_the_way: 'On the way', st_arrived: 'Arrived', notes: 'Notes', addNote: 'Add a group note', send: 'Send',
      // Group / share
      shareTitle: 'Share this trip', shareSub: 'Family members log in with their phone to view, vote, and suggest.',
      copyLink: 'Copy link', copied: 'Link copied!', viewOnly: 'Shared trip (view & vote)',
      newTrip: 'New trip', editTrip: 'Edit trip',
      required: 'Please fill the required fields.',
      // Login + live research
      loginTitle: 'Log in to view this trip', loginSub: 'Use your phone number to see the plan and to vote, suggest, and select with your family.',
      signIn: 'Log in', signUp: 'Create account', phone: 'Phone number', password: 'Password',
      passwordHelp: 'New here? Pick a password (at least 8 characters) to create your account.',
      authFailed: 'Login failed. Check your phone and password.', needAccount: 'New here? Create an account', haveAccount: 'Already have an account? Log in', logout: 'Log out',
      logInExisting: 'Log in to your account', myTrips: 'Your trips', noTripsYet: 'No saved trips yet — start one above.', resumeHint: 'Tap a trip to keep planning.',
      dashTitle: 'My Trips', tcBrand: 'Travel Concierge', backToMyTrips: '← My Trips', createNewTrip: '+ Create new trip', editTripBtn: 'Edit', deleteTripBtn: 'Delete', openTripBtn: 'Open', moreActions: 'More', ownedSection: 'Trips you own', joinedSection: 'Trips you joined', lastUpdated: 'Updated', neverUpdated: 'Draft', delConfirmTitle: 'Delete this trip?', delConfirmBody: 'This hides the trip from your list and disables its share link and passcode. Participants lose access.', delConfirmYes: 'Delete trip', cancelBtn: 'Cancel', tripDeleted: 'Trip deleted', deleting: 'Deleting…', dashLoginPrompt: 'Log in to see and manage your trips.', moreSheetTitle: 'Trip actions',
      researching: 'Researching current highlights…',
      liveTitle: '🔥 Trending & seasonal right now', liveSub: 'Live picks for your dates — events, seasonal sights, and currently popular spots.',
      sampleReadonly: 'This is a sample. Start your own trip to vote and suggest.',
      // Phase 1 — richer questionnaire + multi-destination
      style_luxury: 'Luxury', style_budget: 'Budget',
      grpInterests: 'Activity interests', grpFood: 'Food preferences', grpHotel: 'Hotel preferences', grpKids: 'Kids', grpTeens: 'Teens', grpSeniors: 'Seniors', foodOther: 'Other cuisines / notes',
      destinations: 'Destinations', addDestination: 'Add destination', removeDestination: 'Remove destination', moveUp: 'Move up', moveDown: 'Move down',
      legStart: 'Start date', legEnd: 'End date', hotelName: 'Hotel name', hotelArea: 'Hotel area', hotelNotes: 'Hotel notes', moreDetailsOptional: 'More details (optional)',
      hotelStatus: 'Hotel status', hs_planning: 'Planning', hs_researching: 'Researching', hs_booked: 'Booked',
      travelDay: 'Travel day', driveTime: 'Drive time', distance: 'Distance', departFrom: 'Depart', arriveAt: 'Arrive', mealStops: 'Meal stops', restStopsLabel: 'Rest stops',
      routeOverviewTitle: 'Route', totalDriveTime: 'Total drive time', totalDistance: 'Total distance', leg: 'Leg', legPending: 'Details coming soon for this stop.', dayOpen: 'Open day — ask AI to plan this day',
      learnMore: 'Learn more', lmLoading: 'Finding helpful links…', lmVerify: 'verify', lmWhy: 'Why we recommend it', lmGroupFit: 'Group fit', lmBestTime: 'Best time', lmTimeNeeded: 'Time needed', lm_official_site: 'Official site', lm_menu: 'Menu', lm_ticket: 'Tickets', lm_google_reviews: 'Google reviews', lm_yelp_reviews: 'Yelp reviews', lm_tripadvisor: 'Tripadvisor', lm_youtube_search: 'Find videos on YouTube', lm_tiktok: 'Find on TikTok', lm_photos: 'Photos', lm_map: 'Map', lm_blog_guide: 'Travel guide', lmParking: 'Parking', lmWalking: 'Walking', lmWaitTime: 'Wait time', lmSafety: 'Safety', lmWeather: 'Weather backup',
      popularDishesLabel: 'Popular dishes', altTitle: 'Alternatives & backups', alt_kidFriendly: 'Kid-friendly', alt_toddlerLowEnergy: 'Toddler / low-energy', alt_teenOption: 'Teen option', alt_seniorLowWalking: 'Senior / low-walking', alt_rainyDay: 'Rainy day', alt_foodBackup: 'Food backup',
      routeVerifiedTag: 'Distances via Google Maps', routeEstimatedTag: 'Estimated distances', driveHome: 'Drive home',
      dt_arrival_day: 'Arrival', dt_transfer_day: 'Travel', dt_return_day: 'Return', dt_mixed_day: 'Mixed',
      mustDoTitle: 'Must-do activities (optional)', pinnedHint: 'Pin activities you already know you want — the AI schedules around them.', addPinned: 'Add must-do activity', pinnedActivity: 'Activity', pinnedTitlePh: 'e.g. San Diego Zoo', anyDestination: 'Any destination', preferredDay: 'Preferred day', preferredTime: 'Preferred time', flexible: 'Flexible', priority: 'Priority', pinnedBookingNote: 'Must-do — book tickets/reservation ahead',
      tod_flexible: 'Flexible', tod_morning: 'Morning', tod_lunch: 'Lunch', tod_afternoon: 'Afternoon', tod_dinner: 'Dinner', tod_evening: 'Evening', prio_required: 'Required', prio_preferred: 'Preferred', prio_optional: 'Optional',
      hotelsTitle: 'Hotels', researchHotels: 'Search hotels', fatigueNote: 'Fatigue', napNote: 'Nap timing', seniorNote: 'Senior note',
      genSkeleton: 'Mapping your route…', genLeg: 'Planning each stop…', genLegOf: 'Planning stop {n} of {total}…',
      // Travel Booking Concierge
      tab_bookings: 'Tasks', bookingsTitle: 'Trip tasks & action items', bookingsSub: 'What to book, confirm, and pay for this trip.',
      bookingApprovalNotice: 'The AI researches and prepares options only — it never buys, charges your card, or stores card numbers. You complete payment on the official page.',
      researchBookings: 'Research options (AI)', rebuildChecklist: 'Rebuild from itinerary', addBooking: 'Add booking', noBookings: 'No booking items yet — research options or add one.',
      tdealsTitle: 'Ticket deals', tdealsSub: 'Ways your group can pay less on paid attractions — researched, never auto-bought.', tdealsFind: 'Find ticket deals', tdealsRefresh: 'Refresh deals', tdealsResearching: 'Hunting ticket deals…', tdealsNone: 'No clear deals found right now', tdealsNoTickets: 'No ticketed attractions yet — rank attractions first (Highlights).', tdealsEmpty: 'No ticket deals yet.', tdealSave: 'save', tdealBookBy: 'buy', tdealOfficial: 'Official tickets', tdealSearch: 'Compare deals', tdeal_multi_day: 'Multi-day pass', tdeal_family_bundle: 'Family bundle', tdeal_early_bird: 'Early-bird / advance', tdeal_combo: 'Combo / bundle', tdeal_membership: 'Membership', tdeal_group: 'Group rate', tdeal_free_day: 'Free / discount day', tdeal_resident: 'Resident discount', tdeal_military_senior_student: 'Military / senior / student', tdeal_other: 'Deal',
      researchingBookings: 'Finding tickets & reservations to book…', conciergeWorking: 'Your AI concierge is doing the homework — hotels, food and bookings are loading.', refreshResearch: 'Refresh',
      bookingType: 'Type', openOfficial: 'Open official page', readyToBook: 'Ready to book', markBooked: 'Mark booked', undoBooked: 'Booked ✓ (tap to undo)',
      iBookedThis: 'I booked this', confirmBookingTitle: 'Confirm your booking', confirmBookingIntro: 'Book on the operator’s site, then paste your confirmation number and the price you actually paid.', confirmBookingHonesty: 'Only what you enter is saved — we never auto-confirm or fetch prices.', confirmBookingSave: 'Save booking', confirmNeedNumber: 'Add the confirmation number first.', confirmationNumberPh: 'e.g. ABC123', actualPricePaid: 'Price you paid', actualPricePh: 'e.g. $420', confirmGoFlight: 'Search & book the flight', confirmGoHotel: 'Search & book the hotel', confirmFlightAirlineHint: 'Tip: book on the airline’s own site when prices match — easier changes.', selfBookedToast: 'Booking saved to your trip', selfBookedNote: 'Booked', selfBookedBy: 'Booked by', selfBookedLedgerNote: 'Self-booked',
      confirmationNumber: 'Confirmation #', cancellationPolicy: 'Cancellation policy', refundPolicy: 'Refund policy', deadlineLabel: 'Book by', providerLabel: 'Provider', recommended: 'Recommended', bookingNotes: 'Notes',
      bt_flight: 'Flight', bt_hotel: 'Hotel', bt_airbnb: 'Vacation rental', bt_attraction: 'Attraction / tickets', bt_restaurant: 'Restaurant', bt_tour: 'Tour', bt_parking: 'Parking', bt_rental_car: 'Rental car', bt_bus: 'Bus', bt_ride: 'Ride', bt_packing: 'Packing', bt_payment: 'Payment', bt_confirmation: 'Confirmation', bt_other: 'Other',
      bs_research_needed: 'Research needed', bs_researching: 'Researching', bs_ready_to_book: 'Ready to book', bs_user_approval_needed: 'Needs approval', bs_booked: 'Booked', bs_skipped: 'Skipped', bs_paid: 'Paid', bs_not_needed: 'Not needed', bs_completed: 'Completed',
      tf_todo: 'To do', tf_completed: 'Completed', markDone: 'Mark done', taskCompletedBy: 'Completed by',
      naTitle: 'Next', naAllSet: "You're all set", naResearch: 'Research options',
      blkTransport: 'Waiting for transportation', blkStay: 'Hotel not booked yet', blkPrior: 'Waiting on an earlier step', blkDep: 'Waiting on a prerequisite',
      progTransport: 'Transport', progHotels: 'Hotels', progTickets: 'Tickets', progActivities: 'Activities', progFood: 'Food',
      warnHotelFirst: 'Book the hotel in {city} before its tickets & activities.', warnBookSoon: '{title} — book soon, it may sell out.', warnReturnMissing: 'Your trip home is still missing — add the return transport.', warnUnscheduled: '{n} item(s) not yet placed in your trip.',
      depMapTitle: 'Dependency map', depMapSub: 'What depends on what — the order to lock things in',
      pri_P0: 'P0 · Urgent', pri_P1: 'P1', pri_P2: 'P2', taskUnassigned: 'Unassigned', taskDue: 'Due date', taskCost: 'Est. cost', taskBook: 'Book', taskConfirmRide: 'Confirm ride', taskChoose: 'Choose/vote', taskActual: 'Actual cost', taskPaidBy: 'Paid by', taskPaidByNone: 'Not paid', taskBalanceTitle: 'Per-family balance', taskOwed: 'owed', taskOwes: 'owes', taskAhead: 'ahead', taskPaidTotal: 'Total paid', taskRemaining: 'remaining', taskWholeFamily: 'Whole family', memberCostTitle: 'Per-person owed', memberCostUnassigned: 'Unassigned (no person yet)', tf_all: 'All', tf_urgent: 'Urgent', tf_mine: 'My tasks', tf_unpaid: 'Unpaid', tf_bookings: 'Bookings', tf_done: 'Completed',
      // Shared trip access (invite link + passcode + roles)
      shareTrip: 'Share Trip', shareModalTitle: 'Invite your group', shareLinkLabel: 'Trip link', sharePasscodeLabel: 'Passcode', copyPasscode: 'Copy passcode', passcodeCopied: 'Passcode copied!',
      regeneratePasscode: 'Regenerate link + passcode', shareRegenWarn: 'This creates a new link and passcode; the old ones stop working.', disableSharing: 'Disable sharing', enableSharing: 'Enable sharing', sharingDisabled: 'Sharing is currently OFF.', shareGenerating: 'Creating secure invite…',
      sharePermInfo: 'Anyone with the link AND passcode can log in to view, vote, suggest, and add their family. Only you can edit the trip, approve suggestions, and manage members. No one can delete the trip or make purchases.',
      membersTitle: 'Members', role_owner: 'Owner', role_organizer: 'Organizer', role_member: 'Member', role_guest: 'Guest', promote: 'Make organizer', demote: 'Make member',
      joinTitle: 'Join this trip', joinPasscodePrompt: 'Enter the trip passcode', yourName: 'Your name', joinBtn: 'Join trip', joining: 'Joining…',
      joinBadPasscode: 'Incorrect passcode. Check with the trip owner.', joinRateLimited: 'Too many attempts — please try again in a few minutes.', joinDisabled: 'This trip link is no longer active. Ask the owner for a new one.',
      sg_pending: 'Pending', sg_approved: 'Approved', sg_rejected: 'Rejected', approve: 'Approve', reject: 'Reject',
      emailOptional: 'Email (optional)', roleRequested: 'Join as', addMyFamily: '+ Add my family', chooseFamily: 'Which family are you with?', newMemberOpt: 'Just me (no family)',
      joinedLabel: 'Joined', lastActiveLabel: 'Last active', memberPhone: 'Phone', addMemberBtn: 'Add member', invitedPending: 'Invited (pending)', assignFamilyBtn: 'Family',
      loggedInAs: 'Logged in as', switchMember: 'Switch member', logoutTrip: 'Log out of trip', familyNamePh: 'e.g. The Nguyens',
      destRoleLabel: 'This stop is', stayOvernightQ: 'Stay overnight here?', hotelNeededQ: 'Need a hotel/Airbnb here?', hoursLabel: 'Time to spend here', hoursPh: 'e.g. 2 hours, half day', suggestFoodQ: 'Suggest food', suggestActivitiesQ: 'Suggest activities', optionalStop: 'Optional stop', editDestination: 'Edit destination', regenLeg: 'Regenerate this leg', optionalBadge: 'Optional',
      advancedOptions: 'Advanced options', customizeStop: "Customize this stop's dates", aiRecommendsStay: 'Tell us your vibe — the AI recommends the best area, value, family & luxury stays.', knowHotelHint: 'Already know your hotel? Enter it (optional).', specialInstructions: 'Special instructions',
      lastDayFullQ: 'Use last day as a full activity day', returnDay: 'Return day',
      dhp_budget: 'Budget', dhp_moderate: 'Moderate', dhp_luxury: 'Luxury', dhp_pool: 'Pool', dhp_kitchen: 'Kitchen', dhp_breakfast: 'Breakfast', dhp_suite: 'Suite', dhp_ocean_view: 'Ocean view', dhp_near_attractions: 'Near attractions',
      dr_main_destination: 'Main destination', dr_overnight_destination: 'Overnight stay', dr_stopover: 'Stopover (activity)', dr_meal_stop: 'Meal / rest stop', dr_airport_arrival: 'Airport arrival', dr_pass_through: 'Pass-through', dr_optional_attraction: 'Optional attraction',
      tab_stay: 'Stay', whereToStayTitle: 'Where to stay', staysSub: 'AI-researched areas with hotel & Airbnb options for each stop.', findStays: 'Find places to stay (AI)', researchingStays: 'Researching the best areas & stays…', noStaysYet: 'Tap “Find places to stay” for AI hotel & Airbnb picks.', bestArea: 'Best area', airbnbAreasTitle: 'Airbnb / rental areas', searchHotelBtn: 'Search hotels', searchAirbnbBtn: 'Search Airbnb', selectStay: 'Select', staySelected: 'Selected ✓', parkingLabel: 'Parking', distanceLabel: 'Distance',
      stayfor_budget: 'Budget', stayfor_best_value: 'Best value', stayfor_family: 'Family-friendly', stayfor_luxury: 'Luxury', stayfor_pool: 'Pool', stayfor_breakfast: 'Breakfast', stayfor_kitchen: 'Kitchen / suite', stayfor_accessible: 'Accessible',
      stayfor_best_overall: 'Best overall', stayfor_resort: 'Resort', stayfor_ocean_view: 'Ocean view', stayfor_food_area: 'Best food area', stayfor_theme_parks: 'Theme parks', stayfor_disneyland: 'Disneyland',
      amBreakfast: 'Breakfast', amKitchen: 'Kitchen', amPool: 'Pool', amFamilySuite: 'Family suite',
      stayBooking: 'Booking.com', stayExpedia: 'Expedia', stayHotels: 'Hotels.com', stayReviews: 'Reviews', refreshStays: 'Refresh stays',
      bestAreasTitle: 'Best areas for your group', stayStrategiesTitle: 'Where to base yourselves', stayStrategiesSub: 'AI compares stay strategies across your stops and recommends one.',
      strat_single_base: 'Single base', strat_split_nights: 'Split nights', strat_cheapest: 'Cheapest', strat_near_attraction: 'Near the main attraction',
      stratDriving: 'Driving', stratConvenience: 'Convenience', stratKids: 'Kids', stratFood: 'Food',
      tab_food: 'Food', foodPicksTitle: 'Food picks', foodSub: 'AI-researched restaurants for your group at each stop — matched to your cuisines.', findFood: 'Find food picks (AI)', researchingFood: 'Finding the best restaurants for your group…', noFoodYet: 'Tap “Find food picks” for AI restaurant recommendations.', searchFoodBtn: 'Search', yelpBtn: 'Yelp', dishesLabel: 'Must-try', reservationLabel: 'Reservations',
      imgRepresentative: 'Representative image only', imgPending: 'Photo pending verification', viewPhotos: 'Photos', googleReviews: 'Google reviews', yelpReviews: 'Yelp reviews', menuBtn: 'Menu', mustTryLabel: 'Must-try',
      noVerifiedPhoto: 'No verified photo available', noVerifiedFood: 'No verified food photos', viewGooglePhotos: 'Google Photos', tripadvisor: 'Tripadvisor', verifiedPhoto: 'Verified photo', areaPhoto: 'Area photo · Wikimedia', likelyMatchPhoto: 'Likely match · Wikimedia', viaWikipedia: 'Wikipedia (CC)', viaWikimedia: 'Wikimedia Commons', morePhotos: 'More photos',
      skipPlace: 'Skip', skippedLabel: 'Skipped', undoSkip: 'Undo', replaceAlt: 'Replace with alternative', replacedOriginal: 'Replaced', pickAlternative: 'Pick an alternative', noAlts: 'No alternatives found — search or add your own.', searchReplacement: 'Search replacement', addOwn: 'Add my own', addOwnPh: 'Your restaurant / place name', leaveEmpty: 'Leave this slot empty', loadingAlts: 'Finding alternatives…',
      foodfor_family: 'Family', foodfor_groups: 'Groups', foodfor_date_night: 'Date night', foodfor_quick_bite: 'Quick bite', foodfor_fine_dining: 'Fine dining', foodfor_breakfast: 'Breakfast', foodfor_vegetarian: 'Vegetarian', foodfor_seafood: 'Seafood', foodfor_local_specialty: 'Local specialty', foodfor_kid_friendly: 'Kid-friendly',
      // Itinerary control (move/reorder/time-slot/pin/add/replan/why)
      ts_morning: 'Morning', ts_lunch: 'Lunch', ts_afternoon: 'Afternoon', ts_dinner: 'Dinner', ts_evening: 'Evening', ts_optional: 'Optional', ts_backup: 'Backup',
      moveUp: 'Move up', moveDown: 'Move down', moveToDay: 'Move to day', changeTimeSlot: 'Time slot', moveCard: 'Move', dragHint: 'Drag to move, or use this menu',
      pinHere: 'Pin to this day & time', unpinHere: 'Unpin', pinnedHere: 'Pinned', addedByYou: 'Added by you', removeAdded: 'Remove',
      whyHere: 'Why this day/time?', whyLoading: 'Thinking through the best fit…', whyUnavailable: 'Explanation unavailable right now — try again shortly.',
      dayActionsTitle: 'Edit this day', addActivity: 'Add activity', addRestaurant: 'Add restaurant', addRestStop: 'Add rest stop', regenDayBtn: 'Regenerate day', reoptDayBtn: 'Re-optimize day', regenDayWorking: 'Rebuilding this day…',
      addKind_activity: 'Add an activity', addKind_restaurant: 'Add a restaurant', addKind_rest_stop: 'Add a rest stop', addNamePh: 'Name (e.g. a place you already know)', cancelAdd: 'Cancel',
      replanMsg: 'You changed this day. What should the AI do?', replanKeep: 'Keep my change', replanTiming: 'Fix timing only', replanReopt: 'Re-optimize around it', replanReset: 'Reset to AI plan',
      finalDayPlan: 'Final day plan', finalDayHint: 'AI decides by default — based on distance home, checkout time, kids/seniors and your pace.',
      fdm_ai_decide: 'Not sure — let AI decide', fdm_return_day: 'Return / travel home day', fdm_half_day: 'Half activity + return', fdm_full_day: 'Full activity day',
      // V2 simplified intake (only WHO / WHERE / WHAT EXPERIENCE — AI infers everything else)
      createSubV2: 'Just the basics — the AI concierge figures out the rest (route, hotels, transport, schedule).',
      tripNamePh: 'e.g. Summer with the Nguyens', originLabel: 'Where are you starting from?', paceLabel: 'Pace',
      destHintV2: 'Just name the places — no roles or stop settings. The AI plans the route & timing.',
      familySubV2: 'Tell us who is coming and what they like — the AI does the rest.', foodOtherPh: 'Other cuisines (comma separated)',
      stayAtmosphere: 'Stay atmosphere', stayAtmosphereHint: 'The vibe you want — the AI picks the real areas & hotels.',
      planTrip: 'Plan my trip', planTripHint: 'The AI concierge researches transport, hotels, food, activities, routes & a return day.',
      sa_ocean_view: 'Ocean view', sa_near_beach: 'Near beach', sa_quiet: 'Quiet', sa_family_friendly: 'Family friendly', sa_resort: 'Resort', sa_airbnb: 'Airbnb', sa_luxury: 'Luxury', sa_budget: 'Budget', sa_near_attractions: 'Near attractions', sa_walkable: 'Walkable',
      // Phase B — AI Transportation Agent
      tab_transport: 'Transport', tpHeader: 'How you’ll get there', transportSub: 'AI-compared travel options for each leg — pick what fits your group. Estimates are labeled; nothing is booked without you.',
      findTransport: 'Compare transport (AI)', refreshTransport: 'Refresh options', researchingTransport: 'Comparing car, flight, bus & private ride…', noTransportYet: 'Tap “Compare transport” for AI travel options.',
      tpVerified: 'Verified', tpEstimate: 'Estimate', tpNeedsConfirm: 'Confirm live',
      tm_personal_car: 'Personal car', tm_rental_car: 'Rental car', tm_flight: 'Flight', tm_bus: 'Bus', tm_train: 'Train', tm_dlc_ride: 'Private DuLichCali ride',
      // V3 — Amtrak/train, best-for ranks, Deal Hunter
      tpwhy_train: 'Amtrak is scenic and low-stress — no driving, room to move, easy for seniors and kids; the schedule is researched, never assumed.',
      tpro_scenic: 'Scenic ride', tcon_stations: 'Station-to-station', tpTrainStation: 'Travels station to station — check the nearest Amtrak station and times.',
      tpTrainAmtrak: 'Amtrak.com', tpTrainSearch: 'Search Amtrak schedule',
      tpBestKids: 'Best with kids', tpBestSeniors: 'Best for seniors', tpLeastTiring: 'Least tiring', tpBestLuggage: 'Best for luggage', tpScenic: 'Most scenic',
      nlPriority: 'Priority', nlprio_required: 'Required (locked)', nlprio_preferred: 'Preferred', nlprio_ai_decide: 'AI decides', nlprio_avoid: 'Avoid this mode',
      tprec_userpref: 'You prefer this for this leg, so it leads the comparison — alternatives stay below.', tprec_avoided: 'Picked to avoid the mode you asked to skip on this leg.',
      dealWatchOn: 'Watching for deals', dealWatchOff: 'Watch for deals', dealCheckNow: 'Check now', dealWatchHint: 'AI re-checks transport, hotels and ticket deals and alerts you if a cheaper option or a new deal appears — it never changes your plan on its own. Prices come from research and booking links; nothing is fabricated.', dealNoBetter: 'No better deal right now', dealBetterFound: 'Better deal found', dealHotelDrop: 'Cheaper hotel found', dealTicketNew: 'New ticket deal', perNight: 'night', dealWas: 'was', dealNow: 'now', dealSave: 'save', dealKeep: 'Keep itinerary', dealSwitch: 'Switch', dealSwitchSaved: 'Switched — saving ~{amt} (est.)', dealSavingsTotal: 'Deal savings so far', researchedAt: 'Researched',
      dealResearchFares: 'Research current fares', dealNoFares: 'No current fares found — try the booking links.', dealFaresTitle: 'Current fares (researched · pending verification)', dealFaresLive: 'Current fares (live)', fareLiveTag: 'live', dealWhileAway: 'found while you were away',
      pushEnable: 'Enable phone alerts', pushOn: 'Phone alerts on', pushEnabled: 'Phone alerts enabled — we’ll notify you of better deals.', pushDenied: 'Notifications are blocked — enable them in your browser/phone settings.', pushUnsupported: 'Phone alerts aren’t available on this device/browser.',
      tm_any: 'Any · compare all', tm_greyhound: 'Greyhound', tm_flixbus: 'FlixBus', tm_shuttle: 'Shuttle',
      // V3 Transport strategy + transfer intelligence
      tpCompareTitle: 'Compare every leg', whyRecommended: 'Why',
      stratTitle: 'AI transport & transfer plan', stratSub: 'AI researches real operators, finds transfer hubs, and compares multi-leg strategies — schedules & prices pending verification, never invented.', stratDemo: 'Strategies appear once you create a real trip.', stratNeedOrigin: 'Add where you’re starting from (Step 1) and the AI will plan how to get there.',
      stratPrefLabel: 'Preferred way to travel', stratResearch: 'Research transport strategies', stratRefresh: 'Refresh strategies', stratLoading: 'Researching operators, transfer hubs & strategies…', stratNone: 'Couldn’t research strategies right now — the verified per-leg comparison below still works. Try refresh.',
      stratHubs: 'Transfer hubs', stratStrategies: 'Strategies to compare', stratRecommended: 'Recommended', stratOvernight: 'Overnight', stratRisk: 'Timing risk', stratRequestDlc: 'Request DuLichCali ride',
      stratPickup: 'Pickup', stratDropoff: 'Dropoff', stratOfficial: 'Official site', stratModes: 'Operator details (researched)',
      stratReturnTitle: 'Getting home', stratEarlyRisk: 'Early-departure risk', stratOvernightRec: 'Overnight near departure suggested', stratLeaveEarlier: 'Consider leaving a day earlier',
      stratUnverified: 'AI-researched — confirm schedules & prices on each operator’s official site before booking. Drive times are from Google Maps or a labeled estimate; nothing is booked here.',
      connTitle: 'Connection plan', connTransferNeeded: 'Transfer needed', connDirect: 'Direct to destination', connOrigin: 'Start', connDropoff: 'Bus/flight drop-off', connFinal: 'Final destination', connTransferOptions: 'Get from the drop-off to your hotel', connHubStop: 'Time to spare? Enjoy the hub', connReturnTitle: 'Return timing', connOvernightBefore: 'The return departs early — consider an overnight at the hub the night before.', connScheduleRisk: 'Schedule risk', connPending: 'Schedule pending verification — confirm on the operator’s official site/phone. Nothing is booked here.',
      tpDuration: 'Door-to-door', tpCost: 'Est. total', tpPerTraveler: 'Per traveler', tpFareOnRequest: 'Fare shown on request',
      suit_good: 'good', suit_ok: 'ok', suit_poor: 'tight',
      tpRequestDlc: 'Request DuLichCali Ride', tpDlcNote: 'Sends a draft to the DuLichCali ride booking — you confirm there.', tpSearchBook: 'Search & book', tpConfirmNote: 'Estimate — confirm price & schedule at the booking site.', tpChoose: 'Choose this', tpYourChoice: 'Your choice',
      tpLeg_outbound: 'Getting there', tpLeg_inter: 'Between stops', tpLeg_return: 'Return home',
      tpDay_transit: 'Transit day', tpDay_activity: 'Activity day', tpDay_half: 'Half travel / half play',
      tpWhy: 'Why AI recommends this:', tpRecommended: 'Recommended', tpLowestCost: 'Lowest cost', tpFastest: 'Fastest', tpComfort: 'Most comfortable', tpPrivateDlc: 'Private ride', tpCompare: 'Compare options', tpSideBySide: 'Compare side-by-side',
      tpPerFamily: 'Per family', tpGas: 'Gas (est.)', tpParking: 'Parking', tpConvenience: 'Convenience', tpBestFamilies: 'Best for families', tpMarkBooked: 'Mark booked', tpBooked: 'Booked', tpBookedToast: 'Marked as booked', tpUnbookedToast: 'Marked as not booked',
      tpTollNote: 'Tolls: check your route (pending verification).', tpAirportBuffer: 'Includes ~2–3h airport buffer (security, boarding, bags).', tpBaggageNote: 'Add baggage fees + a rental car or rideshare at the destination.', tpBusStationNote: 'Confirm the exact pickup/drop-off station with the operator.',
      tpFlightSearch: 'Search flights', tpAirportsNear: 'Nearest airports', tpBusGreyhound: 'Greyhound', tpBusFlix: 'FlixBus', tpBusHoang: 'Hoàng Express',
      apf_closest: 'closest airport', apf_budget: 'budget alternate', apf_mostflights: 'most flights',
      tpro_door: 'Door-to-door', tpro_flexible: 'Flexible — stop anytime', tpro_luggage: 'Room for luggage', tpro_costshare: 'Cost shared across the group', tpro_fastest: 'Fastest for long distance', tpro_lesstiring: 'Less tiring than a long drive', tpro_cheapest: 'Usually the cheapest', tpro_nodriving: 'No driving', tpro_private: 'Private driver, just your group', tpro_kidssenior: 'Easy for kids & seniors', tpro_noparking: 'No parking to deal with',
      tcon_longdrive: 'Long drive', tcon_fatigue: 'Driver fatigue', tcon_parking: 'Parking to find/pay', tcon_airporttime: 'Airport time adds up', tcon_baggage: 'Baggage fees', tcon_carthere: 'Need a car at the destination', tcon_bookahead: 'Book ahead for best price', tcon_slowest: 'Slowest option', tcon_schedule: 'Fixed schedule', tcon_luggagelimit: 'Limited luggage', tcon_highercost: 'Higher cost than driving',
      tprec_car_short: 'Driving is the easiest, most flexible choice for a short hop with your group and luggage.', tprec_car_group: 'Driving keeps your group together with luggage and is far cheaper than separate tickets for everyone.', tprec_flight_long: 'Flying saves the most time on this long leg for a small group without young kids — add a rental car at the destination.',
      tm_hoang_bus: 'Xe Đò Hoàng', tpWifi: 'Wi-Fi', tpHoangBook: 'Book on xedohoang.com', tpHoangGuide: 'Booking guide', tpHoangSite: 'Official website',
      tpHoangStation: 'Confirm the exact pickup/drop-off station and schedule on xedohoang.com (pending verification).',
      tpHoangConnect: 'Xe Đò Hoàng\'s main Southern California hub is Little Saigon (Orange County) — connect onward to your destination with a private DuLichCali ride or van.',
      tpro_rest: 'Everyone can rest', tpro_wifi: 'Free Wi-Fi onboard', tpro_vietnamese: 'Vietnamese-speaking staff', tpro_avoidtraffic: 'Skips SoCal traffic', tcon_slowerthancar: 'Slower than driving',
      tpwhy_personal_car: 'Drive: full flexibility, door-to-door, and the cheapest way to keep the group together with luggage.', tpwhy_dlc_ride: 'Private DuLichCali ride: a door-to-door driver — easiest with kids, seniors and luggage, no parking.', tpwhy_flight: 'Fly: by far the fastest on a long leg — add a rental car or rideshare at the destination.', tpwhy_bus: 'Greyhound / FlixBus: the lowest-cost no-driving option, on a fixed schedule.', tpwhy_hoang_bus: 'Xe Đò Hoàng: the coach Vietnamese families love — everyone rests, free Wi-Fi, Vietnamese-speaking staff, and it skips the driving and SoCal traffic.',
      tprec_hoang: 'Xe Đò Hoàng is recommended: with seniors and kids, the whole family can rest with Wi-Fi instead of an 8-hour drive, and it avoids Southern California traffic.',
      tprec_userlocked: 'You chose this for this leg, so it’s set as your plan — schedule, cost and booking are added around it. The options below are just alternatives.',
      routeOpsTitle: 'Route opportunities', routeOpsSub: 'Optional discoveries along this leg — add what your group likes, skip the rest.', findRouteOps: 'Discover route stops (AI)', researchingRouteOps: 'Finding interesting stops along the way…', routeOpAdded: 'Added to this day', roYourStops: 'Your stops for this day', roAdd: 'Add to day', roMustSee: 'Must see', roMin: 'min detour', roNoneFilter: 'No matches for this filter — try another.',
      roAll: 'All', roFood: '🍽 Food', roBeachScenic: '🏖 Beach & scenic', roHidden: '💎 Hidden gems', roKid: '🧒 Kid-friendly', roLowEnergy: '😌 Low-energy', roRainy: '🌧 Rainy-day',
      roins_food_stop: 'Food stop', roins_short_stop: 'Short stop', roins_half_day: 'Half-day stop', roins_overnight: 'Overnight', roins_scenic_stop: 'Scenic stop', roins_shopping_stop: 'Shopping stop', roins_beach_stop: 'Beach stop', roins_kid_stop: 'Kid stop', roins_teen_stop: 'Teen stop', roins_senior_stop: 'Senior stop', roins_photo_stop: 'Photo stop',
      roEnergy_low: 'Low energy', roEnergy_medium: 'Medium energy', roEnergy_high: 'High energy', roWeather_sunny: 'Best when sunny', roWeather_outdoor: 'Outdoor', roWeather_indoor: 'Indoor (rainy-day ok)',
      toursTitle: 'Tours & unique experiences', toursSub: 'AI-found tours for your group — vote, pin, or request one through DuLichCali. Prices pending verification.', researchingTours: 'Finding tours & unique experiences…', tourRequestDlc: 'Request via DuLichCali',
      tour_harbor_cruise: 'Harbor cruise', tour_whale_watching: 'Whale watching', tour_hop_on_hop_off: 'Hop-on hop-off', tour_food_tour: 'Food tour', tour_walking_tour: 'Walking tour', tour_bike_tour: 'Bike tour', tour_kayak: 'Kayak', tour_boat: 'Boat tour', tour_amphibious: 'Amphibious tour', tour_brewery: 'Brewery tour', tour_cultural: 'Cultural', tour_adventure: 'Adventure', tour_nature: 'Nature', tour_seasonal: 'Seasonal', tour_other: 'Experience',
      impRelaxing: '😌 Most relaxing', impScenic: '🌄 Most scenic', impThemePark: '🎢 Theme parks', impSeniorFriendly: '🧓 Senior-friendly', impRainyBackup: '🌧 Rainy-day backup',
      tpRequestPickup: 'Request airport pickup', tpRequestTransfer: 'Request transfer to hotel',
      dlcInq_ride: 'DuLichCali ride inquiry (from your trip)', dlcInq_van_transfer: 'DuLichCali van transfer inquiry (from your trip)', dlcInq_tour: 'DuLichCali tour inquiry (from your trip)', dlcInq_airport_pickup: 'DuLichCali airport pickup inquiry (from your trip)',
      pickupAfterProvider: 'Pickup after {provider} arrival', pickupAfterArrival: 'Pickup after your arrival at the drop-off',
      tpAffectsItin: 'Saved — this affects your itinerary timing. Open Itinerary to re-optimize.', tpChosen: 'Transport choice saved',
      tpReturnTitle: 'Return journey (final day)', tpReturnHint: 'Checkout, buffer, and the trip home — consistent with how you got there.', tpDraftFromTrip: 'Draft from your trip',
      // Destination Signature Attraction Intelligence
      topAttractionsTitle: 'Top attractions for your group', topAttractionsSub: 'Iconic must-sees ranked for who is traveling — pin any to lock it into your plan.', researchingAttractions: 'Ranking the must-see attractions for your group…',
      forGroup: 'for', teensLabel: 'teens', ticketed: 'Tickets', pinToTrip: 'Pin to trip', tpaPinned: 'Pinned to your must-dos', tpaAlready: 'Already pinned',
      tier_very_high: 'Must-see', tier_high: 'Top pick', tier_medium: 'Worth it',
      fit_kids: 'Great for kids', fit_teens: 'Great for teens', fit_seniors: 'Senior-friendly', fit_all_ages: 'All ages', fit_adults: 'Adults',
      // Events + Stopovers + Costs (Batch 1)
      tab_events: 'Events', tab_weather: 'Weather', tab_stopovers: 'Discoveries', tab_costs: 'Costs',
      weatherTitle: 'Weather & packing', weatherSub: 'Real forecast for your dates (or seasonal normals when further out) — plus what to pack.', findWeather: 'Check the weather', refreshWeather: 'Refresh weather', researchingWeather: 'Checking the forecast…', noWeatherYet: 'No weather yet — tap to check the forecast.', wxPackingTitle: 'What to pack', wxSeasonalNote: 'Beyond the live forecast — showing typical weather for the season.', wxSeasonalLabel: 'typical for the season (est.)', wxUnavailable: 'Forecast not yet available — check closer to your dates.', wxRecOutdoor: 'Great for outdoor plans', wxRecIndoor: 'Plan an indoor day', wxRecMixed: 'Mixed — keep a backup',
      wxcond_clear: 'Clear', wxcond_partly: 'Partly cloudy', wxcond_cloudy: 'Cloudy', wxcond_fog: 'Fog', wxcond_drizzle: 'Drizzle', wxcond_rain: 'Rain', wxcond_snow: 'Snow', wxcond_showers: 'Showers', wxcond_storm: 'Storms',
      wxtip_pack_warm_layers: 'Warm layers — it gets chilly', wxtip_pack_light_breathable: 'Light, breathable clothes', wxtip_pack_sun: 'Sunscreen, hat & sunglasses', wxtip_pack_rain: 'Rain jacket or umbrella', wxtip_pack_layers_swing: 'Layers — big day-to-night temperature swing', wxtip_pack_snow: 'Snow gear & warm boots', wxtip_pack_hydrate: 'Bring water — stay hydrated',
      eventsTitle: 'Events during your trip', eventsSub: 'Real events within your dates — pin any to your plan. Estimates labeled; nothing is booked.', findEvents: 'Find events (AI)', refreshEvents: 'Refresh events', researchingEvents: 'Searching events for your dates…', noEventsYet: 'Tap “Find events” to see what is on during your trip.', eventPending: 'Pending verification — confirm date & price', eventLiveOfficial: 'Live · official (Ticketmaster)', addToPlan: 'Add to plan',
      stopoversTitle: 'Stopovers on long drives', stopoversSub: 'Smart stops for meals, breaks, gas and scenery on long legs — paced for your group.', findStopovers: 'Find stopovers (AI)', refreshStopovers: 'Refresh stopovers', researchingStopovers: 'Planning stops for the long drives…', noStopoversYet: 'No long drives need stops — or tap “Find stopovers”.',
      stoptype_meal: 'Meal', stoptype_rest: 'Rest stop', stoptype_gas: 'Gas / charge', stoptype_coffee: 'Coffee', stoptype_attraction: 'Quick stop', stoptype_scenic: 'Scenic', stoptype_hotel: 'Overnight', soAdd: 'Add stop', soAdded: 'Added', soOptional: 'Optional', soSkip: 'Skip', soAlternatives: 'Alternatives', soPending: 'Pending verification',
      costsTitle: 'Trip cost estimate', costsSub: 'Editable estimates — not live prices. The organizer can adjust assumptions; everyone can view.', costEstTotal: 'Total (est.)', costPerFamilyAvg: 'Per family (avg)', costPerPerson: 'Per person', costPerDay: 'Per day', costPerPersonShort: 'person', costRangeLabel: 'Range', costExpected: 'expected', costByCategory: 'By category',
      costcat_transport: 'Transport', costcat_stay: 'Stay', costcat_activities: 'Activities', costcat_food: 'Food', costcat_other: 'Other',
      costSplitTitle: 'Family split', costSplitMode: 'Split method', split_per_person: 'Per person', split_equal: 'Equal per family', split_per_family: 'Custom per family', split_owner_pays: 'Organizer pays',
      costLedgerTitle: 'Who paid / who owes', costLedgerEmpty: 'No payments logged yet.', costPaid: 'Paid', costMarkPaid: 'Mark paid', costWhoPaid: 'Who paid', costLedgerTitlePh: 'What for (e.g. hotel)', costAddPaid: 'Log payment', costMisc: 'Misc',
      costAssumptions: 'Cost assumptions (edit)', costAsmFood: 'Food $/person/day', costAsmHotel: 'Hotel $/night', costAsmGas: 'Gas $/mile', costAsmTicket: 'Ticket $/person', costAsmParking: 'Parking $/day', costAsmSnacks: 'Snacks $/person/day', costAsmSouvenir: 'Souvenirs $/family',
      costDisclaimer: 'Estimates based on editable assumptions — not live prices. Confirm actual costs when booking.', costFuel: 'Fuel / driving', costHotel: 'Hotels / lodging', costTickets: 'Attraction tickets', costParking: 'Parking', costFood: 'Meals', costSnacks: 'Snacks & coffee', costSouvenirs: 'Souvenirs', costBuffer: 'Emergency buffer',
      // Live trip location sharing
      tab_live: 'Live', ago: 'ago', liveTitle2: 'Live group location', liveSub2: 'Opt-in location sharing during the trip. Only trip members can see it; it auto-expires and is deleted after.',
      liveDemo: 'Live location works on a real saved trip (not the sample).', liveLoginNeeded: 'Log in to use live location.', liveOwnerOff: 'The organizer has not enabled trip location sharing.', liveNoGeo: 'Location is unavailable on this device/browser.',
      liveEnableTrip: 'Enable trip location sharing', liveOff: 'Trip location sharing is off. The organizer can turn it on.', livePrivacy: 'Private to trip members only — never public. Auto-expires and is deleted after the trip; only the latest position is stored.',
      liveYouSharing: 'You are sharing', liveExpires: 'expires in', liveStop: 'Stop sharing', liveShareMine: 'Share your location with the group:', liveShareTrip: 'Until trip ends', liveShareToday: 'For today', liveShareHour: 'For 1 hour', liveSharingOn: 'Sharing your location', liveStopped: 'Stopped sharing',
      livestatus_on_the_way: 'On the way', livestatus_arrived: 'Arrived', livestatus_delayed: 'Delayed', livestatus_break: 'On a break',
      actFeedTitle: 'Trip activity & alerts', actNone: 'No alerts right now — votes needed, booking reminders and arrivals show up here.', actSuggested: '{who} suggested “{what}” — needs a vote', actBookReminder: 'Book {what} by {when} — not reserved yet', actBookSoon: 'Book {what} — not reserved yet', actTaskMine: '{what} — assigned to you', actArrived: '{who} arrived', actDelayed: '{who} is delayed', actInApp: 'In-app alerts — push notifications are coming soon.',
      liveNavNext: 'Navigate to next stop', liveNavHotel: 'Navigate to hotel', liveGroup: 'Sharing now', liveNobody: 'No one is sharing yet — tap a share option above.', liveMember: 'Member', liveHere: 'here', liveViewMap: 'View on map', liveNavTo: 'Navigate',
      // Experience Optimizer
      improveTitle: 'Improve this trip with AI', improveSub: 'AI optimizes using your group\'s votes, favorites & preferences — then suggests concrete changes you can add.', improveWorking: 'Looking for ways to make this trip better…', improveNone: 'No suggestions right now — try another goal.',
      optimizeTrip: 'Optimize Trip', optimizing: 'Rebuilding your trip from the group\'s votes…', optimizeDone: 'Trip rebuilt from your group\'s votes', optimizeNudge: 'Your group\'s votes changed — re-optimize the whole trip.', optimizeRebuildHint: 'Regenerates the itinerary, food, stays, events, stopovers, transport, costs & bookings from all your votes. Your pins & skips are kept.',
      mem_title: 'What we remember', mem_sub: 'Preferences learned from your past trips — used to start new ones smarter.', mem_cuisines: 'Cuisines you like', mem_liked: 'Places you liked', mem_never: 'Never suggest again', mem_transport: 'Preferred transport', mem_budget: 'Usual budget', mem_pace: 'Usual pace', mem_trips: 'Trips remembered', mem_clear: 'Clear memory', mem_cleared: 'Travel memory cleared',
      nightOne: 'night', nightMany: 'nights',
      // Natural-language Journey Builder
      nlSectionTitle: 'Tell AI exactly what you want', nlSectionHint: 'Describe your trip in your own words — dates, who’s driving, fixed plans. AI turns it into an editable journey you can adjust.', nlPlaceholder: 'Example: July 1 take Hoang Bus from San Jose to Orange County, then Michael drives us to San Diego. July 2 San Diego Zoo. July 3 morning in San Diego, then back to Orange County for Vietnamese food. July 4 take Hoang Bus home.', nlBuildBtn: 'Build journey from my notes', nlOrDivider: 'or build it step by step', nlBuilding: 'Reading your plan and building the journey…', nlParseFail: 'I couldn’t turn that into a journey — add the dates and stops, then tap Build again.', nlReviewTitle: 'Here’s what I understood', nlReviewSub: 'Review and adjust. Lock 🔒 anything that’s fixed — the AI plans around it and fills in the rest.', nlFixedReqs: 'Fixed by you', nlFlexWindows: 'AI will suggest', nlQuestions: 'A few things to confirm', nlConfirmBtn: 'Looks good — add who’s coming', nlEditManual: 'Fine-tune step by step', nlReparse: 'Edit my notes', nlAddAfter: 'Add after', nlAddStop: 'Add a step', nlLockSeg: 'Lock', nlUnlockSeg: 'Unlock', nlLocked: 'Locked', nlFlexMark: 'Flexible', nlFlexOn: 'AI suggests', nlNeedsResearch: 'Needs schedule', nlNeedsBooking: 'Needs booking', nlResearchLink: 'Look up schedule', nlResearchQuery: 'schedule', nlRequestRide: 'Request DuLichCali ride', nlSegTitle: 'What', nlSegTitlePh: 'e.g. San Diego Zoo', nlSegDate: 'Day', nlSegTime: 'Time', nlSegFrom: 'From', nlSegTo: 'To', nlSegMode: 'How', nlNoDate: 'No date yet', nlFoodExperience: 'Local food experience',
      nlSegType_transport: 'Travel', nlSegType_transfer: 'Transfer / ride', nlSegType_stay: 'Overnight stay', nlSegType_activity: 'Activity', nlSegType_food: 'Food', nlSegType_free_time: 'Free time', nlSegType_return: 'Return home',
      nlmode_car: 'Own car', nlmode_bus: 'Bus', nlmode_private_ride: 'Private ride', nlmode_flight: 'Flight', nlmode_train: 'Train', nlmode_walk: 'Walk', nlmode_other: 'Other',
      nlYourRoute: 'Your locked route', nlCarAlt: 'Private car alternative', nlRouteFail: 'We couldn’t apply your required route. Please review the extracted journey below.',
      journeyLabel: 'Your journey', journeyHint: 'Add each stop with the dates you want there. We figure out transport, hotels and the day-by-day plan within your stops.', addSegment: 'Add stop', arrivalDate: 'Arrival', departureDate: 'Departure', sameDay: 'Same-day', segTransportDetails: 'Transport & details (optional)', howArrive: 'How you arrive in {city}', preferredProvider: 'Preferred provider', providerPh: 'e.g. Xe Đò Hoàng, Michael', overnightStay: 'Stay overnight here', segNotesPh: 'e.g. coming from the bus drop-off', homeOrigin: 'Home', viaLabel: 'via', viaAI: 'AI picks the best way', thisStop: 'this stop', returnTransport: 'Getting home', journeyEmpty: 'Add your first stop to see the journey', homeBy: 'home', quickEntry: 'Quick entry — one date range for the whole trip', quickEntryHint: 'Optional. Used only if you leave the per-stop dates blank — the AI will split the nights.', tp_any: 'AI decides', tp_bus: 'Bus', tp_private_ride: 'Private ride', tp_flight: 'Flight', tp_car: 'Own car', tp_train: 'Train', segRideBooked: 'Ride booked', segRidePending: 'Ride pending',
      impGeneral: '✨ Improve this trip', impDiscoveries: '💎 Find more discoveries', impLowerCost: '💲 Lower cost', impKidsFun: '🧒 More fun for kids', impFoodFocused: '🍽 More food-focused',
      impSelected: '{n} selected', impRun: 'Run AI Improvement', impClear: 'Clear all',
      rejVote: 'Removed — the group voted to skip this', rejMajority: 'Removed — most families voted to skip this', rejNotNeeded: 'Removed — marked not needed',
      impcat_activity: 'Activity', impcat_food: 'Food', impcat_stopover: 'Stopover', impcat_timing: 'Timing', impcat_backup: 'Backup', impcat_cheaper: 'Cheaper', impcat_exciting: 'More exciting', impcat_low_energy: 'Low-energy', impcat_discovery: 'Discovery',
    },
    vi: {
      backHome: '← Quay lại Du Lich Cali',
      heroChip: 'Trợ Lý Du Lịch Nhóm AI', heroTitle: 'Trợ lý du lịch AI cho gia đình và bạn bè.',
      heroSub: 'Cho chúng tôi biết ai cùng đi, bạn muốn đến đâu và bạn thích gì. AI khám phá những trải nghiệm hay nhất, so sánh cách di chuyển, gợi ý nơi lưu trú và xây một kế hoạch chung mà cả nhóm có thể bình chọn.',
      heroFreeNote: 'Miễn phí để bắt đầu · xem mẫu đầy đủ, không cần tài khoản · kế hoạch sẵn sàng trong khoảng một phút.', heroTrySample: 'Xem thử một mẫu', demoMeta: '{f} gia đình · {d} ngày',
      liveSampleBadge: 'Mẫu trực tiếp', whyFits: 'Vì sao hợp nhóm bạn', sampleMoreNote: 'Kế hoạch đầy đủ có bản đồ, gợi ý ẩm thực, đặt chỗ và lịch trình đến đồng bộ cho từng gia đình.', seeFullSample: 'Xem mẫu đầy đủ', otherSamples: 'Hoặc thử mẫu khác',
      start: 'Tạo kế hoạch cho nhóm', step: 'Bước', of: 'trên', day: 'Ngày', watchClip: 'Xem clip',
      // Landing — Who/Where/What band
      wwwTitle: 'Cho biết 3 điều — AI lo phần còn lại', www_who: 'AI cùng đi', www_who_d: 'Gia đình, trẻ nhỏ, thiếu niên, người lớn tuổi — chúng tôi lo cho mọi người.', www_where: 'ĐÂU là nơi bạn muốn đến', www_where_d: 'Một thành phố hay hành trình nhiều điểm dừng.', www_what: 'GÌ là điều bạn thích', www_what_d: 'Ẩm thực, bãi biển, công viên giải trí, văn hóa, điểm độc đáo.', wwwDo: 'AI lo phần còn lại — trải nghiệm, khách sạn, di chuyển, lịch trình và chi phí.',
      // Landing — How it works
      hiwTitle: 'Cách hoạt động', hiw1: 'Cho AI biết ai cùng đi', hiw1d: 'Thêm từng gia đình — trẻ nhỏ, thiếu niên, người lớn tuổi, ẩm thực, ngân sách và nhịp độ.', hiw2: 'AI khám phá những trải nghiệm hay nhất', hiw2d: 'Điểm tham quan, ẩm thực, sự kiện, điểm độc đáo, nơi lưu trú và lựa chọn di chuyển.', hiw3: 'Các gia đình cùng bình chọn & tối ưu', hiw3d: 'Mọi người bình chọn 👍🤔👎❤️ và AI tối ưu lại kế hoạch.', hiw4: 'Du lịch với bản đồ chung, cảnh báo & kỷ niệm', hiw4d: 'Bản đồ nhóm trực tiếp, cảnh báo khi đến nơi, album chung và clip AI.',
      // Landing — Agent capability cards
      capTitle: 'Trợ lý du lịch AI của bạn làm gì', capSub: 'Mười cách trợ lý lo phần việc cho nhóm của bạn.',
      cap_family: 'Lập kế hoạch đa gia đình', cap_family_d: 'Lo cho trẻ nhỏ, thiếu niên, người lớn tuổi, ngân sách và nhịp độ của từng gia đình.',
      cap_experiences: 'Trải nghiệm hay nhất', cap_experiences_d: 'Trải nghiệm đáng nhớ, hợp gia đình — không chỉ là danh sách địa điểm.',
      cap_discover: 'Tham quan, ẩm thực & sự kiện', cap_discover_d: 'Nhà hàng, món ăn nổi tiếng, sự kiện trực tiếp, điểm độc đáo và điểm dừng dọc đường.',
      cap_transport: 'So sánh di chuyển', cap_transport_d: 'Xe hơi, máy bay, Xe Đò Hoàng và dịch vụ đưa đón DuLichCali — thời gian, chi phí và phù hợp cho ai.',
      cap_stay: 'Trí tuệ lưu trú', cap_stay_d: 'Khu vực tốt nhất cùng khách sạn và Airbnb theo ngân sách, hợp gia đình và vị trí.',
      cap_vote: 'Bình chọn nhóm', cap_vote_d: 'Mỗi gia đình bình chọn 👍🤔👎❤️ — mục bị bỏ qua không quay lại.',
      cap_optimize: 'AI không ngừng cải thiện', cap_optimize_d: 'Tối ưu lại cho trẻ em, ẩm thực, giảm chi phí, ít lái xe hơn và nhiều hơn nữa.',
      cap_live: 'Bản đồ trực tiếp & cảnh báo', cap_live_d: 'Bản đồ nhóm tự nguyện, thời gian đến và cảnh báo đến nơi/trễ trong chuyến đi.',
      cap_album: 'Album & Clip AI', cap_album_d: 'Album chung cùng bộ tài liệu clip AI cho mạng xã hội — chú thích và bài đăng.',
      cap_costs: 'Chi phí chuyến đi chung', cap_costs_d: 'Ước tính tổng, theo từng gia đình và từng người theo hạng mục.',
      // Landing — Trust
      trustTitle: 'Được xây bởi Du Lich Cali', trustSub: 'Chuyên môn du lịch của người Mỹ gốc Việt cho gia đình và bạn bè.', trust_noprice: 'Không có giá giả', trust_nobooking: 'Không có đặt chỗ giả', trust_nophotos: 'Không có ảnh điểm tham quan hay nhà hàng do AI tạo', trustNote: 'Các ước tính được ghi rõ; ảnh thật lấy từ Google Places & Wikipedia.',
      // Onboarding — optional details
      moreOptional: 'Thêm chi tiết (tùy chọn)', moreOptionalHint: 'AI dùng mặc định thông minh — ngân sách Vừa, nhịp độ cân bằng. Thay đổi bất cứ lúc nào.',
      // Immersive hero showcase
      heroShowcaseLead: 'AI khám phá…', disc_attractions: 'Điểm tham quan', disc_beaches: 'Bãi biển', disc_restaurants: 'Nhà hàng', disc_gems: 'Điểm độc đáo', disc_events: 'Sự kiện địa phương', disc_themeparks: 'Công viên giải trí', disc_hotels: 'Khách sạn', disc_transport: 'Lựa chọn di chuyển', disc_voting: 'Bình chọn nhóm', disc_livemap: 'Bản đồ trực tiếp', disc_clips: 'Clip AI',
      disc_sealife: 'Động vật & sư tử biển', disc_nature: 'Thiên nhiên & công viên', disc_nightlife: 'Về đêm & biểu diễn', disc_icons: 'Cảnh biểu tượng', discoverTitle: 'AI khám phá chuyến đi của bạn', discoverSub: 'Địa điểm thật, trải nghiệm thật — chọn riêng cho nhóm bạn.',
      // Capability card examples
      cap_family_ex: 'vd: cân bằng Disneyland cho bé 6 tuổi với tour chèo thuyền hợp tuổi teen', cap_experiences_ex: 'vd: một chuyến du thuyền cả nhà đều nhớ mãi', cap_discover_ex: 'vd: quán phở Little Saigon mà tự bạn khó tìm', cap_transport_ex: 'vd: Xe Đò Hoàng + xe Du Lịch Cali tốt hơn lái 7 tiếng', cap_stay_ex: 'vd: phòng gia đình gần biển hay gần công viên', cap_vote_ex: 'vd: nhóm bỏ qua bảo tàng, AI thay bằng sở thú', cap_optimize_ex: 'vd: “rẻ hơn” giảm $300 mà không mất điểm nổi bật', cap_live_ex: 'vd: mọi người thấy ai đã đến khách sạn', cap_album_ex: 'vd: clip tóm tắt chuyến đi sẵn sàng đăng', cap_costs_ex: 'vd: mỗi gia đình thấy phần của mình theo hạng mục',
      // Popular destination showcase
      showcaseTitle: 'Chuyến đi phổ biến để lên kế hoạch', showcaseSub: 'Chạm một cái và AI nghiên cứu chuyến đi thật cho nhóm bạn — đây chỉ là gợi ý, không ép buộc gì.', bestForLabel: 'Hợp với', planThisTrip: 'Lên kế hoạch chuyến này', showcaseNote: 'Chỉ là ví dụ — AI lên kế hoạch mỗi chuyến đi mới từ ai cùng đi, khi nào và bạn thích gì.',
      dest_sandiego_best: 'Gia đình, bãi biển & động vật', dest_oc_best: 'Công viên giải trí & ẩm thực Little Saigon', dest_sf_best: 'Biểu tượng, cảnh vịnh & văn hóa', dest_vegas_best: 'Biểu diễn, Đại lộ & chuyến đi trong ngày', dest_la_best: 'Phim ảnh, ngôi sao & bờ biển', dest_yosemite_best: 'Thiên nhiên, leo núi & cảnh hùng vĩ',
      ctaBandTitle: 'Chuyến đi tiếp theo, do AI thiết kế', ctaBandSub: 'Cho biết ai, ở đâu và bạn thích gì — nhận kế hoạch chung, đặt được, trong khoảng một phút.',
      createTitle: 'Tạo chuyến đi nhóm', groupName: 'Tên chuyến đi / nhóm', destination: 'Điểm đến',
      dates: 'Ngày đi', departureCity: 'Khu vực khởi hành chính', numFamilies: 'Bao nhiêu gia đình / nhóm?',
      tripStyle: 'Nhịp độ', budget: 'Ngân sách tổng', createBtn: 'Tiếp: thêm gia đình',
      style_relaxed: 'Thư giãn', style_balanced: 'Cân bằng', style_packed: 'Dày đặc',
      budget_budget: 'Tiết kiệm', budget_moderate: 'Vừa phải', budget_luxury: 'Sang trọng',
      familiesTitle: 'Ai sẽ đi?', familySub: 'Thêm từng gia đình — độ tuổi và nhu cầu định hình kế hoạch.',
      familyName: 'Tên gia đình / nhóm', adults: 'Người lớn', childrenAges: 'Tuổi các bé (cách nhau dấu phẩy)',
      seniors: 'Người cao tuổi', foodPrefs: 'Sở thích ăn uống', interests: 'Sở thích hoạt động',
      accessibility: 'Nhu cầu hỗ trợ di chuyển', napNeeds: 'Nhu cầu nghỉ ngơi', roomNeeds: 'Nhu cầu phòng khách sạn',
      addFamily: 'Thêm gia đình khác', removeFamily: 'Xóa',
      transportTitle: 'Gia đình này đến bằng cách nào?', method: 'Phương tiện',
      m_car: 'Ô tô', m_plane: 'Máy bay', m_bus: 'Xe khách', m_other: 'Khác',
      origin: 'Thành phố / địa chỉ xuất phát', travelers: 'Số người', departureWindow: 'Giờ khởi hành mong muốn',
      arrivalDeadline: 'Hạn giờ đến', luggage: 'Nhu cầu hành lý', carSeat: 'Cần ghế ngồi cho bé',
      numCars: 'Số xe', transportBudget: 'Ngân sách di chuyển',
      childrenLabel: 'Trẻ em', totalTravelers: 'Tổng số người', overrideTravelers: 'Tự nhập số người', travelerMismatch: 'Số nhập tay khác tổng tự động ({auto}).', carSuggest: 'AI đề xuất {n} xe cho {t} người', suvNote: 'Có em bé + hành lý → nên thuê SUV hoặc minivan.', groundTransport: 'Di chuyển tại điểm đến', gt_rental_car: 'Thuê xe', gt_uber_lyft: 'Uber / Lyft', gt_pickup: 'Đón tại chỗ', gt_shuttle: 'Xe đưa đón',
      prefsTitle: 'Tinh chỉnh kế hoạch', prefsSub: 'Cho AI biết điều gì quan trọng nhất.',
      pace: 'Nhịp độ', kidPriority: 'Ưu tiên trẻ em', foodiePriority: 'Ưu tiên ẩm thực',
      photoPriority: 'Điểm chụp ảnh / quay phim', minDriving: 'Giảm lái xe', hiddenGems: 'Gồm điểm độc đáo',
      freeActivities: 'Gồm hoạt động miễn phí', reservationActivities: 'Gồm nơi cần đặt trước',
      backupPlans: 'Gồm phương án dự phòng', generate: 'Tạo kế hoạch bằng AI',
      generating: 'Đang thiết kế chuyến đi nhóm…', genFail: 'AI đang bận — đây là kế hoạch mẫu bạn có thể chỉnh.',
      tab_overview: 'Tổng quan', ovReadyShort: 'sẵn sàng', ovNext: 'Tiếp theo', ovAllSet: 'Mọi thứ đã sẵn sàng', ovFamilies: 'gia đình',
      ovHighlights: 'Điểm nổi bật', ovSeeAll: 'Xem tất cả', ovTimeline: 'Lịch trình của bạn', ovViewItinerary: 'Xem lịch trình đầy đủ',
      ovDiscoveries: 'AI Khám phá', ovConcierge: 'Hỏi trợ lý', ovCuratingHighlights: 'AI đang tuyển chọn điểm nổi bật…', ovQuickLinks: 'Chuyển đến',
      ovChipStay: 'Lưu trú', ovChipTransport: 'Di chuyển', ovChipTickets: 'Vé', ovChipFood: 'Ẩm thực',
      ovAskOptimize: 'Tối ưu lịch trình', ovAskGems: 'Tìm điểm độc đáo', ovAskBook: 'Tôi nên đặt gì tiếp theo?',
      season_spring: 'Mùa xuân', season_summer: 'Mùa hè', season_fall: 'Mùa thu', season_winter: 'Mùa đông',
      tab_days: 'Ngày', tab_tasks: 'Nhiệm vụ', tab_more: 'Thêm', moreNavTitle: 'Tất cả mục', continuePlanning: 'Tiếp tục lên kế hoạch',
      navTrips: 'Chuyến đi', navConcierge: 'Trợ lý AI', navShare: 'Chia sẻ', navProfile: 'Tài khoản', mustSee: 'Nên xem', topPick: 'Lựa chọn hàng đầu',
      ovToDo: 'cần làm', ovDone: 'xong', ovTotalLc: 'tổng', ovFamilyLc: 'gia đình', ovEstimated: 'Ước tính', ovRemaining: 'Còn lại',
      ovMemories: 'Kỷ niệm', ovAddToTrip: 'Thêm vào chuyến đi', ovReplace: 'Thay thế', ovReplaceCmd: 'Thêm {name} vào chuyến đi và thay một điểm tương tự ít ưu tiên hơn',
      tab_itinerary: 'Lịch trình', tab_arrival: 'Kế Hoạch Đến Nơi', tab_group: 'Nhóm',
      tab_journey: 'Hành trình', journeyTitle: 'Hành trình của bạn', journeySub: 'Mỗi điểm dừng, nơi ở và chuyến xe là một nút. Khóa thứ bạn thích 🔒 — AI chỉ tối ưu xung quanh.', jnNoPlan: 'Hãy tạo chuyến đi trước — dòng thời gian hành trình sẽ hiện ở đây.', jnLock: 'Khóa', jnUnlock: 'Mở khóa', jnLocked: 'Đã khóa', jnImprove: 'Cải thiện quanh mục này', jnImproving: 'Đang lên lại ngày này (giữ mục đã khóa)…', jnAddAfter: 'Thêm sau', jnReplanDay: 'Lên lại ngày này', jnReplanKeep: 'giữ 🔒 đã khóa', jnReplanned: 'Đã lên lại ngày — giữ mục đã khóa', jnTransportNode: 'Di chuyển', jnViewTransport: 'So sánh di chuyển', jnNodeMenu: 'Tùy chọn', jnAddPh: 'Thêm địa điểm / hoạt động', jnAdd: 'Thêm',
      cmdPh: 'Nói cho trợ lý biết bạn muốn đổi gì…', cmdGo: 'Hỏi AI', cmdBusy: 'Đang hiểu yêu cầu của bạn…', cmdPlanTitle: 'Đây là những thay đổi tôi sẽ làm', cmdNone: 'Tôi chưa chuyển được thành chỉnh sửa — hãy thử diễn đạt lại (vd: “bỏ sở thú”, “thêm Disneyland ngày 2”, “tìm bữa tối Việt khác”).', cmdFail: 'Hiện chưa hiểu được — vui lòng thử lại.', cmdDays: 'Lên lại ngày {d}', cmdApply: 'Áp dụng thay đổi', cmdApplied: 'Đã cập nhật chuyến đi', cmdCancel: 'Hủy',
      cmdop_skip: 'Bỏ qua', cmdop_delete: 'Xóa', cmdop_lock: 'Khóa', cmdop_unlock: 'Mở khóa', cmdop_replace: 'Thay thế', cmdop_add: 'Thêm', cmdop_retime: 'Đổi giờ', cmdop_replan_day: 'Lên lại', cmdop_stay_extra_night: 'Ở thêm một đêm', cmdop_leave_earlier: 'Về sớm hơn', cmdop_change_return: 'Đổi chuyến về',
      rideBookingTitle: 'Xe Du Lịch Cali', rideBookedToast: 'Đã đặt xe và thêm vào chuyến đi', rideRequestedToast: 'Đã yêu cầu xe — chờ xác nhận', rideNotCompleted: 'Chưa hoàn tất đặt xe — không có gì được thêm. Bạn có thể thử lại.', rideBookedNote: 'Đã đặt xe Du Lịch Cali', rideRequestedNote: 'Đã yêu cầu xe Du Lịch Cali', rideRequestMichael: 'Yêu cầu xe Michael', rideBookDlc: 'Đặt với Du Lịch Cali', rideViewRequest: 'Xem yêu cầu', rideModifyRequest: 'Sửa yêu cầu', rideCancelRequest: 'Hủy yêu cầu', rideViewTitle: 'Yêu cầu xe của bạn', rideRouteLabel: 'Tuyến', ridePassengers: 'Số khách', rideCancelledNote: 'Đã hủy yêu cầu xe', rideCancelledToast: 'Đã hủy yêu cầu xe — bạn có thể yêu cầu lại bất cứ lúc nào', rideModifyNote: 'ĐÃ SỬA — thay cho yêu cầu #{id}; vui lòng hủy đặt chỗ trước đó',
      groupTravelersTitle: 'Ai cùng đi', travelersAdults: 'người lớn', travelersEdit: 'Sửa người đi',
      summary: 'Tóm tắt chuyến đi', assumptions: 'Giả định', warnings: 'Cần lưu ý',
      costRange: 'Chi phí ước tính', meetup: 'Điểm hẹn', regenDay: 'Tạo lại ngày',
      whySelected: 'Vì sao chọn', bestTime: 'Thời điểm tốt', duration: 'Thời gian', parking: 'Đỗ xe',
      kidFriendly: 'Hợp trẻ em', walking: 'Đi bộ', cost: 'Chi phí', details: 'Chi tiết', replace: 'Thay đổi',
      mapG: 'Google Maps', mapA: 'Apple Maps', website: 'Website', reserve: 'Đặt chỗ', ticket: 'Vé',
      backup: 'Dự phòng gần đó', tips: 'Mẹo', close: 'Đóng',
      walk_low: 'Ít đi bộ', walk_medium: 'Đi bộ vừa', walk_high: 'Đi bộ nhiều',
      pending: 'Chờ xác minh', unverified: 'Gợi ý AI — hãy kiểm tra trước khi đặt',
      vote: 'Bình chọn', v_like: 'Thích', v_maybe: 'Có thể', v_skip: 'Bỏ qua', save: 'Lưu', saved: 'Đã lưu',
      cons_loved: 'Nhóm ❤', cons_liked: 'Nhóm thích', cons_mixed: 'Ý kiến trái chiều', cons_skip: 'Nhóm bỏ qua', sortedByVotes: 'Sắp xếp theo bình chọn của nhóm',
      tab_album: 'Album', tab_clips: 'Clip AI',
      albumTitle: 'Album chuyến đi', albumSub: 'Chia sẻ ảnh & video chuyến đi bằng liên kết — gắn thẻ, yêu thích và chọn ảnh đẹp nhất để tạo clip AI. Mục riêng tư vẫn được giữ kín.', albumDemo: 'Album sẽ mở khi bạn tạo một chuyến đi thật.', albumEmpty: 'Chưa có gì — thêm liên kết ảnh/video để bắt đầu album.', albumAdd: 'Thêm ảnh/video', albumAddHint: 'Dán URL ảnh/video hoặc liên kết album chia sẻ (Google Photos, Amazon Photos, v.v.). Hiện chỉ nhận liên kết — chưa tải lên.', albumUrl: 'Liên kết ảnh / video / album', albumUrlPh: 'https://… (URL ảnh hoặc liên kết album chia sẻ)', albumCaption: 'Chú thích', albumCaptionPh: 'Một chú thích ngắn', albumPlace: 'Địa điểm', albumPlacePh: 'Chụp ở đâu?', albumNoDay: 'Không thuộc ngày cụ thể', albumVisibility: 'Ai có thể xem', albumAddBtn: 'Thêm vào album', albumAdded: 'Đã thêm vào album', albumOpen: 'Mở', albumLink: 'Liên kết', albumFav: 'Yêu thích', albumSelect: 'Dùng cho clip', albumPrivacyNote: 'Chỉ thành viên chuyến đi mới xem được album. Mục riêng tư chỉ bạn và chủ chuyến đi thấy. Không có gì được đăng ở đâu cả.',
      vis_group: 'Tất cả thành viên', vis_private: 'Chỉ mình tôi', vis_selected_only: 'Chỉ khi được chọn cho clip',
      clipsTitle: 'Clip mạng xã hội AI', clipsSub: 'AI tạo một bộ tài liệu sẵn sàng quay (kịch bản phân cảnh, chú thích, lời thuyết minh, hashtag, bài đăng theo nền tảng) từ ảnh/video bạn chọn. Không bao giờ kết xuất hay đăng video.', clipsSelectHint: 'Đã chọn {n} mục — tích "Dùng cho clip" trên các mục trong album để thêm vào.', clipsNeedSelect: 'Hãy chọn ít nhất một mục trong album trước (Dùng cho clip).', clipNeedConsent: 'Vui lòng xác nhận đồng ý sử dụng các mục đã chọn trước.', clipPlatform: 'Nền tảng', clipMood: 'Tâm trạng', clipLength: 'Độ dài', clipConsent: 'Tôi xác nhận mọi người trong ảnh/video đã chọn đồng ý sử dụng. Mục riêng tư không bao giờ được dùng trừ khi tôi tự chọn.', clipGenerate: 'Tạo bộ tài liệu clip', clipWorking: 'Đang tạo bộ tài liệu clip…', clipFail: 'Hiện chưa tạo được — vui lòng thử lại.', clipStoryboard: 'Kịch bản phân cảnh', clipVoiceover: 'Lời thuyết minh', clipOverlays: 'Chữ trên màn hình', clipHashtags: 'Hashtag', clipExportNote: 'Đây là bộ tài liệu để bạn dùng với trình biên tập / công cụ video mạng xã hội — không kết xuất hay đăng video tại đây.',
      clipPost_tiktok: 'TikTok', clipPost_instagram: 'Instagram', clipPost_youtube: 'YouTube', clipPost_facebook: 'Facebook',
      clipmood_fun: 'Vui nhộn', clipmood_cinematic: 'Điện ảnh', clipmood_heartfelt: 'Cảm xúc', clipmood_energetic: 'Sôi động',
      cliplen_short: 'Ngắn (~15–30 giây)', cliplen_medium: 'Vừa (~30–60 giây)', cliplen_long: 'Dài (1–3 phút)',
      youAre: 'Bạn là:', pickFamilyHint: 'Chọn gia đình của bạn ở trên để bình chọn.',
      suggestionsTitle: 'Đề xuất từ nhóm', addSuggestion: 'Đề xuất địa điểm hoặc hoạt động', suggestionPh: 'vd: Ăn tối ngắm hoàng hôn ở bến tàu', suggest: 'Thêm', suggestedBy: 'bởi', noSuggestions: 'Chưa có đề xuất — hãy thêm một cái!',
      booking: 'Đặt chỗ', b_not_needed: 'Không cần', b_needed: 'Cần', b_booked: 'Đã đặt', b_skipped: 'Bỏ qua',
      markBooked: 'Đánh dấu đã đặt', markArrived: 'Đánh dấu đã đến', completed: 'Xong',
      recDeparture: 'Giờ khởi hành đề xuất', eta: 'Giờ đến dự kiến', route: 'Lộ trình', restStops: 'Điểm dừng',
      ticketSearch: 'Tìm vé', status: 'Trạng thái', st_planning: 'Đang lên kế hoạch', st_booked: 'Đã đặt',
      st_on_the_way: 'Đang đi', st_arrived: 'Đã đến', notes: 'Ghi chú', addNote: 'Thêm ghi chú nhóm', send: 'Gửi',
      shareTitle: 'Chia sẻ chuyến đi', shareSub: 'Thành viên gia đình đăng nhập bằng điện thoại để xem, bình chọn và đề xuất.',
      copyLink: 'Sao chép liên kết', copied: 'Đã sao chép!', viewOnly: 'Chuyến đi được chia sẻ (xem & bình chọn)',
      newTrip: 'Chuyến đi mới', editTrip: 'Sửa chuyến đi',
      required: 'Vui lòng điền các trường bắt buộc.',
      // Login + live research
      loginTitle: 'Đăng nhập để xem chuyến đi', loginSub: 'Dùng số điện thoại để xem kế hoạch và bình chọn, đề xuất, chọn lựa cùng gia đình.',
      signIn: 'Đăng nhập', signUp: 'Tạo tài khoản', phone: 'Số điện thoại', password: 'Mật khẩu',
      passwordHelp: 'Lần đầu? Chọn mật khẩu (ít nhất 8 ký tự) để tạo tài khoản.',
      authFailed: 'Đăng nhập thất bại. Kiểm tra số điện thoại và mật khẩu.', needAccount: 'Lần đầu? Tạo tài khoản', haveAccount: 'Đã có tài khoản? Đăng nhập', logout: 'Đăng xuất',
      logInExisting: 'Đăng nhập tài khoản của bạn', myTrips: 'Chuyến đi của bạn', noTripsYet: 'Chưa có chuyến đi nào — hãy tạo một chuyến ở trên.', resumeHint: 'Chạm vào một chuyến để tiếp tục lên kế hoạch.',
      dashTitle: 'Chuyến đi của tôi', tcBrand: 'Hướng Dẫn Du Lịch', backToMyTrips: '← Chuyến đi của tôi', createNewTrip: '+ Tạo chuyến mới', editTripBtn: 'Sửa', deleteTripBtn: 'Xóa', openTripBtn: 'Mở', moreActions: 'Thêm', ownedSection: 'Chuyến bạn sở hữu', joinedSection: 'Chuyến bạn tham gia', lastUpdated: 'Cập nhật', neverUpdated: 'Nháp', delConfirmTitle: 'Xóa chuyến đi này?', delConfirmBody: 'Việc này ẩn chuyến đi khỏi danh sách và vô hiệu hóa liên kết & mật mã chia sẻ. Người tham gia sẽ mất quyền truy cập.', delConfirmYes: 'Xóa chuyến đi', cancelBtn: 'Hủy', tripDeleted: 'Đã xóa chuyến đi', deleting: 'Đang xóa…', dashLoginPrompt: 'Đăng nhập để xem và quản lý chuyến đi của bạn.', moreSheetTitle: 'Tùy chọn chuyến đi',
      researching: 'Đang tìm điểm nổi bật hiện tại…',
      liveTitle: '🔥 Đang hot & theo mùa', liveSub: 'Gợi ý cập nhật cho ngày của bạn — sự kiện, cảnh theo mùa và điểm đang được ưa chuộng.',
      sampleReadonly: 'Đây là mẫu. Tạo chuyến đi của bạn để bình chọn và đề xuất.',
      // Phase 1 — richer questionnaire + multi-destination
      style_luxury: 'Sang trọng', style_budget: 'Tiết kiệm',
      grpInterests: 'Sở thích hoạt động', grpFood: 'Sở thích ẩm thực', grpHotel: 'Sở thích khách sạn', grpKids: 'Trẻ em', grpTeens: 'Thanh thiếu niên', grpSeniors: 'Người cao tuổi', foodOther: 'Ẩm thực khác / ghi chú',
      destinations: 'Điểm đến', addDestination: 'Thêm điểm đến', removeDestination: 'Xóa điểm đến', moveUp: 'Di chuyển lên', moveDown: 'Di chuyển xuống',
      legStart: 'Ngày bắt đầu', legEnd: 'Ngày kết thúc', hotelName: 'Tên khách sạn', hotelArea: 'Khu vực khách sạn', hotelNotes: 'Ghi chú khách sạn', moreDetailsOptional: 'Thêm chi tiết (tùy chọn)',
      hotelStatus: 'Trạng thái khách sạn', hs_planning: 'Đang lên kế hoạch', hs_researching: 'Đang tìm hiểu', hs_booked: 'Đã đặt',
      travelDay: 'Ngày di chuyển', driveTime: 'Thời gian lái xe', distance: 'Khoảng cách', departFrom: 'Khởi hành', arriveAt: 'Đến nơi', mealStops: 'Điểm ăn uống', restStopsLabel: 'Điểm dừng nghỉ',
      routeOverviewTitle: 'Lộ trình', totalDriveTime: 'Tổng thời gian lái', totalDistance: 'Tổng khoảng cách', leg: 'Chặng', legPending: 'Chi tiết cho điểm này sẽ có sớm.', dayOpen: 'Ngày trống — nhờ AI lên kế hoạch cho ngày này',
      learnMore: 'Tìm hiểu thêm', lmLoading: 'Đang tìm liên kết hữu ích…', lmVerify: 'kiểm chứng', lmWhy: 'Vì sao nên chọn', lmGroupFit: 'Phù hợp nhóm', lmBestTime: 'Thời điểm tốt nhất', lmTimeNeeded: 'Thời gian cần', lm_official_site: 'Trang chính thức', lm_menu: 'Thực đơn', lm_ticket: 'Vé', lm_google_reviews: 'Đánh giá Google', lm_yelp_reviews: 'Đánh giá Yelp', lm_tripadvisor: 'Tripadvisor', lm_youtube_search: 'Tìm video trên YouTube', lm_tiktok: 'Tìm trên TikTok', lm_photos: 'Hình ảnh', lm_map: 'Bản đồ', lm_blog_guide: 'Cẩm nang du lịch', lmParking: 'Đậu xe', lmWalking: 'Đi bộ', lmWaitTime: 'Thời gian chờ', lmSafety: 'An toàn', lmWeather: 'Dự phòng thời tiết',
      popularDishesLabel: 'Món nổi tiếng', altTitle: 'Lựa chọn thay thế & dự phòng', alt_kidFriendly: 'Hợp trẻ em', alt_toddlerLowEnergy: 'Trẻ nhỏ / nhẹ nhàng', alt_teenOption: 'Cho tuổi teen', alt_seniorLowWalking: 'Người lớn tuổi / ít đi bộ', alt_rainyDay: 'Ngày mưa', alt_foodBackup: 'Quán ăn dự phòng',
      routeVerifiedTag: 'Khoảng cách từ Google Maps', routeEstimatedTag: 'Khoảng cách ước tính', driveHome: 'Lái về',
      dt_arrival_day: 'Ngày đến', dt_transfer_day: 'Di chuyển', dt_return_day: 'Ngày về', dt_mixed_day: 'Hỗn hợp',
      mustDoTitle: 'Hoạt động nhất định phải làm (tùy chọn)', pinnedHint: 'Ghim hoạt động bạn đã muốn — AI sẽ sắp lịch quanh chúng.', addPinned: 'Thêm hoạt động phải làm', pinnedActivity: 'Hoạt động', pinnedTitlePh: 'vd: Sở thú San Diego', anyDestination: 'Bất kỳ điểm đến', preferredDay: 'Ngày mong muốn', preferredTime: 'Thời điểm mong muốn', flexible: 'Linh hoạt', priority: 'Ưu tiên', pinnedBookingNote: 'Phải làm — đặt vé/chỗ trước',
      tod_flexible: 'Linh hoạt', tod_morning: 'Buổi sáng', tod_lunch: 'Buổi trưa', tod_afternoon: 'Buổi chiều', tod_dinner: 'Bữa tối', tod_evening: 'Buổi tối', prio_required: 'Bắt buộc', prio_preferred: 'Ưu tiên', prio_optional: 'Tùy chọn',
      hotelsTitle: 'Khách sạn', researchHotels: 'Tìm khách sạn', fatigueNote: 'Mệt mỏi', napNote: 'Giờ ngủ trưa', seniorNote: 'Lưu ý người cao tuổi',
      genSkeleton: 'Đang vạch lộ trình…', genLeg: 'Đang lên kế hoạch từng chặng…', genLegOf: 'Đang lên chặng {n}/{total}…',
      // Travel Booking Concierge
      tab_bookings: 'Nhiệm vụ', bookingsTitle: 'Nhiệm vụ chuyến đi', bookingsSub: 'Cần đặt, xác nhận và thanh toán cho chuyến đi.',
      bookingApprovalNotice: 'AI chỉ tìm hiểu và chuẩn bị lựa chọn — không bao giờ mua, tính tiền thẻ hay lưu số thẻ. Bạn hoàn tất thanh toán trên trang chính thức.',
      researchBookings: 'Tìm lựa chọn (AI)', rebuildChecklist: 'Tạo lại từ lịch trình', addBooking: 'Thêm mục đặt chỗ', noBookings: 'Chưa có mục nào — hãy tìm lựa chọn hoặc thêm một mục.',
      tdealsTitle: 'Ưu đãi vé', tdealsSub: 'Cách để cả nhóm trả ít hơn cho các điểm tham quan có vé — chỉ tra cứu, không tự đặt.', tdealsFind: 'Tìm ưu đãi vé', tdealsRefresh: 'Làm mới ưu đãi', tdealsResearching: 'Đang tìm ưu đãi vé…', tdealsNone: 'Hiện chưa thấy ưu đãi rõ ràng', tdealsNoTickets: 'Chưa có điểm tham quan có vé — hãy xếp hạng điểm tham quan trước (Nổi bật).', tdealsEmpty: 'Chưa có ưu đãi vé.', tdealSave: 'tiết kiệm', tdealBookBy: 'mua', tdealOfficial: 'Vé chính thức', tdealSearch: 'So sánh ưu đãi', tdeal_multi_day: 'Vé nhiều ngày', tdeal_family_bundle: 'Gói gia đình', tdeal_early_bird: 'Mua sớm / trước', tdeal_combo: 'Gói combo', tdeal_membership: 'Thành viên', tdeal_group: 'Giá nhóm', tdeal_free_day: 'Ngày miễn phí / giảm giá', tdeal_resident: 'Giảm giá cư dân', tdeal_military_senior_student: 'Quân nhân / cao tuổi / sinh viên', tdeal_other: 'Ưu đãi',
      researchingBookings: 'Đang tìm vé & chỗ cần đặt trước…', conciergeWorking: 'Trợ lý AI đang làm bài tập — khách sạn, ẩm thực và đặt chỗ đang được tải.', refreshResearch: 'Làm mới',
      bookingType: 'Loại', openOfficial: 'Mở trang chính thức', readyToBook: 'Sẵn sàng đặt', markBooked: 'Đánh dấu đã đặt', undoBooked: 'Đã đặt ✓ (chạm để hoàn tác)',
      iBookedThis: 'Tôi đã đặt', confirmBookingTitle: 'Xác nhận đặt chỗ', confirmBookingIntro: 'Đặt trên trang của nhà cung cấp, rồi dán mã xác nhận và số tiền bạn đã trả.', confirmBookingHonesty: 'Chỉ lưu những gì bạn nhập — chúng tôi không tự xác nhận hay lấy giá.', confirmBookingSave: 'Lưu đặt chỗ', confirmNeedNumber: 'Hãy nhập mã xác nhận trước.', confirmationNumberPh: 'vd: ABC123', actualPricePaid: 'Số tiền đã trả', actualPricePh: 'vd: $420', confirmGoFlight: 'Tìm & đặt chuyến bay', confirmGoHotel: 'Tìm & đặt khách sạn', confirmFlightAirlineHint: 'Mẹo: nên đặt trên trang hãng bay khi giá tương đương — dễ đổi vé hơn.', selfBookedToast: 'Đã lưu đặt chỗ vào chuyến đi', selfBookedNote: 'Đã đặt', selfBookedBy: 'Người đặt', selfBookedLedgerNote: 'Tự đặt',
      confirmationNumber: 'Mã xác nhận', cancellationPolicy: 'Chính sách hủy', refundPolicy: 'Chính sách hoàn tiền', deadlineLabel: 'Đặt trước', providerLabel: 'Nhà cung cấp', recommended: 'Đề xuất', bookingNotes: 'Ghi chú',
      bt_flight: 'Chuyến bay', bt_hotel: 'Khách sạn', bt_airbnb: 'Nhà cho thuê', bt_attraction: 'Tham quan / vé', bt_restaurant: 'Nhà hàng', bt_tour: 'Tour', bt_parking: 'Bãi đỗ xe', bt_rental_car: 'Thuê xe', bt_bus: 'Xe khách', bt_ride: 'Đưa đón', bt_packing: 'Hành lý', bt_payment: 'Thanh toán', bt_confirmation: 'Xác nhận', bt_other: 'Khác',
      bs_research_needed: 'Cần tìm hiểu', bs_researching: 'Đang tìm hiểu', bs_ready_to_book: 'Sẵn sàng đặt', bs_user_approval_needed: 'Cần phê duyệt', bs_booked: 'Đã đặt', bs_skipped: 'Bỏ qua', bs_paid: 'Đã thanh toán', bs_not_needed: 'Không cần', bs_completed: 'Hoàn tất',
      tf_todo: 'Cần làm', tf_completed: 'Hoàn tất', markDone: 'Đánh dấu xong', taskCompletedBy: 'Hoàn tất bởi',
      naTitle: 'Tiếp theo', naAllSet: 'Mọi thứ đã sẵn sàng', naResearch: 'Tìm lựa chọn',
      blkTransport: 'Đang chờ phương tiện di chuyển', blkStay: 'Chưa đặt khách sạn', blkPrior: 'Đang chờ bước trước', blkDep: 'Đang chờ điều kiện trước',
      progTransport: 'Di chuyển', progHotels: 'Khách sạn', progTickets: 'Vé', progActivities: 'Hoạt động', progFood: 'Ẩm thực',
      warnHotelFirst: 'Đặt khách sạn ở {city} trước khi mua vé & hoạt động.', warnBookSoon: '{title} — nên đặt sớm, có thể hết chỗ.', warnReturnMissing: 'Chưa có chuyến về — hãy thêm phương tiện trở về.', warnUnscheduled: '{n} mục chưa được xếp vào chuyến đi.',
      depMapTitle: 'Sơ đồ phụ thuộc', depMapSub: 'Việc gì phụ thuộc việc gì — thứ tự cần chốt',
      pri_P0: 'P0 · Khẩn', pri_P1: 'P1', pri_P2: 'P2', taskUnassigned: 'Chưa giao', taskDue: 'Hạn chót', taskCost: 'Chi phí ước tính', taskBook: 'Đặt', taskConfirmRide: 'Xác nhận xe', taskChoose: 'Chọn/bình chọn', taskActual: 'Chi phí thực tế', taskPaidBy: 'Người trả', taskPaidByNone: 'Chưa trả', taskBalanceTitle: 'Số dư theo gia đình', taskOwed: 'nợ', taskOwes: 'còn nợ', taskAhead: 'trả dư', taskPaidTotal: 'Tổng đã trả', taskRemaining: 'còn lại', taskWholeFamily: 'Cả gia đình', memberCostTitle: 'Chi phí theo từng người', memberCostUnassigned: 'Chưa giao (chưa có người)', tf_all: 'Tất cả', tf_urgent: 'Khẩn', tf_mine: 'Của tôi', tf_unpaid: 'Chưa trả', tf_bookings: 'Đặt chỗ', tf_done: 'Hoàn tất',
      shareTrip: 'Chia sẻ chuyến đi', shareModalTitle: 'Mời nhóm của bạn', shareLinkLabel: 'Liên kết chuyến đi', sharePasscodeLabel: 'Mật mã', copyPasscode: 'Sao chép mật mã', passcodeCopied: 'Đã sao chép mật mã!',
      regeneratePasscode: 'Tạo lại liên kết + mật mã', shareRegenWarn: 'Việc này tạo liên kết và mật mã mới; cái cũ sẽ ngừng hoạt động.', disableSharing: 'Tắt chia sẻ', enableSharing: 'Bật chia sẻ', sharingDisabled: 'Chia sẻ hiện đang TẮT.', shareGenerating: 'Đang tạo lời mời an toàn…',
      sharePermInfo: 'Bất kỳ ai có liên kết VÀ mật mã đều có thể đăng nhập để xem, bình chọn, đề xuất và thêm gia đình. Chỉ bạn mới có thể sửa chuyến đi, duyệt đề xuất và quản lý thành viên. Không ai xóa được chuyến đi hay mua hàng.',
      membersTitle: 'Thành viên', role_owner: 'Chủ chuyến', role_organizer: 'Người tổ chức', role_member: 'Thành viên', role_guest: 'Khách', promote: 'Đặt làm tổ chức', demote: 'Đặt làm thành viên',
      joinTitle: 'Tham gia chuyến đi', joinPasscodePrompt: 'Nhập mật mã chuyến đi', yourName: 'Tên của bạn', joinBtn: 'Tham gia', joining: 'Đang tham gia…',
      joinBadPasscode: 'Mật mã không đúng. Hãy hỏi chủ chuyến đi.', joinRateLimited: 'Quá nhiều lần thử — vui lòng thử lại sau vài phút.', joinDisabled: 'Liên kết này không còn hoạt động. Hãy xin liên kết mới từ chủ chuyến.',
      sg_pending: 'Chờ duyệt', sg_approved: 'Đã duyệt', sg_rejected: 'Từ chối', approve: 'Duyệt', reject: 'Từ chối',
      emailOptional: 'Email (không bắt buộc)', roleRequested: 'Tham gia với vai trò', addMyFamily: '+ Thêm gia đình của tôi', chooseFamily: 'Bạn thuộc gia đình nào?', newMemberOpt: 'Chỉ mình tôi (không gia đình)',
      joinedLabel: 'Đã tham gia', lastActiveLabel: 'Hoạt động gần nhất', memberPhone: 'Điện thoại', addMemberBtn: 'Thêm thành viên', invitedPending: 'Đã mời (chờ)', assignFamilyBtn: 'Gia đình',
      loggedInAs: 'Đăng nhập với tên', switchMember: 'Đổi thành viên', logoutTrip: 'Thoát khỏi chuyến đi', familyNamePh: 'vd: Gia đình Nguyễn',
      destRoleLabel: 'Điểm này là', stayOvernightQ: 'Ngủ qua đêm ở đây?', hotelNeededQ: 'Cần khách sạn/Airbnb ở đây?', hoursLabel: 'Thời gian ở đây', hoursPh: 'vd: 2 giờ, nửa ngày', suggestFoodQ: 'Gợi ý ăn uống', suggestActivitiesQ: 'Gợi ý hoạt động', optionalStop: 'Điểm tùy chọn', editDestination: 'Sửa điểm đến', regenLeg: 'Tạo lại chặng này', optionalBadge: 'Tùy chọn',
      advancedOptions: 'Tùy chọn nâng cao', customizeStop: 'Tùy chỉnh ngày cho điểm này', aiRecommendsStay: 'Cho biết sở thích — AI sẽ gợi ý khu vực, chỗ ở đáng giá, hợp gia đình & sang trọng.', knowHotelHint: 'Đã biết khách sạn? Nhập vào (tùy chọn).', specialInstructions: 'Hướng dẫn đặc biệt',
      lastDayFullQ: 'Dùng ngày cuối làm ngày hoạt động đầy đủ', returnDay: 'Ngày về',
      dhp_budget: 'Tiết kiệm', dhp_moderate: 'Vừa phải', dhp_luxury: 'Sang trọng', dhp_pool: 'Hồ bơi', dhp_kitchen: 'Bếp', dhp_breakfast: 'Bữa sáng', dhp_suite: 'Phòng suite', dhp_ocean_view: 'Nhìn ra biển', dhp_near_attractions: 'Gần điểm tham quan',
      dr_main_destination: 'Điểm đến chính', dr_overnight_destination: 'Nghỉ qua đêm', dr_stopover: 'Điểm dừng (hoạt động)', dr_meal_stop: 'Điểm ăn/nghỉ', dr_airport_arrival: 'Đến sân bay', dr_pass_through: 'Đi ngang qua', dr_optional_attraction: 'Điểm tham quan tùy chọn',
      tab_stay: 'Nơi ở', whereToStayTitle: 'Nơi lưu trú', staysSub: 'AI nghiên cứu khu vực + lựa chọn khách sạn & Airbnb cho từng điểm.', findStays: 'Tìm nơi ở (AI)', researchingStays: 'Đang tìm khu vực & chỗ ở tốt nhất…', noStaysYet: 'Nhấn “Tìm nơi ở” để AI gợi ý khách sạn & Airbnb.', bestArea: 'Khu vực tốt nhất', airbnbAreasTitle: 'Khu vực Airbnb / cho thuê', searchHotelBtn: 'Tìm khách sạn', searchAirbnbBtn: 'Tìm Airbnb', selectStay: 'Chọn', staySelected: 'Đã chọn ✓', parkingLabel: 'Đỗ xe', distanceLabel: 'Khoảng cách',
      stayfor_budget: 'Tiết kiệm', stayfor_best_value: 'Đáng giá nhất', stayfor_family: 'Hợp gia đình', stayfor_luxury: 'Sang trọng', stayfor_pool: 'Hồ bơi', stayfor_breakfast: 'Bữa sáng', stayfor_kitchen: 'Bếp / suite', stayfor_accessible: 'Dễ tiếp cận',
      stayfor_best_overall: 'Tốt nhất tổng thể', stayfor_resort: 'Khu nghỉ dưỡng', stayfor_ocean_view: 'Hướng biển', stayfor_food_area: 'Khu ẩm thực tốt nhất', stayfor_theme_parks: 'Công viên giải trí', stayfor_disneyland: 'Disneyland',
      amBreakfast: 'Bữa sáng', amKitchen: 'Bếp', amPool: 'Hồ bơi', amFamilySuite: 'Phòng gia đình',
      stayBooking: 'Booking.com', stayExpedia: 'Expedia', stayHotels: 'Hotels.com', stayReviews: 'Đánh giá', refreshStays: 'Làm mới nơi ở',
      bestAreasTitle: 'Khu vực tốt nhất cho nhóm bạn', stayStrategiesTitle: 'Nên đặt cơ sở ở đâu', stayStrategiesSub: 'AI so sánh các chiến lược lưu trú giữa các điểm và đề xuất một phương án.',
      strat_single_base: 'Một cơ sở', strat_split_nights: 'Chia đêm', strat_cheapest: 'Rẻ nhất', strat_near_attraction: 'Gần điểm tham quan chính',
      stratDriving: 'Lái xe', stratConvenience: 'Tiện lợi', stratKids: 'Trẻ em', stratFood: 'Ẩm thực',
      tab_food: 'Ẩm thực', foodPicksTitle: 'Gợi ý ẩm thực', foodSub: 'AI nghiên cứu nhà hàng cho cả nhóm tại từng điểm — hợp khẩu vị của bạn.', findFood: 'Tìm gợi ý ẩm thực (AI)', researchingFood: 'Đang tìm nhà hàng tốt nhất cho nhóm…', noFoodYet: 'Nhấn “Tìm gợi ý ẩm thực” để AI gợi ý nhà hàng.', searchFoodBtn: 'Tìm', yelpBtn: 'Yelp', dishesLabel: 'Nên thử', reservationLabel: 'Đặt chỗ',
      imgRepresentative: 'Chỉ là ảnh minh họa', imgPending: 'Ảnh chờ xác minh', viewPhotos: 'Ảnh', googleReviews: 'Đánh giá Google', yelpReviews: 'Đánh giá Yelp', menuBtn: 'Thực đơn', mustTryLabel: 'Nên thử',
      noVerifiedPhoto: 'Chưa có ảnh xác minh', noVerifiedFood: 'Chưa có ảnh món ăn xác minh', viewGooglePhotos: 'Ảnh Google', tripadvisor: 'Tripadvisor', verifiedPhoto: 'Ảnh đã xác minh', areaPhoto: 'Ảnh khu vực · Wikimedia', likelyMatchPhoto: 'Có thể đúng · Wikimedia', viaWikipedia: 'Wikipedia (CC)', viaWikimedia: 'Wikimedia Commons', morePhotos: 'Thêm ảnh',
      skipPlace: 'Bỏ qua', skippedLabel: 'Đã bỏ qua', undoSkip: 'Hoàn tác', replaceAlt: 'Thay bằng lựa chọn khác', replacedOriginal: 'Đã thay', pickAlternative: 'Chọn một lựa chọn', noAlts: 'Không tìm thấy — hãy tìm hoặc tự thêm.', searchReplacement: 'Tìm chỗ thay thế', addOwn: 'Tự thêm', addOwnPh: 'Tên nhà hàng / địa điểm của bạn', leaveEmpty: 'Để trống khung giờ này', loadingAlts: 'Đang tìm lựa chọn…',
      foodfor_family: 'Hợp gia đình', foodfor_groups: 'Nhóm đông', foodfor_date_night: 'Hẹn hò', foodfor_quick_bite: 'Ăn nhanh', foodfor_fine_dining: 'Cao cấp', foodfor_breakfast: 'Bữa sáng', foodfor_vegetarian: 'Chay', foodfor_seafood: 'Hải sản', foodfor_local_specialty: 'Đặc sản địa phương', foodfor_kid_friendly: 'Hợp trẻ em',
      // Điều khiển lịch trình (di chuyển/đổi thứ tự/khung giờ/ghim/thêm/lên lại/vì sao)
      ts_morning: 'Buổi sáng', ts_lunch: 'Bữa trưa', ts_afternoon: 'Buổi chiều', ts_dinner: 'Bữa tối', ts_evening: 'Buổi tối', ts_optional: 'Tùy chọn', ts_backup: 'Dự phòng',
      moveUp: 'Lên trên', moveDown: 'Xuống dưới', moveToDay: 'Chuyển sang ngày', changeTimeSlot: 'Khung giờ', moveCard: 'Di chuyển', dragHint: 'Kéo để di chuyển, hoặc dùng menu này',
      pinHere: 'Ghim vào ngày & giờ này', unpinHere: 'Bỏ ghim', pinnedHere: 'Đã ghim', addedByYou: 'Bạn đã thêm', removeAdded: 'Xóa',
      whyHere: 'Vì sao ngày/giờ này?', whyLoading: 'Đang cân nhắc lựa chọn phù hợp nhất…', whyUnavailable: 'Tạm thời chưa có giải thích — vui lòng thử lại.',
      dayActionsTitle: 'Chỉnh sửa ngày này', addActivity: 'Thêm hoạt động', addRestaurant: 'Thêm nhà hàng', addRestStop: 'Thêm điểm nghỉ', regenDayBtn: 'Tạo lại ngày', reoptDayBtn: 'Tối ưu lại ngày', regenDayWorking: 'Đang dựng lại ngày này…',
      addKind_activity: 'Thêm một hoạt động', addKind_restaurant: 'Thêm một nhà hàng', addKind_rest_stop: 'Thêm một điểm nghỉ', addNamePh: 'Tên (vd. nơi bạn đã biết)', cancelAdd: 'Hủy',
      replanMsg: 'Bạn đã thay đổi ngày này. AI nên làm gì?', replanKeep: 'Giữ thay đổi của tôi', replanTiming: 'Chỉ sửa giờ giấc', replanReopt: 'Tối ưu lại quanh thay đổi', replanReset: 'Đặt lại theo AI',
      finalDayPlan: 'Kế hoạch ngày cuối', finalDayHint: 'Mặc định để AI quyết định — dựa trên quãng đường về, giờ trả phòng, trẻ em/người lớn tuổi và nhịp độ của bạn.',
      fdm_ai_decide: 'Chưa chắc — để AI quyết định', fdm_return_day: 'Ngày về / di chuyển về', fdm_half_day: 'Nửa ngày hoạt động + về', fdm_full_day: 'Ngày hoạt động đầy đủ',
      // V2 nhập liệu tối giản (chỉ AI / Ở ĐÂU / TRẢI NGHIỆM — AI suy luận phần còn lại)
      createSubV2: 'Chỉ thông tin cơ bản — trợ lý AI lo phần còn lại (lộ trình, khách sạn, di chuyển, lịch trình).',
      tripNamePh: 'vd. Hè cùng nhà Nguyễn', originLabel: 'Bạn khởi hành từ đâu?', paceLabel: 'Nhịp độ',
      destHintV2: 'Chỉ cần ghi tên các nơi — không cần vai trò hay thiết lập điểm dừng. AI sẽ lên lộ trình & thời gian.',
      familySubV2: 'Cho chúng tôi biết ai sẽ đi và họ thích gì — AI lo phần còn lại.', foodOtherPh: 'Ẩm thực khác (cách nhau dấu phẩy)',
      stayAtmosphere: 'Không gian lưu trú', stayAtmosphereHint: 'Phong cách bạn muốn — AI chọn khu vực & khách sạn thực tế.',
      planTrip: 'Lên kế hoạch chuyến đi', planTripHint: 'Trợ lý AI nghiên cứu di chuyển, khách sạn, ẩm thực, hoạt động, lộ trình & ngày về.',
      sa_ocean_view: 'View biển', sa_near_beach: 'Gần biển', sa_quiet: 'Yên tĩnh', sa_family_friendly: 'Hợp gia đình', sa_resort: 'Resort', sa_airbnb: 'Airbnb', sa_luxury: 'Sang trọng', sa_budget: 'Tiết kiệm', sa_near_attractions: 'Gần điểm tham quan', sa_walkable: 'Dễ đi bộ',
      // Phase B — Trợ lý Di chuyển AI
      tab_transport: 'Di chuyển', tpHeader: 'Cách bạn đến nơi', transportSub: 'AI so sánh phương án di chuyển cho từng chặng — chọn cái hợp nhóm bạn. Ước tính đều được ghi rõ; không đặt gì nếu bạn chưa xác nhận.',
      findTransport: 'So sánh di chuyển (AI)', refreshTransport: 'Làm mới phương án', researchingTransport: 'Đang so sánh ô tô, máy bay, xe buýt & xe riêng…', noTransportYet: 'Nhấn “So sánh di chuyển” để xem phương án AI.',
      tpVerified: 'Đã xác minh', tpEstimate: 'Ước tính', tpNeedsConfirm: 'Cần xác nhận',
      tm_personal_car: 'Xe nhà', tm_rental_car: 'Xe thuê', tm_flight: 'Máy bay', tm_bus: 'Xe buýt', tm_train: 'Tàu hỏa', tm_dlc_ride: 'Xe riêng Du Lịch Cali',
      // V3 — Amtrak/tàu, hạng "tốt nhất cho", Săn ưu đãi
      tpwhy_train: 'Amtrak ngắm cảnh và nhẹ nhàng — không phải lái, rộng rãi, tiện cho người lớn tuổi và trẻ em; lịch trình được tra cứu, không phỏng đoán.',
      tpro_scenic: 'Ngắm cảnh đẹp', tcon_stations: 'Đi theo nhà ga', tpTrainStation: 'Đi từ ga đến ga — kiểm tra ga Amtrak gần nhất và giờ tàu.',
      tpTrainAmtrak: 'Amtrak.com', tpTrainSearch: 'Tra lịch tàu Amtrak',
      tpBestKids: 'Hợp với trẻ em', tpBestSeniors: 'Hợp người lớn tuổi', tpLeastTiring: 'Ít mệt nhất', tpBestLuggage: 'Hợp nhiều hành lý', tpScenic: 'Cảnh đẹp nhất',
      nlPriority: 'Ưu tiên', nlprio_required: 'Bắt buộc (khóa)', nlprio_preferred: 'Ưu tiên', nlprio_ai_decide: 'Để AI quyết định', nlprio_avoid: 'Tránh phương án này',
      tprec_userpref: 'Bạn ưu tiên phương án này cho chặng này nên nó dẫn đầu so sánh — các lựa chọn khác ở bên dưới.', tprec_avoided: 'Đã chọn để tránh phương án bạn muốn bỏ qua ở chặng này.',
      dealWatchOn: 'Đang theo dõi ưu đãi', dealWatchOff: 'Theo dõi ưu đãi', dealCheckNow: 'Kiểm tra ngay', dealWatchHint: 'AI kiểm tra lại phương tiện, khách sạn và ưu đãi vé, báo khi có lựa chọn rẻ hơn hoặc ưu đãi mới — không bao giờ tự đổi kế hoạch. Giá đến từ nghiên cứu và liên kết đặt chỗ; không bịa đặt.', dealNoBetter: 'Hiện chưa có ưu đãi tốt hơn', dealBetterFound: 'Đã tìm thấy ưu đãi tốt hơn', dealHotelDrop: 'Tìm thấy khách sạn rẻ hơn', dealTicketNew: 'Ưu đãi vé mới', perNight: 'đêm', dealWas: 'trước', dealNow: 'nay', dealSave: 'tiết kiệm', dealKeep: 'Giữ lịch trình', dealSwitch: 'Đổi', dealSwitchSaved: 'Đã đổi — tiết kiệm ~{amt} (ước tính)', dealSavingsTotal: 'Đã tiết kiệm nhờ ưu đãi', researchedAt: 'Tra cứu lúc',
      dealResearchFares: 'Tra giá vé hiện tại', dealNoFares: 'Không tìm thấy giá hiện tại — thử các liên kết đặt chỗ.', dealFaresTitle: 'Giá vé hiện tại (đã tra cứu · chờ xác minh)', dealFaresLive: 'Giá vé hiện tại (trực tiếp)', fareLiveTag: 'trực tiếp', dealWhileAway: 'tìm thấy khi bạn vắng mặt',
      pushEnable: 'Bật thông báo điện thoại', pushOn: 'Đã bật thông báo', pushEnabled: 'Đã bật thông báo — chúng tôi sẽ báo khi có ưu đãi tốt hơn.', pushDenied: 'Thông báo đang bị chặn — hãy bật trong cài đặt trình duyệt/điện thoại.', pushUnsupported: 'Thiết bị/trình duyệt này không hỗ trợ thông báo.',
      tm_any: 'Bất kỳ · so sánh tất cả', tm_greyhound: 'Greyhound', tm_flixbus: 'FlixBus', tm_shuttle: 'Xe trung chuyển',
      // V3 Transport strategy + transfer intelligence
      tpCompareTitle: 'So sánh từng chặng', whyRecommended: 'Vì sao',
      stratTitle: 'Kế hoạch di chuyển & trung chuyển AI', stratSub: 'AI nghiên cứu các nhà xe thực tế, tìm điểm trung chuyển và so sánh các chiến lược nhiều chặng — lịch trình & giá chờ xác minh, không bịa.', stratDemo: 'Các chiến lược hiện ra khi bạn tạo chuyến đi thật.', stratNeedOrigin: 'Thêm nơi bạn khởi hành (Bước 1) và AI sẽ lên kế hoạch cách đến nơi.',
      stratPrefLabel: 'Cách di chuyển ưu tiên', stratResearch: 'Nghiên cứu chiến lược di chuyển', stratRefresh: 'Làm mới chiến lược', stratLoading: 'Đang nghiên cứu nhà xe, điểm trung chuyển & chiến lược…', stratNone: 'Hiện chưa nghiên cứu được — bảng so sánh từng chặng đã xác minh bên dưới vẫn hoạt động. Hãy làm mới.',
      stratHubs: 'Điểm trung chuyển', stratStrategies: 'Chiến lược để so sánh', stratRecommended: 'Đề xuất', stratOvernight: 'Nghỉ qua đêm', stratRisk: 'Rủi ro thời gian', stratRequestDlc: 'Yêu cầu xe Du Lịch Cali',
      stratPickup: 'Đón', stratDropoff: 'Trả', stratOfficial: 'Trang chính thức', stratModes: 'Chi tiết nhà xe (đã nghiên cứu)',
      stratReturnTitle: 'Đường về', stratEarlyRisk: 'Rủi ro khởi hành sớm', stratOvernightRec: 'Nên nghỉ đêm gần điểm khởi hành', stratLeaveEarlier: 'Cân nhắc về sớm một ngày',
      stratUnverified: 'AI nghiên cứu — hãy xác nhận lịch trình & giá trên trang chính thức của từng nhà xe trước khi đặt. Thời gian lái xe lấy từ Google Maps hoặc ước tính có ghi rõ; không có gì được đặt ở đây.',
      connTitle: 'Kế hoạch trung chuyển', connTransferNeeded: 'Cần trung chuyển', connDirect: 'Thẳng đến nơi', connOrigin: 'Khởi hành', connDropoff: 'Điểm trả xe/máy bay', connFinal: 'Điểm đến cuối', connTransferOptions: 'Đi từ điểm trả đến khách sạn', connHubStop: 'Còn thời gian? Khám phá điểm trung chuyển', connReturnTitle: 'Thời gian về', connOvernightBefore: 'Chuyến về khởi hành sớm — cân nhắc nghỉ đêm tại điểm trung chuyển vào tối hôm trước.', connScheduleRisk: 'Rủi ro lịch trình', connPending: 'Lịch trình chờ xác minh — hãy xác nhận trên trang chính thức/điện thoại của nhà xe. Không có gì được đặt ở đây.',
      tpDuration: 'Tổng thời gian', tpCost: 'Ước tính tổng', tpPerTraveler: 'Mỗi người', tpFareOnRequest: 'Báo giá khi yêu cầu',
      suit_good: 'tốt', suit_ok: 'ổn', suit_poor: 'hạn chế',
      tpRequestDlc: 'Yêu cầu xe Du Lịch Cali', tpDlcNote: 'Gửi bản nháp sang phần đặt xe Du Lịch Cali — bạn xác nhận tại đó.', tpSearchBook: 'Tìm & đặt', tpConfirmNote: 'Ước tính — xác nhận giá & lịch tại trang đặt.', tpChoose: 'Chọn cái này', tpYourChoice: 'Lựa chọn của bạn',
      tpLeg_outbound: 'Đường đến', tpLeg_inter: 'Giữa các điểm', tpLeg_return: 'Đường về',
      tpDay_transit: 'Ngày di chuyển', tpDay_activity: 'Ngày hoạt động', tpDay_half: 'Nửa di chuyển / nửa chơi',
      tpWhy: 'Vì sao AI đề xuất:', tpRecommended: 'Đề xuất', tpLowestCost: 'Rẻ nhất', tpFastest: 'Nhanh nhất', tpComfort: 'Thoải mái nhất', tpPrivateDlc: 'Xe riêng', tpCompare: 'So sánh phương án', tpSideBySide: 'So sánh cạnh nhau',
      tpPerFamily: 'Mỗi gia đình', tpGas: 'Xăng (ước tính)', tpParking: 'Đậu xe', tpConvenience: 'Tiện lợi', tpBestFamilies: 'Hợp gia đình nhất', tpMarkBooked: 'Đánh dấu đã đặt', tpBooked: 'Đã đặt', tpBookedToast: 'Đã đánh dấu đã đặt', tpUnbookedToast: 'Đã đánh dấu chưa đặt',
      tpTollNote: 'Phí cầu đường: kiểm tra tuyến của bạn (chờ xác minh).', tpAirportBuffer: 'Đã tính ~2–3 giờ ở sân bay (an ninh, lên máy bay, hành lý).', tpBaggageNote: 'Cộng thêm phí hành lý + xe thuê hoặc xe đi chung tại điểm đến.', tpBusStationNote: 'Xác nhận bến đón/trả chính xác với nhà xe.',
      tpFlightSearch: 'Tìm chuyến bay', tpAirportsNear: 'Sân bay gần nhất', tpBusGreyhound: 'Greyhound', tpBusFlix: 'FlixBus', tpBusHoang: 'Hoàng Express',
      apf_closest: 'sân bay gần nhất', apf_budget: 'lựa chọn tiết kiệm', apf_mostflights: 'nhiều chuyến nhất',
      tpro_door: 'Tận nơi', tpro_flexible: 'Linh hoạt — dừng lúc nào cũng được', tpro_luggage: 'Rộng chỗ để hành lý', tpro_costshare: 'Chia chi phí cho cả nhóm', tpro_fastest: 'Nhanh nhất cho quãng đường dài', tpro_lesstiring: 'Đỡ mệt hơn lái xe đường dài', tpro_cheapest: 'Thường rẻ nhất', tpro_nodriving: 'Không phải lái xe', tpro_private: 'Tài xế riêng, chỉ nhóm bạn', tpro_kidssenior: 'Tiện cho trẻ em & người lớn tuổi', tpro_noparking: 'Không lo đậu xe',
      tcon_longdrive: 'Lái xe đường dài', tcon_fatigue: 'Tài xế mệt', tcon_parking: 'Phải tìm/trả phí đậu xe', tcon_airporttime: 'Tốn thời gian ở sân bay', tcon_baggage: 'Phí hành lý', tcon_carthere: 'Cần xe tại điểm đến', tcon_bookahead: 'Đặt sớm để có giá tốt', tcon_slowest: 'Chậm nhất', tcon_schedule: 'Lịch cố định', tcon_luggagelimit: 'Hạn chế hành lý', tcon_highercost: 'Đắt hơn tự lái',
      tprec_car_short: 'Tự lái là cách dễ và linh hoạt nhất cho chặng ngắn với nhóm và hành lý của bạn.', tprec_car_group: 'Tự lái giữ cả nhóm đi cùng nhau với hành lý và rẻ hơn nhiều so với mua vé riêng cho từng người.', tprec_flight_long: 'Bay tiết kiệm thời gian nhất cho chặng dài này với nhóm nhỏ không có trẻ nhỏ — thuê xe tại điểm đến.',
      tm_hoang_bus: 'Xe Đò Hoàng', tpWifi: 'Wi-Fi', tpHoangBook: 'Đặt tại xedohoang.com', tpHoangGuide: 'Hướng dẫn đặt vé', tpHoangSite: 'Trang chính thức',
      tpHoangStation: 'Xác nhận bến đón/trả và lịch chạy chính xác tại xedohoang.com (chờ xác minh).',
      tpHoangConnect: 'Trung tâm chính ở Nam California của Xe Đò Hoàng là Little Saigon (Quận Cam) — nối tiếp đến điểm đến của bạn bằng xe riêng hoặc van Du Lịch Cali.',
      tpro_rest: 'Mọi người được nghỉ', tpro_wifi: 'Wi-Fi miễn phí trên xe', tpro_vietnamese: 'Nhân viên nói tiếng Việt', tpro_avoidtraffic: 'Tránh kẹt xe Nam Cali', tcon_slowerthancar: 'Chậm hơn tự lái',
      tpwhy_personal_car: 'Tự lái: linh hoạt hoàn toàn, tận nơi, và là cách rẻ nhất để cả nhóm đi cùng nhau với hành lý.', tpwhy_dlc_ride: 'Xe riêng Du Lịch Cali: tài xế đưa đón tận nơi — dễ nhất với trẻ em, người lớn tuổi và hành lý, khỏi lo đậu xe.', tpwhy_flight: 'Bay: nhanh nhất cho chặng dài — thuê xe hoặc đi chung tại điểm đến.', tpwhy_bus: 'Greyhound / FlixBus: lựa chọn rẻ nhất không phải lái, theo lịch cố định.', tpwhy_hoang_bus: 'Xe Đò Hoàng: tuyến xe các gia đình Việt yêu thích — mọi người được nghỉ ngơi, Wi-Fi miễn phí, nhân viên nói tiếng Việt, khỏi lái xe và tránh kẹt xe Nam Cali.',
      tprec_hoang: 'Đề xuất Xe Đò Hoàng: có người lớn tuổi và trẻ em, cả nhà được nghỉ ngơi với Wi-Fi thay vì lái 8 tiếng, và tránh kẹt xe Nam California.',
      tprec_userlocked: 'Bạn đã chọn phương án này cho chặng này, nên nó được đặt làm kế hoạch của bạn — lịch trình, chi phí và đặt chỗ được thêm quanh đó. Các lựa chọn bên dưới chỉ là phương án thay thế.',
      routeOpsTitle: 'Cơ hội dọc đường', routeOpsSub: 'Những điểm khám phá tùy chọn trên chặng này — thêm điều nhóm bạn thích, bỏ phần còn lại.', findRouteOps: 'Tìm điểm dừng dọc đường (AI)', researchingRouteOps: 'Đang tìm những điểm thú vị dọc đường…', routeOpAdded: 'Đã thêm vào ngày này', roYourStops: 'Điểm dừng của bạn cho ngày này', roAdd: 'Thêm vào ngày', roMustSee: 'Nên xem', roMin: 'phút vòng thêm', roNoneFilter: 'Không có kết quả cho bộ lọc này — thử bộ lọc khác.',
      roAll: 'Tất cả', roFood: '🍽 Ẩm thực', roBeachScenic: '🏖 Biển & cảnh đẹp', roHidden: '💎 Điểm ẩn', roKid: '🧒 Hợp trẻ em', roLowEnergy: '😌 Nhẹ nhàng', roRainy: '🌧 Ngày mưa',
      roins_food_stop: 'Điểm ăn', roins_short_stop: 'Dừng ngắn', roins_half_day: 'Dừng nửa ngày', roins_overnight: 'Qua đêm', roins_scenic_stop: 'Ngắm cảnh', roins_shopping_stop: 'Mua sắm', roins_beach_stop: 'Ra biển', roins_kid_stop: 'Cho trẻ em', roins_teen_stop: 'Cho thiếu niên', roins_senior_stop: 'Cho người lớn tuổi', roins_photo_stop: 'Chụp ảnh',
      roEnergy_low: 'Ít vận động', roEnergy_medium: 'Vừa phải', roEnergy_high: 'Năng động', roWeather_sunny: 'Hợp khi nắng', roWeather_outdoor: 'Ngoài trời', roWeather_indoor: 'Trong nhà (ngày mưa ổn)',
      toursTitle: 'Tour & trải nghiệm độc đáo', toursSub: 'AI tìm tour cho nhóm bạn — bình chọn, ghim, hoặc yêu cầu qua Du Lịch Cali. Giá chờ xác minh.', researchingTours: 'Đang tìm tour & trải nghiệm độc đáo…', tourRequestDlc: 'Yêu cầu qua Du Lịch Cali',
      tour_harbor_cruise: 'Du thuyền cảng', tour_whale_watching: 'Ngắm cá voi', tour_hop_on_hop_off: 'Xe buýt tham quan', tour_food_tour: 'Tour ẩm thực', tour_walking_tour: 'Tour đi bộ', tour_bike_tour: 'Tour xe đạp', tour_kayak: 'Chèo kayak', tour_boat: 'Tour thuyền', tour_amphibious: 'Tour xe lội nước', tour_brewery: 'Tour nhà máy bia', tour_cultural: 'Văn hóa', tour_adventure: 'Mạo hiểm', tour_nature: 'Thiên nhiên', tour_seasonal: 'Theo mùa', tour_other: 'Trải nghiệm',
      impRelaxing: '😌 Thư giãn nhất', impScenic: '🌄 Cảnh đẹp nhất', impThemePark: '🎢 Công viên giải trí', impSeniorFriendly: '🧓 Hợp người lớn tuổi', impRainyBackup: '🌧 Dự phòng ngày mưa',
      tpRequestPickup: 'Yêu cầu đón sân bay', tpRequestTransfer: 'Yêu cầu đưa về khách sạn',
      dlcInq_ride: 'Yêu cầu xe Du Lịch Cali (từ chuyến đi)', dlcInq_van_transfer: 'Yêu cầu xe van Du Lịch Cali (từ chuyến đi)', dlcInq_tour: 'Yêu cầu tour Du Lịch Cali (từ chuyến đi)', dlcInq_airport_pickup: 'Yêu cầu đón sân bay Du Lịch Cali (từ chuyến đi)',
      pickupAfterProvider: 'Đón sau khi {provider} đến', pickupAfterArrival: 'Đón sau khi bạn đến điểm trả khách',
      tpAffectsItin: 'Đã lưu — ảnh hưởng giờ giấc lịch trình. Mở Lịch trình để tối ưu lại.', tpChosen: 'Đã lưu lựa chọn di chuyển',
      tpReturnTitle: 'Hành trình về (ngày cuối)', tpReturnHint: 'Trả phòng, thời gian dự phòng và đường về — đồng nhất với lượt đi.', tpDraftFromTrip: 'Nháp từ chuyến đi của bạn',
      // Trí tuệ điểm tham quan biểu tượng theo điểm đến
      topAttractionsTitle: 'Điểm tham quan hàng đầu cho nhóm bạn', topAttractionsSub: 'Các điểm biểu tượng nên đến, xếp hạng theo thành viên đi cùng — ghim để đưa vào kế hoạch.', researchingAttractions: 'Đang xếp hạng các điểm nên đến cho nhóm bạn…',
      forGroup: 'cho', teensLabel: 'thiếu niên', ticketed: 'Vé', pinToTrip: 'Ghim vào chuyến đi', tpaPinned: 'Đã ghim vào mục nên làm', tpaAlready: 'Đã ghim rồi',
      tier_very_high: 'Phải đến', tier_high: 'Lựa chọn hàng đầu', tier_medium: 'Đáng đi',
      fit_kids: 'Hợp trẻ em', fit_teens: 'Hợp thiếu niên', fit_seniors: 'Hợp người lớn tuổi', fit_all_ages: 'Mọi lứa tuổi', fit_adults: 'Người lớn',
      // Sự kiện + Điểm dừng + Chi phí (Đợt 1)
      tab_events: 'Sự kiện', tab_weather: 'Thời tiết', tab_stopovers: 'Khám phá', tab_costs: 'Chi phí',
      weatherTitle: 'Thời tiết & hành lý', weatherSub: 'Dự báo thật cho ngày của bạn (hoặc khí hậu trung bình mùa nếu còn xa) — kèm gợi ý mang gì.', findWeather: 'Xem thời tiết', refreshWeather: 'Cập nhật thời tiết', researchingWeather: 'Đang xem dự báo…', noWeatherYet: 'Chưa có thời tiết — nhấn để xem dự báo.', wxPackingTitle: 'Nên mang gì', wxSeasonalNote: 'Ngoài phạm vi dự báo trực tiếp — đang hiển thị thời tiết điển hình theo mùa.', wxSeasonalLabel: 'điển hình theo mùa (ước tính)', wxUnavailable: 'Chưa có dự báo — hãy kiểm tra gần ngày đi hơn.', wxRecOutdoor: 'Tuyệt cho hoạt động ngoài trời', wxRecIndoor: 'Nên có kế hoạch trong nhà', wxRecMixed: 'Thất thường — chuẩn bị phương án dự phòng',
      wxcond_clear: 'Quang đãng', wxcond_partly: 'Có mây', wxcond_cloudy: 'Nhiều mây', wxcond_fog: 'Sương mù', wxcond_drizzle: 'Mưa phùn', wxcond_rain: 'Mưa', wxcond_snow: 'Tuyết', wxcond_showers: 'Mưa rào', wxcond_storm: 'Giông bão',
      wxtip_pack_warm_layers: 'Áo ấm nhiều lớp — trời se lạnh', wxtip_pack_light_breathable: 'Quần áo nhẹ, thoáng', wxtip_pack_sun: 'Kem chống nắng, nón & kính', wxtip_pack_rain: 'Áo mưa hoặc dù', wxtip_pack_layers_swing: 'Mặc nhiều lớp — chênh lệch nhiệt độ ngày/đêm lớn', wxtip_pack_snow: 'Đồ đi tuyết & giày ấm', wxtip_pack_hydrate: 'Mang nước — giữ đủ nước',
      eventsTitle: 'Sự kiện trong chuyến đi', eventsSub: 'Sự kiện thật trong khoảng ngày của bạn — ghim vào kế hoạch. Đều là ước tính; không đặt gì.', findEvents: 'Tìm sự kiện (AI)', refreshEvents: 'Làm mới sự kiện', researchingEvents: 'Đang tìm sự kiện theo ngày của bạn…', noEventsYet: 'Nhấn “Tìm sự kiện” để xem có gì diễn ra trong chuyến đi.', eventPending: 'Chờ xác minh — kiểm tra ngày & giá', eventLiveOfficial: 'Trực tiếp · chính thức (Ticketmaster)', addToPlan: 'Thêm vào kế hoạch',
      stopoversTitle: 'Điểm dừng trên chặng dài', stopoversSub: 'Điểm dừng hợp lý để ăn, nghỉ, đổ xăng và ngắm cảnh trên chặng dài — theo nhịp của nhóm bạn.', findStopovers: 'Tìm điểm dừng (AI)', refreshStopovers: 'Làm mới điểm dừng', researchingStopovers: 'Đang lên điểm dừng cho chặng dài…', noStopoversYet: 'Không có chặng dài cần dừng — hoặc nhấn “Tìm điểm dừng”.',
      stoptype_meal: 'Bữa ăn', stoptype_rest: 'Điểm nghỉ', stoptype_gas: 'Xăng / sạc', stoptype_coffee: 'Cà phê', stoptype_attraction: 'Ghé nhanh', stoptype_scenic: 'Ngắm cảnh', stoptype_hotel: 'Nghỉ đêm', soAdd: 'Thêm điểm dừng', soAdded: 'Đã thêm', soOptional: 'Tùy chọn', soSkip: 'Bỏ qua', soAlternatives: 'Lựa chọn khác', soPending: 'Chờ xác minh',
      costsTitle: 'Ước tính chi phí chuyến đi', costsSub: 'Ước tính có thể chỉnh — không phải giá trực tiếp. Người tổ chức chỉnh giả định; mọi người đều xem được.', costEstTotal: 'Tổng (ước tính)', costPerFamilyAvg: 'Mỗi gia đình (TB)', costPerPerson: 'Mỗi người', costPerDay: 'Mỗi ngày', costPerPersonShort: 'người', costRangeLabel: 'Khoảng', costExpected: 'dự kiến', costByCategory: 'Theo hạng mục',
      costcat_transport: 'Di chuyển', costcat_stay: 'Lưu trú', costcat_activities: 'Hoạt động', costcat_food: 'Ăn uống', costcat_other: 'Khác',
      costSplitTitle: 'Chia tiền theo gia đình', costSplitMode: 'Cách chia', split_per_person: 'Theo đầu người', split_equal: 'Đều theo gia đình', split_per_family: 'Tùy chỉnh theo gia đình', split_owner_pays: 'Người tổ chức trả',
      costLedgerTitle: 'Ai trả / ai nợ', costLedgerEmpty: 'Chưa ghi nhận khoản nào.', costPaid: 'Đã trả', costMarkPaid: 'Đánh dấu đã trả', costWhoPaid: 'Ai trả', costLedgerTitlePh: 'Cho khoản gì (vd. khách sạn)', costAddPaid: 'Ghi khoản trả', costMisc: 'Khác',
      costAssumptions: 'Giả định chi phí (chỉnh)', costAsmFood: 'Ăn $/người/ngày', costAsmHotel: 'Khách sạn $/đêm', costAsmGas: 'Xăng $/dặm', costAsmTicket: 'Vé $/người', costAsmParking: 'Đỗ xe $/ngày', costAsmSnacks: 'Ăn vặt $/người/ngày', costAsmSouvenir: 'Quà $/gia đình',
      costDisclaimer: 'Ước tính dựa trên giả định có thể chỉnh — không phải giá trực tiếp. Xác nhận chi phí thực khi đặt.', costFuel: 'Xăng / lái xe', costHotel: 'Khách sạn / lưu trú', costTickets: 'Vé tham quan', costParking: 'Đỗ xe', costFood: 'Bữa ăn', costSnacks: 'Ăn vặt & cà phê', costSouvenirs: 'Quà lưu niệm', costBuffer: 'Dự phòng khẩn cấp',
      // Chia sẻ vị trí trực tiếp
      tab_live: 'Trực tiếp', ago: 'trước', liveTitle2: 'Vị trí nhóm trực tiếp', liveSub2: 'Chia sẻ vị trí tự nguyện trong chuyến đi. Chỉ thành viên thấy; tự hết hạn và bị xóa sau đó.',
      liveDemo: 'Vị trí trực tiếp dùng được trên chuyến đi đã lưu (không phải mẫu).', liveLoginNeeded: 'Đăng nhập để dùng vị trí trực tiếp.', liveOwnerOff: 'Người tổ chức chưa bật chia sẻ vị trí.', liveNoGeo: 'Không lấy được vị trí trên thiết bị/trình duyệt này.',
      liveEnableTrip: 'Bật chia sẻ vị trí chuyến đi', liveOff: 'Chia sẻ vị trí đang tắt. Người tổ chức có thể bật.', livePrivacy: 'Chỉ riêng thành viên chuyến đi — không công khai. Tự hết hạn và bị xóa sau chuyến đi; chỉ lưu vị trí mới nhất.',
      liveYouSharing: 'Bạn đang chia sẻ', liveExpires: 'hết hạn sau', liveStop: 'Ngừng chia sẻ', liveShareMine: 'Chia sẻ vị trí của bạn với nhóm:', liveShareTrip: 'Đến hết chuyến', liveShareToday: 'Trong hôm nay', liveShareHour: 'Trong 1 giờ', liveSharingOn: 'Đang chia sẻ vị trí', liveStopped: 'Đã ngừng chia sẻ',
      livestatus_on_the_way: 'Đang đến', livestatus_arrived: 'Đã đến', livestatus_delayed: 'Bị trễ', livestatus_break: 'Đang nghỉ',
      actFeedTitle: 'Hoạt động & cảnh báo chuyến đi', actNone: 'Hiện chưa có cảnh báo — cần bình chọn, nhắc đặt chỗ và thông báo đến nơi sẽ hiện ở đây.', actSuggested: '{who} đề xuất “{what}” — cần bình chọn', actBookReminder: 'Đặt {what} trước {when} — chưa đặt chỗ', actBookSoon: 'Đặt {what} — chưa đặt chỗ', actTaskMine: '{what} — giao cho bạn', actArrived: '{who} đã đến', actDelayed: '{who} bị trễ', actInApp: 'Cảnh báo trong ứng dụng — thông báo đẩy sắp ra mắt.',
      liveNavNext: 'Chỉ đường đến điểm kế', liveNavHotel: 'Chỉ đường đến khách sạn', liveGroup: 'Đang chia sẻ', liveNobody: 'Chưa ai chia sẻ — nhấn một tùy chọn ở trên.', liveMember: 'Thành viên', liveHere: 'ở đây', liveViewMap: 'Xem bản đồ', liveNavTo: 'Chỉ đường',
      // Trình tối ưu trải nghiệm
      improveTitle: 'Cải thiện chuyến đi bằng AI', improveSub: 'AI tối ưu dựa trên bình chọn, yêu thích & sở thích của nhóm — rồi gợi ý thay đổi cụ thể để bạn thêm.', improveWorking: 'Đang tìm cách làm chuyến đi tốt hơn…', improveNone: 'Hiện chưa có gợi ý — thử mục tiêu khác.',
      optimizeTrip: 'Tối ưu chuyến đi', optimizing: 'Đang dựng lại chuyến đi theo bình chọn của nhóm…', optimizeDone: 'Đã dựng lại chuyến đi theo bình chọn của nhóm', optimizeNudge: 'Bình chọn của nhóm đã thay đổi — tối ưu lại toàn bộ chuyến đi.', optimizeRebuildHint: 'Tạo lại lịch trình, ẩm thực, nơi ở, sự kiện, điểm dừng, di chuyển, chi phí & đặt chỗ theo tất cả bình chọn. Mục ghim & bỏ qua được giữ lại.',
      mem_title: 'Những gì chúng tôi ghi nhớ', mem_sub: 'Sở thích học được từ các chuyến đi trước — dùng để bắt đầu chuyến mới thông minh hơn.', mem_cuisines: 'Ẩm thực bạn thích', mem_liked: 'Địa điểm bạn thích', mem_never: 'Không gợi ý lại', mem_transport: 'Phương tiện ưa thích', mem_budget: 'Ngân sách thường dùng', mem_pace: 'Nhịp độ thường dùng', mem_trips: 'Số chuyến đã ghi nhớ', mem_clear: 'Xóa bộ nhớ', mem_cleared: 'Đã xóa bộ nhớ du lịch',
      nightOne: 'đêm', nightMany: 'đêm',
      // Trình tạo hành trình bằng ngôn ngữ tự nhiên
      nlSectionTitle: 'Nói với AI chính xác điều bạn muốn', nlSectionHint: 'Mô tả chuyến đi bằng lời của bạn — ngày tháng, ai lái xe, kế hoạch cố định. AI sẽ tạo một hành trình bạn có thể chỉnh sửa.', nlPlaceholder: 'Ví dụ: Ngày 1/7 đi Xe Đò Hoàng từ San Jose đến Orange County, rồi Michael chở chúng tôi đến San Diego. Ngày 2/7 đi Sở thú San Diego. Sáng 3/7 ở San Diego, rồi về Orange County ăn món Việt. Ngày 4/7 đi Xe Đò Hoàng về nhà.', nlBuildBtn: 'Tạo hành trình từ ghi chú của tôi', nlOrDivider: 'hoặc tạo từng bước', nlBuilding: 'Đang đọc kế hoạch và dựng hành trình…', nlParseFail: 'Tôi chưa hiểu thành hành trình — hãy thêm ngày và điểm dừng rồi nhấn Tạo lại.', nlReviewTitle: 'Đây là điều tôi hiểu', nlReviewSub: 'Xem lại và chỉnh sửa. Khóa 🔒 những gì cố định — AI sẽ lên kế hoạch quanh đó và bổ sung phần còn lại.', nlFixedReqs: 'Bạn đã cố định', nlFlexWindows: 'AI sẽ gợi ý', nlQuestions: 'Vài điều cần xác nhận', nlConfirmBtn: 'Ổn rồi — thêm người tham gia', nlEditManual: 'Tinh chỉnh từng bước', nlReparse: 'Sửa ghi chú', nlAddAfter: 'Thêm sau', nlAddStop: 'Thêm một bước', nlLockSeg: 'Khóa', nlUnlockSeg: 'Mở khóa', nlLocked: 'Đã khóa', nlFlexMark: 'Linh hoạt', nlFlexOn: 'AI gợi ý', nlNeedsResearch: 'Cần tra lịch', nlNeedsBooking: 'Cần đặt chỗ', nlResearchLink: 'Tra lịch trình', nlResearchQuery: 'lịch trình', nlRequestRide: 'Yêu cầu xe DuLichCali', nlSegTitle: 'Việc gì', nlSegTitlePh: 'vd: Sở thú San Diego', nlSegDate: 'Ngày', nlSegTime: 'Giờ', nlSegFrom: 'Từ', nlSegTo: 'Đến', nlSegMode: 'Bằng cách', nlNoDate: 'Chưa có ngày', nlFoodExperience: 'Trải nghiệm ẩm thực địa phương',
      nlSegType_transport: 'Di chuyển', nlSegType_transfer: 'Trung chuyển / đưa đón', nlSegType_stay: 'Nghỉ qua đêm', nlSegType_activity: 'Hoạt động', nlSegType_food: 'Ẩm thực', nlSegType_free_time: 'Thời gian tự do', nlSegType_return: 'Về nhà',
      nlmode_car: 'Xe nhà', nlmode_bus: 'Xe buýt', nlmode_private_ride: 'Xe riêng', nlmode_flight: 'Máy bay', nlmode_train: 'Tàu hỏa', nlmode_walk: 'Đi bộ', nlmode_other: 'Khác',
      nlYourRoute: 'Lộ trình bạn đã khóa', nlCarAlt: 'Phương án xe riêng', nlRouteFail: 'Chúng tôi chưa áp dụng được lộ trình bắt buộc của bạn. Vui lòng xem lại hành trình đã trích xuất bên dưới.',
      journeyLabel: 'Hành trình của bạn', journeyHint: 'Thêm từng điểm dừng với ngày bạn muốn ở đó. Chúng tôi lo phương tiện, khách sạn và lịch trình từng ngày trong các điểm dừng của bạn.', addSegment: 'Thêm điểm dừng', arrivalDate: 'Ngày đến', departureDate: 'Ngày đi', sameDay: 'Trong ngày', segTransportDetails: 'Phương tiện & chi tiết (tùy chọn)', howArrive: 'Cách bạn đến {city}', preferredProvider: 'Nhà cung cấp ưu tiên', providerPh: 'vd: Xe Đò Hoàng, Michael', overnightStay: 'Nghỉ qua đêm ở đây', segNotesPh: 'vd: đến từ điểm trả khách của xe', homeOrigin: 'Nhà', viaLabel: 'bằng', viaAI: 'AI chọn cách tốt nhất', thisStop: 'điểm này', returnTransport: 'Về nhà', journeyEmpty: 'Thêm điểm dừng đầu tiên để xem hành trình', homeBy: 'về', quickEntry: 'Nhập nhanh — một khoảng ngày cho cả chuyến', quickEntryHint: 'Tùy chọn. Chỉ dùng khi bạn để trống ngày từng điểm — AI sẽ chia số đêm.', tp_any: 'AI quyết định', tp_bus: 'Xe buýt', tp_private_ride: 'Xe riêng', tp_flight: 'Máy bay', tp_car: 'Xe nhà', tp_train: 'Tàu hỏa', segRideBooked: 'Đã đặt xe', segRidePending: 'Xe đang chờ',
      impGeneral: '✨ Cải thiện chuyến đi', impDiscoveries: '💎 Tìm thêm khám phá', impLowerCost: '💲 Giảm chi phí', impKidsFun: '🧒 Vui hơn cho trẻ', impFoodFocused: '🍽 Tập trung ẩm thực',
      impSelected: 'Đã chọn {n}', impRun: 'Chạy cải thiện AI', impClear: 'Xóa tất cả',
      rejVote: 'Đã bỏ — cả nhóm bình chọn bỏ qua', rejMajority: 'Đã bỏ — đa số gia đình bình chọn bỏ qua', rejNotNeeded: 'Đã bỏ — đánh dấu không cần',
      impcat_activity: 'Hoạt động', impcat_food: 'Ẩm thực', impcat_stopover: 'Điểm dừng', impcat_timing: 'Thời gian', impcat_backup: 'Dự phòng', impcat_cheaper: 'Tiết kiệm hơn', impcat_exciting: 'Thú vị hơn', impcat_low_energy: 'Nhẹ nhàng', impcat_discovery: 'Khám phá',
    },
    es: {
      backHome: '← Volver a Du Lich Cali',
      heroChip: 'Concierge de Viajes Grupales AI', heroTitle: 'Tu agente de viajes AI para familias y amigos.',
      heroSub: 'Dinos quién viaja, a dónde quieres ir y qué disfrutas. La IA descubre las mejores experiencias, compara cómo llegar, recomienda dónde alojarte y crea un plan compartido que todo tu grupo puede votar.',
      heroFreeNote: 'Gratis para empezar · mira un ejemplo completo, sin cuenta · tu plan está listo en aproximadamente un minuto.', heroTrySample: 'Mira primero un ejemplo', demoMeta: '{f} familias · {d} días',
      liveSampleBadge: 'Ejemplo en vivo', whyFits: 'Por qué encaja con tu grupo', sampleMoreNote: 'El plan completo incluye mapas, comida, reservas y un plan de llegada sincronizado para cada familia.', seeFullSample: 'Ver el ejemplo completo', otherSamples: 'O prueba otro',
      start: 'Crear el plan de mi grupo', step: 'Paso', of: 'de', day: 'Día', watchClip: 'Ver clip',
      // Landing — Who/Where/What band
      wwwTitle: 'Dinos 3 cosas — la IA hace la tarea', www_who: 'QUIÉN viaja', www_who_d: 'Familias, niños, adolescentes, mayores — planeamos pensando en todos.', www_where: 'A DÓNDE quieres ir', www_where_d: 'Una ciudad o un viaje con varias paradas.', www_what: 'QUÉ disfrutas', www_what_d: 'Comida, playas, parques temáticos, cultura, joyas ocultas.', wwwDo: 'La IA hace la tarea — experiencias, hoteles, transporte, horario y costos.',
      // Landing — How it works
      hiwTitle: 'Cómo funciona', hiw1: 'Dile a la IA quién viaja', hiw1d: 'Agrega cada familia — niños, adolescentes, mayores, comida, presupuesto y ritmo.', hiw2: 'La IA descubre las mejores experiencias', hiw2d: 'Atracciones, comida, eventos, joyas ocultas, alojamiento y opciones de transporte.', hiw3: 'Las familias votan y optimizan juntas', hiw3d: 'Todos votan 👍🤔👎❤️ y la IA reoptimiza el plan.', hiw4: 'Viaja con mapas compartidos, alertas y recuerdos', hiw4d: 'Mapa grupal en vivo, alertas de llegada, un álbum compartido y clips de IA.',
      // Landing — Agent capability cards
      capTitle: 'Lo que hace tu agente de viajes AI', capSub: 'Diez maneras en que el concierge hace la tarea por tu grupo.',
      cap_family: 'Planificación multifamiliar', cap_family_d: 'Planea según los niños, adolescentes, mayores, presupuesto y ritmo de cada familia.',
      cap_experiences: 'Mejores experiencias', cap_experiences_d: 'Experiencias memorables y aptas para familias — no solo una lista de lugares.',
      cap_discover: 'Atracciones, comida y eventos', cap_discover_d: 'Restaurantes, platos populares, eventos en vivo, joyas ocultas y paradas en ruta.',
      cap_transport: 'Comparación de transporte', cap_transport_d: 'Auto, vuelo, Hoàng Bus y viajes DuLichCali — tiempo, costo y para quién es mejor.',
      cap_stay: 'Inteligencia de alojamiento', cap_stay_d: 'La mejor zona más hoteles y Airbnb por presupuesto, aptitud familiar y ubicación.',
      cap_vote: 'Votación grupal', cap_vote_d: 'Cada familia vota 👍🤔👎❤️ — lo omitido no vuelve.',
      cap_optimize: 'La IA sigue mejorando', cap_optimize_d: 'Reoptimiza para niños, comida, menor costo, menos conducción y más.',
      cap_live: 'Mapas en vivo y alertas', cap_live_d: 'Mapa grupal opcional, tiempos de llegada y alertas de llegada/retraso durante el viaje.',
      cap_album: 'Álbum y Clips IA', cap_album_d: 'Un álbum compartido más un paquete de clip social con IA — descripciones y publicaciones.',
      cap_costs: 'Costos del viaje compartidos', cap_costs_d: 'Estimaciones totales, por familia y por persona, por categoría.',
      // Landing — Trust
      trustTitle: 'Creado por Du Lich Cali', trustSub: 'Experiencia de viajes vietnamita-americana para familias y amigos.', trust_noprice: 'Sin precios falsos', trust_nobooking: 'Sin reservas falsas', trust_nophotos: 'Sin fotos de atracciones o restaurantes generadas por IA', trustNote: 'Las estimaciones están claramente etiquetadas; las fotos reales provienen de Google Places y Wikipedia.',
      // Onboarding — optional details
      moreOptional: 'Más detalles (opcional)', moreOptionalHint: 'La IA usa valores predeterminados inteligentes — presupuesto Moderado, ritmo equilibrado. Cámbialos cuando quieras.',
      // Immersive hero showcase
      heroShowcaseLead: 'La IA descubre…', disc_attractions: 'Atracciones', disc_beaches: 'Playas', disc_restaurants: 'Restaurantes', disc_gems: 'Joyas ocultas', disc_events: 'Eventos locales', disc_themeparks: 'Parques temáticos', disc_hotels: 'Hoteles', disc_transport: 'Opciones de transporte', disc_voting: 'Votación grupal', disc_livemap: 'Mapas en vivo', disc_clips: 'Clips IA',
      disc_sealife: 'Fauna y lobos marinos', disc_nature: 'Naturaleza y parques', disc_nightlife: 'Vida nocturna y shows', disc_icons: 'Lugares icónicos', discoverTitle: 'La IA descubre tu viaje', discoverSub: 'Lugares reales, experiencias reales — para tu grupo.',
      // Capability card examples
      cap_family_ex: 'ej. equilibra Disneyland para los de 6 años con un tour en kayak para adolescentes', cap_experiences_ex: 'ej. un crucero por la bahía que toda la familia recuerda', cap_discover_ex: 'ej. un sitio de phở en Little Saigon que no hallarías solo', cap_transport_ex: 'ej. Hoàng Bus + un viaje DuLichCali gana a 7 horas de auto', cap_stay_ex: 'ej. una suite familiar cerca de la playa o de los parques', cap_vote_ex: 'ej. el grupo omite el museo y la IA pone el zoológico', cap_optimize_ex: 'ej. “más barato” recorta $300 sin perder lo mejor', cap_live_ex: 'ej. todos ven quién llegó al hotel', cap_album_ex: 'ej. un reel resumen del viaje listo para publicar', cap_costs_ex: 'ej. cada familia ve su parte, por categoría',
      // Popular destination showcase
      showcaseTitle: 'Viajes populares para planear', showcaseSub: 'Toca uno y la IA investiga el viaje real para tu grupo — son solo ideas, nada se impone.', bestForLabel: 'Ideal para', planThisTrip: 'Planear este viaje', showcaseNote: 'Solo ejemplos — la IA planea cada viaje desde cero según quién viaja, cuándo y qué disfrutan.',
      dest_sandiego_best: 'Familias, playas y animales', dest_oc_best: 'Parques temáticos y comida de Little Saigon', dest_sf_best: 'Íconos, vistas de la bahía y cultura', dest_vegas_best: 'Espectáculos, el Strip y excursiones', dest_la_best: 'Cine, estrellas y la costa', dest_yosemite_best: 'Naturaleza, senderos y grandes vistas',
      ctaBandTitle: 'Tu próximo viaje, diseñado por IA', ctaBandSub: 'Dinos quién, dónde y qué te encanta — recibe un plan compartido y reservable en aproximadamente un minuto.',
      createTitle: 'Crea tu viaje grupal', groupName: 'Nombre del viaje / grupo', destination: 'Destino',
      dates: 'Fechas de viaje', departureCity: 'Zona principal de salida', numFamilies: '¿Cuántas familias / grupos?',
      tripStyle: 'Ritmo del viaje', budget: 'Presupuesto general', createBtn: 'Siguiente: añadir familias',
      style_relaxed: 'Relajado', style_balanced: 'Equilibrado', style_packed: 'Intenso',
      budget_budget: 'Económico', budget_moderate: 'Moderado', budget_luxury: 'Lujo',
      familiesTitle: '¿Quiénes van?', familySub: 'Añade cada familia — edades y necesidades moldean el plan.',
      familyName: 'Nombre de familia / grupo', adults: 'Adultos', childrenAges: 'Edades de niños (separadas por comas)',
      seniors: 'Personas mayores', foodPrefs: 'Preferencias de comida', interests: 'Intereses de actividades',
      accessibility: 'Necesidades de accesibilidad', napNeeds: 'Necesidades de descanso', roomNeeds: 'Necesidades de habitación',
      addFamily: 'Añadir otra familia', removeFamily: 'Quitar',
      transportTitle: '¿Cómo llegará esta familia?', method: 'Medio de transporte',
      m_car: 'Auto', m_plane: 'Avión', m_bus: 'Autobús', m_other: 'Otro',
      origin: 'Ciudad / dirección de salida', travelers: 'Viajeros', departureWindow: 'Salida preferida',
      arrivalDeadline: 'Hora límite de llegada', luggage: 'Necesidades de equipaje', carSeat: 'Silla para niño',
      numCars: 'Número de autos', transportBudget: 'Presupuesto de transporte',
      childrenLabel: 'Niños', totalTravelers: 'Total de viajeros', overrideTravelers: 'Anular número de viajeros', travelerMismatch: 'El conteo manual difiere del total automático ({auto}).', carSuggest: 'La IA sugiere {n} auto(s) para {t} viajeros', suvNote: 'Con un bebé + equipaje, se recomienda un SUV o minivan.', groundTransport: 'Transporte en el destino', gt_rental_car: 'Auto de alquiler', gt_uber_lyft: 'Uber / Lyft', gt_pickup: 'Recogida', gt_shuttle: 'Shuttle',
      prefsTitle: 'Ajusta el plan', prefsSub: 'Dile a la AI qué importa más.',
      pace: 'Ritmo', kidPriority: 'Prioridad niños', foodiePriority: 'Prioridad gastronómica',
      photoPriority: 'Lugares para foto / video', minDriving: 'Minimizar conducción', hiddenGems: 'Incluir joyas ocultas',
      freeActivities: 'Incluir actividades gratis', reservationActivities: 'Incluir lugares con reserva',
      backupPlans: 'Incluir planes de respaldo', generate: 'Generar plan con AI',
      generating: 'Diseñando tu viaje grupal…', genFail: 'La AI está ocupada — aquí tienes un plan de muestra editable.',
      tab_overview: 'Resumen', ovReadyShort: 'listo', ovNext: 'Siguiente', ovAllSet: 'Todo listo', ovFamilies: 'familias',
      ovHighlights: 'Lo más destacado', ovSeeAll: 'Ver todo', ovTimeline: 'Tus días', ovViewItinerary: 'Ver itinerario completo',
      ovDiscoveries: 'Descubrimientos IA', ovConcierge: 'Pregunta al concierge', ovCuratingHighlights: 'La IA está seleccionando lo más destacado…', ovQuickLinks: 'Ir a',
      ovChipStay: 'Alojamiento', ovChipTransport: 'Transporte', ovChipTickets: 'Entradas', ovChipFood: 'Comida',
      ovAskOptimize: 'Optimizar mi plan', ovAskGems: 'Encontrar joyas ocultas', ovAskBook: '¿Qué debo reservar ahora?',
      season_spring: 'Primavera', season_summer: 'Verano', season_fall: 'Otoño', season_winter: 'Invierno',
      tab_days: 'Días', tab_tasks: 'Tareas', tab_more: 'Más', moreNavTitle: 'Todas las secciones', continuePlanning: 'Seguir planeando',
      navTrips: 'Viajes', navConcierge: 'Concierge IA', navShare: 'Compartir', navProfile: 'Perfil', mustSee: 'Imprescindible', topPick: 'Top',
      ovToDo: 'por hacer', ovDone: 'hecho', ovTotalLc: 'total', ovFamilyLc: 'familia', ovEstimated: 'Estimado', ovRemaining: 'Restante',
      ovMemories: 'Recuerdos', ovAddToTrip: 'Añadir al viaje', ovReplace: 'Reemplazar', ovReplaceCmd: 'Añade {name} al viaje y cambia un lugar similar de menor prioridad',
      tab_itinerary: 'Itinerario', tab_arrival: 'Plan de Llegada', tab_group: 'Grupo',
      tab_journey: 'Recorrido', journeyTitle: 'Tu recorrido', journeySub: 'Cada parada, alojamiento y viaje como un nodo. Bloquea lo que te gusta 🔒 — la IA solo replanifica alrededor.', jnNoPlan: 'Genera el viaje primero — tu línea de tiempo aparecerá aquí.', jnLock: 'Bloquear', jnUnlock: 'Desbloquear', jnLocked: 'Bloqueado', jnImprove: 'Mejorar alrededor de esto', jnImproving: 'Replanificando este día (manteniendo lo bloqueado)…', jnAddAfter: 'Agregar después', jnReplanDay: 'Replanificar este día', jnReplanKeep: 'mantiene 🔒 bloqueado', jnReplanned: 'Día replanificado — se mantuvo lo bloqueado', jnTransportNode: 'Transporte', jnViewTransport: 'Comparar transporte', jnNodeMenu: 'Opciones', jnAddPh: 'Agregar un lugar / actividad', jnAdd: 'Agregar',
      cmdPh: 'Dile al concierge qué cambiar…', cmdGo: 'Preguntar a la IA', cmdBusy: 'Entendiendo tu solicitud…', cmdPlanTitle: 'Esto es lo que cambiaré', cmdNone: 'No pude convertirlo en una edición — reformula (ej. “omite el zoológico”, “agrega Disneyland día 2”, “busca otra cena vietnamita”).', cmdFail: 'No se pudo interpretar ahora — inténtalo de nuevo.', cmdDays: 'Replanifica el día {d}', cmdApply: 'Aplicar cambios', cmdApplied: 'Viaje actualizado', cmdCancel: 'Cancelar',
      cmdop_skip: 'Omitir', cmdop_delete: 'Quitar', cmdop_lock: 'Bloquear', cmdop_unlock: 'Desbloquear', cmdop_replace: 'Reemplazar', cmdop_add: 'Agregar', cmdop_retime: 'Reprogramar', cmdop_replan_day: 'Replanificar', cmdop_stay_extra_night: 'Quedarse otra noche', cmdop_leave_earlier: 'Salir antes', cmdop_change_return: 'Cambiar regreso',
      rideBookingTitle: 'Viaje DuLichCali', rideBookedToast: 'Viaje reservado y agregado a tu trip', rideRequestedToast: 'Viaje solicitado — pendiente de confirmación', rideNotCompleted: 'Reserva de viaje no completada — no se agregó nada. Puedes intentarlo de nuevo.', rideBookedNote: 'Viaje DuLichCali reservado', rideRequestedNote: 'Viaje DuLichCali solicitado', rideRequestMichael: 'Solicitar viaje con Michael', rideBookDlc: 'Reservar con DuLichCali', rideViewRequest: 'Ver solicitud', rideModifyRequest: 'Modificar solicitud', rideCancelRequest: 'Cancelar solicitud', rideViewTitle: 'Tu solicitud de viaje', rideRouteLabel: 'Ruta', ridePassengers: 'Pasajeros', rideCancelledNote: 'Solicitud de viaje cancelada', rideCancelledToast: 'Solicitud de viaje cancelada — puedes solicitarla de nuevo cuando quieras', rideModifyNote: 'MODIFICADA — reemplaza la solicitud #{id}; cancela la reserva anterior',
      groupTravelersTitle: 'Quiénes viajan', travelersAdults: 'adultos', travelersEdit: 'Editar viajeros',
      summary: 'Resumen del viaje', assumptions: 'Supuestos', warnings: 'Bueno saber',
      costRange: 'Costo estimado', meetup: 'Punto de encuentro', regenDay: 'Regenerar día',
      whySelected: 'Por qué lo elegimos', bestTime: 'Mejor hora', duration: 'Tiempo aquí', parking: 'Estacionamiento',
      kidFriendly: 'Apto para niños', walking: 'Caminata', cost: 'Costo', details: 'Detalles', replace: 'Reemplazar',
      mapG: 'Google Maps', mapA: 'Apple Maps', website: 'Sitio web', reserve: 'Reservar', ticket: 'Boletos',
      backup: 'Respaldo cercano', tips: 'Consejos', close: 'Cerrar',
      walk_low: 'Poca caminata', walk_medium: 'Algo de caminata', walk_high: 'Mucha caminata',
      pending: 'Pendiente de verificación', unverified: 'Sugerencia AI — verifica antes de reservar',
      vote: 'Votar', v_like: 'Me gusta', v_maybe: 'Quizás', v_skip: 'Omitir', save: 'Guardar', saved: 'Guardado',
      cons_loved: 'Grupo ❤', cons_liked: 'Al grupo le gusta', cons_mixed: 'Mixto', cons_skip: 'El grupo omite', sortedByVotes: 'Ordenado por los votos de tu grupo',
      tab_album: 'Álbum', tab_clips: 'Clips IA',
      albumTitle: 'Álbum del viaje', albumSub: 'Comparte fotos y videos del viaje por enlace — etiqueta, marca favoritos y elige los mejores para un clip de IA. Lo privado sigue privado.', albumDemo: 'El álbum se abre cuando creas un viaje real.', albumEmpty: 'Aún no hay nada — añade un enlace de foto/video para empezar tu álbum.', albumAdd: 'Añadir foto/video', albumAddHint: 'Pega una URL de foto/video o un enlace de álbum compartido (Google Photos, Amazon Photos, etc.). Solo enlaces por ahora — sin subir archivos.', albumUrl: 'Enlace de foto / video / álbum', albumUrlPh: 'https://… (URL de imagen o enlace de álbum compartido)', albumCaption: 'Descripción', albumCaptionPh: 'Una descripción breve', albumPlace: 'Lugar', albumPlacePh: '¿Dónde fue esto?', albumNoDay: 'Sin día específico', albumVisibility: 'Quién puede verlo', albumAddBtn: 'Añadir al álbum', albumAdded: 'Añadido al álbum', albumOpen: 'Abrir', albumLink: 'Enlace', albumFav: 'Favorito', albumSelect: 'Usar en clip', albumPrivacyNote: 'Solo los miembros del viaje pueden ver el álbum. Los elementos privados solo los ven tú y el organizador. Nada se publica en ningún sitio.',
      vis_group: 'Todos los miembros', vis_private: 'Solo yo', vis_selected_only: 'Solo si se elige para un clip',
      clipsTitle: 'Clips sociales con IA', clipsSub: 'La IA crea un paquete listo para grabar (guion gráfico, descripciones, locución, hashtags, publicaciones por plataforma) a partir de los archivos que elijas. Nunca renderiza ni publica un video.', clipsSelectHint: '{n} elementos seleccionados — marca "Usar en clip" en los elementos del álbum para incluirlos.', clipsNeedSelect: 'Elige al menos un elemento del álbum primero (Usar en clip).', clipNeedConsent: 'Confirma primero el consentimiento para usar los elementos seleccionados.', clipPlatform: 'Plataforma', clipMood: 'Tono', clipLength: 'Duración', clipConsent: 'Confirmo que todos en las fotos/videos seleccionados están de acuerdo con su uso. Los elementos privados nunca se usan a menos que yo los elija.', clipGenerate: 'Crear paquete de clip', clipWorking: 'Creando tu paquete de clip…', clipFail: 'No se pudo crear el paquete ahora — inténtalo de nuevo.', clipStoryboard: 'Guion gráfico', clipVoiceover: 'Guion de locución', clipOverlays: 'Texto en pantalla', clipHashtags: 'Hashtags', clipExportNote: 'Este es un paquete de exportación para tu editor / herramienta de video social — aquí no se renderiza ni se publica ningún video.',
      clipPost_tiktok: 'TikTok', clipPost_instagram: 'Instagram', clipPost_youtube: 'YouTube', clipPost_facebook: 'Facebook',
      clipmood_fun: 'Divertido', clipmood_cinematic: 'Cinematográfico', clipmood_heartfelt: 'Emotivo', clipmood_energetic: 'Enérgico',
      cliplen_short: 'Corto (~15–30 s)', cliplen_medium: 'Medio (~30–60 s)', cliplen_long: 'Largo (1–3 min)',
      youAre: 'Eres:', pickFamilyHint: 'Elige tu familia arriba para votar.',
      suggestionsTitle: 'Sugerencias del grupo', addSuggestion: 'Sugiere un lugar o actividad', suggestionPh: 'ej. Cena al atardecer en el muelle', suggest: 'Añadir', suggestedBy: 'por', noSuggestions: 'Aún no hay sugerencias — ¡añade una!',
      booking: 'Reserva', b_not_needed: 'No necesaria', b_needed: 'Necesaria', b_booked: 'Reservado', b_skipped: 'Omitido',
      markBooked: 'Marcar reservado', markArrived: 'Marcar llegada', completed: 'Listo',
      recDeparture: 'Salida recomendada', eta: 'Llegada estimada', route: 'Ruta', restStops: 'Paradas',
      ticketSearch: 'Buscar boletos', status: 'Estado', st_planning: 'Planeando', st_booked: 'Reservado',
      st_on_the_way: 'En camino', st_arrived: 'Llegó', notes: 'Notas', addNote: 'Añadir nota de grupo', send: 'Enviar',
      shareTitle: 'Comparte este viaje', shareSub: 'Los familiares inician sesión con su teléfono para ver, votar y sugerir.',
      copyLink: 'Copiar enlace', copied: '¡Enlace copiado!', viewOnly: 'Viaje compartido (ver y votar)',
      newTrip: 'Nuevo viaje', editTrip: 'Editar viaje',
      required: 'Completa los campos obligatorios.',
      // Login + live research
      loginTitle: 'Inicia sesión para ver este viaje', loginSub: 'Usa tu número de teléfono para ver el plan y para votar, sugerir y elegir con tu familia.',
      signIn: 'Iniciar sesión', signUp: 'Crear cuenta', phone: 'Número de teléfono', password: 'Contraseña',
      passwordHelp: '¿Primera vez? Elige una contraseña (mínimo 8 caracteres) para crear tu cuenta.',
      authFailed: 'Error al iniciar sesión. Revisa tu teléfono y contraseña.', needAccount: '¿Primera vez? Crea una cuenta', haveAccount: '¿Ya tienes cuenta? Inicia sesión', logout: 'Cerrar sesión',
      logInExisting: 'Inicia sesión en tu cuenta', myTrips: 'Tus viajes', noTripsYet: 'Aún no hay viajes guardados — crea uno arriba.', resumeHint: 'Toca un viaje para seguir planeando.',
      dashTitle: 'Mis viajes', tcBrand: 'Concierge de Viajes', backToMyTrips: '← Mis viajes', createNewTrip: '+ Crear nuevo viaje', editTripBtn: 'Editar', deleteTripBtn: 'Eliminar', openTripBtn: 'Abrir', moreActions: 'Más', ownedSection: 'Viajes que tienes', joinedSection: 'Viajes a los que te uniste', lastUpdated: 'Actualizado', neverUpdated: 'Borrador', delConfirmTitle: '¿Eliminar este viaje?', delConfirmBody: 'Esto oculta el viaje de tu lista y desactiva su enlace y código de acceso. Los participantes pierden el acceso.', delConfirmYes: 'Eliminar viaje', cancelBtn: 'Cancelar', tripDeleted: 'Viaje eliminado', deleting: 'Eliminando…', dashLoginPrompt: 'Inicia sesión para ver y administrar tus viajes.', moreSheetTitle: 'Acciones del viaje',
      researching: 'Buscando lo más destacado actual…',
      liveTitle: '🔥 Tendencia y de temporada ahora', liveSub: 'Selecciones en vivo para tus fechas — eventos, vistas de temporada y lugares populares.',
      sampleReadonly: 'Esto es una muestra. Crea tu propio viaje para votar y sugerir.',
      // Phase 1 — richer questionnaire + multi-destination
      style_luxury: 'Lujo', style_budget: 'Económico',
      grpInterests: 'Intereses de actividades', grpFood: 'Preferencias de comida', grpHotel: 'Preferencias de hotel', grpKids: 'Niños', grpTeens: 'Adolescentes', grpSeniors: 'Personas mayores', foodOther: 'Otras cocinas / notas',
      destinations: 'Destinos', addDestination: 'Añadir destino', removeDestination: 'Quitar destino', moveUp: 'Subir', moveDown: 'Bajar',
      legStart: 'Fecha de inicio', legEnd: 'Fecha de fin', hotelName: 'Nombre del hotel', hotelArea: 'Zona del hotel', hotelNotes: 'Notas del hotel', moreDetailsOptional: 'Más detalles (opcional)',
      hotelStatus: 'Estado del hotel', hs_planning: 'Planeando', hs_researching: 'Investigando', hs_booked: 'Reservado',
      travelDay: 'Día de viaje', driveTime: 'Tiempo de conducción', distance: 'Distancia', departFrom: 'Salida', arriveAt: 'Llegada', mealStops: 'Paradas para comer', restStopsLabel: 'Paradas de descanso',
      routeOverviewTitle: 'Ruta', totalDriveTime: 'Tiempo total de conducción', totalDistance: 'Distancia total', leg: 'Tramo', legPending: 'Los detalles de esta parada llegarán pronto.', dayOpen: 'Día libre — pide a la IA que planifique este día',
      learnMore: 'Más información', lmLoading: 'Buscando enlaces útiles…', lmVerify: 'verificar', lmWhy: 'Por qué lo recomendamos', lmGroupFit: 'Ideal para el grupo', lmBestTime: 'Mejor momento', lmTimeNeeded: 'Tiempo necesario', lm_official_site: 'Sitio oficial', lm_menu: 'Menú', lm_ticket: 'Entradas', lm_google_reviews: 'Reseñas de Google', lm_yelp_reviews: 'Reseñas de Yelp', lm_tripadvisor: 'Tripadvisor', lm_youtube_search: 'Buscar videos en YouTube', lm_tiktok: 'Buscar en TikTok', lm_photos: 'Fotos', lm_map: 'Mapa', lm_blog_guide: 'Guía de viaje', lmParking: 'Estacionamiento', lmWalking: 'Caminata', lmWaitTime: 'Tiempo de espera', lmSafety: 'Seguridad', lmWeather: 'Plan por clima',
      popularDishesLabel: 'Platos populares', altTitle: 'Alternativas y respaldos', alt_kidFriendly: 'Para niños', alt_toddlerLowEnergy: 'Bebé / tranquilo', alt_teenOption: 'Opción para teens', alt_seniorLowWalking: 'Mayores / poca caminata', alt_rainyDay: 'Día lluvioso', alt_foodBackup: 'Restaurante alterno',
      routeVerifiedTag: 'Distancias vía Google Maps', routeEstimatedTag: 'Distancias estimadas', driveHome: 'Conducir a casa',
      dt_arrival_day: 'Llegada', dt_transfer_day: 'Viaje', dt_return_day: 'Regreso', dt_mixed_day: 'Mixto',
      mustDoTitle: 'Actividades imprescindibles (opcional)', pinnedHint: 'Fija actividades que ya quieres — la IA planifica alrededor de ellas.', addPinned: 'Añadir actividad imprescindible', pinnedActivity: 'Actividad', pinnedTitlePh: 'ej. Zoológico de San Diego', anyDestination: 'Cualquier destino', preferredDay: 'Día preferido', preferredTime: 'Hora preferida', flexible: 'Flexible', priority: 'Prioridad', pinnedBookingNote: 'Imprescindible — reserva entradas/mesa con antelación',
      tod_flexible: 'Flexible', tod_morning: 'Mañana', tod_lunch: 'Almuerzo', tod_afternoon: 'Tarde', tod_dinner: 'Cena', tod_evening: 'Noche', prio_required: 'Requerido', prio_preferred: 'Preferido', prio_optional: 'Opcional',
      hotelsTitle: 'Hoteles', researchHotels: 'Buscar hoteles', fatigueNote: 'Fatiga', napNote: 'Hora de siesta', seniorNote: 'Nota para mayores',
      genSkeleton: 'Trazando tu ruta…', genLeg: 'Planeando cada parada…', genLegOf: 'Planeando parada {n} de {total}…',
      // Travel Booking Concierge
      tab_bookings: 'Tareas', bookingsTitle: 'Tareas del viaje', bookingsSub: 'Qué reservar, confirmar y pagar para este viaje.',
      bookingApprovalNotice: 'La IA solo investiga y prepara opciones — nunca compra, cobra tu tarjeta ni guarda números de tarjeta. Tú completas el pago en la página oficial.',
      researchBookings: 'Buscar opciones (IA)', rebuildChecklist: 'Recrear desde el itinerario', addBooking: 'Añadir reserva', noBookings: 'Aún no hay reservas — busca opciones o añade una.',
      tdealsTitle: 'Ofertas de entradas', tdealsSub: 'Formas en que tu grupo puede pagar menos en atracciones de pago — investigadas, nunca compradas automáticamente.', tdealsFind: 'Buscar ofertas de entradas', tdealsRefresh: 'Actualizar ofertas', tdealsResearching: 'Buscando ofertas de entradas…', tdealsNone: 'No se encontraron ofertas claras por ahora', tdealsNoTickets: 'Aún no hay atracciones con entrada — clasifica las atracciones primero (Destacados).', tdealsEmpty: 'Aún no hay ofertas de entradas.', tdealSave: 'ahorra', tdealBookBy: 'compra', tdealOfficial: 'Entradas oficiales', tdealSearch: 'Comparar ofertas', tdeal_multi_day: 'Pase de varios días', tdeal_family_bundle: 'Paquete familiar', tdeal_early_bird: 'Anticipada', tdeal_combo: 'Combo / paquete', tdeal_membership: 'Membresía', tdeal_group: 'Tarifa de grupo', tdeal_free_day: 'Día gratis / descuento', tdeal_resident: 'Descuento de residente', tdeal_military_senior_student: 'Militar / mayor / estudiante', tdeal_other: 'Oferta',
      researchingBookings: 'Buscando entradas y reservas por hacer…', conciergeWorking: 'Tu concierge de IA está haciendo la tarea — hoteles, comida y reservas se están cargando.', refreshResearch: 'Actualizar',
      bookingType: 'Tipo', openOfficial: 'Abrir página oficial', readyToBook: 'Listo para reservar', markBooked: 'Marcar reservado', undoBooked: 'Reservado ✓ (toca para deshacer)',
      iBookedThis: 'Yo lo reservé', confirmBookingTitle: 'Confirma tu reserva', confirmBookingIntro: 'Reserva en el sitio del operador, luego pega tu número de confirmación y el precio que pagaste.', confirmBookingHonesty: 'Solo se guarda lo que ingresas — nunca confirmamos automáticamente ni obtenemos precios.', confirmBookingSave: 'Guardar reserva', confirmNeedNumber: 'Agrega primero el número de confirmación.', confirmationNumberPh: 'p. ej. ABC123', actualPricePaid: 'Precio que pagaste', actualPricePh: 'p. ej. $420', confirmGoFlight: 'Buscar y reservar el vuelo', confirmGoHotel: 'Buscar y reservar el hotel', confirmFlightAirlineHint: 'Consejo: reserva en el sitio de la aerolínea cuando los precios coinciden — cambios más fáciles.', selfBookedToast: 'Reserva guardada en tu viaje', selfBookedNote: 'Reservado', selfBookedBy: 'Reservado por', selfBookedLedgerNote: 'Reserva propia',
      confirmationNumber: 'N.º de confirmación', cancellationPolicy: 'Política de cancelación', refundPolicy: 'Política de reembolso', deadlineLabel: 'Reservar antes de', providerLabel: 'Proveedor', recommended: 'Recomendado', bookingNotes: 'Notas',
      bt_flight: 'Vuelo', bt_hotel: 'Hotel', bt_airbnb: 'Alquiler vacacional', bt_attraction: 'Atracción / entradas', bt_restaurant: 'Restaurante', bt_tour: 'Tour', bt_parking: 'Estacionamiento', bt_rental_car: 'Auto de alquiler', bt_bus: 'Autobús', bt_ride: 'Transporte', bt_packing: 'Equipaje', bt_payment: 'Pago', bt_confirmation: 'Confirmación', bt_other: 'Otro',
      bs_research_needed: 'Investigar', bs_researching: 'Investigando', bs_ready_to_book: 'Listo para reservar', bs_user_approval_needed: 'Requiere aprobación', bs_booked: 'Reservado', bs_skipped: 'Omitido', bs_paid: 'Pagado', bs_not_needed: 'No necesario', bs_completed: 'Completado',
      tf_todo: 'Por hacer', tf_completed: 'Completado', markDone: 'Marcar hecho', taskCompletedBy: 'Completado por',
      naTitle: 'Siguiente', naAllSet: 'Todo listo', naResearch: 'Buscar opciones',
      blkTransport: 'Esperando el transporte', blkStay: 'Hotel aún no reservado', blkPrior: 'Esperando un paso anterior', blkDep: 'Esperando un requisito previo',
      progTransport: 'Transporte', progHotels: 'Hoteles', progTickets: 'Entradas', progActivities: 'Actividades', progFood: 'Comida',
      warnHotelFirst: 'Reserva el hotel en {city} antes de sus entradas y actividades.', warnBookSoon: '{title} — reserva pronto, puede agotarse.', warnReturnMissing: 'Falta tu viaje de regreso — añade el transporte de vuelta.', warnUnscheduled: '{n} elemento(s) aún sin ubicar en tu viaje.',
      depMapTitle: 'Mapa de dependencias', depMapSub: 'Qué depende de qué — el orden para confirmar',
      pri_P0: 'P0 · Urgente', pri_P1: 'P1', pri_P2: 'P2', taskUnassigned: 'Sin asignar', taskDue: 'Fecha límite', taskCost: 'Costo est.', taskBook: 'Reservar', taskConfirmRide: 'Confirmar transporte', taskChoose: 'Elegir/votar', taskActual: 'Costo real', taskPaidBy: 'Pagado por', taskPaidByNone: 'Sin pagar', taskBalanceTitle: 'Saldo por familia', taskOwed: 'debe', taskOwes: 'debe', taskAhead: 'a favor', taskPaidTotal: 'Total pagado', taskRemaining: 'restante', taskWholeFamily: 'Toda la familia', memberCostTitle: 'Adeudado por persona', memberCostUnassigned: 'Sin asignar (sin persona aún)', tf_all: 'Todo', tf_urgent: 'Urgente', tf_mine: 'Mías', tf_unpaid: 'Sin pagar', tf_bookings: 'Reservas', tf_done: 'Completadas',
      shareTrip: 'Compartir viaje', shareModalTitle: 'Invita a tu grupo', shareLinkLabel: 'Enlace del viaje', sharePasscodeLabel: 'Código', copyPasscode: 'Copiar código', passcodeCopied: '¡Código copiado!',
      regeneratePasscode: 'Regenerar enlace + código', shareRegenWarn: 'Esto crea un nuevo enlace y código; los anteriores dejan de funcionar.', disableSharing: 'Desactivar', enableSharing: 'Activar', sharingDisabled: 'El compartir está DESACTIVADO.', shareGenerating: 'Creando invitación segura…',
      sharePermInfo: 'Cualquiera con el enlace Y el código puede iniciar sesión para ver, votar, sugerir y añadir su familia. Solo tú puedes editar el viaje, aprobar sugerencias y gestionar miembros. Nadie puede eliminar el viaje ni hacer compras.',
      membersTitle: 'Miembros', role_owner: 'Propietario', role_organizer: 'Organizador', role_member: 'Miembro', role_guest: 'Invitado', promote: 'Hacer organizador', demote: 'Hacer miembro',
      joinTitle: 'Unirse al viaje', joinPasscodePrompt: 'Ingresa el código del viaje', yourName: 'Tu nombre', joinBtn: 'Unirse', joining: 'Uniéndose…',
      joinBadPasscode: 'Código incorrecto. Consulta con el propietario.', joinRateLimited: 'Demasiados intentos — inténtalo de nuevo en unos minutos.', joinDisabled: 'Este enlace ya no está activo. Pide uno nuevo al propietario.',
      sg_pending: 'Pendiente', sg_approved: 'Aprobado', sg_rejected: 'Rechazado', approve: 'Aprobar', reject: 'Rechazar',
      emailOptional: 'Correo (opcional)', roleRequested: 'Unirse como', addMyFamily: '+ Añadir mi familia', chooseFamily: '¿Con qué familia vas?', newMemberOpt: 'Solo yo (sin familia)',
      joinedLabel: 'Se unió', lastActiveLabel: 'Última actividad', memberPhone: 'Teléfono', addMemberBtn: 'Añadir miembro', invitedPending: 'Invitado (pendiente)', assignFamilyBtn: 'Familia',
      loggedInAs: 'Conectado como', switchMember: 'Cambiar miembro', logoutTrip: 'Salir del viaje', familyNamePh: 'ej. Los Nguyen',
      destRoleLabel: 'Esta parada es', stayOvernightQ: '¿Pernoctar aquí?', hotelNeededQ: '¿Necesitas hotel/Airbnb aquí?', hoursLabel: 'Tiempo aquí', hoursPh: 'ej. 2 horas, medio día', suggestFoodQ: 'Sugerir comida', suggestActivitiesQ: 'Sugerir actividades', optionalStop: 'Parada opcional', editDestination: 'Editar destino', regenLeg: 'Regenerar este tramo', optionalBadge: 'Opcional',
      advancedOptions: 'Opciones avanzadas', customizeStop: 'Personalizar las fechas de esta parada', aiRecommendsStay: 'Dinos tu estilo — la IA recomienda la mejor zona y opciones económicas, familiares y de lujo.', knowHotelHint: '¿Ya sabes tu hotel? Ingrésalo (opcional).', specialInstructions: 'Instrucciones especiales',
      lastDayFullQ: 'Usar el último día como día completo de actividades', returnDay: 'Día de regreso',
      dhp_budget: 'Económico', dhp_moderate: 'Moderado', dhp_luxury: 'Lujo', dhp_pool: 'Piscina', dhp_kitchen: 'Cocina', dhp_breakfast: 'Desayuno', dhp_suite: 'Suite', dhp_ocean_view: 'Vista al mar', dhp_near_attractions: 'Cerca de atracciones',
      dr_main_destination: 'Destino principal', dr_overnight_destination: 'Pernoctar', dr_stopover: 'Escala (actividad)', dr_meal_stop: 'Parada de comida/descanso', dr_airport_arrival: 'Llegada al aeropuerto', dr_pass_through: 'De paso', dr_optional_attraction: 'Atracción opcional',
      tab_stay: 'Alojamiento', whereToStayTitle: 'Dónde alojarse', staysSub: 'Zonas investigadas por IA con opciones de hotel y Airbnb para cada parada.', findStays: 'Buscar alojamiento (IA)', researchingStays: 'Buscando las mejores zonas y alojamientos…', noStaysYet: 'Toca “Buscar alojamiento” para opciones de hotel y Airbnb por IA.', bestArea: 'Mejor zona', airbnbAreasTitle: 'Zonas de Airbnb / alquiler', searchHotelBtn: 'Buscar hoteles', searchAirbnbBtn: 'Buscar Airbnb', selectStay: 'Seleccionar', staySelected: 'Seleccionado ✓', parkingLabel: 'Estacionamiento', distanceLabel: 'Distancia',
      stayfor_budget: 'Económico', stayfor_best_value: 'Mejor valor', stayfor_family: 'Familiar', stayfor_luxury: 'Lujo', stayfor_pool: 'Piscina', stayfor_breakfast: 'Desayuno', stayfor_kitchen: 'Cocina / suite', stayfor_accessible: 'Accesible',
      stayfor_best_overall: 'Mejor en general', stayfor_resort: 'Resort', stayfor_ocean_view: 'Vista al mar', stayfor_food_area: 'Mejor zona gastronómica', stayfor_theme_parks: 'Parques temáticos', stayfor_disneyland: 'Disneyland',
      amBreakfast: 'Desayuno', amKitchen: 'Cocina', amPool: 'Piscina', amFamilySuite: 'Suite familiar',
      stayBooking: 'Booking.com', stayExpedia: 'Expedia', stayHotels: 'Hotels.com', stayReviews: 'Reseñas', refreshStays: 'Actualizar alojamiento',
      bestAreasTitle: 'Mejores zonas para tu grupo', stayStrategiesTitle: 'Dónde establecer tu base', stayStrategiesSub: 'La IA compara estrategias de alojamiento entre tus paradas y recomienda una.',
      strat_single_base: 'Una base', strat_split_nights: 'Dividir noches', strat_cheapest: 'Más económico', strat_near_attraction: 'Cerca de la atracción principal',
      stratDriving: 'Conducir', stratConvenience: 'Comodidad', stratKids: 'Niños', stratFood: 'Comida',
      tab_food: 'Comida', foodPicksTitle: 'Recomendaciones de comida', foodSub: 'Restaurantes investigados por IA para tu grupo en cada parada, según tus cocinas.', findFood: 'Buscar comida (IA)', researchingFood: 'Buscando los mejores restaurantes para tu grupo…', noFoodYet: 'Toca “Buscar comida” para recomendaciones de restaurantes por IA.', searchFoodBtn: 'Buscar', yelpBtn: 'Yelp', dishesLabel: 'Para probar', reservationLabel: 'Reservas',
      imgRepresentative: 'Solo imagen representativa', imgPending: 'Foto pendiente de verificar', viewPhotos: 'Fotos', googleReviews: 'Reseñas de Google', yelpReviews: 'Reseñas de Yelp', menuBtn: 'Menú', mustTryLabel: 'Para probar',
      noVerifiedPhoto: 'Sin foto verificada', noVerifiedFood: 'Sin fotos de comida verificadas', viewGooglePhotos: 'Google Fotos', tripadvisor: 'Tripadvisor', verifiedPhoto: 'Foto verificada', areaPhoto: 'Foto del área · Wikimedia', likelyMatchPhoto: 'Coincidencia probable · Wikimedia', viaWikipedia: 'Wikipedia (CC)', viaWikimedia: 'Wikimedia Commons', morePhotos: 'Más fotos',
      skipPlace: 'Omitir', skippedLabel: 'Omitido', undoSkip: 'Deshacer', replaceAlt: 'Reemplazar con alternativa', replacedOriginal: 'Reemplazado', pickAlternative: 'Elige una alternativa', noAlts: 'Sin alternativas — busca o agrega la tuya.', searchReplacement: 'Buscar reemplazo', addOwn: 'Agregar la mía', addOwnPh: 'Nombre de tu restaurante / lugar', leaveEmpty: 'Dejar este espacio vacío', loadingAlts: 'Buscando alternativas…',
      foodfor_family: 'Familiar', foodfor_groups: 'Grupos', foodfor_date_night: 'Cita', foodfor_quick_bite: 'Rápido', foodfor_fine_dining: 'Alta cocina', foodfor_breakfast: 'Desayuno', foodfor_vegetarian: 'Vegetariano', foodfor_seafood: 'Mariscos', foodfor_local_specialty: 'Especialidad local', foodfor_kid_friendly: 'Para niños',
      // Control del itinerario (mover/reordenar/franja horaria/fijar/agregar/replanear/por qué)
      ts_morning: 'Mañana', ts_lunch: 'Almuerzo', ts_afternoon: 'Tarde', ts_dinner: 'Cena', ts_evening: 'Noche', ts_optional: 'Opcional', ts_backup: 'Reserva',
      moveUp: 'Subir', moveDown: 'Bajar', moveToDay: 'Mover a día', changeTimeSlot: 'Franja horaria', moveCard: 'Mover', dragHint: 'Arrastra para mover, o usa este menú',
      pinHere: 'Fijar a este día y hora', unpinHere: 'Quitar fijado', pinnedHere: 'Fijado', addedByYou: 'Agregado por ti', removeAdded: 'Quitar',
      whyHere: '¿Por qué este día/hora?', whyLoading: 'Analizando la mejor opción…', whyUnavailable: 'Explicación no disponible ahora — inténtalo de nuevo.',
      dayActionsTitle: 'Editar este día', addActivity: 'Agregar actividad', addRestaurant: 'Agregar restaurante', addRestStop: 'Agregar parada de descanso', regenDayBtn: 'Regenerar día', reoptDayBtn: 'Reoptimizar día', regenDayWorking: 'Reconstruyendo este día…',
      addKind_activity: 'Agregar una actividad', addKind_restaurant: 'Agregar un restaurante', addKind_rest_stop: 'Agregar una parada de descanso', addNamePh: 'Nombre (p. ej. un lugar que ya conoces)', cancelAdd: 'Cancelar',
      replanMsg: 'Cambiaste este día. ¿Qué debe hacer la IA?', replanKeep: 'Mantener mi cambio', replanTiming: 'Solo ajustar horarios', replanReopt: 'Reoptimizar alrededor', replanReset: 'Restablecer al plan de IA',
      finalDayPlan: 'Plan del último día', finalDayHint: 'La IA decide por defecto — según la distancia a casa, la salida del hotel, niños/mayores y tu ritmo.',
      fdm_ai_decide: 'No estoy seguro — que decida la IA', fdm_return_day: 'Día de regreso / viaje', fdm_half_day: 'Media jornada + regreso', fdm_full_day: 'Día completo de actividades',
      // V2 entrada simplificada (solo QUIÉN / DÓNDE / QUÉ EXPERIENCIA — la IA infiere el resto)
      createSubV2: 'Solo lo básico — el concierge de IA se encarga del resto (ruta, hoteles, transporte, horario).',
      tripNamePh: 'p. ej. Verano con los Nguyen', originLabel: '¿Desde dónde sales?', paceLabel: 'Ritmo',
      destHintV2: 'Solo nombra los lugares — sin roles ni ajustes de parada. La IA planea la ruta y los tiempos.',
      familySubV2: 'Dinos quién viaja y qué le gusta — la IA hace el resto.', foodOtherPh: 'Otras cocinas (separadas por comas)',
      stayAtmosphere: 'Ambiente de hospedaje', stayAtmosphereHint: 'El ambiente que quieres — la IA elige las zonas y hoteles reales.',
      planTrip: 'Planear mi viaje', planTripHint: 'El concierge de IA investiga transporte, hoteles, comida, actividades, rutas y un día de regreso.',
      sa_ocean_view: 'Vista al mar', sa_near_beach: 'Cerca de la playa', sa_quiet: 'Tranquilo', sa_family_friendly: 'Familiar', sa_resort: 'Resort', sa_airbnb: 'Airbnb', sa_luxury: 'Lujo', sa_budget: 'Económico', sa_near_attractions: 'Cerca de atracciones', sa_walkable: 'Caminable',
      // Phase B — Agente de Transporte IA
      tab_transport: 'Transporte', tpHeader: 'Cómo llegarás', transportSub: 'La IA compara opciones de viaje por tramo — elige la que se adapte a tu grupo. Las estimaciones están etiquetadas; nada se reserva sin ti.',
      findTransport: 'Comparar transporte (IA)', refreshTransport: 'Actualizar opciones', researchingTransport: 'Comparando auto, vuelo, autobús y viaje privado…', noTransportYet: 'Toca “Comparar transporte” para ver opciones de IA.',
      tpVerified: 'Verificado', tpEstimate: 'Estimado', tpNeedsConfirm: 'Confirmar',
      tm_personal_car: 'Auto propio', tm_rental_car: 'Auto de alquiler', tm_flight: 'Vuelo', tm_bus: 'Autobús', tm_train: 'Tren', tm_dlc_ride: 'Viaje privado DuLichCali',
      // V3 — Amtrak/tren, rangos "mejor para", Cazador de ofertas
      tpwhy_train: 'Amtrak es panorámico y relajado — sin conducir, con espacio para moverse y cómodo para mayores y niños; el horario se investiga, nunca se asume.',
      tpro_scenic: 'Viaje panorámico', tcon_stations: 'De estación a estación', tpTrainStation: 'Va de estación a estación — revisa la estación Amtrak más cercana y los horarios.',
      tpTrainAmtrak: 'Amtrak.com', tpTrainSearch: 'Buscar horario de Amtrak',
      tpBestKids: 'Mejor con niños', tpBestSeniors: 'Mejor para mayores', tpLeastTiring: 'Menos cansado', tpBestLuggage: 'Mejor para equipaje', tpScenic: 'Más panorámico',
      nlPriority: 'Prioridad', nlprio_required: 'Obligatorio (fijado)', nlprio_preferred: 'Preferido', nlprio_ai_decide: 'La IA decide', nlprio_avoid: 'Evitar este modo',
      tprec_userpref: 'Prefieres esto para este tramo, así que encabeza la comparación — las alternativas quedan abajo.', tprec_avoided: 'Elegido para evitar el modo que pediste omitir en este tramo.',
      dealWatchOn: 'Vigilando ofertas', dealWatchOff: 'Vigilar ofertas', dealCheckNow: 'Revisar ahora', dealWatchHint: 'La IA revisa transporte, hoteles y ofertas de entradas y te avisa si aparece una opción más barata o una nueva oferta — nunca cambia tu plan por su cuenta. Los precios vienen de la investigación y enlaces de reserva; nada se inventa.', dealNoBetter: 'No hay mejor oferta por ahora', dealBetterFound: 'Mejor oferta encontrada', dealHotelDrop: 'Hotel más barato encontrado', dealTicketNew: 'Nueva oferta de entradas', perNight: 'noche', dealWas: 'antes', dealNow: 'ahora', dealSave: 'ahorra', dealKeep: 'Mantener itinerario', dealSwitch: 'Cambiar', dealSwitchSaved: 'Cambiado — ahorras ~{amt} (est.)', dealSavingsTotal: 'Ahorro en ofertas hasta ahora', researchedAt: 'Investigado',
      dealResearchFares: 'Buscar tarifas actuales', dealNoFares: 'No se encontraron tarifas actuales — prueba los enlaces de reserva.', dealFaresTitle: 'Tarifas actuales (investigadas · pendiente de verificación)', dealFaresLive: 'Tarifas actuales (en vivo)', fareLiveTag: 'en vivo', dealWhileAway: 'encontrado mientras no estabas',
      pushEnable: 'Activar alertas en el teléfono', pushOn: 'Alertas activadas', pushEnabled: 'Alertas activadas — te avisaremos de mejores ofertas.', pushDenied: 'Las notificaciones están bloqueadas — actívalas en los ajustes del navegador/teléfono.', pushUnsupported: 'Las alertas no están disponibles en este dispositivo/navegador.',
      tm_any: 'Cualquiera · comparar todo', tm_greyhound: 'Greyhound', tm_flixbus: 'FlixBus', tm_shuttle: 'Shuttle',
      // V3 Transport strategy + transfer intelligence
      tpCompareTitle: 'Compara cada tramo', whyRecommended: 'Por qué',
      stratTitle: 'Plan de transporte y traslados con IA', stratSub: 'La IA investiga operadores reales, encuentra puntos de traslado y compara estrategias de varios tramos — horarios y precios pendientes de verificación, nunca inventados.', stratDemo: 'Las estrategias aparecen cuando creas un viaje real.', stratNeedOrigin: 'Agrega desde dónde sales (Paso 1) y la IA planeará cómo llegar.',
      stratPrefLabel: 'Forma de viajar preferida', stratResearch: 'Investigar estrategias de transporte', stratRefresh: 'Actualizar estrategias', stratLoading: 'Investigando operadores, puntos de traslado y estrategias…', stratNone: 'No se pudo investigar ahora — la comparación verificada por tramo de abajo sigue funcionando. Intenta actualizar.',
      stratHubs: 'Puntos de traslado', stratStrategies: 'Estrategias para comparar', stratRecommended: 'Recomendado', stratOvernight: 'Noche', stratRisk: 'Riesgo de horario', stratRequestDlc: 'Solicitar viaje DuLichCali',
      stratPickup: 'Recogida', stratDropoff: 'Bajada', stratOfficial: 'Sitio oficial', stratModes: 'Detalles del operador (investigado)',
      stratReturnTitle: 'El regreso', stratEarlyRisk: 'Riesgo de salida temprana', stratOvernightRec: 'Se sugiere noche cerca de la salida', stratLeaveEarlier: 'Considera salir un día antes',
      stratUnverified: 'Investigado por IA — confirma horarios y precios en el sitio oficial de cada operador antes de reservar. Los tiempos de conducción provienen de Google Maps o una estimación etiquetada; aquí no se reserva nada.',
      connTitle: 'Plan de conexión', connTransferNeeded: 'Se necesita traslado', connDirect: 'Directo al destino', connOrigin: 'Inicio', connDropoff: 'Bajada del bus/vuelo', connFinal: 'Destino final', connTransferOptions: 'Llegar de la bajada a tu hotel', connHubStop: '¿Tiempo de sobra? Disfruta el punto de traslado', connReturnTitle: 'Horario de regreso', connOvernightBefore: 'El regreso sale temprano — considera una noche en el punto de traslado la noche anterior.', connScheduleRisk: 'Riesgo de horario', connPending: 'Horario pendiente de verificación — confírmalo en el sitio oficial/teléfono del operador. Aquí no se reserva nada.',
      tpDuration: 'Puerta a puerta', tpCost: 'Total est.', tpPerTraveler: 'Por persona', tpFareOnRequest: 'Tarifa al solicitar',
      suit_good: 'bien', suit_ok: 'ok', suit_poor: 'ajustado',
      tpRequestDlc: 'Solicitar viaje DuLichCali', tpDlcNote: 'Envía un borrador a la reserva de viajes DuLichCali — confírmalo allí.', tpSearchBook: 'Buscar y reservar', tpConfirmNote: 'Estimado — confirma precio y horario en el sitio de reserva.', tpChoose: 'Elegir esta', tpYourChoice: 'Tu elección',
      tpLeg_outbound: 'Cómo llegar', tpLeg_inter: 'Entre paradas', tpLeg_return: 'Regreso a casa',
      tpDay_transit: 'Día de tránsito', tpDay_activity: 'Día de actividades', tpDay_half: 'Medio viaje / medio paseo',
      tpWhy: 'Por qué la IA lo recomienda:', tpRecommended: 'Recomendado', tpLowestCost: 'Más económico', tpFastest: 'Más rápido', tpComfort: 'Más cómodo', tpPrivateDlc: 'Viaje privado', tpCompare: 'Comparar opciones', tpSideBySide: 'Comparar lado a lado',
      tpPerFamily: 'Por familia', tpGas: 'Gasolina (est.)', tpParking: 'Estacionamiento', tpConvenience: 'Comodidad', tpBestFamilies: 'Mejor para familias', tpMarkBooked: 'Marcar reservado', tpBooked: 'Reservado', tpBookedToast: 'Marcado como reservado', tpUnbookedToast: 'Marcado como no reservado',
      tpTollNote: 'Peajes: revisa tu ruta (pendiente de verificación).', tpAirportBuffer: 'Incluye ~2–3 h de margen en el aeropuerto (seguridad, embarque, maletas).', tpBaggageNote: 'Suma cargos de equipaje + un auto de alquiler o viaje compartido en el destino.', tpBusStationNote: 'Confirma la estación exacta de recogida/bajada con el operador.',
      tpFlightSearch: 'Buscar vuelos', tpAirportsNear: 'Aeropuertos cercanos', tpBusGreyhound: 'Greyhound', tpBusFlix: 'FlixBus', tpBusHoang: 'Hoàng Express',
      apf_closest: 'aeropuerto más cercano', apf_budget: 'alternativa económica', apf_mostflights: 'más vuelos',
      tpro_door: 'Puerta a puerta', tpro_flexible: 'Flexible — para cuando quieras', tpro_luggage: 'Espacio para equipaje', tpro_costshare: 'Costo compartido por el grupo', tpro_fastest: 'Lo más rápido para larga distancia', tpro_lesstiring: 'Menos cansado que conducir mucho', tpro_cheapest: 'Suele ser lo más barato', tpro_nodriving: 'Sin conducir', tpro_private: 'Conductor privado, solo tu grupo', tpro_kidssenior: 'Fácil para niños y mayores', tpro_noparking: 'Sin preocuparte por estacionar',
      tcon_longdrive: 'Viaje largo en auto', tcon_fatigue: 'Fatiga del conductor', tcon_parking: 'Buscar/pagar estacionamiento', tcon_airporttime: 'El tiempo en el aeropuerto suma', tcon_baggage: 'Cargos de equipaje', tcon_carthere: 'Necesitas auto en el destino', tcon_bookahead: 'Reserva con antelación para mejor precio', tcon_slowest: 'La opción más lenta', tcon_schedule: 'Horario fijo', tcon_luggagelimit: 'Equipaje limitado', tcon_highercost: 'Mayor costo que conducir',
      tprec_car_short: 'Conducir es lo más fácil y flexible para un tramo corto con tu grupo y equipaje.', tprec_car_group: 'Conducir mantiene al grupo junto con el equipaje y es mucho más barato que boletos separados para todos.', tprec_flight_long: 'Volar ahorra más tiempo en este tramo largo para un grupo pequeño sin niños pequeños — agrega un auto de alquiler en el destino.',
      tm_hoang_bus: 'Xe Đò Hoàng', tpWifi: 'Wi-Fi', tpHoangBook: 'Reservar en xedohoang.com', tpHoangGuide: 'Guía de reserva', tpHoangSite: 'Sitio oficial',
      tpHoangStation: 'Confirma la estación exacta de recogida/bajada y el horario en xedohoang.com (pendiente de verificación).',
      tpHoangConnect: 'El centro principal de Xe Đò Hoàng en el sur de California es Little Saigon (Condado de Orange) — continúa hasta tu destino con un viaje privado o van de DuLichCali.',
      tpro_rest: 'Todos pueden descansar', tpro_wifi: 'Wi-Fi gratis a bordo', tpro_vietnamese: 'Personal que habla vietnamita', tpro_avoidtraffic: 'Evita el tráfico del sur de CA', tcon_slowerthancar: 'Más lento que conducir',
      tpwhy_personal_car: 'Conducir: máxima flexibilidad, puerta a puerta y la forma más barata de mantener al grupo junto con el equipaje.', tpwhy_dlc_ride: 'Viaje privado DuLichCali: un conductor puerta a puerta — lo más fácil con niños, mayores y equipaje, sin estacionamiento.', tpwhy_flight: 'Volar: lo más rápido en un tramo largo — agrega un auto de alquiler o viaje compartido en el destino.', tpwhy_bus: 'Greyhound / FlixBus: la opción más económica sin conducir, con horario fijo.', tpwhy_hoang_bus: 'Xe Đò Hoàng: el autobús que prefieren las familias vietnamitas — todos descansan, Wi-Fi gratis, personal que habla vietnamita, y evita conducir y el tráfico del sur de California.',
      tprec_hoang: 'Se recomienda Xe Đò Hoàng: con mayores y niños, toda la familia puede descansar con Wi-Fi en vez de conducir 8 horas, y evita el tráfico del sur de California.',
      tprec_userlocked: 'Elegiste esto para este tramo, así que queda como tu plan — horario, costo y reserva se agregan en torno a ello. Las opciones de abajo son solo alternativas.',
      routeOpsTitle: 'Oportunidades en ruta', routeOpsSub: 'Descubrimientos opcionales en este tramo — agrega lo que le guste a tu grupo, omite el resto.', findRouteOps: 'Descubrir paradas en ruta (IA)', researchingRouteOps: 'Buscando paradas interesantes en el camino…', routeOpAdded: 'Agregado a este día', roYourStops: 'Tus paradas para este día', roAdd: 'Agregar al día', roMustSee: 'Imperdible', roMin: 'min de desvío', roNoneFilter: 'Sin resultados para este filtro — prueba otro.',
      roAll: 'Todo', roFood: '🍽 Comida', roBeachScenic: '🏖 Playa y paisajes', roHidden: '💎 Joyas ocultas', roKid: '🧒 Para niños', roLowEnergy: '😌 Tranquilo', roRainy: '🌧 Día lluvioso',
      roins_food_stop: 'Parada de comida', roins_short_stop: 'Parada corta', roins_half_day: 'Parada de medio día', roins_overnight: 'Noche', roins_scenic_stop: 'Parada escénica', roins_shopping_stop: 'Compras', roins_beach_stop: 'Playa', roins_kid_stop: 'Para niños', roins_teen_stop: 'Para adolescentes', roins_senior_stop: 'Para mayores', roins_photo_stop: 'Foto',
      roEnergy_low: 'Baja energía', roEnergy_medium: 'Energía media', roEnergy_high: 'Alta energía', roWeather_sunny: 'Mejor con sol', roWeather_outdoor: 'Al aire libre', roWeather_indoor: 'Interior (apto día lluvioso)',
      toursTitle: 'Tours y experiencias únicas', toursSub: 'Tours encontrados por IA para tu grupo — vota, fija o solicítalos por DuLichCali. Precios pendientes de verificación.', researchingTours: 'Buscando tours y experiencias únicas…', tourRequestDlc: 'Solicitar por DuLichCali',
      tour_harbor_cruise: 'Crucero por el puerto', tour_whale_watching: 'Avistamiento de ballenas', tour_hop_on_hop_off: 'Bus turístico', tour_food_tour: 'Tour gastronómico', tour_walking_tour: 'Tour a pie', tour_bike_tour: 'Tour en bici', tour_kayak: 'Kayak', tour_boat: 'Tour en barco', tour_amphibious: 'Tour anfibio', tour_brewery: 'Tour de cervecería', tour_cultural: 'Cultural', tour_adventure: 'Aventura', tour_nature: 'Naturaleza', tour_seasonal: 'De temporada', tour_other: 'Experiencia',
      impRelaxing: '😌 Más relajante', impScenic: '🌄 Más escénico', impThemePark: '🎢 Parques temáticos', impSeniorFriendly: '🧓 Apto para mayores', impRainyBackup: '🌧 Plan para lluvia',
      tpRequestPickup: 'Solicitar recogida en aeropuerto', tpRequestTransfer: 'Solicitar traslado al hotel',
      dlcInq_ride: 'Consulta de viaje DuLichCali (de tu viaje)', dlcInq_van_transfer: 'Consulta de traslado en van DuLichCali (de tu viaje)', dlcInq_tour: 'Consulta de tour DuLichCali (de tu viaje)', dlcInq_airport_pickup: 'Consulta de recogida en aeropuerto DuLichCali (de tu viaje)',
      pickupAfterProvider: 'Recogida tras la llegada de {provider}', pickupAfterArrival: 'Recogida tras tu llegada al punto de bajada',
      tpAffectsItin: 'Guardado — afecta los horarios del itinerario. Abre Itinerario para reoptimizar.', tpChosen: 'Elección de transporte guardada',
      tpReturnTitle: 'Viaje de regreso (último día)', tpReturnHint: 'Salida, margen y el regreso a casa — coherente con la ida.', tpDraftFromTrip: 'Borrador de tu viaje',
      // Inteligencia de atracciones emblemáticas por destino
      topAttractionsTitle: 'Atracciones top para tu grupo', topAttractionsSub: 'Imperdibles icónicos clasificados según quién viaja — fija cualquiera para incluirlo en tu plan.', researchingAttractions: 'Clasificando las atracciones imperdibles para tu grupo…',
      forGroup: 'para', teensLabel: 'adolescentes', ticketed: 'Entradas', pinToTrip: 'Fijar al viaje', tpaPinned: 'Fijado a tus imprescindibles', tpaAlready: 'Ya fijado',
      tier_very_high: 'Imperdible', tier_high: 'Top', tier_medium: 'Vale la pena',
      fit_kids: 'Ideal para niños', fit_teens: 'Ideal para adolescentes', fit_seniors: 'Apto para mayores', fit_all_ages: 'Todas las edades', fit_adults: 'Adultos',
      // Eventos + Paradas + Costos (Lote 1)
      tab_events: 'Eventos', tab_weather: 'Clima', tab_stopovers: 'Descubrimientos', tab_costs: 'Costos',
      weatherTitle: 'Clima y equipaje', weatherSub: 'Pronóstico real para tus fechas (o normales de temporada si faltan días) — y qué empacar.', findWeather: 'Ver el clima', refreshWeather: 'Actualizar clima', researchingWeather: 'Consultando el pronóstico…', noWeatherYet: 'Aún no hay clima — toca para ver el pronóstico.', wxPackingTitle: 'Qué empacar', wxSeasonalNote: 'Más allá del pronóstico en vivo — mostrando el clima típico de la temporada.', wxSeasonalLabel: 'típico de la temporada (est.)', wxUnavailable: 'Pronóstico aún no disponible — revisa más cerca de tus fechas.', wxRecOutdoor: 'Ideal para planes al aire libre', wxRecIndoor: 'Planea un día bajo techo', wxRecMixed: 'Variable — ten un plan B',
      wxcond_clear: 'Despejado', wxcond_partly: 'Parcialmente nublado', wxcond_cloudy: 'Nublado', wxcond_fog: 'Niebla', wxcond_drizzle: 'Llovizna', wxcond_rain: 'Lluvia', wxcond_snow: 'Nieve', wxcond_showers: 'Chubascos', wxcond_storm: 'Tormentas',
      wxtip_pack_warm_layers: 'Capas abrigadas — hará frío', wxtip_pack_light_breathable: 'Ropa ligera y transpirable', wxtip_pack_sun: 'Protector solar, gorra y gafas', wxtip_pack_rain: 'Impermeable o paraguas', wxtip_pack_layers_swing: 'Capas — gran cambio de temperatura día/noche', wxtip_pack_snow: 'Equipo de nieve y botas abrigadas', wxtip_pack_hydrate: 'Lleva agua — mantente hidratado',
      eventsTitle: 'Eventos durante tu viaje', eventsSub: 'Eventos reales dentro de tus fechas — fija cualquiera a tu plan. Estimaciones etiquetadas; nada se reserva.', findEvents: 'Buscar eventos (IA)', refreshEvents: 'Actualizar eventos', researchingEvents: 'Buscando eventos para tus fechas…', noEventsYet: 'Toca “Buscar eventos” para ver qué hay durante tu viaje.', eventPending: 'Pendiente de verificación — confirma fecha y precio', eventLiveOfficial: 'En vivo · oficial (Ticketmaster)', addToPlan: 'Agregar al plan',
      stopoversTitle: 'Paradas en trayectos largos', stopoversSub: 'Paradas inteligentes para comer, descansar, cargar gasolina y paisajes — al ritmo de tu grupo.', findStopovers: 'Buscar paradas (IA)', refreshStopovers: 'Actualizar paradas', researchingStopovers: 'Planeando paradas para los trayectos largos…', noStopoversYet: 'Ningún trayecto largo necesita paradas — o toca “Buscar paradas”.',
      stoptype_meal: 'Comida', stoptype_rest: 'Descanso', stoptype_gas: 'Gasolina / carga', stoptype_coffee: 'Café', stoptype_attraction: 'Parada rápida', stoptype_scenic: 'Paisaje', stoptype_hotel: 'Pernoctar', soAdd: 'Agregar parada', soAdded: 'Agregada', soOptional: 'Opcional', soSkip: 'Omitir', soAlternatives: 'Alternativas', soPending: 'Pendiente de verificación',
      costsTitle: 'Estimación de costos del viaje', costsSub: 'Estimaciones editables — no precios en vivo. El organizador ajusta supuestos; todos pueden ver.', costEstTotal: 'Total (est.)', costPerFamilyAvg: 'Por familia (prom.)', costPerPerson: 'Por persona', costPerDay: 'Por día', costPerPersonShort: 'persona', costRangeLabel: 'Rango', costExpected: 'esperado', costByCategory: 'Por categoría',
      costcat_transport: 'Transporte', costcat_stay: 'Alojamiento', costcat_activities: 'Actividades', costcat_food: 'Comida', costcat_other: 'Otros',
      costSplitTitle: 'División por familia', costSplitMode: 'Método de división', split_per_person: 'Por persona', split_equal: 'Igual por familia', split_per_family: 'Personalizado por familia', split_owner_pays: 'Paga el organizador',
      costLedgerTitle: 'Quién pagó / quién debe', costLedgerEmpty: 'Aún no hay pagos registrados.', costPaid: 'Pagado', costMarkPaid: 'Marcar pagado', costWhoPaid: 'Quién pagó', costLedgerTitlePh: 'Para qué (p. ej. hotel)', costAddPaid: 'Registrar pago', costMisc: 'Varios',
      costAssumptions: 'Supuestos de costo (editar)', costAsmFood: 'Comida $/persona/día', costAsmHotel: 'Hotel $/noche', costAsmGas: 'Gasolina $/milla', costAsmTicket: 'Entrada $/persona', costAsmParking: 'Estacionamiento $/día', costAsmSnacks: 'Snacks $/persona/día', costAsmSouvenir: 'Recuerdos $/familia',
      costDisclaimer: 'Estimaciones basadas en supuestos editables — no precios en vivo. Confirma los costos reales al reservar.', costFuel: 'Gasolina / conducción', costHotel: 'Hoteles / alojamiento', costTickets: 'Entradas a atracciones', costParking: 'Estacionamiento', costFood: 'Comidas', costSnacks: 'Snacks y café', costSouvenirs: 'Recuerdos', costBuffer: 'Reserva de emergencia',
      // Compartir ubicación en vivo
      tab_live: 'En vivo', ago: 'atrás', liveTitle2: 'Ubicación del grupo en vivo', liveSub2: 'Compartir ubicación opcional durante el viaje. Solo los miembros la ven; expira y se elimina después.',
      liveDemo: 'La ubicación en vivo funciona en un viaje guardado (no en la muestra).', liveLoginNeeded: 'Inicia sesión para usar la ubicación en vivo.', liveOwnerOff: 'El organizador no ha activado el compartir ubicación.', liveNoGeo: 'La ubicación no está disponible en este dispositivo/navegador.',
      liveEnableTrip: 'Activar ubicación del viaje', liveOff: 'El compartir ubicación está desactivado. El organizador puede activarlo.', livePrivacy: 'Privado solo para miembros del viaje — nunca público. Expira y se elimina tras el viaje; solo se guarda la última posición.',
      liveYouSharing: 'Estás compartiendo', liveExpires: 'expira en', liveStop: 'Dejar de compartir', liveShareMine: 'Comparte tu ubicación con el grupo:', liveShareTrip: 'Hasta el fin del viaje', liveShareToday: 'Por hoy', liveShareHour: 'Por 1 hora', liveSharingOn: 'Compartiendo tu ubicación', liveStopped: 'Dejaste de compartir',
      livestatus_on_the_way: 'En camino', livestatus_arrived: 'Llegó', livestatus_delayed: 'Retrasado', livestatus_break: 'En descanso',
      actFeedTitle: 'Actividad y alertas del viaje', actNone: 'Sin alertas ahora — votos pendientes, recordatorios de reserva y llegadas aparecerán aquí.', actSuggested: '{who} sugirió “{what}” — necesita un voto', actBookReminder: 'Reserva {what} antes del {when} — aún sin reservar', actBookSoon: 'Reserva {what} — aún sin reservar', actTaskMine: '{what} — asignada a ti', actArrived: '{who} llegó', actDelayed: '{who} está retrasado', actInApp: 'Alertas en la app — las notificaciones push llegarán pronto.',
      liveNavNext: 'Navegar a la próxima parada', liveNavHotel: 'Navegar al hotel', liveGroup: 'Compartiendo ahora', liveNobody: 'Nadie comparte aún — toca una opción arriba.', liveMember: 'Miembro', liveHere: 'aquí', liveViewMap: 'Ver en el mapa', liveNavTo: 'Navegar',
      // Optimizador de experiencia
      improveTitle: 'Mejora este viaje con IA', improveSub: 'La IA optimiza con los votos, favoritos y preferencias de tu grupo — y sugiere cambios concretos para agregar.', improveWorking: 'Buscando formas de mejorar este viaje…', improveNone: 'No hay sugerencias ahora — prueba otro objetivo.',
      optimizeTrip: 'Optimizar viaje', optimizing: 'Reconstruyendo tu viaje según los votos del grupo…', optimizeDone: 'Viaje reconstruido según los votos del grupo', optimizeNudge: 'Los votos de tu grupo cambiaron — vuelve a optimizar todo el viaje.', optimizeRebuildHint: 'Regenera el itinerario, comida, alojamiento, eventos, paradas, transporte, costos y reservas usando todos tus votos. Tus fijados y omitidos se conservan.',
      mem_title: 'Lo que recordamos', mem_sub: 'Preferencias aprendidas de tus viajes anteriores — para empezar los nuevos de forma más inteligente.', mem_cuisines: 'Cocinas que te gustan', mem_liked: 'Lugares que te gustaron', mem_never: 'No sugerir de nuevo', mem_transport: 'Transporte preferido', mem_budget: 'Presupuesto habitual', mem_pace: 'Ritmo habitual', mem_trips: 'Viajes recordados', mem_clear: 'Borrar memoria', mem_cleared: 'Memoria de viaje borrada',
      nightOne: 'noche', nightMany: 'noches',
      // Creador de itinerario con lenguaje natural
      nlSectionTitle: 'Dile a la IA exactamente lo que quieres', nlSectionHint: 'Describe tu viaje con tus palabras — fechas, quién conduce, planes fijos. La IA crea un itinerario editable que puedes ajustar.', nlPlaceholder: 'Ejemplo: El 1 de julio tomamos el Hoang Bus de San Jose a Orange County, luego Michael nos lleva a San Diego. El 2 de julio el Zoológico de San Diego. La mañana del 3 de julio en San Diego, luego de vuelta a Orange County por comida vietnamita. El 4 de julio tomamos el Hoang Bus a casa.', nlBuildBtn: 'Crear itinerario desde mis notas', nlOrDivider: 'o créalo paso a paso', nlBuilding: 'Leyendo tu plan y creando el itinerario…', nlParseFail: 'No pude convertir eso en un itinerario — agrega las fechas y paradas y toca Crear de nuevo.', nlReviewTitle: 'Esto es lo que entendí', nlReviewSub: 'Revisa y ajusta. Bloquea 🔒 lo que sea fijo — la IA planifica alrededor y completa el resto.', nlFixedReqs: 'Fijado por ti', nlFlexWindows: 'La IA sugerirá', nlQuestions: 'Algunas cosas por confirmar', nlConfirmBtn: 'Se ve bien — agregar quién viene', nlEditManual: 'Ajustar paso a paso', nlReparse: 'Editar mis notas', nlAddAfter: 'Agregar después', nlAddStop: 'Agregar un paso', nlLockSeg: 'Bloquear', nlUnlockSeg: 'Desbloquear', nlLocked: 'Bloqueado', nlFlexMark: 'Flexible', nlFlexOn: 'La IA sugiere', nlNeedsResearch: 'Falta horario', nlNeedsBooking: 'Falta reservar', nlResearchLink: 'Buscar horario', nlResearchQuery: 'horario', nlRequestRide: 'Solicitar viaje DuLichCali', nlSegTitle: 'Qué', nlSegTitlePh: 'ej. Zoológico de San Diego', nlSegDate: 'Día', nlSegTime: 'Hora', nlSegFrom: 'Desde', nlSegTo: 'Hasta', nlSegMode: 'Cómo', nlNoDate: 'Sin fecha aún', nlFoodExperience: 'Experiencia gastronómica local',
      nlSegType_transport: 'Viaje', nlSegType_transfer: 'Traslado / viaje', nlSegType_stay: 'Noche', nlSegType_activity: 'Actividad', nlSegType_food: 'Comida', nlSegType_free_time: 'Tiempo libre', nlSegType_return: 'Regreso a casa',
      nlmode_car: 'Auto propio', nlmode_bus: 'Autobús', nlmode_private_ride: 'Viaje privado', nlmode_flight: 'Vuelo', nlmode_train: 'Tren', nlmode_walk: 'Caminar', nlmode_other: 'Otro',
      nlYourRoute: 'Tu ruta fijada', nlCarAlt: 'Alternativa en auto privado', nlRouteFail: 'No pudimos aplicar tu ruta requerida. Revisa el itinerario extraído a continuación.',
      journeyLabel: 'Tu recorrido', journeyHint: 'Agrega cada parada con las fechas que quieres estar allí. Nosotros resolvemos el transporte, los hoteles y el plan día a día dentro de tus paradas.', addSegment: 'Agregar parada', arrivalDate: 'Llegada', departureDate: 'Salida', sameDay: 'El mismo día', segTransportDetails: 'Transporte y detalles (opcional)', howArrive: 'Cómo llegas a {city}', preferredProvider: 'Proveedor preferido', providerPh: 'p. ej. Xe Đò Hoàng, Michael', overnightStay: 'Pernoctar aquí', segNotesPh: 'p. ej. llegando desde la parada del autobús', homeOrigin: 'Casa', viaLabel: 'vía', viaAI: 'La IA elige la mejor forma', thisStop: 'esta parada', returnTransport: 'Regreso a casa', journeyEmpty: 'Agrega tu primera parada para ver el recorrido', homeBy: 'en casa', quickEntry: 'Entrada rápida — un rango de fechas para todo el viaje', quickEntryHint: 'Opcional. Se usa solo si dejas en blanco las fechas por parada — la IA dividirá las noches.', tp_any: 'La IA decide', tp_bus: 'Autobús', tp_private_ride: 'Viaje privado', tp_flight: 'Vuelo', tp_car: 'Auto propio', tp_train: 'Tren', segRideBooked: 'Viaje reservado', segRidePending: 'Viaje pendiente',
      impGeneral: '✨ Mejorar este viaje', impDiscoveries: '💎 Más descubrimientos', impLowerCost: '💲 Reducir costo', impKidsFun: '🧒 Más diversión para niños', impFoodFocused: '🍽 Más enfocado en comida',
      impSelected: '{n} seleccionados', impRun: 'Ejecutar mejora con IA', impClear: 'Borrar todo',
      rejVote: 'Eliminado — el grupo votó por omitirlo', rejMajority: 'Eliminado — la mayoría votó por omitirlo', rejNotNeeded: 'Eliminado — marcado como no necesario',
      impcat_activity: 'Actividad', impcat_food: 'Comida', impcat_stopover: 'Parada', impcat_timing: 'Horario', impcat_backup: 'Respaldo', impcat_cheaper: 'Más barato', impcat_exciting: 'Más emocionante', impcat_low_energy: 'Bajo esfuerzo', impcat_discovery: 'Descubrimiento',
    },
  };

  var DESTINATIONS = ['San Diego', 'Las Vegas', 'Orange County', 'Los Angeles', 'Napa', 'Yosemite', 'San Francisco'];
  var INTERESTS = ['beach', 'zoo', 'shows', 'shopping', 'casino', 'museums', 'food', 'nightlife', 'theme_park', 'scenic', 'family_friendly'];
  // Expanded preference enumerations (Phase 1 richer questionnaire). Stable English
  // snake_case tokens (language-independent) → round-trip safely; labels resolved via t().
  // Legacy 'scenic'/'family_friendly' interests are tolerated on read.
  var INTERESTS_EXPANDED = ['beach', 'aquarium', 'zoo', 'theme_park', 'museums', 'nature', 'casino', 'shopping', 'food', 'nightlife', 'photography', 'hiking', 'shows', 'sports', 'fishing', 'cruises', 'scenic_drives', 'hidden_gems'];
  var FOOD_KEYS = ['vietnamese', 'japanese', 'korean', 'seafood', 'steakhouse', 'mexican', 'vegetarian', 'fine_dining'];
  var KID_KEYS = ['arcades', 'water_parks', 'roller_coasters', 'animal_encounters'];
  var TEEN_KEYS = ['escape_rooms', 'vr', 'anime', 'teen_shopping'];
  var SENIOR_KEYS = ['limited_walking', 'wheelchair_accessible', 'frequent_breaks'];
  var HOTEL_KEYS = ['resort', 'airbnb', 'suites', 'kitchen', 'pool', 'free_breakfast', 'ocean_view'];
  // V2 family-level "stay atmosphere" — the vibe the AI hotel agent maps to REAL areas/hotels
  // (it never asks for hotel names or areas). Generic, never tied to one city.
  var STAY_ATMOSPHERE = ['ocean_view', 'near_beach', 'quiet', 'family_friendly', 'resort', 'airbnb', 'luxury', 'budget', 'near_attractions', 'walkable'];
  var TIME_ORDER = ['morning', 'lunch', 'afternoon', 'dinner', 'night'];
  // Canonical user-facing time slots (the user moves cards between these). 'night' from the
  // AI maps to 'evening'; 'optional'/'backup' are user-only target lanes. NOT hardcoded to any
  // city/trip — these are generic parts of a day that apply to every itinerary everywhere.
  var TIME_SLOTS = ['morning', 'lunch', 'afternoon', 'dinner', 'evening', 'optional', 'backup'];
  var SLOT_TIME = { morning: '09:00', lunch: '12:30', afternoon: '14:30', dinner: '18:00', evening: '20:00', optional: '', backup: '' };
  function normSlot(s) { s = String(s || '').toLowerCase(); if (s === 'night') return 'evening'; return TIME_SLOTS.indexOf(s) >= 0 ? s : 'afternoon'; }
  // Final-day mode (Issue #3): generic, never hardcoded. ai_decide is the default — the AI
  // weighs distance home, checkout time, kids/seniors and pace to choose the final-day shape.
  var FINAL_DAY_MODES = ['ai_decide', 'return_day', 'half_day', 'full_day'];
  function finalDayMode(tr) { if (tr && tr.finalDayMode && FINAL_DAY_MODES.indexOf(tr.finalDayMode) >= 0) return tr.finalDayMode; if (tr && tr.lastDayFull) return 'full_day'; return 'ai_decide'; }

  var state = {
    lang: 'en', screen: 'hero', step: 1, trip: null, activeDay: 0, activeTab: 'itinerary',
    readonly: false, generating: false, user: null, authMode: 'login',
    _pendingTripId: null, _afterLogin: null,
    myRole: null, _shareToken: null, _shareInfo: null, _members: null, _myTrips: null, _joinedTrips: null, _contacts: null, _sharePreview: null, _cResearch: null, _altOpen: null, _alts: null, _photosUnavailable: false,
    _media: null, _mediaLoadedFor: null, _addMediaOpen: false, _clip: null, _clipConsent: false, _clipPlatform: 'tiktok', _clipMood: 'fun', _clipLen: 'short', _liveMapTried: null, _createMoreOpen: false, _stratLoading: false, _stratLoadedFor: null, _stratModesOpen: false, _replanBusy: null, _cmdBusy: false, _editPlan: null,
    _cardMenu: null, _replanDay: null, _regenDay: null, _addOpen: null, _why: null, _tpOpen: null,
    _routeTriedTrip: null, _tpRouteTriedTrip: null,
    _liveShare: null, _liveLocations: null, _liveSubFor: null, _liveUnsub: null, _liveExpiryTimer: null, _liveLastCoords: null, _liveManual: false,
    _improve: null,
  };

  function t(k) { return (T[state.lang] && T[state.lang][k]) || T.en[k] || k; }
  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function uid(p) { return (p || 'tc') + '_' + Math.random().toString(36).slice(2, 10); }

  // ── Auth (unified DuLichCali customer account — same scheme as Mobile Barber) ──
  function auth() { return (root.firebase && root.firebase.auth) ? root.firebase.auth() : null; }
  function realUser() { var a = auth(); var u = a && a.currentUser; return (u && !u.isAnonymous && u.uid) ? u : null; }
  function curUid() { var u = realUser(); return u ? u.uid : ''; }
  function setPersistence() {
    var a = auth(); if (!a) return Promise.reject(new Error('no_auth'));
    try { var P = root.firebase.auth.Auth.Persistence.LOCAL; return Promise.resolve(a.setPersistence ? a.setPersistence(P) : null).then(function () { return a; }); }
    catch (e) { return Promise.resolve(a); }
  }
  var TCAuth = {
    normalizePhone: function (p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1); return d.slice(-10); },
    emailForPhone: function (p) { return TCAuth.normalizePhone(p) + '@mobile-barber.dulichcali21.local'; },
    login: function (phone, pass) { return setPersistence().then(function (a) { return a.signInWithEmailAndPassword(TCAuth.emailForPhone(phone), pass); }); },
    signup: function (phone, pass) { if (!pass || pass.length < 8) return Promise.reject(new Error('weak')); return setPersistence().then(function (a) { return a.createUserWithEmailAndPassword(TCAuth.emailForPhone(phone), pass); }); },
  };
  // Run `after` once a real (non-anonymous) user is signed in; otherwise route to the login gate.
  function requireLogin(after) {
    if (realUser()) { after && after(); return; }
    state._afterLogin = after || function () { render(); };
    if (!state.trip) newTrip();
    state.trip._demo = false; state.screen = 'plan'; render();
  }

  // ── Providers (mock-first; swappable) ──────────────────────────────────
  var MapLinkProvider = {
    google: function (name, addr) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((name || '') + (addr ? ', ' + addr : '')); },
    apple: function (name, addr) { return 'https://maps.apple.com/?q=' + encodeURIComponent((name || '') + (addr ? ', ' + addr : '')); },
    dayRoute: function (places) {
      var pts = (places || []).map(function (p) { return p.address || p.name; }).filter(Boolean);
      if (pts.length < 2) return pts.length ? MapLinkProvider.google(places[0].name, places[0].address) : '';
      return 'https://www.google.com/maps/dir/' + pts.map(encodeURIComponent).join('/');
    },
  };
  // Real place photos: try the AI-provided imageUrl, then a REAL Wikipedia/Wikimedia
  // photo of the actual place (free, no key, CORS via origin=*), then a relevant
  // AI-generated category image (beach/restaurant/zoo/…), then a gradient. Every card
  // ends up with a relevant picture; nothing fake is fabricated.
  var CAT_IMG = '/assets/travel-concierge/cat/';
  var CAT_KEYS = { beach:1, restaurant:1, nightlife:1, shopping:1, museum:1, theme_park:1, zoo:1, scenic:1, hotel:1, landmark:1 };
  var _mediaCache = {};
  function categoryKey(p) {
    var s = (((p && p.category) || '') + ' ' + ((p && p.name) || '')).toLowerCase();
    if (/zoo|safari|wildlife|aquarium|\banimal/.test(s)) return 'zoo';
    if (/theme ?park|amusement|disney|legoland|seaworld|knott|universal|roller|water ?park/.test(s)) return 'theme_park';
    if (/restaurant|food|dining|cafe|café|eatery|buffet|grill|kitchen|brunch|seafood|taco|pho|noodle|bbq/.test(s)) return 'restaurant';
    if (/museum|gallery|science center|art|history|cultural|exhibit/.test(s)) return 'museum';
    if (/shop|mall|outlet|market|store|boutique|plaza/.test(s)) return 'shopping';
    if (/night|\bbar\b|club|casino|lounge|pub|cocktail|rooftop/.test(s)) return 'nightlife';
    if (/beach|coast|pier|\bbay\b|shore|boardwalk|cove|harbor/.test(s)) return 'beach';
    if (/hotel|resort|lodge|\binn\b|suites/.test(s)) return 'hotel';
    if (/park|garden|trail|scenic|view|lookout|canyon|mountain|lake|nature|cliff|island/.test(s)) return 'scenic';
    return 'landmark';
  }
  var PlaceMediaProvider = {
    categoryImage: function (p) { return CAT_IMG + categoryKey(p) + '.webp'; },
    // Resolve a real photo of the ACTUAL place from Wikipedia. Promise<url|null>, cached.
    resolveReal: function (p) {
      var name = ((p && p.name) || '').trim();
      if (!name || typeof fetch !== 'function') return Promise.resolve(null);
      var ck = 'w_' + name.toLowerCase();
      if (_mediaCache[ck] !== undefined) return Promise.resolve(_mediaCache[ck]);
      var u = 'https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=640&redirects=1&titles=' + encodeURIComponent(name) + '&origin=*';
      return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
        var pages = j && j.query && j.query.pages, thumb = null;
        if (pages) for (var k in pages) { if (pages[k].thumbnail && pages[k].thumbnail.source) { thumb = pages[k].thumbnail.source; break; } }
        _mediaCache[ck] = thumb; return thumb;
      }).catch(function () { _mediaCache[ck] = null; return null; });
    },
  };
  // ── Media Enrichment (P-media): tiered REAL-photo resolver from FREE no-key sources ──────────
  // Wikipedia REST (article-anchored, EXACT) → Wikimedia Commons geosearch (coord-anchored, AREA) →
  // Commons intitle: search (named, gated). The match-safety brain (window.TCMediaEnrich) decides
  // what is safe; we NEVER show a photo we can't tie to the place. Cached per place; honest labels.
  function _meJget(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function _meImageinfo(titles, ME) {
    titles = (titles || []).filter(Boolean); if (!titles.length) return Promise.resolve({});
    return _meJget('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*&titles=' + encodeURIComponent(titles.slice(0, 20).join('|'))).then(function (j) {
      var out = {}, pages = j && j.query && j.query.pages; if (!pages) return out;
      Object.keys(pages).forEach(function (k) { var pg = pages[k], ii = pg.imageinfo && pg.imageinfo[0]; if (!ii) return; var a = ME.attributionOf(ii.extmetadata); out[pg.title] = { attribution: a.text, license: a.license, attrUrl: ii.descriptionurl || '', thumbUrl: ii.thumburl || '' }; });
      return out;
    });
  }
  function _mePhotosFromPages(j, ME, name, city, gate) {
    var pages = j && j.query && j.query.pages; if (!pages) return [];
    var out = [];
    Object.keys(pages).forEach(function (k) {
      var pg = pages[k]; if (/\.svg$/i.test(pg.title || '')) return;
      if (gate && !ME.acceptCommonsFile(pg.title, name, city)) return; // strict name+city gate (intitle path)
      var ii = pg.imageinfo && pg.imageinfo[0]; if (!ii || !ii.thumburl) return;
      var a = ME.attributionOf(ii.extmetadata);
      out.push({ thumbUrl: ii.thumburl, fullUrl: ii.url || ii.thumburl, attribution: a.text, attrUrl: ii.descriptionurl || '', license: a.license });
    });
    return out.slice(0, 8);
  }
  function enrichPlacePhotos(p) {
    var ME = root.TCMediaEnrich, name = ((p && p.name) || '').trim();
    if (!name || typeof fetch !== 'function' || !ME) return Promise.resolve(null);
    var city = _cityShort(p && (p.city || p.address));
    var ck = 'me_' + name.toLowerCase() + '|' + city.toLowerCase();
    if (_mediaCache[ck] !== undefined) return Promise.resolve(_mediaCache[ck]);
    var coords = (p && p.lat != null && p.lng != null) ? { lat: +p.lat, lng: +p.lng } : null;
    var cands = ME.titleCandidates(name, city), i = 0;
    function resolveStandard() {
      if (i >= cands.length) return Promise.resolve(null);
      var c = cands[i++];
      return _meJget('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(c)).then(function (s) {
        var conf = s && ME.summaryConfidence(s, { name: name, city: city, coords: coords });
        return conf ? { title: String(s.title || c).replace(/ /g, '_'), summary: s, confidence: conf } : resolveStandard();
      });
    }
    function articlePhotos(hit) {
      var s = hit.summary, lead = (s.originalimage && s.originalimage.source) || (s.thumbnail && s.thumbnail.source) || '';
      var artUrl = (s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || '';
      return _meJget('https://en.wikipedia.org/api/rest_v1/page/media-list/' + encodeURIComponent(hit.title)).then(function (ml) {
        var kept = ME.keepGalleryItems(ml && ml.items, 6), fileTitles = kept.map(function (it) { return it.title; });
        return _meImageinfo(fileTitles, ME).then(function (info) {
          var photos = [];
          if (lead) photos.push({ thumbUrl: lead, fullUrl: lead, attribution: t('viaWikipedia'), attrUrl: artUrl, license: 'CC' });
          kept.forEach(function (it) { var u = ME.srcsetThumb(it, 640); if (!u) return; var inf = info[it.title]; photos.push({ thumbUrl: u, fullUrl: u, attribution: (inf && inf.attribution) || t('viaWikimedia'), attrUrl: (inf && inf.attrUrl) || artUrl, license: (inf && inf.license) || '' }); });
          return photos.slice(0, 6);
        });
      });
    }
    var pipe = resolveStandard().then(function (hit) {
      if (hit) return articlePhotos(hit).then(function (ph) { return ph.length ? { photos: ph, confidence: hit.confidence, source: 'wikipedia' } : null; });
      var geo = coords ? _meJget('https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord=' + coords.lat + '|' + coords.lng + '&ggsradius=400&ggslimit=8&ggsnamespace=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*').then(function (j) { return _mePhotosFromPages(j, ME, name, city, false); }) : Promise.resolve([]);
      return geo.then(function (g) {
        if (g.length) return { photos: g, confidence: 'area', source: 'wikimedia_commons' };
        return _meJget('https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=' + encodeURIComponent(ME.intitleQuery(name)) + '&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json&origin=*').then(function (j) { var ph = _mePhotosFromPages(j, ME, name, city, true); return ph.length ? { photos: ph, confidence: 'name_match', source: 'wikimedia_commons' } : null; });
      });
    }).catch(function () { return null; });
    _mediaCache[ck] = pipe; // cache the promise to dedupe concurrent cards
    return pipe.then(function (r) { _mediaCache[ck] = r || null; return r || null; });
  }
  // Media for a place the user will physically visit. HARD RULE (Issue #7): NEVER show an
  // AI-generated or generic category image. We show ONLY a real, verified photo of the
  // ACTUAL place (Wikipedia/Wikimedia). If none is verified, we show NO image — a clear
  // "No verified photo available" panel with links to REAL sources (Google Photos/Reviews,
  // Yelp, Tripadvisor, Menu) so the traveler can see what it actually looks like.
  function placeMedia(p, cls) {
    var media = el('div', (cls || 'tc-place__media') + ' tc-place__media--nophoto');
    var name = (p && p.name) || '', area = (p && (p.address || p.city)) || '';
    var isFood = categoryKey(p) === 'restaurant';
    // imageSource / imageVerificationStatus / photoCount exposed as data-* attributes.
    media.setAttribute('data-imgstatus', 'none'); media.setAttribute('data-imgsource', 'none'); media.setAttribute('data-imgcount', '0');
    var panel = el('div', 'tc-nophoto');
    panel.appendChild(el('span', 'tc-nophoto__ic', isFood ? '🍽' : '📷'));
    panel.appendChild(el('span', 'tc-nophoto__msg', isFood ? t('noVerifiedFood') : t('noVerifiedPhoto')));
    var links = el('div', 'tc-nophoto__links');
    links.appendChild(linkBtn('📷 ' + t('viewGooglePhotos'), FoodLinkProvider.photos(name, area), 'tc-nophoto__btn'));
    links.appendChild(linkBtn('⭐ ' + t('googleReviews'), FoodLinkProvider.googleReviews(name, area), 'tc-nophoto__btn'));
    links.appendChild(linkBtn('🔴 ' + t('yelpReviews'), FoodLinkProvider.yelp({ name: name }, area), 'tc-nophoto__btn'));
    links.appendChild(linkBtn('🟢 ' + t('tripadvisor'), FoodLinkProvider.tripadvisor(name, area), 'tc-nophoto__btn'));
    if (isFood) links.appendChild(linkBtn('📋 ' + t('menuBtn'), FoodLinkProvider.menu(name, area), 'tc-nophoto__btn'));
    panel.appendChild(links);
    media.appendChild(panel);
    if (p && p.category) media.appendChild(el('span', 'tc-place__cat', p.category));
    // Show ONLY a verified real photo of the ACTUAL place — never AI/generic. Source order
    // (Issue: real photos): 1) Google Places (real provider, incl. restaurants/food) →
    // 2) Wikipedia (great for landmarks/attractions) → else keep the no-photo panel + links.
    function showVerified(url, attribution, src, meta) {
      if (!url) return false;
      meta = meta || {};
      var prevImg = media.querySelector && media.querySelector('img.tc-place__img'); if (prevImg && prevImg.parentNode) prevImg.parentNode.removeChild(prevImg);
      var img = doc.createElement('img'); img.className = 'tc-place__img'; img.alt = name; img.loading = 'lazy';
      img.addEventListener('error', function () { /* keep the no-photo panel */ });
      img.src = url;
      media.classList.remove('tc-place__media--nophoto');
      media.insertBefore(img, media.firstChild);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      // Confidence tier → honest badge: exact = "✓ Verified photo"; area/name_match = labelled (no ✓).
      var conf = meta.confidence || 'exact', exact = (conf === 'exact');
      var status = exact ? 'verified_real_place' : (conf === 'area' ? 'area_real' : (conf === 'name_match' ? 'name_match_real' : 'verified_real_place'));
      media.setAttribute('data-imgstatus', status); media.setAttribute('data-imgsource', src); media.setAttribute('data-imgcount', String(meta.count || 1));
      var oldNote = media.querySelector && media.querySelector('.tc-place__imgnote'); if (oldNote && oldNote.parentNode) oldNote.parentNode.removeChild(oldNote);
      var bKey = (root.TCMediaEnrich && root.TCMediaEnrich.badgeKey(conf)) || 'verifiedPhoto';
      media.appendChild(el('span', 'tc-place__imgnote ' + (exact ? 'tc-place__imgnote--ok' : 'tc-place__imgnote--area'), (exact ? '✓ ' : '') + t(bKey || 'verifiedPhoto')));
      var oldAttr = media.querySelector && media.querySelector('.tc-place__attr'); if (oldAttr && oldAttr.parentNode) oldAttr.parentNode.removeChild(oldAttr);
      if (attribution) {
        if (meta.attrUrl) media.appendChild(linkBtn('© ' + attribution, meta.attrUrl, 'tc-place__attr tc-place__attr--link'));
        else media.appendChild(el('span', 'tc-place__attr', '© ' + attribution));
      }
      return true;
    }
    // Render additional real photos as a tap-to-swap thumbnail strip (gallery). Each keeps its own
    // attribution; tapping promotes it to the hero. All photos are real + confidence-labelled.
    function renderGallery(photos, confidence, source) {
      if (!media.querySelector) return;
      var old = media.querySelector('.tc-place__gallery'); if (old && old.parentNode) old.parentNode.removeChild(old);
      var strip = el('div', 'tc-place__gallery'); strip.setAttribute('aria-label', t('morePhotos'));
      photos.slice(0, 6).forEach(function (ph) {
        var th = doc.createElement('img'); th.className = 'tc-place__galthumb'; th.src = ph.thumbUrl || ph.fullUrl; th.alt = name; th.loading = 'lazy';
        th.addEventListener('click', function () { showVerified(ph.fullUrl || ph.thumbUrl, ph.attribution, source === 'wikipedia' ? 'wikipedia' : 'wikimedia_commons', { confidence: confidence, attrUrl: ph.attrUrl, count: photos.length }); renderGallery(photos, confidence, source); });
        strip.appendChild(th);
      });
      media.appendChild(strip);
    }
    function tryWikipedia() {
      enrichPlacePhotos(p).then(function (res) {
        if (!res || !res.photos || !res.photos.length) return;
        var lead = res.photos[0];
        showVerified(lead.thumbUrl || lead.fullUrl, lead.attribution, res.source === 'wikipedia' ? 'wikipedia' : 'wikimedia_commons', { confidence: res.confidence, attrUrl: lead.attrUrl, count: res.photos.length });
        if (res.photos.length > 1) renderGallery(res.photos, res.confidence, res.source);
      }).catch(function () { /* keep the no-photo panel */ });
    }
    // Photo source order: 1) Google Places via the CLIENT Maps JS key (same approach the
    // ride-share service uses — works in the browser where the referrer-restricted key is
    // valid; the server secret is referrer-denied) → 2) server placePhotos (if a real server
    // key is ever set) → 3) Wikipedia → else the no-photo panel + links. Never AI/generic.
    function serverThenWiki() {
      if (!(typeof fetch === 'function') || state._photosUnavailable) { tryWikipedia(); return; }
      fetchPlacePhotos(name, area).then(function (res) {
        if (res && res.photos && res.photos.length) { showVerified(res.photos[0].url, res.photos[0].attribution, 'google_places'); }
        else { if (res && res.debugCode === 'NO_MAPS_KEY') state._photosUnavailable = true; tryWikipedia(); }
      }).catch(function () { tryWikipedia(); });
    }
    fetchPhotoClient(name, area).then(function (cp) {
      if (cp && cp.url) showVerified(cp.url, cp.attribution || 'Google', 'google_places');
      else serverThenWiki();
    }).catch(function () { serverThenWiki(); });
    return media;
  }
  // ── Client-side Google Places photos + routes (browser Maps JS key) ──────────
  // ROOT-CAUSE FIX: use the OFFICIAL async loader API google.maps.importLibrary() — the same
  // proven pattern as script.js (DLCRouteMatrix) — NOT the legacy global namespace, which is
  // unreliable under loading=async. Photos use the NEW Places API (Place.searchByText, which
  // returns photos directly) with a legacy findPlaceFromQuery→getDetails fallback. The
  // referrer-restricted client key works in the browser (server secret is referrer-denied).
  var _gmapsReady = null;
  function whenGoogleMaps() {
    if (_gmapsReady) return _gmapsReady;
    _gmapsReady = new Promise(function (resolve) {
      var tries = 0;
      (function check() {
        try { if (root.google && root.google.maps && typeof root.google.maps.importLibrary === 'function') return resolve(true); } catch (e) {}
        if (tries++ > 60) return resolve(false); // ~12s for the async loader to attach importLibrary
        try { root.setTimeout(check, 200); } catch (e) { resolve(false); }
      })();
    });
    return _gmapsReady;
  }
  var _libCache = {};
  function tcImport(name) {
    if (_libCache[name]) return _libCache[name];
    _libCache[name] = whenGoogleMaps().then(function (ok) { if (!ok) return null; try { return root.google.maps.importLibrary(name); } catch (e) { return null; } }).catch(function () { return null; });
    return _libCache[name];
  }
  // Mount a true embedded Google map of live member locations into `container` (client key,
  // importLibrary — the working photos/routes approach). No-op if Maps is unavailable (the
  // live panel's nav links remain the fallback). Pins each member; fits bounds.
  function mountLiveMap(container, members, nextCity) {
    var pts = (members || []).filter(function (m) { return typeof m.latitude === 'number' && typeof m.longitude === 'number'; });
    if (!container || !pts.length) return;
    tcImport('maps').then(function (maps) {
      if (!maps || !container) return;
      try {
        var map = new maps.Map(container, { zoom: 10, center: { lat: pts[0].latitude, lng: pts[0].longitude }, mapId: 'DEMO_MAP_ID', disableDefaultUI: false, mapTypeControl: false, streetViewControl: false });
        var bounds = new root.google.maps.LatLngBounds();
        pts.forEach(function (m) { var pos = { lat: m.latitude, lng: m.longitude }; new root.google.maps.Marker({ position: pos, map: map, title: (m.memberName || '') + (m.sharingStatus ? (' · ' + m.sharingStatus) : '') }); bounds.extend(pos); });
        if (pts.length > 1) map.fitBounds(bounds);
      } catch (e) { /* maps unavailable → nav links remain */ }
    }).catch(function () {});
  }
  // Legacy fallback: findPlaceFromQuery (place_id only) → getDetails(photos) → getUrl.
  function _legacyPhoto(lib, q) {
    return new Promise(function (resolve) {
      try {
        if (!lib || !lib.PlacesService) return resolve(null);
        var svc = new lib.PlacesService(doc.createElement('div'));
        svc.findPlaceFromQuery({ query: q, fields: ['place_id'] }, function (results, status) {
          if (status !== 'OK' || !results || !results[0] || !results[0].place_id) return resolve(null);
          svc.getDetails({ placeId: results[0].place_id, fields: ['photos'] }, function (det, st2) {
            if (st2 === 'OK' && det && det.photos && det.photos.length) { try { return resolve({ url: det.photos[0].getUrl({ maxWidth: 800, maxHeight: 600 }), attribution: 'Google' }); } catch (e) {} }
            resolve(null);
          });
        });
      } catch (e) { resolve(null); }
    });
  }
  var _clientPhotoCache = {};
  function fetchPhotoClient(name, address) {
    var k = (String(name || '') + '|' + String(address || '')).toLowerCase();
    if (_clientPhotoCache[k]) return _clientPhotoCache[k];
    var q = (String(name || '') + (address ? ', ' + address : '')).trim();
    if (!q) { _clientPhotoCache[k] = Promise.resolve(null); return _clientPhotoCache[k]; }
    var pr = tcImport('places').then(function (lib) {
      if (!lib) return null;
      // NEW Places API (Places API New is enabled): Place.searchByText returns photos directly.
      if (lib.Place && typeof lib.Place.searchByText === 'function') {
        return lib.Place.searchByText({ textQuery: q, fields: ['photos', 'displayName', 'id'], maxResultCount: 1 })
          .then(function (res) {
            var places = res && res.places;
            if (places && places[0] && places[0].photos && places[0].photos.length) {
              try { return { url: places[0].photos[0].getURI({ maxWidth: 800, maxHeight: 600 }), attribution: 'Google' }; } catch (e) {}
            }
            return _legacyPhoto(lib, q); // fall back to legacy details if New returns no photos
          }).catch(function () { return _legacyPhoto(lib, q); });
      }
      return _legacyPhoto(lib, q);
    }).catch(function () { return null; });
    _clientPhotoCache[k] = pr;
    return pr;
  }
  // PlacePhotoProvider — real Google Places photos via the placePhotos callable; cached
  // per place. Sets state._photosUnavailable after a NO_MAPS_KEY so we stop calling.
  var _photoCache = {};
  function fetchPlacePhotos(name, address) {
    var k = (String(name || '') + '|' + String(address || '')).toLowerCase();
    if (_photoCache[k]) return _photoCache[k];
    var c = mkCallable('placePhotos', 18000);
    if (!c) return Promise.resolve({ ok: false, photos: [] });
    var pr = c({ name: name, address: address, lang: state.lang })
      .then(function (r) { return (r && r.data) || { ok: false, photos: [] }; })
      .catch(function () { return { ok: false, photos: [] }; });
    _photoCache[k] = pr;
    return pr;
  }
  var TravelTicketProvider = { // plane — search links only, never fake prices
    flightSearch: function (origin, dest, date) { return 'https://www.google.com/travel/flights?q=' + encodeURIComponent('flights from ' + (origin || '') + ' to ' + (dest || '') + (date ? ' on ' + date : '')); },
  };
  var BusTicketProvider = { // Vietnamese bus services — manual/search, never fake prices
    knownCompanies: ['Xe Hoàng (Hoang Express)', 'Xe Đông Hưng', 'Khác / Other'],
    search: function (origin, dest) { return 'https://www.google.com/search?q=' + encodeURIComponent('xe khách ' + (origin || '') + ' đi ' + (dest || '') + ' Hoang Express'); },
  };
  // ── Booking Concierge providers (mock/fallback: build official/search links only;
  // NEVER fake prices, availability, or confirmations; the app never purchases) ──────
  var BOOKING_TYPES = ['flight', 'hotel', 'airbnb', 'attraction', 'restaurant', 'tour', 'parking', 'rental_car', 'bus', 'ride', 'packing', 'payment', 'confirmation', 'other'];
  function gsearch(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
  var BookingLinkProvider = {
    // Returns { officialUrl, searchUrl } for a booking item; prefers a known official
    // page when the item already carries one, else a deterministic search link.
    links: function (item, trip) {
      var city = item.city || (trip && trip.destination) || '';
      var dates = (trip && trip.dateRange) ? ' ' + trip.dateRange : '';
      var title = item.title || '';
      switch (item.type) {
        case 'flight': return { officialUrl: '', searchUrl: TravelTicketProvider.flightSearch((trip && trip.departureCity) || '', city, trip && trip.dateRange) };
        case 'hotel': return { officialUrl: item.officialUrl || '', searchUrl: gsearch('hotels in ' + city + dates) };
        case 'airbnb': return { officialUrl: '', searchUrl: 'https://www.airbnb.com/s/' + encodeURIComponent(city) + '/homes' };
        case 'attraction': return { officialUrl: item.officialUrl || '', searchUrl: gsearch(title + ' official tickets ' + city) };
        case 'restaurant': return { officialUrl: item.officialUrl || '', searchUrl: gsearch(title + ' reservation ' + city) };
        case 'tour': return { officialUrl: item.officialUrl || '', searchUrl: gsearch(title + ' tour booking ' + city) };
        case 'parking': return { officialUrl: '', searchUrl: gsearch('parking reservation ' + (title || city)) };
        case 'rental_car': return { officialUrl: '', searchUrl: gsearch('rental car ' + city + dates) };
        case 'bus': return { officialUrl: item.officialUrl || '', searchUrl: BusTicketProvider.search((trip && trip.departureCity) || '', city) };
        case 'ride': return { officialUrl: '', searchUrl: gsearch('Du Lich Cali ride ' + city) };
        default: return { officialUrl: item.officialUrl || '', searchUrl: gsearch(title + ' ' + city) };
      }
    },
  };
  function newBooking(type, title, extra) {
    var vt = BOOKING_TYPES.indexOf(type) !== -1 ? type : 'attraction';
    var b = {
      id: uid('bk'), tripId: state.trip && state.trip.id, destinationId: '', dayId: '', placeId: '',
      type: vt, title: title || '', provider: '',
      officialUrl: '', searchUrl: '', priceRange: '', selectedOption: '', recommendedOption: '',
      deadline: '', bookingStatus: 'research_needed', confirmationNumber: '', bookedBy: '', notes: '',
      cancellationPolicy: '', refundPolicy: '', dataSource: 'user_entered', lastVerifiedAt: '',
      // Task Tracker fields (additive; legacy bookings still valid):
      priority: (root.TCTasks ? root.TCTasks.priority(vt) : 'P2'), assignedToFamily: '', assignedToMember: '', dueDate: '',
      costEstimate: '', actualCost: '', paidBy: '', splitMode: '', splitBetween: [], linkedSegmentId: '',
      bookedAt: '', bookingSource: '', // assisted-checkout: when + how a booking was confirmed (self_booked|dlc_ride_booking|'')
    };
    if (extra) for (var k in extra) b[k] = extra[k];
    return b;
  }
  function bookingKey(b) { return (b.type || '') + '::' + String(b.title || '').trim().toLowerCase() + '::' + (b.destinationId || '') + (b.placeId || ''); }
  // Derive candidate booking items from the itinerary (hotels per city, flights/bus
  // from transportation, reservation-worthy places). Heuristic; user edits win.
  function deriveBookingChecklist(trip) {
    var plan = trip.plan || {}, out = [], seen = {};
    var rej = rejectedNameSet(trip); // group-rejected / skipped places never enter the checklist
    function add(b) { var k = bookingKey(b); if (seen[k]) return; seen[k] = 1; out.push(b); }
    // Pinned must-do activities → ticket/reservation checklist items (any destination).
    (trip.pinnedActivities || []).forEach(function (pin) {
      if (!pin || !(pin.title || '').trim()) return;
      var pt = (pin.title || '').toLowerCase();
      var isFood = pin.preferredTimeOfDay === 'dinner' || pin.preferredTimeOfDay === 'lunch' || pin.preferredTimeOfDay === 'breakfast' || /\bfood\b|dinner|lunch|breakfast|restaurant|cuisine|vietnamese|pho|dining/.test(pt);
      if (isFood) add(newBooking('restaurant', t('taskChoose') + ': ' + pin.title, { city: pin.destination || trip.destination || '', priority: 'P1', dataSource: 'pinned_food_choice' })); // a "choose/vote" dining task (card shows a vote row)
      else add(newBooking('attraction', pin.title, { city: pin.destination || trip.destination || '', recommendedOption: t('pinnedBookingNote'), dataSource: 'pinned_must_do' }));
    });
    (trip.destinations || []).forEach(function (d) {
      if (!(d.city || '').trim() || d.hotelNeeded === false) return; // skip meal-stops / pass-throughs (no overnight)
      add(newBooking('hotel', (t('bt_hotel') + ' — ' + d.city), { destinationId: d.id, city: d.city, dataSource: 'derived_from_itinerary' }));
    });
    (plan.transportation || []).forEach(function (tp) {
      if (tp.method === 'plane') add(newBooking('flight', (t('bt_flight') + ': ' + (tp.origin || '') + ' → ' + (tp.destination || trip.destination || '')), { city: tp.destination || trip.destination || '', dataSource: 'derived_from_itinerary' }));
      else if (tp.method === 'bus') add(newBooking('bus', (t('bt_bus') + ': ' + (tp.origin || '') + ' → ' + (tp.destination || trip.destination || '')), { city: tp.destination || trip.destination || '', dataSource: 'derived_from_itinerary' }));
    });
    (plan.days || []).forEach(function (day) {
      var city = (planDestinations(plan)[day.destinationIndex || 0] || {}).city || trip.destination || '';
      (day.sections || []).forEach(function (sec) {
        (sec.places || []).forEach(function (p) {
          if (rej[(p.name || '').trim().toLowerCase()]) return; // skip group-rejected places
          var cat = ((p.category || '') + ' ' + (p.name || '')).toLowerCase();
          if (/theme ?park|disney|legoland|seaworld|knott|universal|aquarium|zoo|museum/.test(cat) || p.reservationUrl) {
            add(newBooking('attraction', p.name, { placeId: p.id || '', city: city, officialUrl: p.reservationUrl || p.websiteUrl || '', dataSource: 'derived_from_itinerary' }));
          } else if (/restaurant|dining|steak|sushi|fine/.test(cat) && p.reservationUrl) {
            add(newBooking('restaurant', p.name, { placeId: p.id || '', city: city, officialUrl: p.reservationUrl || '', dataSource: 'derived_from_itinerary' }));
          }
        });
      });
    });
    return out;
  }
  // Task Tracker generators (deterministic, V2/V3 data — deriveBookingChecklist's plan.transportation
  // is legacy). Idempotent via bookingKey; never clobber user edits/booked status.
  function lockedLegsTasks(tr) {
    var out = [];
    (tr.lockedLegs || []).forEach(function (lg) {
      var from = String(lg.fromCity || '').split(',')[0], to = String(lg.toCity || '').split(',')[0];
      if (!to) return;
      var isRide = lg.transportMode === 'private_ride' || /michael|dulichcali|du lich cali|\bdlc\b/i.test(lg.provider || '');
      var type = isRide ? 'ride' : (lg.transportMode === 'flight' ? 'flight' : 'bus');
      var verb = isRide ? t('taskConfirmRide') : t('taskBook');
      out.push(newBooking(type, verb + ' ' + (lg.provider ? lg.provider + ' · ' : '') + from + ' → ' + to,
        { city: to, provider: lg.provider || '', deadline: lg.date || '', dueDate: lg.date || '', linkedSegmentId: (lg.fromCity || '') + '>' + (lg.toCity || ''), dataSource: 'derived_from_locked_leg' }));
    });
    return out;
  }
  function transportChoiceTasks(tr) {
    var out = [];
    (tr.transport || []).forEach(function (leg, i) {
      var mode = chosenMode(leg, i);
      if (!mode || mode === 'personal_car') return;
      var type = (mode === 'flight') ? 'flight' : (mode === 'dlc_ride') ? 'ride' : 'bus';
      var from = String(leg.fromCity || '').split(',')[0], to = String(leg.toCity || '').split(',')[0];
      var opt = (leg.options || []).filter(function (o) { return o.mode === mode; })[0] || {};
      out.push(newBooking(type, t('taskBook') + ' ' + (opt.provider ? opt.provider + ' · ' : '') + from + ' → ' + to,
        { city: to, provider: opt.provider || '', priceRange: opt.totalCostRange || '', linkedSegmentId: legKeyOf(leg, i), dataSource: 'derived_from_transport_choice' }));
    });
    return out;
  }
  // Merge derived/AI items into trip.bookings WITHOUT clobbering user edits or
  // re-adding items the user already has (matched by bookingKey).
  function mergeBookings(trip, incoming) {
    trip.bookings = Array.isArray(trip.bookings) ? trip.bookings : [];
    var have = {}; trip.bookings.forEach(function (b) { have[bookingKey(b)] = 1; });
    (incoming || []).forEach(function (b) { if (!have[bookingKey(b)]) { have[bookingKey(b)] = 1; trip.bookings.push(b); } });
    return trip.bookings;
  }
  // One-call deterministic task generation — used on Tasks-tab open/rebuild + the acceptance test.
  // Idempotent (mergeBookings dedups by bookingKey); never clobbers user-edited tasks.
  function deriveTripTasks(tr) {
    if ((!tr.lockedLegs || !tr.lockedLegs.length) && tr.parsedJourney) { try { applyParsedJourneyToTrip(tr, tr.parsedJourney); } catch (e) {} }
    mergeBookings(tr, deriveBookingChecklist(tr));
    mergeBookings(tr, lockedLegsTasks(tr));
    mergeBookings(tr, transportChoiceTasks(tr));
    if (typeof ticketedAttractionBookings === 'function') mergeBookings(tr, ticketedAttractionBookings(tr));
    return tr.bookings;
  }
  // ── V6 Dependency Graph: tag each task → graph node and run the deterministic engine. ──
  function depKind(type) {
    type = String(type || '');
    if (/flight|bus|ride|rental_car|train/.test(type)) return 'transport';
    if (/hotel|airbnb/.test(type)) return 'lodging';
    if (/attraction|tour/.test(type)) return 'ticket';
    if (/restaurant/.test(type)) return 'food';
    return 'optional';
  }
  function _cityShort(c) { return String(c || '').split(',')[0].trim().toLowerCase(); }
  // Map tasks → dependency-graph nodes using the journey backbone (ordered transport legs). Each
  // non-transport task inherits the journeyIndex of the leg that ARRIVES at its city (dueDate
  // disambiguates a city visited twice, e.g. OC). Unmappable tasks → Infinity (unscheduled, never
  // block). Returns { tasks (enriched with _dep), nextAction (the booking), progress }.
  function buildDepNodes(tr) {
    var tasks = []; try { tasks = deriveTripTasks(tr) || []; } catch (e) { tasks = tr.bookings || []; }
    if (!root.TCDepGraph) return { tasks: tasks, nextAction: null, progress: null };
    var legSrc = (tr.transport && tr.transport.length) ? tr.transport : (tr.lockedLegs || []);
    var legs = legSrc.map(function (lg, i) {
      return { index: i, toCity: _cityShort(lg.toCity), fromCity: _cityShort(lg.fromCity), date: lg.date || lg.dueDate || '', key: (typeof legKeyOf === 'function' ? legKeyOf(lg, i) : ((lg.fromCity || '') + '>' + (lg.toCity || ''))), isReturn: lg.legType === 'return' };
    });
    var now = new Date();
    var mapped = tasks.map(function (b) {
      var kind = depKind(b.type);
      // DIRECTION-AWARE mapping: a ride/transport task matches the leg with BOTH its from+to city
      // (so SD→OC and OC→SD don't collide on the shared OC endpoint). journeyIndexFor falls back to
      // arrival-city + dueDate for lodging/tickets/food. Pass the task's route hints through.
      var jIdx = root.TCDepGraph.journeyIndexFor({ kind: kind, city: _cityShort(b.city), fromCity: b.fromCity, toCity: b.toCity, linkedSegmentId: b.linkedSegmentId, title: b.title, dueDate: b.dueDate }, legs);
      var du = null; if (b.dueDate) { var d = new Date(b.dueDate); if (!isNaN(d)) du = Math.ceil((d - now) / 86400000); }
      return { id: b.id, kind: kind, city: _cityShort(b.city), journeyIndex: jIdx, status: b.bookingStatus || 'research_needed', daysUntilDue: du, pinned: /pinned/.test(b.dataSource || ''), votes: 0, type: b.type, title: b.title };
    });
    var dg = root.TCDepGraph.build(mapped);
    var depById = {}; dg.nodes.forEach(function (n) { depById[n.id] = n; });
    tasks.forEach(function (b) { var n = depById[b.id]; b._dep = n ? { blocked: n.blocked, reason: n.blockedReason, score: n.priorityScore, deps: n.dependencies, kind: n.kind, idx: n.journeyIndex } : null; });
    var na = dg.nextAction ? tasks.filter(function (b) { return b.id === dg.nextAction.id; })[0] : null;
    var warns = root.TCDepGraph.warnings(dg.nodes);
    // return-trip check (needs leg knowledge): the journey doesn't end where it started → missing the way home
    if (legs.length && legs[0].fromCity && legs[0].fromCity !== legs[legs.length - 1].toCity) warns.push({ key: 'warn_return_missing', level: 'warn' });
    return { tasks: tasks, nextAction: na || null, progress: dg.progress, warnings: warns };
  }
  // AI booking research callable (Gemini grounded). Never blocks; returns [] on failure.
  function researchBookings(trip) {
    var c = mkCallable('researchTripBookings', 42000);
    if (!c) return Promise.resolve({ items: [] });
    var keyPlaces = [];
    try { (trip.plan && trip.plan.days || []).forEach(function (d) { (d.sections || []).forEach(function (s) { (s.places || []).forEach(function (p) { if (p && p.name) keyPlaces.push(p.name); }); }); }); } catch (e) {}
    return c({ trip: { destination: trip.destination, destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families, keyPlaces: keyPlaces }, lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { items: d.items || [] }; })
      .catch(function () { return { items: [] }; });
  }
  // ── "Where to Stay" lodging research + deterministic search links (real provider
  //    SEARCH URLs only — never fabricated listing/booking links). ──
  function stayQ(h, city) { return (((h && h.name && h.name.trim()) ? h.name : ('hotels ' + ((h && h.area) || ''))) + ' ' + (city || '')).trim(); }
  var StayLinkProvider = {
    hotel: function (h, city) { var q = (h && h.name && h.name.trim()) ? (h.name + ' ' + (city || '')) : ('hotels ' + ((h && h.area) || city || '')); return gsearch(q.trim()); },
    booking: function (h, city) { return 'https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(stayQ(h, city)); },
    hotels: function (h, city) { return gsearch('Hotels.com ' + stayQ(h, city)); },
    expedia: function (h, city) { return gsearch('Expedia ' + stayQ(h, city)); },
    tripadvisor: function (h, city) { return 'https://www.tripadvisor.com/Search?q=' + encodeURIComponent(stayQ(h, city)); },
    googleReviews: function (h, city) { return gsearch(stayQ(h, city) + ' reviews'); },
    photos: function (h, city) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(stayQ(h, city)); },
    airbnb: function (area, city) { return 'https://www.airbnb.com/s/' + encodeURIComponent(((area || '') + ' ' + (city || '')).trim()) + '/homes'; },
  };
  // Grounded research agents (Gemini) can transiently fail under load → ok:false. Retry the
  // callable ONCE on an explicit failure (ok===false) or a thrown error — NOT on a legitimate
  // empty result (ok:true with no items), so a single-city trip with no stopovers/events never
  // wastes a call. Self-heals the transient RESEARCH_ERROR a user would otherwise have to re-tap.
  function callWithRetry(c, args) {
    function attempt() { return c(args); }
    return attempt().then(function (r) {
      var d = (r && r.data) || {};
      if (d && d.ok === false) {
        return attempt().then(function (r2) { var d2 = (r2 && r2.data) || {}; return (d2 && d2.ok === false) ? r : r2; }).catch(function () { return r; });
      }
      return r;
    }, function () { return attempt(); });
  }
  function researchStays(trip) {
    var c = mkCallable('researchTripStays', 48000);
    if (!c) return Promise.resolve({ stays: [], strategies: [] });
    return callWithRetry(c, { trip: { destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families }, avoidPlaces: rejectedNames(trip), preferredPlaces: preferredNames(trip), lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { stays: d.stays || [], strategies: d.strategies || [] }; })
      .catch(function () { return { stays: [], strategies: [] }; });
  }
  // ── "Food Picks" restaurant research + deterministic search links ──
  var FoodLinkProvider = {
    search: function (p, city) {
      var q = (p && p.name && p.name.trim()) ? (p.name + ' ' + (city || '')) : ('restaurants ' + ((p && p.cuisine) ? (p.cuisine + ' ') : '') + (city || ''));
      return gsearch(q.trim());
    },
    yelp: function (p, city) {
      var desc = (p && p.name && p.name.trim()) ? p.name : (((p && p.cuisine) || '') + ' restaurants');
      return 'https://www.yelp.com/search?find_desc=' + encodeURIComponent(desc.trim()) + '&find_loc=' + encodeURIComponent((city || '').trim());
    },
    // Real-photo / review / menu / website are LINKS (never embedded as a fake photo).
    photos: function (name, city) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(((name || '') + ' ' + (city || '')).trim()); },
    googleReviews: function (name, city) { return gsearch(((name || '') + ' ' + (city || '') + ' reviews').trim()); },
    menu: function (name, city) { return gsearch(((name || '') + ' ' + (city || '') + ' menu').trim()); },
    website: function (name, city) { return gsearch(((name || '') + ' ' + (city || '') + ' official website').trim()); },
    tripadvisor: function (name, city) { return 'https://www.tripadvisor.com/Search?q=' + encodeURIComponent(((name || '') + ' ' + (city || '')).trim()); },
  };
  function researchRestaurants(trip) {
    var c = mkCallable('researchTripRestaurants', 48000);
    if (!c) return Promise.resolve({ food: [] });
    return callWithRetry(c, { trip: { destination: trip.destination, destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families }, avoidPlaces: rejectedNames(trip), preferredPlaces: preferredNames(trip), likedCuisines: (buildPreferenceProfile(trip).likedCuisines || []), lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { food: d.food || [] }; })
      .catch(function () { return { food: [] }; });
  }
  // Ticketed attractions across the trip (name + city + category), rejected ones filtered out.
  function ticketedAttractions(tr) {
    var out = [], seen = {};
    (tr.attractions || []).forEach(function (d) {
      (d.attractions || []).forEach(function (a) {
        if (!a || !a.ticketed || !a.name) return;
        var k = (a.name || '').trim().toLowerCase(); if (!k || seen[k] || rejectedNameSet(tr)[k]) return;
        seen[k] = 1; out.push({ name: a.name, city: d.city || '', category: a.category || '' });
      });
    });
    return out;
  }
  // Ticket DEAL Hunter — grounded deal-intelligence for the trip's ticketed attractions
  // (multi-day/family/early-bird/combo/membership/discounts). Honest est. ranges; never books.
  function researchTicketDeals(tr) {
    var c = mkCallable('researchTicketDeals', 50000);
    var attractions = ticketedAttractions(tr);
    if (!attractions.length) return Promise.resolve({ ok: false, deals: [], none: true });
    if (!c) return Promise.resolve({ ok: false, deals: [] });
    return callWithRetry(c, { trip: { dateRange: tr.dateRange, budget: tr.budget, families: tr.families }, attractions: attractions, lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { ok: d.ok === true, deals: d.deals || [] }; })
      .catch(function () { return { ok: false, deals: [] }; });
  }
  // Deterministic, never-fabricated ticket links (official search + deal comparison search).
  var TicketDealLinkProvider = {
    official: function (name) { return 'https://www.google.com/search?q=' + encodeURIComponent((name || '') + ' official tickets'); },
    deals: function (name) { return 'https://www.google.com/search?q=' + encodeURIComponent((name || '') + ' ticket discount deals'); },
  };
  // Phase B — AI Transportation Agent. Compares modes per major leg (origin→dest→…→home);
  // car/DLC-ride distance+time are verified server-side, never invented. Returns trip.transport.
  function researchTransport(trip) {
    var c = mkCallable('researchTripTransport', 50000);
    if (!c) return Promise.resolve({ legs: [] });
    return c({ trip: { departureCity: trip.departureCity, destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families, returnTransportPreference: trip.returnTransportPreference || 'any', returnProvider: trip.returnProvider || '', lockedLegs: trip.lockedLegs || [] }, lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { legs: d.legs || [], source: d.source || 'estimated', researchedAt: d.researchedAt || 0 }; })
      .catch(function () { return { legs: [] }; });
  }
  // Deal Hunter — grounded CURRENT-FARE research per leg (honest estimates, pending verification).
  function researchFares(tr) {
    var c = mkCallable('researchLegFares', 60000);
    if (!c) return Promise.resolve({ ok: false, legs: [] });
    var legs = (tr.transport || []).map(function (l) { return { fromCity: l.fromCity, toCity: l.toCity }; });
    if (!legs.length && Array.isArray(tr.lockedLegs)) legs = tr.lockedLegs.map(function (l) { return { fromCity: l.fromCity, toCity: l.toCity }; });
    if (!legs.length) return Promise.resolve({ ok: false, legs: [] });
    return callWithRetry(c, { legs: legs, lang: state.lang }).then(function (r) { var d = (r && r.data) || {}; return { ok: d.ok === true, legs: d.legs || [], sourceNote: d.sourceNote || '', researchedAt: d.researchedAt || 0, status: d.status || 'estimated' }; }).catch(function () { return { ok: false, legs: [] }; });
  }
  // V3 AI Transport STRATEGY + TRANSFER agent — research-driven multi-leg strategies, transfer
  // hubs, return intelligence (grounded; pending-verification). Falls back to the deterministic
  // per-leg compare above. Grounded → wrapped in callWithRetry (self-heals transient empties).
  function researchTransportStrategies(trip) {
    var c = mkCallable('researchTransportStrategies', 90000); // server may make 2 grounded attempts
    if (!c) return Promise.resolve({ ok: false, modes: [], transferHubs: [], strategies: [], returnIntelligence: {} });
    return callWithRetry(c, { trip: { departureCity: trip.departureCity, destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families, returnTransportPreference: trip.returnTransportPreference || 'any', returnProvider: trip.returnProvider || '' }, transportPreference: trip.transportPreference || 'any', lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { ok: d.ok === true, connectionPlan: d.connectionPlan || null, modes: d.modes || [], transferHubs: d.transferHubs || [], strategies: d.strategies || [], returnIntelligence: d.returnIntelligence || {}, preference: d.preference || '', driveSource: d.driveSource || '' }; })
      .catch(function () { return { ok: false, connectionPlan: null, modes: [], transferHubs: [], strategies: [], returnIntelligence: {} }; });
  }
  // Family Analysis Agent (deterministic) — group traits, not attractions. Mirrors the server
  // tcGroupProfile; used for the Top-Picks UI + (optionally) passed to research.
  function analyzeGroupProfile(families, budget, pace) {
    families = families || []; var adults = 0, seniors = 0, ages = [];
    families.forEach(function (f) { f = f || {}; adults += (f.adults || 0); seniors += (f.seniors || 0); String(f.childrenAges || '').split(/[,\s]+/).forEach(function (x) { var n = parseInt(x, 10); if (!isNaN(n)) ages.push(n); }); });
    var kids = ages.filter(function (a) { return a <= 12; }).length, teens = ages.filter(function (a) { return a >= 13 && a <= 17; }).length, toddlers = ages.filter(function (a) { return a <= 3; }).length;
    var relaxed = pace === 'relaxed', packed = pace === 'packed', lowBudget = budget === 'budget';
    return {
      travelers: adults + seniors + ages.length, adults: adults, seniors: seniors, kids: kids, teens: teens, toddlers: toddlers,
      childFocused: kids > 0, teenFocused: teens > 0, seniorSensitive: seniors > 0, multiGen: seniors > 0 && (kids > 0 || teens > 0),
      thrillSeeking: teens > 0 && !relaxed, themeParkAffinity: (kids || teens) ? (lowBudget ? 'medium' : 'high') : (relaxed ? 'low' : 'medium'),
      walkingTolerance: (seniors > 0 || toddlers > 0) ? (seniors > adults ? 'low' : 'medium') : (relaxed ? 'medium' : 'high'),
      energyLevel: packed ? 'high' : (relaxed ? 'low' : 'medium'), budget: budget || 'moderate', pace: pace || 'balanced',
    };
  }
  // Destination Intelligence + Ranking — ranks each destination's signature attractions for
  // the group (server agent). Returns trip.attractions[{city, attractions[]}].
  function researchAttractions(trip) {
    var c = mkCallable('rankDestinationAttractions', 50000);
    if (!c) return Promise.resolve({ destinations: [] });
    return callWithRetry(c, { trip: { destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families }, avoidPlaces: rejectedNames(trip), lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { destinations: d.destinations || [], groupProfile: d.groupProfile || null }; })
      .catch(function () { return { destinations: [] }; });
  }
  // Event Discovery Agent — current/temporary events matching the trip dates.
  function researchEvents(trip) {
    var c = mkCallable('researchTripEvents', 50000);
    if (!c) return Promise.resolve({ destinations: [] });
    return callWithRetry(c, { trip: { destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families }, dateList: (parseTripDates(trip.dateRange) || {}).dates || [], avoidPlaces: rejectedNames(trip), preferredPlaces: preferredNames(trip), lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { destinations: d.destinations || [] }; })
      .catch(function () { return { destinations: [] }; });
  }
  // Weather Agent — REAL Open-Meteo forecast (≤16 days) + labelled seasonal normals beyond, per
  // destination + its dates. Caches resolved lat/lng back onto the segment to skip re-geocoding.
  function researchWeather(trip) {
    var c = mkCallable('researchTripWeather', 45000);
    if (!c) return Promise.resolve({ destinations: [] });
    return callWithRetry(c, { trip: { destination: trip.destination, destinations: (trip.destinations || []).map(function (d) { return { city: d.city, role: d.role, lat: d._lat, lng: d._lng, arrivalDate: d.arrivalDate, departureDate: d.departureDate, startDate: d.startDate, endDate: d.endDate }; }), dateRange: trip.dateRange, families: trip.families }, lang: state.lang })
      .then(function (r) {
        var d = (r && r.data) || {};
        (d.destinations || []).forEach(function (wd) { var seg = (trip.destinations || []).filter(function (s) { return (s.city || '') === (wd.city || ''); })[0]; if (seg && wd.lat != null) { seg._lat = wd.lat; seg._lng = wd.lng; } });
        return { destinations: d.destinations || [] };
      })
      .catch(function () { return { destinations: [] }; });
  }
  // AI Social Clip — builds an EXPORT PACKAGE (storyboard / captions / voiceover / overlays /
  // hashtags / per-platform post text) from the SELECTED media. Never renders a video (that lives
  // in the separate ai_social_content_agent) and never auto-posts. Consent-gated by the caller.
  function generateClipPackage(trip, sel, opts) {
    var c = mkCallable('generateTripClipPackage', 50000);
    if (!c) return Promise.resolve({ ok: false });
    opts = opts || {};
    var media = (sel || []).slice(0, 30).map(function (m) { return { caption: m.caption || '', tags: m.tags || [], day: m.day || '', place: m.place || '', mediaType: m.mediaType || 'photo' }; });
    return c({ trip: { destinations: trip.destinations, dateRange: trip.dateRange, groupName: trip.groupName, families: trip.families }, media: media, platform: opts.platform || 'tiktok', mood: opts.mood || 'fun', length: opts.length || 'short', lang: state.lang })
      .then(function (r) { return (r && r.data) || { ok: false }; })
      .catch(function () { return { ok: false }; });
  }
  // Tour Discovery Agent — real tours & unique experiences per destination (consensus-aware).
  function researchTours(trip) {
    var c = mkCallable('researchTripTours', 50000);
    if (!c) return Promise.resolve({ destinations: [] });
    return callWithRetry(c, { trip: { destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families }, avoidPlaces: rejectedNames(trip), preferredPlaces: preferredNames(trip), lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { destinations: d.destinations || [] }; })
      .catch(function () { return { destinations: [] }; });
  }
  // Stopover Agent — smart stops on long drive legs.
  function researchStopovers(trip) {
    var c = mkCallable('researchTripStopovers', 50000);
    if (!c) return Promise.resolve({ legs: [] });
    return callWithRetry(c, { trip: { departureCity: trip.departureCity, destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families }, avoidPlaces: rejectedNames(trip), preferredPlaces: preferredNames(trip), lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { legs: d.legs || [] }; })
      .catch(function () { return { legs: [] }; });
  }
  // Travel-Day Route Opportunities — optional insertions to discover ALONG each leg. Passes
  // rejected names (skipped never return) + pins (build around them); recommend-only.
  function researchRouteOps(trip) {
    var c = mkCallable('researchTripRouteOpportunities', 55000);
    if (!c) return Promise.resolve({ legs: [] });
    return callWithRetry(c, { trip: { departureCity: trip.departureCity, destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families, pinnedActivities: trip.pinnedActivities }, avoidPlaces: rejectedNames(trip), lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { legs: d.legs || [] }; })
      .catch(function () { return { legs: [] }; });
  }
  // Experience Optimizer Agent — "How can this trip be better?" toward one OR MORE goals.
  // Suggestions only. Accepts an array of goals (multi-select) or a single goal string.
  function improveTrip(trip, goals) {
    var c = mkCallable('improveTripPlan', 50000);
    if (!c) return Promise.resolve({ suggestions: [] });
    var list = Array.isArray(goals) ? goals.slice() : (goals ? [goals] : []);
    var planDays = ((trip.plan && trip.plan.days) || []).slice(0, 12).map(function (d, i) { return { day: i + 1, title: d.title || '', summary: d.summary || '', city: destCityName(trip.plan, d.destinationIndex || 0) }; });
    var est = ''; try { est = '$' + computeTripCosts(trip).total.expected; } catch (e) {}
    // Send the full goal LIST (the AI balances tradeoffs across all of them); keep `goal`
    // = the first one for backward compatibility with older server builds. The group's VOTES
    // become AI signals: skipped never re-suggested, liked/favorited prioritized + kept, and the
    // evolving TripPreferenceProfile tailors the optimization.
    return callWithRetry(c, { trip: { destinations: trip.destinations, dateRange: trip.dateRange, budget: trip.budget, tripStyle: trip.tripStyle, families: trip.families, pinnedActivities: trip.pinnedActivities }, improvementGoals: list, goal: list[0] || 'general', planDays: planDays, skippedPlaces: rejectedNames(trip), likedPlaces: likedNames(), favoritePlaces: favoritedNames(), preferenceProfile: buildPreferenceProfile(trip), votesSummary: votesSummaryText(trip), estTotalCost: est, lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { suggestions: d.suggestions || [], summary: d.summary || '', goals: (d.goals && d.goals.length) ? d.goals : list }; })
      .catch(function () { return { suggestions: [] }; });
  }
  // Ticketed signature attractions → booking checklist entries (deduped by mergeBookings).
  function ticketedAttractionBookings(tr) {
    var out = [], rej = rejectedNameSet(tr); // never re-introduce a rejected place via destination intelligence
    ((tr && tr.attractions) || []).forEach(function (d) {
      (d.attractions || []).forEach(function (a) {
        if (a && a.ticketed && a.name && !rej[(a.name || '').trim().toLowerCase()]) out.push(newBooking('attraction', a.name, { city: d.city || '', recommendedOption: a.why || '', dataSource: 'signature_attraction_pending_verification' }));
      });
    });
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TRIP COST AGENT + FAMILY COST SPLIT — deterministic + transparent. These
  //  are EDITABLE ESTIMATE ASSUMPTIONS (clearly labelled), never fake live prices.
  //  Pulls real signals where available (verified miles, nights, travelers,
  //  ticketed attractions). Owner edits assumptions; all members can view.
  // ════════════════════════════════════════════════════════════════════════
  var COST_ASSUMPTIONS = {
    foodPerPersonPerDay: { budget: 30, moderate: 55, luxury: 110 },
    hotelPerNight: { budget: 130, moderate: 220, luxury: 420 },
    gasPerMile: 0.18, ticketPerPerson: 90, parkingPerDay: 25, snacksPerPersonPerDay: 12,
    souvenirsPerFamily: 60, tipsPct: 0.10, bufferPct: 0.10,
  };
  function tierVal(map, tier) { return map[tier] != null ? map[tier] : map.moderate; }
  function initCostAssumptions(tr) {
    if (tr.costAssumptions && tr.costAssumptions._init) return tr.costAssumptions;
    var tier = tr.budget || 'moderate';
    tr.costAssumptions = {
      _init: true,
      foodPerPersonPerDay: tierVal(COST_ASSUMPTIONS.foodPerPersonPerDay, tier),
      hotelPerNight: tierVal(COST_ASSUMPTIONS.hotelPerNight, tier),
      gasPerMile: COST_ASSUMPTIONS.gasPerMile, ticketPerPerson: COST_ASSUMPTIONS.ticketPerPerson,
      parkingPerDay: COST_ASSUMPTIONS.parkingPerDay, snacksPerPersonPerDay: COST_ASSUMPTIONS.snacksPerPersonPerDay,
      souvenirsPerFamily: COST_ASSUMPTIONS.souvenirsPerFamily, tipsPct: COST_ASSUMPTIONS.tipsPct, bufferPct: COST_ASSUMPTIONS.bufferPct,
    };
    return tr.costAssumptions;
  }
  function famTravelers(f) { return (f.adults || 0) + (f.seniors || 0) + String(f.childrenAges || '').split(/[,\s]+/).filter(function (x) { return /\d/.test(x); }).length; }
  function tpCostMid(s) { var m = String(s || '').replace(/,/g, '').match(/\d+/g); if (!m) return 0; if (m.length >= 2) return (parseInt(m[0], 10) + parseInt(m[1], 10)) / 2; return parseInt(m[0], 10); }
  function computeTripCosts(tr) {
    var a = initCostAssumptions(tr);
    var perFam = (tr.families || []).map(function (f, i) { return { id: f.id || ('f' + i), name: f.name || ('#' + (i + 1)), travelers: famTravelers(f) }; });
    if (!perFam.length) perFam = [{ id: 'f0', name: '#1', travelers: 1 }];
    var travelers = perFam.reduce(function (s, f) { return s + f.travelers; }, 0) || 1;
    var parsed = parseTripDates(tr.dateRange) || { count: 1 };
    var days = parsed.count || 1, nights = Math.max(0, days - 1);
    var rooms = perFam.reduce(function (s, f) { return s + Math.max(1, Math.ceil(f.travelers / 4)); }, 0) || 1;
    var cars = Math.max(1, Math.ceil(travelers / 4));
    var items = [];
    function add(cat, title, expected, opt) { opt = opt || {}; if (!(expected > 0)) return; items.push({ category: cat, title: title, amountExpected: Math.round(expected), amountLow: Math.round(expected * (opt.lowF || 0.8)), amountHigh: Math.round(expected * (opt.highF || 1.3)), required: opt.required !== false, source: 'estimate', verificationStatus: 'estimate' }); }
    // Transport: verified miles → fuel; plus any chosen flight/bus/train option range.
    var miles = 0; (tr.transport || []).forEach(function (lg) { var m = parseInt(String(lg.driveDistanceText || '').replace(/[^\d]/g, ''), 10); if (m) miles += m; });
    if (miles) add('transport', t('costFuel'), miles * a.gasPerMile * cars, { highF: 1.4 });
    (tr.transport || []).forEach(function (lg, i) {
      var cm = (tr.transportChoice || {})[(lg.legType || 'leg') + ':' + (lg.fromCity || '') + '>' + (lg.toCity || '') + ':' + i];
      if (cm === 'flight' || cm === 'bus' || cm === 'train') { var o = (lg.options || []).filter(function (x) { return x.mode === cm; })[0]; var mid = o ? tpCostMid(o.totalCostRange) : 0; if (mid) add('transport', t('tm_' + cm) + ' (' + (lg.fromCity || '').split(',')[0] + '→' + (lg.toCity || '').split(',')[0] + ')', mid, { highF: 1.5 }); }
    });
    // Stay
    add('stay', t('costHotel'), rooms * nights * a.hotelPerNight, { highF: 1.4 });
    // Activities
    var ticketed = 0; (tr.attractions || []).forEach(function (d) { (d.attractions || []).forEach(function (at) { if (at.ticketed) ticketed++; }); });
    if (ticketed) add('activities', t('costTickets'), ticketed * travelers * a.ticketPerPerson, { highF: 1.4 });
    add('activities', t('costParking'), days * a.parkingPerDay);
    // Food
    add('food', t('costFood'), travelers * days * a.foodPerPersonPerDay * (1 + a.tipsPct), { highF: 1.4 });
    add('food', t('costSnacks'), travelers * days * a.snacksPerPersonPerDay);
    // Other
    add('other', t('costSouvenirs'), perFam.length * a.souvenirsPerFamily, { required: false });
    var subtotal = items.reduce(function (s, i) { return s + i.amountExpected; }, 0);
    add('other', t('costBuffer'), subtotal * a.bufferPct, { lowF: 0.5, highF: 1.5 });
    var total = { low: 0, expected: 0, high: 0 }, byCategory = {};
    items.forEach(function (i) { total.low += i.amountLow; total.expected += i.amountExpected; total.high += i.amountHigh; byCategory[i.category] = (byCategory[i.category] || 0) + i.amountExpected; });
    return { items: items, total: total, byCategory: byCategory, travelers: travelers, days: days, nights: nights, rooms: rooms, cars: cars, perFamilies: perFam, perPerson: Math.round(total.expected / travelers), perDay: Math.round(total.expected / days), assumptions: a };
  }
  function costSplit(tr) { tr.costSplit = tr.costSplit || { mode: 'per_person' }; return tr.costSplit; }
  function familyShares(tr, costs) {
    var split = costSplit(tr), fams = costs.perFamilies, total = costs.total.expected, totalTrav = costs.travelers || 1;
    var ownerFam = split.ownerFamilyId || (fams[0] && fams[0].id);
    return fams.map(function (f) {
      var share;
      if (split.mode === 'equal') share = total / fams.length;
      else if (split.mode === 'per_family') { var pct = (split.custom && split.custom[f.id] != null) ? split.custom[f.id] : (100 / fams.length); share = total * pct / 100; }
      else if (split.mode === 'owner_pays') share = (f.id === ownerFam) ? total : 0;
      else share = total * (f.travelers / totalTrav); // per_person (default)
      return { id: f.id, name: f.name, travelers: f.travelers, share: Math.round(share) };
    });
  }
  function costLedger(tr) { tr.costLedger = tr.costLedger || []; return tr.costLedger; }
  function addLedgerEntry(tr, familyId, title, amount) { costLedger(tr).push({ id: uid('cl'), familyId: familyId || '', title: title || '', amount: +amount || 0, paid: false, notes: '', createdAt: new Date().toISOString() }); saveTrip(tr); render(); }
  function toggleLedgerPaid(tr, id) { costLedger(tr).forEach(function (e) { if (e.id === id) e.paid = !e.paid; }); saveTrip(tr); render(); }
  function removeLedgerEntry(tr, id) { tr.costLedger = costLedger(tr).filter(function (e) { return e.id !== id; }); saveTrip(tr); render(); }

  // ── Mock TravelPlanGenerator — used when the AI callable is unavailable ──
  function mockPlan(trip) {
    var samples = root.TC_SAMPLES || {};
    var key = /vegas/i.test(trip.destination) ? 'las_vegas' : 'san_diego';
    var base = samples[key] || samples.san_diego || samples[Object.keys(samples)[0]];
    if (!base) return null;
    var plan = JSON.parse(JSON.stringify(base));
    plan.groupName = trip.groupName || plan.groupName;
    plan.dateRange = trip.dateRange || plan.dateRange;
    plan.dataSource = 'mock_sample_pending_verification';
    return plan;
  }

  function generatePlan(trip) {
    // Try the server AI; gracefully fall back to a mock sample.
    var payload = { trip: trip, lang: state.lang };
    var callable = null;
    try {
      if (root.firebase && root.firebase.functions) callable = root.firebase.functions().httpsCallable('generateGroupTripPlan', { timeout: 120000 });
    } catch (e) {}
    if (!callable) return Promise.resolve({ plan: mockPlan(trip), fallback: true });
    return callable(payload).then(function (res) {
      var d = (res && res.data) || {};
      if (d.ok && d.plan && d.plan.days && d.plan.days.length) return { plan: d.plan, fallback: false };
      return { plan: mockPlan(trip), fallback: true };
    }).catch(function () { return { plan: mockPlan(trip), fallback: true }; });
  }
  function mkCallable(name, timeout) {
    try { if (root.firebase && root.firebase.functions) return root.firebase.functions().httpsCallable(name, { timeout: timeout || 45000 }); } catch (e) {}
    return null;
  }
  // ── Shared trip access: callable wrappers + role resolution ────────────
  var TripShare = {
    create: function (tripId, ownerName, ownerFamilyId) { var c = mkCallable('createTripShareAccess', 20000); return c ? c({ tripId: tripId, ownerName: ownerName || '', ownerFamilyId: ownerFamilyId || '' }).then(function (r) { return r.data; }) : Promise.reject(new Error('no_fn')); },
    preview: function (token) { var c = mkCallable('getTripSharePreview', 15000); return c ? c({ shareToken: token }).then(function (r) { return r.data; }) : Promise.resolve({ ok: false }); },
    join: function (token, passcode, info) { var c = mkCallable('joinTripWithPasscode', 20000); if (!c) return Promise.reject(new Error('no_fn')); info = info || {}; return c({ shareToken: token, passcode: passcode, displayName: info.displayName || '', phone: info.phone || '', email: info.email || '', familyId: info.familyId || '', familyName: info.familyName || '', requestedRole: info.requestedRole || 'member' }).then(function (r) { return r.data; }); },
    setRole: function (tripId, memberUid, role) { var c = mkCallable('setTripMemberRole', 15000); return c ? c({ tripId: tripId, memberUid: memberUid, role: role }).then(function (r) { return r.data; }) : Promise.reject(new Error('no_fn')); },
    setEnabled: function (tripId, enabled) { var c = mkCallable('setTripShareEnabled', 15000); return c ? c({ tripId: tripId, enabled: enabled }).then(function (r) { return r.data; }) : Promise.reject(new Error('no_fn')); },
    decide: function (tripId, suggestionId, status) { var c = mkCallable('decideTripSuggestion', 20000); return c ? c({ tripId: tripId, suggestionId: suggestionId, status: status }).then(function (r) { return r.data; }) : Promise.reject(new Error('no_fn')); },
    remove: function (tripId, memberUid) { var c = mkCallable('removeTripMember', 15000); return c ? c({ tripId: tripId, memberUid: memberUid }).then(function (r) { return r.data; }) : Promise.reject(new Error('no_fn')); },
    setFamily: function (tripId, memberUid, familyId, familyName) { var c = mkCallable('setTripMemberFamily', 15000); return c ? c({ tripId: tripId, memberUid: memberUid, familyId: familyId || '', familyName: familyName || '' }).then(function (r) { return r.data; }) : Promise.reject(new Error('no_fn')); },
    invite: function (tripId, info) { var c = mkCallable('inviteTripMember', 15000); if (!c) return Promise.reject(new Error('no_fn')); info = info || {}; return c({ tripId: tripId, displayName: info.displayName || '', phone: info.phone || '', email: info.email || '', familyId: info.familyId || '', familyName: info.familyName || '', role: info.role || 'member' }).then(function (r) { return r.data; }); },
    del: function (tripId) { var c = mkCallable('deleteGroupTrip', 15000); return c ? c({ tripId: tripId }).then(function (r) { return r.data; }) : Promise.reject(new Error('no_fn')); },
  };
  // Member contact info (phone/email) — owner-readable only; loaded for the owner's member list.
  function loadMemberContacts() {
    var tr = state.trip; if (!tr || !root.dlcDb || !isOwnerOfTrip()) return Promise.resolve({});
    return root.dlcDb.collection('tripMemberContacts').doc(tr.id).collection('members').get()
      .then(function (snap) { var m = {}; snap.forEach(function (d) { m[d.id] = d.data() || {}; }); state._contacts = m; return m; })
      .catch(function () { state._contacts = {}; return {}; });
  }
  // Local per-trip member session marker (so we don't re-ask the passcode every time).
  function memberSessionKey(tripId) { return 'tc_member_' + tripId; }
  function getMemberSession(tripId) { try { var raw = root.localStorage.getItem(memberSessionKey(tripId)); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function setMemberSession(tripId, info) { try { root.localStorage.setItem(memberSessionKey(tripId), JSON.stringify(info)); } catch (e) {} }
  function clearMemberSession(tripId) { try { root.localStorage.removeItem(memberSessionKey(tripId)); } catch (e) {} }
  // Joined-trips index: tripIds the current account joined via passcode (per-uid, local).
  // Lets the dashboard list "Trips you joined" without a collectionGroup query/rule change.
  function joinedKey() { var u = realUser(); return 'tc_joined_' + (u ? u.uid : 'anon'); }
  function joinedTripIds() { try { var raw = root.localStorage.getItem(joinedKey()); var a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function rememberJoinedTrip(tripId) { if (!tripId) return; try { var a = joinedTripIds(); if (a.indexOf(tripId) === -1) { a.push(tripId); root.localStorage.setItem(joinedKey(), JSON.stringify(a.slice(-50))); } } catch (e) {} }
  function forgetJoinedTrip(tripId) { try { var a = joinedTripIds().filter(function (x) { return x !== tripId; }); root.localStorage.setItem(joinedKey(), JSON.stringify(a)); } catch (e) {} }
  function isOwnerOfTrip() { var u = realUser(); return !!(u && state.trip && state.trip.ownerUid && state.trip.ownerUid === u.uid); }
  function canApprove() { return state.myRole === 'owner' || state.myRole === 'organizer'; }
  // Resolve the caller's role for the current trip (owner via ownerUid, else membership doc).
  function resolveMyRole() {
    state._members = null; state._contacts = null; // force member-list + contacts reload for the freshly-loaded trip
    return new Promise(function (resolve) {
      if (isOwnerOfTrip()) { state.myRole = 'owner'; return resolve('owner'); }
      var u = realUser(), tr = state.trip;
      if (!u || !tr || !root.dlcDb) { state.myRole = null; return resolve(null); }
      root.dlcDb.collection('tripMembers').doc(tr.id).collection('members').doc(u.uid).get()
        .then(function (s) { state.myRole = s && s.exists ? (s.data().role || 'member') : null; resolve(state.myRole); })
        .catch(function () { state.myRole = null; resolve(null); });
    });
  }
  // Load the trip member list (best-effort; readable only by members per rules).
  function loadMembers() {
    var tr = state.trip;
    if (!tr || !root.dlcDb) return Promise.resolve([]);
    return root.dlcDb.collection('tripMembers').doc(tr.id).collection('members').get()
      .then(function (snap) { var out = []; snap.forEach(function (d) { out.push(Object.assign({ uid: d.id }, d.data())); }); state._members = out; return out; })
      .catch(function () { state._members = []; return []; });
  }
  // ── Trip Album media (V2) — TripMedia in groupTrips/{id}/media subcollection (members-only,
  //    private hidden from others by rules). Link/reference-based for now (StorageProvider
  //    'external_link'); Firebase binary upload is a later phase. No fake media. ──
  function mediaCol() { return (root.dlcDb && state.trip && state.trip.id) ? root.dlcDb.collection('groupTrips').doc(state.trip.id).collection('media') : null; }
  function loadMedia() {
    var tr = state.trip;
    if (!tr || tr._demo || !root.dlcDb) { state._media = state._media || []; return Promise.resolve(state._media); }
    var col = mediaCol(); if (!col) { state._media = []; return Promise.resolve([]); }
    return col.get().then(function (snap) { var out = []; snap.forEach(function (d) { out.push(Object.assign({ id: d.id }, d.data())); }); state._media = out; return out; })
      .catch(function () { state._media = []; return []; });
  }
  function addMedia(m) {
    state._media = state._media || [];
    var rec = Object.assign({ id: uid('med'), uploadedBy: curUid() || '', familyId: getMe() || '', favorite: false, selected: false, createdAt: new Date().toISOString(), storageProvider: 'external_link' }, m);
    state._media.push(rec);
    var col = mediaCol(); if (col && !state.trip._demo) { try { col.doc(rec.id).set(rec).catch(function () {}); } catch (e) {} }
    render();
  }
  function updateMedia(m, patch) {
    Object.assign(m, patch);
    var col = mediaCol(); if (col && m.id && !state.trip._demo) { try { col.doc(m.id).set(m, { merge: true }).catch(function () {}); } catch (e) {} }
    render();
  }
  function deleteMedia(m) {
    state._media = (state._media || []).filter(function (x) { return x !== m; });
    var col = mediaCol(); if (col && m.id && !state.trip._demo) { try { col.doc(m.id).delete().catch(function () {}); } catch (e) {} }
    render();
  }
  // Media the CURRENT viewer may see (mirrors the rules: private hidden unless author/owner).
  function visibleMedia() {
    var me = curUid(), owner = isOwnerOfTrip();
    return (state._media || []).filter(function (m) { return m.visibility !== 'private' || owner || (m.uploadedBy && m.uploadedBy === me); });
  }
  function shareLinkFor(token) { try { return root.location.origin + '/travel-concierge/trip/' + token; } catch (e) { return '/travel-concierge/trip/' + token; } }
  function cachedShareInfo(tripId) { try { var raw = root.localStorage.getItem('tc_share_' + tripId); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function cacheShareInfo(tripId, info) { try { root.localStorage.setItem('tc_share_' + tripId, JSON.stringify(info)); } catch (e) {} }
  function tripLegCount(trip) { normalizeDestinations(trip); return (trip.destinations || []).filter(function (d) { return (d.city || '').trim(); }).length; }
  function destNameFromTrip(trip, li) { var d = (trip.destinations || [])[li]; return d ? (d.city || '') : ''; }
  // Strategy: 1–2 legs → single generateGroupTripPlan call (also the universal fallback);
  // 3+ legs → fast generateTripSkeleton (outline) + per-leg generateLegDays (bounded
  // concurrency) stitched back together, to stay under the ~60s request gateway.
  function generatePlanSmart(trip, onStage) {
    // EVERY trip (including single-destination) now goes through the pipeline: a fast
    // skeleton across the ACTUAL dates, then ≤2-day batched leg calls (concurrency 2)
    // stitched back. This removes the old "EXACTLY 3 days / ≤3 places" single-call cap so
    // depth scales with trip length while each AI call stays under the ~60s gateway.
    // generatePlan (single capped call) remains only as the ultimate fallback below.
    if (tripLegCount(trip) >= 1) return generateMultiLegPlan(trip, onStage);
    onStage(t('generating'));
    return generatePlan(trip);
  }
  // Build the final TripPlan from the skeleton + the detailed days (keyed by stub._k).
  // Days with no detail (a failed/missing batch) fall back to their skeleton stub so the
  // plan is never empty — partial success instead of an all-or-nothing failure.
  // Parse a free-text date range → { count, dates[display] }. Generic (any range), no AI.
  function parseTripDates(s) {
    s = String(s || '').replace(/[–—]/g, '-').trim(); if (!s) return null;
    var M = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    var loc = state.lang === 'vi' ? 'vi-VN' : (state.lang === 'es' ? 'es-ES' : 'en-US');
    function fmt(dt) { try { return dt.toLocaleDateString(loc, { month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
    function build(a, b) { if (!a || !b || isNaN(a.getTime()) || isNaN(b.getTime())) return null; var n = Math.round((b - a) / 86400000) + 1; if (n < 1 || n > 30) return null; var ds = []; for (var i = 0; i < n; i++) ds.push(fmt(new Date(a.getTime() + i * 86400000))); return { count: n, dates: ds, start: a, end: b }; }
    var iso = s.match(/(\d{4})-(\d{2})-(\d{2})[^\d]+(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return build(new Date(+iso[1], +iso[2] - 1, +iso[3]), new Date(+iso[4], +iso[5] - 1, +iso[6]));
    var mn = s.toLowerCase().match(/([a-z]{3,})\.?\s+(\d{1,2})\s*-\s*(?:([a-z]{3,})\.?\s+)?(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (mn) { var m1 = M[mn[1].slice(0, 3)], m2 = mn[3] ? M[mn[3].slice(0, 3)] : m1, yr = mn[5] ? +mn[5] : (new Date().getFullYear()); if (m1 != null && m2 != null) { var en = new Date(yr + (m2 < m1 ? 1 : 0), m2, +mn[4]); return build(new Date(yr, m1, +mn[2]), en); } }
    var nm = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*-\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (nm) { var y1 = nm[3] ? (nm[3].length === 2 ? 2000 + +nm[3] : +nm[3]) : (new Date().getFullYear()); var y2 = nm[6] ? (nm[6].length === 2 ? 2000 + +nm[6] : +nm[6]) : y1; return build(new Date(y1, +nm[1] - 1, +nm[2]), new Date(y2, +nm[4] - 1, +nm[5])); }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  MULTI-STOP JOURNEY MODEL (Step A) — segments own their dates; the trip date
  //  range and the day→segment mapping are DERIVED from segments, not the reverse.
  //  trip.destinations[] IS the segment array (segments() is a read alias). The
  //  user defines WHERE + WHEN per stop; the AI optimizes WITHIN (never reorders).
  //  Pure + deterministic — nothing hardcoded to a city/date/provider.
  // ════════════════════════════════════════════════════════════════════════
  function segments(trip) { trip = trip || state.trip; return (trip && trip.destinations) || []; }
  function segArrival(d) { return (d && (d.arrivalDate || d.startDate)) || ''; }
  function segDeparture(d) { return (d && (d.departureDate || d.endDate)) || ''; }
  // Parse a single date: ISO (2026-07-01), "Jul 1, 2026"/"July 1", or m/d/yyyy. → Date | null.
  function parseSegDate(s) {
    s = String(s || '').trim(); if (!s) return null;
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) { var di = new Date(+iso[1], +iso[2] - 1, +iso[3]); return isNaN(di.getTime()) ? null : di; }
    var M = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    var hm = s.toLowerCase().match(/([a-z]{3,})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (hm && M[hm[1].slice(0, 3)] != null) { var yr = hm[3] ? +hm[3] : (new Date().getFullYear()); var dh = new Date(yr, M[hm[1].slice(0, 3)], +hm[2]); return isNaN(dh.getTime()) ? null : dh; }
    var nm = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (nm) { var y = nm[3] ? (nm[3].length === 2 ? 2000 + +nm[3] : +nm[3]) : (new Date().getFullYear()); var dn = new Date(y, +nm[1] - 1, +nm[2]); return isNaN(dn.getTime()) ? null : dn; }
    return null;
  }
  function isoOfDate(dt) { var m = dt.getMonth() + 1, d = dt.getDate(); return dt.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function fmtSegDate(dt) { var loc = state.lang === 'vi' ? 'vi-VN' : (state.lang === 'es' ? 'es-ES' : 'en-US'); try { return dt.toLocaleDateString(loc, { month: 'short', day: 'numeric' }); } catch (e) { return isoOfDate(dt); } }
  function nightsBetween(a, b) { if (!a || !b) return 0; return Math.round((b.getTime() - a.getTime()) / 86400000); }
  // Computed nights for a segment ([arrival, departure)). 0 if dates missing/invalid.
  function segNights(d) { var a = parseSegDate(segArrival(d)), b = parseSegDate(segDeparture(d)); return (a && b) ? Math.max(0, nightsBetween(a, b)) : 0; }
  // Derive the trip's global dateRange from segments (min arrival … max departure).
  // Returns an ISO range string parseTripDates() can re-read. When no segment carries
  // explicit dates, returns the existing dateRange unchanged (legacy trips untouched).
  function deriveDateRange(trip) {
    trip = trip || state.trip;
    var dated = segments(trip).map(function (d) { return { a: parseSegDate(segArrival(d)), b: parseSegDate(segDeparture(d)) }; }).filter(function (x) { return x.a && x.b; });
    if (!dated.length) return (trip && trip.dateRange) || '';
    var min = dated[0].a, max = dated[0].b;
    dated.forEach(function (x) { if (x.a < min) min = x.a; if (x.b > max) max = x.b; });
    return isoOfDate(min) + ' - ' + isoOfDate(max);
  }
  // DETERMINISTIC day→segment plan. Each segment owns [arrival, departure) (its nights);
  // the shared boundary date belongs to the NEXT segment's arrival (travel-in). The final
  // trip return day = last segment's departure (unless lastDayFull). Returns null when any
  // segment lacks dates → caller falls back to the legacy dateRange path. The AI fills each
  // day's CONTENT but never changes this mapping (kills the skeleton re-index/drop bug).
  function buildSegmentDayPlan(trip) {
    trip = trip || state.trip;
    var segs = segments(trip);
    var dated = segs.map(function (d) { return { d: d, a: parseSegDate(segArrival(d)), b: parseSegDate(segDeparture(d)) }; });
    if (!dated.length || dated.some(function (x) { return !x.a || !x.b; })) return null;
    var days = [], loc = '';
    for (var i = 0; i < dated.length; i++) {
      var seg = dated[i], city = (seg.d.city || '').trim();
      var dayCount = Math.max(1, nightsBetween(seg.a, seg.b)); // [arrival, departure); same-day → 1
      for (var k = 0; k < dayCount; k++) {
        var dt = new Date(seg.a.getTime() + k * 86400000);
        var travelIn = (k === 0) && (i === 0 || city.toLowerCase() !== loc.toLowerCase());
        days.push({ date: fmtSegDate(dt), iso: isoOfDate(dt), destinationIndex: i, segmentId: seg.d.id || '', isTravelDay: !!travelIn, isReturnDay: false });
      }
      loc = city;
    }
    if (!trip.lastDayFull) {
      var last = dated[dated.length - 1];
      days.push({ date: fmtSegDate(last.b), iso: isoOfDate(last.b), destinationIndex: dated.length - 1, segmentId: last.d.id || '', isTravelDay: true, isReturnDay: true });
    }
    return days;
  }
  // Human "2 nights San Diego · 1 night Orange County · home <date>" summary from segments.
  function journeySummary(trip) {
    trip = trip || state.trip;
    var parts = segments(trip).filter(function (d) { return (d.city || '').trim(); }).map(function (d) {
      var n = segNights(d);
      return n > 0 ? (n + ' ' + (n === 1 ? t('nightOne') : t('nightMany')) + ' ' + d.city) : d.city;
    });
    return parts;
  }
  // MIGRATION (Step E) — back-fill per-segment dates on a LEGACY trip (one global dateRange,
  // no segment dates) so it shows in the Journey Builder. Deterministic, in-memory, idempotent,
  // best-effort: single-stop → exact range bounds; multi-stop → derive each stop's window from
  // the existing plan's day→destinationIndex mapping; otherwise leave it legacy (still works via
  // the dateRange path — no AI call, no destructive write). NEVER throws.
  function migrateLegacyTripToSegments(trip) {
    if (!trip || trip._segMigrated) return trip;
    try {
      normalizeDestinations(trip);
      if (buildSegmentDayPlan(trip)) { trip._segMigrated = true; return trip; } // already has segment dates
      var segs = segments(trip).filter(function (d) { return (d.city || '').trim(); });
      if (!segs.length) return trip;
      var pd = parseTripDates(trip.dateRange);
      if (!pd || !pd.start || !pd.end) return trip; // no usable range → stay legacy (defer AI split)
      var dayMs = 86400000;
      if (segs.length === 1) {
        segs[0].arrivalDate = isoOfDate(pd.start); segs[0].startDate = segs[0].arrivalDate;
        segs[0].departureDate = isoOfDate(pd.end); segs[0].endDate = segs[0].departureDate;
        trip._segMigrated = true; normalizeDestinations(trip); return trip;
      }
      var days = (trip.plan && Array.isArray(trip.plan.days)) ? trip.plan.days : null;
      if (!days || !days.length) return trip; // can't split multi-stop deterministically without a plan
      var byIdx = {};
      days.forEach(function (d, i) { var li = d.destinationIndex || 0; if (!byIdx[li]) byIdx[li] = { first: i, last: i }; else byIdx[li].last = i; });
      segs.forEach(function (seg, li) {
        var b = byIdx[li]; if (!b) return;
        var a = new Date(pd.start.getTime() + b.first * dayMs);
        var dep = new Date(pd.start.getTime() + (b.last + 1) * dayMs); // exclusive: morning after the last night
        seg.arrivalDate = isoOfDate(a); seg.startDate = seg.arrivalDate;
        seg.departureDate = isoOfDate(dep); seg.endDate = seg.departureDate;
      });
      trip._segMigrated = true; normalizeDestinations(trip);
    } catch (e) { /* best-effort — legacy path keeps working */ }
    return trip;
  }
  // Day-type model: arrival_day | main_activity_day | transfer_day | return_day | mixed_day.
  // Generic — never hardcoded to any city/date. The Final-Day mode (Issue #3) shapes the last day.
  function assignDayTypes(plan, trip) {
    var days = plan.days || []; if (!days.length) return;
    var last = days[days.length - 1];
    // Capture, BEFORE relabelling, whether the AI actually built the final day as a full
    // activity day (real sections) vs. left it blank/padded — so ai_decide can fall back safely.
    var lastAiReturn = !!(last && last.isReturnDay);
    var lastHasContent = !!(last && Array.isArray(last.sections) && last.sections.length && !last._needsDetail);
    days.forEach(function (d) { d.dayType = d.isReturnDay ? 'return_day' : (d.isTravelDay ? 'transfer_day' : (d.dayType === 'mixed_day' ? 'mixed_day' : 'main_activity_day')); });
    var first = days[0]; if (first && !first.isReturnDay) first.dayType = first.isTravelDay ? 'transfer_day' : 'arrival_day';
    if (last) {
      var mode = finalDayMode(trip);
      if (mode === 'full_day') { last.isReturnDay = false; last.dayType = 'main_activity_day'; last.halfReturn = false; }
      else if (mode === 'half_day') { last.isReturnDay = true; last.dayType = 'mixed_day'; last.halfReturn = true; }
      else if (mode === 'return_day') { last.isReturnDay = true; last.dayType = 'return_day'; last.halfReturn = false; }
      else { // ai_decide: respect the AI's call; default to a return day for blank/padded final days.
        if (lastAiReturn) { last.isReturnDay = true; last.dayType = 'return_day'; }
        else if (!lastHasContent) { last.isReturnDay = true; last.dayType = 'return_day'; }
        // else: AI built a real full final day → keep it as main_activity_day.
      }
    }
  }
  // GUARANTEE: the plan has one day per calendar date and the return day is never dropped.
  function finalizePlanDays(plan, trip) {
    if (!plan) return;
    var parsed = parseTripDates(trip.dateRange);
    var days = plan.days = plan.days || [];
    if (parsed && parsed.count) {
      var lastDest = (plan.destinations && plan.destinations.length) ? plan.destinations.length - 1 : 0;
      // Reconcile to EXACTLY one day per inclusive calendar date — inserting a placeholder for any
      // MISSING day (including a dropped middle/transfer day — the Day-3 bug) instead of only
      // tail-padding (which can never recover a middle gap). Type hints come from the deterministic
      // segment plan when available; otherwise the day is a generic "open day" placeholder.
      var segHint = null; try { segHint = buildSegmentDayPlan(trip); } catch (eSeg) {}
      var segByIso = {}; (segHint || []).forEach(function (s) { if (s && s.iso) segByIso[s.iso] = s; });
      var expected = [];
      for (var ei = 0; ei < parsed.count; ei++) {
        var eIso = isoOfDate(new Date(parsed.start.getTime() + ei * 86400000));
        var sh = segByIso[eIso] || {};
        expected.push({ iso: eIso, date: parsed.dates[ei] || '', isTravelDay: !!sh.isTravelDay, isReturnDay: !!sh.isReturnDay, destinationIndex: (sh.destinationIndex != null ? sh.destinationIndex : lastDest) });
      }
      // Stamp machine ISO on existing days so reconcile matches by calendar date, not array order.
      days.forEach(function (d) { if (d && !d.iso && d.date) { var pdt = parseSegDate(d.date); if (pdt) d.iso = isoOfDate(pdt); } });
      if (root.TCJourneyDays && root.TCJourneyDays.reconcileCalendarDays) {
        var rec = root.TCJourneyDays.reconcileCalendarDays(days, expected);
        plan.days = days = rec.days;
        if (rec.repaired) { try { console.warn('[finalizePlanDays] inserted ' + rec.repaired + ' missing calendar day(s) to honor the trip date range'); } catch (eW) {} }
      } else { // module missing → legacy tail-pad/truncate (no middle-gap recovery)
        while (days.length < parsed.count) { var i = days.length; days.push({ date: parsed.dates[i] || '', dayNumber: i + 1, title: '', theme: '', summary: '', destinationIndex: lastDest, isReturnDay: false, sections: [], _needsDetail: true }); }
        if (days.length > parsed.count) plan.days = days = days.slice(0, parsed.count);
      }
      days.forEach(function (d, k) { if (!d.date && parsed.dates[k]) d.date = parsed.dates[k]; d.dayNumber = k + 1; });
    }
    // Stamp machine ISO dates (locale-independent) from the deterministic segment day plan, so
    // downstream date matching (e.g. user-locked transport legs on a travel day) never depends on
    // a localized date STRING. No-op for legacy trips without per-segment dates.
    try { var segPlan = buildSegmentDayPlan(trip); if (segPlan) days.forEach(function (d, i) { if (!d.iso && segPlan[i]) d.iso = segPlan[i].iso; }); } catch (e) {}
    assignDayTypes(plan, trip);
  }
  // V2: the AI skeleton DETERMINES each destination's role + whether it needs a hotel. Mirror
  // those onto trip.destinations (matched by city) so the auto-research agents (stays/food)
  // only research real lodging/meal stops — the user never set roles. Generic, no hardcoding.
  function syncDestRolesFromPlan(trip, plan) {
    var pd = (plan && plan.destinations) || []; if (!pd.length || !Array.isArray(trip.destinations)) return;
    pd.forEach(function (p) {
      if (!p || !p.city) return;
      var key = String(p.city).trim().toLowerCase();
      var td = trip.destinations.filter(function (x) { return (x.city || '').trim().toLowerCase() === key; })[0];
      if (!td) return;
      if (p.role) td.role = p.role;
      if (p.hotelNeeded != null) td.hotelNeeded = p.hotelNeeded !== false;
    });
  }
  function stitchPlan(trip, sk, detailByK) {
    var finalDays = (sk.days || []).map(function (stub) {
      var det = detailByK[stub._k];
      if (det) return det;
      return { date: stub.date, title: stub.title, theme: stub.theme, summary: stub.summary, destinationIndex: stub.destinationIndex || 0, isTravelDay: !!stub.isTravelDay, isReturnDay: !!stub.isReturnDay, sections: [] };
    });
    return {
      destination: trip.destination, groupName: trip.groupName, dateRange: trip.dateRange, departureCity: trip.departureCity,
      summary: sk.summary || '', destinations: sk.destinations || [], routeOverview: sk.routeOverview || null,
      days: finalDays, families: (trip.families || []).map(function (f) { return f.name; }).filter(Boolean),
      liveHighlights: trip.liveHighlights || [], dataSource: 'ai_generated_pending_verification',
    };
  }
  // Build a DETERMINISTIC skeleton from the user's segments (Step C) — same shape the AI
  // skeleton produces, but day→segment dates/order are fixed by buildSegmentDayPlan (the AI
  // never reassigns them). Carries per-segment transport prefs through to the leg payload.
  function deterministicSkeleton(trip, segPlan) {
    var dests = segments(trip).map(function (d, i) {
      return { index: i, city: (d.city || '').trim(), startDate: segArrival(d), endDate: segDeparture(d),
        role: d.role || (i === 0 ? 'main_destination' : 'overnight_destination'),
        hotelNeeded: (d.overnightStay !== false) && (d.hotelNeeded !== false), hotelSuggestion: null,
        transportPreference: d.transportPreference || 'any', preferredProvider: d.preferredProvider || '' };
    });
    var days = segPlan.map(function (st, idx) {
      return { dayNumber: idx + 1, _k: idx, destinationIndex: st.destinationIndex, date: st.date, isTravelDay: !!st.isTravelDay, isReturnDay: !!st.isReturnDay, title: '' };
    });
    return { summary: '', destinations: dests, routeOverview: null, days: days, _deterministic: true };
  }
  // Shared leg loop: ONE generateLegDays call per day (small/fast, ≤2 concurrent), then stitch.
  // Used by BOTH the deterministic-segment path and the legacy AI-skeleton path.
  function runLegDaysFromSkeleton(trip, sk, onStage) {
    sk.days.forEach(function (day, i) { if (day._k == null) day._k = i; });
    var byLeg = {};
    sk.days.forEach(function (day) { var li = day.destinationIndex || 0; (byLeg[li] = byLeg[li] || []).push(day); });
    var batches = [];
    Object.keys(byLeg).map(Number).sort(function (a, b) { return a - b; }).forEach(function (li) {
      var stubs = byLeg[li];
      for (var i = 0; i < stubs.length; i += 1) batches.push({ li: li, stubs: stubs.slice(i, i + 1) });
    });
    var legFn = mkCallable('generateLegDays', 75000);
    var total = batches.length, started = 0;
    if (!legFn || !total) return Promise.resolve({ plan: stitchPlan(trip, sk, {}), fallback: false });
    onStage(t('genLegOf').replace('{n}', '1').replace('{total}', String(total)));
    return promisePool(batches, function (b) {
      var li = b.li;
      var dest = (sk.destinations && sk.destinations[li]) || { index: li, city: destNameFromTrip(trip, li) };
      // Match the trip's destination (for role/flags) by CITY first, then index — robust
      // even if the skeleton re-indexes or drops a city.
      var skCity = String(dest.city || '').trim().toLowerCase();
      var td = (skCity && (trip.destinations || []).filter(function (x) { return (x.city || '').trim().toLowerCase() === skCity; })[0]) || (trip.destinations || [])[li] || {};
      return legFn({
        trip: { tripStyle: trip.tripStyle, budget: trip.budget, families: trip.families, preferences: trip.preferences, departureCity: trip.departureCity, lastDayFull: !!trip.lastDayFull, finalDayMode: finalDayMode(trip) },
        lang: state.lang,
        leg: { index: li, city: dest.city || td.city || destNameFromTrip(trip, li), startDate: dest.startDate || td.startDate || '', endDate: dest.endDate || td.endDate || '', hotelSuggestion: dest.hotelSuggestion || null, role: dest.role || td.role || 'main_destination', hotelNeeded: (dest.hotelNeeded != null ? dest.hotelNeeded !== false : td.hotelNeeded !== false), mealOnly: !!td.mealOnly, suggestFood: td.suggestFood !== false, suggestActivities: td.suggestActivities !== false, hoursToSpend: td.hoursToSpend || '', priority: td.priority || 'required', transportPreference: dest.transportPreference || td.transportPreference || 'any', preferredProvider: dest.preferredProvider || td.preferredProvider || '' },
        daySpecs: b.stubs, liveHighlights: trip.liveHighlights || [], avoidPlaces: rejectedNames(trip), preferredPlaces: preferredNames(trip), pinnedActivities: trip.pinnedActivities || [],
      }).then(function (rr) {
        started = Math.min(started + 1, total); onStage(t('genLegOf').replace('{n}', String(Math.min(started + 1, total))).replace('{total}', String(total)));
        var dd = (rr && rr.data) || {};
        return { stubs: b.stubs, days: (dd.ok && Array.isArray(dd.days)) ? dd.days : null };
      }).catch(function () { return { stubs: b.stubs, days: null }; });
    }, 2).then(function (results) {
      // Zip each returned day back to its stub by position (the prompt details stubs in order).
      var detailByK = {};
      (results || []).filter(Boolean).forEach(function (res) {
        if (!res.days) return;
        res.stubs.forEach(function (stub, j) {
          var det = res.days[j];
          if (det) { if (det.destinationIndex == null) det.destinationIndex = stub.destinationIndex || 0; if (det.isTravelDay == null) det.isTravelDay = !!stub.isTravelDay; if (det.isReturnDay == null) det.isReturnDay = !!stub.isReturnDay; if (!det.date) det.date = stub.date; detailByK[stub._k] = det; }
        });
      });
      return { plan: stitchPlan(trip, sk, detailByK), fallback: false };
    });
  }
  function generateMultiLegPlan(trip, onStage) {
    onStage(t('genSkeleton'));
    // DETERMINISTIC path (Step C): explicit per-segment dates → fixed day→segment map; the AI
    // fills each day's content but never the date/order assignment (no re-index/drop bug).
    var segPlan = buildSegmentDayPlan(trip);
    if (segPlan && segPlan.length) return runLegDaysFromSkeleton(trip, deterministicSkeleton(trip, segPlan), onStage);
    // LEGACY path: a single global dateRange → the AI skeleton splits the nights.
    var skelFn = mkCallable('generateTripSkeleton', 45000);
    if (!skelFn) { onStage(t('generating')); return generatePlan(trip); }
    return skelFn({ trip: trip, lang: state.lang, dateList: (parseTripDates(trip.dateRange) || {}).dates || [], avoidPlaces: rejectedNames(trip), preferredPlaces: preferredNames(trip) }).then(function (r) {
      var d = (r && r.data) || {};
      // Skeleton failed → degrade to a mock sample (do NOT retry as one big multi-dest call).
      if (!d.ok || !d.skeleton || !Array.isArray(d.skeleton.days) || !d.skeleton.days.length) return { plan: mockPlan(trip), fallback: true };
      return runLegDaysFromSkeleton(trip, d.skeleton, onStage);
    }).catch(function () { return { plan: mockPlan(trip), fallback: true }; });
  }

  // ── Persistence (localStorage + Firestore once logged in) ──────────────
  function stripRuntime(trip) {
    var c = {}; for (var k in trip) { if (k === '_demo' || k === '_fallback') continue; c[k] = trip[k]; }
    // Drop transient underscore-prefixed booking fields (_prevStatus checkbox-undo hint, _dep
    // dependency-graph annotation) — kept in memory for the session but NEVER persisted. Map to
    // shallow copies so the live booking objects keep their transient fields.
    if (Array.isArray(c.bookings)) c.bookings = c.bookings.map(function (b) {
      if (!b || typeof b !== 'object') return b;
      var hasTransient = false; for (var k in b) { if (k.charAt(0) === '_') { hasTransient = true; break; } }
      if (!hasTransient) return b;
      var nb = {}; for (var bk in b) { if (bk.charAt(0) !== '_') nb[bk] = b[bk]; } return nb;
    });
    return c;
  }
  function saveTrip(trip) {
    try { trip.updatedAt = new Date().toISOString(); } catch (e) {}
    var clean = stripRuntime(trip);
    try { root.localStorage.setItem('tc_trip_' + trip.id, JSON.stringify(clean)); } catch (e) {}
    if (trip._demo || !realUser()) return; // demos stay local; Firestore writes require login (rules + attribution)
    try {
      if (root.dlcDb) root.dlcDb.collection('groupTrips').doc(trip.id).set(clean, { merge: true }).catch(function () {});
    } catch (e) {}
  }
  function loadTrip(id) {
    return new Promise(function (resolve) {
      var local = null;
      try { var raw = root.localStorage.getItem('tc_trip_' + id); if (raw) local = JSON.parse(raw); } catch (e) {}
      if (root.dlcDb) {
        root.dlcDb.collection('groupTrips').doc(id).get().then(function (snap) {
          resolve(snap && snap.exists ? snap.data() : local);
        }).catch(function () { resolve(local); });
      } else resolve(local);
    });
  }

  // ── Mount / router ─────────────────────────────────────────────────────
  function app() { return doc.getElementById('tcApp'); }
  function render() {
    var host = app(); if (!host) return;
    // Preserve scroll on in-screen re-renders (e.g. editing a family card). Only jump to
    // top when the navigation CONTEXT changes — screen, active tab, or active day — so
    // adding/editing the 3rd family no longer scrolls the page to the top (Issue #2).
    var sy = 0; try { sy = root.scrollY || (doc.documentElement && doc.documentElement.scrollTop) || 0; } catch (e) {}
    var navKey = state.screen + '|' + state.activeTab + '|' + state.activeDay;
    host.innerHTML = '';
    if (state.screen === 'hero') host.appendChild(renderHero());
    else if (state.screen === 'dashboard') host.appendChild(renderDashboard());
    else if (state.screen === 'create') host.appendChild(renderCreate());
    else if (state.screen === 'nlreview') host.appendChild(renderNLReview());
    else if (state.screen === 'families') host.appendChild(renderFamilies());
    else if (state.screen === 'prefs') host.appendChild(renderPrefs());
    else if (state.screen === 'plan') host.appendChild(renderPlan());
    else if (state.screen === 'sharejoin') host.appendChild(renderShareJoin());
    applyI18n(host);
    syncHeaderAcct();
    try { if (navKey !== _navKey) root.scrollTo(0, 0); else root.scrollTo(0, sy); } catch (e) {}
    _navKey = navKey;
  }
  var _navKey = null;
  // Persistent header login/account control (in the app-bar, on every screen).
  function syncHeaderAcct() {
    var host = doc.getElementById('tcHeaderAcct'); if (!host) return;
    host.innerHTML = '';
    var u = realUser();
    if (u) {
      var who = u.email ? u.email.split('@')[0] : '';
      host.appendChild(el('span', 'tc-hdracct__who', '👤 ' + (who.length > 6 ? who.slice(-4) : (who || ''))));
      var out = el('button', 'tc-hdracct__btn', t('logout')); out.type = 'button';
      out.addEventListener('click', function () { try { auth().signOut(); } catch (e) {} });
      host.appendChild(out);
    } else {
      var login = el('button', 'tc-hdracct__btn tc-hdracct__btn--login', t('signIn')); login.type = 'button';
      login.addEventListener('click', function () {
        var prev = state.screen;
        requireLogin(function () { state._myTrips = null; state.screen = (prev && prev !== 'plan') ? prev : 'hero'; render(); });
      });
      host.appendChild(login);
    }
  }
  function applyI18n(scope) {
    (scope || doc).querySelectorAll('[data-tc-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-tc-i18n')); });
  }

  // ── Screen: hero ───────────────────────────────────────────────────────
  // (The hero's own login strip was removed — the persistent header account control
  // #tcHeaderAcct handles login/account on every screen, so a second hero login button
  // was redundant. See syncHeaderAcct.)
  // "Your trips" — owned trips (Firestore where ownerUid==uid) + local drafts; lazy-loaded.
  function dedupeTrips(arr) { var seen = {}, out = []; (arr || []).forEach(function (tt) { if (tt && tt.id && !seen[tt.id] && (tt.groupName || tt.destination)) { seen[tt.id] = 1; out.push(tt); } }); return out; }
  function tripSummary(tt, id, role) {
    return { id: id || tt.id, groupName: tt.groupName, destination: tt.destination, destinations: tt.destinations, dateRange: tt.dateRange, updatedAt: tt.updatedAt || null, role: role || 'owner', ownerUid: tt.ownerUid || '' };
  }
  function loadMyTrips() {
    var u = realUser(), out = [];
    try { if (root.localStorage && root.localStorage.length != null) { for (var i = 0; i < root.localStorage.length; i++) { var k = root.localStorage.key(i); if (k && k.indexOf('tc_trip_') === 0) { try { var lt = JSON.parse(root.localStorage.getItem(k)); if (lt && lt.id && lt.plan && lt.deleted !== true) out.push(tripSummary(lt, lt.id, 'owner')); } catch (e) {} } } } } catch (e) {}
    if (!u || !root.dlcDb) { state._myTrips = dedupeTrips(out); return Promise.resolve(state._myTrips); }
    return root.dlcDb.collection('groupTrips').where('ownerUid', '==', u.uid).get()
      .then(function (snap) { snap.forEach(function (d) { var tt = d.data() || {}; if (tt.deleted === true) return; out.unshift(tripSummary(tt, d.id, 'owner')); }); state._myTrips = dedupeTrips(out); return state._myTrips; })
      .catch(function () { state._myTrips = dedupeTrips(out); return state._myTrips; });
  }
  // "Trips you joined" — fetched from the per-uid joined index (members can read the
  // trip doc per rules). Skips deleted trips, owned trips, and stale ids.
  function loadJoinedTrips() {
    var u = realUser();
    if (!u || !root.dlcDb) { state._joinedTrips = []; return Promise.resolve([]); }
    var ids = joinedTripIds(); if (!ids.length) { state._joinedTrips = []; return Promise.resolve([]); }
    return Promise.all(ids.map(function (id) {
      return root.dlcDb.collection('groupTrips').doc(id).get()
        .then(function (snap) { if (!snap.exists) { forgetJoinedTrip(id); return null; } var tt = snap.data() || {}; if (tt.deleted === true || tt.ownerUid === u.uid) return null; return tripSummary(tt, id, 'member'); })
        .catch(function () { return null; });
    })).then(function (arr) { state._joinedTrips = dedupeTrips(arr.filter(Boolean)); return state._joinedTrips; });
  }
  function openOwnedTrip(id) {
    renderGenerating(t('generating'));
    loadTrip(id).then(function (tr) {
      if (tr && tr.deleted === true) { toast(t('tripDeleted')); goDashboard(); return; }
      if (tr && tr.plan) { state.trip = tr; normalizeDestinations(state.trip); state.trip._demo = false; state.readonly = false; state.screen = 'plan'; state.activeDay = 0; state.activeTab = 'overview'; pushTripUrl(id); resolveMyRole().then(render); }
      else { toast(t('genFail')); state.screen = 'hero'; render(); }
    });
  }
  // ── My Trips dashboard (route: /travel-concierge/my-trips) ─────────────
  function pushDashboardUrl() { try { root.history.replaceState({}, '', '/travel-concierge/my-trips'); } catch (e) {} }
  function goDashboard() {
    closeModal();
    state._myTrips = null; state._joinedTrips = null;
    state._shareToken = null; state._joinPending = null; state._pendingTripId = null;
    state.screen = 'dashboard'; pushDashboardUrl(); render();
  }
  function fmtUpdated(iso) {
    if (!iso) return t('neverUpdated');
    try { var d = new Date(iso); if (isNaN(d.getTime())) return t('neverUpdated'); var loc = state.lang === 'vi' ? 'vi-VN' : (state.lang === 'es' ? 'es-ES' : 'en-US'); return t('lastUpdated') + ': ' + d.toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }
  function tripDestSummary(tt) {
    var ds = (tt && Array.isArray(tt.destinations)) ? tt.destinations.map(function (d) { return d && d.city; }).filter(Boolean) : [];
    if (ds.length) return ds.join(' → ');
    return (tt && tt.destination) || '—';
  }
  function openTripFromDash(id, then) {
    renderGenerating(t('generating'));
    loadTrip(id).then(function (tr) {
      if (!tr || tr.deleted === true) { toast(t('tripDeleted')); goDashboard(); return; }
      if (!tr.plan && then !== 'create') { toast(t('genFail')); goDashboard(); return; }
      state.trip = tr; normalizeDestinations(state.trip); state.trip._demo = false; state.readonly = false;
      state.activeDay = 0; state.activeTab = 'overview'; pushTripUrl(id);
      resolveMyRole().then(function () {
        if (then === 'create') { state.screen = 'create'; render(); }
        else if (then === 'share') { state.screen = 'plan'; render(); openShareModal(); }
        else { state.screen = 'plan'; render(); }
      });
    });
  }
  function tripCardEl(tt) {
    var card = el('article', 'tc-tripcard');
    var main = el('button', 'tc-tripcard__main'); main.type = 'button';
    var titleRow = el('div', 'tc-tripcard__titlerow');
    titleRow.appendChild(el('strong', 'tc-tripcard__name', tt.groupName || tripDestSummary(tt) || '—'));
    titleRow.appendChild(el('span', 'tc-tripcard__role tc-tripcard__role--' + (tt.role || 'owner'), t('role_' + (tt.role || 'owner')) || tt.role));
    main.appendChild(titleRow);
    main.appendChild(el('span', 'tc-tripcard__dest', '📍 ' + tripDestSummary(tt)));
    if (tt.dateRange) main.appendChild(el('span', 'tc-tripcard__dates', '📅 ' + tt.dateRange));
    main.appendChild(el('span', 'tc-tripcard__upd', fmtUpdated(tt.updatedAt)));
    main.addEventListener('click', function () { openTripFromDash(tt.id); });
    card.appendChild(main);
    var acts = el('div', 'tc-tripcard__acts');
    var open = el('button', 'tc-pbtn tc-pbtn--accent', t('openTripBtn')); open.type = 'button'; open.addEventListener('click', function () { openTripFromDash(tt.id); }); acts.appendChild(open);
    if (tt.role === 'owner') {
      var ed = el('button', 'tc-pbtn', '✏️ ' + t('editTripBtn')); ed.type = 'button'; ed.addEventListener('click', function () { openTripFromDash(tt.id, 'create'); }); acts.appendChild(ed);
      var sh = el('button', 'tc-pbtn', '🔗 ' + t('shareTrip')); sh.type = 'button'; sh.addEventListener('click', function () { openTripFromDash(tt.id, 'share'); }); acts.appendChild(sh);
      var del = el('button', 'tc-pbtn tc-pbtn--danger', '🗑 ' + t('deleteTripBtn')); del.type = 'button'; del.addEventListener('click', function () { openDeleteModal(tt.id, tt.groupName || tripDestSummary(tt)); }); acts.appendChild(del);
    }
    card.appendChild(acts);
    return card;
  }
  // "What we remember" — the user's learned cross-trip preferences, with a privacy
  // clear button. Shown on the dashboard only when there is something learned.
  function memoryPanel() {
    if (!realUser()) return null;
    if (state._memory == null) { loadTravelMemory().then(function () { if (state.screen === 'dashboard') render(); }); return null; }
    if (!hasTravelMemory()) return null;
    var m = state._memory, card = el('section', 'tc-mem');
    var head = el('div', 'tc-mem__head');
    head.appendChild(el('h2', 'tc-mem__title', '🧠 ' + t('mem_title')));
    head.appendChild(el('p', 'tc-mem__sub', t('mem_sub')));
    card.appendChild(head);
    var body = el('div', 'tc-mem__body');
    function chips(label, arr, mapFn) {
      arr = (arr || []).filter(Boolean); if (!arr.length) return;
      var row = el('div', 'tc-mem__row');
      row.appendChild(el('span', 'tc-mem__label', label));
      var wrap = el('div', 'tc-mem__chips');
      arr.slice(0, 12).forEach(function (x) { wrap.appendChild(el('span', 'tc-mem__chip', mapFn ? mapFn(x) : x)); });
      row.appendChild(wrap); body.appendChild(row);
    }
    function line(label, val) {
      if (!val) return;
      var row = el('div', 'tc-mem__row');
      row.appendChild(el('span', 'tc-mem__label', label));
      row.appendChild(el('span', 'tc-mem__val', val));
      body.appendChild(row);
    }
    line(t('mem_budget'), m.budget ? t('budget_' + m.budget) : '');
    line(t('mem_pace'), m.pace ? t('style_' + m.pace) : '');
    chips(t('mem_cuisines'), m.cuisines);
    chips(t('mem_liked'), m.liked);
    chips(t('mem_never'), m.rejected);
    chips(t('mem_transport'), (m.transport && m.transport.liked) || [], tpModeLabel);
    if (m.pastTrips && m.pastTrips.length) line(t('mem_trips'), String(m.pastTrips.length));
    card.appendChild(body);
    var clr = el('button', 'tc-mem__clear', '🗑 ' + t('mem_clear')); clr.type = 'button';
    clr.addEventListener('click', function () { clearTravelMemory(); });
    card.appendChild(clr);
    return card;
  }
  function renderDashboard() {
    var s = el('section', 'tc-dash');
    var bc = el('nav', 'tc-bc');
    bc.appendChild(el('span', 'tc-bc__seg', t('tcBrand')));
    bc.appendChild(el('span', 'tc-bc__sep', '›'));
    bc.appendChild(el('span', 'tc-bc__seg tc-bc__seg--on', t('dashTitle')));
    s.appendChild(bc);
    s.appendChild(el('h1', 'tc-dash__title', t('dashTitle')));
    if (!realUser()) {
      s.appendChild(el('p', 'tc-dash__login', t('dashLoginPrompt')));
      var li = el('button', 'tc-cta', t('logInExisting')); li.type = 'button';
      li.addEventListener('click', function () { requireLogin(function () { state._myTrips = null; state._joinedTrips = null; render(); }); });
      s.appendChild(li);
      return s;
    }
    var nt = el('button', 'tc-cta tc-dash__new', t('createNewTrip')); nt.type = 'button';
    nt.addEventListener('click', function () { newTrip(); state.screen = 'create'; pushTripUrl(null); render(); });
    s.appendChild(nt);
    var mp = memoryPanel(); if (mp) s.appendChild(mp); // cross-trip "what we remember" + privacy clear
    if (state._myTrips == null) { loadMyTrips().then(function () { if (state.screen === 'dashboard') render(); }); }
    if (state._joinedTrips == null) { loadJoinedTrips().then(function () { if (state.screen === 'dashboard') render(); }); }
    var owned = state._myTrips || [], joined = state._joinedTrips || [];
    s.appendChild(el('h2', 'tc-dash__section', t('ownedSection')));
    if (state._myTrips == null) s.appendChild(el('p', 'tc-mytrips__empty', '…'));
    else if (!owned.length) s.appendChild(el('p', 'tc-mytrips__empty', t('noTripsYet')));
    else { var g1 = el('div', 'tc-tripgrid'); owned.forEach(function (tt) { g1.appendChild(tripCardEl(tt)); }); s.appendChild(g1); }
    if (joined.length) {
      s.appendChild(el('h2', 'tc-dash__section', t('joinedSection')));
      var g2 = el('div', 'tc-tripgrid'); joined.forEach(function (tt) { g2.appendChild(tripCardEl(tt)); }); s.appendChild(g2);
    }
    return s;
  }
  function openDeleteModal(tripId, name) {
    closeModal();
    var ov = el('div', 'tc-modal'); ov.id = 'tcModal';
    var card = el('div', 'tc-modal__card');
    var head = el('div', 'tc-modal__head');
    head.appendChild(el('strong', 'tc-modal__title', t('delConfirmTitle')));
    var x = el('button', 'tc-modal__x', '×'); x.type = 'button'; x.addEventListener('click', closeModal); head.appendChild(x);
    card.appendChild(head);
    if (name) card.appendChild(el('p', 'tc-del__name', '“' + name + '”'));
    card.appendChild(el('p', 'tc-del__body', t('delConfirmBody')));
    var acts = el('div', 'tc-modal__acts');
    var cancel = el('button', 'tc-pbtn', t('cancelBtn')); cancel.type = 'button'; cancel.addEventListener('click', closeModal); acts.appendChild(cancel);
    var yes = el('button', 'tc-pbtn tc-pbtn--danger', t('delConfirmYes')); yes.type = 'button';
    yes.addEventListener('click', function () {
      yes.disabled = true; yes.textContent = t('deleting');
      TripShare.del(tripId).then(function (r) {
        if (!r || !r.ok) { yes.disabled = false; yes.textContent = t('delConfirmYes'); toast(t('genFail')); return; }
        try { root.localStorage.removeItem('tc_trip_' + tripId); } catch (e) {}
        forgetJoinedTrip(tripId);
        state._myTrips = null; state._joinedTrips = null;
        if (state.trip && state.trip.id === tripId) state.trip = null;
        toast(t('tripDeleted')); goDashboard();
      }).catch(function () { yes.disabled = false; yes.textContent = t('delConfirmYes'); toast(t('genFail')); });
    });
    acts.appendChild(yes);
    card.appendChild(acts);
    ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); }); doc.body.appendChild(ov);
  }
  function openMoreSheet() {
    var tr = state.trip; if (!tr) return;
    closeModal();
    var ov = el('div', 'tc-modal tc-sheet'); ov.id = 'tcModal';
    var card = el('div', 'tc-modal__card');
    var head = el('div', 'tc-modal__head');
    head.appendChild(el('strong', 'tc-modal__title', t('moreSheetTitle')));
    var x = el('button', 'tc-modal__x', '×'); x.type = 'button'; x.addEventListener('click', closeModal); head.appendChild(x);
    card.appendChild(head);
    var list = el('div', 'tc-sheet__list');
    var mt = el('button', 'tc-pbtn', '🗂 ' + t('dashTitle')); mt.type = 'button'; mt.addEventListener('click', function () { closeModal(); goDashboard(); }); list.appendChild(mt);
    if (!tr._demo && isOwnerOfTrip()) {
      var ed = el('button', 'tc-pbtn', '✏️ ' + t('editTripBtn')); ed.type = 'button'; ed.addEventListener('click', function () { closeModal(); state.screen = 'create'; render(); }); list.appendChild(ed);
      var sh = el('button', 'tc-pbtn', '🔗 ' + t('shareTrip')); sh.type = 'button'; sh.addEventListener('click', function () { closeModal(); openShareModal(); }); list.appendChild(sh);
      var del = el('button', 'tc-pbtn tc-pbtn--danger', '🗑 ' + t('deleteTripBtn')); del.type = 'button'; del.addEventListener('click', function () { closeModal(); openDeleteModal(tr.id, tr.groupName || tr.destination); }); list.appendChild(del);
    }
    // V5: the trip surfaces not in the 5-tab bar are reachable here (set state.activeTab + render).
    list.appendChild(el('p', 'tc-sheet__lbl', t('moreNavTitle')));
    [['journey', '🧭 ', 'tab_journey'], ['transport', '🚐 ', 'tab_transport'], ['stay', '🏨 ', 'tab_stay'], ['food', '🍽 ', 'tab_food'], ['events', '🎉 ', 'tab_events'], ['weather', '🌦️ ', 'tab_weather'], ['stopovers', '✨ ', 'tab_stopovers'], ['costs', '💰 ', 'tab_costs'], ['group', '👥 ', 'tab_group']].forEach(function (it) {
      var b = el('button', 'tc-pbtn', it[1] + t(it[2])); b.type = 'button';
      b.addEventListener('click', function () { closeModal(); state.activeTab = it[0]; render(); });
      list.appendChild(b);
    });
    card.appendChild(list);
    ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); }); doc.body.appendChild(ov);
  }
  function heroMyTrips() {
    var wrap = el('div', 'tc-mytrips');
    var hdr = el('div', 'tc-mytrips__hdr');
    hdr.appendChild(el('p', 'tc-hero__demos-lbl', t('myTrips')));
    var manage = el('button', 'tc-mytrips__manage', t('dashTitle') + ' →'); manage.type = 'button';
    manage.addEventListener('click', function () { goDashboard(); });
    hdr.appendChild(manage);
    wrap.appendChild(hdr);
    if (state._myTrips == null) { loadMyTrips().then(function () { if (state.screen === 'hero') render(); }); wrap.appendChild(el('p', 'tc-mytrips__empty', '…')); return wrap; }
    if (!state._myTrips.length) { wrap.appendChild(el('p', 'tc-mytrips__empty', t('noTripsYet'))); return wrap; }
    var grid = el('div', 'tc-hero__demos');
    state._myTrips.slice(0, 4).forEach(function (tt) {
      var d = el('button', 'tc-hero__demo'); d.type = 'button';
      d.appendChild(el('strong', null, tt.groupName || tripDestSummary(tt) || '—'));
      d.appendChild(el('span', null, tripDestSummary(tt) || ''));
      d.addEventListener('click', function () { openOwnedTrip(tt.id); });
      grid.appendChild(d);
    });
    wrap.appendChild(grid);
    return wrap;
  }
  function sampleCatIcon(cat, name) {
    var x = ((cat || '') + ' ' + (name || '')).toLowerCase();
    if (/zoo|safari|aquarium|wildlife|animal/.test(x)) return '🦁';
    if (/theme|amusement|disney|legoland|seaworld|coaster|water ?park/.test(x)) return '🎢';
    if (/restaurant|food|dining|cafe|café|dinner|lunch|breakfast|eatery/.test(x)) return '🍽';
    if (/beach|coast|pier|\bbay\b|shore|boardwalk|cove/.test(x)) return '🏖';
    if (/museum|gallery|\bart\b|history|science/.test(x)) return '🏛';
    if (/shop|mall|market|outlet|boutique/.test(x)) return '🛍';
    if (/park|garden|trail|scenic|nature|lake/.test(x)) return '🌳';
    if (/hotel|resort|\binn\b|suites/.test(x)) return '🏨';
    return '📍';
  }
  // LIVE in-hero preview of a REAL sample plan (from TC_SAMPLES — no fabricated image):
  // the first real day with places, 3 mini cards, and the group-fit "why" line that shows
  // the age/multi-family intelligence. CTA opens the full read-only sample (no login).
  function heroSamplePreview(key) {
    var samples = root.TC_SAMPLES || {};
    var sample = key && samples[key];
    if (!sample || !Array.isArray(sample.days) || !sample.days.length) return null;
    var fcount = sample.families ? sample.families.length : 2, dcount = sample.days.length;
    var day = sample.days.filter(function (d) { return (d.sections || []).some(function (sec) { return (sec.places || []).length; }); })[0] || sample.days[0];
    var dayIdx = sample.days.indexOf(day);
    var places = []; (day.sections || []).forEach(function (sec) { (sec.places || []).forEach(function (p) { if (p && p.name) places.push(p); }); });
    if (!places.length) return null;
    var card = el('div', 'tc-herosample');
    var head = el('div', 'tc-herosample__head');
    head.appendChild(el('span', 'tc-herosample__badge', '● ' + t('liveSampleBadge')));
    head.appendChild(el('strong', 'tc-herosample__dest', '📍 ' + (sample.destination || '')));
    head.appendChild(el('span', 'tc-herosample__meta', t('demoMeta').replace('{f}', String(fcount)).replace('{d}', String(dcount))));
    card.appendChild(head);
    if (day.title) card.appendChild(el('p', 'tc-herosample__day', t('day') + ' ' + (dayIdx + 1) + ' · ' + day.title));
    var list = el('div', 'tc-herosample__list');
    places.slice(0, 3).forEach(function (p) {
      var row = el('div', 'tc-herosample__row');
      row.appendChild(el('span', 'tc-herosample__ic', sampleCatIcon(p.category, p.name)));
      row.appendChild(el('span', 'tc-herosample__nm', p.name));
      list.appendChild(row);
    });
    card.appendChild(list);
    var why = (places[0] && places[0].whySelected) || '';
    if (why) { var w = el('p', 'tc-herosample__why'); w.appendChild(el('span', 'tc-herosample__why-k', t('whyFits') + ': ')); w.appendChild(doc.createTextNode(why.length > 130 ? why.slice(0, 128) + '…' : why)); card.appendChild(w); }
    card.appendChild(el('p', 'tc-herosample__more', '🗺 ' + t('sampleMoreNote')));
    var cta = el('button', 'tc-herosample__cta', t('seeFullSample') + ' →'); cta.type = 'button';
    cta.addEventListener('click', function () { openDemo(key); });
    card.appendChild(cta);
    return card;
  }
  // A CTA that opens the create flow (used at the top of the hero and again at the bottom).
  function heroCtaBtn() {
    var cta = el('button', 'tc-cta tc-hero__cta', t('start')); cta.type = 'button';
    cta.addEventListener('click', function () { newTrip(); state.screen = 'create'; render(); });
    return cta;
  }
  // Differentiator band: WHO / WHERE / WHAT → AI does the homework. Communicates that the
  // group only supplies 3 things and the AI researches the rest (capabilities 1-5).
  function whoWhereWhatBand() {
    var b = el('section', 'tc-www');
    b.appendChild(el('strong', 'tc-www__t', t('wwwTitle')));
    var grid = el('div', 'tc-www__grid');
    [['👨‍👩‍👧', 'www_who', 'www_who_d'], ['📍', 'www_where', 'www_where_d'], ['❤️', 'www_what', 'www_what_d']].forEach(function (it) {
      var c = el('div', 'tc-www__item');
      c.appendChild(el('span', 'tc-www__ic', it[0]));
      c.appendChild(el('strong', 'tc-www__k', t(it[1])));
      c.appendChild(el('span', 'tc-www__d', t(it[2])));
      grid.appendChild(c);
    });
    b.appendChild(grid);
    b.appendChild(el('p', 'tc-www__do', '✨ ' + t('wwwDo')));
    return b;
  }
  // 4-step "How it works" — frames the whole product (and pre-sells the collaboration login).
  function howItWorksSection() {
    var sec = el('section', 'tc-hiw');
    sec.appendChild(el('strong', 'tc-hiw__t', t('hiwTitle')));
    var grid = el('div', 'tc-hiw__grid');
    [['hiw1', 'hiw1d'], ['hiw2', 'hiw2d'], ['hiw3', 'hiw3d'], ['hiw4', 'hiw4d']].forEach(function (st, i) {
      var c = el('div', 'tc-hiw__step');
      c.appendChild(el('span', 'tc-hiw__num', String(i + 1)));
      var body = el('div', 'tc-hiw__body');
      body.appendChild(el('strong', 'tc-hiw__h', t(st[0])));
      body.appendChild(el('span', 'tc-hiw__p', t(st[1])));
      c.appendChild(body);
      grid.appendChild(c);
    });
    sec.appendChild(grid);
    return sec;
  }
  // The 10 agent capabilities as cards — the proof the concierge is an agent, not a generator.
  // Order mirrors the product requirements (multi-family → costs).
  var CAP_CARDS = [
    ['👨‍👩‍👧‍👦', 'cap_family'], ['✨', 'cap_experiences'], ['🍜', 'cap_discover'], ['✈️', 'cap_transport'],
    ['🏨', 'cap_stay'], ['🗳️', 'cap_vote'], ['🔄', 'cap_optimize'], ['📍', 'cap_live'],
    ['🎬', 'cap_album'], ['💰', 'cap_costs'],
  ];
  function capabilityCards() {
    var sec = el('section', 'tc-caps');
    sec.appendChild(el('strong', 'tc-caps__t', t('capTitle')));
    sec.appendChild(el('p', 'tc-caps__sub', t('capSub')));
    var grid = el('div', 'tc-caps__grid');
    CAP_CARDS.forEach(function (c, i) {
      var card = el('div', 'tc-cap tc-cap--in');
      card.style.animationDelay = (i * 0.05) + 's'; // staggered fade-up (reduced-motion safe in CSS)
      card.appendChild(el('span', 'tc-cap__ic', c[0]));
      card.appendChild(el('strong', 'tc-cap__h', t(c[1])));
      card.appendChild(el('span', 'tc-cap__d', t(c[1] + '_d')));
      card.appendChild(el('span', 'tc-cap__ex', t(c[1] + '_ex'))); // concrete illustrative example
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    return sec;
  }
  // Immersive hero showcase — a CSS/SVG visual (NO images, no network): an aurora backdrop, an
  // animated multi-stop route line, and floating "AI discovers…" chips. Conveys the experience
  // without any fake/AI photos. All motion is disabled under prefers-reduced-motion (see CSS).
  var DISCOVERY_CHIPS = ['disc_attractions', 'disc_beaches', 'disc_restaurants', 'disc_gems', 'disc_events', 'disc_themeparks', 'disc_hotels', 'disc_transport', 'disc_voting', 'disc_livemap', 'disc_clips'];
  function heroShowcase() {
    var box = el('div', 'tc-showcase');
    box.setAttribute('aria-hidden', 'true'); // decorative; the H1/sub carry the real message
    box.appendChild(el('div', 'tc-showcase__aurora'));
    // Animated multi-stop route line (SVG path + dots), evoking a planned multi-city trip.
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS ? doc.createElementNS(svgNS, 'svg') : el('div', 'tc-showcase__route');
    if (doc.createElementNS) {
      svg.setAttribute('class', 'tc-showcase__route'); svg.setAttribute('viewBox', '0 0 300 80'); svg.setAttribute('preserveAspectRatio', 'none');
      var pathEl = doc.createElementNS(svgNS, 'path'); pathEl.setAttribute('d', 'M15 60 C 80 10, 150 70, 220 25 S 285 30, 290 20'); pathEl.setAttribute('class', 'tc-showcase__path'); svg.appendChild(pathEl);
      [[15, 60], [150, 48], [290, 20]].forEach(function (p, i) { var ci = doc.createElementNS(svgNS, 'circle'); ci.setAttribute('cx', p[0]); ci.setAttribute('cy', p[1]); ci.setAttribute('r', '5'); ci.setAttribute('class', 'tc-showcase__dot'); ci.style.animationDelay = (i * 0.4) + 's'; svg.appendChild(ci); });
    }
    box.appendChild(svg);
    var chips = el('div', 'tc-showcase__chips');
    chips.appendChild(el('span', 'tc-showcase__lead', '✨ ' + t('heroShowcaseLead')));
    DISCOVERY_CHIPS.forEach(function (k, i) { var c = el('span', 'tc-showcase__chip', t(k)); c.style.animationDelay = (0.15 + i * 0.12) + 's'; chips.appendChild(c); });
    box.appendChild(chips);
    return box;
  }
  // Popular destination showcase — landing IDEAS only. Tiles are CSS graphics (gradient + an
  // experience-icon montage), NEVER fake photos. "Plan this trip" pre-fills ONLY the destination
  // city; it NEVER forces the example experiences — the planning engine still researches fresh.
  var LANDING_DESTS = [
    { key: 'sandiego', name: 'San Diego', icons: '🦁🏖️🎢', accent: '#38bdf8', exp: ['San Diego Zoo', 'SeaWorld', 'LEGOLAND', 'La Jolla Cove', 'SEAL Tour', 'Beaches'] },
    { key: 'oc', name: 'Orange County', icons: '🏰🍜🎡', accent: '#fb923c', exp: ['Disneyland', 'Little Saigon food', "Knott's Berry Farm", 'Beaches'] },
    { key: 'sf', name: 'San Francisco / Bay Area', icons: '🌉🦀🚡', accent: '#f472b6', exp: ['Golden Gate Bridge', 'Pier 39', "Fisherman's Wharf", 'Chinatown', 'Alcatraz'] },
    { key: 'vegas', name: 'Las Vegas', icons: '🎰🎶🏜️', accent: '#c084fc', exp: ['The Strip', 'Sphere', 'Shows', 'Hoover Dam', 'Grand Canyon day trip'] },
    { key: 'la', name: 'Los Angeles / Hollywood', icons: '🎬⭐🏖️', accent: '#fbbf24', exp: ['Universal Studios', 'Hollywood Walk of Fame', 'Griffith Observatory', 'Santa Monica Pier'] },
    { key: 'yosemite', name: 'Yosemite', icons: '🏔️🌲💧', accent: '#84cc16', exp: ['Half Dome', 'Yosemite Falls', 'Glacier Point', 'Giant Sequoias'] },
  ];
  function planLandingDestination(name) {
    newTrip();
    if (state.trip.destinations && state.trip.destinations[0]) state.trip.destinations[0].city = name; // destination ONLY — no forced attractions
    state.screen = 'create'; render();
    try { root.scrollTo(0, 0); } catch (e) {}
  }
  function destinationCard(d, i) {
    var card = el('article', 'tc-dcard tc-cap--in'); card.style.animationDelay = (i * 0.05) + 's';
    card.style.setProperty('--acc', d.accent);
    // Travel-card "scene" tile: decorative mesh gradient (CSS, via --acc) + emoji montage +
    // bottom scrim + destination name over it. NO photo — clearly a decorative graphic.
    var tile = el('div', 'tc-dcard__tile');
    tile.appendChild(el('span', 'tc-dcard__glow'));
    tile.appendChild(el('span', 'tc-dcard__icons', d.icons));
    tile.appendChild(el('span', 'tc-dcard__scrim'));
    tile.appendChild(el('span', 'tc-dcard__name', d.name));
    card.appendChild(tile);
    var body = el('div', 'tc-dcard__body');
    var best = el('span', 'tc-dcard__best');
    best.appendChild(el('span', 'tc-dcard__best-k', t('bestForLabel')));
    best.appendChild(doc.createTextNode(' ' + t('dest_' + d.key + '_best')));
    body.appendChild(best);
    var chips = el('div', 'tc-dcard__exp'); d.exp.forEach(function (x) { chips.appendChild(el('span', 'tc-dcard__chip', x)); }); body.appendChild(chips);
    var btn = el('button', 'tc-dcard__cta', t('planThisTrip') + ' →'); btn.type = 'button';
    btn.addEventListener('click', function () { planLandingDestination(d.name); });
    body.appendChild(btn);
    card.appendChild(body);
    return card;
  }
  function destinationShowcase() {
    var sec = el('section', 'tc-dshow');
    sec.appendChild(el('strong', 'tc-dshow__t', t('showcaseTitle')));
    sec.appendChild(el('p', 'tc-dshow__sub', t('showcaseSub')));
    // Full-width alternating "story" panels (magazine layout) — not a grid of small cards.
    var stories = el('div', 'tc-dshow__stories');
    LANDING_DESTS.forEach(function (d, i) { stories.appendChild(destinationStoryBand(d, i)); });
    sec.appendChild(stories);
    sec.appendChild(el('p', 'tc-dshow__note', '🔎 ' + t('showcaseNote')));
    return sec;
  }
  // Trust: heritage + the honest-data guarantees (our anti-fabrication policy as a selling point).
  function trustSection() {
    var sec = el('section', 'tc-trust');
    sec.appendChild(el('strong', 'tc-trust__t', '✦ ' + t('trustTitle')));
    sec.appendChild(el('p', 'tc-trust__sub', t('trustSub')));
    var row = el('div', 'tc-trust__row');
    [t('trust_noprice'), t('trust_nobooking'), t('trust_nophotos')].forEach(function (x) {
      row.appendChild(el('span', 'tc-trust__badge', '✓ ' + x));
    });
    sec.appendChild(row);
    sec.appendChild(el('p', 'tc-trust__note', t('trustNote')));
    return sec;
  }
  // Premium closing CTA band — aurora panel + display headline + the gold CTA.
  function finalCtaBand() {
    var band = el('section', 'tc-finalcta');
    band.appendChild(el('div', 'tc-finalcta__aurora'));
    var inner = el('div', 'tc-finalcta__inner');
    inner.appendChild(el('strong', 'tc-finalcta__t', t('ctaBandTitle')));
    inner.appendChild(el('p', 'tc-finalcta__sub', t('ctaBandSub')));
    inner.appendChild(heroCtaBtn());
    band.appendChild(inner);
    return band;
  }
  // ── Cinematic landing (magazine / travel-brochure feel) — decorative SVG scenes only
  // (NO fake photos): a full-bleed California sunset-coast hero + alternating full-width
  // destination "story" panels. All art is clearly decorative; motion respects reduced-motion. ──
  function prefersReducedMotion() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function palmSvg(x, y, s) {
    s = s || 1;
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="#0a1626" stroke-width="7" fill="none" stroke-linecap="round">'
      + '<path d="M0 0 q -5 -80 7 -132"/>'
      + '<g stroke-width="6"><path d="M7 -132 q -54 -12 -92 7"/><path d="M7 -132 q 54 -12 92 7"/><path d="M7 -132 q -40 -38 -70 -58"/><path d="M7 -132 q 40 -38 70 -58"/><path d="M7 -132 q 0 -44 3 -70"/></g></g>';
  }
  // Full-bleed hero backdrop: layered sunset coast. `anim` adds the AI route traveler (SMIL).
  function caHeroScene(anim) {
    var route = 'M120 880 C 380 760, 560 720, 800 640 S 1040 520, 1040 430';
    var traveler = anim ? ('<circle r="8" fill="#fff"><animateMotion dur="7s" repeatCount="indefinite" path="' + route + '"/></circle>') : '';
    return '<svg class="tc-cine__svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">'
      + '<defs>'
      + '<linearGradient id="cineSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07182f"/><stop offset="0.42" stop-color="#21487c"/><stop offset="0.7" stop-color="#d2774d"/><stop offset="0.88" stop-color="#f2b15f"/><stop offset="1" stop-color="#ffdc93"/></linearGradient>'
      + '<radialGradient id="cineSun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff6e0"/><stop offset="0.35" stop-color="#ffd687" stop-opacity="0.95"/><stop offset="1" stop-color="#ffbf63" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="cineSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6bd76"/><stop offset="0.45" stop-color="#9a7ba6"/><stop offset="1" stop-color="#243a5e"/></linearGradient>'
      + '</defs>'
      + '<rect width="1440" height="900" fill="url(#cineSky)"/>'
      + '<g class="tc-cine__sun"><circle cx="1040" cy="430" r="250" fill="url(#cineSun)"/><circle cx="1040" cy="430" r="74" fill="#fff1cf"/></g>'
      + '<rect y="470" width="1440" height="220" fill="url(#cineSea)" opacity="0.92"/>'
      + '<g stroke="#ffe6b8" stroke-opacity="0.28" stroke-width="3" stroke-linecap="round"><line x1="950" y1="525" x2="1130" y2="525"/><line x1="985" y1="570" x2="1095" y2="570"/><line x1="1005" y1="615" x2="1075" y2="615"/></g>'
      + '<path class="tc-cine__hill" d="M0 560 C 240 500, 520 545, 760 525 S 1180 505, 1440 545 L1440 900 L0 900 Z" fill="#143560"/>'
      + '<path class="tc-cine__hill" d="M0 670 C 300 605, 600 655, 900 645 S 1280 655, 1440 668 L1440 900 L0 900 Z" fill="#0b2143"/>'
      + palmSvg(170, 700, 1.05) + palmSvg(1290, 720, 0.85)
      + '<path class="tc-cine__route" d="' + route + '" fill="none" stroke="#ffe2a6" stroke-width="4" stroke-dasharray="2 16" stroke-linecap="round" opacity="0.9"/>'
      + traveler
      + '</svg>';
  }
  var TC_IMG = '/assets/travel-concierge/';
  // Real, licensed California photos (Wikimedia Commons — see assets/travel-concierge/CREDITS.md).
  var HERO_PHOTOS = ['hero-coast.jpg', 'hero-goldengate.jpg'];
  function heroCinematic(loggedIn) {
    var hero = el('section', 'tc-cine');
    // Rotating real-photo background (crossfade + slow Ken-Burns), with a gradient poster as the
    // instant paint + fallback. First photo loads eager (LCP); the rest are decorative.
    var bg = el('div', 'tc-cine__bg'); bg.setAttribute('aria-hidden', 'true');
    HERO_PHOTOS.forEach(function (src, i) {
      var layer = el('div', 'tc-cine__photo' + (i === 0 ? ' is-first' : ''));
      layer.style.backgroundImage = "url('" + TC_IMG + src + "')";
      bg.appendChild(layer);
    });
    hero.appendChild(bg);
    hero.appendChild(el('div', 'tc-cine__scrim'));
    // Floating decorative "AI picks" cards over the visual.
    var floats = el('div', 'tc-cine__floats'); floats.setAttribute('aria-hidden', 'true');
    [['🏖️', 'disc_beaches'], ['🎢', 'disc_themeparks'], ['🍜', 'disc_restaurants']].forEach(function (c, i) {
      var f = el('div', 'tc-cine__float tc-cine__float--' + (i + 1));
      f.appendChild(el('span', 'tc-cine__float-tag', '✨ ' + t('heroShowcaseLead')));
      f.appendChild(el('span', 'tc-cine__float-txt', c[0] + ' ' + t(c[1])));
      floats.appendChild(f);
    });
    hero.appendChild(floats);
    var inner = el('div', 'tc-cine__inner');
    inner.appendChild(el('span', 'tc-hero__chip', '✦ ' + t('heroChip')));
    inner.appendChild(el('h1', 'tc-hero__title', t('heroTitle')));
    inner.appendChild(el('p', 'tc-hero__sub', t('heroSub')));
    inner.appendChild(heroCtaBtn());
    if (!loggedIn) inner.appendChild(el('p', 'tc-hero__free', t('heroFreeNote')));
    var chips = el('div', 'tc-cine__chips');
    ['disc_beaches', 'disc_themeparks', 'disc_gems', 'disc_restaurants', 'disc_hotels', 'tm_hoang_bus', 'tm_dlc_ride', 'disc_livemap', 'disc_clips'].forEach(function (k) { chips.appendChild(el('span', 'tc-cine__chip', t(k))); });
    inner.appendChild(chips);
    hero.appendChild(inner);
    return hero;
  }
  // Decorative destination scene (clearly an illustration, never a photo). Unique gradient id per
  // destination so multiple inline SVGs don't share defs. arch ∈ beach/themepark/bridge/hills/mountains/neon.
  function destScene(arch, acc, key) {
    var g = 'ds_' + key;
    var sky = '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1d38"/><stop offset="0.5" stop-color="' + acc + '" stop-opacity="0.5"/><stop offset="1" stop-color="#f4b86a"/></linearGradient></defs>';
    var base = '<rect width="600" height="400" fill="url(#' + g + ')"/>';
    var sun = '<circle cx="455" cy="150" r="135" fill="#ffd98a" opacity="0.45"/><circle cx="455" cy="150" r="52" fill="#fff1cf"/>';
    var ground = '<rect y="330" width="600" height="70" fill="#0b1f3c"/>';
    var art;
    if (arch === 'beach') art = sun + '<rect y="270" width="600" height="130" fill="#274a73" opacity="0.9"/><g stroke="#ffe6b8" stroke-opacity="0.3" stroke-width="3"><line x1="380" y1="300" x2="520" y2="300"/><line x1="410" y1="330" x2="500" y2="330"/></g>' + palmSvg(80, 320, 0.9) + palmSvg(520, 335, 0.7);
    else if (arch === 'themepark') art = sun + '<g stroke="#0b1f3c" stroke-width="5" fill="none"><circle cx="190" cy="190" r="92"/><circle cx="190" cy="190" r="14" fill="#0b1f3c"/>' + (function () { var sp = ''; for (var a = 0; a < 12; a++) { var r = a * Math.PI / 6; sp += '<line x1="190" y1="190" x2="' + (190 + 92 * Math.cos(r)).toFixed(0) + '" y2="' + (190 + 92 * Math.sin(r)).toFixed(0) + '"/>'; } return sp; })() + '</g>' + '<g fill="#0b1f3c"><path d="M380 330 L380 220 L405 195 L430 220 L430 330 Z"/><path d="M440 330 L440 200 L470 165 L500 200 L500 330 Z"/><path d="M510 330 L510 230 L532 205 L554 230 L554 330 Z"/></g>' + ground;
    else if (arch === 'bridge') art = '<rect y="250" width="600" height="150" fill="#2a4068" opacity="0.85"/><g stroke="' + acc + '" stroke-width="10" fill="none" stroke-linecap="round"><line x1="170" y1="70" x2="170" y2="330"/><line x1="430" y1="70" x2="430" y2="330"/><path d="M20 250 Q 300 60 580 250"/><path d="M20 300 L580 300"/></g><g stroke="' + acc + '" stroke-width="3" opacity="0.7">' + (function () { var c = ''; for (var x = 60; x <= 560; x += 40) { c += '<line x1="' + x + '" y1="300" x2="' + x + '" y2="' + (250 + Math.abs(x - 300) * 0.55).toFixed(0) + '"/>'; } return c; })() + '</g>';
    else if (arch === 'hills') art = sun + '<g fill="#fff" opacity="0.8"><circle cx="120" cy="90" r="2.5"/><circle cx="200" cy="60" r="2"/><circle cx="300" cy="100" r="2.5"/><circle cx="380" cy="70" r="2"/><circle cx="90" cy="150" r="2"/></g><path d="M0 300 C 150 240 300 300 600 250 L600 400 L0 400 Z" fill="#13325a"/><path d="M0 340 C 200 300 420 350 600 320 L600 400 L0 400 Z" fill="#0b1f3c"/>' + palmSvg(70, 360, 0.7) + palmSvg(540, 370, 0.6);
    else if (arch === 'mountains') art = '<g fill="#13325a"><path d="M-20 360 L160 130 L330 360 Z"/><path d="M230 360 L430 160 L600 360 Z"/></g><g fill="#eaf2ff" opacity="0.9"><path d="M120 195 L160 130 L205 195 L175 180 L150 192 Z"/><path d="M390 220 L430 160 L470 220 L445 205 L415 215 Z"/></g><line x1="300" y1="200" x2="300" y2="360" stroke="#bfe3ff" stroke-width="6" opacity="0.7"/><g fill="#0b2a1e"><path d="M70 360 L100 285 L130 360 Z"/><path d="M95 360 L125 300 L155 360 Z"/><path d="M470 360 L500 295 L530 360 Z"/></g>' + ground;
    else art = '<g>' + (function () { var bars = '', xs = [60, 130, 220, 300, 380, 470, 540], hs = [120, 200, 90, 240, 150, 210, 110]; for (var i = 0; i < xs.length; i++) { bars += '<rect x="' + xs[i] + '" y="' + (360 - hs[i]) + '" width="44" height="' + hs[i] + '" rx="4" fill="#10254a"/>'; bars += '<rect x="' + (xs[i] + 10) + '" y="' + (360 - hs[i] + 14) + '" width="24" height="6" rx="3" fill="' + acc + '"/>'; } return bars; })() + '</g><g fill="' + acc + '" opacity="0.9"><circle cx="455" cy="120" r="6"/><circle cx="120" cy="150" r="5"/><circle cx="300" cy="90" r="5"/></g>' + ground;
    return '<svg class="tc-story__svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + sky + base + art + '</svg>';
  }
  // key → real licensed destination photo (Wikimedia Commons; CREDITS.md).
  var DEST_PHOTO = { sandiego: 'sandiego.jpg', oc: 'oc.jpg', sf: 'bayarea.jpg', la: 'la.jpg', yosemite: 'yosemite.jpg', vegas: 'vegas.jpg' };
  // Full-width alternating destination "story" panel (magazine layout — NOT a small-card grid).
  function destinationStoryBand(d, i) {
    var band = el('article', 'tc-story tc-story--' + (i % 2 ? 'right' : 'left'));
    band.style.setProperty('--acc', d.accent);
    var media = el('div', 'tc-story__media');
    var img = el('img', 'tc-story__img'); img.src = TC_IMG + (DEST_PHOTO[d.key] || 'hero-coast.jpg');
    img.setAttribute('loading', 'lazy'); img.setAttribute('decoding', 'async'); img.setAttribute('alt', d.name);
    media.appendChild(img);
    media.appendChild(el('span', 'tc-story__mscrim'));
    media.appendChild(el('strong', 'tc-story__medianame', d.name));
    band.appendChild(media);
    var body = el('div', 'tc-story__body');
    body.appendChild(el('span', 'tc-story__eyebrow', '✦ ' + t('bestForLabel')));
    body.appendChild(el('p', 'tc-story__best', t('dest_' + d.key + '_best')));
    var chips = el('div', 'tc-story__exp'); d.exp.forEach(function (x) { chips.appendChild(el('span', 'tc-story__chip', x)); }); body.appendChild(chips);
    var btn = el('button', 'tc-story__cta', t('planThisTrip') + ' →'); btn.type = 'button';
    btn.addEventListener('click', function () { planLandingDestination(d.name); });
    body.appendChild(btn);
    band.appendChild(body);
    return band;
  }
  // "AI Discovers" — horizontal real-photo rail (verified licensed CA photos).
  var DISCOVERS = [
    ['🌅', 'disc_beaches', 'hero-coast.jpg'], ['🦭', 'disc_sealife', 'sandiego.jpg'], ['🎡', 'disc_themeparks', 'oc.jpg'],
    ['🌉', 'disc_icons', 'bayarea.jpg'], ['🏔', 'disc_nature', 'yosemite.jpg'], ['🎰', 'disc_nightlife', 'vegas.jpg'],
  ];
  function discoversRail() {
    var sec = el('section', 'tc-disc');
    var head = el('div', 'tc-disc__head');
    head.appendChild(el('span', 'tc-eyebrow', '✦ ' + t('heroShowcaseLead')));
    head.appendChild(el('strong', 'tc-disc__t', t('discoverTitle')));
    head.appendChild(el('p', 'tc-disc__sub', t('discoverSub')));
    sec.appendChild(head);
    var rail = el('div', 'tc-disc__rail');
    DISCOVERS.forEach(function (c) {
      var card = el('div', 'tc-disc__card');
      var img = el('img', 'tc-disc__img'); img.src = TC_IMG + c[2]; img.setAttribute('loading', 'lazy'); img.setAttribute('decoding', 'async'); img.setAttribute('alt', t(c[1]));
      card.appendChild(img);
      card.appendChild(el('span', 'tc-disc__lbl', c[0] + ' ' + t(c[1])));
      rail.appendChild(card);
    });
    sec.appendChild(rail);
    return sec;
  }
  function renderHero() {
    var s = el('section', 'tc-hero tc-hero--cine');
    var loggedIn = !!realUser();
    var samples = root.TC_SAMPLES || {};
    var featuredKey = samples.san_diego ? 'san_diego' : Object.keys(samples)[0];
    // Cinematic full-bleed hero (rotating real CA photos + scrim + headline/CTA/chips).
    s.appendChild(heroCinematic(loggedIn));
    // Returning users: their trips right under the hero.
    if (loggedIn) s.appendChild(heroMyTrips());
    // AI Discovers — real-photo rail.
    s.appendChild(discoversRail());
    // Differentiator: tell us 3 things → AI does the homework.
    s.appendChild(whoWhereWhatBand());
    // Show the magic: a LIVE preview of a real sample plan (no login to view it in full).
    var fp = heroSamplePreview(featuredKey); if (fp) s.appendChild(fp);
    // Other samples (exclude the featured one) as quick chips.
    var demos = el('div', 'tc-hero__demos');
    Object.keys(samples).filter(function (k) { return k !== featuredKey; }).forEach(function (k) {
      var sample = samples[k];
      var d = el('button', 'tc-hero__demo'); d.type = 'button';
      var fcount = sample.families ? sample.families.length : 2, dcount = sample.days ? sample.days.length : 3;
      d.appendChild(el('strong', null, sample.destination || k));
      d.appendChild(el('span', null, t('demoMeta').replace('{f}', String(fcount)).replace('{d}', String(dcount))));
      d.addEventListener('click', function () { openDemo(k); });
      demos.appendChild(d);
    });
    if (demos.children.length) { s.appendChild(el('p', 'tc-hero__demos-lbl', t('otherSamples'))); s.appendChild(demos); }
    // Popular destination showcase — visual "plan this trip" ideas (pre-fills destination only).
    s.appendChild(destinationShowcase());
    // Show the intelligence: how it works → the 10 agent capabilities → trust.
    s.appendChild(howItWorksSection());
    s.appendChild(capabilityCards());
    s.appendChild(trustSection());
    // Premium closing CTA band after the full story.
    s.appendChild(finalCtaBand());
    // No hero login row: the persistent header account control (tcHeaderAcct) handles login
    // on every screen — a second hero login button was redundant (the "two logins").
    return s;
  }
  function openDemo(key) {
    var sample = root.TC_SAMPLES[key];
    newTrip();
    state.trip.groupName = sample.groupName; state.trip.destination = sample.destination;
    state.trip.dateRange = sample.dateRange; state.trip.plan = JSON.parse(JSON.stringify(sample));
    state.trip.plan.dataSource = 'mock_sample_pending_verification';
    state.trip.destinations = [{ id: uid('dest'), order: 0, city: sample.destination, startDate: '', endDate: '', hotel: null, notes: '' }];
    normalizeDestinations(state.trip);
    state.trip._demo = true; state.readonly = true; // read-only local preview, no login/Firestore
    state.screen = 'plan'; state.activeDay = 0; state.activeTab = 'overview';
    pushTripUrl(null); render();
  }

  function newTrip() {
    state.trip = {
      id: uid('trip'), groupName: '', destination: '', destinations: [newDestination(0)], dateRange: '', departureCity: '',
      tripStyle: 'balanced', budget: 'moderate', lastDayFull: false, finalDayMode: 'ai_decide', families: [newFamily()], preferences: defaultPrefs(),
      plan: null, votes: {}, notes: [], booking: {}, transportStatus: {}, hotelStatus: {}, suggestions: [], bookings: [], placeOverrides: {}, addedPlaces: [], dayTiming: {}, pinnedActivities: [],
      memberFamily: {}, liveHighlights: [], liveSourceNote: '', ownerUid: '', createdAt: Date.now(),
      returnTransportPreference: 'any', returnProvider: '', // final leg home (Journey Builder)
    };
    normalizeDestinations(state.trip);
    state.readonly = false;
    try { applyMemoryToNewTrip(state.trip); } catch (e) {} // seed budget/pace + carry "never suggest" places from cross-trip memory
  }
  var ROLE_KEYS = ['main_destination', 'overnight_destination', 'stopover', 'meal_stop', 'airport_arrival', 'pass_through', 'optional_attraction'];
  // Per-destination hotel PREFERENCES (the AI recommends the actual stay — no manual entry).
  var DEST_HOTEL_PREFS = ['budget', 'moderate', 'luxury', 'pool', 'kitchen', 'breakfast', 'suite', 'ocean_view', 'near_attractions'];
  // Sensible defaults per destination role (how the AI should treat the stop).
  function roleDefaults(role) {
    switch (role) {
      case 'overnight_destination': return { stayOvernight: true, hotelNeeded: true, mealOnly: false, activityOnly: false, suggestFood: true, suggestActivities: true, suggestHotels: true, priority: 'required' };
      case 'stopover': return { stayOvernight: false, hotelNeeded: false, mealOnly: false, activityOnly: true, suggestFood: true, suggestActivities: true, suggestHotels: false, priority: 'optional' };
      case 'meal_stop': return { stayOvernight: false, hotelNeeded: false, mealOnly: true, activityOnly: false, suggestFood: true, suggestActivities: false, suggestHotels: false, priority: 'optional' };
      case 'airport_arrival': return { stayOvernight: false, hotelNeeded: false, mealOnly: false, activityOnly: false, suggestFood: true, suggestActivities: false, suggestHotels: false, priority: 'required' };
      case 'pass_through': return { stayOvernight: false, hotelNeeded: false, mealOnly: false, activityOnly: false, suggestFood: false, suggestActivities: false, suggestHotels: false, priority: 'optional' };
      case 'optional_attraction': return { stayOvernight: false, hotelNeeded: false, mealOnly: false, activityOnly: true, suggestFood: false, suggestActivities: true, suggestHotels: false, priority: 'optional' };
      default: return { stayOvernight: true, hotelNeeded: true, mealOnly: false, activityOnly: false, suggestFood: true, suggestActivities: true, suggestHotels: true, priority: 'required' };
    }
  }
  // Fill missing role-driven fields (idempotent; never overrides a user's explicit value).
  function normalizeDestRole(d) {
    if (!d.role || ROLE_KEYS.indexOf(d.role) === -1) d.role = 'main_destination';
    var defs = roleDefaults(d.role);
    Object.keys(defs).forEach(function (k) { if (d[k] == null) d[k] = defs[k]; });
    if (d.hoursToSpend == null) d.hoursToSpend = '';
    return d;
  }
  // Apply a role change: set role + reset its role-driven defaults (user can then tweak).
  function applyDestRole(d, role) { d.role = role; var defs = roleDefaults(role); Object.keys(defs).forEach(function (k) { d[k] = defs[k]; }); return d; }
  function newDestination(order) {
    // Segment model (Step A): arrivalDate/departureDate are canonical (startDate/endDate kept as
    // aliases); transportPreference/preferredProvider describe the INBOUND leg to this stop.
    var d = { id: uid('dest'), order: order || 0, city: '', arrivalDate: '', departureDate: '', startDate: '', endDate: '', nights: 0, overnightStay: true, transportPreference: 'any', preferredProvider: '', hotel: null, notes: '', hoursToSpend: '', hotelPrefs: [],
      // Journey Builder intent flags (NL parser fills these; manual builder defaults are inert).
      // lockedByUser = the user fixed this leg's transport/provider → the AI never overrides it.
      lockedByUser: false, needsResearch: false, needsBooking: false, verificationStatus: '' };
    return normalizeDestRole(d);
  }
  function newFamily() {
    return { id: uid('fam'), name: '', adults: 2, childrenAges: '', seniors: 0, foodPrefs: '', interests: [],
             foodPrefsKeys: [], kidPrefs: [], teenInterests: [], seniorNeeds: [], hotelPrefs: [], stayPrefs: [],
             accessibility: '', napNeeds: '', roomNeeds: '',
             // transport kept in the model (defaulted) — the AI Transportation agent now
             // researches/compares car|plane|bus instead of asking the user (V2).
             transport: { method: 'car', origin: '', travelers: 2, departureWindow: '', arrivalDeadline: '',
                          budgetPref: 'moderate', luggage: '', carSeat: false, accessibility: '', numCars: 1 } };
  }
  // Ensure a family has all the new structured arrays (back-compat for old/loaded
  // families whose foodPrefs/accessibility/roomNeeds were stored as plain strings).
  function normalizeFamily(f) {
    if (!f) return newFamily();
    if (!Array.isArray(f.interests)) f.interests = [];
    ['foodPrefsKeys', 'kidPrefs', 'teenInterests', 'seniorNeeds', 'hotelPrefs', 'stayPrefs', 'members'].forEach(function (k) { if (!Array.isArray(f[k])) f[k] = []; });
    return f;
  }
  // Pure, idempotent. Guarantees trip.destinations[] (ordered) AND the derived
  // trip.destination string stay in sync (the planner's NO_DESTINATION guard and
  // TC_SAMPLES are keyed by the string), and back-fills plan day fields so old/sample
  // plans render in the multi-destination timeline. Safe to call repeatedly.
  function normalizeDestinations(trip) {
    if (!trip) return trip;
    if (!Array.isArray(trip.destinations) || !trip.destinations.length) {
      trip.destinations = [{ id: uid('dest'), order: 0, city: trip.destination || '', startDate: '', endDate: '', hotel: null, notes: '' }];
    }
    trip.destinations.forEach(function (d, i) { if (d.order == null) d.order = i; if (!d.id) d.id = uid('dest'); normalizeDestRole(d); });
    trip.destinations.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    trip.destinations.forEach(function (d, i) { d.order = i; });
    // Segment back-fill (Step A): sync arrival/departure ↔ start/end aliases, compute nights,
    // default overnight/transport. Back-compat: old destinations with only start/end load clean.
    trip.destinations.forEach(function (d) {
      var a = segArrival(d), b = segDeparture(d);
      d.arrivalDate = a; d.startDate = a; d.departureDate = b; d.endDate = b;
      d.nights = segNights(d);
      if (d.overnightStay == null) d.overnightStay = (d.nights > 0) || d.role === 'overnight_destination' || d.role === 'main_destination';
      if (d.transportPreference == null) d.transportPreference = 'any';
      if (d.preferredProvider == null) d.preferredProvider = '';
      // Journey Builder intent flags — back-fill for trips created before these existed.
      if (d.lockedByUser == null) d.lockedByUser = false;
      if (d.needsResearch == null) d.needsResearch = false;
      if (d.needsBooking == null) d.needsBooking = false;
      if (d.verificationStatus == null) d.verificationStatus = '';
    });
    var cities = trip.destinations.map(function (d) { return (d.city || '').trim(); }).filter(Boolean);
    // Keep the string field populated for the planner + samples (single city = plain name).
    trip.destination = cities.length ? cities.join(' → ') : (trip.destination || '');
    // Segments own the calendar: derive the global dateRange from per-segment dates when present
    // (legacy trips with only a manual dateRange are returned unchanged — never clobbered).
    var derived = deriveDateRange(trip);
    if (derived) trip.dateRange = derived;
    if (!trip.hotelStatus) trip.hotelStatus = {};
    if (!Array.isArray(trip.bookings)) trip.bookings = [];
    if (trip.plan && Array.isArray(trip.plan.days)) {
      trip.plan.days.forEach(function (d) {
        if (d.destinationIndex == null) d.destinationIndex = 0;
        if (d.isTravelDay == null) d.isTravelDay = false;
      });
    }
    if (Array.isArray(trip.families)) trip.families.forEach(normalizeFamily);
    return trip;
  }
  function defaultPrefs() {
    return { pace: 'balanced', budgetLevel: 'moderate', kidPriority: true, foodiePriority: false,
             photoPriority: true, minDriving: false, hiddenGems: true, freeActivities: true,
             reservationActivities: true, backupPlans: true };
  }

  // ── Screen: create ─────────────────────────────────────────────────────
  function field(label, node) { var w = el('label', 'tc-field'); w.appendChild(el('span', 'tc-field__lbl', label)); w.appendChild(node); return w; }
  function input(val, ph, type) { var i = doc.createElement('input'); i.className = 'tc-input'; i.type = type || 'text'; if (val != null) i.value = val; if (ph) i.placeholder = ph; return i; }
  function selectFrom(opts, val, labelFn) {
    var s = doc.createElement('select'); s.className = 'tc-input';
    opts.forEach(function (o) { var op = doc.createElement('option'); op.value = o; op.textContent = labelFn ? labelFn(o) : o; if (o === val) op.selected = true; s.appendChild(op); });
    return s;
  }
  function seg(opts, val, labelKey, onPick) {
    var wrap = el('div', 'tc-seg');
    opts.forEach(function (o) {
      var b = el('button', 'tc-seg__btn' + (o === val ? ' tc-seg__btn--on' : ''), t(labelKey + o)); b.type = 'button';
      b.addEventListener('click', function () { onPick(o); wrap.querySelectorAll('.tc-seg__btn').forEach(function (x) { x.classList.remove('tc-seg__btn--on'); }); b.classList.add('tc-seg__btn--on'); });
      wrap.appendChild(b);
    });
    return wrap;
  }
  function stepHeader(n) {
    var h = el('div', 'tc-stephead');
    h.appendChild(el('span', 'tc-stephead__step', t('step') + ' ' + n + ' ' + t('of') + ' 2'));
    var bar = el('div', 'tc-stephead__bar'); var fill = el('i'); fill.style.width = (n / 2 * 100) + '%'; bar.appendChild(fill); h.appendChild(bar);
    return h;
  }
  // City input with native datalist suggestions (free-text + quick-pick, mobile-safe).
  function cityInput(d) {
    var wrap = el('div', 'tc-dest__citywrap');
    var inp = input(d.city, t('destination')); inp.className = 'tc-input tc-dest__city';
    var listId = 'tc-dl-' + d.id;
    inp.setAttribute('list', listId);
    var dl = doc.createElement('datalist'); dl.id = listId;
    DESTINATIONS.forEach(function (city) { var op = doc.createElement('option'); op.value = city; dl.appendChild(op); });
    inp.addEventListener('input', function () { d.city = inp.value; });
    wrap.appendChild(inp); wrap.appendChild(dl);
    return wrap;
  }
  function swapDest(tr, a, b) { var arr = tr.destinations, tmp = arr[a].order; arr[a].order = arr[b].order; arr[b].order = tmp; normalizeDestinations(tr); }
  // V2: a destination is JUST a city. No roles, hotels, dates, hours, or stop settings —
  // the AI concierge determines all of that. Users only say WHERE they want to go.
  function destinationRow(tr, d, i, rerender) {
    var row = el('article', 'tc-dest tc-dest--simple');
    var head = el('div', 'tc-dest__head');
    head.appendChild(el('span', 'tc-dest__num', String(i + 1)));
    head.appendChild(cityInput(d));
    var ctrls = el('div', 'tc-dest__ctrls');
    if (i > 0) { var up = el('button', 'tc-dest__move', '↑'); up.type = 'button'; up.setAttribute('aria-label', t('moveUp')); up.addEventListener('click', function () { swapDest(tr, i, i - 1); rerender(); }); ctrls.appendChild(up); }
    if (i < tr.destinations.length - 1) { var dn = el('button', 'tc-dest__move', '↓'); dn.type = 'button'; dn.setAttribute('aria-label', t('moveDown')); dn.addEventListener('click', function () { swapDest(tr, i, i + 1); rerender(); }); ctrls.appendChild(dn); }
    if (tr.destinations.length > 1) { var rm = el('button', 'tc-dest__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', t('removeDestination')); rm.addEventListener('click', function () { tr.destinations.splice(i, 1); normalizeDestinations(tr); rerender(); }); ctrls.appendChild(rm); }
    head.appendChild(ctrls);
    row.appendChild(head);
    return row;
  }
  function destinationsEditor(tr) {
    var wrap = el('div', 'tc-destwrap');
    function rerender() {
      wrap.innerHTML = '';
      normalizeDestinations(tr);
      var list = el('div', 'tc-destlist');
      tr.destinations.forEach(function (d, i) { list.appendChild(destinationRow(tr, d, i, rerender)); });
      wrap.appendChild(list);
      var add = el('button', 'tc-adddest', '+ ' + t('addDestination')); add.type = 'button';
      add.addEventListener('click', function () { tr.destinations.push(newDestination(tr.destinations.length)); normalizeDestinations(tr); rerender(); });
      wrap.appendChild(add);
    }
    rerender();
    return wrap;
  }
  // ── Pinned / must-do activities (Issue: user pins anchor activities to a day) ──
  function newPinned() { return { id: uid('pin'), title: '', destination: '', preferredDayNumber: '', preferredTimeOfDay: 'flexible', priority: 'required', notes: '' }; }
  function pinnedRow(tr, pin, i, rerender) {
    var row = el('article', 'tc-pin');
    var head = el('div', 'tc-pin__head'); head.appendChild(el('span', 'tc-pin__num', '★'));
    var rm = el('button', 'tc-dest__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', t('removeDestination')); rm.addEventListener('click', function () { tr.pinnedActivities.splice(i, 1); rerender(); }); head.appendChild(rm);
    row.appendChild(head);
    var ti = input(pin.title, t('pinnedTitlePh')); ti.addEventListener('input', function () { pin.title = ti.value; }); row.appendChild(field(t('pinnedActivity'), ti));
    var cities = (tr.destinations || []).map(function (d) { return (d.city || '').trim(); }).filter(Boolean);
    var destSel = selectFrom([''].concat(cities), pin.destination, function (o) { return o || t('anyDestination'); }); destSel.addEventListener('change', function () { pin.destination = destSel.value; }); row.appendChild(field(t('destination'), destSel));
    var r2 = el('div', 'tc-row2');
    var daySel = selectFrom(['', '1', '2', '3', '4', '5', '6', '7'], String(pin.preferredDayNumber || ''), function (o) { return o ? (t('day') + ' ' + o) : t('flexible'); }); daySel.addEventListener('change', function () { pin.preferredDayNumber = daySel.value; }); r2.appendChild(field(t('preferredDay'), daySel));
    var timeSel = selectFrom(['flexible', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'], pin.preferredTimeOfDay, function (o) { return t('tod_' + o) || o; }); timeSel.addEventListener('change', function () { pin.preferredTimeOfDay = timeSel.value; }); r2.appendChild(field(t('preferredTime'), timeSel));
    row.appendChild(r2);
    row.appendChild(field(t('priority'), seg(['required', 'preferred', 'optional'], pin.priority, 'prio_', function (v) { pin.priority = v; })));
    return row;
  }
  function pinnedEditor(tr) {
    tr.pinnedActivities = tr.pinnedActivities || [];
    var wrap = el('div', 'tc-pinwrap');
    function rerender() {
      wrap.innerHTML = '';
      wrap.appendChild(el('p', 'tc-hint', t('pinnedHint')));
      tr.pinnedActivities.forEach(function (pin, i) { wrap.appendChild(pinnedRow(tr, pin, i, rerender)); });
      var add = el('button', 'tc-adddest', '+ ' + t('addPinned')); add.type = 'button';
      add.addEventListener('click', function () { tr.pinnedActivities.push(newPinned()); rerender(); });
      wrap.appendChild(add);
    }
    rerender();
    return wrap;
  }
  // ── JOURNEY BUILDER (Step B) — Home → Segment 1…N → Return. The user defines WHERE +
  //    WHEN per stop (arrival/departure → nights auto) + how they arrive (transport pref +
  //    preferred provider); the AI optimizes WITHIN. Nothing hardcoded to a city/provider. ──
  var TRANSPORT_PREFS = ['any', 'bus', 'private_ride', 'flight', 'car', 'train'];
  function tcDateInput(val) {
    var i = doc.createElement('input'); i.className = 'tc-input tc-seg2__date'; i.type = 'date';
    var pd = parseSegDate(val); if (pd) i.value = isoOfDate(pd);
    return i;
  }
  function transportPrefLabel(pref, provider) {
    var via = [];
    if (pref && pref !== 'any') via.push(t('tp_' + pref));
    if (provider && provider.trim()) via.push(provider.trim());
    return via.length ? (t('viaLabel') + ' ' + via.join(' · ')) : t('viaAI');
  }
  function transportLegRow(fromCity, toCity, pref, provider) {
    var row = el('div', 'tc-leg');
    row.appendChild(el('span', 'tc-leg__route', (fromCity || t('homeOrigin')) + '  →  ' + (toCity || '…')));
    row.appendChild(el('span', 'tc-leg__via', transportPrefLabel(pref, provider)));
    return row;
  }
  function returnLegRow(tr, fromCity, rerender) {
    var box = el('details', 'tc-leg tc-leg--return');
    box.appendChild(el('summary', 'tc-leg__sum', '🏠 ' + (fromCity || '…') + '  →  ' + (tr.departureCity || t('homeOrigin')) + '  ·  ' + transportPrefLabel(tr.returnTransportPreference, tr.returnProvider)));
    var body = el('div', 'tc-leg__body');
    body.appendChild(el('span', 'tc-field__lbl', t('returnTransport')));
    body.appendChild(seg(TRANSPORT_PREFS, tr.returnTransportPreference || 'any', 'tp_', function (v) { tr.returnTransportPreference = v; rerender(); }));
    var prov = input(tr.returnProvider, t('providerPh')); prov.addEventListener('input', function () { tr.returnProvider = prov.value; });
    body.appendChild(field(t('preferredProvider'), prov));
    box.appendChild(body);
    return box;
  }
  function segmentCard(tr, d, i, rerender, refreshSummary) {
    var card = el('article', 'tc-seg2');
    var head = el('div', 'tc-seg2__head');
    head.appendChild(el('span', 'tc-seg2__num', String(i + 1)));
    head.appendChild(cityInput(d));
    var ctrls = el('div', 'tc-seg2__ctrls');
    if (i > 0) { var up = el('button', 'tc-seg2__move', '↑'); up.type = 'button'; up.setAttribute('aria-label', t('moveUp')); up.addEventListener('click', function () { swapDest(tr, i, i - 1); rerender(); }); ctrls.appendChild(up); }
    if (i < tr.destinations.length - 1) { var dn = el('button', 'tc-seg2__move', '↓'); dn.type = 'button'; dn.setAttribute('aria-label', t('moveDown')); dn.addEventListener('click', function () { swapDest(tr, i, i + 1); rerender(); }); ctrls.appendChild(dn); }
    if (tr.destinations.length > 1) { var rm = el('button', 'tc-seg2__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', t('removeDestination')); rm.addEventListener('click', function () { tr.destinations.splice(i, 1); normalizeDestinations(tr); rerender(); }); ctrls.appendChild(rm); }
    head.appendChild(ctrls);
    card.appendChild(head);
    // Per-segment booking status (Step D) — a DuLichCali ride attached to THIS segment.
    var bst = segmentBookingStatus(state.trip, d.id);
    if (bst === 'booked' || bst === 'user_approval_needed' || bst === 'planning') {
      card.appendChild(el('span', 'tc-seg2__bk tc-seg2__bk--' + (bst === 'booked' ? 'booked' : 'pending'), '🚐 ' + t(bst === 'booked' ? 'segRideBooked' : 'segRidePending')));
    }
    // Dates → nights auto. Native date pickers commit on 'change' (focus loss is fine there).
    var dates = el('div', 'tc-seg2__dates');
    var aIn = tcDateInput(segArrival(d)), bIn = tcDateInput(segDeparture(d));
    var nightsLbl = el('span', 'tc-seg2__nights');
    function renderNights() { var n = segNights(d); nightsLbl.textContent = n > 0 ? (n + ' ' + (n === 1 ? t('nightOne') : t('nightMany'))) : t('sameDay'); }
    function onDate() {
      d.arrivalDate = aIn.value || ''; d.startDate = d.arrivalDate;
      d.departureDate = bIn.value || ''; d.endDate = d.departureDate;
      d.nights = segNights(d); renderNights(); refreshSummary && refreshSummary();
    }
    aIn.addEventListener('change', onDate); bIn.addEventListener('change', onDate);
    dates.appendChild(field(t('arrivalDate'), aIn));
    dates.appendChild(field(t('departureDate'), bIn));
    card.appendChild(dates);
    renderNights(); card.appendChild(nightsLbl);
    // Collapsed: how you arrive + provider + overnight + notes.
    var more = el('details', 'tc-seg2__more');
    more.appendChild(el('summary', 'tc-seg2__moresum', t('segTransportDetails')));
    var mb = el('div', 'tc-seg2__morebody');
    mb.appendChild(el('span', 'tc-field__lbl', t('howArrive').replace('{city}', (d.city || '').trim() || t('thisStop'))));
    mb.appendChild(seg(TRANSPORT_PREFS, d.transportPreference || 'any', 'tp_', function (v) { d.transportPreference = v; rerender(); }));
    var prov = input(d.preferredProvider, t('providerPh')); prov.addEventListener('input', function () { d.preferredProvider = prov.value; });
    mb.appendChild(field(t('preferredProvider'), prov));
    var ovRow = el('label', 'tc-seg2__ov');
    var ocb = doc.createElement('input'); ocb.type = 'checkbox'; ocb.checked = d.overnightStay !== false; ocb.addEventListener('change', function () { d.overnightStay = ocb.checked; });
    ovRow.appendChild(ocb); ovRow.appendChild(el('span', null, t('overnightStay'))); mb.appendChild(ovRow);
    var notes = input(d.notes, t('segNotesPh')); notes.addEventListener('input', function () { d.notes = notes.value; });
    mb.appendChild(field(t('notes'), notes));
    more.appendChild(mb); card.appendChild(more);
    return card;
  }
  function journeySummaryStrip(tr) {
    var strip = el('div', 'tc-jsummary');
    var parts = journeySummary(tr);
    if (!parts.length) { strip.appendChild(el('span', 'tc-jsummary__empty', t('journeyEmpty'))); return strip; }
    parts.forEach(function (p, i) { if (i) strip.appendChild(el('span', 'tc-jsummary__sep', '·')); strip.appendChild(el('span', 'tc-jsummary__item', p)); });
    var totalN = segments(tr).reduce(function (a, d) { return a + segNights(d); }, 0);
    if (totalN > 0) {
      var dr = deriveDateRange(tr), m = dr.match(/-\s*(\d{4}-\d{2}-\d{2})\s*$/), endIso = m ? m[1] : '';
      var endLabel = endIso ? fmtSegDate(parseSegDate(endIso)) : '';
      strip.appendChild(el('span', 'tc-jsummary__sep', '·'));
      strip.appendChild(el('span', 'tc-jsummary__total', totalN + ' ' + (totalN === 1 ? t('nightOne') : t('nightMany')) + (endLabel ? ('  ·  ' + t('homeBy') + ' ' + endLabel) : '')));
    }
    return strip;
  }
  function journeyEditor(tr) {
    var wrap = el('div', 'tc-journeyed');
    var summaryHost = el('div', 'tc-jsummary-host');
    function refreshSummary() { summaryHost.textContent = ''; summaryHost.appendChild(journeySummaryStrip(tr)); }
    function rerender() {
      wrap.textContent = '';
      normalizeDestinations(tr);
      summaryHost = el('div', 'tc-jsummary-host'); wrap.appendChild(summaryHost); refreshSummary();
      var list = el('div', 'tc-seg2list');
      tr.destinations.forEach(function (d, i) {
        var fromCity = (i === 0) ? (tr.departureCity || t('homeOrigin')) : (((tr.destinations[i - 1] || {}).city || '').trim() || '…');
        list.appendChild(transportLegRow(fromCity, (d.city || '').trim(), d.transportPreference, d.preferredProvider));
        list.appendChild(segmentCard(tr, d, i, rerender, refreshSummary));
      });
      var lastCity = ((tr.destinations[tr.destinations.length - 1] || {}).city || '').trim();
      list.appendChild(returnLegRow(tr, lastCity, rerender));
      wrap.appendChild(list);
      var add = el('button', 'tc-adddest', '+ ' + t('addSegment')); add.type = 'button';
      add.addEventListener('click', function () { tr.destinations.push(newDestination(tr.destinations.length)); normalizeDestinations(tr); rerender(); });
      wrap.appendChild(add);
    }
    rerender();
    return wrap;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  NATURAL-LANGUAGE JOURNEY BUILDER — the user types their plan in plain words
  //  ("July 1 take Hoang Bus from San Jose to Orange County, then Michael drives
  //  us to San Diego…"); the AI PARSES it into editable, typed segments shown on a
  //  "Here's what I understood" screen. Locked items (named operators, fixed
  //  activities) are preserved; the rest is flexible and the AI optimizes around the
  //  locked spine. The rich parsed journey (trip.parsedJourney) is the review/edit
  //  source of truth; trip.destinations[] + pinnedActivities[] + the return leg are
  //  DERIVED from it so the existing planner/hotel/itinerary engine runs unchanged.
  //  No hardcoded schedules / prices / photos — unknowns are flagged needsResearch.
  // ════════════════════════════════════════════════════════════════════════
  var JOURNEY_SEG_TYPES = ['transport', 'transfer', 'stay', 'activity', 'food', 'free_time', 'return'];
  var JOURNEY_MODES = ['car', 'bus', 'private_ride', 'flight', 'train', 'walk', 'other'];
  function segTypeIcon(tp) { return { transport: '🚌', transfer: '🚐', stay: '🏨', activity: '🎟️', food: '🍜', free_time: '🕐', return: '🏠' }[tp] || '📍'; }
  function tcNorm(x) { return String(x || '').trim().toLowerCase(); }
  function newJourneySegment(over) {
    var sg = { id: uid('jseg'), date: '', startTime: '', endTime: '', origin: '', destination: '', segmentType: 'activity', transportMode: '', provider: '', title: '', notes: '', lockedByUser: false, flexible: false, mainActivity: false, needsResearch: false, needsBooking: false, priority: '' };
    if (over) Object.keys(over).forEach(function (k) { if (over[k] != null) sg[k] = over[k]; });
    if (JOURNEY_SEG_TYPES.indexOf(sg.segmentType) === -1) sg.segmentType = 'activity';
    // Segment transport priority (V3): required (locked) | preferred | ai_decide | avoid.
    if (['required', 'preferred', 'ai_decide', 'avoid'].indexOf(sg.priority) === -1) sg.priority = sg.lockedByUser ? 'required' : 'ai_decide';
    if (sg.priority === 'required') sg.lockedByUser = true;
    return sg;
  }
  // Ensure a parsed journey (from the callable OR loaded from Firestore) has a clean shape.
  function normalizeParsedJourney(pj) {
    pj = pj || {};
    pj.origin = pj.origin || ''; pj.overallStartDate = pj.overallStartDate || ''; pj.overallEndDate = pj.overallEndDate || '';
    pj.segments = (Array.isArray(pj.segments) ? pj.segments : []).map(function (s) { return newJourneySegment(s); });
    ['fixedRequirements', 'flexibleWindows', 'missingInfoQuestions'].forEach(function (k) { if (!Array.isArray(pj[k])) pj[k] = []; });
    return pj;
  }
  // Map a journey transportMode → the existing per-segment transportPreference enum.
  function modeToTransportPref(mode) {
    switch (mode) { case 'bus': return 'bus'; case 'private_ride': return 'private_ride'; case 'flight': return 'flight'; case 'car': return 'car'; case 'train': return 'train'; default: return 'any'; }
  }
  // Time-of-day bucket for a parsed segment (from startTime, else hints in title/notes).
  function timeOfDayFromSeg(s) {
    var m = String(s.startTime || '').match(/^(\d{1,2}):/);
    if (m) { var h = +m[1]; if (h < 11) return 'morning'; if (h < 13) return 'lunch'; if (h < 17) return 'afternoon'; if (h < 20) return 'dinner'; return 'evening'; }
    var txt = tcNorm((s.title || '') + ' ' + (s.notes || ''));
    if (/morning|sáng|mañana/.test(txt)) return 'morning';
    if (/lunch|trưa|almuerzo/.test(txt)) return 'lunch';
    if (/evening|night|tối|đêm|noche/.test(txt)) return 'evening';
    if (/dinner|tối|cena/.test(txt)) return 'dinner';
    if (/afternoon|chiều|tarde/.test(txt)) return 'afternoon';
    return 'flexible';
  }
  // Client wrapper for the interpretJourneyNotes callable. Resolves to the parsed plan or null.
  function parseJourneyNotes(notes) {
    var c = mkCallable('interpretJourneyNotes', 60000);
    if (!c) return Promise.resolve(null);
    var now = new Date();
    var todayIso = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    return callWithRetry(c, { notes: notes, lang: state.lang, todayIso: todayIso, originHint: (state.trip && state.trip.departureCity) || '' })
      .then(function (r) { var d = (r && r.data) || {}; return (d && d.ok) ? d : null; })
      .catch(function () { return null; });
  }
  // Parse the user's free-text notes → store the parsed journey → show the review screen.
  function buildJourneyFromNotes(notes) {
    notes = String(notes || '').trim();
    if (notes.length < 8) { toast(t('nlParseFail')); return; }
    state._nlNotes = notes;
    renderGenerating(t('nlBuilding'));
    parseJourneyNotes(notes).then(function (pj) {
      if (!pj || !(pj.segments || []).length) { toast(t('nlParseFail')); state.screen = 'create'; render(); return; }
      pj = normalizeParsedJourney(pj); pj._notes = notes;
      state.trip.parsedJourney = pj; state.trip.journeyNotes = notes;
      state.screen = 'nlreview'; render();
    });
  }
  // DERIVE the existing trip model (destinations[] + pinnedActivities[] + return leg) from the
  // rich parsed journey. Deterministic, idempotent — nothing hardcoded to any city/provider.
  // Overnight cities come from 'stay' segments (or inferred from transit destinations); each
  // city's INBOUND transport = the leg that arrives into it; fixed activities/food → pins.
  function applyParsedJourneyToTrip(tr, pj) {
    pj = normalizeParsedJourney(pj);
    tr.parsedJourney = pj;
    if (state._nlNotes) tr.journeyNotes = state._nlNotes;
    if ((pj.origin || '').trim()) tr.departureCity = pj.origin.trim();
    if ((pj.groupName || '').trim() && !(tr.groupName || '').trim()) tr.groupName = pj.groupName.trim();
    var segs = pj.segments || [];
    // Last transit (transport/transfer/return) arriving INTO `city`, at-or-before segment index `byIdx`.
    function inboundFor(city, byIdx) {
      var c = tcNorm(city), best = null;
      for (var i = 0; i <= byIdx && i < segs.length; i++) { var s = segs[i]; if ((s.segmentType === 'transport' || s.segmentType === 'transfer' || s.segmentType === 'return') && tcNorm(s.destination) === c) best = s; }
      return best;
    }
    // 1) Overnight cities — from explicit 'stay' segments (merge consecutive same-city repeats).
    var stays = [];
    segs.forEach(function (s, idx) {
      if (s.segmentType !== 'stay') return;
      var city = (s.destination || s.origin || '').trim(); if (!city) return;
      var prev = stays[stays.length - 1]; if (prev && tcNorm(prev.city) === tcNorm(city)) return;
      stays.push({ city: city, date: s.date, idx: idx });
    });
    // Fallback: no explicit stays → infer overnight cities from distinct transit destinations
    // (skip a destination that is the home origin — that's the return, not an overnight stop).
    if (!stays.length) {
      segs.forEach(function (s, idx) {
        if (s.segmentType !== 'transport' && s.segmentType !== 'transfer') return;
        var city = (s.destination || '').trim(); if (!city || tcNorm(city) === tcNorm(tr.departureCity)) return;
        var prev = stays[stays.length - 1]; if (prev && tcNorm(prev.city) === tcNorm(city)) return;
        stays.push({ city: city, date: s.date, idx: idx });
      });
    }
    var ret = segs.filter(function (s) { return s.segmentType === 'return'; }).slice(-1)[0] || null;
    // Robust trip bounds: prefer the AI's overall dates, else the return leg, else the min/max of
    // any dated segment — so a missing overallStartDate/overallEndDate never produces an empty
    // arrival/departure (which would make buildSegmentDayPlan bail) or blank pinned-activity days.
    var datedIsos = segs.map(function (s) { return s.date; }).filter(function (x) { return parseSegDate(x); }).sort();
    var startIso = pj.overallStartDate || (datedIsos[0] || '');
    var endIso = pj.overallEndDate || (ret && ret.date) || (datedIsos.length ? datedIsos[datedIsos.length - 1] : '');
    if (stays.length) {
      // Resolve a parseable [arrival, departure) window per stay BEFORE building destinations, so a
      // stay the parser left undated (a same-day downstream overnight, e.g. "back to Orange County
      // … overnight" with no restated date) never yields an empty date that makes buildSegmentDayPlan
      // bail to the day-folding legacy skeleton (the Day-3-skipped bug). Inbound-leg date → chain.
      var inboundIso = {};
      stays.forEach(function (st) { var ib = inboundFor(st.city, st.idx); if (ib && ib.date) inboundIso[(st.city || '').trim().toLowerCase()] = ib.date; });
      var stayWins = (root.TCJourneyDays && root.TCJourneyDays.fillStayWindows) ? root.TCJourneyDays.fillStayWindows(stays, startIso, endIso, inboundIso) : null;
      var dests = stays.map(function (st, k) {
        var d = newDestination(k);
        d.city = st.city;
        var win = stayWins && stayWins[k];
        d.arrivalDate = (win && win.arrivalIso) || st.date || ''; d.startDate = d.arrivalDate;
        var dep = (win && win.departureIso) || ((k < stays.length - 1) ? (stays[k + 1].date || '') : endIso);
        d.departureDate = dep || ''; d.endDate = d.departureDate;
        d.overnightStay = true;
        var inb = inboundFor(st.city, st.idx);
        if (inb) {
          d.transportPreference = modeToTransportPref(inb.transportMode);
          d.preferredProvider = inb.provider || '';
          d.lockedByUser = !!inb.lockedByUser; d.needsResearch = !!inb.needsResearch; d.needsBooking = !!inb.needsBooking;
          d.verificationStatus = inb.lockedByUser ? 'locked_by_user' : (inb.needsResearch ? 'pending_verification' : '');
          if ((inb.notes || '').trim()) d.notes = inb.notes.trim();
        }
        return d;
      });
      // Drop same-day pass-through waypoints (0-night) so ONLY real overnight stops become
      // destinations — the full multi-leg detail stays in parsedJourney + the review screen.
      // Keep the last stop even if 0-night so a same-day round trip still yields one destination.
      var overnight = dests.filter(function (d) { return segNights(d) > 0; });
      tr.destinations = overnight.length ? overnight : dests.slice(-1);
    }
    if (ret) { tr.returnTransportPreference = modeToTransportPref(ret.transportMode) || 'any'; tr.returnProvider = ret.provider || ''; }
    if (startIso && endIso) tr.dateRange = startIso + ' - ' + endIso;
    normalizeDestinations(tr);
    // 1b) LOCKED TRANSPORT LEGS — the user's EXACT leg sequence (incl. same-day waypoints the
    // overnight-city list drops, e.g. SJ →bus→ OC →ride→ SD). The transport agent uses these as
    // the chosen/primary route (car only as an alternative). Origin back-filled from the prior place.
    var lockedLegs = [], lastPlace = (tr.departureCity || '').trim();
    segs.forEach(function (s) {
      if (s.segmentType === 'stay' || s.segmentType === 'activity' || s.segmentType === 'food' || s.segmentType === 'free_time') {
        var p = (s.destination || s.origin || '').trim(); if (p) lastPlace = p; return;
      }
      if (s.segmentType === 'transport' || s.segmentType === 'transfer' || s.segmentType === 'return') {
        var from = (s.origin || '').trim() || lastPlace, to = (s.destination || '').trim();
        if (from && to) {
          lockedLegs.push({ fromCity: from, toCity: to, date: s.date || '', transportMode: s.transportMode || '', provider: s.provider || '', lockedByUser: !!s.lockedByUser, priority: s.priority || (s.lockedByUser ? 'required' : 'ai_decide'), needsResearch: !!s.needsResearch, needsBooking: !!s.needsBooking, title: s.title || '', segmentType: s.segmentType });
          lastPlace = to;
        }
      }
    });
    tr.lockedLegs = lockedLegs;
    // 2) Fixed / flexible activities + food → pinned anchors (the planner honors these).
    var startD = parseSegDate(startIso);
    function dayNumFor(iso) { var d = parseSegDate(iso); if (!d || !startD) return ''; var n = nightsBetween(startD, d) + 1; return n > 0 ? String(n) : ''; }
    tr.pinnedActivities = [];
    segs.forEach(function (s) {
      if (s.segmentType !== 'activity' && s.segmentType !== 'food' && !(s.segmentType === 'free_time' && (s.title || '').trim())) return;
      var title = (s.title || '').trim() || (s.segmentType === 'food' ? t('nlFoodExperience') : '');
      if (!title) return;
      var pin = newPinned();
      pin.title = title;
      pin.destination = (s.destination || s.origin || '').trim();
      pin.preferredDayNumber = dayNumFor(s.date);
      pin.preferredTimeOfDay = timeOfDayFromSeg(s);
      pin.priority = s.lockedByUser ? 'required' : (s.flexible ? 'optional' : 'preferred');
      pin.notes = (s.notes || '');
      tr.pinnedActivities.push(pin);
    });
    saveTrip(tr);
  }
  // HARD VALIDATION — if the user's notes named explicit transport providers (Bus Hoang /
  // Xe Đò Hoàng / Michael / DuLichCali ride), the extracted journey MUST carry a leg that
  // represents them. Returns a non-empty issue code only on a genuine EXTRACTION failure (the
  // provider was mentioned but no matching leg survived) — NOT when the user deliberately
  // unlocked a leg in the review screen (the leg + provider still exist).
  function lockedRouteIssue(tr) {
    var notes = ((tr && tr.journeyNotes) || '').toLowerCase(); if (!notes) return '';
    if (!/hoang|hoàng|xe ?đò|xe ?do|michael|du ?lich ?cali|dulichcali|\bdlc\b/.test(notes)) return '';
    var legs = (tr.lockedLegs || []);
    var represented = legs.some(function (l) {
      var p = (l.provider || '').toLowerCase();
      return /hoang|hoàng|michael|dulichcali|du lich cali|\bdlc\b/.test(p) || l.transportMode === 'bus' || l.transportMode === 'private_ride';
    });
    return represented ? '' : 'no_locked_legs';
  }
  // ── "Request DuLichCali ride" for a parsed transfer/ride segment — reuse the EXISTING
  //    sessionStorage → /airport → RideIntake handoff (tripId + segmentId; never auto-confirms). ──
  // Resolve the destination segment for a ride — by city AND date, so a city visited twice in
  // one trip (e.g. a pass-through then a return overnight) attaches the booking to the RIGHT stop.
  function segmentIdForJourneySeg(tr, sg) {
    var c = tcNorm(sg.destination); if (!c) return '';
    var matches = (tr.destinations || []).filter(function (d) { return tcNorm(d.city) === c; });
    if (matches.length > 1 && sg.date) {
      var exact = matches.filter(function (d) { return (d.arrivalDate || '') === sg.date || (d.departureDate || '') === sg.date; })[0];
      if (exact) return exact.id || '';
    }
    return (matches[0] && matches[0].id) || segmentIdForCity(tr, sg.destination);
  }
  function requestSegmentRide(sg) {
    applyParsedJourneyToTrip(state.trip, state.trip.parsedJourney);
    requestDlcInquiry({ kind: 'ride', pickup: sg.origin || state.trip.departureCity || '', dropoff: sg.destination || '', label: sg.title || '', mode: 'dlc_ride', segmentId: segmentIdForJourneySeg(state.trip, sg) });
  }
  // Honest schedule lookup for a named operator (e.g. a bus line) — a REAL web search, never a
  // fabricated schedule/price. Opens the operator's results so the user verifies the real times.
  function openProviderResearch(sg) {
    var q = [sg.provider || '', sg.origin || '', '→', sg.destination || '', t('nlResearchQuery')].filter(Boolean).join(' ');
    var url = 'https://www.google.com/search?q=' + encodeURIComponent(q);
    try { root.open(url, '_blank', 'noopener'); } catch (e) { try { root.location.href = url; } catch (e2) {} }
  }
  function journeyReviewCard(pj, sg, i, rerender) {
    var locked = !!sg.lockedByUser;
    var card = el('article', 'tc-jr' + (locked ? ' tc-jr--locked' : '') + (sg.flexible ? ' tc-jr--flex' : ''));
    var head = el('div', 'tc-jr__head');
    head.appendChild(el('span', 'tc-jr__icon', segTypeIcon(sg.segmentType)));
    var typeSel = selectFrom(JOURNEY_SEG_TYPES, sg.segmentType, function (o) { return t('nlSegType_' + o); });
    typeSel.className = 'tc-input tc-jr__type'; typeSel.addEventListener('change', function () { sg.segmentType = typeSel.value; rerender(); });
    head.appendChild(typeSel);
    var ctrls = el('div', 'tc-jr__ctrls');
    if (i > 0) { var up = el('button', 'tc-jr__mv', '↑'); up.type = 'button'; up.setAttribute('aria-label', t('moveUp')); up.addEventListener('click', function () { var a = pj.segments; var tmp = a[i]; a[i] = a[i - 1]; a[i - 1] = tmp; rerender(); }); ctrls.appendChild(up); }
    if (i < pj.segments.length - 1) { var dn = el('button', 'tc-jr__mv', '↓'); dn.type = 'button'; dn.setAttribute('aria-label', t('moveDown')); dn.addEventListener('click', function () { var a = pj.segments; var tmp = a[i]; a[i] = a[i + 1]; a[i + 1] = tmp; rerender(); }); ctrls.appendChild(dn); }
    var del = el('button', 'tc-jr__rm', '×'); del.type = 'button'; del.setAttribute('aria-label', t('removeDestination')); del.addEventListener('click', function () { pj.segments.splice(i, 1); rerender(); }); ctrls.appendChild(del);
    head.appendChild(ctrls);
    card.appendChild(head);
    // Title.
    var ti = input(sg.title, t('nlSegTitlePh')); ti.addEventListener('input', function () { sg.title = ti.value; }); card.appendChild(field(t('nlSegTitle'), ti));
    // Date + time row.
    var r1 = el('div', 'tc-row2');
    var di = tcDateInput(sg.date); di.classList.remove('tc-seg2__date'); di.addEventListener('change', function () { sg.date = di.value || ''; rerender(); }); r1.appendChild(field(t('nlSegDate'), di));
    var tmi = input(sg.startTime, '', 'time'); tmi.addEventListener('change', function () { sg.startTime = tmi.value || ''; }); r1.appendChild(field(t('nlSegTime'), tmi));
    card.appendChild(r1);
    // Transit-only: from / to / mode / provider.
    if (sg.segmentType === 'transport' || sg.segmentType === 'transfer' || sg.segmentType === 'return') {
      var r2 = el('div', 'tc-row2');
      var fi = input(sg.origin, t('homeOrigin')); fi.addEventListener('input', function () { sg.origin = fi.value; }); r2.appendChild(field(t('nlSegFrom'), fi));
      var toi = input(sg.destination, t('thisStop')); toi.addEventListener('input', function () { sg.destination = toi.value; }); r2.appendChild(field(t('nlSegTo'), toi));
      card.appendChild(r2);
      var modeSel = selectFrom(JOURNEY_MODES, sg.transportMode || 'other', function (o) { return t('nlmode_' + o); }); modeSel.addEventListener('change', function () { sg.transportMode = modeSel.value; }); card.appendChild(field(t('nlSegMode'), modeSel));
      var prov = input(sg.provider, t('providerPh')); prov.addEventListener('input', function () { sg.provider = prov.value; }); card.appendChild(field(t('preferredProvider'), prov));
      // V3 segment priority: Required (locked) / Preferred / AI decides / Avoid this mode.
      var prioSel = selectFrom(['required', 'preferred', 'ai_decide', 'avoid'], sg.priority || (sg.lockedByUser ? 'required' : 'ai_decide'), function (o) { return t('nlprio_' + o); });
      prioSel.addEventListener('change', function () { sg.priority = prioSel.value; sg.lockedByUser = (prioSel.value === 'required'); if (sg.lockedByUser) sg.flexible = false; rerender(); });
      card.appendChild(field(t('nlPriority'), prioSel));
    } else {
      var pli = input(sg.destination || sg.origin, t('destination')); pli.addEventListener('input', function () { sg.destination = pli.value; }); card.appendChild(field(t('destination'), pli));
    }
    // Status pills.
    var pills = el('div', 'tc-jr__pills');
    if (locked) pills.appendChild(chip('tc-chip--lock', '🔒 ' + t('nlLocked')));
    if (sg.flexible) pills.appendChild(chip('tc-chip--flex', '✨ ' + t('nlFlexOn')));
    if (sg.needsResearch) pills.appendChild(chip('tc-chip--warn', '🔎 ' + t('nlNeedsResearch')));
    if (sg.needsBooking) pills.appendChild(chip('tc-chip--warn', '🎫 ' + t('nlNeedsBooking')));
    if (pills.children.length) card.appendChild(pills);
    // Actions: lock/unlock, flexible toggle, research link, ride handoff.
    var acts = el('div', 'tc-jr__acts');
    acts.appendChild(pbtn((locked ? '🔓 ' + t('nlUnlockSeg') : '🔒 ' + t('nlLockSeg')), 'tc-pbtn--ghost', function () { sg.lockedByUser = !locked; sg.priority = sg.lockedByUser ? 'required' : (sg.priority === 'required' ? 'ai_decide' : (sg.priority || 'ai_decide')); if (sg.lockedByUser) sg.flexible = false; rerender(); }));
    if (!locked) acts.appendChild(pbtn((sg.flexible ? '✓ ' + t('nlFlexMark') : '✨ ' + t('nlFlexMark')), 'tc-pbtn--ghost' + (sg.flexible ? ' tc-pbtn--on' : ''), function () { sg.flexible = !sg.flexible; rerender(); }));
    if (sg.needsResearch && (sg.provider || '').trim()) acts.appendChild(pbtn('🔎 ' + t('nlResearchLink'), 'tc-pbtn--ghost', function () { openProviderResearch(sg); }));
    if ((sg.segmentType === 'transfer' || sg.segmentType === 'transport') && (sg.transportMode === 'private_ride' || /michael|dulichcali|du lich cali|dlc/i.test(sg.provider || ''))) {
      acts.appendChild(pbtn('🚐 ' + t('nlRequestRide'), 'tc-pbtn--ride', function () { requestSegmentRide(sg); }));
    }
    card.appendChild(acts);
    // Add-after row.
    var addRow = el('div', 'tc-jr__add');
    addRow.appendChild(pbtn('+ ' + t('nlAddAfter'), 'tc-pbtn--ghost', function () { pj.segments.splice(i + 1, 0, newJourneySegment({ date: sg.date, origin: sg.destination, segmentType: 'activity' })); rerender(); }));
    card.appendChild(addRow);
    return card;
  }
  function renderNLReview() {
    var tr = state.trip, pj = normalizeParsedJourney(tr.parsedJourney);
    tr.parsedJourney = pj;
    var s = el('section', 'tc-screen');
    s.appendChild(el('h2', 'tc-screen__title', '🧭 ' + t('nlReviewTitle')));
    s.appendChild(el('p', 'tc-screen__sub', t('nlReviewSub')));
    if (tr._routeIssue) s.appendChild(el('p', 'tc-jr-fail', '⚠️ ' + t('nlRouteFail')));
    // Trip-level summary (origin + dates) — editable origin.
    var sumBox = el('div', 'tc-jr-sum');
    var dep = input(pj.origin || tr.departureCity, 'San Jose, CA'); dep.addEventListener('input', function () { pj.origin = dep.value; tr.departureCity = dep.value; });
    sumBox.appendChild(field('🏠 ' + t('originLabel'), dep));
    if (pj.overallStartDate || pj.overallEndDate) {
      var dr = el('p', 'tc-jr-sum__dates');
      var a = parseSegDate(pj.overallStartDate), b = parseSegDate(pj.overallEndDate);
      dr.textContent = '📅 ' + (a ? fmtSegDate(a) : '?') + ' — ' + (b ? fmtSegDate(b) : '?');
      sumBox.appendChild(dr);
    }
    s.appendChild(sumBox);
    var listHost = el('div', 'tc-jr-list');
    function rerender() {
      listHost.textContent = '';
      var lastDate = '__none__';
      pj.segments.forEach(function (sg, i) {
        if ((sg.date || '') !== lastDate) {
          lastDate = sg.date || '';
          var dd = parseSegDate(sg.date);
          listHost.appendChild(el('div', 'tc-jr-day', dd ? fmtSegDate(dd) : t('nlNoDate')));
        }
        listHost.appendChild(journeyReviewCard(pj, sg, i, rerender));
      });
      var add = el('button', 'tc-adddest', '+ ' + t('nlAddStop')); add.type = 'button';
      add.addEventListener('click', function () { var last = pj.segments[pj.segments.length - 1]; pj.segments.push(newJourneySegment({ date: last ? last.date : '', segmentType: 'activity' })); rerender(); });
      listHost.appendChild(add);
    }
    rerender();
    s.appendChild(listHost);
    // Fixed requirements / flexible windows / questions.
    function chipBlock(titleKey, arr, cls) {
      if (!arr || !arr.length) return null;
      var b = el('div', 'tc-jr-block');
      b.appendChild(el('strong', 'tc-jr-block__t', t(titleKey)));
      var w = el('div', 'tc-chips');
      arr.forEach(function (x) { w.appendChild(chip(cls, x)); });
      b.appendChild(w); return b;
    }
    var fb = chipBlock('nlFixedReqs', pj.fixedRequirements, 'tc-chip--lock'); if (fb) s.appendChild(fb);
    var xb = chipBlock('nlFlexWindows', pj.flexibleWindows, 'tc-chip--flex'); if (xb) s.appendChild(xb);
    if (pj.missingInfoQuestions && pj.missingInfoQuestions.length) {
      var qb = el('div', 'tc-jr-block');
      qb.appendChild(el('strong', 'tc-jr-block__t', t('nlQuestions')));
      var ql = el('ul', 'tc-jr-q');
      pj.missingInfoQuestions.forEach(function (q) { ql.appendChild(el('li', null, q)); });
      qb.appendChild(ql); s.appendChild(qb);
    }
    // CTAs.
    var cta = el('button', 'tc-cta tc-cta--big', '✓ ' + t('nlConfirmBtn')); cta.type = 'button';
    cta.addEventListener('click', function () {
      if (!pj.segments.length) { toast(t('nlParseFail')); return; }
      applyParsedJourneyToTrip(tr, pj);
      if (!(tr.destinations[0] && tr.destinations[0].city)) { toast(t('required')); return; }
      if (!(tr.groupName || '').trim()) tr.groupName = (tr.destinations[0] && tr.destinations[0].city) || '';
      state.screen = 'families'; render();
    });
    s.appendChild(cta);
    var row = el('div', 'tc-jr-cta2');
    row.appendChild(pbtn('✏️ ' + t('nlEditManual'), 'tc-pbtn--ghost', function () { applyParsedJourneyToTrip(tr, pj); state.screen = 'create'; render(); }));
    row.appendChild(pbtn('↩ ' + t('nlReparse'), 'tc-pbtn--ghost', function () { state._reopenNotes = true; state.screen = 'create'; render(); }));
    s.appendChild(row);
    return s;
  }

  // V2 STEP 1 — Trip basics ONLY: who/where/when + the vibe. AI infers everything else
  // (roles, hotels, transport, schedules, routes, return day). No roles, no hotel forms.
  function renderCreate() {
    var tr = state.trip;
    normalizeDestinations(tr);
    var s = el('section', 'tc-screen'); s.appendChild(stepHeader(1));
    s.appendChild(el('h2', 'tc-screen__title', t('createTitle')));
    s.appendChild(el('p', 'tc-screen__sub', t('createSubV2')));
    // ── Natural-language Journey Builder — describe the trip in plain words; AI parses it into
    //    an editable journey (locked items preserved). Sits ABOVE the step-by-step builder. ──
    var nl = el('div', 'tc-nlcard');
    nl.appendChild(el('strong', 'tc-nlcard__t', '🪄 ' + t('nlSectionTitle')));
    nl.appendChild(el('p', 'tc-nlcard__hint', t('nlSectionHint')));
    var ta = doc.createElement('textarea'); ta.className = 'tc-input tc-nlcard__ta'; ta.rows = 4; ta.placeholder = t('nlPlaceholder');
    if (state._nlNotes) ta.value = state._nlNotes;
    ta.addEventListener('input', function () { state._nlNotes = ta.value; });
    nl.appendChild(ta);
    var build = el('button', 'tc-cta tc-nlcard__btn', '✨ ' + t('nlBuildBtn')); build.type = 'button';
    build.addEventListener('click', function () { buildJourneyFromNotes(ta.value); });
    nl.appendChild(build);
    s.appendChild(nl);
    if (state._reopenNotes) { state._reopenNotes = false; root.setTimeout(function () { try { ta.focus(); ta.scrollIntoView({ block: 'center' }); } catch (e) {} }, 60); }
    s.appendChild(el('div', 'tc-nldiv', t('nlOrDivider')));
    // Journey Builder: Home → Segment 1…N → Return. Origin first, then per-stop dates/transport.
    var dep = input(tr.departureCity, 'San Jose, CA'); dep.addEventListener('input', function () { tr.departureCity = dep.value; });
    s.appendChild(field('🏠 ' + t('originLabel'), dep));
    s.appendChild(el('span', 'tc-field__lbl', t('journeyLabel')));
    s.appendChild(el('p', 'tc-hint', t('journeyHint')));
    s.appendChild(journeyEditor(tr));
    // Quick entry — one date range for the whole trip (used only when no per-segment dates are set;
    // the AI then splits the nights). Per-segment dates always win.
    var quick = el('details', 'tc-create__quick');
    quick.appendChild(el('summary', 'tc-create__quicksum', t('quickEntry')));
    var qb = el('div', 'tc-create__quickbody');
    qb.appendChild(el('p', 'tc-hint', t('quickEntryHint')));
    var dates = input(tr.dateRange, 'Jul 2–5, 2026'); dates.addEventListener('input', function () { tr.dateRange = dates.value; });
    qb.appendChild(field(t('dates'), dates));
    quick.appendChild(qb);
    s.appendChild(quick);
    // Everything else is optional and AI-defaulted (budget Moderate / balanced pace) — collapsed.
    var more = el('details', 'tc-create__more');
    if (state._createMoreOpen) more.open = true;
    more.addEventListener('toggle', function () { state._createMoreOpen = !!more.open; });
    more.appendChild(el('summary', 'tc-create__moresum', '＋ ' + t('moreOptional')));
    var mb = el('div', 'tc-create__morebody');
    mb.appendChild(el('p', 'tc-hint', t('moreOptionalHint')));
    var gn = input(tr.groupName, t('tripNamePh')); gn.addEventListener('input', function () { tr.groupName = gn.value; });
    mb.appendChild(field(t('groupName'), gn));
    mb.appendChild(field(t('budget'), seg(['budget', 'moderate', 'luxury'], tr.budget, 'budget_', function (v) { tr.budget = v; })));
    mb.appendChild(field(t('paceLabel'), seg(['relaxed', 'balanced', 'packed'], tr.tripStyle, 'style_', function (v) { tr.tripStyle = v; })));
    more.appendChild(mb);
    s.appendChild(more);
    var next = el('button', 'tc-cta', t('createBtn')); next.type = 'button';
    next.addEventListener('click', function () {
      normalizeDestinations(tr);
      // Required now: destination(s) + dates. Group name is optional → default to the first city.
      if (!(tr.destinations[0] && tr.destinations[0].city) || !(tr.dateRange || '').trim()) { toast(t('required')); return; }
      if (!(tr.groupName || '').trim()) tr.groupName = tr.destinations[0].city;
      saveTrip(tr); state.screen = 'families'; render();
    });
    s.appendChild(next);
    return s;
  }

  // ── Screen: families (incl. per-family transportation) ─────────────────
  function chipMulti(opts, selected, labelKey, onToggle) {
    var wrap = el('div', 'tc-chips');
    opts.forEach(function (o) {
      var on = selected.indexOf(o) !== -1;
      var c = el('button', 'tc-chip' + (on ? ' tc-chip--on' : ''), t(labelKey + o) !== (labelKey + o) ? t(labelKey + o) : o.replace(/_/g, ' ')); c.type = 'button';
      c.addEventListener('click', function () { var idx = selected.indexOf(o); if (idx === -1) selected.push(o); else selected.splice(idx, 1); c.classList.toggle('tc-chip--on'); onToggle && onToggle(); });
      wrap.appendChild(c);
    });
    return wrap;
  }
  // Collapsible group: a 48px header (title + live count badge + chevron) over a
  // lazily-shown body. Toggling only flips hidden/aria-expanded (no full re-render →
  // preserves scroll + typed input). buildBodyFn(body, refreshBadge) populates it.
  function collapseGroup(titleKey, opensByDefault, buildBodyFn, countFn) {
    var sec = el('section', 'tc-collapse');
    var head = el('button', 'tc-collapse__head'); head.type = 'button';
    head.setAttribute('aria-expanded', opensByDefault ? 'true' : 'false');
    head.appendChild(el('span', 'tc-collapse__title', t(titleKey)));
    var badge = el('span', 'tc-collapse__badge');
    function refreshBadge() { var n = countFn ? countFn() : 0; badge.textContent = n ? String(n) : ''; badge.style.display = n ? '' : 'none'; }
    head.appendChild(badge);
    head.appendChild(el('span', 'tc-collapse__chev', '▾'));
    var body = el('div', 'tc-collapse__body'); if (!opensByDefault) body.hidden = true;
    buildBodyFn(body, refreshBadge);
    refreshBadge();
    head.addEventListener('click', function () {
      var open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      body.hidden = open; sec.classList.toggle('tc-collapse--open', !open);
    });
    if (opensByDefault) sec.classList.add('tc-collapse--open');
    sec.appendChild(head); sec.appendChild(body);
    return sec;
  }
  // Run worker(item,i) over items with bounded concurrency; failures resolve to null.
  function promisePool(items, worker, concurrency) {
    concurrency = concurrency || 2;
    var results = new Array(items.length), idx = 0;
    function runNext() {
      if (idx >= items.length) return Promise.resolve();
      var cur = idx++;
      return Promise.resolve().then(function () { return worker(items[cur], cur); })
        .then(function (r) { results[cur] = r; }, function () { results[cur] = null; })
        .then(runNext);
    }
    var starters = [];
    for (var i = 0; i < Math.min(concurrency, items.length); i++) starters.push(runNext());
    return Promise.all(starters).then(function () { return results; });
  }
  // V2 STEP 2 — Families: WHO is going + WHAT they like. Adults / kids ages / seniors /
  // food / stay atmosphere. NO transport, NO room count, NO areas — the AI determines those.
  function familyCard(fam, idx) {
    normalizeFamily(fam);
    var c = el('article', 'tc-famcard');
    var head = el('div', 'tc-famcard__head');
    head.appendChild(el('strong', 'tc-famcard__n', '#' + (idx + 1)));
    if (state.trip.families.length > 1) { var rm = el('button', 'tc-famcard__rm', t('removeFamily')); rm.type = 'button'; rm.addEventListener('click', function () { state.trip.families.splice(idx, 1); render(); }); head.appendChild(rm); }
    c.appendChild(head);
    var nm = input(fam.name, t('familyNamePh')); nm.addEventListener('input', function () { fam.name = nm.value; }); c.appendChild(field(t('familyName'), nm));
    var row = el('div', 'tc-row2');
    var ad = input(fam.adults, '', 'number'); ad.min = 0; ad.addEventListener('input', function () { fam.adults = +ad.value || 0; }); row.appendChild(field(t('adults'), ad));
    var sn = input(fam.seniors, '', 'number'); sn.min = 0; sn.addEventListener('input', function () { fam.seniors = +sn.value || 0; }); row.appendChild(field(t('seniors'), sn));
    c.appendChild(row);
    var ch = input(fam.childrenAges, '3, 14'); ch.addEventListener('input', function () { fam.childrenAges = ch.value; }); c.appendChild(field(t('childrenAges'), ch));
    // Food preferences (chips + free text) — drives the food agent.
    c.appendChild(el('span', 'tc-field__lbl', t('foodPrefs')));
    c.appendChild(chipMulti(FOOD_KEYS, fam.foodPrefsKeys, 'food_', function () {}));
    var fp = input(fam.foodPrefs, t('foodOtherPh')); fp.addEventListener('input', function () { fam.foodPrefs = fp.value; }); c.appendChild(field(t('foodOther'), fp));
    // Stay atmosphere (chips) — drives the hotel agent (it picks the real areas/hotels).
    fam.stayPrefs = fam.stayPrefs || [];
    c.appendChild(el('span', 'tc-field__lbl', t('stayAtmosphere')));
    c.appendChild(el('p', 'tc-hint', t('stayAtmosphereHint')));
    c.appendChild(chipMulti(STAY_ATMOSPHERE, fam.stayPrefs, 'sa_', function () {}));
    return c;
  }
  function renderFamilies() {
    var s = el('section', 'tc-screen'); s.appendChild(stepHeader(2));
    s.appendChild(el('h2', 'tc-screen__title', t('familiesTitle')));
    s.appendChild(el('p', 'tc-screen__sub', t('familySubV2')));
    state.trip.families.forEach(function (f, i) { s.appendChild(familyCard(f, i)); });
    var add = el('button', 'tc-addbtn', '+ ' + t('addFamily')); add.type = 'button';
    add.addEventListener('click', function () { state.trip.families.push(newFamily()); render(); });
    s.appendChild(add);
    // V2: no separate preferences step — go straight to AI concierge mode (PLAN TRIP).
    var next = el('button', 'tc-cta tc-cta--big', '✨ ' + t('planTrip')); next.type = 'button';
    next.addEventListener('click', function () { saveTrip(state.trip); doGenerate(); });
    s.appendChild(next);
    s.appendChild(el('p', 'tc-hint tc-hint--center', t('planTripHint')));
    return s;
  }

  // ── Screen: preferences ────────────────────────────────────────────────
  function toggleRow(labelKey, val, onSet) {
    var w = el('label', 'tc-toggle');
    w.appendChild(el('span', null, t(labelKey)));
    var cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = !!val; cb.addEventListener('change', function () { onSet(cb.checked); });
    w.appendChild(cb); return w;
  }
  function renderPrefs() {
    var p = state.trip.preferences;
    var s = el('section', 'tc-screen'); s.appendChild(stepHeader(3));
    s.appendChild(el('h2', 'tc-screen__title', t('prefsTitle')));
    s.appendChild(el('p', 'tc-screen__sub', t('prefsSub')));
    s.appendChild(field(t('pace'), seg(['relaxed', 'balanced', 'packed'], p.pace, 'style_', function (v) { p.pace = v; })));
    s.appendChild(field(t('budget'), seg(['budget', 'moderate', 'luxury'], p.budgetLevel, 'budget_', function (v) { p.budgetLevel = v; })));
    [['kidPriority', 'kidPriority'], ['foodiePriority', 'foodiePriority'], ['photoPriority', 'photoPriority'], ['minDriving', 'minDriving'], ['hiddenGems', 'hiddenGems'], ['freeActivities', 'freeActivities'], ['reservationActivities', 'reservationActivities'], ['backupPlans', 'backupPlans']].forEach(function (pair) {
      s.appendChild(toggleRow(pair[1], p[pair[0]], function (v) { p[pair[0]] = v; }));
    });
    var gen = el('button', 'tc-cta tc-cta--big', t('generate')); gen.type = 'button';
    gen.addEventListener('click', function () { doGenerate(); });
    s.appendChild(gen);
    return s;
  }
  function doGenerate() {
    // The plan is shareable + saved to Firestore + attributed to the organizer →
    // require login before generating (also satisfies "log in to see the plan").
    requireLogin(function () { _runGenerate(); });
  }
  function _runGenerate() {
    state.generating = true;
    if (!state.trip.ownerUid) state.trip.ownerUid = curUid();
    renderGenerating(t('researching'));
    saveTrip(state.trip);
    // Stage 1 — live web research (current/seasonal/trending), best-effort.
    researchHighlights(state.trip).then(function (res) {
      if (res && res.highlights && res.highlights.length) {
        state.trip.liveHighlights = res.highlights;
        state.trip.liveSourceNote = res.sourceNote || '';
      }
      // Stage 2 — full AI plan (single-call for 1–2 legs; skeleton + per-leg for 3+),
      // fed the live highlights so it weaves them in.
      return generatePlanSmart(state.trip, function (msg) { renderGenerating(msg); });
    }).then(function (res) {
      state.generating = false;
      if (!res || !res.plan) { toast(t('genFail')); state.screen = 'families'; render(); return; }
      var plan = res.plan;
      if ((!plan.liveHighlights || !plan.liveHighlights.length) && state.trip.liveHighlights && state.trip.liveHighlights.length) plan.liveHighlights = state.trip.liveHighlights;
      state.trip.plan = plan; state.trip._fallback = !!res.fallback;
      syncDestRolesFromPlan(state.trip, plan); // V2: AI-determined roles drive which stops get hotels/food
      finalizePlanDays(plan, state.trip); // guarantee day count + return day + day types
      // HARD route validation — the user's required providers MUST survive into the journey. If the
      // parser dropped them, never silently show a car route: send the user back to confirm/fix.
      if (lockedRouteIssue(state.trip)) { state.generating = false; state.trip._routeIssue = true; toast(t('nlRouteFail')); state.screen = 'nlreview'; render(); return; }
      state.trip._routeIssue = false;
      state.screen = 'plan'; state.activeDay = 0; state.activeTab = 'overview';
      saveTrip(state.trip); pushTripUrl(state.trip.id);
      try { learnFromTrip(state.trip); } catch (e) {} // cross-trip memory: learn budget/pace/cuisines/group shape from this plan
      resolveMyRole().then(function () { render(); runConciergeResearch(state.trip); });
    });
  }
  // Phase 2 — auto-run the concierge research the moment a plan is generated, so the
  // user never has to hunt for "Find hotels/food/bookings". Each call is independent,
  // best-effort, saves partial results, and updates its tab as it completes. Failures
  // just clear the spinner (the manual "Find/Refresh" button remains as a retry). Only
  // the owner's generate triggers writes (members read the saved results).
  function runConciergeResearch(tr) {
    if (!tr || tr._demo || !realUser() || !isOwnerOfTrip()) return;
    var anyHotel = !!(tr.destination) || (Array.isArray(tr.destinations) && tr.destinations.some(function (d) { return d && (d.city || '').trim() && d.hotelNeeded !== false; }));
    var anyTransport = !!(tr.departureCity && (tr.destination || (Array.isArray(tr.destinations) && tr.destinations.some(function (d) { return d && (d.city || '').trim(); }))));
    var anyDest = !!(tr.destination || (Array.isArray(tr.destinations) && tr.destinations.some(function (d) { return d && (d.city || '').trim(); })));
    state._cResearch = { stays: anyHotel, food: true, bookings: true, transport: anyTransport, attractions: anyDest, events: anyDest, weather: anyDest, stopovers: anyTransport, routeOps: anyTransport, tours: anyDest };
    function done(k) { if (state._cResearch) state._cResearch[k] = false; if (state.screen === 'plan') render(); }
    if (anyHotel) { researchStays(tr).then(function (res) { if (res.stays && res.stays.length) { tr.stays = res.stays; tr.stayStrategies = res.strategies || []; checkHotelDeals(tr); saveTrip(tr); } done('stays'); }).catch(function () { done('stays'); }); }
    researchRestaurants(tr).then(function (res) { if (res.food && res.food.length) { tr.food = res.food; saveTrip(tr); } done('food'); }).catch(function () { done('food'); });
    if (anyTransport) { researchTransport(tr).then(function (res) { applyTransportResult(tr, res); done('transport'); }).catch(function () { done('transport'); }); }
    // Destination Intelligence: rank signature attractions for the group + add ticketed icons to the booking checklist.
    if (anyDest) { researchAttractions(tr).then(function (res) { if (res.destinations && res.destinations.length) { tr.attractions = res.destinations; if (res.groupProfile) tr.groupProfile = res.groupProfile; mergeBookings(tr, ticketedAttractionBookings(tr)); saveTrip(tr); } done('attractions'); }).catch(function () { done('attractions'); }); }
    // Event Discovery + Stopover agents (events match trip dates; stopovers on long legs).
    if (anyDest) { researchEvents(tr).then(function (res) { if (res.destinations && res.destinations.length) { tr.events = res.destinations; saveTrip(tr); } done('events'); }).catch(function () { done('events'); }); }
    if (anyDest) { researchWeather(tr).then(function (res) { if (res.destinations && res.destinations.length) { tr.weather = res.destinations; saveTrip(tr); } done('weather'); }).catch(function () { done('weather'); }); }
    if (anyTransport) { researchStopovers(tr).then(function (res) { if (res.legs && res.legs.length) { tr.stopovers = res.legs; saveTrip(tr); } done('stopovers'); }).catch(function () { done('stopovers'); }); }
    if (anyTransport) { researchRouteOps(tr).then(function (res) { if (res.legs && res.legs.length) { tr.routeOps = res.legs; saveTrip(tr); } done('routeOps'); }).catch(function () { done('routeOps'); }); }
    if (anyDest) { researchTours(tr).then(function (res) { if (res.destinations && res.destinations.length) { tr.tours = res.destinations; saveTrip(tr); } done('tours'); }).catch(function () { done('tours'); }); }
    try { if (!tr.bookings || !tr.bookings.length) { tr.bookings = tr.bookings || []; mergeBookings(tr, deriveBookingChecklist(tr)); } } catch (e) {}
    researchBookings(tr).then(function (res) {
      var added = (res.items || []).map(function (it) { return newBooking(it.type, it.title, { city: it.city || '', provider: it.provider || '', priceRange: it.priceRange || '', recommendedOption: it.recommendedOption || '', deadline: it.deadline || '', cancellationPolicy: it.cancellationNote || '', dataSource: it.dataSource || 'ai_researched_pending_verification' }); });
      if (added.length) { mergeBookings(tr, added); saveTrip(tr); }
      done('bookings');
    }).catch(function () { done('bookings'); });
    saveTrip(tr);
  }
  // ✨ Optimize Trip (Phase 2 auto-rebuild) — rebuild the WHOLE trip from the accumulated group
  // votes: regenerate the itinerary (PREFERring liked/favorited, AVOIDing skipped, keeping pins),
  // then re-derive bookings + re-research every supporting tab (stays/food/events/stopovers/
  // transport/attractions/route-ops — all rejection/consensus-aware) and re-cost. Manual
  // skips/replaces/pins survive (placeOverrides are keyed by name). Owner-only; one click.
  function optimizeRebuild(tr) {
    tr = tr || state.trip; if (!tr || tr._demo || !canEditPlan() || state.generating) return;
    state.generating = true; renderGenerating(t('optimizing'));
    generatePlanSmart(tr, function (msg) { renderGenerating(msg); }).then(function (res) {
      state.generating = false;
      if (res && res.plan) {
        tr.plan = res.plan; tr._fallback = !!res.fallback;
        syncDestRolesFromPlan(tr, res.plan); // AI-determined roles drive which stops get hotels/food
        finalizePlanDays(res.plan, tr);       // guarantee day count + return day + day types
      }
      tr.lastOptimizedSignature = votesSignature(tr); // clears the "votes changed" nudge
      try { tr.bookings = []; mergeBookings(tr, deriveBookingChecklist(tr)); } catch (e) {} // re-derive (rejected already filtered)
      state.activeTab = 'overview'; state.activeDay = 0;
      saveTrip(tr);
      runConciergeResearch(tr); // re-research every supporting tab with the latest consensus
      toast(t('optimizeDone'));
      render();
    }).catch(function () { state.generating = false; toast(t('genFail')); render(); });
  }
  function optimizeNudge() {
    var box = el('div', 'tc-optnudge');
    box.appendChild(el('span', 'tc-optnudge__t', '✨ ' + t('optimizeNudge')));
    box.appendChild(pbtn('✨ ' + t('optimizeTrip'), 'tc-cta tc-optnudge__btn', function () { optimizeRebuild(state.trip); }));
    return box;
  }
  function isResearching(k) { return !!(state._cResearch && state._cResearch[k]); }
  // ── Verified route distances/times (Google Maps) — the AI NEVER invents these ──
  // PRIMARY: client-side Google Distance Matrix via the browser Maps JS key (the same
  // referrer-restricted key/approach the ride-share service uses — it works in the browser
  // where the server secret is referrer-denied). FALLBACK: the computeTripRoute callable
  // (labelled estimate). Never fabricates distances.
  function _fmtDurC(min) { if (!min) return ''; var h = Math.floor(min / 60), m = Math.round(min % 60); return (h ? h + 'h ' : '') + (m ? m + 'm' : (h ? '' : '0m')); }
  function _gdirC(a, b) { return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(a) + '&destination=' + encodeURIComponent(b); }
  // Robust duration → minutes from a Routes API element. PRIMARY: the numeric `duration`
  // (seconds, e.g. "28440s" or {seconds}) — NEVER parse the localized string for the value
  // (it varies: "7 hr 14 min" vs "7 hours 14 mins", which broke a hr/min regex → 14m bug).
  function _durMinFromRoutesEl(el) {
    var d = el && el.duration;
    if (d != null) {
      if (typeof d === 'number') return Math.round(d / 60);
      if (typeof d === 'string') { var m = d.match(/[\d.]+/); if (m) return Math.round(parseFloat(m[0]) / 60); }
      if (typeof d === 'object' && d.seconds != null) return Math.round((+d.seconds) / 60);
    }
    // Last-resort localized parse (handles hr|hour|hours + min|mins|minutes).
    var s = (el && el.localizedValues && el.localizedValues.duration) || '';
    var hrM = s.match(/(\d+)\s*h(?:ou)?r/i), minM = s.match(/(\d+)\s*min/i);
    return (hrM ? parseInt(hrM[1], 10) * 60 : 0) + (minM ? parseInt(minM[1], 10) : 0);
  }
  // RouteMatrix response shape can vary across loader versions — find the first element.
  function _firstRouteEl(result) {
    if (!result) return null;
    var m = result.matrix || result;
    if (m && m.rows && m.rows[0] && m.rows[0].items && m.rows[0].items[0]) return m.rows[0].items[0];
    if (Array.isArray(result) && result[0]) return result[0];
    if (Array.isArray(m) && m[0]) return m[0];
    return null;
  }
  // One verified leg via the NEW Routes API (RouteMatrix) — the SAME proven approach as
  // script.js DLCRouteMatrix. Legacy DistanceMatrixService fallback if RouteMatrix is absent.
  function _legacyLeg(lib, origin, dest) {
    return new Promise(function (resolve) {
      try {
        if (!lib || !lib.DistanceMatrixService) return resolve(null);
        var svc = new lib.DistanceMatrixService();
        svc.getDistanceMatrix({ origins: [origin], destinations: [dest], travelMode: 'DRIVING' }, function (res, status) {
          var elr = res && res.rows && res.rows[0] && res.rows[0].elements && res.rows[0].elements[0];
          if (status !== 'OK' || !elr || elr.status !== 'OK' || !elr.distance) return resolve(null);
          var miles = Math.round(elr.distance.value / 1609.34), dmin = Math.round(elr.duration.value / 60);
          resolve({ fromCity: origin, toCity: dest, distanceMiles: miles, distanceText: miles + ' mi', durationText: _fmtDurC(dmin), durationTrafficText: _fmtDurC(dmin), durationMin: dmin, mapLink: _gdirC(origin, dest), source: 'google_maps' });
        });
      } catch (e) { resolve(null); }
    });
  }
  function tcRouteLeg(origin, dest) {
    return tcImport('routes').then(function (lib) {
      if (!lib) return null;
      if (lib.RouteMatrix && typeof lib.RouteMatrix.computeRouteMatrix === 'function') {
        var tmode = (lib.TravelMode && lib.TravelMode.DRIVING) || 'DRIVING';
        // New Routes API needs WAYPOINT objects (not plain strings) — strings silently fail
        // and fall back to the deprecated DistanceMatrix. Wrap as { waypoint: { address } }.
        return lib.RouteMatrix.computeRouteMatrix({ origins: [{ waypoint: { address: origin } }], destinations: [{ waypoint: { address: dest } }], travelMode: tmode, fields: ['distanceMeters', 'duration', 'condition', 'localizedValues', 'originIndex', 'destinationIndex'] })
          .then(function (result) {
            var el2 = _firstRouteEl(result);
            if (!el2 || !el2.distanceMeters || (el2.condition && el2.condition !== 'ROUTE_EXISTS')) return _legacyLeg(lib, origin, dest);
            var miles = Math.round(el2.distanceMeters / 1609.34);
            var dmin = _durMinFromRoutesEl(el2);
            return { fromCity: origin, toCity: dest, distanceMiles: miles, distanceText: miles + ' mi', durationText: _fmtDurC(dmin), durationTrafficText: _fmtDurC(dmin), durationMin: dmin, mapLink: _gdirC(origin, dest), source: 'google_maps' };
          }).catch(function () { return _legacyLeg(lib, origin, dest); });
      }
      return _legacyLeg(lib, origin, dest);
    }).catch(function () { return null; });
  }
  // Verified legs over paired origins/destinations (the diagonal = each consecutive leg).
  function gmapsMatrix(origins, dests) {
    if (!origins || !origins.length || origins.length !== dests.length) return Promise.resolve(null);
    var pairs = origins.slice(0, 10).map(function (o, i) { return [o, dests[i]]; });
    return Promise.all(pairs.map(function (p) { return tcRouteLeg(p[0], p[1]).catch(function () { return null; }); }))
      .then(function (legs) { return legs.some(Boolean) ? { ok: true, source: 'google_maps', legs: legs } : null; })
      .catch(function () { return null; });
  }
  function gmapsRouteLegs(cities) {
    cities = (cities || []).filter(Boolean).slice(0, 10);
    if (cities.length < 2) return Promise.resolve(null);
    return gmapsMatrix(cities.slice(0, cities.length - 1), cities.slice(1)).then(function (r) {
      if (!r) return null;
      var legs = r.legs.filter(Boolean); if (!legs.length) return null;
      var totMiles = legs.reduce(function (s, l) { return s + (l.distanceMiles || 0); }, 0);
      var totMin = legs.reduce(function (s, l) { return s + (l.durationMin || 0); }, 0);
      return { ok: true, source: 'google_maps', legs: legs, totalDistanceText: totMiles + ' mi', totalDurationText: _fmtDurC(totMin) };
    });
  }
  function computeRoute(cities) {
    return gmapsRouteLegs(cities).then(function (client) {
      if (client && client.ok && client.legs && client.legs.length) return client;
      var c = mkCallable('computeTripRoute', 28000);
      if (!c) return { ok: false, legs: [] };
      return c({ cities: cities, lang: state.lang }).then(function (r) { return (r && r.data) || { ok: false, legs: [] }; }).catch(function () { return { ok: false, legs: [] }; });
    }).catch(function () { return { ok: false, legs: [] }; });
  }
  // Upgrade the Transport tab's drive legs to verified Google Maps values (client key).
  function verifyTransportRoutes(tr) {
    if (!tr || tr._demo || !Array.isArray(tr.transport) || !tr.transport.length) return;
    if (tr.transportSource === 'google_maps' || tr._tpRouteChecking || state._tpRouteTriedTrip === tr.id) return;
    state._tpRouteTriedTrip = tr.id; tr._tpRouteChecking = true;
    var froms = tr.transport.map(function (l) { return l.fromCity; }), tos = tr.transport.map(function (l) { return l.toCity; });
    gmapsMatrix(froms, tos).then(function (r) {
      tr._tpRouteChecking = false;
      if (!r || !r.legs) return;
      var changed = false;
      r.legs.forEach(function (vl, i) {
        if (!vl) return; var lg = tr.transport[i]; if (!lg) return;
        lg.driveDistanceText = vl.distanceText; lg.driveDurationText = vl.durationTrafficText || vl.durationText; lg.driveSource = 'google_maps'; lg.mapLink = vl.mapLink || lg.mapLink;
        (lg.options || []).forEach(function (o) {
          if (o.mode === 'personal_car' || o.mode === 'rental_car' || o.mode === 'dlc_ride') {
            o.distanceText = vl.distanceText; o.durationText = vl.durationTrafficText || vl.durationText; o.status = 'verified'; o.source = 'google_maps'; o.mapLink = vl.mapLink || o.mapLink; o.confidence = 'high';
          }
        });
        changed = true;
      });
      if (changed) { tr.transportSource = 'google_maps'; saveTrip(tr); if (state.screen === 'plan' && state.activeTab === 'transport') render(); }
    }).catch(function () { tr._tpRouteChecking = false; });
  }
  function routeCityName(s) { return String(s || '').replace(/\(.*?\)/g, '').split(',')[0].trim().toLowerCase(); }
  function routePath(tr) {
    var dep = (tr.departureCity || '').trim();
    var dests = (tr.destinations || []).map(function (d) { return (d.city || '').trim(); }).filter(Boolean);
    if (!dests.length && tr.destination) dests = [String(tr.destination).trim()];
    var path = [];
    if (dep) path.push(dep);
    dests.forEach(function (c) { path.push(c); });
    if (dep && dests.length) path.push(dep); // drive home
    return path;
  }
  function findVerifiedLeg(plan, from, to) {
    var legs = (plan && plan._verifiedLegs) || []; var f = routeCityName(from), t = routeCityName(to);
    var hit = legs.filter(function (l) { return routeCityName(l.fromCity) === f && routeCityName(l.toCity) === t; })[0];
    if (hit) return hit;
    return legs.filter(function (l) { return routeCityName(l.toCity) === t; })[0] || null;
  }
  // Overwrite ALL AI-emitted route distances/times with verified Google Maps values.
  function applyVerifiedRoute(plan, route) {
    if (!plan || !route || !Array.isArray(route.legs)) return;
    plan._verifiedLegs = route.legs; plan._routeSource = route.source || 'unknown';
    var destCities = (plan.destinations || []).map(function (d) { return d.city; });
    // Route overview strip = inter-destination legs.
    var roLegs = [];
    for (var i = 0; i < destCities.length - 1; i++) {
      var v = findVerifiedLeg(plan, destCities[i], destCities[i + 1]);
      roLegs.push({ fromCity: destCities[i], toCity: destCities[i + 1], estimatedDriveTime: v ? v.durationText : '', estimatedDistance: v ? v.distanceText : '', mapLink: v ? v.mapLink : '', dataSource: v ? v.source : 'unknown' });
    }
    plan.routeOverview = plan.routeOverview || {};
    if (roLegs.length) plan.routeOverview.legs = roLegs;
    plan.routeOverview.totalDriveTime = route.totalDurationText || ''; plan.routeOverview.totalDistance = route.totalDistanceText || '';
    plan.routeOverview.dataSource = route.source;
    // Each travel day's travelLeg: replace AI numbers with verified; blank AI depart/arrive.
    (plan.days || []).forEach(function (d) {
      if (!d || !d.travelLeg) return;
      var tl = d.travelLeg, vv = findVerifiedLeg(plan, tl.fromCity || '', tl.toCity || destCityName(plan, d.destinationIndex || 0) || '');
      tl.estimatedDriveTime = vv ? vv.durationText : ''; tl.estimatedDistance = vv ? vv.distanceText : '';
      tl.mapLink = vv ? vv.mapLink : (tl.mapLink || ''); tl.dataSource = vv ? vv.source : 'unknown';
      tl.suggestedDepartureTime = ''; tl.suggestedArrivalTime = ''; // AI must not invent ETAs
    });
  }
  function verifyRoute(tr) {
    if (!tr || !tr.plan || tr._demo) return;
    var path = routePath(tr);
    if (path.length < 2) { tr.plan._routeSource = 'none'; return; }
    state._routeTriedTrip = tr.id; tr._routeChecking = true;
    computeRoute(path).then(function (route) {
      tr._routeChecking = false;
      if (route && route.ok && Array.isArray(route.legs) && route.legs.length) { applyVerifiedRoute(tr.plan, route); saveTrip(tr); if (state.screen === 'plan') render(); }
      else { tr.plan._routeSource = tr.plan._routeSource || 'unknown'; }
    }).catch(function () { tr._routeChecking = false; });
  }
  // Live research callable (Gemini + Google Search grounding). Never blocks: any
  // failure resolves to an empty highlight list so planning still proceeds.
  function researchHighlights(trip) {
    var callable = null;
    try { if (root.firebase && root.firebase.functions) callable = root.firebase.functions().httpsCallable('researchTripHighlights', { timeout: 42000 }); } catch (e) {}
    if (!callable) return Promise.resolve({ highlights: [] });
    return callable({ trip: { destination: trip.destination, dateRange: trip.dateRange, families: trip.families }, lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { highlights: d.highlights || [], sourceNote: d.sourceNote || '' }; })
      .catch(function () { return { highlights: [] }; });
  }
  function renderGenerating(msg) {
    var host = app(); if (!host) return; host.innerHTML = '';
    var s = el('section', 'tc-gen');
    s.appendChild(el('div', 'tc-gen__spinner'));
    s.appendChild(el('p', 'tc-gen__msg', msg || t('generating')));
    host.appendChild(s);
  }

  // ── Login gate (phone + password → unified DuLichCali customer account) ──
  function loginGate() {
    var mode = state.authMode === 'signup' ? 'signup' : 'login';
    var s = el('section', 'tc-screen tc-login');
    s.appendChild(el('span', 'tc-hero__chip', t('heroChip')));
    s.appendChild(el('h2', 'tc-screen__title', t('loginTitle')));
    s.appendChild(el('p', 'tc-screen__sub', t('loginSub')));
    var ph = input('', '+1 (408) 555-0199', 'tel'); ph.setAttribute('inputmode', 'tel'); ph.autocomplete = 'tel';
    s.appendChild(field(t('phone'), ph));
    var pw = input('', '', 'password'); pw.autocomplete = (mode === 'signup' ? 'new-password' : 'current-password');
    s.appendChild(field(t('password'), pw));
    if (mode === 'signup') s.appendChild(el('p', 'tc-login__help', t('passwordHelp')));
    var err = el('p', 'tc-login__err'); err.style.display = 'none'; s.appendChild(err);
    var go = el('button', 'tc-cta', t(mode === 'signup' ? 'signUp' : 'signIn')); go.type = 'button';
    function submit() {
      var phone = ph.value.trim(), pass = pw.value;
      if (!phone || !pass) { err.style.display = 'block'; err.textContent = t('required'); return; }
      go.disabled = true; go.textContent = '…'; err.style.display = 'none';
      TCAuth[mode](phone, pass).catch(function () {
        go.disabled = false; go.textContent = t(mode === 'signup' ? 'signUp' : 'signIn');
        err.style.display = 'block'; err.textContent = (mode === 'signup' ? t('passwordHelp') : t('authFailed'));
      });
      // success → onAuthStateChanged runs state._afterLogin / pending trip + re-renders
    }
    go.addEventListener('click', submit);
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    s.appendChild(go);
    var sw = el('button', 'tc-login__switch', t(mode === 'signup' ? 'haveAccount' : 'needAccount')); sw.type = 'button';
    sw.addEventListener('click', function () { state.authMode = (mode === 'signup' ? 'login' : 'signup'); render(); });
    s.appendChild(sw);
    var back = el('button', 'tc-login__switch', t('backHome')); back.type = 'button';
    back.addEventListener('click', function () { state._afterLogin = null; state._pendingTripId = null; newTrip(); state.screen = 'hero'; pushTripUrl(null); render(); });
    s.appendChild(back);
    return s;
  }
  function famName(id) { var f = tripFamilies().filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; }
  // V6 member roster helpers (per-member task assignment + cost rollup).
  function famMembers(famId) { var f = ((state.trip && state.trip.families) || []).filter(function (x) { return x.id === famId; })[0]; return (f && Array.isArray(f.members)) ? f.members : []; }
  function memberName(memId) { var n = ''; ((state.trip && state.trip.families) || []).forEach(function (f) { (f.members || []).forEach(function (m) { if (m && m.id === memId) n = m.name || ''; }); }); return n; }
  function tripFamiliesWithMembers() { return ((state.trip && state.trip.families) || []).map(function (f, i) { return { id: f.id || ('f' + i), name: (f.name || '').trim() || ('#' + (i + 1)), members: Array.isArray(f.members) ? f.members : [] }; }); }
  function accountRow() {
    var u = realUser(); if (!u) return null;
    var r = el('div', 'tc-acct');
    var sess = state.trip ? getMemberSession(state.trip.id) : null;
    var phoneName = u.email ? u.email.split('@')[0] : '';
    var name = (sess && sess.displayName) || phoneName;
    var famName2 = (sess && sess.familyName) || '';
    var role = state.myRole || (sess && sess.role) || '';
    var info = el('div', 'tc-acct__info');
    info.appendChild(el('span', 'tc-acct__who', t('loggedInAs') + ' ' + name));
    var bits = [];
    if (famName2) bits.push('👪 ' + famName2);
    if (role) bits.push(t('role_' + role) || role);
    if (bits.length) info.appendChild(el('span', 'tc-acct__sub', bits.join(' · ')));
    r.appendChild(info);
    var btns = el('div', 'tc-acct__btns');
    // Non-owner members get trip-scoped session controls.
    if (state.trip && !isOwnerOfTrip() && state.myRole) {
      var sw = el('button', 'tc-acct__out', t('switchMember')); sw.type = 'button';
      sw.addEventListener('click', function () { if (state.trip) clearMemberSession(state.trip.id); try { auth().signOut(); } catch (e) {} });
      btns.appendChild(sw);
      var lo = el('button', 'tc-acct__out', t('logoutTrip')); lo.type = 'button';
      lo.addEventListener('click', function () { if (state.trip) clearMemberSession(state.trip.id); newTrip(); state.screen = 'hero'; pushTripUrl(null); render(); });
      btns.appendChild(lo);
    } else {
      var out = el('button', 'tc-acct__out', t('logout')); out.type = 'button';
      out.addEventListener('click', function () { try { auth().signOut(); } catch (e) {} });
      btns.appendChild(out);
    }
    r.appendChild(btns);
    return r;
  }

  // ── Screen: plan (itinerary + arrival + group) ─────────────────────────
  function renderPlan() {
    var tr = state.trip;
    // Real trips are login-gated (view + collaborate). Demos are open previews.
    if (!tr._demo && !realUser()) return loginGate();
    var plan = tr.plan || {};
    // Verify route distances/times via Google Maps once per plan (lazy) — replaces any
    // AI-invented distance/drive-time/ETA with real data. Runs for new, regenerated and
    // older saved plans alike; sets plan._routeSource so it only fires once.
    // Backfill day types on older plans AND heal a calendar-day gap (a pre-fix trip saved missing a
    // day — e.g. a folded transfer day — re-reconciles to the full inclusive range on load, no regen needed).
    if (plan.days && plan.days.length && plan.days[0]) {
      var _pdHeal = parseTripDates(tr.dateRange);
      if (!plan.days[0].dayType || (_pdHeal && _pdHeal.count && plan.days.length !== _pdHeal.count)) finalizePlanDays(plan, tr);
    }
    // Verify routes once per session: new plans (no source) AND existing estimated/unknown
    // plans get one client-side (browser Maps key) re-verify attempt → flips to google_maps.
    if (!tr._demo && plan.days && !tr._routeChecking && (!plan._routeSource || ((plan._routeSource === 'estimated' || plan._routeSource === 'unknown') && state._routeTriedTrip !== tr.id))) verifyRoute(tr);
    var s = el('section', 'tc-plan');
    // Top navigation: breadcrumb + Back to My Trips (real trips belong to a dashboard).
    if (!tr._demo) {
      var tripName = plan.groupName || tr.groupName || tripDestSummary(tr) || t('dashTitle');
      var nav = el('div', 'tc-plannav');
      var backTop = el('button', 'tc-backbtn', t('backToMyTrips')); backTop.type = 'button';
      backTop.addEventListener('click', function () { goDashboard(); });
      nav.appendChild(backTop);
      var bc = el('nav', 'tc-bc');
      var b0 = el('button', 'tc-bc__seg tc-bc__link', t('tcBrand')); b0.type = 'button'; b0.addEventListener('click', function () { newTrip(); state.screen = 'hero'; pushTripUrl(null); render(); }); bc.appendChild(b0);
      bc.appendChild(el('span', 'tc-bc__sep', '›'));
      var b1 = el('button', 'tc-bc__seg tc-bc__link', t('dashTitle')); b1.type = 'button'; b1.addEventListener('click', function () { goDashboard(); }); bc.appendChild(b1);
      bc.appendChild(el('span', 'tc-bc__sep', '›'));
      bc.appendChild(el('span', 'tc-bc__seg tc-bc__seg--on', tripName));
      nav.appendChild(bc);
      s.appendChild(nav);
    }
    var acct = accountRow(); if (acct) s.appendChild(acct);
    // Owner-only: Share Trip (invite link + passcode + members).
    if (!tr._demo && isOwnerOfTrip()) {
      var shareBtn = el('button', 'tc-sharebtn', '🔗 ' + t('shareTrip')); shareBtn.type = 'button';
      shareBtn.addEventListener('click', function () { openShareModal(); });
      s.appendChild(shareBtn);
    }
    // Compact context hero — shown on the detail tabs. On the Overview tab the immersive
    // tc-ov-hero replaces it, so we suppress this one to avoid a redundant double hero.
    if (state.activeTab !== 'overview') {
      var hero = el('div', 'tc-planhero');
      hero.appendChild(el('span', 'tc-planhero__chip', plan.destination || tr.destination));
      hero.appendChild(el('h1', 'tc-planhero__title', plan.groupName || tr.groupName));
      hero.appendChild(el('p', 'tc-planhero__dates', (plan.dateRange || tr.dateRange) + (plan.departureCity ? ' · ' + plan.departureCity : '')));
      if (plan.summary) hero.appendChild(el('p', 'tc-planhero__summary', plan.summary));
      var meta = el('div', 'tc-planhero__meta');
      if (plan.totalEstimatedCostRange) meta.appendChild(chip('tc-chip--cost', t('costRange') + ': ' + plan.totalEstimatedCostRange));
      if (plan.meetupPoint) meta.appendChild(chip('tc-chip--meet', '📍 ' + t('meetup') + ': ' + plan.meetupPoint + (plan.meetupTime ? ' · ' + plan.meetupTime : '')));
      hero.appendChild(meta);
      if (tr._fallback || (plan.dataSource && /pending/.test(plan.dataSource))) hero.appendChild(el('p', 'tc-unverified', t('unverified')));
      s.appendChild(hero);
    }
    // Concierge auto-research banner: visible while hotels/food/bookings/transport load.
    if (state._cResearch && (state._cResearch.stays || state._cResearch.food || state._cResearch.bookings || state._cResearch.transport || state._cResearch.attractions || state._cResearch.events || state._cResearch.stopovers)) s.appendChild(researchBanner('conciergeWorking'));
    // "You are this family" — attributes votes/suggestions per family (no login).
    s.appendChild(familyPicker());
    // One streamlined pipeline of tabs. The old "Family Arrival Plan" tab was removed (it
    // duplicated Stay's hotels + Transport's logistics); arrival logistics live in Transport,
    // hotels in Stay, and travelers + live coordination in Group. Stopovers reads as Discoveries.
    // V5: 5 visible tabs. The other 8 surfaces stay fully reachable via the More sheet (which sets
    // state.activeTab). ALL_TABS validates activeTab against EVERY render branch — NOT just the 5
    // pills — so navigating to a hidden tab via More is never reset to 'overview' by the heal.
    var ALL_TABS = ['overview', 'itinerary', 'journey', 'transport', 'stay', 'food', 'events', 'weather', 'stopovers', 'costs', 'bookings', 'album', 'clips', 'group'];
    if (ALL_TABS.indexOf(state.activeTab) === -1) state.activeTab = 'overview'; // heal stale 'arrival'/'live'/'more'
    var TAB_PAIRS = [['overview', 'tab_overview'], ['itinerary', 'tab_days'], ['bookings', 'tab_tasks'], ['album', 'tab_album'], ['more', 'tab_more']];
    var HIDDEN_TABS = ['journey', 'transport', 'stay', 'food', 'events', 'weather', 'stopovers', 'costs', 'group']; // reachable via More (clips lives inside Album)
    function tabIsActive(key) {
      if (key === 'more') return HIDDEN_TABS.indexOf(state.activeTab) !== -1;
      if (key === 'album') return state.activeTab === 'album' || state.activeTab === 'clips';
      return state.activeTab === key;
    }
    var tabs = el('div', 'tc-tabs');
    TAB_PAIRS.forEach(function (pair) {
      var b = el('button', 'tc-tab' + (tabIsActive(pair[0]) ? ' tc-tab--on' : ''), t(pair[1])); b.type = 'button';
      b.addEventListener('click', function () { if (pair[0] === 'more') { openMoreSheet(); } else { state.activeTab = pair[0]; render(); } });
      tabs.appendChild(b);
    });
    s.appendChild(tabs);
    if (state.activeTab === 'overview') s.appendChild(renderOverview(plan));
    else if (state.activeTab === 'itinerary') s.appendChild(renderItinerary(plan));
    else if (state.activeTab === 'journey') s.appendChild(renderJourney(plan));
    else if (state.activeTab === 'transport') s.appendChild(renderTransport(plan));
    else if (state.activeTab === 'stay') s.appendChild(renderStays(plan));
    else if (state.activeTab === 'food') s.appendChild(renderFood(plan));
    else if (state.activeTab === 'events') s.appendChild(renderEvents(plan));
    else if (state.activeTab === 'weather') s.appendChild(renderWeather(plan));
    else if (state.activeTab === 'stopovers') s.appendChild(renderStopovers(plan));
    else if (state.activeTab === 'costs') s.appendChild(renderCosts(plan));
    else if (state.activeTab === 'bookings') s.appendChild(renderBookings(plan));
    else if (state.activeTab === 'album') { s.appendChild(renderAlbum(plan)); s.appendChild(renderClips(plan)); } // Clips merged into Album
    else if (state.activeTab === 'clips') s.appendChild(renderClips(plan));
    else s.appendChild(renderGroup(plan));
    // V5 bottom navigation — Trips / AI Concierge / Share / Profile. Replaces the old action bar +
    // the redundant "Back to My Trips" button; folds the floating concierge FAB into one entry.
    // Shown on mobile AND desktop (slim centered bar via CSS), including the demo preview (so a
    // previewer can navigate / log in via Profile). Owner-only Share falls back to More otherwise.
    var bar = el('div', 'tc-actionbar tc-bottomnav');
    bar.appendChild(abBtn('🗂', t('navTrips'), function () { goDashboard(); }));
    bar.appendChild(abBtn('🤖', t('navConcierge'), function () { openConciergeSheet(tr); }));
    if (!tr._demo && isOwnerOfTrip()) bar.appendChild(abBtn('🔗', t('navShare'), function () { openShareModal(); }));
    else bar.appendChild(abBtn('⋯', t('moreActions'), function () { openMoreSheet(); }));
    bar.appendChild(abBtn('👤', t('navProfile'), function () { openProfileSheet(); }));
    s.appendChild(bar);
    return s;
  }
  // Profile sheet — account status (login/logout) + language (vi/en/es). Reuses realUser/
  // requireLogin/setLang/auth().signOut — no new auth path. Account-only per the V5 decision.
  function openProfileSheet() {
    if (doc.querySelector('.tc-ov-sheet')) return;
    var ov = el('div', 'tc-ov-sheet');
    var card = el('div', 'tc-ov-sheet__card');
    var head = el('div', 'tc-ov-sheet__head');
    head.appendChild(el('strong', 'tc-ov-sheet__t', '👤 ' + t('navProfile')));
    var x = el('button', 'tc-ov-sheet__x', '✕'); x.type = 'button';
    x.addEventListener('click', function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }); head.appendChild(x);
    card.appendChild(head);
    var u = realUser();
    card.appendChild(el('p', 'tc-ov-sheet__acct', u ? ('👤 ' + (u.email || '')) : t('signIn')));
    var langs = el('div', 'tc-ov-sheet__quick');
    [['en', 'EN'], ['vi', 'VI'], ['es', 'ES']].forEach(function (l) {
      var lb = el('button', 'tc-ov-sheet__chip' + (state.lang === l[0] ? ' tc-ov-sheet__chip--on' : ''), l[1]); lb.type = 'button';
      lb.addEventListener('click', function () { setLang(l[0]); if (ov.parentNode) ov.parentNode.removeChild(ov); });
      langs.appendChild(lb);
    });
    card.appendChild(langs);
    var row = el('div', 'tc-ov-sheet__row');
    if (u) { var out = el('button', 'tc-ov-sheet__go', t('logout')); out.type = 'button'; out.addEventListener('click', function () { try { auth().signOut(); } catch (e) {} if (ov.parentNode) ov.parentNode.removeChild(ov); }); row.appendChild(out); }
    else { var login = el('button', 'tc-ov-sheet__go', t('signIn')); login.type = 'button'; login.addEventListener('click', function () { if (ov.parentNode) ov.parentNode.removeChild(ov); requireLogin(function () { state._myTrips = null; render(); }); }); row.appendChild(login); }
    card.appendChild(row);
    ov.appendChild(card);
    ov.addEventListener('click', function (e) { if (e.target === ov && ov.parentNode) ov.parentNode.removeChild(ov); });
    doc.body.appendChild(ov);
  }
  // Floating concierge entry point. Opens a sheet whose quick-intent chips + free-text input
  // drive the SAME engine the Journey tab uses (interpretCommand → editPlanPreview → applyEditPlan).
  // Results render on the Journey tab (where the preview/apply UI already lives), so there is no
  // stale detached state. No new AI path.
  function conciergeFab(tr) {
    var fab = el('button', 'tc-ov-fab'); fab.type = 'button';
    fab.setAttribute('aria-label', t('ovConcierge'));
    fab.appendChild(el('span', 'tc-ov-fab__ic', '🤖'));
    fab.appendChild(el('span', 'tc-ov-fab__lbl', t('ovConcierge')));
    fab.addEventListener('click', function () { openConciergeSheet(tr); });
    return fab;
  }
  function closeConciergeSheet() { var s = doc.querySelector('.tc-ov-sheet'); if (s && s.parentNode) s.parentNode.removeChild(s); }
  // Run an utterance through the existing engine, surfacing the preview on the Journey tab.
  function runConcierge(tr, utterance) {
    var u = (utterance || '').trim(); if (!u) return;
    closeConciergeSheet();
    state.activeTab = 'journey'; state._cmdBusy = true; state._editPlan = null; render();
    interpretCommand(tr, u).then(function (pl) { state._cmdBusy = false; state._editPlan = (pl && pl.ok) ? pl : { error: true }; render(); });
  }
  function openConciergeSheet(tr) {
    if (doc.querySelector('.tc-ov-sheet')) return;
    var ov = el('div', 'tc-ov-sheet');
    var card = el('div', 'tc-ov-sheet__card');
    var head = el('div', 'tc-ov-sheet__head');
    head.appendChild(el('strong', 'tc-ov-sheet__t', '🤖 ' + t('ovConcierge')));
    var x = el('button', 'tc-ov-sheet__x', '✕'); x.type = 'button';
    x.addEventListener('click', closeConciergeSheet); head.appendChild(x);
    card.appendChild(head);
    var quick = el('div', 'tc-ov-sheet__quick');
    ['ovAskOptimize', 'ovAskGems', 'ovAskBook'].forEach(function (k) {
      var qb = el('button', 'tc-ov-sheet__chip', t(k)); qb.type = 'button';
      qb.addEventListener('click', function () { runConcierge(tr, t(k)); });
      quick.appendChild(qb);
    });
    card.appendChild(quick);
    var row = el('div', 'tc-ov-sheet__row');
    var ci = input('', t('cmdPh')); ci.className = 'tc-input tc-ov-sheet__in';
    var go = el('button', 'tc-ov-sheet__go', '✨ ' + t('cmdGo')); go.type = 'button';
    go.addEventListener('click', function () { runConcierge(tr, ci.value); });
    ci.addEventListener('keydown', function (e) { if (e.key === 'Enter') runConcierge(tr, ci.value); });
    row.appendChild(ci); row.appendChild(go);
    card.appendChild(row);
    ov.appendChild(card);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeConciergeSheet(); });
    doc.body.appendChild(ov);
    try { ci.focus(); } catch (e) {}
  }
  function abBtn(icon, label, fn) { var b = el('button', 'tc-actionbar__btn'); b.type = 'button'; b.appendChild(el('span', 'tc-actionbar__ic', icon)); b.appendChild(el('span', 'tc-actionbar__lbl', label)); b.addEventListener('click', fn); return b; }
  function researchBanner(msgKey) { var b = el('div', 'tc-researching'); b.appendChild(el('span', 'tc-researching__dot')); b.appendChild(el('span', 'tc-researching__msg', t(msgKey))); return b; }
  function chip(cls, txt) { return el('span', 'tc-chip ' + (cls || ''), txt); }

  function liveCatIcon(c) { return ({ event: '🎉', seasonal: '🌸', attraction: '📸', restaurant: '🍽', bar: '🍸', beach: '🏖', nightlife: '🌃', shopping: '🛍' })[c] || '✨'; }
  // ── V4 Overview — immersive, image-first landing surface. Composes existing computed data
  //    (tasks, costs, attractions, liveHighlights) into a 5-second-understandable hub. No new
  //    data is fetched here; honest-image rule via placeMedia. ──
  // Up to 4 real hero "teaser" chips — top liveHighlights then top attractions (rejected filtered).
  // Icon from liveCatIcon/catAttrIcon; label = short real place name. Never hardcoded/fabricated.
  function ovTeasers(tr) {
    var rej = rejectedNameSet(tr), out = [], seen = {};
    function push(name, icon) { var k = (name || '').trim().toLowerCase(); if (!name || seen[k] || rej[k] || out.length >= 4) return; seen[k] = 1; out.push({ icon: icon, label: name.length > 22 ? (name.slice(0, 21) + '…') : name }); }
    var hl = (tr.liveHighlights && tr.liveHighlights.length) ? tr.liveHighlights : ((tr.plan && tr.plan.liveHighlights) || []);
    hl.forEach(function (x) { if (x && x.name) push(x.name, liveCatIcon(x.category)); });
    var flat = [];
    (tr.attractions || []).forEach(function (d) { (d.attractions || []).forEach(function (a) { if (a && a.name) flat.push(a); }); });
    consensusSort(flat, function (a) { return a.name; }).forEach(function (a) { push(a.name, (typeof catAttrIcon === 'function' ? catAttrIcon(a.category) : '📍')); });
    return out;
  }
  function ovLeadPlace(tr) {
    var dests = (tr.attractions && tr.attractions.length) ? tr.attractions : [];
    var rej = rejectedNameSet(tr);
    for (var i = 0; i < dests.length; i++) {
      var atts = consensusSort((dests[i].attractions || []).filter(function (a) { return a && a.name && !rej[(a.name || '').trim().toLowerCase()]; }), function (a) { return a.name; });
      if (atts.length) return { place: atts[0], city: dests[i].city };
    }
    return null;
  }
  // SVG readiness ring — gold progress arc on a navy track; % text + aria-label (color is not
  // the only signal). Pure DOM, no animation dependency.
  function ovRing(pct) {
    pct = Math.max(0, Math.min(100, pct | 0));
    var R = 26, C = 2 * Math.PI * R, off = C * (1 - pct / 100);
    var NS = 'http://www.w3.org/2000/svg';
    var box = el('div', 'tc-ov-ring'); box.setAttribute('role', 'img');
    box.setAttribute('aria-label', pct + '% ' + t('ovReadyShort'));
    var svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('class', 'tc-ov-ring__svg');
    function circle(cls, dash) { var c = doc.createElementNS(NS, 'circle'); c.setAttribute('cx', '32'); c.setAttribute('cy', '32'); c.setAttribute('r', String(R)); c.setAttribute('class', cls); if (dash != null) { c.setAttribute('stroke-dasharray', String(C)); c.setAttribute('stroke-dashoffset', String(dash)); } return c; }
    svg.appendChild(circle('tc-ov-ring__track'));
    svg.appendChild(circle('tc-ov-ring__prog', off));
    box.appendChild(svg);
    var lbl = el('div', 'tc-ov-ring__lbl');
    lbl.appendChild(el('strong', 'tc-ov-ring__pct', pct + '%'));
    lbl.appendChild(el('span', 'tc-ov-ring__cap', t('ovReadyShort')));
    box.appendChild(lbl);
    return box;
  }
  // Shallow copy + city merge — never mutate the source attraction/highlight object.
  function ovWithCity(o, city) { var p = {}; for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) p[k] = o[k]; } if (!p.city) p.city = city; return p; }
  // ── V5 large photo-first card shared bits ──
  // Floating glass badge from tier. very_high/high → Must See (gold); medium → Top Pick; else none.
  function ovTierBadge(tier) { if (tier === 'very_high' || tier === 'high') return { label: t('mustSee'), gold: true }; if (tier === 'medium') return { label: t('topPick'), gold: false }; return null; }
  // Dotted meta line from EXISTING facts only — never fabricate rating/price/duration.
  function ovCardMeta(a) {
    var parts = [];
    var rt = a.rating; if (rt != null && /^[\d.]+$/.test(String(rt))) parts.push('⭐ ' + rt);
    var dur = a.duration || a.estimatedDuration || a.timeNeeded; if (dur) parts.push('⏱ ' + dur);
    if (a.ticketed) parts.push('🎟 ' + t('ticketed'));
    else if (a.ageFit) parts.push(t('fit_' + a.ageFit) || a.ageFit);
    if (!parts.length) return null;
    var m = el('div', 'tc-ov-card__meta');
    parts.forEach(function (p, i) { if (i) m.appendChild(el('span', 'tc-ov-card__dot', '·')); m.appendChild(el('span', null, p)); });
    return m;
  }
  function ovLinkLabel(m) {
    return ({ official_site: 'Official ↗', youtube_search: '▶ YouTube', map: 'Maps', menu: 'Menu', google_reviews: 'Reviews', yelp_reviews: 'Yelp', tripadvisor: 'Tripadvisor', ticket: '🎟 Tickets', photos: '📷 Photos' })[m.type] || m.title || 'Link';
  }
  // Compact real-link row (up to 3): prefers Official / YouTube / Maps; honest search links only.
  function ovCardLinks(item, type, city) {
    var row = el('div', 'tc-ov-card__links');
    var media = (root.TCMedia ? root.TCMedia.build(item, type, city) : []);
    var picked = [], want = ['official_site', 'youtube_search', 'map', 'menu', 'google_reviews'];
    want.forEach(function (ty) { if (picked.length < 3) { var m = media.filter(function (x) { return x.type === ty; })[0]; if (m && picked.indexOf(m) === -1) picked.push(m); } });
    media.forEach(function (m) { if (picked.length < 3 && picked.indexOf(m) === -1) picked.push(m); });
    picked.forEach(function (m) { if (m && m.url) { var a = el('a', 'tc-ov-card__lnk' + (m.type === 'youtube_search' ? ' tc-ov-card__lnk--yt' : ''), ovLinkLabel(m)); a.href = m.url; a.target = '_blank'; a.rel = 'noopener'; row.appendChild(a); } });
    return row;
  }
  // Large, photo-first Highlights card (the soul of the page). Real photo via placeMedia (honest
  // fallback). Floating Must-See/Top-Pick glass badge, dotted meta (facts only), why, real links.
  // Card-body tap → detail modal; tapping a link opens that link (guarded so both don't fire).
  function ovHighlightCard(a, city) {
    var c = el('article', 'tc-ov-card tc-ov-card--lg');
    var media = placeMedia(a, 'tc-ov-card__media');
    var bdg = ovTierBadge(a.tier);
    if (bdg) { var b = el('span', 'tc-ov-card__badge' + (bdg.gold ? ' tc-ov-card__badge--gold' : '')); b.textContent = bdg.label; media.appendChild(b); }
    c.appendChild(media);
    var body = el('div', 'tc-ov-card__body');
    body.appendChild(el('strong', 'tc-ov-card__name', a.name));
    var meta = ovCardMeta(a); if (meta) body.appendChild(meta);
    if (a.why) body.appendChild(el('p', 'tc-ov-card__why', a.why));
    body.appendChild(ovCardLinks(a, 'attraction', city));
    c.appendChild(body);
    c.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('a')) return; try { openPlaceModal(ovWithCity(a, city)); } catch (err) {} });
    return c;
  }
  // One compact day row: Day N · city · up to 3 headline place chips. Tap → Itinerary at day i.
  // Travel/transfer days show their travel label (never fabricated activities).
  function ovTimelineRow(d, i) {
    var row = el('button', 'tc-ov-tl__row'); row.type = 'button';
    var head = el('div', 'tc-ov-tl__head');
    head.appendChild(el('span', 'tc-ov-tl__d', t('day') + ' ' + (i + 1)));
    if (d.city) head.appendChild(el('span', 'tc-ov-tl__city', d.city));
    if (d.isTravelDay || d.transferDay) head.appendChild(el('span', 'tc-ov-tl__travel', '🚗 ' + t('travelDay')));
    row.appendChild(head);
    var names = [];
    (d.sections || []).forEach(function (s) { (s.places || []).forEach(function (p) { if (p && p.name && names.length < 3) names.push(p.name); }); });
    if (names.length) {
      var chipw = el('div', 'tc-ov-tl__chips');
      names.forEach(function (n) { chipw.appendChild(el('span', 'tc-ov-tl__chip', n)); });
      row.appendChild(chipw);
    }
    row.addEventListener('click', function () { state.activeTab = 'itinerary'; state.activeDay = i; render(); });
    return row;
  }
  // Image-first discovery card from a liveHighlights entry. Real image via placeMedia; honest
  // fallback otherwise. Tap opens the existing detail modal (search links live inside it).
  function ovDiscoveryCard(x) {
    var c = el('article', 'tc-ov-card tc-ov-card--lg tc-ov-card--disc');
    var media = placeMedia(x, 'tc-ov-card__media');
    var bd = el('span', 'tc-ov-card__badge'); bd.textContent = liveCatIcon(x.category) + ' ' + (x.category ? String(x.category).replace(/_/g, ' ') : t('ovDiscoveries'));
    media.appendChild(bd);
    c.appendChild(media);
    var body = el('div', 'tc-ov-card__body');
    body.appendChild(el('strong', 'tc-ov-card__name', x.name || ''));
    var meta = ovCardMeta(x); if (meta) body.appendChild(meta);
    if (x.note || x.why) body.appendChild(el('p', 'tc-ov-card__why', x.note || x.why));
    body.appendChild(ovCardLinks(x, mediaTypeForPlace(x), x.city || ''));
    // Add to trip / Replace existing — editable trips only. Add = pin the place (real); Replace =
    // route through the existing concierge command engine (it decides what to swap). No fake action.
    if (canEditPlan()) {
      var acts = el('div', 'tc-ov-card__actions');
      var add = el('button', 'tc-ov-card__act tc-ov-card__act--gold', '＋ ' + t('ovAddToTrip')); add.type = 'button';
      add.addEventListener('click', function (e) { e.stopPropagation(); pinAttraction({ name: x.name, why: x.note || x.why || '' }, x.city || ''); });
      acts.appendChild(add);
      var rep = el('button', 'tc-ov-card__act', '⇄ ' + t('ovReplace')); rep.type = 'button';
      rep.addEventListener('click', function (e) { e.stopPropagation(); runConcierge(state.trip, t('ovReplaceCmd').replace('{name}', x.name)); });
      acts.appendChild(rep);
      body.appendChild(acts);
    }
    c.appendChild(body);
    c.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('a, button')) return; try { openPlaceModal(ovWithCity(x, '')); } catch (err) {} });
    return c;
  }
  function renderOverview(plan) {
    var tr = state.trip;
    var wrap = el('div', 'tc-ov');

    // ── Block 1: Cinematic Hero — experience-first. NO readiness ring / budget chip / status
    //    chips / next-task CTA (those live in the Task & Cost centers). Real photo via placeMedia
    //    (honest navy-gradient fallback), big season title, auto-sourced emoji teasers, ONE CTA. ──
    var hero = el('section', 'tc-ov-hero');
    var lead = ovLeadPlace(tr);
    hero.appendChild(placeMedia(lead ? lead.place : { name: plan.destination || tr.destination }, 'tc-ov-hero__media'));
    var inner = el('div', 'tc-ov-hero__inner');
    inner.appendChild(el('span', 'tc-ov-hero__eyebrow', plan.destination || tr.destination || ''));
    var ht = root.TCOverview.heroTitle(plan.dateRange || tr.dateRange || '');
    inner.appendChild(el('h1', 'tc-ov-hero__title', ht ? (t(ht.seasonKey) + ' ' + ht.year) : (plan.groupName || tr.groupName || '')));
    var famN = (tr.families || []).length, travN = (function () { try { return totalTravelers(); } catch (e) { return 0; } })();
    var sub = (plan.dateRange || tr.dateRange || '');
    if (famN) sub += ' · ' + famN + ' ' + t('ovFamilies');
    if (travN) sub += ' · ' + travN + ' ' + t('travelers');
    inner.appendChild(el('p', 'tc-ov-hero__sub', sub));
    var teasers = ovTeasers(tr);
    if (teasers.length) {
      var trow = el('div', 'tc-ov-hero__teasers');
      teasers.forEach(function (te) { var ch = el('span', 'tc-ov-hero__teaser'); ch.appendChild(el('span', 'tc-ov-hero__teaser-ic', te.icon)); ch.appendChild(el('span', null, te.label)); trow.appendChild(ch); });
      inner.appendChild(trow);
    }
    var cta = el('button', 'tc-ov-hero__cta'); cta.type = 'button';
    cta.textContent = t('continuePlanning') + ' →';
    cta.addEventListener('click', function () { state.activeTab = 'itinerary'; state.activeDay = 0; render(); });
    inner.appendChild(cta);
    hero.appendChild(inner);
    if (tr._fallback || (plan.dataSource && /pending/.test(plan.dataSource))) hero.appendChild(el('p', 'tc-unverified', t('unverified')));
    wrap.appendChild(hero);

    // ── Block 2: Highlights rail (top attractions, image-first, horizontal scroll) ──
    var rej = rejectedNameSet(tr);
    var flat = [];
    ((tr.attractions && tr.attractions.length) ? tr.attractions : []).forEach(function (d) {
      (d.attractions || []).forEach(function (a) { if (a && a.name && !rej[(a.name || '').trim().toLowerCase()]) flat.push({ a: a, city: d.city }); });
    });
    var top = consensusSort(flat, function (x) { return x.a.name; }).slice(0, 6);
    if (top.length || (state._cResearch && state._cResearch.attractions)) {
      var hsec = el('section', 'tc-ov-sec');
      var hhead = el('div', 'tc-ov-sec__head');
      hhead.appendChild(el('h2', 'tc-ov-sec__t', t('ovHighlights')));
      var seeAll = el('button', 'tc-ov-sec__more', t('ovSeeAll')); seeAll.type = 'button';
      seeAll.addEventListener('click', function () { state.activeTab = 'itinerary'; render(); });
      hhead.appendChild(seeAll);
      hsec.appendChild(hhead);
      if (top.length) {
        var rail = el('div', 'tc-ov-rail');
        top.forEach(function (x) { rail.appendChild(ovHighlightCard(x.a, x.city)); });
        hsec.appendChild(rail);
      } else {
        hsec.appendChild(researchBanner('ovCuratingHighlights'));
      }
      wrap.appendChild(hsec);
    }

    // ── AI Discoveries rail — right after Highlights (both dominant, image-first; inspiration
    //    BEFORE logistics). Live highlights only; honest images. ──
    var hl = (plan && plan.liveHighlights && plan.liveHighlights.length) ? plan.liveHighlights : ((tr && tr.liveHighlights) || []);
    if (hl.length) {
      var dsec = el('section', 'tc-ov-sec');
      var dhead = el('div', 'tc-ov-sec__head');
      dhead.appendChild(el('h2', 'tc-ov-sec__t', t('ovDiscoveries')));
      if (tr.liveSourceNote) dhead.appendChild(el('span', 'tc-ov-sec__src', tr.liveSourceNote));
      dsec.appendChild(dhead);
      var drail = el('div', 'tc-ov-rail');
      hl.slice(0, 8).forEach(function (x) { drail.appendChild(ovDiscoveryCard(x)); });
      dsec.appendChild(drail);
      wrap.appendChild(dsec);
    }

    // ── Memories teaser — REAL uploaded trip photos/clips only (no AI art); hidden when none. ──
    if (!tr._demo && realUser() && state._mediaLoadedFor !== tr.id) {
      state._mediaLoadedFor = tr.id;
      loadMedia().then(function () { if (state.screen === 'plan' && state.activeTab === 'overview') render(); });
    }
    var memories = (!tr._demo && realUser()) ? visibleMedia() : [];
    if (memories.length) {
      var msec = el('section', 'tc-ov-sec');
      var mhead = el('div', 'tc-ov-sec__head');
      mhead.appendChild(el('h2', 'tc-ov-sec__t', t('ovMemories')));
      var amore = el('button', 'tc-ov-sec__more', t('tab_album') + ' →'); amore.type = 'button';
      amore.addEventListener('click', function () { state.activeTab = 'album'; render(); });
      mhead.appendChild(amore); msec.appendChild(mhead);
      var strip = el('div', 'tc-ov-memstrip');
      memories.slice().sort(function (a, b) { return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0); }).slice(0, 10).forEach(function (m) {
        var cell = el('button', 'tc-ov-mem'); cell.type = 'button';
        var url = m.thumbnailUrl || m.publicUrl || m.url;
        if (url) { var img = doc.createElement('img'); img.className = 'tc-ov-mem__img'; img.src = url; img.loading = 'lazy'; img.alt = m.caption || ''; cell.appendChild(img); }
        if ((m.mediaType || '') === 'video' || m.mediaType === 'clip') cell.appendChild(el('span', 'tc-ov-mem__play', '▶'));
        cell.addEventListener('click', function () { state.activeTab = 'album'; render(); });
        strip.appendChild(cell);
      });
      msec.appendChild(strip);
      wrap.appendChild(msec);
    }

    // ── Logistics, COLLAPSED (experience first): Timeline → Tasks → Costs → Details. ──
    var days = (plan.days || []);
    if (days.length) {
      var tcol = ovCollapse('timeline', '🗓 ' + t('ovTimeline'), days.length + ' ' + t('day').toLowerCase() + ((plan.dateRange || tr.dateRange) ? (' · ' + (plan.dateRange || tr.dateRange)) : ''), true);
      var tlBody = el('div', 'tc-ov-collapse__body');
      var dl = el('div', 'tc-ov-days');
      days.forEach(function (d, i) { dl.appendChild(ovDayDetails(d, i)); });
      tlBody.appendChild(dl);
      var viewIt = el('button', 'tc-ov-collapse__cta', t('ovViewItinerary') + ' →'); viewIt.type = 'button';
      viewIt.addEventListener('click', function () { state.activeTab = 'itinerary'; state.activeDay = 0; render(); });
      tlBody.appendChild(viewIt);
      tcol.appendChild(tlBody);
      wrap.appendChild(tcol);
    }

    // Task Center (collapsed) — relocated readiness/next-action + priority-ordered task rows.
    var tasks = []; try { tasks = deriveTripTasks(tr) || []; } catch (e) { tasks = tr.bookings || []; }
    if (tasks.length) {
      var rdc = root.TCOverview.readiness(tasks), todoN = rdc.totalCount - rdc.doneCount;
      // V6: dependency-aware next action (matches the Tasks-tab Next-Action card) instead of the flat one.
      var na = (function () { try { return buildDepNodes(tr).nextAction; } catch (e) { return root.TCOverview.nextAction(tasks); } })();
      var taskCol = ovCollapse('tasks', '✅ ' + t('tab_tasks'), todoN + ' ' + t('ovToDo') + ' · ' + rdc.doneCount + ' ' + t('ovDone'), false);
      var tkBody = el('div', 'tc-ov-collapse__body');
      if (na) tkBody.appendChild(el('p', 'tc-ov-next', '→ ' + t('ovNext') + ': ' + na.title));
      var PR = { P0: 0, P1: 1, P2: 2 };
      tasks.slice().sort(function (a, b) { var p = (PR[a.priority] == null ? 2 : PR[a.priority]) - (PR[b.priority] == null ? 2 : PR[b.priority]); if (p) return p; return (a.dueDate ? String(a.dueDate) : '~') < (b.dueDate ? String(b.dueDate) : '~') ? -1 : 1; })
        .slice(0, 8).forEach(function (tk) { tkBody.appendChild(ovTaskRow(tk)); });
      var allTasks = el('button', 'tc-ov-collapse__cta', t('tab_tasks') + ' →'); allTasks.type = 'button';
      allTasks.addEventListener('click', function () { state.activeTab = 'bookings'; render(); });
      tkBody.appendChild(allTasks);
      taskCol.appendChild(tkBody);
      wrap.appendChild(taskCol);
    }

    // Cost Center (collapsed) — estimated/paid/remaining + per-family. Honest '~' on estimates.
    var costs = null; try { costs = computeTripCosts(tr); } catch (e) {}
    if (costs) {
      var bal = null; try { if (root.TCTasks) bal = root.TCTasks.computeBalances(tasks, costs.perFamilies, costSplit(tr), costLedger(tr)); } catch (e) {}
      var paid = bal ? bal.totalPaid : 0, remain = bal ? bal.remaining : costs.total.expected;
      var perFamAvg = Math.round(costs.total.expected / (costs.perFamilies.length || 1));
      var costCol = ovCollapse('costs', '💰 ' + t('tab_costs'), '~' + money(costs.total.expected) + ' ' + t('ovTotalLc') + ' · ~' + money(perFamAvg) + '/' + t('ovFamilyLc'), false);
      var cBody = el('div', 'tc-ov-collapse__body');
      var grid = el('div', 'tc-ov-costgrid');
      [[t('ovEstimated'), '~' + money(costs.total.expected)], [t('costPaid'), money(paid)], [t('ovRemaining'), '~' + money(remain)], [t('costPerPerson'), '~' + money(costs.perPerson)]].forEach(function (cc) {
        var cell = el('div', 'tc-ov-costcell'); cell.appendChild(el('span', 'tc-ov-costcell__l', cc[0])); cell.appendChild(el('span', 'tc-ov-costcell__v', cc[1])); grid.appendChild(cell);
      });
      cBody.appendChild(grid);
      var allCost = el('button', 'tc-ov-collapse__cta', t('tab_costs') + ' →'); allCost.type = 'button';
      allCost.addEventListener('click', function () { state.activeTab = 'costs'; render(); });
      cBody.appendChild(allCost);
      costCol.appendChild(cBody);
      wrap.appendChild(costCol);
    }

    // Details (collapsed) — quiet entry points to the remaining surfaces (replaces the old quick-links row).
    var detCol = ovCollapse('details', '🧭 ' + t('moreNavTitle'), t('tab_transport') + ' · ' + t('tab_stay') + ' · ' + t('tab_food') + '…', false);
    var dBody = el('div', 'tc-ov-collapse__body');
    [['transport', '🚐 ', 'tab_transport'], ['stay', '🏨 ', 'tab_stay'], ['food', '🍽 ', 'tab_food'], ['events', '🎉 ', 'tab_events'], ['group', '👥 ', 'tab_group']].forEach(function (it) {
      var r = el('button', 'tc-ov-detrow', it[1] + t(it[2])); r.type = 'button';
      r.appendChild(el('span', 'tc-ov-detrow__arr', '→'));
      r.addEventListener('click', function () { state.activeTab = it[0]; render(); });
      dBody.appendChild(r);
    });
    detCol.appendChild(dBody);
    wrap.appendChild(detCol);

    return wrap;
  }
  // ── V5 collapsible primitives (native <details>, localStorage-persisted open state) ──
  function ovCollapseState(key, def) { try { var v = root.localStorage.getItem('tc_ov_' + key); if (v === '1') return true; if (v === '0') return false; } catch (e) {} return !!def; }
  function ovCollapse(key, titleText, subText, defOpen) {
    var d = el('details', 'tc-ov-collapse'); if (ovCollapseState(key, defOpen)) d.open = true;
    var sm = el('summary', 'tc-ov-collapse__sum');
    var lab = el('div', 'tc-ov-collapse__lab');
    lab.appendChild(el('span', 'tc-ov-collapse__k', titleText));
    if (subText) lab.appendChild(el('span', 'tc-ov-collapse__v', subText));
    sm.appendChild(lab);
    sm.appendChild(el('span', 'tc-ov-collapse__chev', '▾'));
    d.appendChild(sm);
    d.addEventListener('toggle', function () { try { root.localStorage.setItem('tc_ov_' + key, d.open ? '1' : '0'); } catch (e) {} });
    return d;
  }
  // Collapsed day row (Day N ▼) — expand shows that day's places; sibling days auto-collapse; a
  // "view full itinerary" deep-link preserved. Travel days show the travel label, never fabricated.
  function ovDayDetails(d, i) {
    var det = el('details', 'tc-ov-day');
    var sm = el('summary', 'tc-ov-day__sum');
    sm.appendChild(el('span', 'tc-ov-day__d', t('day') + ' ' + (i + 1)));
    if (d.city) sm.appendChild(el('span', 'tc-ov-day__city', d.city));
    if (d.isTravelDay || d.transferDay) sm.appendChild(el('span', 'tc-ov-day__travel', '🚗 ' + t('travelDay')));
    sm.appendChild(el('span', 'tc-ov-day__chev', '▾'));
    det.appendChild(sm);
    var body = el('div', 'tc-ov-day__body');
    var any = false;
    (d.sections || []).forEach(function (sec) { (sec.places || []).forEach(function (p) { if (p && p.name) { any = true; var r = el('div', 'tc-ov-day__place'); r.appendChild(el('span', 'tc-ov-day__pic', '•')); r.appendChild(el('span', null, p.name)); body.appendChild(r); } }); });
    if (!any) body.appendChild(el('p', 'tc-ov-day__empty', d.isTravelDay || d.transferDay ? t('travelDay') : (d.title || '')));
    var go = el('button', 'tc-ov-day__open', t('ovViewItinerary') + ' →'); go.type = 'button';
    go.addEventListener('click', function (e) { e.preventDefault(); state.activeTab = 'itinerary'; state.activeDay = i; render(); });
    body.appendChild(go);
    det.appendChild(body);
    det.addEventListener('toggle', function () { if (det.open && det.parentNode) { var sibs = det.parentNode.querySelectorAll('details.tc-ov-day'); for (var k = 0; k < sibs.length; k++) if (sibs[k] !== det) sibs[k].open = false; } });
    return det;
  }
  // Compact priority task row for the Overview Task Center. Status/due/cost/assignee — facts only.
  function ovTaskRow(tk) {
    var done = ({ booked: 1, paid: 1, skipped: 1, not_needed: 1 })[tk.status];
    var row = el('div', 'tc-ov-task' + (done ? ' tc-ov-task--done' : ''));
    var pri = el('span', 'tc-ov-task__pri tc-ov-task__pri--' + (done ? 'done' : String(tk.priority || 'P2').toLowerCase()));
    pri.textContent = done ? '✓' : (tk.priority || 'P2');
    row.appendChild(pri);
    row.appendChild(el('span', 'tc-ov-task__t', tk.title || tk.name || ''));
    var bits = [];
    if (tk.dueDate) bits.push(tk.dueDate);
    var cost = tk.actualCost || tk.costEstimate; if (cost) bits.push((tk.actualCost ? '' : '~') + String(cost).replace(/^\$?/, '$'));
    if (tk.assignedToFamily) { var fam = ((state.trip.families || []).filter(function (f) { return f.id === tk.assignedToFamily; })[0] || {}); if (fam.name) bits.push(fam.name); }
    if (bits.length) row.appendChild(el('span', 'tc-ov-task__meta', bits.join(' · ')));
    return row;
  }
  function liveHighlightsBlock(plan) {
    var hl = (plan && plan.liveHighlights && plan.liveHighlights.length) ? plan.liveHighlights : ((state.trip && state.trip.liveHighlights) || []);
    if (!hl || !hl.length) return null;
    var b = el('div', 'tc-live');
    var head = el('div', 'tc-live__head');
    head.appendChild(el('strong', 'tc-live__t', t('liveTitle')));
    if (state.trip && state.trip.liveSourceNote) head.appendChild(el('span', 'tc-live__src', state.trip.liveSourceNote));
    b.appendChild(head);
    b.appendChild(el('p', 'tc-live__sub', t('liveSub')));
    var grid = el('div', 'tc-live__grid');
    hl.slice(0, 8).forEach(function (x) {
      if (!x || !x.name) return;
      var c = el('div', 'tc-live__item');
      var top = el('div', 'tc-live__top');
      top.appendChild(el('span', 'tc-live__cat', liveCatIcon(x.category) + ' ' + (x.category || '')));
      if (x.whenRelevant) top.appendChild(el('span', 'tc-live__when', x.whenRelevant));
      c.appendChild(top);
      c.appendChild(el('strong', 'tc-live__name', x.name));
      if (x.note) c.appendChild(el('p', 'tc-live__note', x.note));
      var a = el('a', 'tc-pbtn', '🔎 ' + t('mapG')); a.href = MapLinkProvider.google(x.name, (state.trip && state.trip.destination) || ''); a.target = '_blank'; a.rel = 'noopener';
      c.appendChild(a);
      var _lmx = learnMoreSection({ name: x.name, category: x.category }, mediaTypeForPlace({ category: x.category }), (state.trip && state.trip.destination) || ''); if (_lmx) c.appendChild(_lmx); // "Learn more"
      grid.appendChild(c);
    });
    b.appendChild(grid);
    b.appendChild(el('p', 'tc-unverified', t('unverified')));
    return b;
  }
  // Destinations the timeline can label days by: prefer the AI plan's list, else the trip's.
  function planDestinations(plan) {
    if (plan && Array.isArray(plan.destinations) && plan.destinations.length) return plan.destinations;
    var tr = state.trip;
    if (tr && Array.isArray(tr.destinations)) return tr.destinations.map(function (d, i) { return { index: i, city: d.city }; });
    return [];
  }
  function destCityName(plan, idx) { var d = planDestinations(plan)[idx || 0]; return d ? (d.city || '') : ''; }
  function jumpToLeg(plan, destIdx) {
    var days = plan.days || [], i;
    for (i = 0; i < days.length; i++) { if ((days[i].destinationIndex || 0) === destIdx && !days[i].isTravelDay) { state.activeDay = i; render(); return; } }
    for (i = 0; i < days.length; i++) { if ((days[i].destinationIndex || 0) === destIdx) { state.activeDay = i; render(); return; } }
  }
  function routeOverviewStrip(plan) {
    var ro = plan.routeOverview, dests = planDestinations(plan);
    if ((!ro || !ro.legs || !ro.legs.length) && dests.length < 2) return null;
    var b = el('div', 'tc-routeoverview');
    var head = el('div', 'tc-routeoverview__head');
    head.appendChild(el('strong', 'tc-routeoverview__t', '🗺 ' + t('routeOverviewTitle')));
    if (ro && (ro.totalDriveTime || ro.totalDistance)) head.appendChild(el('span', 'tc-routeoverview__tot', '🚗 ' + [ro.totalDriveTime, ro.totalDistance].filter(Boolean).join(' · ')));
    b.appendChild(head);
    var chipsRow = el('div', 'tc-routeoverview__chips');
    dests.forEach(function (d, i) {
      var c = el('button', 'tc-routechip', d.city || ('#' + (i + 1))); c.type = 'button';
      c.addEventListener('click', function () { jumpToLeg(plan, i); });
      chipsRow.appendChild(c);
      if (i < dests.length - 1) {
        var legInfo = ro && ro.legs && ro.legs[i] ? ro.legs[i] : null;
        chipsRow.appendChild(el('span', 'tc-routearrow', legInfo && legInfo.estimatedDriveTime ? '→ ' + legInfo.estimatedDriveTime : '→'));
      }
    });
    b.appendChild(chipsRow);
    var tag = routeSourceTag(ro && ro.dataSource);
    if (tag) b.appendChild(tag);
    else if (ro && ro.dataSource && /pending/.test(ro.dataSource)) b.appendChild(el('p', 'tc-unverified', t('unverified')));
    return b;
  }
  // Day-type badge (arrival / travel / return / mixed). main_activity_day = no badge (default).
  function dayTypeBadge(type) {
    var map = { arrival_day: ['🛬', 'tc-roletag--arrival'], transfer_day: ['🚗', 'tc-roletag--transfer'], return_day: ['🏁', 'tc-roletag--return'], mixed_day: ['🔀', 'tc-roletag--mixed'] };
    var m = map[type]; if (!m) return null;
    return el('span', 'tc-roletag ' + m[1], m[0] + ' ' + (t('dt_' + type) || type));
  }
  // Distances/times are from Google Maps (or a clearly-labelled estimate) — never AI.
  function routeSourceTag(src) {
    if (src === 'google_maps') return el('span', 'tc-routesrc tc-routesrc--ok', '✓ ' + t('routeVerifiedTag'));
    if (src === 'estimated') return el('span', 'tc-routesrc', '≈ ' + t('routeEstimatedTag'));
    return null;
  }
  // The travel legs the user LOCKED for this day (NL Journey Builder). Matched by ISO date
  // (locale-independent), falling back to the arrival/return city. These OVERRIDE the AI's
  // generic single-car route — the planner can never collapse "SJ →bus→ OC →ride→ SD" into
  // "SJ → SD by car". Returns [] for manual/legacy trips (then the classic render runs).
  function lockedLegsForDay(tr, day, plan) {
    var legs = (tr && tr.lockedLegs) || []; if (!legs.length) return [];
    var dIso = ''; var pd = parseSegDate(day.iso || day.date || ''); if (pd) dIso = isoOfDate(pd);
    var byDate = dIso ? legs.filter(function (l) { var p = parseSegDate(l.date); return p && isoOfDate(p) === dIso; }) : [];
    if (byDate.length) return byDate;
    if (day.isReturnDay) { var home = tcNorm(tr.departureCity); return legs.filter(function (l) { return tcNorm(l.toCity) === home; }); }
    var city = tcNorm(destCityName(plan, day.destinationIndex || 0) || ''); if (!city) return [];
    return legs.filter(function (l) { return tcNorm(l.toCity) === city; });
  }
  function legModeIcon(m) { return { bus: '🚌', private_ride: '🚐', car: '🚗', flight: '✈️', train: '🚆', walk: '🚶' }[m] || '🚐'; }
  function lockedLegRow(l, tr) {
    var row = el('div', 'tc-travel__leg');
    row.appendChild(el('div', 'tc-travel__legroute', legModeIcon(l.transportMode) + ' ' + (l.fromCity || '') + '  →  ' + (l.toCity || '')));
    var meta = el('div', 'tc-travel__legmeta');
    meta.appendChild(chip('tc-chip--lock', '🔒 ' + ((l.provider || '').trim() || t('nlmode_' + (l.transportMode || 'other')) || t('nlLocked'))));
    if (l.needsResearch) meta.appendChild(chip('tc-chip--warn', '🔎 ' + t('nlNeedsResearch')));
    if (l.needsBooking) meta.appendChild(chip('tc-chip--warn', '🎫 ' + t('nlNeedsBooking')));
    row.appendChild(meta);
    var acts = el('div', 'tc-travel__legacts');
    var isRide = l.transportMode === 'private_ride' || /michael|dulichcali|du lich cali|\bdlc\b/i.test(l.provider || '');
    if (isRide && !state.readonly) acts.appendChild(pbtn('🚐 ' + t('nlRequestRide'), 'tc-pbtn--ride', function () { requestDlcInquiry({ kind: 'ride', pickup: l.fromCity, dropoff: l.toCity, label: l.title || '', mode: 'dlc_ride', segmentId: segmentIdForCity(tr, l.toCity) }); }));
    if (l.needsResearch || l.transportMode === 'bus') acts.appendChild(pbtn('🔎 ' + t('nlResearchLink'), 'tc-pbtn--ghost', function () { openProviderResearch({ provider: l.provider, origin: l.fromCity, destination: l.toCity }); }));
    var mp = el('a', 'tc-chip tc-chip--route', '🗺 ' + t('route')); mp.href = MapLinkProvider.google(l.toCity || '', ''); mp.target = '_blank'; mp.rel = 'noopener'; acts.appendChild(mp);
    row.appendChild(acts);
    return row;
  }
  function renderTravelDay(day, plan) {
    var tr = state.trip, tl = day.travelLeg || {};
    var card = el('div', 'tc-travel');
    // USER-LOCKED ROUTE WINS — render the exact legs the traveler required (e.g. Bus Hoang +
    // Michael ride); the AI's single-car route is demoted to an optional comparison only.
    var locked = lockedLegsForDay(tr, day, plan);
    if (locked.length) {
      card.appendChild(el('div', 'tc-travel__route', '🔒 ' + t('nlYourRoute')));
      locked.forEach(function (l) { card.appendChild(lockedLegRow(l, tr)); });
      if (tl.estimatedDriveTime) card.appendChild(el('p', 'tc-travel__caralt', '🚗 ' + t('nlCarAlt') + ': ' + tl.estimatedDriveTime + (tl.estimatedDistance ? (' · ' + tl.estimatedDistance) : '')));
      if (tl.mealStops && tl.mealStops.length) { card.appendChild(el('strong', 'tc-travel__sub', t('mealStops'))); tl.mealStops.forEach(function (p) { card.appendChild(placeCard(p)); }); }
      return card;
    }
    card.appendChild(el('div', 'tc-travel__route', '🚗 ' + ((tl.fromCity || '') + ' → ' + (tl.toCity || destCityName(plan, day.destinationIndex || 0) || ''))));
    var grid = el('div', 'tc-travel__grid');
    grid.appendChild(kv(t('driveTime'), tl.estimatedDriveTime || t('pending')));
    grid.appendChild(kv(t('distance'), tl.estimatedDistance || t('pending')));
    // Depart/arrive removed from AI responsibility — only show if a real value exists.
    if (tl.suggestedDepartureTime) grid.appendChild(kv(t('departFrom'), tl.suggestedDepartureTime));
    if (tl.suggestedArrivalTime) grid.appendChild(kv(t('arriveAt'), tl.suggestedArrivalTime));
    card.appendChild(grid);
    var tdtag = routeSourceTag(tl.dataSource); if (tdtag) card.appendChild(tdtag);
    if (tl.routeSummary) card.appendChild(kv(t('routeOverviewTitle'), tl.routeSummary));
    if (tl.fatigueNote) card.appendChild(kv(t('fatigueNote'), tl.fatigueNote));
    if (tl.toddlerNapNote) card.appendChild(kv(t('napNote'), tl.toddlerNapNote));
    if (tl.seniorNote) card.appendChild(kv(t('seniorNote'), tl.seniorNote));
    if (tl.backupPlan) card.appendChild(kv(t('backup'), tl.backupPlan));
    if (tl.mealStops && tl.mealStops.length) { card.appendChild(el('strong', 'tc-travel__sub', t('mealStops'))); tl.mealStops.forEach(function (p) { card.appendChild(placeCard(p)); }); }
    if (tl.restStops && tl.restStops.length) {
      card.appendChild(el('strong', 'tc-travel__sub', t('restStopsLabel')));
      var rl = el('div', 'tc-travel__rest');
      tl.restStops.forEach(function (rs) {
        if (!rs) return;
        var a = el('a', 'tc-pbtn', '📍 ' + (rs.name || rs.city || '')); a.href = rs.googleMapsUrl || MapLinkProvider.google(rs.name, rs.city || ''); a.target = '_blank'; a.rel = 'noopener'; rl.appendChild(a);
      });
      card.appendChild(rl);
    }
    var rb = el('a', 'tc-chip tc-chip--route', '🗺 ' + t('route')); rb.href = tl.mapLink || MapLinkProvider.google(tl.toCity || destCityName(plan, day.destinationIndex || 0) || '', ''); rb.target = '_blank'; rb.rel = 'noopener'; card.appendChild(rb);
    if (!tl.dataSource || /pending/.test(tl.dataSource)) card.appendChild(el('p', 'tc-unverified', t('unverified')));
    return card;
  }
  // Regenerate just ONE destination leg (re-detail its days; leave the rest of the plan).
  function regenerateLeg(destIndex) {
    var tr = state.trip, plan = tr.plan; if (!plan || !Array.isArray(plan.days)) return;
    var legFn = mkCallable('generateLegDays', 75000); if (!legFn) return;
    var idxs = []; plan.days.forEach(function (d, i) { if ((d.destinationIndex || 0) === destIndex) idxs.push(i); });
    if (!idxs.length) return;
    var daySpecs = idxs.map(function (i) { var dd = plan.days[i]; return { dayNumber: i + 1, date: dd.date || '', destinationIndex: destIndex, isTravelDay: !!dd.isTravelDay, isReturnDay: !!dd.isReturnDay, title: dd.title || '', theme: dd.theme || '', summary: dd.summary || '' }; });
    var td = (tr.destinations || [])[destIndex] || {}, pdest = (plan.destinations || [])[destIndex] || {};
    state.generating = true; renderGenerating(t('genLeg'));
    legFn({
      trip: { tripStyle: tr.tripStyle, budget: tr.budget, families: tr.families, preferences: tr.preferences, departureCity: tr.departureCity, lastDayFull: !!tr.lastDayFull, finalDayMode: finalDayMode(tr) },
      lang: state.lang,
      leg: { index: destIndex, city: td.city || pdest.city || destNameFromTrip(tr, destIndex), startDate: td.startDate || '', endDate: td.endDate || '', hotelSuggestion: pdest.hotelSuggestion || null, role: td.role || 'main_destination', hotelNeeded: td.hotelNeeded !== false, mealOnly: !!td.mealOnly, suggestFood: td.suggestFood !== false, suggestActivities: td.suggestActivities !== false, hoursToSpend: td.hoursToSpend || '', priority: td.priority || 'required' },
      daySpecs: daySpecs, liveHighlights: tr.liveHighlights || [], avoidPlaces: rejectedNames(tr), preferredPlaces: preferredNames(tr), pinnedActivities: tr.pinnedActivities || [],
    }).then(function (rr) {
      state.generating = false;
      var dd = (rr && rr.data) || {};
      if (dd.ok && Array.isArray(dd.days) && dd.days.length) {
        var fresh = dd.days.slice();
        idxs.forEach(function (i) { var wasReturn = !!plan.days[i].isReturnDay; var nd = fresh.shift(); if (nd) { if (nd.destinationIndex == null) nd.destinationIndex = destIndex; if (nd.isReturnDay == null) nd.isReturnDay = wasReturn; plan.days[i] = nd; } });
        saveTrip(tr);
      } else { toast(t('genFail')); }
      render();
    }).catch(function () { state.generating = false; toast(t('genFail')); render(); });
  }
  // ── Destination Intelligence UI: "Top attractions for your group" (ranked signature
  //    attractions; Pin adds to the trip's must-dos; ticketed ones already feed bookings) ──
  function catAttrIcon(c) { return ({ theme_park: '🎢', zoo: '🦁', aquarium: '🐠', museum: '🏛', landmark: '📸', nature: '🏞', beach: '🏖', food: '🍽', nightlife: '🌃', show: '🎭' })[c] || '✨'; }
  function groupProfileLabel(gp) {
    var bits = [];
    if (gp.kids) bits.push(gp.kids + ' ' + t('childrenLabel').toLowerCase());
    if (gp.teens) bits.push(gp.teens + ' ' + t('teensLabel'));
    if (gp.seniors) bits.push(gp.seniors + ' ' + t('seniors').toLowerCase());
    return bits.length ? (t('forGroup') + ' ' + bits.join(', ')) : '';
  }
  function pinAttraction(a, city) {
    var tr = state.trip; tr.pinnedActivities = tr.pinnedActivities || [];
    if (tr.pinnedActivities.some(function (p) { return (p.title || '').trim().toLowerCase() === (a.name || '').trim().toLowerCase(); })) { toast(t('tpaAlready')); return; }
    // Pinning is an owner override: drop any auto (vote/booking) rejection so it shows again.
    var rk = String(a.name || '').trim().toLowerCase(), rov = rk && getOverrides()[rk];
    if (rov && rov.auto && rov.action === 'skipped') delete getOverrides()[rk];
    tr.pinnedActivities.push({ id: uid('pin'), title: a.name, destination: city || '', preferredDayNumber: '', preferredTimeOfDay: 'flexible', priority: 'preferred', notes: a.why || '' });
    saveTrip(tr); toast(t('tpaPinned')); render();
  }
  function attractionCard(a, city) {
    var c = el('article', 'tc-attr tc-attr--' + (a.tier || 'medium'));
    var top = el('div', 'tc-attr__top');
    top.appendChild(el('span', 'tc-attr__tier tc-attr__tier--' + (a.tier || 'medium'), t('tier_' + (a.tier || 'medium')) || ''));
    top.appendChild(el('strong', 'tc-attr__name', a.name));
    if (a.ticketed) top.appendChild(el('span', 'tc-attr__tix', '🎟 ' + t('ticketed')));
    c.appendChild(top);
    var meta = el('div', 'tc-attr__meta');
    if (a.category) meta.appendChild(chip('', catAttrIcon(a.category) + ' ' + String(a.category).replace(/_/g, ' ')));
    if (a.ageFit) meta.appendChild(chip('', t('fit_' + a.ageFit) || a.ageFit));
    if (a.walkingLevel) meta.appendChild(chip('tc-chip--walk', t('walk_' + a.walkingLevel) || a.walkingLevel));
    if (meta.children.length) c.appendChild(meta);
    if (a.why) { var w = el('p', 'tc-attr__why'); w.appendChild(el('span', 'tc-attr__why-k', '💡 ')); w.appendChild(doc.createTextNode(a.why)); c.appendChild(w); }
    var acts = el('div', 'tc-attr__acts');
    acts.appendChild(linkBtn('🔎 ' + t('mapG'), MapLinkProvider.google(a.name, city)));
    if (canEditPlan()) acts.appendChild(pbtn('📌 ' + t('pinToTrip'), 'tc-pbtn--accent', function () { pinAttraction(a, city); }));
    c.appendChild(acts);
    var _lma = learnMoreSection(a, 'attraction', city); if (_lma) c.appendChild(_lma); // "Learn more"
    if (!state.readonly && a.name) c.appendChild(voteRow({ name: a.name }));
    return c;
  }
  function topAttractionsPanel(plan) {
    var tr = state.trip;
    var dests = (tr.attractions && tr.attractions.length) ? tr.attractions : [];
    if (!dests.length) { return isResearching('attractions') ? researchBanner('researchingAttractions') : null; }
    var box = el('div', 'tc-topattr');
    var head = el('div', 'tc-topattr__head');
    head.appendChild(el('strong', 'tc-topattr__t', '🎯 ' + t('topAttractionsTitle')));
    var gp = tr.groupProfile || analyzeGroupProfile(tr.families, tr.budget, tr.tripStyle);
    var gl = groupProfileLabel(gp); if (gl) head.appendChild(el('span', 'tc-topattr__grp', gl));
    box.appendChild(head);
    box.appendChild(el('p', 'tc-topattr__sub', t('topAttractionsSub')));
    var multi = planDestinations(plan).length > 1, rej = rejectedNameSet(tr); // hide group-rejected attractions
    dests.forEach(function (d) {
      var atts = (d.attractions || []).filter(function (a) { return a && a.name && !rej[(a.name || '').trim().toLowerCase()]; });
      if (!atts.length) return;
      if (multi && d.city) box.appendChild(el('div', 'tc-topattr__city', '📍 ' + d.city));
      consensusSort(atts, function (a) { return a.name; }).slice(0, 6).forEach(function (a) { box.appendChild(attractionCard(a, d.city)); });
    });
    box.appendChild(el('p', 'tc-unverified', t('unverified')));
    return box;
  }
  // ── Tour Discovery: "Tours & unique experiences" per destination (voteable; DLC tour inquiry) ──
  function tourIcon(ty) { return ({ harbor_cruise: '⛴', whale_watching: '🐋', hop_on_hop_off: '🚌', food_tour: '🍴', walking_tour: '🚶', bike_tour: '🚲', kayak: '🛶', boat: '🚤', amphibious: '🦆', brewery: '🍺', cultural: '🏛', adventure: '🧗', nature: '🌲', seasonal: '🎟' })[ty] || '🎫'; }
  function tourCard(to, city) {
    var c = el('article', 'tc-tour');
    var head = el('div', 'tc-tour__head');
    head.appendChild(el('span', 'tc-tour__type', tourIcon(to.type) + ' ' + (t('tour_' + to.type) || String(to.type || '').replace(/_/g, ' '))));
    head.appendChild(el('strong', 'tc-tour__name', to.name));
    c.appendChild(head);
    var meta = el('div', 'tc-tour__meta');
    if (to.duration) meta.appendChild(chip('', '⏱ ' + to.duration));
    if (to.familySuitability) meta.appendChild(chip('', t('fit_' + to.familySuitability) || to.familySuitability));
    if (to.priceRange) meta.appendChild(chip('tc-chip--cost', '💵 ' + to.priceRange));
    if (to.whoBenefits) meta.appendChild(chip('', '👥 ' + to.whoBenefits));
    if (meta.children.length) c.appendChild(meta);
    if (to.bookingNote) c.appendChild(el('p', 'tc-tour__note', 'ℹ️ ' + to.bookingNote));
    if (to.why) { var w = el('p', 'tc-tour__why'); w.appendChild(el('span', 'tc-attr__why-k', '💡 ')); w.appendChild(doc.createTextNode(to.why)); c.appendChild(w); }
    var acts = el('div', 'tc-tour__acts');
    acts.appendChild(linkBtn('🔎 ' + t('tpSearchBook'), gsearch((to.name || '') + ' ' + (city || '') + ' tour tickets'), 'tc-pbtn--accent'));
    acts.appendChild(linkBtn('🗺 ' + t('mapG'), MapLinkProvider.google(to.name, city)));
    if (canEditPlan()) {
      acts.appendChild(pbtn('📌 ' + t('pinToTrip'), '', function () { pinAttraction({ name: to.name, why: to.why }, city); }));
      acts.appendChild(pbtn('🚐 ' + t('tourRequestDlc'), '', function () { requestDlcInquiry({ kind: 'tour', label: to.name + (city ? (' (' + city + ')') : ''), dropoff: city }); }));
    }
    c.appendChild(acts);
    var _lmt = learnMoreSection(to, 'tour', city); if (_lmt) c.appendChild(_lmt); // "Learn more"
    if (!state.readonly && to.name) c.appendChild(voteRow({ name: to.name }));
    return c;
  }
  function toursPanel(plan) {
    var tr = state.trip;
    var dests = (tr.tours && tr.tours.length) ? tr.tours : [];
    if (!dests.length) { return isResearching('tours') ? researchBanner('researchingTours') : null; }
    var rej = rejectedNameSet(tr), multi = planDestinations(plan).length > 1;
    var box = el('div', 'tc-tours');
    box.appendChild(el('strong', 'tc-tours__t', '🎫 ' + t('toursTitle')));
    box.appendChild(el('p', 'tc-tours__sub', t('toursSub')));
    dests.forEach(function (d) {
      var list = (d.tours || []).filter(function (x) { return x && x.name && !rej[(x.name || '').trim().toLowerCase()]; });
      if (!list.length) return;
      if (multi && d.city) box.appendChild(el('div', 'tc-topattr__city', '📍 ' + d.city));
      var vn = voteSortNote(list, function (x) { return x.name; }); if (vn) box.appendChild(vn);
      consensusSort(list, function (x) { return x.name; }).forEach(function (x) { box.appendChild(tourCard(x, d.city)); });
    });
    box.appendChild(el('p', 'tc-unverified', t('unverified')));
    return box;
  }
  // ── Experience Optimizer: "Improve this trip with AI" (goal buttons + suggestions) ──
  function impCatIcon(c) { return ({ activity: '🎯', food: '🍽', stopover: '🛣', timing: '🕒', backup: '☂', cheaper: '💲', exciting: '🤩', low_energy: '😌', discovery: '💎' })[c] || '✨'; }
  function runImprove(tr, goals) {
    var list = Array.isArray(goals) ? goals.slice() : (goals ? [goals] : []);
    if (!list.length) return;
    state._improve = { goals: list, loading: true, suggestions: [], summary: '' }; render();
    improveTrip(tr, list).then(function (res) { state._improve = { goals: (res.goals && res.goals.length) ? res.goals : list, loading: false, suggestions: res.suggestions || [], summary: res.summary || '' }; render(); }).catch(function () { state._improve = { goals: list, loading: false, suggestions: [], summary: '' }; render(); });
  }
  function improveSelectedGoals() { return Array.isArray(state._improveSel) ? state._improveSel : []; }
  function toggleImproveGoal(g) { var sel = improveSelectedGoals().slice(), i = sel.indexOf(g); if (i >= 0) sel.splice(i, 1); else sel.push(g); state._improveSel = sel; render(); }
  function improveCard(sg) {
    var c = el('article', 'tc-impcard');
    var top = el('div', 'tc-impcard__top');
    top.appendChild(el('span', 'tc-impcard__cat', impCatIcon(sg.category) + ' ' + (t('impcat_' + sg.category) || sg.category)));
    if (sg.day) top.appendChild(el('span', 'tc-impcard__day', t('day') + ' ' + sg.day));
    c.appendChild(top);
    c.appendChild(el('strong', 'tc-impcard__title', sg.title));
    if (sg.detail) c.appendChild(el('p', 'tc-impcard__detail', sg.detail));
    if (sg.why) { var w = el('p', 'tc-impcard__why'); w.appendChild(el('span', 'tc-attr__why-k', '💡 ')); w.appendChild(doc.createTextNode(sg.why)); c.appendChild(w); }
    var acts = el('div', 'tc-impcard__acts');
    if (sg.place) {
      acts.appendChild(linkBtn('🔎 ' + t('mapG'), MapLinkProvider.google(sg.place, sg.city || '')));
      if (canEditPlan()) acts.appendChild(pbtn('📌 ' + t('pinToTrip'), 'tc-pbtn--accent', function () { pinAttraction({ name: sg.place, why: sg.title }, sg.city || ''); }));
    }
    if (sg.ticketed) acts.appendChild(el('span', 'tc-impcard__tix', '🎟 ' + t('ticketed')));
    if (acts.children.length) c.appendChild(acts);
    return c;
  }
  function renderImprovePanel(plan) {
    var tr = state.trip;
    if (tr._demo || !canEditPlan()) return null; // owner/organizer only
    var box = el('details', 'tc-improve');
    // Keep the panel open across re-renders (toggling a chip re-renders the whole app).
    if (state._improveOpen) box.open = true;
    box.addEventListener('toggle', function () { state._improveOpen = !!box.open; });
    box.appendChild(el('summary', 'tc-improve__sum', '✨ ' + t('improveTitle')));
    var body = el('div', 'tc-improve__body');
    body.appendChild(el('p', 'tc-hint', t('improveSub')));
    // Full auto-rebuild (regenerates the whole trip from the group's votes) — always available.
    var rebuildRow = el('div', 'tc-improve__rebuild');
    rebuildRow.appendChild(pbtn('🔄 ' + t('optimizeTrip'), 'tc-cta', function () { optimizeRebuild(tr); }));
    rebuildRow.appendChild(el('span', 'tc-hint', t('optimizeRebuildHint')));
    body.appendChild(rebuildRow);
    // Multi-select goal CHIPS — toggle on/off; several can be active at once.
    var sel = improveSelectedGoals();
    var btns = el('div', 'tc-improve__btns');
    [['general', 'impGeneral'], ['kids_fun', 'impKidsFun'], ['food_focused', 'impFoodFocused'], ['lower_cost', 'impLowerCost'], ['relaxing', 'impRelaxing'], ['scenic', 'impScenic'], ['theme_park', 'impThemePark'], ['discoveries', 'impDiscoveries'], ['senior_friendly', 'impSeniorFriendly'], ['rainy_backup', 'impRainyBackup']].forEach(function (g) {
      var on = sel.indexOf(g[0]) >= 0;
      var ch = pbtn((on ? '✓ ' : '') + t(g[1]), 'tc-pbtn--ghost tc-impchip' + (on ? ' tc-pbtn--on' : ''), function () { toggleImproveGoal(g[0]); });
      ch.setAttribute('aria-pressed', on ? 'true' : 'false');
      btns.appendChild(ch);
    });
    body.appendChild(btns);
    // Selected count + Run + Clear all.
    var bar = el('div', 'tc-improve__bar');
    bar.appendChild(el('span', 'tc-improve__count', t('impSelected').replace('{n}', String(sel.length))));
    var run = pbtn('✨ ' + t('impRun'), 'tc-cta tc-improve__run', function () { if (improveSelectedGoals().length) runImprove(tr, improveSelectedGoals()); });
    if (!sel.length) run.disabled = true;
    bar.appendChild(run);
    if (sel.length) bar.appendChild(pbtn(t('impClear'), 'tc-pbtn--ghost', function () { state._improveSel = []; render(); }));
    body.appendChild(bar);
    var imp = state._improve;
    if (imp && imp.loading) body.appendChild(researchBanner('improveWorking'));
    else if (imp && imp.suggestions && imp.suggestions.length) {
      if (imp.summary) body.appendChild(el('p', 'tc-improve__summary', '💡 ' + imp.summary));
      imp.suggestions.forEach(function (sg) { body.appendChild(improveCard(sg)); });
      body.appendChild(el('p', 'tc-unverified', t('unverified')));
    } else if (imp && !imp.loading) { body.appendChild(el('p', 'tc-hint', t('improveNone'))); }
    box.appendChild(body);
    return box;
  }
  function renderItinerary(plan) {
    // Migrate auto-rejections from existing votes/bookings ONCE per trip load (idempotent).
    if (state.trip && !state.trip._demo && _rejReconciledFor !== state.trip.id) { _rejReconciledFor = state.trip.id; reconcileAutoRejections(state.trip); }
    var wrap = el('div', 'tc-itin');
    // ✨ Auto-rebuild nudge — when the group's votes changed since the last optimize.
    if (canEditPlan() && !state.trip._demo && votesChangedSinceOptimize(state.trip)) wrap.appendChild(optimizeNudge());
    if (!state.trip._demo) { var cs = costSummaryStrip(state.trip); if (cs) wrap.appendChild(cs); } // cost estimate visible from itinerary
    var lh = liveHighlightsBlock(plan); if (lh) wrap.appendChild(lh);
    var tap = topAttractionsPanel(plan); if (tap) wrap.appendChild(tap);
    var tpn = toursPanel(plan); if (tpn) wrap.appendChild(tpn);
    var imp2 = renderImprovePanel(plan); if (imp2) wrap.appendChild(imp2);
    var ro = routeOverviewStrip(plan); if (ro) wrap.appendChild(ro);
    var days = plan.days || [], multi = planDestinations(plan).length > 1;
    var daytabs = el('div', 'tc-daytabs');
    days.forEach(function (d, i) {
      var isTravel = !!d.isTravelDay;
      var b = el('button', 'tc-daytab' + (i === state.activeDay ? ' tc-daytab--on' : '') + (isTravel ? ' tc-daytab--travel' : '')); b.type = 'button';
      var city = destCityName(plan, d.destinationIndex || 0);
      b.appendChild(el('strong', null, (isTravel ? '🚗 ' : '') + t('day') + ' ' + (i + 1)));
      b.appendChild(el('span', null, isTravel ? t('travelDay') : (multi && city ? city : (d.title || ''))));
      b.addEventListener('click', function () { state.activeDay = i; render(); });
      daytabs.appendChild(b);
    });
    wrap.appendChild(daytabs);
    var day = days[state.activeDay]; if (!day) { wrap.appendChild(el('p', 'tc-empty', '—')); return wrap; }
    var dh = el('div', 'tc-dayhead');
    var di = day.destinationIndex || 0;
    var city2 = destCityName(plan, di);
    var tdest = (state.trip.destinations || [])[di] || null;
    if (multi && city2) {
      var destLine = el('div', 'tc-dayhead__dest');
      destLine.appendChild(el('span', null, '📍 ' + city2));
      if (tdest && tdest.role && tdest.role !== 'main_destination') destLine.appendChild(el('span', 'tc-roletag tc-roletag--' + tdest.role, t('dr_' + tdest.role)));
      if (tdest && tdest.priority === 'optional') destLine.appendChild(el('span', 'tc-roletag tc-roletag--opt', t('optionalBadge')));
      dh.appendChild(destLine);
    }
    dh.appendChild(el('h3', 'tc-dayhead__t', day.title || (t('day') + ' ' + (state.activeDay + 1))));
    var dtb = dayTypeBadge(day.dayType || (day.isReturnDay ? 'return_day' : '')); if (dtb) dh.appendChild(dtb);
    if (day.summary) dh.appendChild(el('p', 'tc-dayhead__s', day.summary));
    // Owner/organizer: per-leg controls (edit the destination's role; regenerate just this leg).
    if (multi && !state.readonly && !state.trip._demo && canApprove()) {
      var legCtl = el('div', 'tc-dayhead__legctl');
      var ed = el('button', 'tc-pbtn', '✏ ' + t('editDestination')); ed.type = 'button';
      ed.addEventListener('click', function () { state.screen = 'create'; render(); });
      legCtl.appendChild(ed);
      var rg = el('button', 'tc-pbtn tc-pbtn--accent', '↻ ' + t('regenLeg')); rg.type = 'button';
      rg.addEventListener('click', function () { regenerateLeg(di); });
      legCtl.appendChild(rg);
      dh.appendChild(legCtl);
    }
    var dm = el('div', 'tc-dayhead__meta');
    if (day.estimatedWalkingLevel) dm.appendChild(chip('', '🚶 ' + day.estimatedWalkingLevel));
    // Return day: show the VERIFIED drive-home distance/time (Google Maps), never AI's.
    if (day.isReturnDay) {
      var homeCity = (state.trip.departureCity || '').trim();
      var hv = homeCity ? findVerifiedLeg(plan, destCityName(plan, day.destinationIndex || 0) || '', homeCity) : null;
      if (hv && (hv.distanceText || hv.durationText)) {
        dm.appendChild(chip('tc-chip--route', '🚗 ' + t('driveHome') + ': ' + [hv.distanceText, hv.durationText].filter(Boolean).join(' · ')));
        if (hv.mapLink) { var hb = el('a', 'tc-chip tc-chip--route', '🗺 ' + t('route')); hb.href = hv.mapLink; hb.target = '_blank'; hb.rel = 'noopener'; dm.appendChild(hb); }
        var ht = routeSourceTag(hv.source); if (ht) dm.appendChild(ht);
      }
    }
    if (!day.isTravelDay) {
      var allPlaces = []; (day.sections || []).forEach(function (sec) { (sec.places || []).forEach(function (p) { allPlaces.push(p); }); });
      var routeUrl = MapLinkProvider.dayRoute(allPlaces);
      if (routeUrl) { var rb = el('a', 'tc-chip tc-chip--route', '🗺 ' + t('route')); rb.href = routeUrl; rb.target = '_blank'; rb.rel = 'noopener'; dm.appendChild(rb); }
    }
    dh.appendChild(dm); wrap.appendChild(dh);
    if (day.isTravelDay) {
      wrap.appendChild(renderTravelDay(day, plan));
      var rpT = routeOpportunitiesPanel(day, plan, state.activeDay); if (rpT) wrap.appendChild(rpT);
      var altT = dayAlternativesBlock(day); if (altT) wrap.appendChild(altT);
      // Pure transfer/return day → done. A MIXED day (also has activities) falls through to render its lanes below.
      if (!(day.sections && day.sections.length)) return wrap;
    }
    var di2 = state.activeDay;
    if (state._regenDay === di2) wrap.appendChild(researchBanner('regenDayWorking'));
    // Replan-after-move options appear once the user has changed this day.
    if (canEditPlan() && state._replanDay === di2) wrap.appendChild(replanBanner(di2));
    var view = (buildDayView(plan)[di2]) || { lanes: [] };
    if (!view.lanes.length) {
      wrap.appendChild(el('p', 'tc-empty tc-unverified', (day._placeholder || day._needsDetail) ? t('dayOpen') : t('legPending')));
      if (canEditPlan()) wrap.appendChild(dayActionsBar(di2));
      return wrap;
    }
    view.lanes.forEach(function (lane) {
      var sb = el('div', 'tc-section'); sb.setAttribute('data-slot', lane.slot); sb.setAttribute('data-day', String(di2));
      var sh = el('div', 'tc-section__head');
      sh.appendChild(el('span', 'tc-section__dot', ''));
      if (lane.startTime || lane.endTime) sh.appendChild(el('span', 'tc-section__time', (lane.startTime || '') + (lane.endTime ? '–' + lane.endTime : '')));
      sh.appendChild(el('strong', 'tc-section__title', lane.title || lane.label));
      sb.appendChild(sh);
      lane.items.forEach(function (it, idx) {
        var ctx = {
          p: it.p, lane: lane, idx: idx, count: lane.items.length, day: di2, slot: lane.slot, order: it.order,
          added: !!it.added, addedRef: it.addedRef, pinned: it.added ? !!(it.addedRef && it.addedRef.pinned) : isPinned(it.p),
          pkey: it.added ? it.addedRef.id : placeKey(it.p),
        };
        sb.appendChild(placeNode(it.p, ctx));
      });
      if (canEditPlan()) enableLaneDrop(sb, di2, lane.slot);
      wrap.appendChild(sb);
    });
    if (canEditPlan()) wrap.appendChild(dayActionsBar(di2));
    var alt = dayAlternativesBlock(day); if (alt) wrap.appendChild(alt);
    // Return / mixed days also get route opportunities (the journey home is flexible too).
    var rpA = routeOpportunitiesPanel(day, plan, di2); if (rpA) wrap.appendChild(rpA);
    return wrap;
  }
  // Day-level age/weather/food alternatives (collapsible). Each value is a short phrase.
  function dayAlternativesBlock(day) {
    var a = day && day.alternatives; if (!a || typeof a !== 'object') return null;
    var rows = [['kidFriendly', '🧒'], ['toddlerLowEnergy', '👶'], ['teenOption', '🧑'], ['seniorLowWalking', '🧓'], ['rainyDay', '🌧'], ['foodBackup', '🍽']].filter(function (r) { return a[r[0]] && String(a[r[0]]).trim(); });
    if (!rows.length) return null;
    var box = el('details', 'tc-alts');
    box.appendChild(el('summary', 'tc-alts__sum', '🔁 ' + t('altTitle')));
    rows.forEach(function (r) {
      var row = el('div', 'tc-alts__row');
      row.appendChild(el('span', 'tc-alts__k', r[1] + ' ' + t('alt_' + r[0])));
      row.appendChild(el('span', 'tc-alts__v', String(a[r[0]])));
      box.appendChild(row);
    });
    return box;
  }

  // ── Travel-Day Route Opportunities — optional discoveries to insert ALONG a leg.
  //    Turns a plain A→B drive into a customizable day. Honors AI memory (rejected places
  //    never return; pinned get priority) and supports Add to day / Skip / Pin / Vote. ──
  function routeOpsForDay(day, plan) {
    var ops = (state.trip && state.trip.routeOps) || []; if (!ops.length || !day) return null;
    var arriving = (day.travelLeg && day.travelLeg.toCity) ? day.travelLeg.toCity : (day.isReturnDay ? (state.trip.departureCity || '') : (destCityName(plan, day.destinationIndex || 0) || ''));
    var ak = String(arriving).trim().toLowerCase();
    var from = (day.travelLeg && day.travelLeg.fromCity) ? String(day.travelLeg.fromCity).trim().toLowerCase() : '';
    return ops.filter(function (l) { return from && String(l.toCity).trim().toLowerCase() === ak && String(l.fromCity).trim().toLowerCase() === from; })[0]
        || ops.filter(function (l) { return String(l.toCity).trim().toLowerCase() === ak; })[0] || null;
  }
  function routeOpIcon(c) { return ({ food: '🍽', beach: '🏖', scenic: '🌄', shopping: '🛍', cultural: '🏛', museum: '🏛', theme_park: '🎢', aquarium: '🐠', nature: '🏞', historic: '🏰', photo: '📸', hidden_gem: '💎' })[c] || '📍'; }
  var ROUTE_FILTERS = [['all', 'roAll'], ['food', 'roFood'], ['beach_scenic', 'roBeachScenic'], ['hidden_gem', 'roHidden'], ['kid', 'roKid'], ['low', 'roLowEnergy'], ['indoor', 'roRainy']];
  function routeOpMatchesFilter(o, f) {
    if (f === 'all') return true;
    if (f === 'food') return o.category === 'food' || o.insertionType === 'food_stop';
    if (f === 'beach_scenic') return ['beach', 'scenic', 'photo', 'nature'].indexOf(o.category) >= 0;
    if (f === 'hidden_gem') return o.category === 'hidden_gem';
    if (f === 'kid') return /kid|all_ages/.test(o.whoBenefits || '') || o.insertionType === 'kid_stop';
    if (f === 'low') return o.energyLevel === 'low';
    if (f === 'indoor') return o.weatherSuitability === 'indoor';
    return true;
  }
  function addRouteOpToDay(op, dayIdx) {
    addedPlaces().push({ id: uid('add'), name: op.place, category: op.category || 'activity', addedKind: op.insertionType || 'activity', note: op.whyRecommended || '', day: dayIdx, slot: 'afternoon', order: 9000, dataSource: 'user_entered', createdBy: curUid() || '', createdAt: new Date().toISOString() });
    saveTrip(state.trip); toast(t('routeOpAdded')); render();
  }
  function routeOpCard(op, leg, dayIdx) {
    var c = el('article', 'tc-rop tc-rop--' + (op.priority || 'optional'));
    var head = el('div', 'tc-rop__head');
    head.appendChild(el('span', 'tc-rop__cat', routeOpIcon(op.category) + ' ' + (t('roins_' + op.insertionType) || op.insertionType)));
    head.appendChild(el('strong', 'tc-rop__name', op.place));
    if (op.priority === 'must_see') head.appendChild(el('span', 'tc-rop__prio', '★ ' + t('roMustSee')));
    c.appendChild(head);
    var meta = el('div', 'tc-rop__meta');
    if (op.detourMinutes !== '' && op.detourMinutes != null) meta.appendChild(chip('', '↩ +' + op.detourMinutes + ' ' + t('roMin')));
    if (op.visitDuration) meta.appendChild(chip('', '⏱ ' + op.visitDuration));
    if (op.costEstimate) meta.appendChild(chip('', '💵 ' + op.costEstimate));
    if (op.energyLevel) meta.appendChild(chip('', '⚡ ' + (t('roEnergy_' + op.energyLevel) || op.energyLevel)));
    if (op.weatherSuitability && op.weatherSuitability !== 'any') meta.appendChild(chip('', '☁ ' + (t('roWeather_' + op.weatherSuitability) || op.weatherSuitability)));
    if (op.whoBenefits) meta.appendChild(chip('', '👥 ' + op.whoBenefits));
    if (meta.children.length) c.appendChild(meta);
    if (op.whyRecommended) { var w = el('p', 'tc-rop__why'); w.appendChild(el('span', 'tc-attr__why-k', '💡 ')); w.appendChild(doc.createTextNode(op.whyRecommended)); c.appendChild(w); }
    var acts = el('div', 'tc-rop__acts');
    acts.appendChild(linkBtn('🗺 ' + t('mapG'), MapLinkProvider.google(op.mapQuery || op.place, (leg && leg.toCity) || '')));
    if (canEditPlan()) {
      acts.appendChild(pbtn('＋ ' + t('roAdd'), 'tc-pbtn--accent', function () { addRouteOpToDay(op, dayIdx); }));
      acts.appendChild(pbtn('📌 ' + t('pinToTrip'), '', function () { pinAttraction({ name: op.place, why: op.whyRecommended }, (leg && leg.toCity) || ''); }));
      acts.appendChild(pbtn('⤫ ' + t('skipPlace'), '', function () { setPlaceOverride({ name: op.place }, 'skipped', null); }));
    }
    c.appendChild(acts);
    var _lmo = learnMoreSection({ name: op.place, address: op.mapQuery || '', category: op.category }, mediaTypeForPlace({ category: op.category }), ''); if (_lmo) c.appendChild(_lmo); // "Learn more"
    if (!state.readonly) c.appendChild(voteRow({ name: op.place }));
    return c;
  }
  function routeOpportunitiesPanel(day, plan, dayIdx) {
    var tr = state.trip;
    var leg = routeOpsForDay(day, plan);
    if (!leg || !leg.opportunities || !leg.opportunities.length) {
      if (isResearching('routeOps')) { var b = el('div', 'tc-rop-wrap'); b.appendChild(el('strong', 'tc-rop-wrap__t', '🧭 ' + t('routeOpsTitle'))); b.appendChild(researchBanner('researchingRouteOps')); return b; }
      // Owner can trigger discovery on demand (e.g. an older trip generated before this agent).
      if (canEditPlan() && (day.isTravelDay || day.isReturnDay) && !tr._demo) {
        var box0 = el('div', 'tc-rop-wrap'); box0.appendChild(el('strong', 'tc-rop-wrap__t', '🧭 ' + t('routeOpsTitle')));
        box0.appendChild(el('p', 'tc-hint', t('routeOpsSub')));
        box0.appendChild(pbtn('🔎 ' + t('findRouteOps'), 'tc-cta', function () { state._cResearch = state._cResearch || {}; state._cResearch.routeOps = true; render(); researchRouteOps(tr).then(function (res) { state._cResearch.routeOps = false; if (res.legs && res.legs.length) { tr.routeOps = res.legs; saveTrip(tr); } render(); }).catch(function () { state._cResearch.routeOps = false; render(); }); }));
        return box0;
      }
      return null;
    }
    var rej = rejectedNameSet(tr);
    var ops = leg.opportunities.filter(function (o) { return o && o.place && !rej[(o.place || '').trim().toLowerCase()]; });
    if (!ops.length) return null;
    var box = el('div', 'tc-rop-wrap');
    box.appendChild(el('strong', 'tc-rop-wrap__t', '🧭 ' + t('routeOpsTitle')));
    box.appendChild(el('p', 'tc-hint', t('routeOpsSub')));
    // Stops the user already inserted into THIS day (travel days bypass buildDayView).
    var mine = addedPlaces().filter(function (ap) { return ap.day === dayIdx; });
    if (mine.length) {
      var added = el('div', 'tc-rop-added');
      added.appendChild(el('strong', 'tc-rop-added__t', '✓ ' + t('roYourStops')));
      mine.forEach(function (ap) {
        var row = el('div', 'tc-rop-added__row');
        row.appendChild(el('span', 'tc-rop-added__name', '📍 ' + (ap.name || '')));
        if (canEditPlan()) row.appendChild(pbtn('✕', '', function () { var arr = addedPlaces(), i = arr.indexOf(ap); if (i >= 0) arr.splice(i, 1); saveTrip(tr); render(); }));
        added.appendChild(row);
      });
      box.appendChild(added);
    }
    // Filter chips → Food Discoveries / Beach & Scenic / Hidden Gems / Kid / Low-energy / Rainy-day.
    var f = state._routeOpsFilter || 'all';
    var chips = el('div', 'tc-rop-filters');
    ROUTE_FILTERS.forEach(function (pair) {
      var on = f === pair[0];
      chips.appendChild(pbtn(t(pair[1]), 'tc-pbtn--ghost tc-impchip' + (on ? ' tc-pbtn--on' : ''), function () { state._routeOpsFilter = pair[0]; render(); }));
    });
    box.appendChild(chips);
    var shown = consensusSort(ops.filter(function (o) { return routeOpMatchesFilter(o, f); }), function (o) { return o.place; });
    if (!shown.length) box.appendChild(el('p', 'tc-hint', t('roNoneFilter')));
    shown.forEach(function (o) { box.appendChild(routeOpCard(o, leg, dayIdx)); });
    box.appendChild(el('p', 'tc-unverified', t('unverified')));
    return box;
  }
  function scoreChip(label, score) { var lv = score >= 4 ? 'hi' : (score >= 2 ? 'mid' : 'lo'); return el('span', 'tc-chip tc-chip--score tc-chip--' + lv, label + ' ' + score + '/5'); }
  // ── Skip / replace overrides (Issue #9): persist a TripPlaceOverride keyed by the
  //    place NAME so a skip survives refresh AND regenerate (a regenerated "Pho 79" is
  //    matched by name and stays skipped). Stored on trip.placeOverrides, saved to Firestore. ──
  function placeKey(p) { return String((p && p.name) || '').trim().toLowerCase(); }
  function getOverrides() { var tr = state.trip; if (tr) tr.placeOverrides = tr.placeOverrides || {}; return (tr && tr.placeOverrides) || {}; }
  function getOverride(p) { var k = placeKey(p); return k ? (getOverrides()[k] || null) : null; }
  function setPlaceOverride(p, action, replacement) {
    var k = placeKey(p); if (!k) return;
    getOverrides()[k] = { name: p.name || '', action: action, replacement: replacement || null, createdBy: curUid() || '', createdAt: new Date().toISOString() };
    state._altOpen = null; saveTrip(state.trip); render();
  }
  function clearPlaceOverride(p) { var k = placeKey(p); if (k) delete getOverrides()[k]; state._altOpen = null; saveTrip(state.trip); render(); }
  function canEditPlan() { return !!(state.trip && !state.trip._demo && !state.readonly && (isOwnerOfTrip() || canApprove())); }
  function skippedNames(tr) { var ov = (tr && tr.placeOverrides) || {}; return Object.keys(ov).filter(function (k) { return ov[k] && (ov[k].action === 'skipped' || ov[k].action === 'deleted'); }).map(function (k) { return ov[k].name; }).filter(Boolean); }
  function altToPlace(a, original) { return { id: uid('alt'), name: a.name, category: a.category || (original && original.category) || '', cuisine: a.cuisine || '', address: a.address || '', whySelected: a.why || '', dataSource: a.dataSource || 'ai_researched_pending_verification' }; }

  // ════════════════════════════════════════════════════════════════════════
  //  GROUP-VOTE REJECTION (Refinement bug: regeneration must respect votes)
  //  A place is REJECTED — never re-suggested by regen / destination intelligence /
  //  booking checklist — when the group votes it down or a family marks its booking
  //  "Skipped". Rejections are folded into the SAME name-keyed placeOverride system
  //  (action:'skipped', auto:true, reason:…) so they survive refresh AND regenerate,
  //  exactly like a manual skip. TripRejection reasons: all_family_skip | majority_skip
  //  | not_needed (booking) | owner_deleted | owner_replaced (manual overrides). Nothing
  //  here is hardcoded to any city/place. An owner can always Undo or pin to override.
  // ════════════════════════════════════════════════════════════════════════
  // Vote verdict for one place's per-family vote map. Rejected when "skip" is a strict
  // majority of the families that voted (covers "all families skip" and "most skip").
  function voteVerdict(v) {
    if (!v || typeof v !== 'object') return { rejected: false, reason: '' };
    var skips = 0, total = 0;
    Object.keys(v).forEach(function (fid) { var s = v[fid]; if (s === 'like' || s === 'maybe' || s === 'skip') { total++; if (s === 'skip') skips++; } });
    if (total < 1 || skips * 2 <= total) return { rejected: false, reason: '' };
    return { rejected: true, reason: (skips === total ? 'all_family_skip' : 'majority_skip') };
  }
  // Owner-override escape: a pinned / user-added place is NEVER auto-rejected by votes.
  function isPinnedName(name) {
    var k = String(name || '').trim().toLowerCase(); if (!k) return false;
    var tr = state.trip || {};
    if ((tr.pinnedActivities || []).some(function (p) { return (p.title || '').trim().toLowerCase() === k; })) return true;
    if (addedPlaces().some(function (ap) { return (ap.name || '').trim().toLowerCase() === k && ap.pinned; })) return true;
    var ov = getOverrides()[k]; return !!(ov && ov.pinned);
  }
  // Create / clear an AUTO rejection for one place from its votes + booking status.
  // Never clobbers a MANUAL skip/delete/replace, never touches a "kept" (owner-overruled)
  // place, never auto-rejects a pinned place. Returns true if the override map changed.
  function recomputeAutoReject(p) {
    if (!p) return false;
    var k = placeKey(p); if (!k) return false;
    var ov = getOverrides()[k];
    if (ov && !ov.auto && (ov.action === 'skipped' || ov.action === 'deleted' || ov.action === 'replaced')) return false; // manual decision wins
    if (ov && ov.kept) return false; // owner explicitly kept it despite the group's votes
    var pid = p.id || p.name;
    var vr = voteVerdict((state.trip.votes || {})[pid]);
    var bk = (state.trip.booking || {})[pid];
    var reject = (vr.rejected || bk === 'skipped') && !isPinnedName(p.name);
    if (reject) {
      var reason = vr.rejected ? vr.reason : 'not_needed';
      if (ov && ov.auto && ov.action === 'skipped' && ov.reason === reason) return false; // already rejected for this reason
      getOverrides()[k] = { name: p.name || '', action: 'skipped', reason: reason, auto: true, createdBy: curUid() || '', createdAt: (ov && ov.createdAt) || new Date().toISOString(), updatedAt: new Date().toISOString() };
      return true;
    }
    if (ov && ov.auto && ov.action === 'skipped') { delete getOverrides()[k]; return true; } // votes/booking no longer reject → auto-undo
    return false;
  }
  // One-time-per-load scan that reconciles auto-rejections from existing votes/bookings
  // (migrates votes cast before this fix / synced from another member). Idempotent; saves
  // only when something actually changed so it can't loop the renderer.
  var _rejReconciledFor = null;
  function reconcileAutoRejections(tr) {
    tr = tr || state.trip; if (!tr || !tr.plan) return false;
    var changed = false;
    (tr.plan.days || []).forEach(function (d) { if (!d) return; (d.sections || []).forEach(function (sec) { (sec.places || []).forEach(function (p) { if (recomputeAutoReject(p)) changed = true; }); }); });
    if (changed) saveTrip(tr);
    return changed;
  }
  // "Undo skip" for an AUTO (vote/booking) rejection: keep it despite the group's votes so
  // the reconcile pass won't re-hide it. (A manual skip uses clearPlaceOverride instead.)
  function unrejectPlace(p) {
    var k = placeKey(p); if (!k) return;
    var ov = getOverrides()[k];
    getOverrides()[k] = { name: (ov && ov.name) || p.name || '', action: null, kept: true, auto: true, createdBy: curUid() || '', createdAt: (ov && ov.createdAt) || new Date().toISOString(), updatedAt: new Date().toISOString() };
    state._altOpen = null; saveTrip(state.trip); render();
  }
  // All rejected place NAMES (manual skip/delete/replace-original + auto vote/booking skips)
  // → fed to the AI as avoidPlaces/skippedPlaces so nothing rejected is ever re-suggested.
  function rejectedNames(tr) {
    var ov = (tr && tr.placeOverrides) || {};
    return Object.keys(ov).filter(function (k) { var o = ov[k]; return o && (o.action === 'skipped' || o.action === 'deleted' || o.action === 'replaced'); }).map(function (k) { return ov[k].name || k; }).filter(Boolean);
  }
  // Lowercase membership set for filtering the booking checklist / attraction display.
  function rejectedNameSet(tr) { var s = {}; rejectedNames(tr).forEach(function (n) { s[String(n).trim().toLowerCase()] = 1; }); return s; }

  // ════════════════════════════════════════════════════════════════════════
  //  ITINERARY CONTROL ENGINE (Issue: user must control the itinerary)
  //  TripItineraryOverride model — keyed by place NAME so every change survives
  //  refresh AND regenerate. Actions: moved | reordered | time_slot_changed |
  //  pinned | skipped | deleted | replaced | added. Placement is stored as
  //  toDay / toSlot / order; the render-time view-model reapplies it over the
  //  AI plan. Nothing here is hardcoded to any city, date, attraction or day.
  // ════════════════════════════════════════════════════════════════════════
  function addedPlaces() { var tr = state.trip; if (tr) tr.addedPlaces = tr.addedPlaces || []; return (tr && tr.addedPlaces) || []; }
  function dayTimingMap() { var tr = state.trip; if (tr) tr.dayTiming = tr.dayTiming || {}; return (tr && tr.dayTiming) || {}; }
  function addedToPlace(ap) { return { id: ap.id, name: ap.name, category: ap.category || '', address: ap.address || '', whySelected: ap.note || '', dataSource: 'user_entered', _added: true }; }
  function ensureOverride(p) {
    var k = placeKey(p); if (!k) return null;
    var ov = getOverrides()[k];
    if (!ov) { ov = { name: p.name || '', action: null, createdBy: curUid() || '', createdAt: new Date().toISOString() }; getOverrides()[k] = ov; }
    return ov;
  }
  // Effective placement for a plan place (override wins over natural position).
  function isPinned(p) { var ov = getOverride(p); return !!(ov && ov.pinned); }
  // Build the override-applied view: per day → ordered time-slot lanes of items.
  // Each item = { p, added, addedRef, order }.  Travel days are excluded (rendered separately).
  function buildDayView(plan) {
    var days = (plan && plan.days) || [];
    var view = days.map(function () { return { byslot: {}, laneMeta: {} }; });
    var items = [];
    days.forEach(function (d, di) {
      if (!d) return;
      // Pure transfer/return days have no activity lanes; a MIXED day (a travel day that ALSO carries
      // activities — e.g. San Diego morning + transfer + Orange County food) DOES render its lanes.
      if (d.isTravelDay && !(Array.isArray(d.sections) && d.sections.length)) return;
      var sorted = (d.sections || []).slice().sort(function (a, b) { return TIME_ORDER.indexOf(a.timeOfDay) - TIME_ORDER.indexOf(b.timeOfDay); });
      var ord = 0;
      sorted.forEach(function (sec) {
        var slot = normSlot(sec.timeOfDay);
        var meta = { startTime: sec.startTime || '', endTime: sec.endTime || '', title: sec.title || '', timeOfDay: sec.timeOfDay };
        if (!view[di].laneMeta[slot]) view[di].laneMeta[slot] = meta;
        (sec.places || []).forEach(function (p) { items.push({ p: p, natDay: di, natSlot: slot, natOrder: ord++ }); });
      });
    });
    addedPlaces().forEach(function (ap) {
      items.push({ p: addedToPlace(ap), added: true, addedRef: ap, natDay: ap.day || 0, natSlot: normSlot(ap.slot), natOrder: (ap.order != null ? ap.order : 9000) });
    });
    items.forEach(function (it) {
      var ov = it.added ? null : getOverride(it.p);
      it.day = (ov && ov.toDay != null) ? ov.toDay : it.natDay;
      it.slot = (ov && ov.toSlot) ? normSlot(ov.toSlot) : it.natSlot;
      it.order = (ov && ov.order != null) ? ov.order : it.natOrder;
      if (it.day < 0) it.day = 0; if (it.day > days.length - 1) it.day = Math.max(0, days.length - 1);
      var dm = view[it.day]; if (!dm) return;
      (dm.byslot[it.slot] = dm.byslot[it.slot] || []).push(it);
    });
    return view.map(function (dm, di) {
      var tim = (dayTimingMap()[di]) || {};
      var lanes = TIME_SLOTS.filter(function (s) { return dm.byslot[s] && dm.byslot[s].length; }).map(function (s) {
        var arr = dm.byslot[s].slice().sort(function (a, b) { return a.order - b.order; });
        var meta = dm.laneMeta[s] || {};
        return { slot: s, label: t('ts_' + s), startTime: (tim[s] != null ? tim[s] : (meta.startTime || '')), endTime: (tim[s] != null ? '' : (meta.endTime || '')), title: meta.title || '', items: arr };
      });
      return { lanes: lanes };
    });
  }
  function laneItems(day, slot) {
    var dv = buildDayView(state.trip.plan)[day]; if (!dv) return [];
    var lane = dv.lanes.filter(function (l) { return l.slot === slot; })[0];
    return lane ? lane.items : [];
  }
  function laneMaxOrder(day, slot) { var items = laneItems(day, slot); return items.length ? Math.max.apply(null, items.map(function (it) { return it.order; })) : 0; }
  // Persist a placement change (move / reorder / time-slot). Works for both AI places
  // (override keyed by name) and user-added places (mutate the addedRef directly).
  function setItemPlacement(ctx, patch, action) {
    if (ctx && ctx.added && ctx.addedRef) {
      var ap = ctx.addedRef;
      if (patch.day != null) ap.day = patch.day;
      if (patch.slot != null) ap.slot = patch.slot;
      if (patch.order != null) ap.order = patch.order;
    } else if (ctx && ctx.p) {
      var ov = ensureOverride(ctx.p); if (!ov) return;
      if (ov.action == null || (ov.action !== 'skipped' && ov.action !== 'deleted' && ov.action !== 'replaced')) ov.action = action;
      if (patch.day != null) { ov.fromDay = ctx.day; ov.toDay = patch.day; }
      if (patch.slot != null) { ov.fromSlot = ctx.slot; ov.toSlot = patch.slot; }
      if (patch.order != null) { ov.oldOrder = ctx.order; ov.order = patch.order; ov.newOrder = patch.order; }
      // onDay = the day this placement now lives on, so a per-day Reset/Regenerate can scope
      // exactly to it (a pure reorder/time-slot change carries no toDay otherwise).
      ov.onDay = (patch.day != null ? patch.day : ctx.day);
      ov.updatedAt = new Date().toISOString();
    } else return;
    saveTrip(state.trip);
    // Surface the replan options on the day the user is acting from (their current view).
    state._replanDay = (ctx ? ctx.day : state.activeDay);
    render();
  }
  function moveUpDown(ctx, dir) {
    var items = (ctx.lane && ctx.lane.items) || [], idx = ctx.idx, target = idx + dir;
    if (target < 0 || target >= items.length) return;
    var neighbor = items[target];
    setItemPlacement(ctx, { order: neighbor.order + (dir < 0 ? -0.5 : 0.5) }, 'reordered');
  }
  function moveToDay(ctx, targetDay) {
    if (targetDay === ctx.day) return;
    setItemPlacement(ctx, { day: targetDay, order: laneMaxOrder(targetDay, ctx.slot) + 1 }, 'moved');
  }
  function moveToSlot(ctx, targetSlot) {
    if (targetSlot === ctx.slot) return;
    setItemPlacement(ctx, { slot: targetSlot, order: laneMaxOrder(ctx.day, targetSlot) + 1 }, 'time_slot_changed');
  }
  // Drag/drop drop: place item into (day, slot) at display index dropIdx.
  function dropItem(ctx, targetDay, targetSlot, dropIdx) {
    var items = laneItems(targetDay, targetSlot).filter(function (it) { return it.p !== ctx.p && !(ctx.added && it.added && it.addedRef === ctx.addedRef); });
    var before = items[dropIdx - 1], after = items[dropIdx];
    var order;
    if (!items.length) order = 0;
    else if (!before) order = items[0].order - 1;
    else if (!after) order = before.order + 1;
    else order = (before.order + after.order) / 2;
    var patch = { order: order };
    if (targetDay !== ctx.day) patch.day = targetDay;
    if (targetSlot !== ctx.slot) patch.slot = targetSlot;
    setItemPlacement(ctx, patch, targetDay !== ctx.day ? 'moved' : (targetSlot !== ctx.slot ? 'time_slot_changed' : 'reordered'));
  }
  function togglePin(ctx) {
    if (ctx.added && ctx.addedRef) { ctx.addedRef.pinned = !ctx.addedRef.pinned; saveTrip(state.trip); render(); return; }
    var ov = ensureOverride(ctx.p); if (!ov) return;
    ov.pinned = !ov.pinned; if (ov.action == null) ov.action = 'pinned'; ov.updatedAt = new Date().toISOString();
    saveTrip(state.trip); render();
  }
  function removeAdded(ctx) {
    if (!ctx.added || !ctx.addedRef) return;
    var arr = addedPlaces(), i = arr.indexOf(ctx.addedRef); if (i >= 0) arr.splice(i, 1);
    saveTrip(state.trip); render();
  }
  function addPlaceToDay(day, slot, name, kind) {
    name = (name || '').trim(); if (!name) { toast(t('addOwnPh')); return; }
    addedPlaces().push({ id: uid('add'), name: name, category: kind || 'activity', addedKind: kind || 'activity', day: day, slot: slot, order: laneMaxOrder(day, slot) + 1, dataSource: 'user_entered', createdBy: curUid() || '', createdAt: new Date().toISOString() });
    state._addOpen = null; saveTrip(state.trip); render();
  }
  // Replan-after-move (Issue #6): Keep / Fix timing only / Re-optimize / Reset.
  function fixTimingOnly(dayIdx) {
    var dv = buildDayView(state.trip.plan)[dayIdx]; if (!dv) { state._replanDay = null; render(); return; }
    var tim = dayTimingMap(); tim[dayIdx] = {};
    dv.lanes.forEach(function (lane) { if (SLOT_TIME[lane.slot]) tim[dayIdx][lane.slot] = SLOT_TIME[lane.slot]; });
    state._replanDay = null; saveTrip(state.trip); render();
  }
  // Reset: drop move/reorder/time-slot placements for this day, but KEEP pinned items
  // (never move a pinned item away) and keep skipped/replaced overrides.
  function clearPlacement(o) { delete o.toDay; delete o.toSlot; delete o.order; delete o.fromDay; delete o.fromSlot; delete o.oldOrder; delete o.newOrder; delete o.onDay; }
  // True when this override carries a move/reorder/time-slot placement on the given day.
  function placementOnDay(o, dayIdx) {
    if (!o) return false;
    if (o.action !== 'moved' && o.action !== 'reordered' && o.action !== 'time_slot_changed') return false;
    if (o.onDay != null) return o.onDay === dayIdx;            // precise (set on every change)
    return o.toDay === dayIdx || o.fromDay === dayIdx;          // legacy fallback for older saves
  }
  function resetDayToAI(dayIdx) {
    var ov = getOverrides();
    Object.keys(ov).forEach(function (k) {
      var o = ov[k]; if (!o || o.pinned) return;               // never move a pinned item away
      if (placementOnDay(o, dayIdx)) { clearPlacement(o); if (o.action !== 'pinned') o.action = (o.replacement ? 'replaced' : null); if (!o.replacement && o.action == null) delete ov[k]; }
    });
    state.trip.addedPlaces = addedPlaces().filter(function (ap) { return !(ap.day === dayIdx && !ap.pinned); });
    var tim = dayTimingMap(); delete tim[dayIdx];
    state._replanDay = null; saveTrip(state.trip); render();
  }
  // Re-optimize / Regenerate a single day. keepUserChanges=true pins the user's current
  // cards so the AI re-times AROUND them; false = a fresh AI day (still honoring skips + must-dos).
  function regenerateSingleDay(dayIdx, keepUserChanges) {
    var tr = state.trip, plan = tr.plan; if (!plan || !Array.isArray(plan.days)) return;
    var d = plan.days[dayIdx]; if (!d || d.isTravelDay) return;
    var legFn = mkCallable('generateLegDays', 75000); if (!legFn) { toast(t('genFail')); return; }
    var di = d.destinationIndex || 0;
    var td = (tr.destinations || [])[di] || {}, pdest = (plan.destinations || [])[di] || {};
    var pins = (tr.pinnedActivities || []).slice();
    if (keepUserChanges) {
      var dv = buildDayView(plan)[dayIdx] || { lanes: [] };
      dv.lanes.forEach(function (lane) { lane.items.forEach(function (it) { pins.push({ title: it.p.name, destination: pdest.city || td.city || '', preferredDayNumber: String(dayIdx + 1), preferredTimeOfDay: lane.slot, priority: 'required' }); }); });
    }
    state._regenDay = dayIdx; state._replanDay = null; render();
    legFn({
      trip: { tripStyle: tr.tripStyle, budget: tr.budget, families: tr.families, preferences: tr.preferences, departureCity: tr.departureCity, lastDayFull: !!tr.lastDayFull, finalDayMode: finalDayMode(tr) },
      lang: state.lang,
      leg: { index: di, city: td.city || pdest.city || destNameFromTrip(tr, di), startDate: td.startDate || '', endDate: td.endDate || '', hotelSuggestion: pdest.hotelSuggestion || null, role: td.role || 'main_destination', hotelNeeded: td.hotelNeeded !== false, mealOnly: !!td.mealOnly, suggestFood: td.suggestFood !== false, suggestActivities: td.suggestActivities !== false, hoursToSpend: td.hoursToSpend || '', priority: td.priority || 'required' },
      daySpecs: [{ dayNumber: dayIdx + 1, date: d.date || '', destinationIndex: di, isTravelDay: false, isReturnDay: !!d.isReturnDay, title: d.title || '', theme: d.theme || '', summary: d.summary || '' }],
      liveHighlights: tr.liveHighlights || [], avoidPlaces: rejectedNames(tr), preferredPlaces: preferredNames(tr), pinnedActivities: pins,
    }).then(function (rr) {
      state._regenDay = null;
      var dd = (rr && rr.data) || {};
      var nd = (dd.ok && Array.isArray(dd.days) && dd.days.length) ? dd.days[0] : null;
      if (nd) {
        if (nd.destinationIndex == null) nd.destinationIndex = di;
        nd.isReturnDay = !!d.isReturnDay; if (!nd.date) nd.date = d.date; if (nd.dayType == null) nd.dayType = d.dayType;
        plan.days[dayIdx] = nd;
        // The day is freshly generated: clear placement overrides + added/timing for it so the
        // new AI plan shows cleanly (skipped/replaced overrides by name still apply by design;
        // pinned items are kept so a pinned must-do is never silently dropped on regenerate).
        var ov = getOverrides();
        Object.keys(ov).forEach(function (k) { var o = ov[k]; if (o && !o.pinned && placementOnDay(o, dayIdx)) { clearPlacement(o); if (o.replacement) o.action = 'replaced'; else { o.action = null; delete ov[k]; } } });
        if (!keepUserChanges) { state.trip.addedPlaces = addedPlaces().filter(function (ap) { return ap.day !== dayIdx; }); var tim = dayTimingMap(); delete tim[dayIdx]; }
        saveTrip(tr);
      } else { toast(t('genFail')); }
      render();
    }).catch(function () { state._regenDay = null; toast(t('genFail')); render(); });
  }
  // ════════════════════════════════════════════════════════════════════════════
  // PHASE X — Adaptive AI Travel Agent: Trip Journey Graph (Steps 1-3).
  // DERIVE-ONLY FOUNDATION — ships dark: pure functions exported for the upcoming
  // timeline UI (Step 4). Nothing in the live render/edit flow calls them yet, so
  // there is ZERO behavior change. Backward-compatible (plan.days untouched).
  // ════════════════════════════════════════════════════════════════════════════
  function nodeSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
  function placeNodeId(p, day, slot, order) { return (p && p.id) ? ('n_' + p.id) : ('n_' + day + '_' + (slot || '') + '_' + nodeSlug(p && p.name) + (order != null ? ('_' + order) : '')); }
  function lockedNodeSet(tr) { tr.lockedNodes = tr.lockedNodes || {}; return tr.lockedNodes; }
  function isNodeLocked(tr, id) { return !!lockedNodeSet(tr)[id]; }
  function lockNode(tr, id) { if (!id) return; lockedNodeSet(tr)[id] = 1; saveTrip(tr); }
  function unlockNode(tr, id) { delete lockedNodeSet(tr)[id]; saveTrip(tr); }
  function isPlaceNodeLocked(tr, node) {
    if (isNodeLocked(tr, node.id)) return true;
    var nm = (node.name || '').trim().toLowerCase();
    return (tr.pinnedActivities || []).some(function (pin) { return (pin.title || '').trim().toLowerCase() === nm; });
  }
  function nodeVotes(tr, node) {
    var v = (tr.votes || {});
    if (v[node.id] && typeof v[node.id] === 'object') return v[node.id];
    if (node.name && v[node.name] && typeof v[node.name] === 'object') return v[node.name];
    return {};
  }
  // Step 1 — derive the typed node graph from the EFFECTIVE plan (buildDayView applies overrides/
  // added/skips) + transport legs. Pure/read-only; stable ids; locked + votes resolved per node.
  function buildTripGraph(tr) {
    var plan = (tr && tr.plan) || {}, days = plan.days || [], nodes = [];
    var dv = buildDayView(plan);
    dv.forEach(function (dayView, di) {
      (dayView.lanes || []).forEach(function (lane) {
        (lane.items || []).forEach(function (it) {
          var p = it.p || {};
          var type = (p.category === 'restaurant' || p.category === 'food' || p.cuisine) ? 'meal' : (p.category === 'lodging' ? 'stay' : 'activity');
          var node = { id: placeNodeId(p, di, lane.slot, it.order), type: type, day: di, slot: lane.slot, order: it.order, status: 'planned', name: p.name || '', category: p.category || '', time: lane.startTime || '', source: it.added ? 'user' : 'ai' };
          node.locked = isPlaceNodeLocked(tr, node);
          node.votes = nodeVotes(tr, node);
          nodes.push(node);
        });
      });
    });
    (tr.transport || []).forEach(function (lg, li) {
      var id = 'tr_' + li;
      nodes.push({ id: id, type: 'transport', day: (lg.legType === 'return' ? Math.max(0, days.length - 1) : (li === 0 ? 0 : null)), order: li, status: 'planned', name: ((lg.fromCity || '').split(',')[0]) + ' → ' + ((lg.toCity || '').split(',')[0]), from: lg.fromCity || '', to: lg.toCity || '', legType: lg.legType || '', source: 'ai', locked: isNodeLocked(tr, id), votes: {} });
    });
    return { version: 1, nodes: nodes };
  }
  function materializeDay(tr, dayIdx, newDay) {
    var plan = tr.plan; if (!plan || !plan.days[dayIdx] || !newDay) return false;
    var d = plan.days[dayIdx];
    if (newDay.destinationIndex == null) newDay.destinationIndex = d.destinationIndex || 0;
    newDay.isReturnDay = !!d.isReturnDay; if (!newDay.date) newDay.date = d.date; if (newDay.dayType == null) newDay.dayType = d.dayType;
    plan.days[dayIdx] = newDay; return true;
  }
  // Step 3 — scoped, lock-aware replan: regenerate ONLY affectedDays, preserving locked nodes
  // (+ existing pins) verbatim and optimizing around them. Reuses the proven generateLegDays
  // callable per leg; everything outside affectedDays is untouched. ("change one node, keep the rest")
  function replanRange(tr, affectedDays) {
    var plan = tr && tr.plan;
    if (!plan || !Array.isArray(plan.days) || !affectedDays || !affectedDays.length) return Promise.resolve({ ok: false });
    var legFn = mkCallable('generateLegDays', 90000); if (!legFn) return Promise.resolve({ ok: false });
    var byLeg = {};
    affectedDays.forEach(function (di) { var d = plan.days[di]; if (!d || d.isTravelDay) return; var li = d.destinationIndex || 0; (byLeg[li] = byLeg[li] || []).push(di); });
    var graph = buildTripGraph(tr);
    var lockedPins = graph.nodes.filter(function (n) { return n.locked && n.type !== 'transport'; }).map(function (n) { return { title: n.name, destination: '', preferredDayNumber: String(n.day + 1), preferredTimeOfDay: n.slot || 'flexible', priority: 'required' }; });
    var pins = (tr.pinnedActivities || []).slice().concat(lockedPins);
    var jobs = Object.keys(byLeg).map(function (liKey) {
      var li = parseInt(liKey, 10), daysForLeg = byLeg[li];
      var td = (tr.destinations || [])[li] || {}, pdest = (plan.destinations || [])[li] || {};
      var daySpecs = daysForLeg.map(function (di) { var d = plan.days[di]; return { dayNumber: di + 1, date: d.date || '', destinationIndex: li, isTravelDay: false, isReturnDay: !!d.isReturnDay, title: d.title || '', theme: d.theme || '', summary: d.summary || '' }; });
      return legFn({
        trip: { tripStyle: tr.tripStyle, budget: tr.budget, families: tr.families, preferences: tr.preferences, departureCity: tr.departureCity, lastDayFull: !!tr.lastDayFull, finalDayMode: finalDayMode(tr) }, lang: state.lang,
        leg: { index: li, city: td.city || pdest.city || destNameFromTrip(tr, li), startDate: td.startDate || '', endDate: td.endDate || '', hotelSuggestion: pdest.hotelSuggestion || null, role: td.role || 'main_destination', hotelNeeded: td.hotelNeeded !== false, mealOnly: !!td.mealOnly, suggestFood: td.suggestFood !== false, suggestActivities: td.suggestActivities !== false, hoursToSpend: td.hoursToSpend || '', priority: td.priority || 'required' },
        daySpecs: daySpecs, liveHighlights: tr.liveHighlights || [], avoidPlaces: rejectedNames(tr), preferredPlaces: preferredNames(tr), pinnedActivities: pins,
      }).then(function (rr) {
        var dd = (rr && rr.data) || {}; var touched = [];
        if (dd.ok && Array.isArray(dd.days)) dd.days.forEach(function (nd) { var di = (nd.dayNumber || 0) - 1; if (daysForLeg.indexOf(di) >= 0 && materializeDay(tr, di, nd)) touched.push(di); });
        return touched;
      }).catch(function () { return []; });
    });
    return Promise.all(jobs).then(function (res) {
      var touched = res.reduce(function (a, b) { return a.concat(b); }, []);
      if (touched.length) saveTrip(tr);
      return { ok: touched.length > 0, days: touched };
    });
  }
  // ── Step 4 — Journey Timeline UI (wires the node graph: lock toggles + scoped replan) ──
  function nodeIcon(node) {
    if (node.type === 'transport') return (typeof tpIcon === 'function' ? tpIcon(node.mode) : '🚌');
    if (node.type === 'meal') return '🍜';
    if (node.type === 'stay') return '🏨';
    return ({ attraction: '🎡', beach: '🏖️', museum: '🏛', park: '🌳', shopping: '🛍', nightlife: '🎶', nature: '🏞', show: '🎭' })[node.category] || '📍';
  }
  // Replan ONLY this day, preserving locked nodes (the visible "change one node, keep the rest").
  function runReplanDay(tr, dayIdx) {
    if (state._replanBusy != null) return;
    state._replanBusy = dayIdx; render();
    replanRange(tr, [dayIdx]).then(function (r) { state._replanBusy = null; toast(r && r.ok ? t('jnReplanned') : t('genFail')); render(); })
      .catch(function () { state._replanBusy = null; toast(t('genFail')); render(); });
  }
  function journeyNodeCard(tr, node) {
    var card = el('article', 'tc-jn' + (node.locked ? ' tc-jn--lock' : '') + (node.type === 'transport' ? ' tc-jn--t' : ''));
    card.appendChild(el('span', 'tc-jn__ic', nodeIcon(node)));
    var body = el('div', 'tc-jn__body');
    var top = el('div', 'tc-jn__top');
    var kindLbl = node.type === 'transport' ? t('jnTransportNode') : (t('ts_' + (node.slot || '')) !== ('ts_' + (node.slot || '')) ? t('ts_' + node.slot) : node.type);
    top.appendChild(el('span', 'tc-jn__kind', kindLbl));
    if (node.time) top.appendChild(el('span', 'tc-jn__time', node.time));
    if (node.locked) top.appendChild(el('span', 'tc-jn__lockbadge', '🔒 ' + t('jnLocked')));
    body.appendChild(top);
    body.appendChild(el('strong', 'tc-jn__name', node.name));
    if (node.type === 'transport') {
      body.appendChild(pbtn('🧭 ' + t('jnViewTransport'), 'tc-pbtn--ghost', function () { state.activeTab = 'transport'; render(); }));
    } else if (!tr._demo) {
      body.appendChild(voteRow({ name: node.name }, { favorite: true }));
    }
    if (!state.readonly && !tr._demo) {
      var acts = el('div', 'tc-jn__acts');
      acts.appendChild(pbtn((node.locked ? '🔓 ' + t('jnUnlock') : '🔒 ' + t('jnLock')), 'tc-pbtn--ghost' + (node.locked ? ' tc-pbtn--on' : ''), function () { if (node.locked) unlockNode(tr, node.id); else lockNode(tr, node.id); render(); }));
      if (node.type !== 'transport') acts.appendChild(pbtn('✨ ' + t('jnImprove'), 'tc-pbtn--accent', function () { runReplanDay(tr, node.day); }));
      body.appendChild(acts);
    }
    card.appendChild(body);
    return card;
  }
  // ── Step 5 — Natural-language edit: interpret → preview → apply (scoped, lock-aware) ──
  function interpretCommand(tr, utterance) {
    var c = mkCallable('interpretTripCommand', 30000);
    if (!c) return Promise.resolve({ ok: false });
    var graph = buildTripGraph(tr).nodes.map(function (n) { return { name: n.name, type: n.type, day: n.day, locked: n.locked }; });
    return callWithRetry(c, { graph: graph, utterance: utterance, dateRange: tr.dateRange || '', lang: state.lang })
      .then(function (r) { return (r && r.data) || { ok: false }; }).catch(function () { return { ok: false }; });
  }
  function resolveNodeByName(tr, name) {
    var nm = (name || '').trim().toLowerCase(); if (!nm) return null;
    return buildTripGraph(tr).nodes.filter(function (n) { return (n.name || '').trim().toLowerCase() === nm; })[0] || null;
  }
  // Map the AI edit plan to real, SAFE mutations on the existing systems, then scoped-replan.
  function applyEditPlan(tr, plan) {
    (plan.ops || []).forEach(function (o) {
      if (o.op === 'lock') { var n = resolveNodeByName(tr, o.targetName); if (n) lockNode(tr, n.id); }
      else if (o.op === 'unlock') { var n2 = resolveNodeByName(tr, o.targetName); if (n2) unlockNode(tr, n2.id); }
      else if (o.op === 'skip' || o.op === 'delete' || o.op === 'replace') { if (o.targetName) { var ov = ensureOverride({ name: o.targetName }); if (ov) ov.action = 'skipped'; } }
      else if (o.op === 'add') { if ((o.name || '').trim()) addPlaceToDay(o.day ? (o.day - 1) : 0, o.slot || 'afternoon', o.name.trim(), o.category === 'meal' ? 'food' : 'activity'); }
      // retime / replan_day / structural ops are realized by the scoped replan below.
    });
    saveTrip(tr);
    var days = (plan.affectedDays || []).map(function (d) { return d - 1; }).filter(function (d) { return d >= 0 && tr.plan && tr.plan.days[d] && !tr.plan.days[d].isTravelDay; });
    return days.length ? replanRange(tr, days) : Promise.resolve({ ok: true, days: [] });
  }
  function opVerb(op) { var k = 'cmdop_' + op; var l = t(k); return (l && l !== k) ? l : op.replace(/_/g, ' '); }
  function opLine(o) {
    var bits = [opVerb(o.op)];
    if (o.targetName) bits.push('“' + o.targetName + '”');
    else if (o.name) bits.push('“' + o.name + '”');
    else if (o.cuisine) bits.push(o.cuisine);
    if (o.day) bits.push(t('day') + ' ' + o.day);
    if (o.time) bits.push('· ' + o.time);
    return bits.join(' ');
  }
  function editPlanPreview(tr) {
    var pl = state._editPlan, box = el('div', 'tc-editplan');
    if (pl.error) { box.appendChild(el('p', 'tc-hint', t('cmdFail'))); box.appendChild(pbtn('✕ ' + t('cmdCancel'), 'tc-pbtn--ghost', function () { state._editPlan = null; render(); })); return box; }
    if (!pl.ops || !pl.ops.length) { box.appendChild(el('p', 'tc-hint', pl.summary || t('cmdNone'))); box.appendChild(pbtn('✕ ' + t('cmdCancel'), 'tc-pbtn--ghost', function () { state._editPlan = null; render(); })); return box; }
    box.appendChild(el('strong', 'tc-editplan__t', '✨ ' + t('cmdPlanTitle')));
    if (pl.summary) box.appendChild(el('p', 'tc-editplan__sum', pl.summary));
    var ops = el('div', 'tc-editplan__ops'); pl.ops.forEach(function (o) { ops.appendChild(el('div', 'tc-editplan__op', opLine(o))); }); box.appendChild(ops);
    if ((pl.affectedDays || []).length) box.appendChild(el('p', 'tc-hint', t('cmdDays').replace('{d}', pl.affectedDays.join(', ')) + ' · ' + t('jnReplanKeep')));
    var row = el('div', 'tc-editplan__btns');
    var apply = el('button', 'tc-cta', t('cmdApply')); apply.type = 'button';
    apply.addEventListener('click', function () { var pp = state._editPlan; state._editPlan = null; state._cmdBusy = true; render(); applyEditPlan(tr, pp).then(function () { state._cmdBusy = false; toast(t('cmdApplied')); render(); }).catch(function () { state._cmdBusy = false; toast(t('genFail')); render(); }); });
    row.appendChild(apply); row.appendChild(pbtn('✕ ' + t('cmdCancel'), 'tc-pbtn--ghost', function () { state._editPlan = null; render(); }));
    box.appendChild(row);
    return box;
  }
  function commandBar(tr) {
    var wrap = el('div', 'tc-cmd');
    var ci = input('', t('cmdPh')); ci.className = 'tc-input tc-cmd__in';
    var go = el('button', 'tc-cmd__go', '✨ ' + t('cmdGo')); go.type = 'button';
    function run() { var u = (ci.value || '').trim(); if (!u || state._cmdBusy) return; state._cmdBusy = true; state._editPlan = null; render(); interpretCommand(tr, u).then(function (pl) { state._cmdBusy = false; state._editPlan = (pl && pl.ok) ? pl : { error: true }; render(); }); }
    go.addEventListener('click', run);
    ci.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    wrap.appendChild(ci); wrap.appendChild(go);
    return wrap;
  }
  function renderJourney(plan) {
    var tr = state.trip, wrap = el('div', 'tc-journey');
    wrap.appendChild(el('strong', 'tc-journey__t', '🧭 ' + t('journeyTitle')));
    wrap.appendChild(el('p', 'tc-journey__sub', t('journeySub')));
    // Natural-language command bar (interpret → preview diff → apply + scoped replan).
    if (!state.readonly && !tr._demo && plan && Array.isArray(plan.days) && plan.days.length) {
      wrap.appendChild(commandBar(tr));
      if (state._cmdBusy && !state._editPlan) wrap.appendChild(researchBanner('cmdBusy'));
      if (state._editPlan) wrap.appendChild(editPlanPreview(tr));
    }
    if (!plan || !Array.isArray(plan.days) || !plan.days.length) { wrap.appendChild(el('p', 'tc-empty', t('jnNoPlan'))); return wrap; }
    var g = buildTripGraph(tr), days = plan.days;
    days.forEach(function (d, di) {
      var dayNodes = g.nodes.filter(function (n) { return n.day === di; }).sort(function (a, b) { return (a.type === 'transport' ? 0 : 1) - (b.type === 'transport' ? 0 : 1) || (a.order || 0) - (b.order || 0); });
      if (!dayNodes.length) return;
      var head = el('div', 'tc-journey__day');
      head.appendChild(el('strong', null, t('day') + ' ' + (di + 1) + (d.title ? (' · ' + d.title) : '')));
      if (!state.readonly && !tr._demo) {
        var rb = el('button', 'tc-journey__replan', '✨ ' + t('jnReplanDay') + ' · ' + t('jnReplanKeep')); rb.type = 'button';
        if (state._replanBusy != null) rb.disabled = true;
        rb.addEventListener('click', function () { runReplanDay(tr, di); });
        head.appendChild(rb);
      }
      wrap.appendChild(head);
      if (state._replanBusy === di) { wrap.appendChild(researchBanner('jnImproving')); }
      dayNodes.forEach(function (n, i) { if (i) wrap.appendChild(el('div', 'tc-jn__conn')); wrap.appendChild(journeyNodeCard(tr, n)); });
      if (!state.readonly && !tr._demo) {
        var addRow = el('div', 'tc-journey__add');
        var inp = input('', t('jnAddPh')); addRow.appendChild(inp);
        var ab = el('button', 'tc-pbtn', '＋ ' + t('jnAdd')); ab.type = 'button';
        ab.addEventListener('click', function () { var v = (inp.value || '').trim(); if (v) { addPlaceToDay(di, (dayNodes[dayNodes.length - 1] || {}).slot || 'afternoon', v); } });
        addRow.appendChild(ab); wrap.appendChild(addRow);
      }
    });
    wrap.appendChild(el('p', 'tc-unverified', t('stratUnverified')));
    return wrap;
  }
  // AI "Why this day/time?" — generic reasoning (weather/hours/crowds/route/family mix).
  // Cached per place key as { text, open } so a second click just toggles visibility.
  function whyKey(ctx) { return ctx.added && ctx.addedRef ? ('add:' + ctx.addedRef.id) : (placeKey(ctx.p) || (ctx.p && ctx.p.name) || ''); }
  function explainPlacement(ctx) {
    var p = ctx.p, k = whyKey(ctx);
    state._why = state._why || {};
    var entry = state._why[k];
    if (entry && entry.text && entry.text !== 'loading') { entry.open = !entry.open; render(); return; } // toggle
    var c = mkCallable('explainTripPlacement', 28000);
    var plan = state.trip.plan, day = (plan.days || [])[ctx.day] || {};
    var dayPlaces = (laneItems(ctx.day, ctx.slot) || []).map(function (it) { return it.p.name; });
    if (!c) { state._why[k] = { text: t('whyUnavailable'), open: true }; render(); return; }
    state._why[k] = { text: 'loading', open: true }; render();
    c({ place: { name: p.name, category: p.category || '', cuisine: p.cuisine || '' }, dayNumber: ctx.day + 1, timeSlot: ctx.slot, dayTitle: day.title || '', city: destCityName(plan, day.destinationIndex || 0) || '', dayPlaces: dayPlaces, families: (state.trip && state.trip.families) || [], lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; state._why[k] = { text: (d.ok && d.reason) ? d.reason : t('whyUnavailable'), open: true }; render(); })
      .catch(function () { state._why[k] = { text: t('whyUnavailable'), open: true }; render(); });
  }
  function whyText(ctx) {
    var e = state._why && state._why[whyKey(ctx)];
    if (!e || !e.open) return '';
    return e.text === 'loading' ? 'loading' : (e.text || '');
  }
  function suggestAlternatives(place, city) {
    var c = mkCallable('suggestPlaceAlternatives', 28000);
    if (!c) return Promise.resolve({ alternatives: [] });
    return c({ place: { name: place.name, category: place.category, cuisine: place.cuisine || '' }, city: city || '', families: (state.trip && state.trip.families) || [], lang: state.lang })
      .then(function (r) { var d = (r && r.data) || {}; return { alternatives: d.alternatives || [] }; })
      .catch(function () { return { alternatives: [] }; });
  }
  function loadAlternatives(p) {
    var k = placeKey(p); state._alts = state._alts || {}; state._alts[k] = 'loading'; render();
    var city = p.address || (state.trip && state.trip.destination) || '';
    suggestAlternatives(p, city).then(function (res) { state._alts[k] = res.alternatives || []; render(); }).catch(function () { state._alts[k] = []; render(); });
  }
  // Dispatcher: render a place as its replacement, a skipped stub, or a normal card.
  function placeNode(p, ctx) {
    ctx = ctx || {};
    var ov = ctx.added ? null : getOverride(p);
    if (ov && ov.action === 'replaced' && ov.replacement) {
      var box = el('div', 'tc-replwrap');
      box.appendChild(placeCard(ov.replacement, ctx)); // ctx.p stays the ORIGINAL → moves/pins apply to it
      var note = el('div', 'tc-replnote');
      note.appendChild(el('span', 'tc-replnote__t', '↻ ' + t('replacedOriginal') + ': ' + (ov.name || '')));
      if (canEditPlan()) { var u = el('button', 'tc-pbtn', '↩ ' + t('undoSkip')); u.type = 'button'; u.addEventListener('click', function () { clearPlaceOverride(p); }); note.appendChild(u); }
      box.appendChild(note);
      return box;
    }
    if (ov && (ov.action === 'skipped' || ov.action === 'deleted')) return skippedStub(p);
    return placeCard(p, ctx);
  }
  function pbtn(label, cls, fn) { var b = el('button', 'tc-pbtn ' + (cls || ''), label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function rejectReasonText(reason) { return reason === 'all_family_skip' ? t('rejVote') : (reason === 'majority_skip' ? t('rejMajority') : (reason === 'not_needed' ? t('rejNotNeeded') : '')); }
  function skippedStub(p) {
    var k = placeKey(p), box = el('div', 'tc-skipped');
    var ov = getOverrides()[k] || {};
    box.appendChild(el('span', 'tc-skipped__lbl', '⤫ ' + t('skippedLabel') + ': ' + (p.name || '')));
    // Auto (group-vote / booking) rejections carry a reason; Undo "keeps" them despite votes.
    var auto = !!ov.auto, rtxt = auto ? rejectReasonText(ov.reason) : '';
    if (rtxt) box.appendChild(el('span', 'tc-skipped__why', rtxt));
    if (canEditPlan()) {
      var acts = el('div', 'tc-skipped__acts');
      var undo = el('button', 'tc-pbtn', '↩ ' + t('undoSkip')); undo.type = 'button'; undo.addEventListener('click', function () { if (auto) unrejectPlace(p); else clearPlaceOverride(p); }); acts.appendChild(undo);
      var repl = el('button', 'tc-pbtn tc-pbtn--accent', '↻ ' + t('replaceAlt')); repl.type = 'button';
      repl.addEventListener('click', function () { if (state._altOpen === k) { state._altOpen = null; render(); } else { state._altOpen = k; if (!(state._alts && state._alts[k])) loadAlternatives(p); else render(); } });
      acts.appendChild(repl);
      box.appendChild(acts);
      if (state._altOpen === k) box.appendChild(altPanel(p));
    }
    return box;
  }
  function altPanel(p) {
    var k = placeKey(p), panel = el('div', 'tc-altpanel');
    var alts = state._alts && state._alts[k];
    if (alts === 'loading') { panel.appendChild(researchBanner('loadingAlts')); return panel; }
    panel.appendChild(el('p', 'tc-altpanel__h', t('pickAlternative')));
    if (Array.isArray(alts) && alts.length) {
      alts.forEach(function (a) {
        var b = el('button', 'tc-altpanel__opt'); b.type = 'button';
        b.appendChild(el('strong', 'tc-altpanel__nm', a.name));
        if (a.cuisine || a.category) b.appendChild(el('span', 'tc-altpanel__cat', ' · ' + (a.cuisine || a.category)));
        if (a.why) b.appendChild(el('span', 'tc-altpanel__why', a.why));
        b.addEventListener('click', function () { setPlaceOverride(p, 'replaced', altToPlace(a, p)); });
        panel.appendChild(b);
      });
    } else if (Array.isArray(alts)) { panel.appendChild(el('p', 'tc-hint', t('noAlts'))); }
    // Search replacement (real source) + add your own + leave empty.
    var city = p.address || (state.trip && state.trip.destination) || '';
    panel.appendChild(linkBtn('🔎 ' + t('searchReplacement'), gsearch(((p.cuisine || p.category || '') + ' near ' + city).trim()), 'tc-altpanel__search'));
    var addRow = el('div', 'tc-altpanel__add');
    var inp = input('', t('addOwnPh')); addRow.appendChild(inp);
    var add = el('button', 'tc-pbtn tc-pbtn--accent', '+ ' + t('addOwn')); add.type = 'button';
    add.addEventListener('click', function () { var nm = (inp.value || '').trim(); if (!nm) { toast(t('addOwnPh')); return; } setPlaceOverride(p, 'replaced', { id: uid('cust'), name: nm, category: p.category || '', dataSource: 'user_entered' }); });
    addRow.appendChild(add); panel.appendChild(addRow);
    var le = el('button', 'tc-pbtn', t('leaveEmpty')); le.type = 'button'; le.addEventListener('click', function () { state._altOpen = null; render(); }); panel.appendChild(le);
    return panel;
  }
  // ── Media Enrichment: "Learn more" expandable. Deterministic honest links show instantly;
  //    the AI (researchPlaceMedia) enriches lazily on FIRST expand (cached on item._media).
  //    Videos are always YouTube/TikTok SEARCH links; photos are verified-only (placeMedia). ──
  function mediaTypeForPlace(p) {
    var c = String((p && p.category) || '').toLowerCase();
    if (/restaurant|food|cafe|coffee|dessert|eat/.test(c)) return 'restaurant';
    if (/lodging|hotel|stay|resort|motel|inn/.test(c)) return 'hotel';
    if (/tour|cruise|whale|kayak/.test(c)) return 'tour';
    if (/beach|cove|scenic|park|nature|hike|trail|view|gem/.test(c)) return 'scenic';
    if (/event|festival|concert|market|fireworks/.test(c)) return 'event';
    return 'attraction';
  }
  function lmLabel(m) { return t('lm_' + m.type) || m.title || String(m.type || '').replace(/_/g, ' '); }
  function renderMediaLinks(wrap, media) {
    (media || []).forEach(function (m) {
      if (!m || !m.url) return;
      var b = linkBtn(lmLabel(m), m.url, 'tc-lmlink');
      if (m.verificationStatus === 'ai_suggested') b.appendChild(el('span', 'tc-lmlink__v', ' · ' + t('lmVerify')));
      wrap.appendChild(b);
    });
  }
  function applyAiMedia(links, notes, r) {
    (r.media || []).forEach(function (m) { // add AI-curated REAL urls the deterministic baseline can't know
      if (m && m.verificationStatus === 'ai_suggested' && m.url) links.appendChild(linkBtn(lmLabel(m) + ' · ' + t('lmVerify'), m.url, 'tc-lmlink tc-lmlink--ai'));
    });
    function note(k, v) { if (v) notes.appendChild(el('p', 'tc-learnmore__note', t(k) + ': ' + v)); }
    note('lmWhy', r.why); note('lmGroupFit', r.groupFit); note('lmBestTime', r.bestTime); note('lmTimeNeeded', r.timeNeeded);
    note('lmParking', r.parking); note('lmWalking', r.walkingDifficulty); note('lmWaitTime', r.waitTime); note('lmSafety', r.safety); note('lmWeather', r.weatherBackup);
    if (notes.childNodes.length) notes.appendChild(el('p', 'tc-unverified', t('unverified')));
  }
  function buildLearnMoreBody(body, item, type, city) {
    var links = el('div', 'tc-learnmore__links'); body.appendChild(links);
    if (root.TCMedia) renderMediaLinks(links, root.TCMedia.build(item, type, city));
    body.appendChild(placeMedia({ name: item.name, address: item.address || '', city: city, category: type }, 'tc-learnmore__media'));
    var notes = el('div', 'tc-learnmore__notes'); body.appendChild(notes);
    if (item._media) { applyAiMedia(links, notes, item._media); return; }
    var fn = mkCallable('researchPlaceMedia', 40000); if (!fn) return;
    var banner = researchBanner('lmLoading'); body.appendChild(banner);
    fn({ tripId: (state.trip && state.trip.id) || '', name: item.name, type: type, city: city, lang: state.lang })
      .then(function (rr) { try { body.removeChild(banner); } catch (e) {} var r = (rr && rr.data) || {}; if (r.ok) { item._media = r; applyAiMedia(links, notes, r); } })
      .catch(function () { try { body.removeChild(banner); } catch (e) {} });
  }
  function learnMoreSection(item, type, city) {
    if (!item || !item.name || !root.TCMedia) return null;
    var sec = el('section', 'tc-collapse tc-learnmore');
    var head = el('button', 'tc-collapse__head'); head.type = 'button'; head.setAttribute('aria-expanded', 'false');
    head.appendChild(el('span', 'tc-collapse__title', '🔎 ' + t('learnMore')));
    head.appendChild(el('span', 'tc-collapse__chev', '▾'));
    var body = el('div', 'tc-collapse__body'); body.hidden = true;
    var built = false;
    head.addEventListener('click', function () {
      var open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      body.hidden = open; sec.classList.toggle('tc-collapse--open', !open);
      if (!built && !open) { built = true; buildLearnMoreBody(body, item, type, city); } // lazy on FIRST expand
    });
    sec.appendChild(head); sec.appendChild(body);
    return sec;
  }
  function placeCard(p, ctx) {
    ctx = ctx || {};
    var controllable = canEditPlan() && ctx.lane && ctx.pkey;
    var c = el('article', 'tc-place' + (ctx.pinned ? ' tc-place--pinned' : '') + (ctx.added ? ' tc-place--added' : ''));
    if (ctx.pkey) c.setAttribute('data-pkey', ctx.pkey);
    if (ctx.day != null) c.setAttribute('data-day', String(ctx.day));
    if (ctx.slot) c.setAttribute('data-slot', ctx.slot);
    if (controllable) enableDrag(c, ctx);
    c.appendChild(placeMedia(p));
    var body = el('div', 'tc-place__body');
    if (controllable) {
      body.appendChild(cardControlBar(p, ctx));
      if (state._cardMenu === ctx.pkey) body.appendChild(cardMenuPanel(p, ctx));
      var wt = whyText(ctx);
      if (wt) body.appendChild(wt === 'loading' ? researchBanner('whyLoading') : (function () { var w = el('div', 'tc-whybox'); w.appendChild(el('span', 'tc-whybox__k', '❓ ' + t('whyHere'))); w.appendChild(el('p', 'tc-whybox__v', wt)); return w; })());
    }
    if (ctx.added) body.appendChild(el('span', 'tc-place__addedby', '✎ ' + t('addedByYou')));
    body.appendChild(el('strong', 'tc-place__name', p.name));
    if (p.address) body.appendChild(el('p', 'tc-place__addr', p.address));
    if (p.whySelected) { var why = el('p', 'tc-place__why'); why.appendChild(el('span', 'tc-place__why-k', t('whySelected') + ': ')); why.appendChild(doc.createTextNode(p.whySelected)); body.appendChild(why); }
    var chips = el('div', 'tc-place__chips');
    if (p.estimatedCost) chips.appendChild(chip('tc-chip--cost', '💵 ' + p.estimatedCost));
    if (p.estimatedDuration) chips.appendChild(chip('', '⏱ ' + p.estimatedDuration));
    if (typeof p.kidFriendlyScore === 'number') chips.appendChild(scoreChip('🧒', p.kidFriendlyScore));
    if (typeof p.toddlerFriendlyScore === 'number') chips.appendChild(scoreChip('👶', p.toddlerFriendlyScore));
    if (typeof p.teenFriendlyScore === 'number') chips.appendChild(scoreChip('🧑', p.teenFriendlyScore));
    if (typeof p.seniorFriendlyScore === 'number') chips.appendChild(scoreChip('🧓', p.seniorFriendlyScore));
    if (p.walkingLevel) chips.appendChild(chip('tc-chip--walk', t('walk_' + p.walkingLevel) || p.walkingLevel));
    var bkFor = bookingForPlace(p); if (bkFor) chips.appendChild(chip('tc-chip--bk', bookingTypeIcon(bkFor.type) + ' ' + t('bs_' + (bkFor.bookingStatus || 'research_needed'))));
    body.appendChild(chips);
    // Popular dishes (real signature dishes for restaurant/food cards; never priced).
    if (Array.isArray(p.popularDishes) && p.popularDishes.length) {
      var pd = el('p', 'tc-place__dishes'); pd.appendChild(el('span', 'tc-place__dishes-k', '🍽 ' + t('popularDishesLabel') + ': '));
      pd.appendChild(doc.createTextNode(p.popularDishes.slice(0, 4).join(' · '))); body.appendChild(pd);
    }
    // Action buttons
    var acts = el('div', 'tc-place__acts');
    acts.appendChild(linkBtn(t('mapG'), p.googleMapsUrl || MapLinkProvider.google(p.name, p.address)));
    acts.appendChild(linkBtn(t('mapA'), p.appleMapsUrl || MapLinkProvider.apple(p.name, p.address)));
    if (p.websiteUrl) acts.appendChild(linkBtn(t('website'), p.websiteUrl));
    if (p.reservationUrl) acts.appendChild(linkBtn('🎟 ' + t('reserve'), p.reservationUrl, 'tc-pbtn--accent'));
    if (p.videoUrl) acts.appendChild(linkBtn('▶ ' + t('watchClip'), p.videoUrl, 'tc-pbtn--accent'));
    var det = el('button', 'tc-pbtn', t('details')); det.type = 'button'; det.addEventListener('click', function () { openPlaceModal(p); }); acts.appendChild(det);
    // Skip → creates a persistent override + offers alternatives. For controllable itinerary
    // cards, Skip/Replace live in the ⋯ move menu; this is the fallback for any other context.
    if (canEditPlan() && !controllable) { var sk = el('button', 'tc-pbtn tc-pbtn--danger', '⤫ ' + t('skipPlace')); sk.type = 'button'; sk.addEventListener('click', function () { setPlaceOverride(ctx.p || p, 'skipped', null); }); acts.appendChild(sk); }
    body.appendChild(acts);
    // (Restaurant photo/review/menu links now live in the media panel — see placeMedia.)
    var _lm = learnMoreSection(p, mediaTypeForPlace(p), p.city || ''); if (_lm) body.appendChild(_lm); // "Learn more" media enrichment
    body.appendChild(voteRow(p, { booking: true })); // itinerary places keep the reservation status select
    c.appendChild(body);
    return c;
  }
  // Per-card control bar (drag handle + pin badge + Why + Move menu toggle).
  function cardControlBar(p, ctx) {
    var bar = el('div', 'tc-place__ctl');
    var handle = el('span', 'tc-place__drag', '⋮⋮'); handle.setAttribute('aria-hidden', 'true'); handle.title = t('dragHint'); bar.appendChild(handle);
    if (ctx.pinned) bar.appendChild(el('span', 'tc-place__pinbadge', '📌 ' + t('pinnedHere')));
    bar.appendChild(el('span', 'tc-place__ctlsp'));
    bar.appendChild(pbtn('❓ ' + t('whyHere'), 'tc-pbtn--ghost', function () { explainPlacement(ctx); }));
    bar.appendChild(pbtn('⋯ ' + t('moveCard'), 'tc-pbtn--ghost' + (state._cardMenu === ctx.pkey ? ' tc-pbtn--on' : ''), function () { state._cardMenu = (state._cardMenu === ctx.pkey) ? null : ctx.pkey; render(); }));
    return bar;
  }
  // The ⋯ menu: mobile-first fallback for every drag/drop action + pin/skip/replace.
  function cardMenuPanel(p, ctx) {
    var panel = el('div', 'tc-cardmenu');
    var rowMove = el('div', 'tc-cardmenu__row');
    var up = pbtn('↑ ' + t('moveUp'), '', function () { moveUpDown(ctx, -1); }); up.disabled = ctx.idx <= 0;
    var dn = pbtn('↓ ' + t('moveDown'), '', function () { moveUpDown(ctx, 1); }); dn.disabled = ctx.idx >= ctx.count - 1;
    rowMove.appendChild(up); rowMove.appendChild(dn); panel.appendChild(rowMove);
    var days = (state.trip.plan && state.trip.plan.days) || [], dayOpts = [];
    days.forEach(function (d, i) { if (!d.isTravelDay) dayOpts.push(String(i)); });
    var daySel = selectFrom(dayOpts, String(ctx.day), function (o) { return t('day') + ' ' + (parseInt(o, 10) + 1); });
    daySel.addEventListener('change', function () { moveToDay(ctx, parseInt(daySel.value, 10)); });
    panel.appendChild(field(t('moveToDay'), daySel));
    var slotSel = selectFrom(TIME_SLOTS, ctx.slot, function (o) { return t('ts_' + o); });
    slotSel.addEventListener('change', function () { moveToSlot(ctx, slotSel.value); });
    panel.appendChild(field(t('changeTimeSlot'), slotSel));
    panel.appendChild(pbtn((ctx.pinned ? '📌 ' + t('unpinHere') : '📌 ' + t('pinHere')), (ctx.pinned ? 'tc-pbtn--accent' : ''), function () { togglePin(ctx); }));
    if (ctx.added) {
      panel.appendChild(pbtn('🗑 ' + t('removeAdded'), 'tc-pbtn--danger', function () { removeAdded(ctx); }));
    } else {
      panel.appendChild(pbtn('↻ ' + t('replaceAlt'), '', function () { var k = placeKey(ctx.p); state._cardMenu = null; state._altOpen = k; setPlaceOverride(ctx.p, 'skipped', null); if (!(state._alts && state._alts[k])) loadAlternatives(ctx.p); }));
      panel.appendChild(pbtn('⤫ ' + t('skipPlace'), 'tc-pbtn--danger', function () { state._cardMenu = null; setPlaceOverride(ctx.p, 'skipped', null); }));
    }
    return panel;
  }
  // ── Desktop HTML5 drag/drop (mobile uses the ⋯ menu — single shared move logic) ──
  var _dragCtx = null;
  function enableDrag(c, ctx) {
    c.setAttribute('draggable', 'true');
    c.addEventListener('dragstart', function (e) { _dragCtx = ctx; c.classList.add('tc-place--dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ctx.pkey || ''); } catch (er) {} });
    c.addEventListener('dragend', function () { c.classList.remove('tc-place--dragging'); _dragCtx = null; try { [].slice.call(doc.querySelectorAll('.tc-section--dropover')).forEach(function (x) { x.classList.remove('tc-section--dropover'); }); } catch (er) {} });
  }
  function enableLaneDrop(sb, day, slot) {
    sb.addEventListener('dragover', function (e) { if (!_dragCtx) return; e.preventDefault(); sb.classList.add('tc-section--dropover'); });
    sb.addEventListener('dragleave', function () { sb.classList.remove('tc-section--dropover'); });
    sb.addEventListener('drop', function (e) { if (!_dragCtx) return; e.preventDefault(); sb.classList.remove('tc-section--dropover'); var ctx = _dragCtx; _dragCtx = null; dropItem(ctx, day, slot, dropIndexFromEvent(sb, e)); });
  }
  function dropIndexFromEvent(sb, e) {
    var cards = [].slice.call(sb.querySelectorAll('.tc-place')), y = e.clientY, idx = cards.length;
    for (var i = 0; i < cards.length; i++) { var r = cards[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { idx = i; break; } }
    return idx;
  }
  // Day-view actions: Add activity / restaurant / rest stop, Regenerate, Re-optimize.
  function dayActionsBar(dayIdx) {
    var bar = el('div', 'tc-dayactions');
    bar.appendChild(el('span', 'tc-dayactions__t', t('dayActionsTitle')));
    var row = el('div', 'tc-dayactions__row');
    row.appendChild(pbtn('＋ ' + t('addActivity'), 'tc-pbtn--accent', function () { state._addOpen = { day: dayIdx, kind: 'activity' }; render(); }));
    row.appendChild(pbtn('＋ ' + t('addRestaurant'), '', function () { state._addOpen = { day: dayIdx, kind: 'restaurant' }; render(); }));
    row.appendChild(pbtn('＋ ' + t('addRestStop'), '', function () { state._addOpen = { day: dayIdx, kind: 'rest_stop' }; render(); }));
    row.appendChild(pbtn('↻ ' + t('regenDayBtn'), '', function () { regenerateSingleDay(dayIdx, false); }));
    row.appendChild(pbtn('✨ ' + t('reoptDayBtn'), '', function () { regenerateSingleDay(dayIdx, true); }));
    bar.appendChild(row);
    if (state._addOpen && state._addOpen.day === dayIdx) bar.appendChild(addPlaceForm(dayIdx, state._addOpen.kind));
    return bar;
  }
  function addPlaceForm(dayIdx, kind) {
    var f = el('div', 'tc-addform');
    f.appendChild(el('p', 'tc-addform__h', t('addKind_' + kind)));
    var nm = input('', t('addNamePh')); f.appendChild(nm);
    var defSlot = (kind === 'restaurant') ? 'lunch' : (kind === 'rest_stop' ? 'afternoon' : 'morning');
    var slotSel = selectFrom(TIME_SLOTS, defSlot, function (o) { return t('ts_' + o); });
    f.appendChild(field(t('changeTimeSlot'), slotSel));
    var row = el('div', 'tc-addform__acts');
    row.appendChild(pbtn('＋ ' + t('addOwn'), 'tc-pbtn--accent', function () { addPlaceToDay(dayIdx, slotSel.value, nm.value, kind); }));
    row.appendChild(pbtn(t('cancelAdd'), '', function () { state._addOpen = null; render(); }));
    f.appendChild(row);
    return f;
  }
  // Replan-after-move (Issue #6): Keep / Fix timing only / Re-optimize / Reset.
  function replanBanner(dayIdx) {
    var b = el('div', 'tc-replan');
    b.appendChild(el('span', 'tc-replan__msg', '✦ ' + t('replanMsg')));
    var row = el('div', 'tc-replan__acts');
    row.appendChild(pbtn('✓ ' + t('replanKeep'), 'tc-pbtn--accent', function () { state._replanDay = null; render(); }));
    row.appendChild(pbtn('🕑 ' + t('replanTiming'), '', function () { fixTimingOnly(dayIdx); }));
    row.appendChild(pbtn('✨ ' + t('replanReopt'), '', function () { regenerateSingleDay(dayIdx, true); }));
    row.appendChild(pbtn('↩ ' + t('replanReset'), '', function () { resetDayToAI(dayIdx); }));
    b.appendChild(row);
    return b;
  }
  function linkBtn(label, href, cls) { var a = el('a', 'tc-pbtn ' + (cls || ''), label); a.href = href || '#'; a.target = '_blank'; a.rel = 'noopener'; return a; }
  // ── Per-family collaboration: "who am I" + family-attributed votes ──────
  function tripFamilies() {
    var out = [];
    ((state.trip && state.trip.families) || []).forEach(function (f, i) { if (f && (f.name || '').trim()) out.push({ id: f.id || ('f' + i), name: f.name.trim() }); });
    if (!out.length) ((state.trip && state.trip.plan && state.trip.plan.families) || []).forEach(function (n, i) { out.push({ id: 'pf' + i, name: String(n).split('(')[0].split('—')[0].trim() || ('#' + (i + 1)) }); });
    if (!out.length) out.push({ id: 'me', name: 'Me' });
    return out;
  }
  // Which family the current account is, scoped per trip + per logged-in user.
  // Persisted on the trip (memberFamily[uid]) so every member sees who is who,
  // with a localStorage cache for fast restore.
  function meKey() { var u = curUid(); return 'tc_me_' + (state.trip && state.trip.id) + (u ? '_' + u : ''); }
  function getMe() {
    var u = curUid();
    try { if (u && state.trip && state.trip.memberFamily && state.trip.memberFamily[u]) return state.trip.memberFamily[u]; } catch (e) {}
    try { return root.localStorage.getItem(meKey()) || ''; } catch (e) { return ''; }
  }
  function setMe(id) {
    try { root.localStorage.setItem(meKey(), id); } catch (e) {}
    var u = curUid();
    if (u && state.trip) { state.trip.memberFamily = state.trip.memberFamily || {}; state.trip.memberFamily[u] = id; saveTrip(state.trip); }
  }
  function familyPicker() {
    var wrap = el('div', 'tc-famsel');
    wrap.appendChild(el('span', 'tc-famsel__lbl', t('youAre')));
    var me = getMe();
    tripFamilies().forEach(function (f) {
      var b = el('button', 'tc-famsel__btn' + (f.id === me ? ' tc-famsel__btn--on' : ''), f.name); b.type = 'button';
      b.addEventListener('click', function () { setMe(f.id); render(); });
      wrap.appendChild(b);
    });
    return wrap;
  }
  // ════════════════════════════════════════════════════════════════════════
  //  GROUP CONSENSUS ENGINE — every per-family Like/Maybe/Skip/Favorite, on EVERY
  //  surface, becomes a weighted AI planning signal. Deterministic; no hardcoding.
  //  Weight each family by travelers + kids + seniors + accessibility so a bigger /
  //  higher-need family carries proportional say. Feeds the rejection engine (skip →
  //  never re-suggested) AND the AI optimizer (liked/favorited → prioritized/kept).
  // ════════════════════════════════════════════════════════════════════════
  function familyById(fid) { return ((state.trip && state.trip.families) || []).filter(function (f) { return (f.id || '') === fid; })[0] || null; }
  function familyWeight(f) {
    if (!f) return 1;
    var ages = String(f.childrenAges || '').split(/[,\s]+/).filter(function (x) { return /\d/.test(x); });
    var travelers = (f.adults || 0) + (f.seniors || 0) + ages.length;
    var kids = ages.filter(function (x) { var n = parseInt(x, 10); return !isNaN(n) && n <= 17; }).length;
    var w = 1 + travelers * 0.1 + kids * 0.12 + (f.seniors || 0) * 0.12;
    if ((Array.isArray(f.seniorNeeds) && f.seniorNeeds.length) || f.accessibility) w += 0.15; // accessibility needs weigh more
    return w;
  }
  function favMap(pid) { var tr = state.trip; tr.favorites = tr.favorites || {}; tr.favorites[pid] = tr.favorites[pid] || {}; return tr.favorites[pid]; }
  // Weighted group verdict for one item: loved | liked | mixed | skip | none.
  function consensusFor(pid) {
    var v = (state.trip.votes || {})[pid] || {}, fav = (state.trip.favorites || {})[pid] || {};
    var score = 0, likes = 0, maybes = 0, skips = 0, favs = 0, voters = 0;
    Object.keys(v).forEach(function (fid) {
      var s = v[fid]; if (s !== 'like' && s !== 'maybe' && s !== 'skip') return;
      voters++; var w = familyWeight(familyById(fid));
      if (s === 'like') { likes++; score += w; } else if (s === 'maybe') { maybes++; score += 0.3 * w; } else { skips++; score -= w; }
    });
    Object.keys(fav).forEach(function (fid) { if (fav[fid]) { favs++; score += 0.6 * familyWeight(familyById(fid)); } });
    var verdict = 'none';
    if (voters || favs) {
      if (favs && skips === 0 && score > 0) verdict = 'loved';
      else if (score > 0.5) verdict = 'liked';
      else if (skips > likes && score < 0) verdict = 'skip';
      else verdict = 'mixed';
    }
    return { score: Math.round(score * 100) / 100, likes: likes, maybes: maybes, skips: skips, favs: favs, voters: voters, verdict: verdict };
  }
  function consensusBadge(pid) {
    var c = consensusFor(pid); if (!c.voters && !c.favs) return null;
    var icon = ({ loved: '❤️', liked: '👍', mixed: '🤔', skip: '👎' })[c.verdict] || '•';
    return el('span', 'tc-cons tc-cons--' + c.verdict, icon + ' ' + (t('cons_' + c.verdict) || c.verdict));
  }
  // Phase 4 — re-rank a list of voteable items by the weighted group consensus score (STABLE:
  // unvoted items keep their AI order, loved/liked float up, mixed/negative sink). nameFn maps
  // an item to the vote key (defaults to name/place). Skipped items are already filtered upstream.
  function consensusSort(items, nameFn) {
    if (!Array.isArray(items) || items.length < 2) return items || [];
    return items.map(function (it, i) { var nm = nameFn ? nameFn(it) : (it && (it.name || it.place || '')); return { it: it, i: i, s: consensusFor(nm).score }; })
      .sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); })
      .map(function (x) { return x.it; });
  }
  // Shared vote key for a hotel so the card's voteRow and the consensus re-rank agree.
  function hotelVoteName(h, city) { return h.name || ((h.area || '') + ' · ' + (city || '')); }
  // Small "sorted by your votes" hint, shown atop a re-ranked list once any item has votes.
  function voteSortNote(items, nameFn) {
    var any = (items || []).some(function (it) { var nm = nameFn ? nameFn(it) : (it && (it.name || it.place || '')); var c = consensusFor(nm); return c.voters > 0 || c.favs > 0; });
    return any ? el('p', 'tc-votesort', '📊 ' + t('sortedByVotes')) : null;
  }
  // ── TripPreferenceProfile — global memory that EVOLVES from votes + families; fed to the
  //    AI optimizer + research agents so the trip keeps improving as the group votes. ──
  function likedNames() {
    var out = [], votes = (state.trip && state.trip.votes) || {};
    Object.keys(votes).forEach(function (pid) { var vd = consensusFor(pid).verdict; if (vd === 'loved' || vd === 'liked') out.push(pid); });
    return out;
  }
  function favoritedNames() {
    var out = [], favs = (state.trip && state.trip.favorites) || {};
    Object.keys(favs).forEach(function (pid) { if (Object.keys(favs[pid] || {}).some(function (k) { return favs[pid][k]; })) out.push(pid); });
    return out;
  }
  // Names the group voted UP (favorited + loved/liked) — passed to generation as "PREFER".
  function preferredNames(tr) {
    var seen = {}, out = [];
    var seed = ((tr || state.trip) || {})._memorySeed || {}; // cross-trip "places you liked before"
    favoritedNames().concat(likedNames()).concat(seed.likedPlaces || []).forEach(function (n) { var k = String(n || '').trim().toLowerCase(); if (k && !seen[k]) { seen[k] = 1; out.push(n); } });
    return out;
  }
  function transportModePrefs() {
    var liked = {}, skipped = {}, tv = (state.trip && state.trip.transportVotes) || {};
    Object.keys(tv).forEach(function (k) { var mode = k.split('|')[1] || '', m = tv[k]; Object.keys(m).forEach(function (fid) { if (m[fid] === 'like') liked[mode] = 1; else if (m[fid] === 'skip') skipped[mode] = 1; }); });
    return { liked: Object.keys(liked), skipped: Object.keys(skipped).filter(function (mode) { return !liked[mode]; }) };
  }
  function buildPreferenceProfile(trip) {
    trip = trip || state.trip; var fams = (trip && trip.families) || [];
    var adults = 0, seniors = 0, ages = [], foodPrefs = {}, stayPrefs = {}, accessibility = false;
    fams.forEach(function (f) {
      adults += (f.adults || 0); seniors += (f.seniors || 0);
      String(f.childrenAges || '').split(/[,\s]+/).forEach(function (x) { var n = parseInt(x, 10); if (!isNaN(n)) ages.push(n); });
      (Array.isArray(f.foodPrefsKeys) ? f.foodPrefsKeys : []).forEach(function (k) { foodPrefs[k] = 1; });
      if (typeof f.foodPrefs === 'string' && f.foodPrefs.trim()) foodPrefs[f.foodPrefs.trim().toLowerCase()] = 1;
      (Array.isArray(f.stayPrefs) ? f.stayPrefs : []).forEach(function (k) { stayPrefs[k] = 1; });
      if ((Array.isArray(f.seniorNeeds) && f.seniorNeeds.length) || f.accessibility) accessibility = true;
    });
    var kids = ages.filter(function (a) { return a <= 12; }).length, teens = ages.filter(function (a) { return a >= 13 && a <= 17; }).length;
    var tm = transportModePrefs();
    // Fold in cross-trip memory seeds (liked cuisines + stay leanings carried from past trips).
    var seed = (trip && trip._memorySeed) || {};
    var likedCuisines = memUnion(Object.keys(foodPrefs), seed.likedCuisines || []);
    var stayPrefList = memUnion(Object.keys(stayPrefs), seed.hotel || []);
    return {
      travelers: adults + seniors + ages.length, adults: adults, seniors: seniors, kids: kids, teens: teens,
      budget: trip.budget || 'moderate', pace: trip.tripStyle || 'balanced',
      foodPriority: likedCuisines.length > 0, likedCuisines: likedCuisines, stayPrefs: stayPrefList,
      oceanPreference: !!(stayPrefs.ocean_view || stayPrefs.near_beach), themeParkPreference: (kids > 0 || teens > 0),
      walkingTolerance: (accessibility || seniors > 0) ? 'low' : ((trip.tripStyle === 'relaxed') ? 'medium' : 'high'), accessibilityNeeds: accessibility,
      likedPlaces: likedNames(), favoritePlaces: favoritedNames(), skippedPlaces: rejectedNames(trip),
      likedTransport: tm.liked, skippedTransport: tm.skipped,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CROSS-TRIP TRAVEL MEMORY (Step 6) — the concierge gets smarter every trip.
  //  One PRIVATE doc per signed-in user at travelMemory/{uid} (own-only rules).
  //  We LEARN from the user's own trips (liked cuisines, places to never suggest
  //  again, favored places, stay & transport leanings, budget/pace, group shape)
  //  and APPLY them to brand-new trips so they start personalized. Additive merge
  //  only — never clobber what was learned, never override a choice the user set on
  //  the current trip. Nothing is hardcoded to a city/cuisine/mode; all derived.
  // ════════════════════════════════════════════════════════════════════════
  function emptyMemory() {
    return { uid: '', cuisines: [], rejected: [], liked: [], hotel: [], transport: { liked: [], skipped: [] }, budget: '', pace: '', kids: 0, seniors: 0, pastTrips: [], tripCount: 0, updatedAt: 0 };
  }
  // Case-insensitive de-duped union, preserving first-seen casing.
  function memUnion(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (x) { var k = String(x == null ? '' : x).trim(); var lk = k.toLowerCase(); if (k && !seen[lk]) { seen[lk] = 1; out.push(k); } });
    return out;
  }
  function normalizeMemory(m) {
    m = m || {};
    return {
      uid: m.uid || '', cuisines: memUnion(m.cuisines, []), rejected: memUnion(m.rejected, []), liked: memUnion(m.liked, []), hotel: memUnion(m.hotel, []),
      transport: { liked: memUnion((m.transport || {}).liked, []), skipped: memUnion((m.transport || {}).skipped, []) },
      budget: m.budget || '', pace: m.pace || '', kids: m.kids || 0, seniors: m.seniors || 0,
      pastTrips: Array.isArray(m.pastTrips) ? m.pastTrips.slice(0, 30) : [], tripCount: m.tripCount || 0, updatedAt: m.updatedAt || 0,
    };
  }
  // Read the signed-in user's memory once and cache it (per uid). Anonymous → empty.
  function loadTravelMemory(force) {
    var u = realUser();
    if (!u || !root.dlcDb) { state._memory = state._memory || emptyMemory(); return Promise.resolve(state._memory); }
    if (state._memory && state._memoryUid === u.uid && !force) return Promise.resolve(state._memory);
    return root.dlcDb.collection('travelMemory').doc(u.uid).get()
      .then(function (snap) { state._memory = (snap && snap.exists) ? normalizeMemory(snap.data()) : emptyMemory(); state._memoryUid = u.uid; return state._memory; })
      .catch(function () { state._memory = state._memory || emptyMemory(); return state._memory; });
  }
  function saveTravelMemory(mem) {
    var u = realUser(); if (!u || !root.dlcDb) { state._memory = mem; return Promise.resolve(mem); }
    mem.uid = u.uid; mem.updatedAt = Date.now();
    state._memory = mem; state._memoryUid = u.uid;
    return root.dlcDb.collection('travelMemory').doc(u.uid).set(mem, { merge: true }).then(function () { return mem; }).catch(function () { return mem; });
  }
  // Privacy: wipe everything we remember about this user.
  function clearTravelMemory() {
    var u = realUser(); state._memory = emptyMemory(); if (u) { state._memory.uid = u.uid; state._memoryUid = u.uid; }
    if (u && root.dlcDb) { try { root.dlcDb.collection('travelMemory').doc(u.uid).delete().catch(function () {}); } catch (e) {} }
    toast(t('mem_cleared')); render();
  }
  // LEARN: fold THIS trip's signals into the user's memory (additive). Owner-only —
  // a joined member's votes shape the owner's plan, not the member's personal memory.
  function learnFromTrip(tr) {
    tr = tr || state.trip;
    var u = realUser();
    if (!tr || tr._demo || !u || !root.dlcDb || tr.ownerUid !== u.uid) return Promise.resolve(null);
    return loadTravelMemory().then(function (cur) {
      var mem = normalizeMemory(cur), prof = buildPreferenceProfile(tr), tm = transportModePrefs();
      mem.cuisines = memUnion(mem.cuisines, prof.likedCuisines);
      mem.rejected = memUnion(mem.rejected, rejectedNames(tr));
      mem.liked = memUnion(mem.liked, preferredNames(tr));
      mem.hotel = memUnion(mem.hotel, prof.stayPrefs);
      mem.transport = { liked: memUnion(mem.transport.liked, tm.liked), skipped: memUnion(mem.transport.skipped, tm.skipped) };
      // a mode that became liked must drop out of skipped
      mem.transport.skipped = mem.transport.skipped.filter(function (mode) { return mem.transport.liked.indexOf(mode) < 0; });
      if (tr.budget) mem.budget = tr.budget;
      if (tr.tripStyle) mem.pace = tr.tripStyle;
      mem.kids = Math.max(mem.kids, prof.kids || 0);
      mem.seniors = Math.max(mem.seniors, prof.seniors || 0);
      var dests = (Array.isArray(tr.destinations) ? tr.destinations.map(function (d) { return ((d && d.city) || '').trim(); }) : []).filter(Boolean);
      if (!dests.length && tr.destination) dests = [String(tr.destination).trim()];
      var entry = { id: tr.id, name: tr.groupName || '', destinations: dests, dateRange: tr.dateRange || '', at: Date.now() };
      var past = (mem.pastTrips || []).filter(function (p) { return p && p.id !== tr.id; });
      past.unshift(entry); mem.pastTrips = past.slice(0, 30); mem.tripCount = mem.pastTrips.length;
      return saveTravelMemory(mem);
    });
  }
  // APPLY: seed a brand-new trip from memory so it starts personalized. Seeds ONLY
  // values the user hasn't set yet (defaults), carries forward "never suggest" places
  // so disliked spots don't reappear, and stashes soft prefs for the AI. Idempotent.
  function applyMemoryToNewTrip(tr) {
    tr = tr || state.trip;
    if (!tr || tr._memoryApplied) return tr;
    var mem = state._memory;
    if (!mem || (!mem.cuisines.length && !mem.rejected.length && !mem.liked.length && !mem.budget && !mem.pace)) return tr;
    tr._memoryApplied = true;
    if (mem.budget && (tr.budget === 'moderate' || !tr.budget)) tr.budget = mem.budget;
    if (mem.pace && (tr.tripStyle === 'balanced' || !tr.tripStyle)) tr.tripStyle = mem.pace;
    tr.placeOverrides = tr.placeOverrides || {};
    (mem.rejected || []).forEach(function (name) {
      var k = String(name || '').trim().toLowerCase(); if (!k || tr.placeOverrides[k]) return;
      tr.placeOverrides[k] = { name: name, action: 'skipped', createdBy: curUid() || '', createdAt: new Date().toISOString(), source: 'memory' };
    });
    tr._memorySeed = { likedCuisines: (mem.cuisines || []).slice(0, 12), likedPlaces: (mem.liked || []).slice(0, 20), hotel: (mem.hotel || []).slice(0, 8), transport: mem.transport || { liked: [], skipped: [] } };
    return tr;
  }
  // True when this user has any learned memory worth surfacing.
  function hasTravelMemory() {
    var m = state._memory; return !!(m && (m.cuisines.length || m.rejected.length || m.liked.length || m.hotel.length || m.budget || m.pace || (m.pastTrips && m.pastTrips.length)));
  }

  function votesSummaryText(trip) {
    var fav = favoritedNames().slice(0, 8), liked = likedNames().slice(0, 12), skip = rejectedNames(trip).slice(0, 12), bits = [];
    if (fav.length) bits.push('favorited: ' + fav.join(', '));
    if (liked.length) bits.push('liked: ' + liked.join(', '));
    if (skip.length) bits.push('skipped (never re-suggest): ' + skip.join(', '));
    return bits.join(' | ');
  }
  // A stable signature of all accumulated votes/favorites/transport-votes — when it differs
  // from the signature captured at the last "Optimize Trip", we nudge a re-optimize.
  function votesSignature(tr) {
    tr = tr || state.trip; if (!tr) return '';
    var parts = [];
    var v = tr.votes || {}; Object.keys(v).sort().forEach(function (pid) { var m = v[pid] || {}; Object.keys(m).sort().forEach(function (fid) { if (m[fid]) parts.push('v:' + pid + ':' + fid + '=' + m[fid]); }); });
    var f = tr.favorites || {}; Object.keys(f).sort().forEach(function (pid) { var m = f[pid] || {}; Object.keys(m).sort().forEach(function (fid) { if (m[fid]) parts.push('f:' + pid + ':' + fid); }); });
    var tv = tr.transportVotes || {}; Object.keys(tv).sort().forEach(function (k) { var m = tv[k] || {}; Object.keys(m).sort().forEach(function (fid) { if (m[fid]) parts.push('t:' + k + ':' + fid + '=' + m[fid]); }); });
    return parts.join('|');
  }
  function votedItemCount(tr) {
    tr = tr || state.trip; var s = {};
    Object.keys((tr && tr.votes) || {}).forEach(function (pid) { if (Object.keys(tr.votes[pid] || {}).length) s[pid] = 1; });
    Object.keys((tr && tr.favorites) || {}).forEach(function (pid) { if (Object.keys(tr.favorites[pid] || {}).some(function (k) { return tr.favorites[pid][k]; })) s[pid] = 1; });
    return Object.keys(s).length;
  }
  function votesChangedSinceOptimize(tr) {
    tr = tr || state.trip; if (!tr) return false;
    return votedItemCount(tr) > 0 && votesSignature(tr) !== (tr.lastOptimizedSignature || '');
  }
  // p = { id?, name }. opts.booking (default false) shows the reservation status select;
  // opts.favorite (default true) shows the ❤️ toggle. Used on EVERY voteable card type.
  function voteRow(p, opts) {
    opts = opts || {};
    var pid = p.id || p.name;
    var v = state.trip.votes[pid];
    if (typeof v !== 'object' || v === null) { v = {}; state.trip.votes[pid] = v; } // per-family map {familyId: status}
    var me = getMe();
    var counts = { like: 0, maybe: 0, skip: 0 };
    Object.keys(v).forEach(function (fid) { if (counts[v[fid]] != null) counts[v[fid]]++; });
    var row = el('div', 'tc-vote');
    [['like', '👍'], ['maybe', '🤔'], ['skip', '👎']].forEach(function (pair) {
      var st = pair[0], mine = me && v[me] === st;
      var b = el('button', 'tc-vbtn' + (mine ? ' tc-vbtn--on' : ''), pair[1] + ' ' + t('v_' + st) + (counts[st] ? ' ' + counts[st] : '')); b.type = 'button';
      b.addEventListener('click', function () {
        if (state.readonly) { toast(t('sampleReadonly')); return; }
        if (!me) { toast(t('pickFamilyHint')); return; }
        if (v[me] === st) delete v[me]; else v[me] = st;
        recomputeAutoReject(p); // a deciding skip vote rejects the place (hidden + never re-suggested)
        saveTrip(state.trip); render();
      });
      row.appendChild(b);
    });
    if (opts.favorite !== false) {
      var fav = favMap(pid), favCount = Object.keys(fav).filter(function (k) { return fav[k]; }).length;
      var fb = el('button', 'tc-vbtn tc-vbtn--fav' + (me && fav[me] ? ' tc-vbtn--on' : ''), '❤️' + (favCount ? ' ' + favCount : '')); fb.type = 'button';
      fb.addEventListener('click', function () {
        if (state.readonly) { toast(t('sampleReadonly')); return; }
        if (!me) { toast(t('pickFamilyHint')); return; }
        if (fav[me]) delete fav[me]; else fav[me] = 1;
        saveTrip(state.trip); render();
      });
      row.appendChild(fb);
    }
    var cb = consensusBadge(pid); if (cb) row.appendChild(cb);
    if (opts.booking) { // reservation status only where it makes sense (itinerary places)
      var bmap = state.trip.booking = state.trip.booking || {};
      var bk = bmap[pid] || 'not_needed';
      var bsel = selectFrom(['not_needed', 'needed', 'booked', 'skipped'], bk, function (o) { return t('b_' + o); });
      bsel.className = 'tc-input tc-booksel'; bsel.disabled = state.readonly;
      bsel.addEventListener('change', function () { if (state.readonly) return; bmap[pid] = bsel.value; recomputeAutoReject(p); saveTrip(state.trip); render(); }); // "Skipped" booking removes it from the itinerary + checklist
      row.appendChild(bsel);
    }
    return row;
  }
  // Transport-MODE vote (like/skip per family) — learns mode preferences (car/flight/Hoàng/…)
  // WITHOUT feeding the place-rejection engine (a disliked mode isn't a skipped place).
  function transportModeVote(legKey, mode) {
    var tr = state.trip; tr.transportVotes = tr.transportVotes || {};
    var k = legKey + '|' + mode, v = tr.transportVotes[k] = tr.transportVotes[k] || {}, me = getMe();
    var row = el('div', 'tc-vote tc-vote--tp');
    [['like', '👍'], ['skip', '👎']].forEach(function (pair) {
      var st = pair[0], mine = me && v[me] === st;
      var b = el('button', 'tc-vbtn' + (mine ? ' tc-vbtn--on' : ''), pair[1] + ' ' + t('v_' + st)); b.type = 'button';
      b.addEventListener('click', function () {
        if (state.readonly) { toast(t('sampleReadonly')); return; }
        if (!me) { toast(t('pickFamilyHint')); return; }
        if (v[me] === st) delete v[me]; else v[me] = st;
        saveTrip(tr); render();
      });
      row.appendChild(b);
    });
    return row;
  }
  // Group suggestions: any family can propose a place/activity; others up-vote.
  function suggestionsBlock() {
    var b = el('div', 'tc-suggest');
    b.appendChild(el('strong', 'tc-suggest__t', t('suggestionsTitle')));
    var me = getMe();
    var list = state.trip.suggestions || [];
    if (!list.length) b.appendChild(el('p', 'tc-suggest__empty', t('noSuggestions')));
    list.forEach(function (s) {
      var status = s.status || 'pending';
      var c = el('div', 'tc-suggest__item tc-suggest__item--' + status);
      var txt = el('div', 'tc-suggest__main');
      txt.appendChild(el('p', 'tc-suggest__text', s.text));
      var meta = el('div', 'tc-suggest__meta');
      meta.appendChild(el('span', 'tc-suggest__by', t('suggestedBy') + ' ' + (s.familyName || '—')));
      meta.appendChild(el('span', 'tc-sgstat tc-sgstat--' + status, t('sg_' + status)));
      txt.appendChild(meta);
      c.appendChild(txt);
      var likes = Object.keys(s.votes || {}).length;
      var lb = el('button', 'tc-vbtn' + (me && s.votes && s.votes[me] ? ' tc-vbtn--on' : ''), '👍 ' + (likes || '')); lb.type = 'button';
      lb.addEventListener('click', function () { if (state.readonly) { toast(t('sampleReadonly')); return; } if (!me) { toast(t('pickFamilyHint')); return; } s.votes = s.votes || {}; if (s.votes[me]) delete s.votes[me]; else s.votes[me] = 1; saveTrip(state.trip); render(); });
      c.appendChild(lb);
      // Owner / organizer can approve or reject (server-enforced via callable).
      if (!state.readonly && canApprove() && s.id) {
        var dec = el('div', 'tc-suggest__decide');
        if (status !== 'approved') { var ap = el('button', 'tc-pbtn tc-pbtn--accent', '✓ ' + t('approve')); ap.type = 'button'; ap.addEventListener('click', function () { ap.disabled = true; TripShare.decide(state.trip.id, s.id, 'approved').then(function () { s.status = 'approved'; render(); }).catch(function () { ap.disabled = false; toast(t('genFail')); }); }); dec.appendChild(ap); }
        if (status !== 'rejected') { var rj = el('button', 'tc-pbtn', '✕ ' + t('reject')); rj.type = 'button'; rj.addEventListener('click', function () { rj.disabled = true; TripShare.decide(state.trip.id, s.id, 'rejected').then(function () { s.status = 'rejected'; render(); }).catch(function () { rj.disabled = false; toast(t('genFail')); }); }); dec.appendChild(rj); }
        c.appendChild(dec);
      }
      b.appendChild(c);
    });
    var row = el('div', 'tc-suggest__row');
    var ip = input('', t('suggestionPh')); row.appendChild(ip);
    var add = el('button', 'tc-cta', t('suggest')); add.type = 'button';
    add.addEventListener('click', function () {
      if (state.readonly) { toast(t('sampleReadonly')); return; }
      if (!ip.value.trim()) return;
      var fam = tripFamilies().filter(function (f) { return f.id === me; })[0];
      state.trip.suggestions = state.trip.suggestions || [];
      state.trip.suggestions.push({ id: uid('sug'), text: ip.value.trim(), familyId: me || '', familyName: fam ? fam.name : '', votes: {}, status: 'pending', ts: Date.now() });
      saveTrip(state.trip); render();
    });
    row.appendChild(add); b.appendChild(row);
    return b;
  }

  function openPlaceModal(p) {
    closeModal();
    var ov = el('div', 'tc-modal'); ov.id = 'tcModal';
    var card = el('div', 'tc-modal__card');
    var head = el('div', 'tc-modal__head');
    head.appendChild(el('strong', 'tc-modal__title', p.name));
    var x = el('button', 'tc-modal__x', '×'); x.type = 'button'; x.addEventListener('click', closeModal); head.appendChild(x);
    card.appendChild(head);
    card.appendChild(placeMedia(p, 'tc-modal__media'));
    if (p.address) card.appendChild(row2('📍', p.address));
    if (p.description) card.appendChild(el('p', 'tc-modal__desc', p.description));
    if (p.whySelected) card.appendChild(kv(t('whySelected'), p.whySelected));
    if (p.bestTime) card.appendChild(kv(t('bestTime'), p.bestTime));
    if (p.estimatedDuration) card.appendChild(kv(t('duration'), p.estimatedDuration));
    if (p.estimatedCost) card.appendChild(kv(t('cost'), p.estimatedCost));
    if (p.parkingNotes) card.appendChild(kv(t('parking'), p.parkingNotes));
    if (p.tips) card.appendChild(kv(t('tips'), p.tips));
    if (p.backupPlace) card.appendChild(kv(t('backup'), p.backupPlace));
    var acts = el('div', 'tc-modal__acts');
    acts.appendChild(linkBtn(t('mapG'), p.googleMapsUrl || MapLinkProvider.google(p.name, p.address)));
    acts.appendChild(linkBtn(t('mapA'), p.appleMapsUrl || MapLinkProvider.apple(p.name, p.address)));
    if (p.websiteUrl) acts.appendChild(linkBtn(t('website'), p.websiteUrl));
    if (p.reservationUrl) acts.appendChild(linkBtn('🎟 ' + t('reserve'), p.reservationUrl, 'tc-pbtn--accent'));
    if (p.videoUrl) acts.appendChild(linkBtn('▶ ' + t('watchClip'), p.videoUrl, 'tc-pbtn--accent'));
    card.appendChild(acts);
    var _lmm = learnMoreSection(p, mediaTypeForPlace(p), p.city || ''); if (_lmm) card.appendChild(_lmm); // "Learn more" (shared with cards)
    card.appendChild(el('p', 'tc-unverified', t('unverified')));
    ov.appendChild(card);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    doc.body.appendChild(ov);
  }
  function kv(k, v) { var d = el('div', 'tc-kv'); d.appendChild(el('span', 'tc-kv__k', k)); d.appendChild(el('span', 'tc-kv__v', v)); return d; }
  function row2(icon, v) { var d = el('p', 'tc-modal__row'); d.textContent = icon + ' ' + v; return d; }
  function closeModal() { var m = doc.getElementById('tcModal'); if (m && m.parentNode) m.parentNode.removeChild(m); }

  // ── Shared-trip JOIN screen (invitee opens /travel-concierge/trip/<token>) ──
  function renderShareJoin() {
    var s = el('section', 'tc-screen tc-join');
    s.appendChild(el('span', 'tc-hero__chip', t('heroChip')));
    s.appendChild(el('h2', 'tc-screen__title', t('joinTitle')));
    var pv = state._sharePreview;
    if (pv && pv.ok) {
      var box = el('div', 'tc-joinpreview');
      box.appendChild(el('strong', 'tc-joinpreview__name', pv.groupName || ''));
      box.appendChild(el('p', 'tc-joinpreview__dest', (pv.destination || '') + (pv.dateRange ? ' · ' + pv.dateRange : '')));
      s.appendChild(box);
    } else if (pv && !pv.ok) {
      s.appendChild(el('div', 'tc-bnotice', t('joinDisabled')));
    }
    var pc = input('', t('joinPasscodePrompt')); pc.setAttribute('inputmode', 'numeric'); pc.autocomplete = 'off'; s.appendChild(field(t('sharePasscodeLabel'), pc));
    var nm = input('', ''); nm.autocomplete = 'name'; s.appendChild(field(t('yourName'), nm));
    // Family: pick an existing family, add a new one, or "just me".
    var fams = (pv && pv.families) || [];
    var famSel = doc.createElement('select'); famSel.className = 'tc-input';
    [['', t('chooseFamily')]].concat(fams.map(function (f) { return [f.id, f.name]; })).concat([['__new__', t('addMyFamily')], ['__none__', t('newMemberOpt')]]).forEach(function (o) { var op = doc.createElement('option'); op.value = o[0]; op.textContent = o[1]; famSel.appendChild(op); });
    s.appendChild(field(t('chooseFamily'), famSel));
    var newFamIn = input('', t('familyNamePh'));
    var newFamWrap = field(t('familyName'), newFamIn); newFamWrap.style.display = 'none';
    s.appendChild(newFamWrap);
    famSel.addEventListener('change', function () { newFamWrap.style.display = famSel.value === '__new__' ? '' : 'none'; });
    // Requested role (owner approves organizer)
    var reqRole = 'member';
    s.appendChild(field(t('roleRequested'), seg(['member', 'organizer'], 'member', 'role_', function (v) { reqRole = v; })));
    var emailIn = input('', ''); emailIn.type = 'email'; emailIn.autocomplete = 'email'; s.appendChild(field(t('emailOptional'), emailIn));
    var err = el('p', 'tc-login__err'); err.style.display = state._joinError ? 'block' : 'none';
    if (state._joinError) err.textContent = state._joinError === 'rate_limited' ? t('joinRateLimited') : (state._joinError === 'disabled' ? t('joinDisabled') : t('joinBadPasscode'));
    s.appendChild(err);
    var go = el('button', 'tc-cta', t('joinBtn')); go.type = 'button';
    go.addEventListener('click', function () {
      var passcode = pc.value.trim(), name = nm.value.trim();
      if (!passcode) { err.style.display = 'block'; err.textContent = t('required'); return; }
      var fid = famSel.value, fname = '';
      if (fid === '__new__') { fid = ''; fname = newFamIn.value.trim(); }
      else if (fid === '__none__') { fid = ''; }
      state._joinPending = { token: state._shareToken, info: { passcode: passcode, displayName: name, familyId: fid, familyName: fname, requestedRole: reqRole, email: emailIn.value.trim() } };
      state._joinError = null;
      requireLogin(function () { doJoinPending(); });
    });
    s.appendChild(go);
    var back = el('button', 'tc-login__switch', t('backHome')); back.type = 'button';
    back.addEventListener('click', function () { state._shareToken = null; state._joinError = null; newTrip(); state.screen = 'hero'; pushTripUrl(null); render(); });
    s.appendChild(back);
    return s;
  }
  function doJoinPending() {
    var jp = state._joinPending; if (!jp) { state.screen = 'hero'; return render(); }
    var info = jp.info || {};
    state.screen = 'sharejoin'; renderGenerating(t('joining'));
    TripShare.join(jp.token, info.passcode, info).then(function (r) {
      if (!r || !r.ok) { state._joinError = (r && r.reason) || 'bad_passcode'; state.screen = 'sharejoin'; render(); return; }
      state._joinPending = null; state._joinError = null; state._shareToken = null; pushTripUrl(r.tripId);
      // Remember this member's trip session locally (so we skip the passcode next time)
      // and index it under "Trips you joined" on the dashboard.
      setMemberSession(r.tripId, { tripId: r.tripId, displayName: r.displayName || info.displayName || '', familyId: r.familyId || '', familyName: r.familyName || '', role: r.role || 'member' });
      if ((r.role || 'member') !== 'owner') rememberJoinedTrip(r.tripId);
      state._joinedTrips = null;
      loadTrip(r.tripId).then(function (tr) {
        if (tr && tr.plan) { state.trip = tr; normalizeDestinations(state.trip); state.trip._demo = false; state.readonly = false; state.screen = 'plan'; state.activeTab = 'overview'; resolveMyRole().then(render); }
        else { newTrip(); state.screen = 'hero'; render(); }
      });
    }).catch(function () { state._joinError = 'bad_passcode'; state.screen = 'sharejoin'; render(); });
  }

  // ── Share modal (owner): invite link + passcode + members + controls ──
  function fmtTs(ts) { try { if (ts && typeof ts.toDate === 'function') return ts.toDate().toLocaleDateString(); if (typeof ts === 'number') return new Date(ts).toLocaleDateString(); } catch (e) {} return ''; }
  function reopenShare() { closeModal(); openShareModal(); }
  function renderMemberList() {
    var wrap = el('div', 'tc-members');
    wrap.appendChild(el('strong', 'tc-members__t', t('membersTitle')));
    var list = state._members || [], owner = (state.myRole === 'owner'), contacts = state._contacts || {}, fams = tripFamilies();
    if (!list.length) { wrap.appendChild(el('p', 'tc-share__perm', '—')); return wrap; }
    list.forEach(function (m) {
      var pending = !!m.pending;
      var row = el('div', 'tc-member');
      var main = el('div', 'tc-member__main');
      var line1 = el('div', 'tc-member__line');
      line1.appendChild(el('span', 'tc-member__name', m.displayName || (pending ? '—' : String(m.uid || '').slice(0, 6))));
      line1.appendChild(el('span', 'tc-rolepill tc-rolepill--' + (pending ? 'pending' : (m.role || 'member')), pending ? t('invitedPending') : t('role_' + (m.role || 'member'))));
      main.appendChild(line1);
      var meta = [];
      if (m.familyName) meta.push('👪 ' + m.familyName);
      if (owner && contacts[m.uid] && contacts[m.uid].phone) meta.push('📞 ' + contacts[m.uid].phone);
      if (m.joinedAt) meta.push(t('joinedLabel') + ' ' + fmtTs(m.joinedAt));
      if (m.lastActiveAt) meta.push(t('lastActiveLabel') + ' ' + fmtTs(m.lastActiveAt));
      if (!pending && m.requestedRole === 'organizer' && m.role === 'member') meta.push('↑ ' + t('role_organizer') + '?');
      if (meta.length) main.appendChild(el('span', 'tc-member__meta', meta.join(' · ')));
      row.appendChild(main);
      if (owner && m.role !== 'owner') {
        var ctrls = el('div', 'tc-member__ctrls');
        var fsel = doc.createElement('select'); fsel.className = 'tc-input tc-member__fam';
        var o0 = doc.createElement('option'); o0.value = ''; o0.textContent = t('assignFamilyBtn') + '…'; fsel.appendChild(o0);
        fams.forEach(function (f) { var o = doc.createElement('option'); o.value = f.id; o.textContent = f.name; if (f.id === m.familyId) o.selected = true; fsel.appendChild(o); });
        fsel.addEventListener('change', function () { TripShare.setFamily(state.trip.id, m.uid, fsel.value, '').then(function () { loadMembers().then(reopenShare); }); });
        ctrls.appendChild(fsel);
        if (!pending) { var pro = el('button', 'tc-pbtn', m.role === 'organizer' ? t('demote') : t('promote')); pro.type = 'button'; pro.addEventListener('click', function () { pro.disabled = true; TripShare.setRole(state.trip.id, m.uid, m.role === 'organizer' ? 'member' : 'organizer').then(function () { loadMembers().then(reopenShare); }).catch(function () { pro.disabled = false; }); }); ctrls.appendChild(pro); }
        var rm = el('button', 'tc-pbtn', '🗑'); rm.type = 'button'; rm.setAttribute('aria-label', t('removeDestination')); rm.addEventListener('click', function () { rm.disabled = true; TripShare.remove(state.trip.id, m.uid).then(function () { loadMembers().then(reopenShare); }).catch(function () { rm.disabled = false; }); }); ctrls.appendChild(rm);
        row.appendChild(ctrls);
      }
      wrap.appendChild(row);
    });
    return wrap;
  }
  // Owner-only: manually invite a member (pre-assign family/role by phone).
  function inviteMemberForm() {
    var box = el('div', 'tc-invite');
    box.appendChild(el('strong', 'tc-members__t', t('addMemberBtn')));
    var nm = input('', t('yourName')); box.appendChild(field(t('yourName'), nm));
    var ph = input('', ''); ph.type = 'tel'; ph.setAttribute('inputmode', 'tel'); box.appendChild(field(t('memberPhone'), ph));
    var fams = tripFamilies();
    var fsel = doc.createElement('select'); fsel.className = 'tc-input';
    [['', t('chooseFamily')]].concat(fams.map(function (f) { return [f.id, f.name]; })).forEach(function (o) { var op = doc.createElement('option'); op.value = o[0]; op.textContent = o[1]; fsel.appendChild(op); });
    box.appendChild(field(t('assignFamilyBtn'), fsel));
    var role = 'member';
    box.appendChild(field(t('roleRequested'), seg(['member', 'organizer'], 'member', 'role_', function (v) { role = v; })));
    var add = el('button', 'tc-cta', '+ ' + t('addMemberBtn')); add.type = 'button';
    add.addEventListener('click', function () {
      if (!ph.value.trim()) { ph.focus(); return; }
      add.disabled = true;
      TripShare.invite(state.trip.id, { displayName: nm.value.trim(), phone: ph.value.trim(), familyId: fsel.value, role: role })
        .then(function () { loadMembers().then(reopenShare); }).catch(function () { add.disabled = false; });
    });
    box.appendChild(add);
    return box;
  }
  function openShareModal() {
    var tr = state.trip; if (!tr || !isOwnerOfTrip()) return;
    closeModal();
    var ov = el('div', 'tc-modal'); ov.id = 'tcModal';
    var card = el('div', 'tc-modal__card');
    var head = el('div', 'tc-modal__head');
    head.appendChild(el('strong', 'tc-modal__title', t('shareModalTitle')));
    var x = el('button', 'tc-modal__x', '×'); x.type = 'button'; x.addEventListener('click', closeModal); head.appendChild(x);
    card.appendChild(head);
    var body = el('div', 'tc-share2'); card.appendChild(body);
    ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); }); doc.body.appendChild(ov);
    function paint(info, disabled) {
      body.innerHTML = '';
      if (!info) { body.appendChild(el('p', 'tc-gen__msg', t('shareGenerating'))); return; }
      if (disabled) body.appendChild(el('div', 'tc-bnotice', t('sharingDisabled')));
      var link = shareLinkFor(info.shareToken);
      body.appendChild(el('span', 'tc-field__lbl', t('shareLinkLabel')));
      var lrow = el('div', 'tc-share__row'); var li = input(link, ''); li.readOnly = true; lrow.appendChild(li);
      var cp = el('button', 'tc-cta', t('copyLink')); cp.type = 'button'; cp.addEventListener('click', function () { copyText(link); toast(t('copied')); }); lrow.appendChild(cp);
      body.appendChild(lrow);
      body.appendChild(el('span', 'tc-field__lbl', t('sharePasscodeLabel')));
      var prow = el('div', 'tc-share__row');
      prow.appendChild(el('div', 'tc-passcode', info.passcode || '••••••'));
      var cpp = el('button', 'tc-cta', t('copyPasscode')); cpp.type = 'button'; cpp.addEventListener('click', function () { copyText(info.passcode || ''); toast(t('passcodeCopied')); }); prow.appendChild(cpp);
      body.appendChild(prow);
      body.appendChild(el('p', 'tc-share__perm', t('sharePermInfo')));
      var acts = el('div', 'tc-share__acts');
      var regen = el('button', 'tc-addbtn', t('regeneratePasscode')); regen.type = 'button';
      regen.addEventListener('click', function () {
        if (root.confirm && !root.confirm(t('shareRegenWarn'))) return;
        paint(null);
        TripShare.create(tr.id, '', '').then(function (r) { if (r && r.ok) { var ni = { shareToken: r.shareToken, passcode: r.passcode }; cacheShareInfo(tr.id, ni); state._shareInfo = ni; paint(ni, false); } else paint(info, disabled); }).catch(function () { paint(info, disabled); });
      });
      acts.appendChild(regen);
      var toggle = el('button', 'tc-addbtn', disabled ? t('enableSharing') : t('disableSharing')); toggle.type = 'button';
      toggle.addEventListener('click', function () { toggle.disabled = true; TripShare.setEnabled(tr.id, disabled).then(function () { paint(info, !disabled); }).catch(function () { toggle.disabled = false; }); });
      acts.appendChild(toggle);
      body.appendChild(acts);
      body.appendChild(renderMemberList());
      body.appendChild(inviteMemberForm());
    }
    var cached = cachedShareInfo(tr.id);
    Promise.all([loadMembers(), loadMemberContacts()]).then(function () {
      if (cached) { state._shareInfo = cached; paint(cached, false); }
      else { paint(null); TripShare.create(tr.id, '', '').then(function (r) { if (r && r.ok) { var ni = { shareToken: r.shareToken, passcode: r.passcode }; cacheShareInfo(tr.id, ni); state._shareInfo = ni; paint(ni, false); } else { body.innerHTML = ''; body.appendChild(el('p', 'tc-login__err', t('genFail'))); } }).catch(function () { body.innerHTML = ''; body.appendChild(el('p', 'tc-login__err', t('genFail'))); }); }
    });
  }

  function methodIcon(m) { return ({ car: '🚗', plane: '✈', bus: '🚌', other: '🧭' })[m] || '🧭'; }
  function normStatus(s) { var ok = ['planning', 'booked', 'on_the_way', 'arrived']; return ok.indexOf(s) !== -1 ? s : 'planning'; }

  // ── "Where to Stay" tab: AI lodging research (areas + hotel/Airbnb options) ──
  function stayCatIcon(c) { return ({ best_overall: '🏆', best_value: '💰', family: '👨‍👩‍👧', luxury: '✨', resort: '🏖', ocean_view: '🌊', food_area: '🍜', theme_parks: '🎢', disneyland: '🏰', budget: '💵', pool: '🏊', breakfast: '🥐', kitchen: '🍳', accessible: '♿' })[c] || '🏨'; }
  function stayCard(h, city) {
    var tr = state.trip, c = el('article', 'tc-stay tc-hotelcard');
    // Real verified hotel photo when resolvable (Google Places via placeMedia), else a
    // clearly-labelled placeholder — never an AI image passed off as a real photo.
    c.appendChild(placeMedia({ name: h.name || (h.area || city), category: 'lodging', address: h.area || '', city: city, imageUrl: null }, 'tc-place__media tc-foodcard__media'));
    var head = el('div', 'tc-stay__head');
    head.appendChild(el('strong', 'tc-stay__name', h.name || (t('bestArea') + ': ' + (h.area || city || ''))));
    var cat = h.category || h.bestFor || 'best_value';
    head.appendChild(el('span', 'tc-stay__for', stayCatIcon(cat) + ' ' + (t('stayfor_' + cat) || cat)));
    c.appendChild(head);
    var meta = el('div', 'tc-hotelcard__meta');
    if (h.starRating) meta.appendChild(chip('tc-chip--star', '⭐ ' + h.starRating + (h.reviewCount ? (' · ' + h.reviewCount) : '')));
    if (h.area && h.name) meta.appendChild(chip('', '📍 ' + h.area));
    if (h.oceanDistance) meta.appendChild(chip('', '🌊 ' + h.oceanDistance));
    if (h.breakfast) meta.appendChild(chip('', '🥐 ' + t('amBreakfast')));
    if (h.kitchen) meta.appendChild(chip('', '🍳 ' + t('amKitchen')));
    if (h.pool) meta.appendChild(chip('', '🏊 ' + t('amPool')));
    if (h.familySuite) meta.appendChild(chip('', '👨‍👩‍👧 ' + t('amFamilySuite')));
    if (meta.children.length) c.appendChild(meta);
    (h.attractionDistances || []).forEach(function (a) { if (a && a.name) c.appendChild(el('p', 'tc-stay__meta', '🚗 ' + a.name + (a.distance ? (': ' + a.distance) : ''))); });
    if (h.distanceNote) c.appendChild(el('p', 'tc-stay__meta', t('distanceLabel') + ': ' + h.distanceNote));
    if (h.amenities && h.amenities.length) c.appendChild(el('p', 'tc-stay__meta', h.amenities.join(' · ')));
    if (h.parkingNote) c.appendChild(el('p', 'tc-stay__meta', t('parkingLabel') + ': ' + h.parkingNote));
    c.appendChild(el('p', 'tc-stay__meta', '💵 ' + (h.priceRange || t('pending'))));
    if (h.why) { var w = el('p', 'tc-stay__why'); w.appendChild(el('span', 'tc-bk__rec-k', t('recommended') + ': ')); w.appendChild(doc.createTextNode(h.why)); c.appendChild(w); }
    var acts = el('div', 'tc-stay__acts');
    // Real provider SEARCH links (no fabricated listings/prices): Booking, Expedia, Hotels.com, reviews, map.
    acts.appendChild(linkBtn('🔎 ' + t('stayBooking'), StayLinkProvider.booking(h, city), 'tc-pbtn--accent'));
    acts.appendChild(linkBtn(t('stayExpedia'), StayLinkProvider.expedia(h, city)));
    acts.appendChild(linkBtn(t('stayHotels'), StayLinkProvider.hotels(h, city)));
    acts.appendChild(linkBtn('⭐ ' + t('stayReviews'), StayLinkProvider.tripadvisor(h, city)));
    acts.appendChild(linkBtn('🗺 ' + t('mapG'), StayLinkProvider.photos(h, city)));
    if (!state.readonly && !tr._demo) {
      var addbk = el('button', 'tc-pbtn', '🎟 ' + t('addBooking')); addbk.type = 'button';
      addbk.addEventListener('click', function () { tr.bookings = tr.bookings || []; tr.bookings.push(newBooking('hotel', (h.name || (t('whereToStayTitle') + ' — ' + (city || ''))), { city: city || '', priceRange: h.priceRange || '', recommendedOption: h.why || '', dataSource: 'ai_researched_pending_verification' })); saveTrip(tr); toast(t('addBooking')); });
      acts.appendChild(addbk);
    }
    c.appendChild(acts);
    var _lmh = learnMoreSection(h, 'hotel', city); if (_lmh) c.appendChild(_lmh); // "Learn more"
    if (!state.readonly && (h.name || h.area)) c.appendChild(voteRow({ name: hotelVoteName(h, city) }));
    return c;
  }
  function stayStrategyIcon(n) { return ({ single_base: '🏠', split_nights: '🔀', cheapest: '💰', near_attraction: '🎯' })[n] || '🏨'; }
  function stayStrategyCard(s) {
    var c = el('article', 'tc-staystrat' + (s.recommended ? ' tc-staystrat--rec' : ''));
    var head = el('div', 'tc-staystrat__head');
    head.appendChild(el('strong', 'tc-staystrat__name', stayStrategyIcon(s.name) + ' ' + (s.label || t('strat_' + s.name) || s.name)));
    if (s.recommended) head.appendChild(el('span', 'tc-staystrat__badge', '🏆 ' + t('recommended')));
    c.appendChild(head);
    if (s.nights && s.nights.length) {
      var ng = el('div', 'tc-staystrat__nights');
      s.nights.forEach(function (n) { if (n && n.city) ng.appendChild(chip('', '🌙 ' + (n.nights || '') + ' · ' + (n.city || '').split(',')[0])); });
      if (ng.children.length) c.appendChild(ng);
    }
    var g = el('div', 'tc-staystrat__grid');
    if (s.costRange) g.appendChild(kv(t('tpCost'), s.costRange));
    if (s.driving) g.appendChild(kv(t('stratDriving'), s.driving));
    if (s.convenience) g.appendChild(kv(t('stratConvenience'), s.convenience));
    if (s.kidsNote) g.appendChild(kv(t('stratKids'), s.kidsNote));
    if (s.foodNote) g.appendChild(kv(t('stratFood'), s.foodNote));
    if (g.children.length) c.appendChild(g);
    if (s.why) { var w = el('p', 'tc-stay__why'); w.appendChild(el('span', 'tc-bk__rec-k', t('tpWhy') + ' ')); w.appendChild(doc.createTextNode(s.why)); c.appendChild(w); }
    return c;
  }
  // Proactive auto-research so the user never has to hunt for a "Search hotels" button.
  function autoResearchStays(tr) {
    state._cResearch = state._cResearch || {}; state._cResearch.stays = true;
    researchStays(tr).then(function (res) { state._cResearch.stays = false; if (res.stays && res.stays.length) { tr.stays = res.stays; tr.stayStrategies = res.strategies || []; checkHotelDeals(tr); saveTrip(tr); } render(); }).catch(function () { state._cResearch.stays = false; render(); });
  }
  function renderStays(plan) {
    var tr = state.trip;
    var wrap = el('div', 'tc-stays');
    wrap.appendChild(el('strong', 'tc-stays__t', '🏨 ' + t('whereToStayTitle')));
    wrap.appendChild(el('p', 'tc-stays__sub', t('staysSub')));
    var stays = (tr.stays && tr.stays.length) ? tr.stays : [];
    var needHotel = Array.isArray(tr.destinations) && tr.destinations.some(function (d) { return d && (d.city || '').trim() && d.hotelNeeded !== false; });
    // Proactively research on first open if we have lodging stops and nothing yet (once).
    if (!state.readonly && !tr._demo && !stays.length && needHotel && !isResearching('stays') && state._staysAutoFor !== tr.id) {
      state._staysAutoFor = tr.id; autoResearchStays(tr);
    }
    if (!state.readonly && !tr._demo) {
      var find = el('button', 'tc-cta', (stays.length ? ('↻ ' + t('refreshStays')) : t('findStays'))); find.type = 'button';
      find.addEventListener('click', function () { if (isResearching('stays')) return; autoResearchStays(tr); render(); });
      wrap.appendChild(find);
    }
    if (isResearching('stays') && !stays.length) { wrap.appendChild(researchBanner('researchingStays')); return wrap; }
    if (!stays.length) { wrap.appendChild(el('p', 'tc-empty', t('noStaysYet'))); return wrap; }
    // Multi-destination STRATEGY comparison (single-base / split-nights / cheapest) — the AI
    // recommends one with cost + driving + convenience + kids + food tradeoffs.
    var strat = (tr.stayStrategies && tr.stayStrategies.length) ? tr.stayStrategies : [];
    if (strat.length) {
      wrap.appendChild(el('strong', 'tc-stays__sub2', '🧭 ' + t('stayStrategiesTitle')));
      wrap.appendChild(el('p', 'tc-hint', t('stayStrategiesSub')));
      strat.forEach(function (s) { wrap.appendChild(stayStrategyCard(s)); });
    }
    stays.forEach(function (s) {
      var block = el('div', 'tc-stayblock');
      var head = el('div', 'tc-stayblock__head');
      head.appendChild(el('strong', 'tc-stayblock__city', '📍 ' + (s.city || '')));
      if (s.bestArea) head.appendChild(el('span', 'tc-stayblock__area', t('bestArea') + ': ' + s.bestArea));
      block.appendChild(head);
      if (s.whyArea) block.appendChild(el('p', 'tc-stayblock__why', s.whyArea));
      // "Best areas" panel — the proactive "I never would've thought of staying there" picks.
      if (s.bestAreas && s.bestAreas.length) {
        var bab = el('div', 'tc-bestareas');
        bab.appendChild(el('strong', 'tc-bestareas__t', '📍 ' + t('bestAreasTitle')));
        s.bestAreas.forEach(function (a) {
          var bac = el('div', 'tc-bestarea');
          bac.appendChild(el('strong', 'tc-bestarea__name', a.area || ''));
          if (a.why) bac.appendChild(el('p', 'tc-bestarea__why', a.why));
          (a.reasons || []).forEach(function (rsn) { bac.appendChild(el('span', 'tc-bestarea__reason', '✓ ' + rsn)); });
          bab.appendChild(bac);
        });
        block.appendChild(bab);
      }
      var hotelsF = (s.hotels || []).filter(function (h) { return !rejectedNameSet(tr)[hotelVoteName(h, s.city).trim().toLowerCase()]; });
      var hn = voteSortNote(hotelsF, function (h) { return hotelVoteName(h, s.city); }); if (hn) block.appendChild(hn);
      consensusSort(hotelsF, function (h) { return hotelVoteName(h, s.city); }).forEach(function (h) { block.appendChild(stayCard(h, s.city)); });
      if (s.airbnbAreas && s.airbnbAreas.length) {
        block.appendChild(el('strong', 'tc-stays__sub2', t('airbnbAreasTitle')));
        s.airbnbAreas.forEach(function (ab) {
          var ac = el('div', 'tc-abnb');
          var ah = el('div', 'tc-stay__head');
          ah.appendChild(el('strong', 'tc-stay__name', '🏠 ' + (ab.area || '')));
          if (ab.bestFor) ah.appendChild(el('span', 'tc-stay__for', t('stayfor_' + ab.bestFor) || ab.bestFor));
          ac.appendChild(ah);
          if (ab.why) ac.appendChild(el('p', 'tc-stay__meta', ab.why));
          ac.appendChild(linkBtn('🔎 ' + t('searchAirbnbBtn'), StayLinkProvider.airbnb(ab.area, s.city)));
          block.appendChild(ac);
        });
      }
      block.appendChild(el('p', 'tc-unverified', t('unverified')));
      wrap.appendChild(block);
    });
    return wrap;
  }

  // ── Food Picks tab: AI-researched restaurants per stop (recommend only) ──
  function foodCard(p, city) {
    var tr = state.trip, c = el('article', 'tc-stay tc-foodcard');
    // Media: real Wikipedia photo of the actual place if resolvable, else a clearly-labelled
    // generic image — never an AI image passed off as a real restaurant photo (Issue #3).
    c.appendChild(placeMedia({ name: p.name, category: 'restaurant', address: p.address || '', city: city, imageUrl: null }, 'tc-place__media tc-foodcard__media'));
    var head = el('div', 'tc-stay__head');
    head.appendChild(el('strong', 'tc-stay__name', '🍽 ' + (p.name || (p.cuisine || t('foodPicksTitle')))));
    head.appendChild(el('span', 'tc-stay__for', t('foodfor_' + (p.bestFor || 'groups')) || p.bestFor));
    c.appendChild(head);
    if (p.cuisine) c.appendChild(el('p', 'tc-stay__meta', '🍲 ' + p.cuisine));
    if (p.address) c.appendChild(el('p', 'tc-stay__meta', '📍 ' + p.address));
    if (p.dishes && p.dishes.length) c.appendChild(el('p', 'tc-stay__meta', '🍜 ' + t('popularDishesLabel') + ': ' + p.dishes.join(' · ')));
    if (p.mustTry && p.mustTry.length) c.appendChild(el('p', 'tc-stay__meta', '⭐ ' + t('mustTryLabel') + ': ' + p.mustTry.join(' · ')));
    if (p.rating) c.appendChild(el('p', 'tc-stay__meta', '★ ' + p.rating));
    if (p.priceRange) c.appendChild(el('p', 'tc-stay__meta', '💵 ' + p.priceRange));
    if (p.kidSuitability) c.appendChild(el('p', 'tc-stay__meta', '🧒 ' + p.kidSuitability));
    if (p.parkingNote) c.appendChild(el('p', 'tc-stay__meta', t('parkingLabel') + ': ' + p.parkingNote));
    if (p.reservationNote) c.appendChild(el('p', 'tc-stay__meta', t('reservationLabel') + ': ' + p.reservationNote));
    if (p.why) { var w = el('p', 'tc-stay__why'); w.appendChild(el('span', 'tc-bk__rec-k', t('recommended') + ': ')); w.appendChild(doc.createTextNode(p.why)); c.appendChild(w); }
    // (Photos / reviews / menu links live in the media panel above — see placeMedia.)
    var acts = el('div', 'tc-stay__acts');
    acts.appendChild(linkBtn('🗺 ' + t('mapG'), MapLinkProvider.google(p.name, city)));
    acts.appendChild(linkBtn('🌐 ' + t('website'), FoodLinkProvider.website(p.name, city)));
    if (!state.readonly && !tr._demo) {
      var addbk = el('button', 'tc-pbtn', '🎟 ' + t('addBooking')); addbk.type = 'button';
      addbk.addEventListener('click', function () { tr.bookings = tr.bookings || []; tr.bookings.push(newBooking('restaurant', (p.name || ((p.cuisine || '') + ' — ' + (city || ''))), { city: city || '', priceRange: p.priceRange || '', recommendedOption: p.why || '', dataSource: 'ai_researched_pending_verification' })); saveTrip(tr); toast(t('addBooking')); });
      acts.appendChild(addbk);
    }
    c.appendChild(acts);
    var _lmf = learnMoreSection({ name: p.name, address: p.address || '', city: city }, 'restaurant', city); if (_lmf) c.appendChild(_lmf); // "Learn more" media enrichment
    if (!state.readonly && p.name) c.appendChild(voteRow({ name: p.name, category: 'restaurant', cuisine: p.cuisine || '' }));
    return c;
  }
  // ════════════════════════════════════════════════════════════════════════
  //  TRANSPORT TAB (Phase B) — "How you'll get there". Per-leg mode comparison
  //  from the AI Transportation Agent; car/DLC-ride distance+time are verified
  //  (or labelled estimate), flight/bus/train are clearly-labelled estimates +
  //  search links. Editable; selecting an option can replan itinerary timing;
  //  a relevant DuLichCali ride hands off to the existing booking flow (no auto-confirm).
  // ════════════════════════════════════════════════════════════════════════
  var TP_MODES = { personal_car: '🚗', rental_car: '🚙', flight: '✈️', bus: '🚌', hoang_bus: '🚌', train: '🚆', dlc_ride: '🚐' };
  function tpIcon(m) { return TP_MODES[m] || '🧭'; }
  function legKeyOf(leg, i) { return (leg.legType || 'leg') + ':' + (leg.fromCity || '') + '>' + (leg.toCity || '') + ':' + i; }
  function tpNormMethod(mode) { return (mode === 'flight') ? 'plane' : (mode === 'bus' || mode === 'hoang_bus') ? 'bus' : (mode === 'train') ? 'other' : 'car'; }
  // Client mirror of the server's Xe Đò Hoàng service-area detector (Bay Area ↔ SoCal/AZ/NV) —
  // used only to self-heal trips whose saved transport predates the Hoàng fix.
  function tcHoangRegion(city) {
    var s = String(city || '').toLowerCase().trim(); if (!s) return false;
    if (/\b(ca|calif|california|az|ariz|arizona|nv|nev|nevada)\b/.test(s)) return true;
    var A = ['san jose', 'san francisco', 'oakland', 'san mateo', 'santa clara', 'sunnyvale', 'milpitas', 'fremont', 'hayward', 'sacramento', 'stockton', 'elk grove', 'bay area', 'los angeles', 'orange county', 'westminster', 'garden grove', 'santa ana', 'anaheim', 'fountain valley', 'huntington beach', 'little saigon', 'el monte', 'rosemead', 'san gabriel', 'alhambra', 'monterey park', 'san diego', 'phoenix'];
    for (var i = 0; i < A.length; i++) { if (s.indexOf(A[i]) >= 0) return true; }
    return false;
  }
  function tpStatusTag(status) {
    if (status === 'verified') return el('span', 'tc-routesrc tc-routesrc--ok', '✓ ' + t('tpVerified'));
    if (status === 'estimated') return el('span', 'tc-routesrc', '≈ ' + t('tpEstimate'));
    return el('span', 'tc-routesrc tc-routesrc--warn', '? ' + t('tpNeedsConfirm'));
  }
  // Pros/cons may arrive as AI free text (o.pros/o.cons) OR deterministic KEYS (o.prosKeys/
  // o.consKeys) — localize keys via t() so the deterministic builder stays multilingual.
  function tpProsText(o) { if (o.pros && o.pros.length) return o.pros; return (o.prosKeys || []).map(function (k) { return t(k); }); }
  function tpConsText(o) { if (o.cons && o.cons.length) return o.cons; return (o.consKeys || []).map(function (k) { return t(k); }); }
  function tpConvLabel(n) { n = Math.max(0, Math.min(5, Math.round(n || 0))); var s = ''; for (var i = 0; i < 5; i++) s += (i < n ? '★' : '☆'); return s; }
  function tpSuitScore(s) { return s === 'good' ? 2 : (s === 'ok' ? 1 : 0); }
  function tpFamilyRank(o) { return tpSuitScore(o.childSuitability) * 2 + tpSuitScore(o.seniorSuitability) + tpSuitScore(o.luggageSuitability) + (o.convenience || 0) * 0.5; }
  function toggleTransportBooked(leg, i) {
    var tr = state.trip; tr.transportStatus = tr.transportStatus || {};
    var key = legKeyOf(leg, i);
    tr.transportStatus[key] = (tr.transportStatus[key] === 'booked') ? 'planning' : 'booked';
    saveTrip(tr); toast(t(tr.transportStatus[key] === 'booked' ? 'tpBookedToast' : 'tpUnbookedToast')); render();
  }
  function tpParseCost(o) { var m = String(o && o.totalCostRange || '').replace(/,/g, '').match(/\d+/); return m ? parseInt(m[0], 10) : Infinity; }
  function tpParseDur(o) { var s = String(o && o.durationText || ''), h = (s.match(/(\d+)\s*h/) || [])[1], mn = (s.match(/(\d+)\s*m/) || [])[1]; var v = (parseInt(h || 0, 10) * 60) + parseInt(mn || 0, 10); return v || Infinity; }
  function tpComfortRank(o) { var order = { dlc_ride: 5, flight: 4, rental_car: 3, personal_car: 3, hoang_bus: 2, train: 2, bus: 1 }; var base = order[o.mode] || 0; var bonus = (o.seniorSuitability === 'good' ? 1 : 0) + (o.childSuitability === 'good' ? 1 : 0); return base + bonus; }
  // Least-tiring (no self-driving + restful), scenic value (by mode) — for the best-for ranks.
  function tpTireScore(o) { var m = { dlc_ride: 5, train: 5, flight: 4, hoang_bus: 4, bus: 3, rental_car: 2, personal_car: 2 }; return (m[o.mode] || 0) + (o.seniorSuitability === 'good' ? 1 : 0); }
  function tpScenicScore(o) { var m = { train: 5, personal_car: 4, rental_car: 4, hoang_bus: 3, dlc_ride: 3, bus: 2, flight: 1 }; return m[o.mode] || 0; }
  function tpPick(leg, criterion) {
    var opts = (leg.options || []); if (!opts.length) return null;
    if (criterion === 'recommended') return opts.filter(function (o) { return o.mode === leg.recommendedMode; })[0] || opts[0];
    if (criterion === 'cheapest') return opts.slice().sort(function (a, b) { return tpParseCost(a) - tpParseCost(b); })[0];
    if (criterion === 'fastest') return opts.slice().sort(function (a, b) { return tpParseDur(a) - tpParseDur(b); })[0];
    if (criterion === 'comfort') return opts.slice().sort(function (a, b) { return tpComfortRank(b) - tpComfortRank(a); })[0];
    if (criterion === 'family') return opts.slice().sort(function (a, b) { return tpFamilyRank(b) - tpFamilyRank(a); })[0];
    if (criterion === 'seniors') return opts.slice().sort(function (a, b) { return (tpSuitScore(b.seniorSuitability) * 2 + tpComfortRank(b)) - (tpSuitScore(a.seniorSuitability) * 2 + tpComfortRank(a)); })[0];
    if (criterion === 'kids') return opts.slice().sort(function (a, b) { return (tpSuitScore(b.childSuitability) * 2 + (b.convenience || 0)) - (tpSuitScore(a.childSuitability) * 2 + (a.convenience || 0)); })[0];
    if (criterion === 'least_tiring') return opts.slice().sort(function (a, b) { return tpTireScore(b) - tpTireScore(a); })[0];
    if (criterion === 'luggage') return opts.slice().sort(function (a, b) { return (tpSuitScore(b.luggageSuitability) - tpSuitScore(a.luggageSuitability)) || ((b.convenience || 0) - (a.convenience || 0)); })[0];
    if (criterion === 'scenic') return opts.slice().sort(function (a, b) { return tpScenicScore(b) - tpScenicScore(a); })[0];
    if (criterion === 'dlc') return opts.filter(function (o) { return o.canBookViaDLC; })[0] || null;
    return null;
  }
  function chosenMode(leg, i) { var key = legKeyOf(leg, i); var ch = (state.trip.transportChoice || {})[key]; return ch || leg.recommendedMode || ((leg.options || [])[0] || {}).mode || ''; }
  function chooseTransport(leg, i, mode) {
    var tr = state.trip; tr.transportChoice = tr.transportChoice || {};
    var prevMode = chosenMode(leg, i); // current choice BEFORE overwrite — for switch-savings feedback
    tr.transportChoice[legKeyOf(leg, i)] = mode;
    // Outbound choice drives each family's travel method (return-day plan + summaries use it).
    if (leg.legType === 'outbound' && Array.isArray(tr.families)) tr.families.forEach(function (f) { f.transport = f.transport || {}; f.transport.method = tpNormMethod(mode); });
    var opt = (leg.options || []).filter(function (o) { return o.mode === mode; })[0];
    // Switch savings: if the new option is cheaper than the prior choice, RECORD + SURFACE the
    // estimated saving. Costs recompute on render (computeTripCosts reads transportChoice) so the
    // cheaper number flows into the Costs tab; this just makes the win explicit. Informational only
    // — NOT a ledger entry, so who-owes balances stay untouched. Estimates, never fabricated.
    var saved = 0;
    if (prevMode && prevMode !== mode) {
      var prevOpt = (leg.options || []).filter(function (o) { return o.mode === prevMode; })[0];
      var oldC = prevOpt ? tpParseCost(prevOpt) : Infinity, newC = opt ? tpParseCost(opt) : Infinity;
      if (oldC !== Infinity && newC !== Infinity && oldC - newC >= 1) {
        saved = Math.round(oldC - newC);
        var routeLbl = (leg.fromCity || '').split(',')[0] + '→' + (leg.toCity || '').split(',')[0];
        tr.dealSavingsLog = (tr.dealSavingsLog || []).concat([{ route: routeLbl, from: prevMode, to: mode, saved: saved, ts: Date.now() }]).slice(-20);
      }
    }
    saveTrip(tr);
    // If the choice changes arrival/return timing, offer the itinerary replan options on that day.
    if (opt && opt.affectsItinerary && tr.plan && Array.isArray(tr.plan.days) && tr.plan.days.length) {
      state._replanDay = (leg.legType === 'return') ? (tr.plan.days.length - 1) : 0;
      toast(t('tpAffectsItin') + (saved ? (' · ' + t('dealSwitchSaved').replace('{amt}', '$' + saved)) : ''));
    } else if (saved) { toast(t('dealSwitchSaved').replace('{amt}', '$' + saved)); }
    else { toast(t('tpChosen')); }
    render();
  }
  // ── Deal Hunter / continuous deal watch (V3) ──────────────────────────────
  // Store the cheapest cost per leg as a SNAPSHOT each time transport is researched. When the
  // user is watching and a later re-check finds a lower cheapest cost, raise a "better deal" alert
  // — a NOTIFICATION ONLY; the itinerary is NEVER changed unless the user taps "Switch". Estimates
  // are labelled; real-time price movement comes from the grounded research / a future fare API,
  // never fabricated. (Periodic background checking needs a scheduled function — on-demand for now.)
  function cheapestCostForLeg(leg) {
    var best = null; (leg.options || []).forEach(function (o) { var v = tpParseCost(o); if (v !== Infinity && (!best || v < best.cost)) best = { cost: v, mode: o.mode }; });
    return best;
  }
  // Jitter guard — mirrors functions/lib/dealThreshold.js (keep in sync). Only a MEANINGFUL drop
  // (≥$25 AND ≥10% of the prior price) is alert-worthy; estimate ranges wobble run-to-run, so a
  // small swing is noise, not a deal. Prices are estimates — the guard only decides what to surface.
  var DEAL_MIN_DROP_ABS = 25, DEAL_MIN_DROP_PCT = 0.10;
  function meaningfulDrop(prevCost, newCost) {
    var prev = Number(prevCost), cur = Number(newCost);
    if (!isFinite(prev) || !isFinite(cur) || prev <= 0 || cur < 0) return false;
    var drop = prev - cur;
    return drop > 0 && drop >= DEAL_MIN_DROP_ABS && drop >= prev * DEAL_MIN_DROP_PCT;
  }
  // Mirror of functions/lib/dealThreshold.js parsePriceNumber — keep in sync. Floor of a "$lo–$hi"
  // range; null when there's no real dollar figure ($$$/pending/percent-only).
  function parsePriceNumber(text) {
    if (text == null) return null;
    var s = String(text).replace(/,/g, '');
    if (/%/.test(s) && !/\$/.test(s)) return null;
    var nums;
    if (/\$/.test(s)) nums = (s.match(/\$\s?\d+(?:\.\d+)?/g) || []).map(function (x) { return Number(x.replace(/[^\d.]/g, '')); });
    else nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    nums = nums.filter(function (n) { return isFinite(n) && n > 0 && n < 100000; });
    if (!nums.length) return null;
    return Math.min.apply(null, nums);
  }
  function checkDealDrops(tr) {
    var legs = tr.transport || []; if (!legs.length) return;
    tr.dealSnapshot = tr.dealSnapshot || {};
    var alerts = [];
    legs.forEach(function (lg, i) {
      var key = legKeyOf(lg, i), cur = cheapestCostForLeg(lg); if (!cur) return;
      var prev = tr.dealSnapshot[key];
      if (tr.dealWatch && prev && prev.cost && meaningfulDrop(prev.cost, cur.cost)) {
        alerts.push({ kind: 'fare', route: (lg.fromCity || '').split(',')[0] + '→' + (lg.toCity || '').split(',')[0], oldCost: prev.cost, newCost: cur.cost, mode: cur.mode, leg: lg, i: i });
      }
      tr.dealSnapshot[key] = { cost: cur.cost, mode: cur.mode, ts: Date.now() };
    });
    if (alerts.length) state._dealAlerts = (state._dealAlerts || []).concat(alerts);
  }
  // Hotel price-drop watch — snapshot the floor nightly price of each stored hotel; alert on a
  // meaningful drop on the next research. $$$/pending entries (no number) are tracked-but-never-alerted.
  function checkHotelDeals(tr) {
    if (!tr.stays || !tr.stays.length) return;
    tr.dealSnapshot = tr.dealSnapshot || {};
    var alerts = [];
    tr.stays.forEach(function (st) {
      var city = (st.city || '').trim(); if (!city) return;
      (st.hotels || []).forEach(function (h) {
        var name = (h.name || '').trim(); if (!name) return;
        var cur = parsePriceNumber(h.priceRange); if (cur == null) return;
        var key = 'hotel:' + city + ':' + name, prev = tr.dealSnapshot[key];
        if (tr.dealWatch && prev && prev.cost && meaningfulDrop(prev.cost, cur)) alerts.push({ kind: 'hotel', label: name, city: city.split(',')[0], oldCost: prev.cost, newCost: cur });
        tr.dealSnapshot[key] = { cost: cur, ts: Date.now() };
      });
    });
    if (alerts.length) state._dealAlerts = (state._dealAlerts || []).concat(alerts);
  }
  // Ticket new-deal watch — savingsEstimate is a discount, never a price, so this is a "new deal
  // appeared" notice (existence diff), never a numeric price drop.
  function checkTicketDeals(tr) {
    if (!tr.ticketDeals || !tr.ticketDeals.length) return;
    tr.dealSnapshot = tr.dealSnapshot || {};
    var alerts = [];
    tr.ticketDeals.forEach(function (d) {
      var attr = (d.attraction || '').trim(); if (!attr) return;
      (d.items || []).forEach(function (it) {
        var key = 'ticket:' + attr + ':' + (it.dealType || 'other'), prev = tr.dealSnapshot[key];
        if (tr.dealWatch && !prev) alerts.push({ kind: 'ticket', label: attr, dealType: it.dealType || 'other', savings: it.savingsEstimate || '', title: it.title || '' });
        tr.dealSnapshot[key] = { seen: true, savings: it.savingsEstimate || '', ts: Date.now() };
      });
    });
    if (alerts.length) state._dealAlerts = (state._dealAlerts || []).concat(alerts);
  }
  // Apply a transport research result: store legs + source + timestamp, then snapshot/diff for deals.
  function applyTransportResult(tr, res) {
    if (!res || !res.legs || !res.legs.length) return;
    tr.transport = res.legs; tr.transportSource = res.source || 'estimated';
    if (res.researchedAt) tr.transportResearchedAt = res.researchedAt;
    checkDealDrops(tr);
    saveTrip(tr);
  }
  function tpResearchedLabel(ts) {
    if (!ts) return '';
    var loc = state.lang === 'vi' ? 'vi-VN' : (state.lang === 'es' ? 'es-ES' : 'en-US');
    try { return new Date(ts).toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  // ── Web Push for Deal Hunter alerts — reuses the shared portal-kit push stack (PortalPWA +
  //    VAPID) already used by mobile-barber/driver. Subscription stored under the trip so the
  //    scheduled monitor (monitorDealWatchTrips) can push the owner's device(s). Opt-in only. ──
  var TC_VAPID_PUBLIC = 'BBHEU_YqwysrntO1a6JPvWn8YSQmKumg6fcgLipNPcOVC-0LbZc8SU-1q0Nf_ilI7B3pFs_OXPCf-ajrSO8c0V8';
  function tcPushSubId(endpoint) { var h = 0, s = String(endpoint || ''); for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return 'sub_' + Math.abs(h).toString(36); }
  function tcRegisterSW() { if (state._swReg || !root.PortalPWA) return; state._swReg = true; try { root.PortalPWA.register({ swUrl: '/travel-concierge-sw.js', scope: '/travel-concierge' }); } catch (e) {} }
  function tcPushSupported() { return !!(root.PortalPWA && ('Notification' in root) && ('PushManager' in root) && root.navigator && 'serviceWorker' in root.navigator); }
  // Subscribe this device + store the subscription on the trip. silent=true suppresses toasts
  // (used when the user just flips Deal Watch on). Resolves true on success.
  function tcEnablePush(silent) {
    var tr = state.trip;
    if (!tcPushSupported() || !tr || !tr.id || tr._demo || !realUser()) { if (!silent) toast(t('pushUnsupported')); return Promise.resolve(false); }
    tcRegisterSW();
    return root.PortalPWA.subscribePush({ vapidPublicKey: TC_VAPID_PUBLIC }).then(function (sub) {
      if (!sub || !sub.endpoint) { if (!silent) toast((root.Notification && root.Notification.permission === 'denied') ? t('pushDenied') : t('pushUnsupported')); return false; }
      try {
        var col = root.dlcDb && root.dlcDb.collection('groupTrips').doc(tr.id).collection('pushSubscriptions');
        if (col) col.doc(tcPushSubId(sub.endpoint)).set({ endpoint: sub.endpoint, keys: sub.keys || {}, uid: curUid() || '', tripId: tr.id, platform: (root.PortalPWA.isStandalone && root.PortalPWA.isStandalone()) ? 'home-screen' : 'browser', updatedAt: new Date().toISOString() }).catch(function () {});
      } catch (e) {}
      tr.pushEnabled = true; saveTrip(tr);
      if (!silent) toast(t('pushEnabled'));
      render();
      return true;
    }).catch(function () { if (!silent) toast(t('pushUnsupported')); return false; });
  }
  function dealWatchPanel() {
    var tr = state.trip, box = el('div', 'tc-dealwatch');
    var row = el('div', 'tc-dealwatch__row');
    row.appendChild(pbtn((tr.dealWatch ? '🔔 ' + t('dealWatchOn') : '🔕 ' + t('dealWatchOff')), 'tc-pbtn--ghost' + (tr.dealWatch ? ' tc-pbtn--on' : ''), function () { tr.dealWatch = !tr.dealWatch; saveTrip(tr); if (tr.dealWatch && tcPushSupported() && !tr.pushEnabled) tcEnablePush(); else render(); }));
    if (!state.readonly && !tr._demo) {
      row.appendChild(pbtn('↻ ' + t('dealCheckNow'), 'tc-pbtn--ghost', function () { state.generating = true; renderGenerating(t('researchingTransport')); researchTransport(tr).then(function (res) { state.generating = false; var before = (state._dealAlerts || []).length; applyTransportResult(tr, res); if ((state._dealAlerts || []).length === before) toast(t('dealNoBetter')); render(); }); }));
      row.appendChild(pbtn('💲 ' + t('dealResearchFares'), 'tc-pbtn--ghost', function () { state.generating = true; renderGenerating(t('researchingTransport')); researchFares(tr).then(function (res) { state.generating = false; if (res.ok && res.legs.length) { tr.legFares = res.legs; tr.legFaresAt = res.researchedAt; tr.legFaresNote = res.sourceNote; tr.legFaresLive = (res.status === 'live'); saveTrip(tr); } else toast(t('dealNoFares')); render(); }); }));
    }
    box.appendChild(row);
    // Phone push opt-in — so "better deal" alerts reach the device even when the app is closed.
    if (!state.readonly && !tr._demo && tcPushSupported()) {
      if (tr.pushEnabled && root.Notification && root.Notification.permission === 'granted') {
        box.appendChild(el('p', 'tc-dealwatch__ts', '📲 ' + t('pushOn')));
      } else {
        box.appendChild(pbtn('📲 ' + t('pushEnable'), 'tc-pbtn--ghost', function () { tcEnablePush(); }));
      }
    }
    if (tr.transportResearchedAt) box.appendChild(el('p', 'tc-dealwatch__ts', '🕒 ' + t('researchedAt') + ' ' + tpResearchedLabel(tr.transportResearchedAt)));
    // Cumulative estimated savings from accepted deal switches — makes the win persistent + visible
    // (the cheaper option already flows into the Costs tab via computeTripCosts). Informational only.
    var _savedTotal = (tr.dealSavingsLog || []).reduce(function (s, x) { return s + (+x.saved || 0); }, 0);
    if (_savedTotal > 0) box.appendChild(el('p', 'tc-dealwatch__saved', '💰 ' + t('dealSavingsTotal') + ': ~$' + Math.round(_savedTotal)));
    box.appendChild(el('p', 'tc-hint', t('dealWatchHint')));
    // Grounded current-fare research (honest estimates, pending verification, with source + time).
    if (tr.legFares && tr.legFares.length) {
      var ff = el('div', 'tc-fares');
      ff.appendChild(el('strong', 'tc-fares__t', '💲 ' + t(tr.legFaresLive ? 'dealFaresLive' : 'dealFaresTitle')));
      tr.legFares.forEach(function (lf) {
        var parts = [((lf.from || '').split(',')[0] || '') + '→' + ((lf.to || '').split(',')[0] || '')];
        [['flight', '✈️'], ['bus', '🚌'], ['train', '🚆']].forEach(function (m) { var f = lf[m[0]]; if (f && (f.low || f.high)) parts.push(m[1] + ' $' + (f.low || '?') + (f.high && f.high !== f.low ? ('–$' + f.high) : '')); });
        if (parts.length > 1) ff.appendChild(el('p', 'tc-fares__leg', parts.join('   ·   ')));
      });
      if (tr.legFaresNote) ff.appendChild(el('p', 'tc-fares__note', '≈ ' + tr.legFaresNote));
      if (tr.legFaresAt) ff.appendChild(el('p', 'tc-dealwatch__ts', '🕒 ' + t('researchedAt') + ' ' + tpResearchedLabel(tr.legFaresAt) + ' · ' + t(tr.legFaresLive ? 'fareLiveTag' : 'unverified')));
      box.appendChild(ff);
    }
    // Alerts: client (Check now → has leg/mode, supports Switch) + server (cron-written, informational).
    function dealCard(a, server) {
      var card = el('div', 'tc-deal');
      var kind = a.kind || 'fare'; // back-compat: pre-kind stored alerts are fares
      var titleKey = kind === 'hotel' ? 'dealHotelDrop' : (kind === 'ticket' ? 'dealTicketNew' : 'dealBetterFound');
      var titleIcon = kind === 'hotel' ? '🏨 ' : (kind === 'ticket' ? '🏷 ' : '🎉 ');
      card.appendChild(el('strong', 'tc-deal__t', titleIcon + t(titleKey) + (server ? (' · ' + t('dealWhileAway')) : '')));
      var bodyTxt;
      if (kind === 'hotel') {
        bodyTxt = a.label + ' · ' + a.city + ' — ' + t('dealWas') + ' $' + a.oldCost + ' → ' + t('dealNow') + ' $' + a.newCost + ' · ' + t('dealSave') + ' $' + Math.max(0, a.oldCost - a.newCost) + '/' + t('perNight');
      } else if (kind === 'ticket') {
        bodyTxt = a.label + ' — ' + (t('tdeal_' + a.dealType) || a.dealType) + (a.title ? (' · ' + a.title) : '') + (a.savings && parsePriceNumber(a.savings) != null ? (' · ' + t('tdealSave') + ' ' + a.savings) : '');
      } else {
        bodyTxt = a.route + ' · ' + (tpIcon(a.mode) + ' ' + (t('tm_' + a.mode) || a.mode)) + ' — ' + t('dealWas') + ' $' + a.oldCost + ' → ' + t('dealNow') + ' $' + a.newCost + ' · ' + t('dealSave') + ' $' + Math.max(0, a.oldCost - a.newCost);
      }
      card.appendChild(el('p', 'tc-deal__d', bodyTxt));
      var acts = el('div', 'tc-deal__acts');
      acts.appendChild(pbtn('✓ ' + t('dealKeep'), 'tc-pbtn--ghost', function () {
        if (server) { tr.dealAlerts = (tr.dealAlerts || []).filter(function (x) { return x !== a; }); saveTrip(tr); }
        else state._dealAlerts = (state._dealAlerts || []).filter(function (x) { return x !== a; });
        render();
      }));
      // Switch only applies to a transport leg (hotels/tickets aren't a single switchable option).
      if (!server && kind === 'fare' && a.leg) acts.appendChild(pbtn('🔁 ' + t('dealSwitch'), 'tc-pbtn--accent', function () { state._dealAlerts = (state._dealAlerts || []).filter(function (x) { return x !== a; }); chooseTransport(a.leg, a.i, a.mode); }));
      card.appendChild(acts);
      if (kind === 'ticket') card.appendChild(el('p', 'tc-unverified', t('unverified')));
      box.appendChild(card);
    }
    (state._dealAlerts || []).forEach(function (a) { dealCard(a, false); });
    (tr.dealAlerts || []).forEach(function (a) { dealCard(a, true); });
    return box;
  }
  // Build a DRAFT ride request from trip data and hand off to the EXISTING ride flow
  // (sessionStorage → /airport → RideIntake). NEVER auto-confirms a booking.
  function totalTravelers() {
    return ((state.trip && state.trip.families) || []).reduce(function (n, f) {
      return n + (f.adults || 0) + (f.seniors || 0) + String(f.childrenAges || '').split(/[,\s]+/).filter(function (x) { return /\d/.test(x); }).length;
    }, 0) || 1;
  }
  function groupKidsSeniors() {
    var kids = 0, sr = 0;
    ((state.trip && state.trip.families) || []).forEach(function (f) { kids += String(f.childrenAges || '').split(/[,\s]+/).filter(function (x) { return /\d/.test(x); }).length; sr += (f.seniors || 0); });
    return { kids: kids, seniors: sr };
  }
  // General DuLichCali service INQUIRY (no payment — a draft handoff to the existing ride flow):
  // kind = ride | van_transfer | tour | airport_pickup. Reuses sessionStorage → /airport →
  // RideIntake.openWithPrefill. airport_pickup opens the pickup form; others open the ride form.
  // Stable segment id for a city (Step D): a ride/booking attaches to the SEGMENT it arrives
  // at, so it survives a later reorder/rename (legKey is positional and would break). The leg
  // home maps to 'return'. Empty when the city isn't a stop.
  function segmentIdForCity(tr, city) {
    var c = String(city || '').trim().toLowerCase(); if (!tr || !c) return '';
    var hit = (tr.destinations || []).filter(function (d) { return (d.city || '').trim().toLowerCase() === c; })[0];
    if (hit) return hit.id || '';
    if (String(tr.departureCity || '').trim().toLowerCase() === c) return 'return';
    return '';
  }
  // Per-segment transport/booking status for the journey UI: a confirmed/pending DuLichCali ride
  // attached to this segment, else the transportStatus mirror. '' = nothing yet.
  function segmentBookingStatus(tr, segId) {
    if (!tr || !segId) return '';
    var bk = (tr.bookings || []).filter(function (b) { return b.type === 'ride' && b.segmentId === segId; })[0];
    if (bk) return bk.bookingStatus === 'booked' ? 'booked' : 'user_approval_needed';
    return (tr.transportStatus || {})[segId] || '';
  }
  function requestDlcInquiry(opts) {
    opts = opts || {};
    var tr = state.trip, ks = groupKidsSeniors();
    var firstDate = (parseTripDates(tr.dateRange) || {}).dates && (parseTripDates(tr.dateRange).dates[0]) || '';
    var kind = opts.kind || 'ride';
    var pickup = opts.pickup || '', dropoff = opts.dropoff || '';
    var noteBits = [t('dlcInq_' + kind) || t('tpDraftFromTrip'), 'Trip ' + (tr.id || '')];
    if (opts.label) noteBits.push(opts.label);
    if (pickup || dropoff) noteBits.push((pickup || '') + ' → ' + (dropoff || ''));
    // §0b dependency hand-off: this ride starts where an earlier leg (e.g. Bus Hoàng) drops the
    // group off, so tell the driver to pick up AFTER that arrival. Honest: a known date may be
    // prefilled below, but we never fabricate a precise arrival minute.
    if (opts.afterArrival) noteBits.push((opts.afterArrivalProvider || '').trim() ? t('pickupAfterProvider').replace('{provider}', opts.afterArrivalProvider.trim()) : t('pickupAfterArrival'));
    if (opts.userNotes) noteBits.push(opts.userNotes);
    if (ks.kids) noteBits.push(ks.kids + ' ' + t('childrenLabel').toLowerCase());
    if (ks.seniors) noteBits.push(ks.seniors + ' ' + t('seniors').toLowerCase());
    var legRef = opts.legRef || ((pickup || '') + '→' + (dropoff || ''));
    var segmentId = opts.segmentId || segmentIdForCity(tr, dropoff) || ''; // attach to the arrival segment
    var returnUrl = '/travel-concierge?trip=' + encodeURIComponent(tr.id || '');
    try { returnUrl = root.location.origin + returnUrl; } catch (e) {}
    var draft = {
      serviceType: (kind === 'airport_pickup' ? 'pickup' : 'ride'), inquiryKind: kind,
      pickup: pickup, dropoff: dropoff,
      date: opts.date || '', time: '', dateHint: opts.date || firstDate,
      passengers: totalTravelers(), customerName: '', customerPhone: '',
      notes: noteBits.join(' · '),
      // Clean handoff contract → ride-intake emits a result + returns to returnUrl; TC reconciles it.
      tripId: tr.id || '', tripName: tr.groupName || '', legRef: legRef, legKey: opts.legKey || '', segmentId: segmentId,
      // taskId binds the result back to THIS trip task so reconcile updates it in place (no duplicate).
      // existingBookingId is carried for traceability only — ride-intake does NOT yet vendor-side-edit
      // the prior booking, so a modify submits a new request whose notes explicitly say it replaces
      // the old (see requestRideForTask). A true in-place vendor modify is a follow-up callable.
      taskId: opts.taskId || '', existingBookingId: opts.existingBookingId || '',
      transportMode: opts.mode || (kind === 'van_transfer' ? 'dlc_ride' : 'ride'), luggage: opts.luggage || '',
      familyId: opts.familyId || (typeof getMe === 'function' ? (getMe() || '') : ''), assignedToMember: opts.memberId || '', returnUrl: returnUrl, source: 'travel_concierge',
    };
    try { root.sessionStorage.setItem('dlc_ride_prefill', JSON.stringify(draft)); } catch (e) {}
    try { root.location.href = '/airport'; } catch (e) {}
  }
  // After the ride flow returns to /travel-concierge?trip=<id>, attach the booking to THIS trip
  // (Bookings + Transport + Costs + a group note). Idempotent; clears the one-shot stash.
  function reconcileRideResult(tr) {
    if (!tr || !tr.id) return;
    var raw; try { raw = root.sessionStorage.getItem('dlc_ride_result'); } catch (e) { return; }
    if (!raw) return;
    var res; try { res = JSON.parse(raw); } catch (e) { try { root.sessionStorage.removeItem('dlc_ride_result'); } catch (_) {} return; }
    if (!res || res.tripId !== tr.id) return; // result belongs to a different trip — leave it
    try { root.sessionStorage.removeItem('dlc_ride_result'); } catch (e) {}
    if (res.status === 'cancelled' || !res.bookingId) { toast(t('rideNotCompleted')); return; }
    tr.bookings = tr.bookings || [];
    if (tr.bookings.some(function (b) { return b.confirmationNumber && b.confirmationNumber === res.bookingId; })) return; // already attached
    var requested = res.status === 'requested';
    // If the ride was requested FROM a specific trip task (taskId), update THAT task in place so the
    // existing "Confirm ride Michael" card becomes the live booking — never a disconnected duplicate.
    var taskB = res.taskId ? tr.bookings.filter(function (b) { return b.id === res.taskId; })[0] : null;
    if (taskB) {
      taskB.provider = taskB.provider || 'DuLichCali'; taskB.bookingStatus = requested ? 'user_approval_needed' : 'booked';
      taskB.confirmationNumber = res.bookingId; taskB.priceRange = res.priceEstimate || taskB.priceRange || '';
      taskB.selectedOption = res.mode || 'dlc_ride'; taskB.bookedBy = (typeof getMe === 'function' ? (getMe() || '') : '');
      taskB.bookedAt = new Date().toISOString(); taskB.bookingSource = 'dlc_ride_booking';
      if (res.segmentId && !taskB.segmentId) taskB.segmentId = res.segmentId;
    } else {
      tr.bookings.push(newBooking('ride', t('rideBookingTitle') + (res.route ? (' · ' + res.route) : ''), {
        provider: 'DuLichCali', bookingStatus: requested ? 'user_approval_needed' : 'booked', confirmationNumber: res.bookingId,
        priceRange: res.priceEstimate || '', recommendedOption: res.route || '', selectedOption: res.mode || 'dlc_ride',
        notes: res.route || '', bookedBy: (typeof getMe === 'function' ? (getMe() || '') : ''), dataSource: 'dlc_ride_booking', bookingSource: 'dlc_ride_booking',
        segmentId: res.segmentId || '', // Step D: stable attachment to the segment (survives reorder/rename)
      }));
    }
    // Mark transport status by stable segmentId (primary) AND legKey (back-compat).
    tr.transportStatus = tr.transportStatus || {};
    if (res.segmentId) tr.transportStatus[res.segmentId] = requested ? 'planning' : 'booked';
    if (res.legKey) tr.transportStatus[res.legKey] = requested ? 'planning' : 'booked';
    var amt = parseInt(String((res.priceEstimate || '').match(/\d[\d,]*/) || [''])[0].replace(/,/g, ''), 10) || 0;
    var ledgerKey = res.bookingId || (taskB && taskB.id);
    var dupLedger = ledgerKey && costLedger(tr).some(function (e) { return e.bookingId && e.bookingId === ledgerKey; });
    if (amt && !dupLedger) costLedger(tr).push({ id: uid('cl'), bookingId: ledgerKey, familyId: (taskB && taskB.assignedToFamily) || (typeof getMe === 'function' ? (getMe() || '') : ''), title: (taskB && taskB.title) || (t('rideBookingTitle') + (res.route ? (' (' + res.route + ')') : '')), amount: amt, paid: false, notes: 'DuLichCali', createdAt: new Date().toISOString() });
    tr.notes = tr.notes || [];
    tr.notes.push({ id: uid('note'), text: '🚐 ' + (requested ? t('rideRequestedNote') : t('rideBookedNote')) + (res.route ? (': ' + res.route) : '') + (res.bookingId ? (' · #' + res.bookingId) : ''), ts: Date.now() });
    saveTrip(tr);
    tcNotifyTask(requested ? 'user_approval_needed' : 'booked', (taskB && taskB.title) || (t('rideBookingTitle') + (res.route ? (' · ' + res.route) : ''))); // notify group members
    toast(requested ? t('rideRequestedToast') : t('rideBookedToast'));
  }
  // ── Assisted checkout / confirmation capture (P3) ──────────────────────────
  // HONEST self-booking: the user books on the real operator site, then pastes their confirmation #
  // + the price they actually paid. We mark the booking booked + record ONLY what they typed (no
  // fetch, no auto-confirm, no fabricated price). Mirrors reconcileRideResult's attach, on an
  // existing booking object.
  function attachManualBooking(b, tr, opts) {
    opts = opts || {};
    b.bookingStatus = opts.asRequested ? 'user_approval_needed' : 'booked';
    b.confirmationNumber = String(opts.confirmationNumber || '').trim();
    if (opts.actualPrice != null && String(opts.actualPrice).trim()) b.actualCost = String(opts.actualPrice).trim(); // verbatim, never reformatted
    b.bookedBy = (getMe() ? famName(getMe()) : '');
    b.bookedAt = new Date().toISOString();
    b.bookingSource = 'self_booked';
    // Cost ledger (de-dup by bookingId so re-saving won't double-count). Take the FIRST number only
    // so a stray range like "$400-$450" can't concatenate into a nonsense ledger total (400450).
    var amt = parseInt(((String(opts.actualPrice || '').match(/\d[\d,]*/) || [''])[0]).replace(/,/g, ''), 10) || 0;
    if (amt) {
      var already = costLedger(tr).some(function (e) { return e.bookingId && e.bookingId === b.id; });
      if (!already) costLedger(tr).push({ id: uid('cl'), bookingId: b.id, familyId: (b.paidBy || (getMe() || '')), title: b.title, amount: amt, paid: false, notes: (b.confirmationNumber ? ('#' + b.confirmationNumber) : t('selfBookedLedgerNote')), createdAt: new Date().toISOString() });
    }
    tr.notes = tr.notes || [];
    tr.notes.push({ id: uid('note'), text: bookingTypeIcon(b.type) + ' ' + t('selfBookedNote') + ': ' + b.title + (b.confirmationNumber ? (' · #' + b.confirmationNumber) : ''), ts: Date.now() });
    saveTrip(tr);
    tcNotifyTask(opts.asRequested ? 'user_approval_needed' : 'booked', b.title);
    toast(t('selfBookedToast'));
    render();
  }
  function operatorLabel(b) { return b.type === 'flight' ? t('confirmGoFlight') : ((b.type === 'hotel' || b.type === 'airbnb') ? t('confirmGoHotel') : t('openOfficial')); }
  function openConfirmBookingModal(b, idx) {
    if (state.readonly || (state.trip && state.trip._demo)) { toast(t('sampleReadonly')); return; }
    var tr = state.trip; closeModal();
    var ov = el('div', 'tc-modal'); ov.id = 'tcModal';
    var card = el('div', 'tc-modal__card');
    var head = el('div', 'tc-modal__head');
    head.appendChild(el('strong', 'tc-modal__title', t('confirmBookingTitle')));
    var x = el('button', 'tc-modal__x', '×'); x.type = 'button'; x.addEventListener('click', closeModal); head.appendChild(x);
    card.appendChild(head);
    card.appendChild(el('p', 'tc-hint', t('confirmBookingIntro')));
    var links = BookingLinkProvider.links(b, tr);
    card.appendChild(linkBtn('🔗 ' + operatorLabel(b), links.officialUrl || links.searchUrl, 'tc-pbtn--accent'));
    if ((b.type === 'hotel' || b.type === 'airbnb') && b.title && typeof StayLinkProvider !== 'undefined' && StayLinkProvider.booking) {
      card.appendChild(linkBtn('🏨 ' + t('confirmGoHotel'), StayLinkProvider.booking({ name: b.title }, b.city || (tr && tr.destination) || '')));
    }
    var cn = input(b.confirmationNumber, t('confirmationNumberPh'));
    card.appendChild(field(t('confirmationNumber'), cn));
    var pr = input(b.actualCost, t('actualPricePh'));
    card.appendChild(field(t('actualPricePaid'), pr));
    if (b.type === 'flight') card.appendChild(el('p', 'tc-hint', t('confirmFlightAirlineHint')));
    card.appendChild(el('p', 'tc-hint', t('confirmBookingHonesty')));
    var acts = el('div', 'tc-modal__acts');
    var cancel = el('button', 'tc-pbtn', t('cancelBtn')); cancel.type = 'button'; cancel.addEventListener('click', closeModal); acts.appendChild(cancel);
    var save = el('button', 'tc-pbtn tc-pbtn--accent', t('confirmBookingSave')); save.type = 'button';
    save.addEventListener('click', function () {
      var cnv = (cn.value || '').trim();
      if (!cnv) { toast(t('confirmNeedNumber')); return; }
      attachManualBooking(b, state.trip, { confirmationNumber: cnv, actualPrice: (pr.value || '').trim(), asRequested: false });
      closeModal();
    });
    acts.appendChild(save);
    card.appendChild(acts);
    ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); }); doc.body.appendChild(ov);
  }
  function requestDlcRide(leg) {
    var tr = state.trip, opts = { kind: 'ride', pickup: leg.fromCity || '', dropoff: leg.toCity || '' };
    // §0b: this ride STARTS where an earlier leg drops the group off. Prefill the pickup DATE from
    // that stop's arrival date and name the inbound provider (e.g. Xe Đò Hoàng), so Michael's
    // service gets the arrival info. Only the KNOWN date flows through — never an invented time.
    var fc = (leg.fromCity || '').trim().toLowerCase();
    var seg = fc ? (tr.destinations || []).filter(function (d) { return (d.city || '').trim().toLowerCase() === fc; })[0] : null;
    if (seg) {
      var arr = segArrival(seg);
      if (arr) { opts.date = arr; opts.afterArrival = true; opts.afterArrivalProvider = (seg.preferredProvider || '').trim(); }
    }
    requestDlcInquiry(opts);
  }
  // ── DuLichCali / Michael ride TASK integration (P0) ─────────────────────────
  // A ride task is a DuLichCali service — it must book via the EMBEDDED ride flow (requestDlcInquiry
  // → /airport ride form → reconcileRideResult attaches the booking to THIS task), NEVER an external
  // "Open official page" Google link.
  function isDlcRideTask(b) {
    if (!b) return false;
    if (b.type === 'ride') return true;
    return /michael|dulichcali|du lich cali|\bdlc\b/i.test((b.provider || '') + ' ' + (b.title || ''));
  }
  function rideTaskRoute(b) {
    var tm = String(b.title || '').split(/→|->/);
    if (tm.length === 2) { var f = tm[0].split('·').pop().trim(), to = tm[1].trim(); if (f && to) return { pickup: f, dropoff: to }; }
    var lsi = String(b.linkedSegmentId || '').replace(/^[a-z_]+:/i, '').replace(/:\d+$/, '');
    if (lsi.indexOf('>') !== -1) { var p = lsi.split('>'); if (p[0].trim() && p[1].trim()) return { pickup: p[0].trim(), dropoff: p[1].trim() }; }
    return { pickup: '', dropoff: b.city || '' };
  }
  // Open the embedded DLC ride flow for a TASK, passing full trip context (incl. taskId so the result
  // attaches back to this exact task). modify=true re-opens to change an existing request — it
  // submits a NEW request (ride-intake does not vendor-side-edit yet) so we make the replacement
  // EXPLICIT in the notes (never a silent orphaned booking); the prior request id is carried for the
  // driver to cancel the old one. (True in-place vendor modify = a follow-up callable.)
  function requestRideForTask(b, o) {
    o = o || {}; var tr = state.trip; var r = rideTaskRoute(b);
    var notes = b.notes || '';
    if (o.modify && b.confirmationNumber) notes = (t('rideModifyNote').replace('{id}', b.confirmationNumber) + (notes ? (' · ' + notes) : ''));
    var io = {
      kind: 'ride', pickup: r.pickup, dropoff: r.dropoff, taskId: b.id, mode: 'dlc_ride',
      segmentId: b.segmentId || segmentIdForCity(tr, r.dropoff) || '', legRef: r.pickup + '→' + r.dropoff,
      familyId: b.assignedToFamily || '', memberId: b.assignedToMember || '', luggage: b.luggage || '',
      label: b.title || '', userNotes: notes, date: b.dueDate || b.deadline || '',
      existingBookingId: o.modify ? (b.confirmationNumber || '') : '',
    };
    // §0b: prefill the pickup DATE from the arrival stop + name the inbound provider (e.g. Bus Hoàng).
    var fc = (r.pickup || '').trim().toLowerCase();
    var seg = fc ? (tr.destinations || []).filter(function (d) { return (d.city || '').trim().toLowerCase() === fc; })[0] : null;
    if (seg) { var arr = segArrival(seg); if (arr) { if (!io.date) io.date = arr; io.afterArrival = true; io.afterArrivalProvider = (seg.preferredProvider || '').trim(); } }
    requestDlcInquiry(io);
  }
  function cancelRideTask(b) {
    var tr = state.trip;
    var oldConf = b.confirmationNumber;
    b.bookingStatus = 'research_needed'; b.confirmationNumber = ''; b.bookingSource = ''; b.bookedAt = '';
    if (oldConf) tr.costLedger = (tr.costLedger || []).filter(function (e) { return e.bookingId !== oldConf; });
    tr.notes = tr.notes || []; tr.notes.push({ id: uid('note'), text: '🚐 ' + t('rideCancelledNote') + (b.title ? (': ' + b.title) : ''), ts: Date.now() });
    saveTrip(tr); tcNotifyTask('cancelled', b.title); toast(t('rideCancelledToast')); render();
  }
  function openRideRequestModal(b) {
    var tr = state.trip; closeModal();
    var ov = el('div', 'tc-modal'); ov.id = 'tcModal'; var card = el('div', 'tc-modal__card');
    var head = el('div', 'tc-modal__head'); head.appendChild(el('strong', 'tc-modal__title', '🚐 ' + t('rideViewTitle')));
    var x = el('button', 'tc-modal__x', '×'); x.type = 'button'; x.addEventListener('click', closeModal); head.appendChild(x); card.appendChild(head);
    var r = rideTaskRoute(b);
    function row(k, v) { if (!v) return; var rw = el('p', 'tc-bk__meta'); rw.appendChild(el('strong', null, k + ': ')); rw.appendChild(doc.createTextNode(v)); card.appendChild(rw); }
    row(t('rideRouteLabel'), (r.pickup && r.dropoff) ? (r.pickup + ' → ' + r.dropoff) : (b.title || ''));
    row(t('providerLabel'), b.provider || 'DuLichCali');
    row(t('taskDue'), b.dueDate || b.deadline || '');
    row(t('ridePassengers'), String(totalTravelers()));
    if (b.assignedToFamily) row('👤', famName(b.assignedToFamily));
    if (b.assignedToMember) row('🙋', memberName(b.assignedToMember));
    row(t('bs_' + (b.bookingStatus || 'research_needed')), b.confirmationNumber ? ('#' + b.confirmationNumber) : '');
    if (b.priceRange) row('💵', b.priceRange);
    if (b.notes) row(t('bookingNotes'), b.notes);
    card.appendChild(el('p', 'tc-unverified', t('unverified')));
    ov.appendChild(card); ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); }); doc.body.appendChild(ov);
  }
  // Status-driven DuLichCali ride actions for a ride task (used by bookingCard + naCard).
  // Not booked → Request/Book; booked/requested → View / Modify / Cancel. Read-only/demo → nothing.
  function rideTaskActions(b, acts, primaryCls) {
    if (state.trip && state.trip._demo) return; // demo preview = no real booking actions
    var isMichael = /michael/i.test((b.provider || '') + ' ' + (b.title || ''));
    var hasBooking = !!b.confirmationNumber || b.bookingStatus === 'booked' || b.bookingStatus === 'user_approval_needed';
    if (state.readonly) { if (hasBooking) acts.appendChild(pbtn('👁 ' + t('rideViewRequest'), primaryCls || 'tc-pbtn--accent', function () { openRideRequestModal(b); })); return; }
    if (!hasBooking) {
      acts.appendChild(pbtn('🚐 ' + (isMichael ? t('rideRequestMichael') : t('rideBookDlc')), primaryCls || 'tc-pbtn--accent', function () { requestRideForTask(b); }));
    } else {
      acts.appendChild(pbtn('👁 ' + t('rideViewRequest'), primaryCls || 'tc-pbtn--accent', function () { openRideRequestModal(b); }));
      acts.appendChild(pbtn('🔁 ' + t('rideModifyRequest'), '', function () { requestRideForTask(b, { modify: true }); }));
      acts.appendChild(pbtn('✖ ' + t('rideCancelRequest'), 'tc-pbtn--danger', function () { cancelRideTask(b); }));
    }
  }
  function transportOptionCard(o, leg, i, isChosen) {
    var c = el('article', 'tc-tpopt' + (isChosen ? ' tc-tpopt--chosen' : ''));
    var head = el('div', 'tc-tpopt__head');
    head.appendChild(el('span', 'tc-tpopt__mode', tpIcon(o.mode) + ' ' + (t('tm_' + o.mode) || o.mode)));
    if (o.provider) head.appendChild(el('span', 'tc-tpopt__prov', o.provider));
    head.appendChild(tpStatusTag(o.status));
    if (isChosen) head.appendChild(el('span', 'tc-tpopt__badge', '✓ ' + t('tpYourChoice')));
    c.appendChild(head);
    var g = el('div', 'tc-tpopt__grid');
    if (o.durationText) g.appendChild(kv(t('tpDuration'), o.durationText));
    if (o.distanceText) g.appendChild(kv(t('distance'), o.distanceText));
    g.appendChild(kv(t('tpCost'), o.totalCostRange || t('tpFareOnRequest')));
    if (o.perTravelerCost) g.appendChild(kv(t('tpPerTraveler'), o.perTravelerCost));
    if (o.perFamilyCost) g.appendChild(kv(t('tpPerFamily'), o.perFamilyCost));
    if (o.gasEstimate) g.appendChild(kv(t('tpGas'), o.gasEstimate));
    if (o.parkingEstimate) g.appendChild(kv(t('tpParking'), o.parkingEstimate));
    if (o.convenience) g.appendChild(kv(t('tpConvenience'), tpConvLabel(o.convenience)));
    c.appendChild(g);
    var su = el('div', 'tc-tpopt__suit');
    if (o.luggageSuitability) su.appendChild(chip('tc-chip--suit', '🧳 ' + (t('suit_' + o.luggageSuitability) || o.luggageSuitability)));
    if (o.childSuitability) su.appendChild(chip('tc-chip--suit', '🧒 ' + (t('suit_' + o.childSuitability) || o.childSuitability)));
    if (o.seniorSuitability) su.appendChild(chip('tc-chip--suit', '🧓 ' + (t('suit_' + o.seniorSuitability) || o.seniorSuitability)));
    if (o.wifiAvailable) su.appendChild(chip('tc-chip--suit', '📶 ' + t('tpWifi')));
    if (su.children.length) c.appendChild(su);
    if (o.accessibilityNote) c.appendChild(el('p', 'tc-tpopt__acc', '♿ ' + o.accessibilityNote));
    // Per-option "why" so the AI explains every mode, not only the recommended one.
    if (o.whyKey) { var ow = el('p', 'tc-tpopt__why'); ow.appendChild(el('span', 'tc-tpopt__k', '💡 ')); ow.appendChild(doc.createTextNode(t(o.whyKey))); c.appendChild(ow); }
    // Mode-specific notes (toll / airport buffer + baggage / bus station) — labelled estimates.
    var noteTxts = [];
    if (o.tollNoteKey) noteTxts.push(t(o.tollNoteKey));
    (o.noteKeys || []).forEach(function (k) { noteTxts.push(t(k)); });
    noteTxts.forEach(function (nx) { c.appendChild(el('p', 'tc-tpopt__note', 'ℹ️ ' + nx)); });
    var pros = tpProsText(o), cons = tpConsText(o);
    if (pros.length) { var pr = el('p', 'tc-tpopt__pros'); pr.appendChild(el('span', 'tc-tpopt__k', '✓ ')); pr.appendChild(doc.createTextNode(pros.join(' · '))); c.appendChild(pr); }
    if (cons.length) { var cn = el('p', 'tc-tpopt__cons'); cn.appendChild(el('span', 'tc-tpopt__k', '✕ ')); cn.appendChild(doc.createTextNode(cons.join(' · '))); c.appendChild(cn); }
    var acts = el('div', 'tc-tpopt__acts');
    if (o.canBookViaDLC) {
      if (!state.readonly && !state.trip._demo) acts.appendChild(pbtn('🚐 ' + t('tpRequestDlc'), 'tc-pbtn--accent', function () { requestDlcRide(leg); }));
      acts.appendChild(el('span', 'tc-tpopt__dlcnote', t('tpDlcNote')));
    } else if (o.mode === 'flight' || o.mode === 'bus' || o.mode === 'hoang_bus' || o.mode === 'train') {
      // Real operator search/booking links (Google Flights + airports; Greyhound + FlixBus;
      // or Xe Đò Hoàng's official booking page + guide + site). Each labelled; nothing is booked here.
      var bl = (o.bookingLinks && o.bookingLinks.length) ? o.bookingLinks : (o.bookingLink ? [{ labelKey: 'tpSearchBook', url: o.bookingLink }] : []);
      bl.forEach(function (lk) {
        if (!lk || !lk.url) return;
        // Airport-pair links carry a literal label ("✈️ SJC → SAN") + a best-for descriptor key;
        // operator links carry an i18n labelKey. Support both.
        var txt = lk.label ? lk.label : ('🔎 ' + (t(lk.labelKey) || t('tpSearchBook')));
        if (lk.bestForKey && t(lk.bestForKey) !== lk.bestForKey) txt += ' · ' + t(lk.bestForKey);
        acts.appendChild(linkBtn(txt, lk.url, 'tc-pbtn--accent'));
      });
      // Phone numbers (e.g. Xe Đò Hoàng) as tap-to-call links — real, never fabricated.
      (o.phoneNumbers || []).forEach(function (ph) { var d = String(ph).replace(/[^0-9+]/g, ''); if (d) acts.appendChild(linkBtn('📞 ' + ph, 'tel:' + d)); });
      // Arrival-hub → transfer-to-hotel pattern: a DuLichCali inquiry (no payment). Flight → airport
      // pickup; bus/Hoàng → van transfer to the hotel in the arriving city. Reuses the ride flow.
      if (canEditPlan() && !state.trip._demo) {
        if (o.mode === 'flight') acts.appendChild(pbtn('🚐 ' + t('tpRequestPickup'), '', function () { requestDlcInquiry({ kind: 'airport_pickup', pickup: leg.toCity || '', label: t('tpRequestPickup') + ' · ' + (leg.toCity || '') }); }));
        else if (o.mode === 'bus' || o.mode === 'hoang_bus') acts.appendChild(pbtn('🚐 ' + t('tpRequestTransfer'), '', function () { requestDlcInquiry({ kind: 'van_transfer', pickup: leg.toCity || '', dropoff: leg.toCity || '', label: t('tpRequestTransfer') + ' · ' + (leg.toCity || '') }); }));
      }
      acts.appendChild(el('span', 'tc-tpopt__needs', t('tpConfirmNote')));
    } else if (o.mapLink) { acts.appendChild(linkBtn('🗺 ' + t('route'), o.mapLink)); }
    if (canEditPlan() && !isChosen) acts.appendChild(pbtn(t('tpChoose'), '', function () { chooseTransport(leg, i, o.mode); }));
    // "Mark booked" on the chosen option (own status namespace, keyed by leg).
    if (isChosen && canEditPlan()) {
      var booked = (state.trip.transportStatus || {})[legKeyOf(leg, i)] === 'booked';
      acts.appendChild(pbtn((booked ? '✓ ' : '📌 ') + t(booked ? 'tpBooked' : 'tpMarkBooked'), 'tc-pbtn--ghost' + (booked ? ' tc-pbtn--on' : ''), function () { toggleTransportBooked(leg, i); }));
    }
    c.appendChild(acts);
    if (!state.readonly && o.mode) c.appendChild(transportModeVote(legKeyOf(leg, i), o.mode));
    return c;
  }
  function transportLegCard(leg, i) {
    var c = el('article', 'tc-tpleg');
    var head = el('div', 'tc-tpleg__head');
    var lt = leg.legType || 'inter';
    head.appendChild(el('span', 'tc-tpleg__type tc-tpleg__type--' + lt, t('tpLeg_' + lt) || lt));
    head.appendChild(el('strong', 'tc-tpleg__route', (leg.fromCity || '') + ' → ' + (leg.toCity || '')));
    if (leg.dayHint) head.appendChild(el('span', 'tc-tpleg__day', t('tpDay_' + leg.dayHint) || leg.dayHint));
    c.appendChild(head);
    if (leg.driveDistanceText || leg.driveDurationText) {
      var dl = el('p', 'tc-tpleg__drive');
      dl.appendChild(doc.createTextNode('🚗 ' + [leg.driveDistanceText, leg.driveDurationText].filter(Boolean).join(' · ') + '  '));
      var st = routeSourceTag(leg.driveSource === 'google_maps' ? 'google_maps' : 'estimated'); if (st) dl.appendChild(st);
      c.appendChild(dl);
    }
    var cm = chosenMode(leg, i);
    var rec = tpPick(leg, 'recommended');
    if (rec && rec.recommendationReason !== undefined) { /* noop */ }
    // Why this is recommended (AI free text if present, else the deterministic reason key).
    var reasonTxt = leg.recommendationReason || (leg.recReasonKey ? t(leg.recReasonKey) : '');
    if (reasonTxt) {
      var why = el('div', 'tc-tpleg__why');
      why.appendChild(el('span', 'tc-tpleg__why-k', '💡 ' + t('tpWhy') + ' '));
      why.appendChild(doc.createTextNode(reasonTxt));
      c.appendChild(why);
    }
    // Quick "choose by" criteria (Recommended / Lowest cost / Fastest / Most comfortable / Private DLC)
    if (canEditPlan()) {
      var crit = el('div', 'tc-tpleg__crit');
      [['recommended', '⭐ ' + t('tpRecommended')], ['cheapest', '💲 ' + t('tpLowestCost')], ['fastest', '⚡ ' + t('tpFastest')], ['family', '👨‍👩‍👧 ' + t('tpBestFamilies')], ['kids', '🧒 ' + t('tpBestKids')], ['seniors', '🧓 ' + t('tpBestSeniors')], ['least_tiring', '😌 ' + t('tpLeastTiring')], ['luggage', '🧳 ' + t('tpBestLuggage')], ['scenic', '🏞 ' + t('tpScenic')], ['comfort', '🛋 ' + t('tpComfort')], ['dlc', '🚐 ' + t('tpPrivateDlc')]].forEach(function (pair) {
        var pk = tpPick(leg, pair[0]); if (!pk) return;
        var on = pk.mode === cm;
        crit.appendChild(pbtn(pair[1], 'tc-pbtn--ghost' + (on ? ' tc-pbtn--on' : ''), function () { chooseTransport(leg, i, pk.mode); }));
      });
      if (crit.children.length) c.appendChild(crit);
    }
    // Options list (chosen first, then a "compare all" toggle)
    var key = legKeyOf(leg, i);
    state._tpOpen = state._tpOpen || {};
    var opts = leg.options || [];
    var chosenOpt = opts.filter(function (o) { return o.mode === cm; })[0] || opts[0];
    if (chosenOpt) c.appendChild(transportOptionCard(chosenOpt, leg, i, true));
    var others = opts.filter(function (o) { return o !== chosenOpt; });
    if (others.length) {
      var toggles = el('div', 'tc-tpleg__toggles');
      toggles.appendChild(pbtn((state._tpOpen[key] ? '▴ ' : '▾ ') + t('tpCompare') + ' (' + others.length + ')', 'tc-pbtn--ghost', function () { state._tpOpen[key] = !state._tpOpen[key]; render(); }));
      // Side-by-side: scan all modes' cost/time/strength in one row to pick the best deal.
      state._tpGrid = state._tpGrid || {};
      toggles.appendChild(pbtn((state._tpGrid[key] ? '▴ ' : '⊞ ') + t('tpSideBySide'), 'tc-pbtn--ghost' + (state._tpGrid[key] ? ' tc-pbtn--on' : ''), function () { state._tpGrid[key] = !state._tpGrid[key]; render(); }));
      c.appendChild(toggles);
      if (state._tpGrid[key]) c.appendChild(transportCompareGrid(leg, i));
      if (state._tpOpen[key]) others.forEach(function (o) { c.appendChild(transportOptionCard(o, leg, i, false)); });
    }
    return c;
  }
  // Side-by-side per-leg deal comparison: every mode as a compact column (cost / time / top
  // strength) so the group scans the best deal at a glance. Honest — only real fields shown,
  // estimate ranges as-is, no fabricated numbers. "Choose" reuses the same chooseTransport flow.
  function transportCompareGrid(leg, i) {
    var opts = (leg.options || []).slice(0, 6), cm = chosenMode(leg, i);
    var grid = el('div', 'tc-tpgrid');
    opts.forEach(function (o) {
      var isChosen = o.mode === cm;
      var col = el('div', 'tc-tpcol' + (isChosen ? ' tc-tpcol--chosen' : ''));
      var mode = el('div', 'tc-tpcol__mode', (tpIcon(o.mode) || '') + ' ' + tpModeLabel(o.mode));
      if (isChosen) mode.appendChild(el('span', 'tc-tpcol__star', ' ★'));
      col.appendChild(mode);
      var cost = o.totalCostRange || o.perTravelerCost || o.gasEstimate || '';
      col.appendChild(el('div', 'tc-tpcol__cost', cost ? ('💲 ' + cost) : '—'));
      col.appendChild(el('div', 'tc-tpcol__time', o.durationText ? ('⏱ ' + o.durationText) : '—'));
      var proK = (o.prosKeys && o.prosKeys[0]) || '', pro = proK ? t(proK) : '';
      if (pro && pro !== proK) col.appendChild(el('div', 'tc-tpcol__pro', '✓ ' + pro));
      if (canEditPlan() && !isChosen) col.appendChild(pbtn(t('tpChoose'), 'tc-pbtn--ghost tc-tpcol__btn', function () { chooseTransport(leg, i, o.mode); }));
      grid.appendChild(col);
    });
    return grid;
  }
  // ── V3 AI Transport STRATEGY + TRANSFER intelligence panel ─────────────────
  function tpModeLabel(m) { var k = 'tm_' + m; var l = t(k); return (l && l !== k) ? l : String(m || '').replace(/_/g, ' '); }
  function tpRiskLevel(s) { s = String(s || '').toLowerCase(); if (s.indexOf('high') >= 0) return 'high'; if (s.indexOf('med') >= 0) return 'medium'; if (s.indexOf('low') >= 0) return 'low'; return ''; }
  function runStrategies(tr) {
    if (state._stratLoading || state.readonly || tr._demo) return;
    state._stratLoading = true; render();
    researchTransportStrategies(tr).then(function (res) {
      state._stratLoading = false;
      if (res.ok) { tr.transportStrategies = res; saveTrip(tr); }
      else if (!tr.transportStrategies) { tr.transportStrategies = { ok: false, modes: [], strategies: [], transferHubs: [], returnIntelligence: {} }; }
      render();
    });
  }
  function stratLegRow(lg, stratName) {
    var r = el('div', 'tc-strat__leg');
    r.appendChild(el('span', 'tc-strat__legpath', (lg.from || '').split(',')[0] + ' → ' + (lg.to || '').split(',')[0]));
    r.appendChild(el('span', 'tc-strat__legmode', tpIcon(lg.mode) + ' ' + tpModeLabel(lg.mode)));
    if (lg.note) r.appendChild(el('span', 'tc-strat__legnote', lg.note));
    // A leg the AI marked as a natural Du Lich Cali ride/transfer → request handoff (no payment).
    if (lg.dlcFit && !state.readonly) {
      r.appendChild(pbtn('🚐 ' + t('stratRequestDlc'), 'tc-pbtn--accent', function () { requestDlcInquiry({ kind: 'van_transfer', pickup: lg.from || '', dropoff: lg.to || '', label: stratName || '' }); }));
    }
    return r;
  }
  function stratCard(st, tr) {
    var c = el('article', 'tc-strat__card' + (st.recommended ? ' tc-strat__card--rec' : ''));
    var top = el('div', 'tc-strat__top');
    top.appendChild(el('span', 'tc-strat__badge', (st.id || '') + (st.recommended ? ' · ★ ' + t('stratRecommended') : '')));
    if (st.bestFor) top.appendChild(el('span', 'tc-strat__best', '👥 ' + st.bestFor));
    c.appendChild(top);
    c.appendChild(el('strong', 'tc-strat__name', st.name || ''));
    if (st.summary) c.appendChild(el('p', 'tc-strat__summary', st.summary));
    (st.legs || []).forEach(function (lg) { c.appendChild(stratLegRow(lg, st.name)); });
    var meta = el('div', 'tc-strat__meta');
    if (st.overnightAt) meta.appendChild(chip('tc-chip--bk', '🌙 ' + t('stratOvernight') + ': ' + st.overnightAt));
    if (st.totalTimeNote) meta.appendChild(chip('', '⏱ ' + st.totalTimeNote));
    var rl = tpRiskLevel(st.timingRisk);
    if (st.timingRisk) meta.appendChild(el('span', 'tc-strat__risk tc-strat__risk--' + (rl || 'na'), '⚠️ ' + t('stratRisk') + ': ' + st.timingRisk));
    if (meta.childNodes.length) c.appendChild(meta);
    if ((st.pros || []).length || (st.cons || []).length) {
      var pc = el('div', 'tc-strat__pc');
      (st.pros || []).forEach(function (p) { pc.appendChild(el('span', 'tc-strat__pro', '✓ ' + p)); });
      (st.cons || []).forEach(function (p) { pc.appendChild(el('span', 'tc-strat__con', '✗ ' + p)); });
      c.appendChild(pc);
    }
    if (st.why) { var w = el('p', 'tc-strat__why'); w.appendChild(el('span', 'tc-strat__why-k', t('whyRecommended') + ': ')); w.appendChild(doc.createTextNode(st.why)); c.appendChild(w); }
    // Families vote on the strategy (consensus, namespaced so it never collides with place names).
    c.appendChild(voteRow({ id: 'strat_' + (tr.id || '') + '_' + (st.id || st.name), name: st.name || '' }, { favorite: false }));
    return c;
  }
  function modeDetailRow(m) {
    var r = el('article', 'tc-strat__mode');
    var h = el('div', 'tc-strat__modehead');
    h.appendChild(el('span', 'tc-strat__modeic', tpIcon(m.mode)));
    h.appendChild(el('strong', 'tc-strat__modename', tpModeLabel(m.mode) + (m.operator ? ' · ' + m.operator : '')));
    r.appendChild(h);
    if (m.routeSummary) r.appendChild(el('p', 'tc-strat__moderoute', m.routeSummary));
    var kv = el('div', 'tc-strat__modekv');
    if ((m.pickupAreas || []).length) kv.appendChild(el('span', null, '🟢 ' + t('stratPickup') + ': ' + m.pickupAreas.join(', ')));
    if ((m.dropoffAreas || []).length) kv.appendChild(el('span', null, '🔴 ' + t('stratDropoff') + ': ' + m.dropoffAreas.join(', ')));
    if (m.travelTimeNote) kv.appendChild(el('span', null, '⏱ ' + m.travelTimeNote));
    if (m.priceNote) kv.appendChild(el('span', null, '💵 ' + m.priceNote));
    if (m.scheduleNote) kv.appendChild(el('span', null, '🕒 ' + m.scheduleNote));
    if (m.constraints) kv.appendChild(el('span', null, '⚠️ ' + m.constraints));
    if (kv.childNodes.length) r.appendChild(kv);
    if (m.officialUrl) r.appendChild(linkBtn('🔗 ' + t('stratOfficial'), m.officialUrl));
    return r;
  }
  function returnIntelCard(ri) {
    if (!ri || (!ri.explanation && !ri.earlyDepartureRisk && !ri.flyHomeOption)) return null;
    var c = el('article', 'tc-strat__return');
    c.appendChild(el('strong', 'tc-strat__returnt', '🏁 ' + t('stratReturnTitle')));
    var chips = el('div', 'tc-strat__returnchips');
    var rl = tpRiskLevel(ri.earlyDepartureRisk);
    if (ri.earlyDepartureRisk) chips.appendChild(el('span', 'tc-strat__risk tc-strat__risk--' + (rl || 'na'), '⏰ ' + t('stratEarlyRisk') + ': ' + ri.earlyDepartureRisk));
    if (ri.overnightRecommended) chips.appendChild(chip('tc-chip--bk', '🌙 ' + t('stratOvernightRec')));
    if (ri.leaveDayEarlier) chips.appendChild(chip('tc-chip--bk', '📅 ' + t('stratLeaveEarlier')));
    if (chips.childNodes.length) c.appendChild(chips);
    if (ri.flyHomeOption) c.appendChild(el('p', 'tc-strat__returnline', '✈️ ' + ri.flyHomeOption));
    if (ri.explanation) c.appendChild(el('p', 'tc-strat__returnwhy', ri.explanation));
    return c;
  }
  // TransportConnectionPlan card — the focused multi-leg transfer analysis: provider dropoff vs
  // final destination, transfer leg(s) (with Du Lich Cali / Michael ride handoff), hub food stop,
  // and return-timing options A/B/C. Pending verification + official link/phone; nothing booked.
  function connectionPlanCard(cp, tr) {
    if (!cp || !(cp.provider || cp.providerDropoff || cp.transferNeeded)) return null;
    var c = el('article', 'tc-conn' + (cp.transferNeeded ? ' tc-conn--transfer' : ''));
    var top = el('div', 'tc-conn__top');
    top.appendChild(el('span', 'tc-conn__prov', '🚌 ' + (cp.provider || tpModeLabel('hoang_bus'))));
    top.appendChild(el('span', 'tc-conn__flag tc-conn__flag--' + (cp.transferNeeded ? 'yes' : 'no'), cp.transferNeeded ? ('🔀 ' + t('connTransferNeeded')) : ('➡️ ' + t('connDirect'))));
    c.appendChild(top);
    // Route chain: origin → providerDropoff (hub) → final destination
    var chain = el('div', 'tc-conn__chain');
    [[cp.origin, t('connOrigin')], [cp.providerDropoff || cp.transferHub, t('connDropoff')], [cp.finalDestination, t('connFinal')]].forEach(function (pair, i) {
      if (!pair[0]) return;
      if (chain.childNodes.length) chain.appendChild(el('span', 'tc-conn__arrow', '→'));
      var node = el('span', 'tc-conn__node'); node.appendChild(el('strong', null, pair[0])); node.appendChild(el('span', 'tc-conn__nodelbl', pair[1])); chain.appendChild(node);
    });
    c.appendChild(chain);
    // Transfer options (the last leg(s) to the hotel) — DLC / Michael ride handoff on dlcFit.
    if (cp.transferNeeded && (cp.transferOptions || []).length) {
      c.appendChild(el('strong', 'tc-conn__h', t('connTransferOptions')));
      cp.transferOptions.forEach(function (o) {
        var r = el('div', 'tc-conn__opt');
        r.appendChild(el('span', 'tc-conn__optpath', (o.from || '').split(',')[0] + ' → ' + (o.to || '').split(',')[0]));
        r.appendChild(el('span', 'tc-conn__optmode', tpIcon(o.mode) + ' ' + tpModeLabel(o.mode)));
        if (o.note) r.appendChild(el('span', 'tc-conn__optnote', o.note));
        if (o.dlcFit && !state.readonly) r.appendChild(pbtn('🚐 ' + t('stratRequestDlc'), 'tc-pbtn--accent', function () { requestDlcInquiry({ kind: 'van_transfer', pickup: o.from || cp.transferHub || cp.providerDropoff || '', dropoff: o.to || cp.finalDestination || '', label: cp.provider || '' }); }));
        c.appendChild(r);
      });
    }
    // Hub food/coffee stop suggestion (when timing allows + culturally relevant).
    if (cp.hubStopSuggested && (cp.hubStopIdeas || []).length) {
      var hs = el('div', 'tc-conn__hubstop');
      hs.appendChild(el('strong', null, '🍜 ' + t('connHubStop') + (cp.transferHub ? ' · ' + cp.transferHub : '')));
      var chips = el('div', 'tc-conn__hubchips'); cp.hubStopIdeas.forEach(function (x) { chips.appendChild(chip('', x)); }); hs.appendChild(chips);
      c.appendChild(hs);
    }
    // Return-timing intelligence: overnight-before-return + Options A/B/C.
    if (cp.overnightBeforeReturnRecommended || (cp.returnOptions || []).length) {
      var rt = el('div', 'tc-conn__return');
      rt.appendChild(el('strong', null, '🏁 ' + t('connReturnTitle')));
      if (cp.overnightBeforeReturnRecommended) rt.appendChild(el('p', 'tc-conn__overnight', '🌙 ' + t('connOvernightBefore')));
      (cp.returnOptions || []).forEach(function (o) { rt.appendChild(el('p', 'tc-conn__retopt', (o.label ? (o.label + ') ') : '') + o.text)); });
      c.appendChild(rt);
    }
    var meta = el('div', 'tc-conn__meta');
    var rl = tpRiskLevel(cp.scheduleRisk);
    if (cp.scheduleRisk) meta.appendChild(el('span', 'tc-strat__risk tc-strat__risk--' + (rl || 'na'), '⚠️ ' + t('connScheduleRisk') + ': ' + cp.scheduleRisk));
    if (meta.childNodes.length) c.appendChild(meta);
    if (cp.whyRecommended) { var w = el('p', 'tc-strat__why'); w.appendChild(el('span', 'tc-strat__why-k', t('whyRecommended') + ': ')); w.appendChild(doc.createTextNode(cp.whyRecommended)); c.appendChild(w); }
    var links = el('div', 'tc-conn__links');
    if (cp.officialUrl) links.appendChild(linkBtn('🔗 ' + t('stratOfficial'), cp.officialUrl));
    if (cp.officialPhone) links.appendChild(el('a', 'tc-pbtn', '📞 ' + cp.officialPhone)).href = 'tel:' + cp.officialPhone.replace(/[^0-9+]/g, '');
    if (links.childNodes.length) c.appendChild(links);
    c.appendChild(el('p', 'tc-unverified', t('connPending')));
    return c;
  }
  function transportStrategiesPanel(plan) {
    var tr = state.trip;
    var box = el('section', 'tc-strat');
    box.appendChild(el('strong', 'tc-strat__t', '🧠 ' + t('stratTitle')));
    box.appendChild(el('p', 'tc-strat__sub', t('stratSub')));
    if (tr._demo) { box.appendChild(el('p', 'tc-empty', t('stratDemo'))); return box; }
    if (!(tr.departureCity || '').trim()) { box.appendChild(el('p', 'tc-hint', t('stratNeedOrigin'))); return box; }
    // Preference selector — drives the strategies (any / car / flight / bus / private ride).
    if (!state.readonly) {
      box.appendChild(el('span', 'tc-field__lbl', t('stratPrefLabel')));
      box.appendChild(seg(['any', 'personal_car', 'flight', 'hoang_bus', 'dlc_ride'], tr.transportPreference || 'any', 'tm_', function (v) { tr.transportPreference = v; saveTrip(tr); state._stratLoadedFor = null; runStrategies(tr); }));
    }
    // Auto-research once per trip; manual refresh after.
    if (!state.readonly && state._stratLoadedFor !== tr.id && !state._stratLoading && !tr.transportStrategies) { state._stratLoadedFor = tr.id; runStrategies(tr); }
    if (!state.readonly) {
      var btn = el('button', 'tc-cta', tr.transportStrategies ? ('↻ ' + t('stratRefresh')) : t('stratResearch')); btn.type = 'button';
      btn.addEventListener('click', function () { state._stratLoadedFor = tr.id; runStrategies(tr); });
      box.appendChild(btn);
    }
    if (state._stratLoading) { box.appendChild(researchBanner('stratLoading')); return box; }
    var sd = tr.transportStrategies;
    if (!sd || !sd.ok) { if (sd) box.appendChild(el('p', 'tc-empty', t('stratNone'))); return box; }
    // Connection plan (multi-leg transfer analysis) leads — it's the focused answer for a bus pref.
    var cpc = connectionPlanCard(sd.connectionPlan, tr); if (cpc) { box.appendChild(el('strong', 'tc-strat__h', '🔗 ' + t('connTitle'))); box.appendChild(cpc); }
    // Transfer hubs
    if ((sd.transferHubs || []).length) {
      box.appendChild(el('strong', 'tc-strat__h', '🔀 ' + t('stratHubs')));
      var hubs = el('div', 'tc-strat__hubs');
      sd.transferHubs.forEach(function (h) { var x = el('div', 'tc-strat__hub'); x.appendChild(el('strong', null, h.hub + (h.connects ? ' (' + h.connects + ')' : ''))); if (h.why) x.appendChild(el('span', null, h.why)); hubs.appendChild(x); });
      box.appendChild(hubs);
    }
    // Strategy cards (consensus re-ranked: recommended + group-loved float up)
    if ((sd.strategies || []).length) {
      box.appendChild(el('strong', 'tc-strat__h', '🗺 ' + t('stratStrategies')));
      consensusSort(sd.strategies.slice(), function (st) { return st.name || ''; }).sort(function (a, b) { return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0); }).forEach(function (st) { box.appendChild(stratCard(st, tr)); });
    }
    // Return intelligence
    var ric = returnIntelCard(sd.returnIntelligence); if (ric) box.appendChild(ric);
    // Researched operator details (collapsible)
    if ((sd.modes || []).length) {
      var det = el('details', 'tc-strat__modes'); if (state._stratModesOpen) det.open = true;
      det.addEventListener('toggle', function () { state._stratModesOpen = !!det.open; });
      det.appendChild(el('summary', 'tc-strat__modessum', '🔎 ' + t('stratModes')));
      var mb = el('div', 'tc-strat__modesbody');
      sd.modes.forEach(function (m) { mb.appendChild(modeDetailRow(m)); });
      det.appendChild(mb);
      box.appendChild(det);
    }
    box.appendChild(el('p', 'tc-unverified', t('stratUnverified')));
    return box;
  }
  function renderTransport(plan) {
    var tr = state.trip;
    var wrap = el('div', 'tc-transport');
    wrap.appendChild(el('strong', 'tc-transport__t', '🧭 ' + t('tpHeader')));
    wrap.appendChild(el('p', 'tc-transport__sub', t('transportSub')));
    // Synchronized meetup point (migrated here from the removed Family Arrival Plan tab).
    if (plan.meetupPoint) wrap.appendChild(el('div', 'tc-meetbar', '📍 ' + t('meetup') + ': ' + plan.meetupPoint + (plan.meetupTime ? ' · ' + plan.meetupTime : '')));
    // V3 — AI strategy + transfer intelligence (research-driven) sits ABOVE the deterministic
    // per-leg compare, which remains the verified backbone + fallback.
    wrap.appendChild(transportStrategiesPanel(plan));
    wrap.appendChild(el('strong', 'tc-transport__h', '📊 ' + t('tpCompareTitle')));
    if (!state.readonly && !tr._demo) {
      var find = el('button', 'tc-cta', (tr.transport && tr.transport.length) ? ('↻ ' + t('refreshTransport')) : t('findTransport')); find.type = 'button';
      find.addEventListener('click', function () {
        find.disabled = true; state.generating = true; renderGenerating(t('researchingTransport'));
        researchTransport(tr).then(function (res) { state.generating = false; applyTransportResult(tr, res); render(); });
      });
      wrap.appendChild(find);
    }
    var legs = (tr.transport && tr.transport.length) ? tr.transport : [];
    // Self-heal trips researched before the Xe Đò Hoàng fix: if a Hoàng-serviceable leg has no
    // hoang_bus option, re-research ONCE so the culturally-relevant option appears automatically.
    if (!state.readonly && !tr._demo && legs.length && state._tpHoangHealFor !== tr.id && !isResearching('transport')) {
      var serviceable = legs.some(function (lg) { return tcHoangRegion(lg.fromCity) && tcHoangRegion(lg.toCity); });
      var hasHoang = legs.some(function (lg) { return (lg.options || []).some(function (o) { return o.mode === 'hoang_bus'; }); });
      if (serviceable && !hasHoang) {
        state._tpHoangHealFor = tr.id;
        researchTransport(tr).then(function (res) { applyTransportResult(tr, res); render(); }).catch(function () {});
      }
    }
    if (isResearching('transport') && !legs.length) { wrap.appendChild(researchBanner('researchingTransport')); return wrap; }
    if (!legs.length) { wrap.appendChild(el('p', 'tc-empty', t('noTransportYet'))); return wrap; }
    // Upgrade drive legs to verified Google Maps distances (client key) once per session.
    if (!state.readonly && !tr._demo) verifyTransportRoutes(tr);
    // Deal Hunter — watch toggle, on-demand re-check, research timestamp, "better deal" alerts.
    wrap.appendChild(dealWatchPanel());
    // Door-to-door summary chips
    var sum = el('div', 'tc-transport__sumrow');
    legs.forEach(function (lg, i) {
      var cm = chosenMode(lg, i);
      sum.appendChild(el('span', 'tc-transport__sumchip', tpIcon(cm) + ' ' + (lg.fromCity || '').split(',')[0] + '→' + (lg.toCity || '').split(',')[0]));
    });
    wrap.appendChild(sum);
    legs.forEach(function (lg, i) { if ((lg.legType || '') !== 'return') wrap.appendChild(transportLegCard(lg, i)); });
    // Return-day transportation gets its own clearly-labelled card.
    var retIdx = -1; legs.forEach(function (lg, i) { if ((lg.legType || '') === 'return') retIdx = i; });
    if (retIdx >= 0) {
      wrap.appendChild(el('strong', 'tc-transport__rettitle', '🏁 ' + t('tpReturnTitle')));
      wrap.appendChild(el('p', 'tc-hint', t('tpReturnHint')));
      wrap.appendChild(transportLegCard(legs[retIdx], retIdx));
    }
    wrap.appendChild(el('p', 'tc-unverified', t('unverified')));
    return wrap;
  }
  // ── Events tab ──────────────────────────────────────────────────────────
  function eventCatIcon(c) { return ({ festival: '🎉', concert: '🎵', farmers_market: '🥕', night_market: '🏮', food: '🍜', fireworks: '🎆', seasonal: '🍂', popup: '✨', family: '👨‍👩‍👧', kids: '🧒', teen: '🧑', free: '🆓' })[c] || '📅'; }
  function eventCard(ev, city) {
    var c = el('article', 'tc-event');
    var top = el('div', 'tc-event__top');
    top.appendChild(el('span', 'tc-event__cat', eventCatIcon(ev.category) + ' ' + String(ev.category || '').replace(/_/g, ' ')));
    if (ev.date) top.appendChild(el('span', 'tc-event__date', ev.date + (ev.time ? ' · ' + ev.time : '')));
    c.appendChild(top);
    c.appendChild(el('strong', 'tc-event__name', ev.name));
    if (ev.location) c.appendChild(el('p', 'tc-event__loc', '📍 ' + ev.location));
    var chips = el('div', 'tc-event__chips');
    if (ev.priceRange) chips.appendChild(chip('tc-chip--cost', '💵 ' + ev.priceRange));
    if (ev.familySuitability) chips.appendChild(chip('', t('fit_' + ev.familySuitability) || ev.familySuitability));
    if (ev.ticketRequired) chips.appendChild(chip('tc-chip--bk', '🎟 ' + t('ticketed')));
    if (chips.children.length) c.appendChild(chips);
    if (ev.whyRecommended) { var w = el('p', 'tc-event__why'); w.appendChild(el('span', 'tc-attr__why-k', '💡 ')); w.appendChild(doc.createTextNode(ev.whyRecommended)); c.appendChild(w); }
    var acts = el('div', 'tc-event__acts');
    acts.appendChild(linkBtn('🔎 ' + (ev.eventUrl ? t('tpSearchBook') : t('mapG')), ev.eventUrl || gsearch((ev.name || '') + ' ' + (city || ''))));
    if (canEditPlan()) acts.appendChild(pbtn('📌 ' + t('addToPlan'), 'tc-pbtn--accent', function () { pinAttraction({ name: ev.name, why: ev.whyRecommended || '' }, city); }));
    c.appendChild(acts);
    // Live Ticketmaster events are the only ones allowed to drop the pending caption (official source).
    if (ev.source === 'ticketmaster_live' && ev.verificationStatus === 'verified') c.appendChild(el('span', 'tc-event__live', '✓ ' + t('eventLiveOfficial')));
    else c.appendChild(el('span', 'tc-event__pending', '≈ ' + t('eventPending')));
    var _lme = learnMoreSection(ev, 'event', city); if (_lme) c.appendChild(_lme); // "Learn more"
    if (!state.readonly && ev.name) c.appendChild(voteRow({ name: ev.name }));
    return c;
  }
  function renderEvents(plan) {
    var tr = state.trip, wrap = el('div', 'tc-stays tc-events');
    wrap.appendChild(el('strong', 'tc-stays__t', '🎉 ' + t('eventsTitle')));
    wrap.appendChild(el('p', 'tc-stays__sub', t('eventsSub')));
    if (!state.readonly && !tr._demo) {
      var find = el('button', 'tc-cta', (tr.events && tr.events.length) ? ('↻ ' + t('refreshEvents')) : t('findEvents')); find.type = 'button';
      find.addEventListener('click', function () { find.disabled = true; state.generating = true; renderGenerating(t('researchingEvents')); researchEvents(tr).then(function (res) { state.generating = false; if (res.destinations && res.destinations.length) { tr.events = res.destinations; saveTrip(tr); } render(); }); });
      wrap.appendChild(find);
    }
    var dests = (tr.events && tr.events.length) ? tr.events : [];
    if (isResearching('events') && !dests.length) { wrap.appendChild(researchBanner('researchingEvents')); return wrap; }
    if (!dests.length) { wrap.appendChild(el('p', 'tc-empty', t('noEventsYet'))); return wrap; }
    var multi = planDestinations(plan).length > 1;
    dests.forEach(function (d) {
      if (!d.events || !d.events.length) return;
      var block = el('div', 'tc-stayblock');
      if (multi && d.city) block.appendChild(el('strong', 'tc-stayblock__city', '📍 ' + d.city));
      consensusSort(d.events.filter(function (ev) { return ev && ev.name && !rejectedNameSet(tr)[(ev.name || '').trim().toLowerCase()]; }), function (ev) { return ev.name; }).forEach(function (ev) { block.appendChild(eventCard(ev, d.city)); });
      wrap.appendChild(block);
    });
    wrap.appendChild(el('p', 'tc-unverified', t('unverified')));
    return wrap;
  }
  // ── Weather tab (P2) — REAL Open-Meteo forecast + labelled seasonal normals; honest by design ──
  function wxDayCard(day) {
    var c = el('article', 'tc-wxday' + (day.source === 'seasonal_normal' ? ' tc-wxday--seasonal' : '') + (day.source === 'unavailable' ? ' tc-wxday--na' : ''));
    var top = el('div', 'tc-wxday__top');
    top.appendChild(el('span', 'tc-wxday__date', day.date));
    if (day.source !== 'unavailable' && day.condition) top.appendChild(el('span', 'tc-wxday__cond', (day.emoji || '') + ' ' + (t('wxcond_' + day.condition) || day.condition)));
    c.appendChild(top);
    if (day.source === 'unavailable') { c.appendChild(el('p', 'tc-wxday__na', t('wxUnavailable'))); return c; }
    if (day.tMax != null || day.tMin != null) c.appendChild(el('p', 'tc-wxday__temp', (day.tMax != null ? day.tMax + '°' : '–') + ' / ' + (day.tMin != null ? day.tMin + '°' : '–')));
    var meta = el('div', 'tc-wxday__meta');
    if (day.precipProbMax != null) meta.appendChild(el('span', 'tc-wxday__rain', '💧 ' + day.precipProbMax + '%'));
    if (day.rec) meta.appendChild(el('span', 'tc-wxday__rec', day.rec === 'outdoor' ? ('🌳 ' + t('wxRecOutdoor')) : (day.rec === 'indoor' ? ('🏛 ' + t('wxRecIndoor')) : ('🔀 ' + t('wxRecMixed')))));
    if (meta.children.length) c.appendChild(meta);
    if (day.source === 'seasonal_normal') c.appendChild(el('span', 'tc-event__pending', '≈ ' + t('wxSeasonalLabel')));
    return c;
  }
  function renderWeather(plan) {
    var tr = state.trip, wrap = el('div', 'tc-stays tc-weather');
    wrap.appendChild(el('strong', 'tc-stays__t', '🌦️ ' + t('weatherTitle')));
    wrap.appendChild(el('p', 'tc-stays__sub', t('weatherSub')));
    if (!state.readonly && !tr._demo) {
      var find = el('button', 'tc-cta', (tr.weather && tr.weather.length) ? ('↻ ' + t('refreshWeather')) : t('findWeather')); find.type = 'button';
      find.addEventListener('click', function () { find.disabled = true; state.generating = true; renderGenerating(t('researchingWeather')); researchWeather(tr).then(function (res) { state.generating = false; if (res.destinations && res.destinations.length) { tr.weather = res.destinations; saveTrip(tr); } render(); }); });
      wrap.appendChild(find);
    }
    var wd = (tr.weather && tr.weather.length) ? tr.weather : [];
    if (isResearching('weather') && !wd.length) { wrap.appendChild(researchBanner('researchingWeather')); return wrap; }
    if (!wd.length) { wrap.appendChild(el('p', 'tc-empty', t('noWeatherYet'))); return wrap; }
    var multi = wd.length > 1;
    wd.forEach(function (d) {
      var block = el('div', 'tc-stayblock');
      if (multi && d.city) block.appendChild(el('strong', 'tc-stayblock__city', '📍 ' + d.city));
      if (d.source === 'seasonal_normal') block.appendChild(el('p', 'tc-hint', '≈ ' + t('wxSeasonalNote')));
      var days = (d.days || []);
      var hasData = days.some(function (x) { return x.source !== 'unavailable'; });
      if (!hasData) { block.appendChild(el('p', 'tc-empty', t('wxUnavailable'))); wrap.appendChild(block); return; }
      var grid = el('div', 'tc-wxgrid');
      days.forEach(function (x) { grid.appendChild(wxDayCard(x)); });
      block.appendChild(grid);
      if (d.packingTips && d.packingTips.length) {
        var pk = el('div', 'tc-wxpack');
        pk.appendChild(el('strong', 'tc-wxpack__t', '🎒 ' + t('wxPackingTitle')));
        var ul = el('ul', 'tc-wxpack__list');
        d.packingTips.forEach(function (k) { ul.appendChild(el('li', null, t('wxtip_' + k) || k)); });
        pk.appendChild(ul); block.appendChild(pk);
      }
      wrap.appendChild(block);
    });
    wrap.appendChild(el('p', 'tc-unverified', t('unverified')));
    return wrap;
  }
  // ── Stopovers tab ───────────────────────────────────────────────────────
  function stopCatIcon(ty) { return ({ meal: '🍽', rest: '🚻', gas: '⛽', coffee: '☕', attraction: '📸', scenic: '🏞', hotel: '🏨' })[ty] || '📍'; }
  function stopoverKey(lg, so, i, j) { return (lg.fromCity || '') + '>' + (lg.toCity || '') + '#' + j + ':' + String(so.name || '').toLowerCase(); }
  function stopoverCard(lg, so, i, j) {
    var tr = state.trip, key = stopoverKey(lg, so, i, j);
    var ovr = (tr.stopoverChoices || {})[key];
    var c = el('article', 'tc-stop' + (ovr === 'skipped' ? ' tc-stop--skipped' : ''));
    var top = el('div', 'tc-stop__top');
    top.appendChild(el('span', 'tc-stop__type', stopCatIcon(so.type) + ' ' + (t('stoptype_' + so.type) || so.type)));
    if (so.estimatedStopDuration) top.appendChild(el('span', 'tc-stop__dur', '⏱ ' + so.estimatedStopDuration));
    if (ovr === 'added') top.appendChild(el('span', 'tc-stop__badge', '✓ ' + t('soAdded')));
    if (ovr === 'optional') top.appendChild(el('span', 'tc-stop__badge', t('soOptional')));
    c.appendChild(top);
    c.appendChild(el('strong', 'tc-stop__name', so.name));
    if (so.location) c.appendChild(el('p', 'tc-stop__loc', '📍 ' + so.location));
    if (so.whyRecommended) { var w = el('p', 'tc-stop__why'); w.appendChild(el('span', 'tc-attr__why-k', '💡 ')); w.appendChild(doc.createTextNode(so.whyRecommended)); c.appendChild(w); }
    if (so.estimatedCost) c.appendChild(chip('tc-chip--cost', '💵 ' + so.estimatedCost));
    if (so.alternatives && so.alternatives.length) c.appendChild(el('p', 'tc-stop__alts', t('soAlternatives') + ': ' + so.alternatives.join(' · ')));
    var acts = el('div', 'tc-stop__acts');
    acts.appendChild(linkBtn('🗺 ' + t('route'), so.mapUrl || MapLinkProvider.google(so.name, so.location)));
    if (canEditPlan()) {
      tr.stopoverChoices = tr.stopoverChoices || {};
      acts.appendChild(pbtn(ovr === 'added' ? ('✓ ' + t('soAdded')) : ('＋ ' + t('soAdd')), ovr === 'added' ? 'tc-pbtn--accent' : '', function () { tr.stopoverChoices[key] = 'added'; saveTrip(tr); render(); }));
      acts.appendChild(pbtn(t('soOptional'), '', function () { tr.stopoverChoices[key] = 'optional'; saveTrip(tr); render(); }));
      acts.appendChild(pbtn('⤫ ' + t('soSkip'), 'tc-pbtn--danger', function () { tr.stopoverChoices[key] = 'skipped'; saveTrip(tr); render(); }));
    }
    c.appendChild(acts);
    c.appendChild(el('span', 'tc-event__pending', '≈ ' + t('soPending')));
    var _lms = learnMoreSection({ name: so.name, address: so.location || '', category: so.type }, mediaTypeForPlace({ category: so.type }), so.location || (lg && lg.toCity) || ''); if (_lms) c.appendChild(_lms); // "Learn more"
    if (!state.readonly && so.name) c.appendChild(voteRow({ name: so.name }));
    return c;
  }
  function renderStopovers(plan) {
    var tr = state.trip, wrap = el('div', 'tc-stays tc-stops');
    wrap.appendChild(el('strong', 'tc-stays__t', '🛣 ' + t('stopoversTitle')));
    wrap.appendChild(el('p', 'tc-stays__sub', t('stopoversSub')));
    if (!state.readonly && !tr._demo) {
      var find = el('button', 'tc-cta', (tr.stopovers && tr.stopovers.length) ? ('↻ ' + t('refreshStopovers')) : t('findStopovers')); find.type = 'button';
      find.addEventListener('click', function () { find.disabled = true; state.generating = true; renderGenerating(t('researchingStopovers')); researchStopovers(tr).then(function (res) { state.generating = false; if (res.legs && res.legs.length) { tr.stopovers = res.legs; saveTrip(tr); } render(); }); });
      wrap.appendChild(find);
    }
    var legs = (tr.stopovers && tr.stopovers.length) ? tr.stopovers : [];
    if (isResearching('stopovers') && !legs.length) { wrap.appendChild(researchBanner('researchingStopovers')); return wrap; }
    if (!legs.length) { wrap.appendChild(el('p', 'tc-empty', t('noStopoversYet'))); return wrap; }
    legs.forEach(function (lg, i) {
      var block = el('div', 'tc-stayblock');
      var head = el('div', 'tc-stayblock__head');
      head.appendChild(el('strong', 'tc-stayblock__city', '🚗 ' + (lg.fromCity || '') + ' → ' + (lg.toCity || '')));
      if (lg.driveDistanceText || lg.driveDurationText) head.appendChild(el('span', 'tc-stop__leg', [lg.driveDistanceText, lg.driveDurationText].filter(Boolean).join(' · ')));
      block.appendChild(head);
      consensusSort((lg.stopovers || []).filter(function (so) { return so && so.name && !rejectedNameSet(tr)[(so.name || '').trim().toLowerCase()]; }), function (so) { return so.name; }).forEach(function (so, j) { block.appendChild(stopoverCard(lg, so, i, j)); });
      wrap.appendChild(block);
    });
    wrap.appendChild(el('p', 'tc-unverified', t('unverified')));
    return wrap;
  }
  // ── Costs tab (Trip Cost Agent + Family Split) ──────────────────────────
  function money(n) { return '$' + (Math.round(n || 0)).toLocaleString('en-US'); }
  function costSummaryStrip(tr) {
    var costs = computeTripCosts(tr);
    var s = el('button', 'tc-coststrip'); s.type = 'button';
    s.appendChild(el('span', 'tc-coststrip__k', '💰 ' + t('costEstTotal')));
    s.appendChild(el('strong', 'tc-coststrip__v', money(costs.total.expected)));
    s.appendChild(el('span', 'tc-coststrip__sub', money(costs.perPerson) + '/' + t('costPerPersonShort') + ' · ' + money(costs.perDay) + '/' + t('day').toLowerCase()));
    s.addEventListener('click', function () { state.activeTab = 'costs'; render(); });
    return s;
  }
  function renderCosts(plan) {
    var tr = state.trip, wrap = el('div', 'tc-costs');
    wrap.appendChild(el('strong', 'tc-costs__t', '💰 ' + t('costsTitle')));
    wrap.appendChild(el('p', 'tc-costs__sub', t('costsSub')));
    var costs = computeTripCosts(tr);
    // Headline cards
    var grid = el('div', 'tc-costs__grid');
    [['costEstTotal', costs.total.expected], ['costPerFamilyAvg', Math.round(costs.total.expected / costs.perFamilies.length)], ['costPerPerson', costs.perPerson], ['costPerDay', costs.perDay]].forEach(function (p) {
      var card = el('div', 'tc-costcard'); card.appendChild(el('span', 'tc-costcard__k', t(p[0]))); card.appendChild(el('strong', 'tc-costcard__v', money(p[1]))); grid.appendChild(card);
    });
    wrap.appendChild(grid);
    wrap.appendChild(el('p', 'tc-costs__range', t('costRangeLabel') + ': ' + money(costs.total.low) + ' – ' + money(costs.total.high) + '  (' + t('costExpected') + ' ' + money(costs.total.expected) + ')'));
    // By category
    wrap.appendChild(el('strong', 'tc-costs__h', t('costByCategory')));
    ['transport', 'stay', 'activities', 'food', 'other'].forEach(function (cat) {
      var v = costs.byCategory[cat]; if (!v) return;
      var row = el('div', 'tc-costrow'); row.appendChild(el('span', 'tc-costrow__k', t('costcat_' + cat))); row.appendChild(el('span', 'tc-costrow__v', money(v)));
      var bar = el('div', 'tc-costrow__bar'); var fill = el('i'); fill.style.width = Math.round(v / (costs.total.expected || 1) * 100) + '%'; bar.appendChild(fill); row.appendChild(bar);
      wrap.appendChild(row);
    });
    // Family split
    wrap.appendChild(el('strong', 'tc-costs__h', t('costSplitTitle')));
    var split = costSplit(tr);
    if (canEditPlan()) wrap.appendChild(field(t('costSplitMode'), (function () { var sel = selectFrom(['per_person', 'equal', 'per_family', 'owner_pays'], split.mode, function (o) { return t('split_' + o); }); sel.addEventListener('change', function () { split.mode = sel.value; saveTrip(tr); render(); }); return sel; })()));
    else wrap.appendChild(el('p', 'tc-hint', t('split_' + split.mode)));
    var shares = familyShares(tr, costs);
    shares.forEach(function (fs) {
      var row = el('div', 'tc-costrow'); row.appendChild(el('span', 'tc-costrow__k', fs.name + ' (' + fs.travelers + ')')); row.appendChild(el('strong', 'tc-costrow__v', money(fs.share))); wrap.appendChild(row);
    });
    // Task payment balance (P2): per-family owed (from task actual/estimate costs) − actually paid;
    // total paid / remaining unpaid. Reuses the split mode + the who-paid ledger.
    if (root.TCTasks && Array.isArray(tr.bookings) && tr.bookings.length) {
      var _bal = root.TCTasks.computeBalances(tr.bookings, shares.map(function (f) { return { id: f.id, name: f.name, travelers: f.travelers }; }), split, costLedger(tr));
      if (_bal.totalEstimated || _bal.totalActual || _bal.totalPaid) {
        wrap.appendChild(el('strong', 'tc-costs__h', t('taskBalanceTitle')));
        _bal.perFamily.forEach(function (fb) {
          var row = el('div', 'tc-costrow');
          row.appendChild(el('span', 'tc-costrow__k', fb.name + ' · ' + t('taskOwed') + ' ' + money(fb.owed) + ' · ' + t('costPaid') + ' ' + money(fb.paid)));
          row.appendChild(el('strong', 'tc-costrow__v', (fb.balance > 0 ? t('taskOwes') + ' ' : (fb.balance < 0 ? t('taskAhead') + ' ' : '')) + money(Math.abs(fb.balance))));
          wrap.appendChild(row);
        });
        var totRow = el('div', 'tc-costrow'); totRow.appendChild(el('span', 'tc-costrow__k', t('taskPaidTotal'))); totRow.appendChild(el('strong', 'tc-costrow__v', money(_bal.totalPaid) + ' · ' + t('taskRemaining') + ' ' + money(_bal.remaining))); wrap.appendChild(totRow);
      }
      // Per-MEMBER owed (V6): named-person rollup — a member-assigned task is owed in full; a
      // family-assigned task with a named roster splits equally among that family's members.
      // Honest estimate (actual → estimate → priceRange low); shown only when members are named.
      var _mc = root.TCTasks.memberCosts(tr.bookings, tripFamiliesWithMembers());
      if (_mc.perMember.length) {
        wrap.appendChild(el('strong', 'tc-costs__h', t('memberCostTitle')));
        _mc.perMember.forEach(function (pm) {
          var row = el('div', 'tc-costrow');
          row.appendChild(el('span', 'tc-costrow__k', '🙋 ' + pm.name + (pm.familyName ? ' · ' + pm.familyName : '')));
          row.appendChild(el('strong', 'tc-costrow__v', money(pm.owed)));
          wrap.appendChild(row);
        });
        if (_mc.unassigned > 0) { var _ur = el('div', 'tc-costrow'); _ur.appendChild(el('span', 'tc-costrow__k', t('memberCostUnassigned'))); _ur.appendChild(el('span', 'tc-costrow__v', money(_mc.unassigned))); wrap.appendChild(_ur); }
      }
    }
    // Who paid / owes ledger
    wrap.appendChild(el('strong', 'tc-costs__h', t('costLedgerTitle')));
    var led = costLedger(tr);
    if (!led.length) wrap.appendChild(el('p', 'tc-hint', t('costLedgerEmpty')));
    led.forEach(function (e) {
      var row = el('div', 'tc-ledrow' + (e.paid ? ' tc-ledrow--paid' : ''));
      var fam = (tr.families || []).filter(function (f) { return (f.id || '') === e.familyId; })[0];
      row.appendChild(el('span', 'tc-ledrow__k', (fam ? (fam.name || '') + ' · ' : '') + (e.title || '')));
      row.appendChild(el('span', 'tc-ledrow__v', money(e.amount)));
      if (canEditPlan()) {
        row.appendChild(pbtn(e.paid ? ('✓ ' + t('costPaid')) : t('costMarkPaid'), e.paid ? 'tc-pbtn--accent' : '', function () { toggleLedgerPaid(tr, e.id); }));
        row.appendChild(pbtn('×', 'tc-pbtn--danger', function () { removeLedgerEntry(tr, e.id); }));
      }
      wrap.appendChild(row);
    });
    if (canEditPlan()) {
      var addRow = el('div', 'tc-ledadd');
      var fsel = selectFrom([''].concat((tr.families || []).map(function (f) { return f.id; })), '', function (o) { var f = (tr.families || []).filter(function (x) { return x.id === o; })[0]; return f ? (f.name || o) : t('costWhoPaid'); });
      var ti = input('', t('costLedgerTitlePh')); var ai = input('', '0', 'number');
      addRow.appendChild(fsel); addRow.appendChild(ti); addRow.appendChild(ai);
      addRow.appendChild(pbtn('＋ ' + t('costAddPaid'), 'tc-pbtn--accent', function () { if (!(+ai.value)) { toast(t('costLedgerTitlePh')); return; } addLedgerEntry(tr, fsel.value, ti.value || t('costMisc'), ai.value); }));
      wrap.appendChild(addRow);
    }
    // Editable assumptions (owner)
    if (canEditPlan()) {
      var details = el('details', 'tc-costassum'); details.appendChild(el('summary', 'tc-costassum__sum', '⚙ ' + t('costAssumptions')));
      var a = costs.assumptions;
      [['foodPerPersonPerDay', 'costAsmFood'], ['hotelPerNight', 'costAsmHotel'], ['gasPerMile', 'costAsmGas'], ['ticketPerPerson', 'costAsmTicket'], ['parkingPerDay', 'costAsmParking'], ['snacksPerPersonPerDay', 'costAsmSnacks'], ['souvenirsPerFamily', 'costAsmSouvenir']].forEach(function (p) {
        var inp = input(a[p[0]], '', 'number'); inp.step = 'any'; inp.addEventListener('change', function () { a[p[0]] = +inp.value || 0; saveTrip(tr); render(); }); details.appendChild(field(t(p[1]), inp));
      });
      wrap.appendChild(details);
    }
    wrap.appendChild(el('p', 'tc-unverified', t('costDisclaimer')));
    return wrap;
  }
  // ════════════════════════════════════════════════════════════════════════
  //  LIVE TRIP LOCATION SHARING — opt-in, members-only, latest-only, auto-expiring.
  //  Owner enables trip sharing (trip.liveSharingEnabled). Each member shares THEIR
  //  own location (geolocation → groupTrips/{id}/liveLocations/{uid}); readers see it
  //  via onSnapshot. expiresAt + delete-on-stop + a scheduled sweep = nothing persists.
  //  Rules: members-only read, self-write gated on the toggle, self/owner delete.
  // ════════════════════════════════════════════════════════════════════════
  function liveLocCol(tr) { try { return root.dlcDb.collection('groupTrips').doc(tr.id).collection('liveLocations'); } catch (e) { return null; } }
  function liveNow() { return Date.now(); }
  function liveExpiry(mode) {
    var now = Date.now();
    if (mode === 'hour') return now + 3600000;
    if (mode === 'today') { var d = new Date(now); d.setHours(23, 59, 59, 0); return d.getTime(); }
    // 'trip' → end of the last trip date (+ a day buffer), else now + 7 days
    var parsed = parseTripDates(tr_dateRange()); return now + 7 * 86400000;
  }
  function tr_dateRange() { return (state.trip && state.trip.dateRange) || ''; }
  function liveDistMi(a, b) { if (!a || !b) return null; var R = 3958.8, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180, la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180; var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2); return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
  function relTime(ms) { if (!ms) return ''; var s = Math.max(0, Math.round((Date.now() - ms) / 1000)); if (s < 60) return s + 's ' + t('ago'); var m = Math.round(s / 60); if (m < 60) return m + 'm ' + t('ago'); var h = Math.round(m / 60); return h + 'h ' + t('ago'); }
  function myDisplayName() { try { var me = getMe(); if (me) return me; } catch (e) {} var u = realUser(); return (u && u.email) ? u.email.split('@')[0] : 'Me'; }
  function myFamilyId() { try { var u = curUid(); if (u && state.trip && state.trip.memberFamily && state.trip.memberFamily[u]) return state.trip.memberFamily[u]; } catch (e) {} return ''; }
  function navUrl(lat, lng) { return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(lat + ',' + lng); }
  function navUrlAddr(addr) { return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr || ''); }
  function viewUrl(lat, lng) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat + ',' + lng); }
  function toggleTripSharing(tr, on) { tr.liveSharingEnabled = !!on; if (!on) stopLiveShare(tr); saveTrip(tr); render(); }
  // ── My sharing (geolocation watch → throttled writes) ──
  function pushMyLocation(tr, coords, force) {
    var sh = state._liveShare; if (!sh || !realUser()) return;
    if (coords && coords.latitude != null) state._liveLastCoords = { lat: coords.latitude, lng: coords.longitude };
    var now = Date.now();
    if (!force && sh.lastWrite && (now - sh.lastWrite) < 15000) return; // throttle ~15s
    var col = liveLocCol(tr); if (!col) return;
    sh.lastWrite = now;
    var u = curUid();
    var doc2 = {
      memberId: u, familyId: myFamilyId(), memberName: myDisplayName(),
      latitude: coords.latitude, longitude: coords.longitude,
      accuracy: coords.accuracy || null, heading: (coords.heading != null ? coords.heading : null), speed: (coords.speed != null ? coords.speed : null),
      sharingStatus: sh.status || 'on_the_way', updatedAt: now, expiresAt: sh.expiresAt,
    };
    try { col.doc(u).set(doc2).catch(function () {}); } catch (e) {}
  }
  function startLiveShare(tr, mode) {
    if (!realUser()) { toast(t('liveLoginNeeded')); return; }
    if (!tr.liveSharingEnabled) { toast(t('liveOwnerOff')); return; }
    stopLiveShare(tr, true);
    var sh = state._liveShare = { mode: mode, status: 'on_the_way', expiresAt: liveExpiry(mode), watchId: null, lastWrite: 0 };
    var geo = root.navigator && root.navigator.geolocation;
    if (!geo) { toast(t('liveNoGeo')); state._liveManual = true; render(); return; }
    try {
      sh.watchId = geo.watchPosition(function (pos) { if (state._liveShare === sh) pushMyLocation(tr, pos.coords); },
        function () { /* permission denied / unavailable — keep UI, user can retry */ },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    } catch (e) {}
    // expiry watchdog
    if (state._liveExpiryTimer) { try { root.clearInterval(state._liveExpiryTimer); } catch (e) {} }
    state._liveExpiryTimer = root.setInterval(function () { if (state._liveShare && Date.now() > state._liveShare.expiresAt) { stopLiveShare(state.trip); if (state.screen === 'plan') render(); } }, 30000);
    toast(t('liveSharingOn')); render();
  }
  function stopLiveShare(tr, silent) {
    var sh = state._liveShare;
    if (sh && sh.watchId != null) { try { root.navigator.geolocation.clearWatch(sh.watchId); } catch (e) {} }
    if (state._liveExpiryTimer) { try { root.clearInterval(state._liveExpiryTimer); } catch (e) {} state._liveExpiryTimer = null; }
    state._liveShare = null;
    var u = curUid(); var col = tr && liveLocCol(tr);
    if (u && col) { try { col.doc(u).delete().catch(function () {}); } catch (e) {} } // stop = delete own (privacy)
    if (!silent) { toast(t('liveStopped')); render(); }
  }
  function setMyLiveStatus(tr, status) { if (!state._liveShare) return; state._liveShare.status = status; pushMyLocation(tr, { latitude: (state._liveLastCoords && state._liveLastCoords.lat) || 0, longitude: (state._liveLastCoords && state._liveLastCoords.lng) || 0 }, true); render(); }
  // ── Reading others' locations (onSnapshot; filter expired) ──
  function subscribeLive(tr) {
    if (!tr || tr._demo || !realUser() || state._liveSubFor === tr.id) return;
    var col = liveLocCol(tr); if (!col) return;
    if (state._liveUnsub) { try { state._liveUnsub(); } catch (e) {} }
    state._liveSubFor = tr.id; state._liveLocations = {};
    try {
      state._liveUnsub = col.onSnapshot(function (snap) {
        var map = {}; snap.forEach(function (d) { var v = d.data() || {}; if (!v.expiresAt || v.expiresAt > Date.now()) map[d.id] = v; });
        state._liveLocations = map; if (state.screen === 'plan' && state.activeTab === 'group') render();
      }, function () {});
    } catch (e) {}
  }
  function liveMembers(tr) {
    var m = state._liveLocations || {}, out = [];
    Object.keys(m).forEach(function (k) { out.push(m[k]); });
    out.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    return out;
  }
  function liveStatusLabel(s) { return t('livestatus_' + (s || 'on_the_way')) || s; }
  // In-app trip activity / notifications (Capability 8). Push isn't ready, so we surface
  // real-time alerts IN-APP, derived only from existing trip data (no fake data, no new
  // collection): pending suggestions needing a vote, unbooked items with a deadline, and
  // member arrival/delay status. Members-only (rendered inside the trip for a signed-in user).
  function tripActivityFeed(tr, members) {
    var items = [];
    (tr.bookings || []).forEach(function (b) {
      var st = b.bookingStatus || '';
      if (st === 'booked' || st === 'paid' || st === 'skipped' || st === 'not_needed') return;
      var what = b.title || b.name || ''; if (!what) return;
      if (b.assignedToFamily && b.assignedToFamily === getMe()) items.push({ ic: '🙋', txt: t('actTaskMine').replace('{what}', what) });
      else if (b.deadline || b.dueDate) items.push({ ic: '📌', txt: t('actBookReminder').replace('{what}', what).replace('{when}', b.dueDate || b.deadline) });
      else items.push({ ic: '📌', txt: t('actBookSoon').replace('{what}', what) });
    });
    (tr.suggestions || []).forEach(function (sg) {
      if ((sg.status || 'pending') === 'pending' && sg.text) items.push({ ic: '💡', txt: t('actSuggested').replace('{who}', sg.familyName || t('liveMember')).replace('{what}', sg.text) });
    });
    (members || []).forEach(function (loc) {
      if (loc.sharingStatus === 'arrived') items.push({ ic: '✅', txt: t('actArrived').replace('{who}', loc.memberName || t('liveMember')) });
      else if (loc.sharingStatus === 'delayed') items.push({ ic: '⏰', txt: t('actDelayed').replace('{who}', loc.memberName || t('liveMember')) });
    });
    var box = el('section', 'tc-actfeed');
    box.appendChild(el('strong', 'tc-actfeed__t', '🔔 ' + t('actFeedTitle') + (items.length ? ' (' + items.length + ')' : '')));
    if (!items.length) { box.appendChild(el('p', 'tc-hint', t('actNone'))); }
    else { items.slice(0, 12).forEach(function (it) { var r = el('div', 'tc-actfeed__row'); r.appendChild(el('span', 'tc-actfeed__ic', it.ic)); r.appendChild(el('span', 'tc-actfeed__tx', it.txt)); box.appendChild(r); }); }
    box.appendChild(el('p', 'tc-hint tc-actfeed__note', t('actInApp')));
    return box;
  }
  function renderLiveLocation(plan) {
    var tr = state.trip, wrap = el('div', 'tc-live2');
    wrap.appendChild(el('strong', 'tc-live2__t', '📍 ' + t('liveTitle2')));
    wrap.appendChild(el('p', 'tc-live2__sub', t('liveSub2')));
    if (tr._demo) { wrap.appendChild(el('p', 'tc-empty', t('liveDemo'))); return wrap; }
    if (!realUser()) { wrap.appendChild(el('p', 'tc-empty', t('liveLoginNeeded'))); return wrap; }
    // Owner: enable/disable trip sharing.
    if (isOwnerOfTrip()) {
      var tog = el('label', 'tc-toggle'); tog.appendChild(el('span', null, t('liveEnableTrip')));
      var cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = !!tr.liveSharingEnabled; cb.addEventListener('change', function () { toggleTripSharing(tr, cb.checked); });
      tog.appendChild(cb); wrap.appendChild(tog);
    }
    // In-app activity/alerts feed (Capability 8) — shows even when location sharing is off,
    // since booking reminders + votes-needed don't depend on location.
    wrap.appendChild(tripActivityFeed(tr, liveMembers(tr)));
    if (!tr.liveSharingEnabled) { wrap.appendChild(el('p', 'tc-empty', t('liveOff'))); wrap.appendChild(el('p', 'tc-hint', t('livePrivacy'))); return wrap; }
    subscribeLive(tr);
    // My sharing controls.
    var mine = el('div', 'tc-live2__mine');
    if (state._liveShare) {
      mine.appendChild(el('span', 'tc-live2__on', '🟢 ' + t('liveYouSharing') + ' · ' + t('liveExpires') + ' ' + relTimeFuture(state._liveShare.expiresAt)));
      var statusRow = el('div', 'tc-live2__statusrow');
      ['on_the_way', 'arrived', 'delayed', 'break'].forEach(function (s) { statusRow.appendChild(pbtn(liveStatusLabel(s), 'tc-pbtn--ghost' + (state._liveShare.status === s ? ' tc-pbtn--on' : ''), function () { setMyLiveStatus(tr, s); })); });
      mine.appendChild(statusRow);
      mine.appendChild(pbtn('⛔ ' + t('liveStop'), 'tc-pbtn--danger', function () { stopLiveShare(tr); }));
    } else {
      mine.appendChild(el('span', 'tc-live2__off', t('liveShareMine')));
      var btns = el('div', 'tc-live2__sharebtns');
      btns.appendChild(pbtn(t('liveShareTrip'), 'tc-pbtn--accent', function () { startLiveShare(tr, 'trip'); }));
      btns.appendChild(pbtn(t('liveShareToday'), '', function () { startLiveShare(tr, 'today'); }));
      btns.appendChild(pbtn(t('liveShareHour'), '', function () { startLiveShare(tr, 'hour'); }));
      mine.appendChild(btns);
    }
    wrap.appendChild(mine);
    // Navigate targets (next stop / hotel) for everyone.
    var day = (plan.days || [])[state.activeDay] || {};
    var nextCity = destCityName(plan, day.destinationIndex || 0) || tr.destination || '';
    var hotelArea = '';
    try { var st = (tr.stays || []).filter(function (s) { return (s.city || '').toLowerCase() === nextCity.toLowerCase(); })[0]; hotelArea = (st && st.bestArea) || ''; } catch (e) {}
    var navRow = el('div', 'tc-live2__nav');
    if (nextCity) navRow.appendChild(linkBtn('🧭 ' + t('liveNavNext'), navUrlAddr(nextCity), 'tc-pbtn--accent'));
    if (hotelArea || nextCity) navRow.appendChild(linkBtn('🏨 ' + t('liveNavHotel'), navUrlAddr((hotelArea ? hotelArea + ', ' : '') + nextCity)));
    wrap.appendChild(navRow);
    // Live group list (members sharing now).
    var members = liveMembers(tr);
    // True embedded Google map of live members (client key + importLibrary — same approach as the
    // working photos/routes). Falls back silently to the nav links above if Maps is unavailable.
    if (members.length) { var mapBox = el('div', 'tc-livemap'); mapBox.setAttribute('aria-label', t('liveViewMap')); wrap.appendChild(mapBox); mountLiveMap(mapBox, members, nextCity); }
    wrap.appendChild(el('strong', 'tc-live2__h', '👥 ' + t('liveGroup') + (members.length ? ' (' + members.length + ')' : '')));
    if (!members.length) { wrap.appendChild(el('p', 'tc-hint', t('liveNobody'))); }
    var myCoords = state._liveLastCoords;
    members.forEach(function (loc) {
      var c = el('article', 'tc-live2__m');
      var head = el('div', 'tc-live2__mhead');
      head.appendChild(el('strong', 'tc-live2__mn', (loc.memberId === curUid() ? '⭐ ' : '👤 ') + (loc.memberName || t('liveMember'))));
      head.appendChild(el('span', 'tc-live2__mstatus tc-live2__mstatus--' + (loc.sharingStatus || 'on_the_way'), liveStatusLabel(loc.sharingStatus)));
      c.appendChild(head);
      var meta = el('div', 'tc-live2__mmeta');
      meta.appendChild(el('span', null, '🕒 ' + relTime(loc.updatedAt)));
      if (myCoords && loc.latitude != null) { var d = liveDistMi(myCoords, { lat: loc.latitude, lng: loc.longitude }); if (d != null) meta.appendChild(el('span', null, '📏 ' + (d < 0.2 ? t('liveHere') : (d.toFixed(d < 10 ? 1 : 0) + ' mi')))); }
      c.appendChild(meta);
      if (loc.memberId !== curUid() && loc.latitude != null) {
        var acts = el('div', 'tc-live2__macts');
        acts.appendChild(linkBtn('📍 ' + t('liveViewMap'), viewUrl(loc.latitude, loc.longitude)));
        acts.appendChild(linkBtn('🧭 ' + t('liveNavTo'), navUrl(loc.latitude, loc.longitude), 'tc-pbtn--accent'));
        c.appendChild(acts);
      }
      wrap.appendChild(c);
    });
    wrap.appendChild(el('p', 'tc-hint tc-live2__priv', '🔒 ' + t('livePrivacy')));
    return wrap;
  }
  function relTimeFuture(ms) { if (!ms) return ''; var s = Math.max(0, Math.round((ms - Date.now()) / 1000)); if (s < 3600) return Math.round(s / 60) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; }
  // Track my own last coords (for distance display) whenever geolocation reports — set in pushMyLocation.
  function renderFood(plan) {
    var tr = state.trip;
    var wrap = el('div', 'tc-stays tc-food');
    wrap.appendChild(el('strong', 'tc-stays__t', '🍽 ' + t('foodPicksTitle')));
    wrap.appendChild(el('p', 'tc-stays__sub', t('foodSub')));
    if (!state.readonly && !tr._demo) {
      var find = el('button', 'tc-cta', t('findFood')); find.type = 'button';
      find.addEventListener('click', function () {
        find.disabled = true; state.generating = true; renderGenerating(t('researchingFood'));
        researchRestaurants(tr).then(function (res) { state.generating = false; if (res.food && res.food.length) { tr.food = res.food; saveTrip(tr); } render(); });
      });
      wrap.appendChild(find);
    }
    var food = (tr.food && tr.food.length) ? tr.food : [];
    if (isResearching('food') && !food.length) { wrap.appendChild(researchBanner('researchingFood')); return wrap; }
    if (!food.length) { wrap.appendChild(el('p', 'tc-empty', t('noFoodYet'))); return wrap; }
    var frej = rejectedNameSet(tr); // group-skipped restaurants never re-appear
    food.forEach(function (f) {
      var picks = (f.picks || []).filter(function (p) { return p && p.name && !frej[(p.name || '').trim().toLowerCase()]; });
      if (!picks.length) return;
      var block = el('div', 'tc-stayblock');
      var head = el('div', 'tc-stayblock__head');
      head.appendChild(el('strong', 'tc-stayblock__city', '📍 ' + (f.city || '')));
      block.appendChild(head);
      if (f.note) block.appendChild(el('p', 'tc-stayblock__why', f.note));
      var fn = voteSortNote(picks, function (p) { return p.name; }); if (fn) block.appendChild(fn);
      consensusSort(picks, function (p) { return p.name; }).forEach(function (p) { block.appendChild(foodCard(p, f.city)); });
      block.appendChild(el('p', 'tc-unverified', t('unverified')));
      wrap.appendChild(block);
    });
    return wrap;
  }

  // ── Bookings tab: human-approval-gated booking checklist (never purchases) ──
  function bookingTypeIcon(type) { return ({ flight: '✈', hotel: '🏨', airbnb: '🏠', attraction: '🎟', restaurant: '🍽', tour: '🧭', parking: '🅿️', rental_car: '🚗', bus: '🚌', ride: '🚙', packing: '🎒', payment: '💳', confirmation: '📋', other: '📝' })[type] || '📌'; }
  function bookingStatusClass(s) { return ({ completed: 'tc-bstat--booked', booked: 'tc-bstat--booked', paid: 'tc-bstat--booked', ready_to_book: 'tc-bstat--ready', user_approval_needed: 'tc-bstat--approve', skipped: 'tc-bstat--skip', not_needed: 'tc-bstat--skip' })[s] || 'tc-bstat--research'; }
  function bookingForPlace(p) {
    if (!p || !state.trip || !Array.isArray(state.trip.bookings)) return null;
    var pid = p.id, name = (p.name || '').trim().toLowerCase();
    return state.trip.bookings.filter(function (b) { return (pid && b.placeId === pid) || (name && String(b.title || '').trim().toLowerCase() === name); })[0] || null;
  }
  function warnText(w) {
    if (w.key === 'warn_hotel_first') return t('warnHotelFirst').replace('{city}', w.city || '');
    if (w.key === 'warn_book_soon') return t('warnBookSoon').replace('{title}', w.title || '');
    if (w.key === 'warn_return_missing') return t('warnReturnMissing');
    if (w.key === 'warn_unscheduled') return t('warnUnscheduled').replace('{n}', String(w.count || 0));
    return '';
  }
  // V6 Next-Action hero — the single next thing to do (dependency-aware). Null booking → all set.
  function naCard(b, tr) {
    if (!b) {
      var done = el('div', 'tc-na tc-na--done');
      done.appendChild(el('span', 'tc-na__k', '✓ ' + t('naTitle')));
      done.appendChild(el('strong', 'tc-na__t', t('naAllSet')));
      return done;
    }
    var c = el('div', 'tc-na');
    c.appendChild(el('span', 'tc-na__k', '➡ ' + t('naTitle')));
    c.appendChild(el('strong', 'tc-na__t', b.title || ''));
    var meta = el('div', 'tc-na__meta');
    var p = b.priority || (root.TCTasks ? root.TCTasks.priority(b.type) : 'P2');
    meta.appendChild(el('span', 'tc-na__pri tc-na__pri--' + String(p).toLowerCase(), t('pri_' + p)));
    if (b.city) meta.appendChild(el('span', 'tc-na__chip', '📍 ' + b.city));
    if (b.dueDate) meta.appendChild(el('span', 'tc-na__chip', '⏰ ' + b.dueDate));
    var cost = b.actualCost || b.costEstimate || b.priceRange;
    if (cost) meta.appendChild(el('span', 'tc-na__chip', '💵 ' + (b.actualCost ? '' : '~') + String(cost).replace(/^\$?/, '$')));
    if (b.assignedToFamily) { var fam = famName(b.assignedToFamily); if (fam) meta.appendChild(el('span', 'tc-na__chip', '👤 ' + fam)); }
    if (b.assignedToMember) { var _mn = memberName(b.assignedToMember); if (_mn) meta.appendChild(el('span', 'tc-na__chip', '🙋 ' + _mn)); }
    c.appendChild(meta);
    if (!state.readonly && !tr._demo) {
      var acts = el('div', 'tc-na__acts');
      if (isDlcRideTask(b)) {
        // The Next Action is a DuLichCali ride → primary CTA books inside the app (no Google link).
        rideTaskActions(b, acts, 'tc-na__btn tc-na__btn--gold');
      } else {
        var links = BookingLinkProvider.links(b, tr);
        var url = links.officialUrl || links.searchUrl;
        if (url) acts.appendChild(linkBtn('🔎 ' + t('naResearch'), url, 'tc-na__btn'));
      }
      var mk = el('button', 'tc-na__btn tc-na__btn--gold', '✓ ' + t('markBooked')); mk.type = 'button';
      mk.addEventListener('click', function () { if (root.TCTasks) root.TCTasks.setDone(b, true, { by: getMe() || '', byName: (getMe() ? famName(getMe()) : ''), nowIso: new Date().toISOString() }); saveTrip(tr); tcNotifyTask('completed', b.title); render(); });
      acts.appendChild(mk);
      c.appendChild(acts);
    }
    return c;
  }
  function tdealIcon(ty) { return ({ multi_day: '📅', family_bundle: '👨‍👩‍👧‍👦', early_bird: '⏰', combo: '🎟', membership: '🪪', group: '👥', free_day: '🆓', resident: '🏠', military_senior_student: '🎖' })[ty] || '🏷'; }
  // 🏷 Ticket Deals — grounded deal-intelligence for the trip's ticketed attractions. The cheaper
  // option is research only (est. ranges, official + search links); nothing is auto-bought.
  function ticketDealsBlock(tr) {
    var box = el('div', 'tc-tdeals');
    box.appendChild(el('strong', 'tc-tdeals__t', '🏷 ' + t('tdealsTitle')));
    box.appendChild(el('p', 'tc-tdeals__sub', t('tdealsSub')));
    var atts = ticketedAttractions(tr);
    if (!state.readonly && !tr._demo) {
      if (!atts.length) { box.appendChild(el('p', 'tc-hint', t('tdealsNoTickets'))); return box; }
      var cta = el('button', 'tc-cta', (tr.ticketDeals && tr.ticketDeals.length) ? ('↻ ' + t('tdealsRefresh')) : t('tdealsFind')); cta.type = 'button';
      cta.addEventListener('click', function () {
        cta.disabled = true; state.generating = true; renderGenerating(t('tdealsResearching'));
        researchTicketDeals(tr).then(function (res) {
          state.generating = false;
          if (res.deals && res.deals.length) { tr.ticketDeals = res.deals; tr.ticketDealsAt = Date.now(); checkTicketDeals(tr); saveTrip(tr); }
          else toast(t('tdealsNone'));
          render();
        });
      });
      box.appendChild(cta);
    }
    var deals = tr.ticketDeals || [];
    if (!deals.length) { if (state.readonly || tr._demo) box.appendChild(el('p', 'tc-empty', t('tdealsEmpty'))); return box; }
    deals.forEach(function (d) {
      var card = el('article', 'tc-tdeal');
      card.appendChild(el('strong', 'tc-tdeal__name', '🎢 ' + d.attraction + (d.city ? (' · ' + d.city) : '')));
      if (d.note) { var nt = el('p', 'tc-tdeal__note'); nt.appendChild(el('span', 'tc-attr__why-k', '💡 ')); nt.appendChild(doc.createTextNode(d.note)); card.appendChild(nt); }
      (d.items || []).forEach(function (it) {
        var row = el('div', 'tc-tdeal__item');
        var head = el('div', 'tc-tdeal__ihead');
        head.appendChild(el('span', 'tc-tdeal__type', tdealIcon(it.dealType) + ' ' + (t('tdeal_' + it.dealType) || it.dealType)));
        if (it.title) head.appendChild(el('strong', 'tc-tdeal__ttl', it.title));
        row.appendChild(head);
        if (it.description) row.appendChild(el('p', 'tc-tdeal__desc', it.description));
        var meta = el('div', 'tc-tdeal__meta');
        if (it.savingsEstimate) meta.appendChild(el('span', 'tc-tdeal__save', '💰 ' + t('tdealSave') + ' ' + it.savingsEstimate));
        if (it.bookBy) meta.appendChild(el('span', 'tc-tdeal__by', '⏰ ' + t('tdealBookBy') + ' ' + it.bookBy));
        if (it.conditions) meta.appendChild(el('span', 'tc-tdeal__cond', '• ' + it.conditions));
        if (meta.children.length) row.appendChild(meta);
        card.appendChild(row);
      });
      var acts = el('div', 'tc-tdeal__acts');
      acts.appendChild(linkBtn('🔎 ' + t('tdealOfficial'), TicketDealLinkProvider.official(d.attraction), 'tc-pbtn--accent'));
      acts.appendChild(linkBtn('🏷 ' + t('tdealSearch'), TicketDealLinkProvider.deals(d.attraction)));
      card.appendChild(acts);
      card.appendChild(el('p', 'tc-unverified', t('unverified')));
      box.appendChild(card);
    });
    if (tr.ticketDealsAt) box.appendChild(el('p', 'tc-dealwatch__ts', '🕒 ' + t('researchedAt') + ' ' + tpResearchedLabel(tr.ticketDealsAt) + ' · ' + t('unverified')));
    return box;
  }
  function renderBookings(plan) {
    var tr = state.trip;
    normalizeDestinations(tr);
    if (!tr.bookings.length) deriveTripTasks(tr); // seed tasks from itinerary + locked legs + chosen transport on first open
    var _dg = buildDepNodes(tr); // V6: dependency graph — enriches tr.bookings with _dep, gives nextAction + progress
    var wrap = el('div', 'tc-bookings');
    wrap.appendChild(el('strong', 'tc-bookings__t', '🎟 ' + t('bookingsTitle')));
    wrap.appendChild(el('p', 'tc-bookings__sub', t('bookingsSub')));
    // V6 Next-Action: the single next thing to do (dependency-aware), as the focal point.
    if (tr.bookings.length) wrap.appendChild(naCard(_dg.nextAction, tr));
    // V6 smart warnings — the "secretary" nudges (derived from the graph; nothing fabricated).
    if (_dg.warnings && _dg.warnings.length) {
      var ws = el('div', 'tc-warnings');
      _dg.warnings.slice(0, 5).forEach(function (w) {
        var row = el('div', 'tc-warn tc-warn--' + (w.level || 'warn'));
        row.appendChild(el('span', 'tc-warn__ic', w.level === 'info' ? 'ℹ️' : '⚠'));
        row.appendChild(el('span', null, warnText(w)));
        ws.appendChild(row);
      });
      wrap.appendChild(ws);
    }
    wrap.appendChild(el('div', 'tc-bnotice', '🔒 ' + t('bookingApprovalNotice')));
    if (!tr._demo && !state.readonly) {
      var actions = el('div', 'tc-bookings__actions');
      var research = el('button', 'tc-cta', t('researchBookings')); research.type = 'button';
      research.addEventListener('click', function () {
        research.disabled = true; research.textContent = '…';
        researchBookings(tr).then(function (res) {
          var added = (res.items || []).map(function (it) { return newBooking(it.type, it.title, { city: it.city || '', provider: it.provider || '', priceRange: it.priceRange || '', recommendedOption: it.recommendedOption || '', deadline: it.deadline || '', cancellationPolicy: it.cancellationNote || '', dataSource: it.dataSource || 'ai_researched_pending_verification' }); });
          mergeBookings(tr, added); saveTrip(tr); render();
        });
      });
      actions.appendChild(research);
      var rebuild = el('button', 'tc-addbtn', t('rebuildChecklist')); rebuild.type = 'button';
      rebuild.addEventListener('click', function () { deriveTripTasks(tr); saveTrip(tr); render(); });
      actions.appendChild(rebuild);
      wrap.appendChild(actions);
    }
    // 🏷 Ticket Deals (deal-intelligence for ticketed attractions) — shown in demo/readonly too.
    wrap.appendChild(ticketDealsBlock(tr));
    if (tr.bookings.length) {
      // Progress header — N done / M total + readiness %. Reuses TCOverview.readiness (bookingStatus).
      var _rd = (root.TCOverview ? root.TCOverview.readiness(tr.bookings) : { doneCount: 0, totalCount: tr.bookings.length, pct: 0 });
      var prog = el('div', 'tc-bookings__progress');
      var pline = el('div', 'tc-bookings__progline');
      pline.appendChild(el('span', 'tc-bookings__progk', _rd.doneCount + ' ' + t('ovDone') + ' / ' + _rd.totalCount + ' ' + t('ovTotalLc')));
      pline.appendChild(el('span', 'tc-bookings__progpct', _rd.pct + '%'));
      prog.appendChild(pline);
      var barwrap = el('div', 'tc-bookings__bar'); var fill = el('div', 'tc-bookings__barfill'); fill.style.width = _rd.pct + '%'; barwrap.appendChild(fill); prog.appendChild(barwrap);
      // V6 per-group booking progress (only groups that have tasks).
      if (_dg.progress) {
        var _kinds = {}; tr.bookings.forEach(function (b) { if (b._dep) _kinds[b._dep.kind] = 1; });
        var gp = el('div', 'tc-bookings__groups');
        [['transport', 'transport', 'progTransport'], ['hotels', 'lodging', 'progHotels'], ['tickets', 'ticket', 'progTickets'], ['activities', 'activity', 'progActivities'], ['food', 'food', 'progFood']].forEach(function (g) {
          if (!_kinds[g[1]]) return;
          var chip = el('span', 'tc-bookings__gchip');
          chip.appendChild(el('span', 'tc-bookings__gk', t(g[2])));
          chip.appendChild(el('span', 'tc-bookings__gv', _dg.progress[g[0]] + '%'));
          gp.appendChild(chip);
        });
        if (gp.children.length) prog.appendChild(gp);
      }
      wrap.appendChild(prog);
      // Filters — All / To do / Completed / Urgent / My tasks.
      var FILTERS = ['all', 'todo', 'completed', 'urgent', 'mine'];
      var fbar = el('div', 'tc-taskfilters');
      FILTERS.forEach(function (fk) {
        var fb = el('button', 'tc-pbtn' + ((state._taskFilter || 'todo') === fk ? ' tc-pbtn--on' : ''), t('tf_' + fk)); fb.type = 'button';
        fb.addEventListener('click', function () { state._taskFilter = fk; render(); });
        fbar.appendChild(fb);
      });
      wrap.appendChild(fbar);
    }
    if (isResearching('bookings') && !tr.bookings.length) wrap.appendChild(researchBanner('researchingBookings'));
    else if (!tr.bookings.length) wrap.appendChild(el('p', 'tc-empty', t('noBookings')));
    else {
      var _flt = state._taskFilter || 'todo', _me = getMe();
      var _shown = 0;
      // V6 ordering = the user's dependency rule: (1) done sink to bottom, (2) UNBLOCKED before
      // blocked, (3) journey/dependency SEQUENCE (idx*10 + kind-rank — same seq nextAction uses, so
      // the list's first To-Do item == the Next Action), (4) due date, (5) priority score.
      // keep the ORIGINAL index for delete (bookingCard splices tr.bookings[idx]).
      var _KR = (root.TCDepGraph && root.TCDepGraph._KIND_RANK) || { transport: 0, lodging: 1, ticket: 2, activity: 3, food: 4, optional: 5 };
      // NOTE: clamp a non-finite journeyIndex (Infinity for unscheduled tasks) to 1e9 so the
      // kind-rank survives (Infinity*10 would swallow it) and unscheduled tasks order like the
      // engine's loose nextAction path (by priorityScore), keeping "first To-Do == Next Action".
      function _seqOf(b) { var d = b._dep || {}; var ix = (typeof d.idx === 'number' && isFinite(d.idx)) ? d.idx : 1e9; var k = _KR[d.kind]; return ix * 10 + (k == null ? 5 : k); }
      var _ordered = tr.bookings.map(function (b, i) { return { b: b, i: i }; }).sort(function (x, y) {
        var dxd = (root.TCTasks && root.TCTasks.isDone(x.b)) ? 1 : 0, dyd = (root.TCTasks && root.TCTasks.isDone(y.b)) ? 1 : 0;
        if (dxd !== dyd) return dxd - dyd; // completed sink to the bottom (All view)
        var bx = (x.b._dep && x.b._dep.blocked) ? 1 : 0, by = (y.b._dep && y.b._dep.blocked) ? 1 : 0;
        if (bx !== by) return bx - by; // unblocked before blocked
        var sx = _seqOf(x.b), sy = _seqOf(y.b);
        if (sx !== sy) return sx - sy; // journey / dependency sequence
        // Same-seq tiebreak MUST match TCDepGraph.nextAction (priorityScore DESC) so the list head
        // equals the Next-Action card; dueDate is the final tiebreak only.
        var scoreDiff = ((y.b._dep && y.b._dep.score) || 0) - ((x.b._dep && x.b._dep.score) || 0);
        if (scoreDiff) return scoreDiff;
        var ddx = x.b.dueDate || '~', ddy = y.b.dueDate || '~';
        return ddx === ddy ? 0 : (ddx < ddy ? -1 : 1);
      });
      _ordered.forEach(function (o) {
        var b = o.b, i = o.i;
        var _p = b.priority || (root.TCTasks ? root.TCTasks.priority(b.type) : 'P2');
        var _done = root.TCTasks ? root.TCTasks.isDone(b) : false;
        var _show = _flt === 'all'
          || (_flt === 'todo' && !_done)
          || (_flt === 'completed' && _done)
          || (_flt === 'urgent' && _p === 'P0' && !_done)
          || (_flt === 'mine' && _me && b.assignedToFamily && b.assignedToFamily === _me);
        if (_show) { wrap.appendChild(bookingCard(b, i)); _shown++; }
      });
      if (!_shown) wrap.appendChild(el('p', 'tc-empty', t('noBookings')));
      // V6 Dependency Map — the trip as a vertical what-depends-on-what chain (journey-ordered),
      // kept SEPARATE from the day-by-day Timeline. Collapsed by default.
      if (tr.bookings.length > 1) {
        var KR = { transport: 0, lodging: 1, ticket: 2, activity: 3, food: 4, optional: 5 };
        var chain = tr.bookings.slice().sort(function (a, b) {
          var ai = (a._dep && typeof a._dep.idx === 'number') ? a._dep.idx : 1e9, bi = (b._dep && typeof b._dep.idx === 'number') ? b._dep.idx : 1e9;
          if (ai !== bi) return ai - bi;
          return (KR[a._dep && a._dep.kind] || 5) - (KR[b._dep && b._dep.kind] || 5);
        });
        var mapCol = ovCollapse('depmap', '🔗 ' + t('depMapTitle'), t('depMapSub'), false);
        var mb = el('div', 'tc-ov-collapse__body'), dl = el('div', 'tc-depmap');
        chain.forEach(function (b, i) {
          var bdone = root.TCTasks && root.TCTasks.isDone(b), blk = !!(b._dep && b._dep.blocked) && !bdone;
          var isNext = _dg.nextAction && b.id === _dg.nextAction.id;
          var nd = el('div', 'tc-dep' + (bdone ? ' tc-dep--done' : '') + (blk ? ' tc-dep--blocked' : '') + (isNext ? ' tc-dep--next' : ''));
          nd.appendChild(el('span', 'tc-dep__ic', bdone ? '✓' : (blk ? '⚠' : (isNext ? '▶' : '○'))));
          nd.appendChild(el('span', 'tc-dep__t', b.title || ''));
          dl.appendChild(nd);
          if (i < chain.length - 1) dl.appendChild(el('div', 'tc-dep__conn', '↓'));
        });
        mb.appendChild(dl); mapCol.appendChild(mb); wrap.appendChild(mapCol);
      }
    }
    if (!tr._demo && !state.readonly) {
      var addRow = el('div', 'tc-bookings__add');
      var typeSel = selectFrom(BOOKING_TYPES, 'attraction', function (o) { return t('bt_' + o); }); typeSel.className = 'tc-input';
      var titleInp = input('', t('addBooking'));
      var addBtn = el('button', 'tc-cta', '+ ' + t('addBooking')); addBtn.type = 'button';
      addBtn.addEventListener('click', function () { if (!titleInp.value.trim()) return; tr.bookings.push(newBooking(typeSel.value, titleInp.value.trim(), { city: tr.destination || '' })); saveTrip(tr); render(); });
      addRow.appendChild(typeSel); addRow.appendChild(titleInp); addRow.appendChild(addBtn);
      wrap.appendChild(addRow);
    }
    return wrap;
  }
  // Fire a push notification (to other members' devices) when a member makes an important task change.
  function tcNotifyTask(kind, title, familyName) {
    try {
      var tr = state.trip; if (!tr || tr._demo || state.readonly || !realUser() || !title) return;
      var fn = mkCallable('notifyTripTask', 30000); if (!fn) return;
      fn({ tripId: tr.id, kind: kind, title: title, familyName: familyName || '' }).catch(function () {});
    } catch (e) {}
  }
  function bookingCard(b, idx) {
    var tr = state.trip, ro = (state.readonly || tr._demo);
    var done = root.TCTasks ? root.TCTasks.isDone(b) : false;
    var blocked = !!(b._dep && b._dep.blocked) && !done;
    var links = BookingLinkProvider.links(b, tr);
    var c = el('article', 'tc-bk' + (done ? ' tc-bk--done' : '') + (blocked ? ' tc-bk--blocked' : ''));
    // V6: dependency-blocked badge — this task is waiting on a prerequisite (transport/hotel/leg).
    if (blocked) { var rk = { missing_transport: 'blkTransport', missing_stay: 'blkStay', missing_prior_leg: 'blkPrior', missing_dependency: 'blkDep' }[b._dep.reason] || 'blkDep'; c.appendChild(el('div', 'tc-bk__blocked', '⚠ ' + t(rk))); }
    var head = el('div', 'tc-bk__head');
    // Large mobile-friendly completion checkbox (left). Check → 'completed' + completedAt/By;
    // uncheck → restore prior status. Persisted to Firestore via saveTrip; trip members see it.
    if (!ro) {
      var cb = el('label', 'tc-bk__check' + (done ? ' tc-bk__check--on' : ''));
      var cbi = doc.createElement('input'); cbi.type = 'checkbox'; cbi.checked = done; cbi.className = 'tc-bk__checkbox';
      cbi.setAttribute('aria-label', t('markDone') + ': ' + (b.title || ''));
      cbi.addEventListener('change', function () {
        root.TCTasks.setDone(b, cbi.checked, { by: getMe() || '', byName: (getMe() ? famName(getMe()) : ''), nowIso: new Date().toISOString() });
        saveTrip(tr); if (cbi.checked) tcNotifyTask('completed', b.title); render();
      });
      cb.appendChild(cbi);
      cb.appendChild(el('span', 'tc-bk__checkmark', '✓'));
      head.appendChild(cb);
    }
    head.appendChild(el('span', 'tc-bk__type', bookingTypeIcon(b.type) + ' ' + t('bt_' + b.type)));
    head.appendChild(el('span', 'tc-bk__stat ' + bookingStatusClass(b.bookingStatus), t('bs_' + (b.bookingStatus || 'research_needed'))));
    var _pr = b.priority || (root.TCTasks ? root.TCTasks.priority(b.type) : 'P2');
    head.appendChild(el('span', 'tc-bk__pri tc-bk__pri--' + _pr, t('pri_' + _pr)));
    c.appendChild(head);
    c.appendChild(el('strong', 'tc-bk__title', b.title));
    if (done && b.completedAt) c.appendChild(el('p', 'tc-bk__donemeta', '✓ ' + t('taskCompletedBy') + (b.completedByName ? (' ' + b.completedByName) : '') + ' · ' + String(b.completedAt).slice(0, 10)));
    if (b.provider) c.appendChild(el('p', 'tc-bk__meta', t('providerLabel') + ': ' + b.provider));
    if (b.priceRange) c.appendChild(el('p', 'tc-bk__meta', '💵 ' + b.priceRange));
    if (b.recommendedOption) { var rec = el('p', 'tc-bk__rec'); rec.appendChild(el('span', 'tc-bk__rec-k', t('recommended') + ': ')); rec.appendChild(doc.createTextNode(b.recommendedOption)); c.appendChild(rec); }
    if (b.deadline) c.appendChild(el('p', 'tc-bk__meta', '⏰ ' + t('deadlineLabel') + ': ' + b.deadline));
    if (b.cancellationPolicy) c.appendChild(el('p', 'tc-bk__meta', b.cancellationPolicy));
    var acts = el('div', 'tc-bk__acts');
    if (isDlcRideTask(b)) {
      // DuLichCali/Michael ride = book INSIDE the app via the embedded ride flow, never a Google link.
      rideTaskActions(b, acts);
    } else {
      if (links.officialUrl) acts.appendChild(linkBtn('🔗 ' + t('openOfficial'), links.officialUrl, 'tc-pbtn--accent'));
      acts.appendChild(linkBtn('🔎 ' + t('openOfficial'), links.searchUrl, links.officialUrl ? '' : 'tc-pbtn--accent'));
    }
    c.appendChild(acts);
    if (!ro) {
      var ctrls = el('div', 'tc-bk__ctrls');
      // 'completed' is included so a checkbox-completed task shows the right value here (not blank),
      // and the dropdown stays consistent with the checkbox: → completed stamps completedAt/By;
      // leaving completed clears them (routes through TCTasks.setDone so both controls agree).
      var ssel = selectFrom(['research_needed', 'researching', 'ready_to_book', 'user_approval_needed', 'booked', 'paid', 'completed', 'skipped', 'not_needed'], b.bookingStatus || 'research_needed', function (o) { return t('bs_' + o); });
      ssel.className = 'tc-input'; ssel.addEventListener('change', function () {
        var v = ssel.value;
        if (v === 'completed') { root.TCTasks.setDone(b, true, { by: getMe() || '', byName: (getMe() ? famName(getMe()) : ''), nowIso: new Date().toISOString() }); }
        else { if (b.bookingStatus === 'completed') { root.TCTasks.setDone(b, false, {}); } b.bookingStatus = v; }
        saveTrip(tr); if (v === 'booked' || v === 'paid' || v === 'completed') tcNotifyTask(v, b.title); render();
      });
      ctrls.appendChild(ssel);
      var _fam = selectFrom([''].concat(tripFamilies().map(function (f) { return f.id; })), b.assignedToFamily || '', function (id) { if (!id) return t('taskUnassigned'); var ff = tripFamilies().filter(function (x) { return x.id === id; })[0]; return ff ? (ff.name || t('taskUnassigned')) : id; });
      _fam.className = 'tc-input'; _fam.addEventListener('change', function () {
        b.assignedToFamily = _fam.value;
        // A member assignment only makes sense within the chosen family — drop it on a family change.
        if (b.assignedToMember && !famMembers(_fam.value).some(function (m) { return m.id === b.assignedToMember; })) b.assignedToMember = '';
        saveTrip(tr); if (_fam.value) tcNotifyTask('assigned', b.title, famName(_fam.value)); render();
      });
      ctrls.appendChild(_fam);
      // Per-MEMBER assignment within the chosen family (only when that family has a named roster).
      var _famMems = b.assignedToFamily ? famMembers(b.assignedToFamily) : [];
      if (_famMems.length) {
        var _mem = selectFrom([''].concat(_famMems.map(function (m) { return m.id; })), b.assignedToMember || '', function (id) { if (!id) return t('taskWholeFamily'); var mm = _famMems.filter(function (x) { return x.id === id; })[0]; return mm ? mm.name : id; });
        _mem.className = 'tc-input'; _mem.addEventListener('change', function () { b.assignedToMember = _mem.value; saveTrip(tr); if (_mem.value) tcNotifyTask('assigned', b.title, memberName(_mem.value)); render(); });
        ctrls.appendChild(_mem);
      }
      var mb = el('button', 'tc-pbtn' + (b.bookingStatus === 'booked' ? ' tc-pbtn--accent' : ''), b.bookingStatus === 'booked' ? t('undoBooked') : t('iBookedThis')); mb.type = 'button';
      // Not-booked → open the assisted-checkout modal (deep-link + confirmation/price capture).
      // Undo path unchanged. This is the whole assisted-checkout feature: never silent-confirm.
      mb.addEventListener('click', function () {
        if (b.bookingStatus === 'booked') { b.bookingStatus = 'ready_to_book'; saveTrip(tr); render(); return; }
        openConfirmBookingModal(b, idx);
      });
      ctrls.appendChild(mb);
      var del = el('button', 'tc-pbtn', '🗑'); del.type = 'button'; del.addEventListener('click', function () { tr.bookings.splice(idx, 1); saveTrip(tr); render(); });
      ctrls.appendChild(del);
      c.appendChild(ctrls);
      if (b.bookingStatus === 'booked') {
        var cn = input(b.confirmationNumber, t('confirmationNumber')); cn.addEventListener('input', function () { b.confirmationNumber = cn.value; }); cn.addEventListener('change', function () { saveTrip(tr); });
        c.appendChild(field(t('confirmationNumber'), cn));
        if (b.bookedAt && b.bookingSource === 'self_booked') c.appendChild(el('p', 'tc-bk__donemeta', '✓ ' + t('selfBookedBy') + (b.bookedBy ? (' ' + b.bookedBy) : '') + ' · ' + String(b.bookedAt).slice(0, 10)));
      }
      var _due = input(b.dueDate || b.deadline || '', t('taskDue'), 'date'); _due.addEventListener('change', function () { b.dueDate = _due.value; b.deadline = _due.value; saveTrip(tr); });
      c.appendChild(field(t('taskDue'), _due));
      var _cost = input(b.costEstimate || '', t('taskCost')); _cost.addEventListener('input', function () { b.costEstimate = _cost.value; }); _cost.addEventListener('change', function () { saveTrip(tr); });
      c.appendChild(field(t('taskCost'), _cost));
      var _act = input(b.actualCost || '', t('taskActual')); _act.addEventListener('input', function () { b.actualCost = _act.value; }); _act.addEventListener('change', function () { saveTrip(tr); render(); });
      c.appendChild(field(t('taskActual'), _act));
      var _paid = selectFrom([''].concat(tripFamilies().map(function (f) { return f.id; })), b.paidBy || '', function (id) { if (!id) return t('taskPaidByNone'); var ff = tripFamilies().filter(function (x) { return x.id === id; })[0]; return ff ? (ff.name || id) : id; });
      _paid.className = 'tc-input'; _paid.addEventListener('change', function () { b.paidBy = _paid.value; saveTrip(tr); render(); });
      c.appendChild(field(t('taskPaidBy'), _paid));
      var nt = input(b.notes, t('bookingNotes')); nt.addEventListener('input', function () { b.notes = nt.value; }); nt.addEventListener('change', function () { saveTrip(tr); });
      c.appendChild(field(t('bookingNotes'), nt));
    }
    // Families vote on each booking CHOICE (hotel/activity/restaurant/transport) — same
    // consensus + favorites engine; keyed by the booking title (its place name).
    if (!ro && b.title) c.appendChild(voteRow({ name: b.title }));
    c.appendChild(el('p', 'tc-unverified', t('unverified')));
    return c;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ALBUM (V2) — group trip photo/video album by shared link/URL (privacy-first):
  //  per-item visibility group/private/selected_only, favorite, tag, owner/author
  //  moderation. Private items are hidden from other members (rules + visibleMedia).
  // ════════════════════════════════════════════════════════════════════════
  function isImageUrl(u) { return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(String(u || '')); }
  function dayOptionsForAlbum() { var ds = ((state.trip.plan && state.trip.plan.days) || []); var out = [['', t('albumNoDay')]]; ds.forEach(function (d, i) { out.push([String(i + 1), t('day') + ' ' + (i + 1) + (d.title ? (' · ' + d.title) : '')]); }); return out; }
  function addMediaPanel(plan) {
    var box = el('details', 'tc-album__add');
    if (state._addMediaOpen) box.open = true;
    box.addEventListener('toggle', function () { state._addMediaOpen = !!box.open; });
    box.appendChild(el('summary', 'tc-album__addsum', '＋ ' + t('albumAdd')));
    var body = el('div', 'tc-album__addbody');
    body.appendChild(el('p', 'tc-hint', t('albumAddHint')));
    var url = input('', t('albumUrlPh')); body.appendChild(field(t('albumUrl'), url));
    var cap = input('', t('albumCaptionPh')); body.appendChild(field(t('albumCaption'), cap));
    var place = input('', t('albumPlacePh')); body.appendChild(field(t('albumPlace'), place));
    var daySel = selectFrom(dayOptionsForAlbum().map(function (o) { return o[0]; }), '', function (v) { var f = dayOptionsForAlbum().filter(function (o) { return o[0] === v; })[0]; return f ? f[1] : v; }); daySel.className = 'tc-input'; body.appendChild(field(t('day'), daySel));
    var visSel = selectFrom(['group', 'private', 'selected_only'], 'group', function (o) { return t('vis_' + o); }); visSel.className = 'tc-input'; body.appendChild(field(t('albumVisibility'), visSel));
    var add = el('button', 'tc-cta', t('albumAddBtn')); add.type = 'button';
    add.addEventListener('click', function () {
      if (state.readonly) { toast(t('sampleReadonly')); return; }
      var u = (url.value || '').trim(); if (!u && !(cap.value || '').trim()) { toast(t('albumUrlPh')); return; }
      addMedia({ url: u, mediaType: u && !isImageUrl(u) ? 'link' : 'photo', caption: (cap.value || '').trim(), place: (place.value || '').trim(), day: daySel.value || '', visibility: visSel.value || 'group', tags: [] });
      url.value = ''; cap.value = ''; place.value = ''; toast(t('albumAdded'));
    });
    body.appendChild(add);
    box.appendChild(body);
    return box;
  }
  function albumCard(m) {
    var c = el('article', 'tc-media');
    if (m.url && isImageUrl(m.url)) { var im = el('img', 'tc-media__img'); im.setAttribute('src', m.url); im.setAttribute('alt', m.caption || 'trip photo'); im.setAttribute('loading', 'lazy'); c.appendChild(im); }
    else { c.appendChild(el('div', 'tc-media__ph', (m.mediaType === 'video' ? '🎞' : '🔗') + ' ' + (m.caption || t('albumLink')))); }
    var body = el('div', 'tc-media__body');
    if (m.caption) body.appendChild(el('p', 'tc-media__cap', m.caption));
    var meta = el('div', 'tc-media__meta');
    meta.appendChild(el('span', 'tc-media__vis tc-media__vis--' + (m.visibility || 'group'), t('vis_' + (m.visibility || 'group'))));
    if (m.day) meta.appendChild(chip('', t('day') + ' ' + m.day));
    if (m.place) meta.appendChild(chip('', '📍 ' + m.place));
    body.appendChild(meta);
    var acts = el('div', 'tc-media__acts');
    if (m.url) acts.appendChild(linkBtn('🔗 ' + t('albumOpen'), m.url));
    var canEdit = !state.readonly && (isOwnerOfTrip() || (m.uploadedBy && m.uploadedBy === curUid()));
    if (canEdit) {
      acts.appendChild(pbtn((m.favorite ? '❤️' : '🤍') + ' ' + t('albumFav'), 'tc-pbtn--ghost' + (m.favorite ? ' tc-pbtn--on' : ''), function () { updateMedia(m, { favorite: !m.favorite }); }));
      acts.appendChild(pbtn((m.selected ? '✓ ' : '') + t('albumSelect'), 'tc-pbtn--ghost' + (m.selected ? ' tc-pbtn--on' : ''), function () { updateMedia(m, { selected: !m.selected }); }));
      var visToggle = selectFrom(['group', 'private', 'selected_only'], (m.visibility || 'group'), function (o) { return t('vis_' + o); }); visToggle.className = 'tc-input tc-media__vissel'; visToggle.addEventListener('change', function () { updateMedia(m, { visibility: visToggle.value }); });
      acts.appendChild(visToggle);
      acts.appendChild(pbtn('🗑', 'tc-pbtn--danger', function () { deleteMedia(m); }));
    }
    body.appendChild(acts);
    c.appendChild(body);
    return c;
  }
  function renderAlbum(plan) {
    var tr = state.trip, wrap = el('div', 'tc-album');
    wrap.appendChild(el('strong', 'tc-album__t', '📸 ' + t('albumTitle')));
    wrap.appendChild(el('p', 'tc-album__sub', t('albumSub')));
    if (tr._demo) { wrap.appendChild(el('p', 'tc-empty', t('albumDemo'))); return wrap; }
    if (!realUser()) { wrap.appendChild(el('p', 'tc-empty', t('liveLoginNeeded'))); return wrap; }
    if (state._mediaLoadedFor !== tr.id) { state._mediaLoadedFor = tr.id; loadMedia().then(function () { if (state.screen === 'plan' && (state.activeTab === 'album' || state.activeTab === 'clips')) render(); }); }
    if (!state.readonly) wrap.appendChild(addMediaPanel(plan));
    var list = visibleMedia();
    if (!list.length) { wrap.appendChild(el('p', 'tc-empty', t('albumEmpty'))); return wrap; }
    var grid = el('div', 'tc-media__grid');
    list.slice().sort(function (a, b) { return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0); }).forEach(function (m) { grid.appendChild(albumCard(m)); });
    wrap.appendChild(grid);
    wrap.appendChild(el('p', 'tc-unverified', t('albumPrivacyNote')));
    return wrap;
  }
  // ── AI Clips (V2) — export PACKAGE only (no render, no auto-post), consent-gated ──
  function clipExportPanel(pkg) {
    var box = el('div', 'tc-clip');
    if (pkg.summary) box.appendChild(el('p', 'tc-clip__summary', '🎬 ' + pkg.summary));
    function section(title, body) { var s = el('div', 'tc-clip__sec'); s.appendChild(el('strong', 'tc-clip__sech', title)); s.appendChild(body); box.appendChild(s); }
    if (pkg.storyboard && pkg.storyboard.length) { var ol = el('ol', 'tc-clip__board'); pkg.storyboard.forEach(function (sc) { ol.appendChild(el('li', null, (sc.scene ? (sc.scene + ': ') : '') + (sc.text || sc) + (sc.media ? (' — ' + sc.media) : ''))); }); section('🎞 ' + t('clipStoryboard'), ol); }
    if (pkg.voiceoverScript) section('🎙 ' + t('clipVoiceover'), el('p', 'tc-clip__txt', pkg.voiceoverScript));
    if (pkg.textOverlays && pkg.textOverlays.length) { var ul = el('ul', 'tc-clip__list'); pkg.textOverlays.forEach(function (x) { ul.appendChild(el('li', null, x)); }); section('🔤 ' + t('clipOverlays'), ul); }
    if (pkg.hashtags && pkg.hashtags.length) section('#️⃣ ' + t('clipHashtags'), el('p', 'tc-clip__tags', pkg.hashtags.map(function (h) { return (/^#/.test(h) ? h : '#' + h); }).join(' ')));
    if (pkg.posts && typeof pkg.posts === 'object') { Object.keys(pkg.posts).forEach(function (k) { if (pkg.posts[k]) section('📝 ' + (t('clipPost_' + k) || k), el('p', 'tc-clip__txt', pkg.posts[k])); }); }
    box.appendChild(el('p', 'tc-unverified', t('clipExportNote')));
    return box;
  }
  function renderClips(plan) {
    var tr = state.trip, wrap = el('div', 'tc-clips');
    wrap.appendChild(el('strong', 'tc-clips__t', '🎬 ' + t('clipsTitle')));
    wrap.appendChild(el('p', 'tc-clips__sub', t('clipsSub')));
    if (tr._demo) { wrap.appendChild(el('p', 'tc-empty', t('albumDemo'))); return wrap; }
    if (!realUser()) { wrap.appendChild(el('p', 'tc-empty', t('liveLoginNeeded'))); return wrap; }
    if (state._mediaLoadedFor !== tr.id) { state._mediaLoadedFor = tr.id; loadMedia().then(function () { if (state.screen === 'plan' && state.activeTab === 'clips') render(); }); }
    var sel = visibleMedia().filter(function (m) { return m.selected; });
    wrap.appendChild(el('p', 'tc-hint', t('clipsSelectHint').replace('{n}', String(sel.length))));
    // platform / mood / length
    var opts = el('div', 'tc-clips__opts');
    function picker(label, val, list, key) { var s = selectFrom(list, val, function (o) { return t(key + o) || o; }); s.className = 'tc-input'; s.addEventListener('change', function () { state['_clip' + label] = s.value; }); return field(t('clip' + label), s); }
    var pl = selectFrom(['tiktok', 'instagram', 'youtube', 'facebook'], state._clipPlatform, function (o) { return t('clipPost_' + o) || o; }); pl.className = 'tc-input'; pl.addEventListener('change', function () { state._clipPlatform = pl.value; }); opts.appendChild(field(t('clipPlatform'), pl));
    var md = selectFrom(['fun', 'cinematic', 'heartfelt', 'energetic'], state._clipMood, function (o) { return t('clipmood_' + o) || o; }); md.className = 'tc-input'; md.addEventListener('change', function () { state._clipMood = md.value; }); opts.appendChild(field(t('clipMood'), md));
    var ln = selectFrom(['short', 'medium', 'long'], state._clipLen, function (o) { return t('cliplen_' + o) || o; }); ln.className = 'tc-input'; ln.addEventListener('change', function () { state._clipLen = ln.value; }); opts.appendChild(field(t('clipLength'), ln));
    wrap.appendChild(opts);
    // consent (privacy)
    var consentRow = el('label', 'tc-clip__consent');
    var cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = !!state._clipConsent; cb.addEventListener('change', function () { state._clipConsent = cb.checked; render(); });
    consentRow.appendChild(cb); consentRow.appendChild(el('span', null, t('clipConsent')));
    wrap.appendChild(consentRow);
    var gen = el('button', 'tc-cta', '🎬 ' + t('clipGenerate')); gen.type = 'button';
    if (!sel.length || !state._clipConsent) gen.disabled = true;
    gen.addEventListener('click', function () {
      if (!sel.length) { toast(t('clipsNeedSelect')); return; }
      if (!state._clipConsent) { toast(t('clipNeedConsent')); return; }
      state._clip = { loading: true }; render();
      generateClipPackage(tr, sel, { platform: state._clipPlatform, mood: state._clipMood, length: state._clipLen }).then(function (res) {
        state._clip = (res && res.ok) ? res : { error: true }; render();
      });
    });
    wrap.appendChild(gen);
    if (state._clip && state._clip.loading) wrap.appendChild(researchBanner('clipWorking'));
    else if (state._clip && state._clip.ok) wrap.appendChild(clipExportPanel(state._clip));
    else if (state._clip && state._clip.error) wrap.appendChild(el('p', 'tc-empty', t('clipFail')));
    return wrap;
  }
  // ── Group tab: share + notes ───────────────────────────────────────────
  // Who's travelling — family info / accessibility / special needs (the Group tab is now the
  // single home for "who is on this trip", replacing the removed Family Arrival Plan).
  function groupTravelersBlock() {
    var fams = ((state.trip && state.trip.families) || []).filter(function (f) { return f && (f.name || f.adults || f.seniors || (f.childrenAges || '').trim()); });
    if (!fams.length) return null;
    var box = el('div', 'tc-travelers');
    box.appendChild(el('strong', 'tc-travelers__t', '👨‍👩‍👧 ' + t('groupTravelersTitle')));
    fams.forEach(function (f) {
      var c = el('div', 'tc-traveler');
      if (f.name) c.appendChild(el('strong', 'tc-traveler__name', f.name));
      var bits = [];
      if (f.adults) bits.push(f.adults + ' ' + t('travelersAdults'));
      if (f.seniors) bits.push(f.seniors + ' ' + t('seniors').toLowerCase());
      var ages = String(f.childrenAges || '').trim();
      var kidsCount = ages.split(/[,\s]+/).filter(function (x) { return /\d/.test(x); }).length;
      if (kidsCount) bits.push(kidsCount + ' ' + t('childrenLabel').toLowerCase() + (ages ? ' (' + ages + ')' : ''));
      if (bits.length) c.appendChild(el('p', 'tc-traveler__meta', bits.join(' · ')));
      var needs = [];
      (Array.isArray(f.seniorNeeds) ? f.seniorNeeds : []).forEach(function (n) { if (n) needs.push(n); });
      if (f.accessibility) needs.push(f.accessibility);
      if (f.specialRequests) needs.push(f.specialRequests);
      if (needs.length) c.appendChild(el('p', 'tc-traveler__needs', '♿ ' + needs.join(' · ')));
      // V6 member roster — named people in this family (for task assignment + per-member cost).
      if (Array.isArray(f.members) && f.members.length) {
        var mr = el('div', 'tc-mroster');
        f.members.forEach(function (m) {
          var chip = el('span', 'tc-mchip'); chip.appendChild(el('span', 'tc-mchip__n', '👤 ' + m.name));
          if (canEditPlan()) { var x = el('button', 'tc-mchip__x', '✕'); x.type = 'button'; x.addEventListener('click', function () { f.members = (f.members || []).filter(function (z) { return z.id !== m.id; }); saveTrip(state.trip); render(); }); chip.appendChild(x); }
          mr.appendChild(chip);
        });
        c.appendChild(mr);
      }
      if (canEditPlan()) {
        var addRow = el('div', 'tc-mroster__add');
        var mi = input('', t('memberNamePh')); mi.className = 'tc-input tc-mroster__in';
        var ma = el('button', 'tc-pbtn', '＋ ' + t('addMember')); ma.type = 'button';
        ma.addEventListener('click', function () { var v = (mi.value || '').trim(); if (!v) return; f.members = Array.isArray(f.members) ? f.members : []; f.members.push({ id: uid('mem'), name: v }); mi.value = ''; saveTrip(state.trip); render(); });
        addRow.appendChild(mi); addRow.appendChild(ma); c.appendChild(addRow);
      }
      box.appendChild(c);
    });
    if (canEditPlan()) box.appendChild(pbtn('✏ ' + t('travelersEdit'), '', function () { state.screen = 'create'; render(); }));
    return box;
  }
  function renderGroup(plan) {
    var wrap = el('div', 'tc-group');
    // Who is travelling (family info, accessibility, special needs) — top of the Group hub.
    var tb = groupTravelersBlock(); if (tb) wrap.appendChild(tb);
    // Owner: passcode-gated Share Trip. (Members see the member list only.)
    if (!state.trip._demo && isOwnerOfTrip()) {
      var sh = el('div', 'tc-share');
      sh.appendChild(el('strong', 'tc-share__t', t('shareTitle')));
      sh.appendChild(el('p', 'tc-share__s', t('sharePermInfo')));
      var sb = el('button', 'tc-cta', '🔗 ' + t('shareTrip')); sb.type = 'button'; sb.addEventListener('click', function () { openShareModal(); });
      sh.appendChild(sb);
      wrap.appendChild(sh);
    }
    // Member list (lazy-loaded; readable only by members per rules).
    if (!state.trip._demo && realUser()) {
      if (state._members == null) { loadMembers().then(function () { if (state.screen === 'plan' && state.activeTab === 'group') render(); }); }
      else if (state._members.length) wrap.appendChild(renderMemberList());
    }
    // Assumptions / warnings
    if (plan.assumptions && plan.assumptions.length) wrap.appendChild(listBlock(t('assumptions'), plan.assumptions));
    if (plan.warnings && plan.warnings.length) wrap.appendChild(listBlock('⚠ ' + t('warnings'), plan.warnings));
    // Group suggestions (add + vote)
    wrap.appendChild(suggestionsBlock());
    // Notes
    var nb = el('div', 'tc-notes');
    nb.appendChild(el('strong', 'tc-notes__t', t('notes')));
    (state.trip.notes || []).forEach(function (n) { nb.appendChild(el('p', 'tc-notes__item', '• ' + n.text)); });
    var nrow = el('div', 'tc-notes__row');
    var ni = input('', t('addNote')); nrow.appendChild(ni);
    var ns = el('button', 'tc-cta', t('send')); ns.type = 'button';
    ns.addEventListener('click', function () { if (state.readonly) { toast(t('sampleReadonly')); return; } if (!ni.value.trim()) return; state.trip.notes.push({ text: ni.value.trim(), ts: Date.now() }); saveTrip(state.trip); render(); });
    nrow.appendChild(ns); nb.appendChild(nrow);
    wrap.appendChild(nb);
    // Live group coordination (folded in from the removed standalone Live tab).
    var lv = renderLiveLocation(plan); if (lv) wrap.appendChild(lv);
    // New trip
    var nt = el('button', 'tc-addbtn', t('newTrip')); nt.type = 'button'; nt.addEventListener('click', function () { newTrip(); state.screen = 'create'; pushTripUrl(null); render(); });
    wrap.appendChild(nt);
    return wrap;
  }
  function listBlock(title, items) { var b = el('div', 'tc-listblock'); b.appendChild(el('strong', 'tc-listblock__t', title)); var ul = el('ul', 'tc-listblock__ul'); items.forEach(function (it) { ul.appendChild(el('li', null, it)); }); b.appendChild(ul); return b; }

  // ── Utilities ──────────────────────────────────────────────────────────
  function shareUrl(id) { try { return root.location.origin + '/travel-concierge?trip=' + id; } catch (e) { return '/travel-concierge?trip=' + id; } }
  function pushTripUrl(id) { try { var u = id ? ('/travel-concierge?trip=' + id) : '/travel-concierge'; root.history.replaceState({}, '', u); } catch (e) {} }
  function copyText(txt) { try { if (root.navigator && root.navigator.clipboard) { root.navigator.clipboard.writeText(txt).catch(function () {}); return; } } catch (e) {} try { var ta = doc.createElement('textarea'); ta.value = txt; doc.body.appendChild(ta); ta.select(); doc.execCommand('copy'); doc.body.removeChild(ta); } catch (e) {} }
  function toast(msg) { try { var x = el('div', 'tc-toast', msg); doc.body.appendChild(x); root.setTimeout(function () { x.classList.add('tc-toast--on'); }, 10); root.setTimeout(function () { x.classList.remove('tc-toast--on'); root.setTimeout(function () { if (x.parentNode) x.parentNode.removeChild(x); }, 300); }, 1700); } catch (e) {} }

  // ── i18n chip labels (registered dynamically for all 3 langs) ───────────
  ['en', 'vi', 'es'].forEach(function (lng) {
    var groups = {
      int_: {
        en: { beach: 'Beach', aquarium: 'Aquarium', zoo: 'Zoo', theme_park: 'Theme park', museums: 'Museums', nature: 'Nature', casino: 'Casino', shopping: 'Shopping', food: 'Food', nightlife: 'Nightlife', photography: 'Photography', hiking: 'Hiking', shows: 'Shows', sports: 'Sports', fishing: 'Fishing', cruises: 'Cruises', scenic_drives: 'Scenic drives', hidden_gems: 'Hidden gems', scenic: 'Scenic', family_friendly: 'Family-friendly' },
        vi: { beach: 'Biển', aquarium: 'Thủy cung', zoo: 'Sở thú', theme_park: 'Công viên giải trí', museums: 'Bảo tàng', nature: 'Thiên nhiên', casino: 'Casino', shopping: 'Mua sắm', food: 'Ẩm thực', nightlife: 'Về đêm', photography: 'Chụp ảnh', hiking: 'Đi bộ đường dài', shows: 'Biểu diễn', sports: 'Thể thao', fishing: 'Câu cá', cruises: 'Du thuyền', scenic_drives: 'Lái xe ngắm cảnh', hidden_gems: 'Điểm độc đáo', scenic: 'Cảnh đẹp', family_friendly: 'Hợp gia đình' },
        es: { beach: 'Playa', aquarium: 'Acuario', zoo: 'Zoológico', theme_park: 'Parque temático', museums: 'Museos', nature: 'Naturaleza', casino: 'Casino', shopping: 'Compras', food: 'Comida', nightlife: 'Vida nocturna', photography: 'Fotografía', hiking: 'Senderismo', shows: 'Espectáculos', sports: 'Deportes', fishing: 'Pesca', cruises: 'Cruceros', scenic_drives: 'Rutas escénicas', hidden_gems: 'Joyas ocultas', scenic: 'Paisajes', family_friendly: 'Familiar' },
      },
      food_: {
        en: { vietnamese: 'Vietnamese', japanese: 'Japanese', korean: 'Korean', seafood: 'Seafood', steakhouse: 'Steakhouse', mexican: 'Mexican', vegetarian: 'Vegetarian', fine_dining: 'Fine dining' },
        vi: { vietnamese: 'Việt Nam', japanese: 'Nhật Bản', korean: 'Hàn Quốc', seafood: 'Hải sản', steakhouse: 'Bít tết', mexican: 'Mexico', vegetarian: 'Chay', fine_dining: 'Ẩm thực cao cấp' },
        es: { vietnamese: 'Vietnamita', japanese: 'Japonesa', korean: 'Coreana', seafood: 'Mariscos', steakhouse: 'Asador', mexican: 'Mexicana', vegetarian: 'Vegetariana', fine_dining: 'Alta cocina' },
      },
      kid_: {
        en: { arcades: 'Arcades', water_parks: 'Water parks', roller_coasters: 'Roller coasters', animal_encounters: 'Animal encounters' },
        vi: { arcades: 'Khu trò chơi', water_parks: 'Công viên nước', roller_coasters: 'Tàu lượn', animal_encounters: 'Gặp gỡ động vật' },
        es: { arcades: 'Salas de juegos', water_parks: 'Parques acuáticos', roller_coasters: 'Montañas rusas', animal_encounters: 'Encuentros con animales' },
      },
      teen_: {
        en: { escape_rooms: 'Escape rooms', vr: 'VR', anime: 'Anime', teen_shopping: 'Shopping' },
        vi: { escape_rooms: 'Phòng thoát hiểm', vr: 'Thực tế ảo (VR)', anime: 'Anime', teen_shopping: 'Mua sắm' },
        es: { escape_rooms: 'Salas de escape', vr: 'Realidad virtual', anime: 'Anime', teen_shopping: 'Compras' },
      },
      senior_: {
        en: { limited_walking: 'Limited walking', wheelchair_accessible: 'Wheelchair accessible', frequent_breaks: 'Frequent breaks' },
        vi: { limited_walking: 'Hạn chế đi bộ', wheelchair_accessible: 'Lối đi xe lăn', frequent_breaks: 'Nghỉ thường xuyên' },
        es: { limited_walking: 'Caminata limitada', wheelchair_accessible: 'Accesible en silla de ruedas', frequent_breaks: 'Descansos frecuentes' },
      },
      hotel_: {
        en: { resort: 'Resort', airbnb: 'Airbnb', suites: 'Suites', kitchen: 'Kitchen', pool: 'Pool', free_breakfast: 'Free breakfast', ocean_view: 'Ocean view' },
        vi: { resort: 'Khu nghỉ dưỡng', airbnb: 'Airbnb', suites: 'Phòng suite', kitchen: 'Bếp', pool: 'Hồ bơi', free_breakfast: 'Bữa sáng miễn phí', ocean_view: 'Hướng biển' },
        es: { resort: 'Resort', airbnb: 'Airbnb', suites: 'Suites', kitchen: 'Cocina', pool: 'Piscina', free_breakfast: 'Desayuno gratis', ocean_view: 'Vista al mar' },
      },
    };
    Object.keys(groups).forEach(function (prefix) {
      var m = groups[prefix][lng] || groups[prefix].en;
      Object.keys(m).forEach(function (k) { T[lng][prefix + k] = m[k]; });
    });
  });

  // ── Lang switch + init ─────────────────────────────────────────────────
  function detectLang() { try { var p = new URLSearchParams(root.location.search).get('lang'); if (T[p]) return p; var sv = root.localStorage.getItem('dlc_lang'); if (T[sv]) return sv; var nv = (root.navigator.language || '').slice(0, 2); if (T[nv]) return nv; } catch (e) {} return 'vi'; }
  function setLang(l) { if (!T[l]) return; state.lang = l; try { root.localStorage.setItem('dlc_lang', l); } catch (e) {} doc.documentElement.setAttribute('lang', l); syncLangBtns(); render(); }
  function syncLangBtns() { doc.querySelectorAll('#tcLang .tc-lang__btn').forEach(function (b) { b.classList.toggle('tc-lang__btn--on', b.getAttribute('data-lang') === state.lang); }); }

  // Auth-state listener drives the login-gated flows: it completes a pending
  // shared-trip load and any queued post-login action, and keeps the account
  // chip / save path in sync. Fires on initial restore and every sign-in/out.
  function onAuth(u) {
    var prevUid = state.user && state.user.uid;
    state.user = (u && !u.isAnonymous) ? u : null;
    if ((state.user && state.user.uid) !== prevUid) { state._myTrips = null; state._memory = null; state._memoryUid = null; } // reload "Your trips" + memory on account change
    if (state.user) {
      loadTravelMemory().then(function () { if (state.screen === 'dashboard' || state.screen === 'create') render(); }); // warm cross-trip memory cache
      if (state._pendingTripId) { var id = state._pendingTripId; state._pendingTripId = null; loadSharedTrip(id); return; }
      if (state._afterLogin) { var fn = state._afterLogin; state._afterLogin = null; fn(); return; }
    }
    render();
  }
  // From a /trip/<token> link: if the logged-in user is already a member (or the
  // owner) of the resolved trip, skip the passcode and open it directly.
  function maybeResumeMember(tripId) {
    var u = realUser();
    if (!u || !root.dlcDb) { render(); return; }
    root.dlcDb.collection('tripMembers').doc(tripId).collection('members').doc(u.uid).get()
      .then(function (s) {
        if (s && s.exists) { state._shareToken = null; loadSharedTrip(tripId); return; }
        root.dlcDb.collection('groupTrips').doc(tripId).get()
          .then(function (ts) { if (ts && ts.exists && ts.data().ownerUid === u.uid) { state._shareToken = null; loadSharedTrip(tripId); } else { render(); } })
          .catch(function () { render(); });
      })
      .catch(function () { render(); });
  }
  function loadSharedTrip(id) {
    loadTrip(id).then(function (tr) {
      if (tr && tr.deleted === true) { toast(t('tripDeleted')); goDashboard(); return; }
      if (tr && tr.plan) { state.trip = tr; normalizeDestinations(state.trip); try { migrateLegacyTripToSegments(state.trip); } catch (e) {} state.trip._demo = false; state.readonly = false; state.screen = 'plan'; state.activeTab = 'overview'; try { reconcileRideResult(state.trip); } catch (e) {} resolveMyRole().then(function (role) { if (role && role !== 'owner') rememberJoinedTrip(id); else { try { learnFromTrip(state.trip); } catch (e) {} } render(); }); }
      else { newTrip(); state.screen = 'hero'; render(); }
    });
  }
  function init() {
    state.lang = detectLang(); doc.documentElement.setAttribute('lang', state.lang);
    doc.querySelectorAll('#tcLang .tc-lang__btn').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });
    syncLangBtns();
    try { tcRegisterSW(); } catch (e) {} // register the Web Push service worker (deal alerts)
    var tripId = null; try { tripId = new URLSearchParams(root.location.search).get('trip'); } catch (e) {}
    var shareToken = null; try { var mm = (root.location.pathname || '').match(/\/travel-concierge\/trip\/([^\/?#]+)/); if (mm) shareToken = decodeURIComponent(mm[1]); } catch (e) {}
    var wantDash = false; try { wantDash = /\/travel-concierge\/my-trips\/?$/.test(root.location.pathname || ''); } catch (e) {}
    // Enable LOCAL persistence (so sessions restore) then listen for auth changes.
    setPersistence().then(function () { try { auth().onAuthStateChanged(onAuth); } catch (e) {} }).catch(function () { try { auth().onAuthStateChanged(onAuth); } catch (e) {} });
    if (shareToken) {
      // Invitee opened a /travel-concierge/trip/<token> link → passcode-gated JOIN flow.
      // If they're already the owner or a joined member, skip the passcode entirely.
      state._shareToken = shareToken;
      newTrip(); state.screen = 'sharejoin'; render();
      TripShare.preview(shareToken).then(function (p) {
        state._sharePreview = p || { ok: false };
        if (p && p.ok && p.tripId && realUser()) {
          maybeResumeMember(p.tripId);
        } else if (state.screen === 'sharejoin') { render(); }
      });
    } else if (tripId) {
      // Shared-link recipient: login is required to view (rules require auth and the
      // user said "log in to see the trip"). Gate first; the listener loads it after.
      if (realUser()) { loadSharedTrip(tripId); }
      else { state._pendingTripId = tripId; newTrip(); state.trip._demo = false; state.screen = 'plan'; render(); }
    } else if (wantDash) {
      newTrip(); state.screen = 'dashboard'; render();
    } else {
      newTrip(); state.screen = 'hero'; render();
    }
  }

  root.TravelConcierge = { init: init, setLang: setLang, _state: state, _strings: T, _mockPlan: mockPlan, _generatePlan: generatePlan, _generatePlanSmart: generatePlanSmart, _tripLegCount: tripLegCount, _normalizeDestinations: normalizeDestinations, _newTrip: newTrip, _research: researchHighlights, _TCAuth: TCAuth, _realUser: realUser, _MapLinkProvider: MapLinkProvider, _TravelTicketProvider: TravelTicketProvider, _BusTicketProvider: BusTicketProvider, _BookingLinkProvider: BookingLinkProvider, _deriveBookingChecklist: deriveBookingChecklist, _newBooking: newBooking, _deriveTripTasks: deriveTripTasks, _lockedLegsTasks: lockedLegsTasks, _transportChoiceTasks: transportChoiceTasks, _mergeBookings: mergeBookings, _researchBookings: researchBookings, _TripShare: TripShare, _isOwnerOfTrip: isOwnerOfTrip, _shareLinkFor: shareLinkFor, _newDestination: newDestination, _applyDestRole: applyDestRole, _roleDefaults: roleDefaults, _researchStays: researchStays, _StayLinkProvider: StayLinkProvider, _researchRestaurants: researchRestaurants, _FoodLinkProvider: FoodLinkProvider, _runConciergeResearch: runConciergeResearch, _isResearching: isResearching, _goDashboard: goDashboard, _renderDashboard: renderDashboard, _applyVerifiedRoute: applyVerifiedRoute, _routePath: routePath, _verifyRoute: verifyRoute, _parseTripDates: parseTripDates, _finalizePlanDays: finalizePlanDays, _assignDayTypes: assignDayTypes,
    _buildDayView: buildDayView, _setItemPlacement: setItemPlacement, _moveToDay: moveToDay, _moveToSlot: moveToSlot, _moveUpDown: moveUpDown, _dropItem: dropItem, _addPlaceToDay: addPlaceToDay, _removeAdded: removeAdded, _togglePin: togglePin, _isPinned: isPinned, _resetDayToAI: resetDayToAI, _fixTimingOnly: fixTimingOnly, _regenerateSingleDay: regenerateSingleDay, _finalDayMode: finalDayMode, _normSlot: normSlot, _TIME_SLOTS: TIME_SLOTS, _laneItems: laneItems, _ensureOverride: ensureOverride,
    _researchTransport: researchTransport, _tpPick: tpPick, _chosenMode: chosenMode, _chooseTransport: chooseTransport, _requestDlcRide: requestDlcRide, _totalTravelers: totalTravelers, _legKeyOf: legKeyOf,
    _fetchPhotoClient: fetchPhotoClient, _whenGoogleMaps: whenGoogleMaps,
    _computeRoute: computeRoute, _gmapsRouteLegs: gmapsRouteLegs, _gmapsMatrix: gmapsMatrix, _verifyTransportRoutes: verifyTransportRoutes,
    _analyzeGroupProfile: analyzeGroupProfile, _researchAttractions: researchAttractions, _ticketedAttractionBookings: ticketedAttractionBookings, _pinAttraction: pinAttraction,
    _researchEvents: researchEvents, _researchStopovers: researchStopovers, _researchRouteOps: researchRouteOps, _routeOpsForDay: routeOpsForDay, _addRouteOpToDay: addRouteOpToDay, _computeTripCosts: computeTripCosts, _costSplit: costSplit, _familyShares: familyShares, _addLedgerEntry: addLedgerEntry, _toggleLedgerPaid: toggleLedgerPaid, _initCostAssumptions: initCostAssumptions,
    _liveExpiry: liveExpiry, _liveDistMi: liveDistMi, _toggleTripSharing: toggleTripSharing, _startLiveShare: startLiveShare, _stopLiveShare: stopLiveShare, _liveMembers: liveMembers, _pushMyLocation: pushMyLocation,
    _improveTrip: improveTrip, _runImprove: runImprove, _toggleImproveGoal: toggleImproveGoal, _improveSelectedGoals: improveSelectedGoals,
    _voteVerdict: voteVerdict, _recomputeAutoReject: recomputeAutoReject, _reconcileAutoRejections: reconcileAutoRejections, _rejectedNames: rejectedNames, _rejectedNameSet: rejectedNameSet, _unrejectPlace: unrejectPlace, _skippedNames: skippedNames,
    _consensusFor: consensusFor, _familyWeight: familyWeight, _buildPreferenceProfile: buildPreferenceProfile, _likedNames: likedNames, _favoritedNames: favoritedNames, _votesSummaryText: votesSummaryText, _voteRow: voteRow,
    _preferredNames: preferredNames, _votesSignature: votesSignature, _votesChangedSinceOptimize: votesChangedSinceOptimize, _optimizeRebuild: optimizeRebuild, _consensusSort: consensusSort, _hotelVoteName: hotelVoteName,
    _researchTours: researchTours, _requestDlcInquiry: requestDlcInquiry, _reconcileRideResult: reconcileRideResult, _attachManualBooking: attachManualBooking, _openConfirmBookingModal: openConfirmBookingModal, _researchWeather: researchWeather, _checkHotelDeals: checkHotelDeals, _checkTicketDeals: checkTicketDeals, _toursPanel: toursPanel,
    _loadMedia: loadMedia, _addMedia: addMedia, _updateMedia: updateMedia, _deleteMedia: deleteMedia, _visibleMedia: visibleMedia, _mediaCol: mediaCol, _isImageUrl: isImageUrl, _dayOptionsForAlbum: dayOptionsForAlbum,
    _generateClipPackage: generateClipPackage, _mountLiveMap: mountLiveMap, _renderAlbum: renderAlbum, _renderClips: renderClips, _albumCard: albumCard, _clipExportPanel: clipExportPanel, _addMediaPanel: addMediaPanel,
    _renderHero: renderHero, _renderCreate: renderCreate, _whoWhereWhatBand: whoWhereWhatBand, _howItWorksSection: howItWorksSection, _capabilityCards: capabilityCards, _trustSection: trustSection, _tripActivityFeed: tripActivityFeed, _renderLiveLocation: renderLiveLocation, _callWithRetry: callWithRetry,
    _researchTransportStrategies: researchTransportStrategies, _transportStrategiesPanel: transportStrategiesPanel, _stratCard: stratCard, _modeDetailRow: modeDetailRow, _returnIntelCard: returnIntelCard, _tpModeLabel: tpModeLabel, _tpRiskLevel: tpRiskLevel, _connectionPlanCard: connectionPlanCard,
    _heroShowcase: heroShowcase, _destinationShowcase: destinationShowcase, _destinationCard: destinationCard, _planLandingDestination: planLandingDestination, _LANDING_DESTS: LANDING_DESTS, _finalCtaBand: finalCtaBand,
    _heroCinematic: heroCinematic, _destinationStoryBand: destinationStoryBand, _caHeroScene: caHeroScene, _destScene: destScene, _discoversRail: discoversRail,
    _buildTripGraph: buildTripGraph, _materializeDay: materializeDay, _replanRange: replanRange, _lockNode: lockNode, _unlockNode: unlockNode, _isNodeLocked: isNodeLocked, _isPlaceNodeLocked: isPlaceNodeLocked, _nodeVotes: nodeVotes, _placeNodeId: placeNodeId,
    _renderJourney: renderJourney, _journeyNodeCard: journeyNodeCard, _nodeIcon: nodeIcon,
    _interpretCommand: interpretCommand, _applyEditPlan: applyEditPlan, _commandBar: commandBar, _editPlanPreview: editPlanPreview, _resolveNodeByName: resolveNodeByName, _opLine: opLine,
    _emptyMemory: emptyMemory, _memUnion: memUnion, _normalizeMemory: normalizeMemory, _loadTravelMemory: loadTravelMemory, _saveTravelMemory: saveTravelMemory, _clearTravelMemory: clearTravelMemory, _learnFromTrip: learnFromTrip, _applyMemoryToNewTrip: applyMemoryToNewTrip, _hasTravelMemory: hasTravelMemory, _memoryPanel: memoryPanel,
    _segments: segments, _segArrival: segArrival, _segDeparture: segDeparture, _parseSegDate: parseSegDate, _segNights: segNights, _nightsBetween: nightsBetween, _deriveDateRange: deriveDateRange, _buildSegmentDayPlan: buildSegmentDayPlan, _journeySummary: journeySummary, _isoOfDate: isoOfDate,
    _journeyEditor: journeyEditor, _segmentCard: segmentCard, _journeySummaryStrip: journeySummaryStrip, _transportLegRow: transportLegRow, _returnLegRow: returnLegRow, _renderCreate: renderCreate, _TRANSPORT_PREFS: TRANSPORT_PREFS,
    _deterministicSkeleton: deterministicSkeleton, _runLegDaysFromSkeleton: runLegDaysFromSkeleton, _generateMultiLegPlan: generateMultiLegPlan,
    _segmentIdForCity: segmentIdForCity, _segmentBookingStatus: segmentBookingStatus, _migrateLegacyTripToSegments: migrateLegacyTripToSegments };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : this);
