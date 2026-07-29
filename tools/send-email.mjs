import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error('Missing RESEND_API_KEY. Add it to your local .env file (see .env.example).');
}

const resend = new Resend(apiKey);

await resend.emails.send({
  from: 'onboarding@resend.dev', // Replace with your verified sending domain once set up
  to: 'revenge.ez.123@gmail.com',
  subject: 'Hello from Resend',
  html: '<p>This is a test email sent via Resend.</p>',
});

console.log('Email sent.');
