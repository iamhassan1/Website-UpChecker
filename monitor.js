const axios = require('axios');
const nodemailer = require('nodemailer');

// ==========================================
// USER INPUTS - PLEASE CONFIGURE THESE
// ==========================================

// 1. Target URL to monitor
const TARGET_URL = 'https://www.digital.diplo.de/';

// 2. List of email addresses to notify
const EMAIL_LIST = [
    'thegarbage0@gmail.com',
    'thehk12@gmail.com'

];

// 3. Email Sender Configuration (Nodemailer)
// You must configure this with a real email account to send emails.
// Example below is for Gmail. App Passwords are required for Gmail: https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'thegarbage0@gmail.com', // Replace with your email
        pass: 'ufgq ivnn nokr wzeh'      // Replace with your app password
    }
});

// ==========================================

async function checkWebsite() {
    console.log(`[${new Date().toLocaleTimeString()}] Checking status of: ${TARGET_URL}...`);

    try {
        const response = await axios.get(TARGET_URL);

        if (response.status === 200) {
            console.log('✅ Website is UP (Status 200).');
            await sendSuccessEmails();

            console.log('Exiting process as success criteria met.');
            process.exit(0);
        } else {
            // Handled as a "down" state if not 200, though axios throws on non-2xx by default usually, 
            // unless validateStatus is changed. Logic here covers manual handling if needed.
            console.log(`⚠️ Website returned status ${response.status}.`);
            handleFailure();
        }
    } catch (error) {
        console.log(`❌ Website is DOWN. Error: ${error.message}`);
        handleFailure();
    }
}

function handleFailure() {
    const retrySeconds = 20;
    console.log(`Waiting ${retrySeconds} seconds before retrying...\n`);
    setTimeout(checkWebsite, retrySeconds * 1000);
}

async function sendSuccessEmails() {
    console.log('Attempting to send notification emails...');

    const mailOptions = {
        from: '"Uptime Monitor" <thegarbage0@gmail.com>', // Sender address - Must match authenticated user to avoid spam
        to: EMAIL_LIST.join(', '), // List of receivers
        subject: `Website is UP: ${TARGET_URL}`,
        text: `Good news! The website ${TARGET_URL} is now reachable and returned a 200 OK status.`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        console.log('Message ID:', info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
        console.log('Please check your SMTP configuration at the top of the file.');
    }
}

console.log('Starting Uptime Monitor...');
checkWebsite();
