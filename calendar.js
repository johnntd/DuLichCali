const CLIENT_ID = '623460884698-0k6g2r4ltb3c0d9hs0odms2b5j2hsp67.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

let gapiInited = false;

function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
    gapiInited = true;
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '',
  });
}

function authenticateAndAddEvent(eventData) {
  if (!gapiInited) {
    alert('Google API not initialized');
    return;
  }

  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) throw resp;

    try {
      const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: eventData,
      });
      console.log('Event added to Google Calendar:', response.result);
    } catch (err) {
      console.error('Failed to add event:', err);
    }
  };

  tokenClient.requestAccessToken();
}

function createEventObject(name, phone, datetime, address, airport, type) {
  const startTime = new Date(datetime);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

  const isPickup = type === 'pickup';
  const summary = isPickup ? `Đón khách: ${name}` : `Đưa khách: ${name}`;
  const location = isPickup ? airport : address;

  return {
    summary,
    location,
    description: `Khách: ${name}\nSĐT: ${phone}\n${isPickup ? 'Đến' : 'Đón'}: ${isPickup ? address : airport}`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/Los_Angeles',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/Los_Angeles',
    },
  };
}
