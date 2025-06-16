const { google } = require('googleapis');
const calendar = google.calendar('v3');
const key = require('./dulichcali-booking-calendar-b189b2f49e2a.json'); // Your JSON file

const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

async function insertEvent(eventDetails) {
  await auth.authorize();

  const res = await calendar.events.insert({
    auth,
    calendarId: 'primary', // Or the specific calendar ID
    requestBody: eventDetails
  });

  console.log('Event created:', res.data.htmlLink);
  return res.data;
}

module.exports = insertEvent;
