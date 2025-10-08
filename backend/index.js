// Load environment variables from the .env file
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

// Get Twilio credentials from .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const myPhoneNumber = process.env.MY_PHONE_NUMBER; // Your personal, verified phone number

// Initialize Twilio client
const client = new twilio(accountSid, authToken);

// Initialize Express app
const app = express();
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable parsing of JSON request bodies

// Create a health check endpoint to see if the server is running
app.get('/', (req, res) => {
    res.send('Project V1 Backend is running! 🚀');
});

// Create the SOS endpoint
app.post('/api/sos', (req, res) => {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const messageBody = `EMERGENCY ALERT! Help needed at this location: ${mapsLink}`;

    console.log(`Sending SOS message to ${myPhoneNumber}`);
    console.log(`Message: ${messageBody}`);

    client.messages
        .create({
            body: messageBody,
            from: twilioPhoneNumber,
            to: myPhoneNumber
        })
        .then(message => {
            console.log('SMS sent successfully. SID:', message.sid);
            res.status(200).json({ success: true, message: 'SOS alert sent successfully!' });
        })
        .catch(error => {
            console.error('Error sending SMS:', error);
            res.status(500).json({ success: false, error: 'Failed to send SOS alert.' });
        });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});