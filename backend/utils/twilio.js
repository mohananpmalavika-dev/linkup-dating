const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;

const isTwilioConfigured = () => Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);

const getTwilioClient = () => {
  if (!isTwilioConfigured()) {
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  return twilioClient;
};

const sendSMS = async (toPhone, message) => {
  const client = getTwilioClient();

  if (!client) {
    return {
      success: false,
      error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.',
      mock: true
    };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: toPhone
    });

    return {
      success: true,
      sid: result.sid,
      status: result.status
    };
  } catch (error) {
    console.error('Twilio SMS send error:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

const sendPhoneOTP = async (phone, otp) => {
  const message = `Your DatingHub OTP is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`;
  return sendSMS(phone, message);
};

module.exports = {
  isTwilioConfigured,
  getTwilioClient,
  sendSMS,
  sendPhoneOTP
};

