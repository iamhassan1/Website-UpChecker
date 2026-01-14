require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const http = require('http');

// ==========================================
// CONFIGURATION
// ==========================================

// 1. Target URLs to monitor
// You can either modify this array OR set the TARGET_URLS environment variable (comma separated)
const DEFAULT_URLS = [
    'https://www.digital.diplo.de/',
    'https://www.digital.diplo.de/visa',
];

// Load URLs from Environment Variable if present, otherwise use default
const TARGET_URLS = process.env.TARGET_URLS
    ? process.env.TARGET_URLS.split(',').map(url => url.trim())
    : DEFAULT_URLS;

// 2. Email Configuration
// Best practice: Set these in your deployment platform (e.g., Railway) Environment Variables
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const RECIPIENTS = process.env.EMAIL_RECIPIENTS
    ? process.env.EMAIL_RECIPIENTS.split(',').map(e => e.trim())
    : ['thegarbage0@gmail.com', 'thehk12@gmail.com'];

// 3. Retry Interval
// Time in seconds to wait before checking again
const RETRY_INTERVAL_SECONDS = process.env.RETRY_INTERVAL_SECONDS || 20;

// ==========================================

// Track which sites are already UP to avoid re-checking them
let pendingUrls = [...TARGET_URLS];

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// Helper to send email
async function sendEmail(subject, text) {
    const mailOptions = {
        from: `"Uptime Monitor" <${EMAIL_USER}>`,
        to: RECIPIENTS.join(', '),
        subject: subject,
        text: text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent: "${subject}"`);
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}

async function startApp() {
    console.log('🚀 process started...');
    console.log(`Monitoring ${TARGET_URLS.length} websites:`, TARGET_URLS);
    console.log(`Retry Interval: ${RETRY_INTERVAL_SECONDS} seconds`);

    // Send Startup Email
    await sendEmail(
        'Uptime Monitor Started',
        `The monitoring process has started successfully.\n\nMonitoring the following sites:\n${TARGET_URLS.join('\n')}\n\nWe will notify you when they come back up.`
    );

    checkWebsites();
}

async function checkWebsites() {
    if (pendingUrls.length === 0) {
        console.log('🎉 All websites are UP! Monitoring finished.');
        // Optional: Keep the process alive for Railway so it doesn't restart immediately
        // or process.exit(0) if you want it to stop. 
        // For Railway keeping it alive is usually better to avoid "Crash" detection loops if it's a Service.
        console.log('Idling...');
        return;
    }

    console.log(`\n[${new Date().toLocaleTimeString()}] Checking ${pendingUrls.length} pending sites...`);

    // We iterate backwards or create a copy to allow removing items safely
    const currentBatch = [...pendingUrls];

    for (const url of currentBatch) {
        try {
            const response = await axios.get(url, { timeout: 10000 }); // 10s timeout
            if (response.status === 200) {
                console.log(`✅ UP: ${url}`);
                await sendEmail(`Website is UP: ${url}`, `Good news! ${url} is now accessible (Status 200).`);

                // Remove from pending list
                pendingUrls = pendingUrls.filter(u => u !== url);
            } else {
                console.log(`⚠️ Status ${response.status}: ${url}`);
            }
        } catch (error) {
            console.log(`❌ DOWN: ${url} (${error.code || error.message})`);
        }
    }

    if (pendingUrls.length > 0) {
        console.log(`Waiting ${RETRY_INTERVAL_SECONDS} seconds...`);
        setTimeout(checkWebsites, RETRY_INTERVAL_SECONDS * 1000);
    } else {
        console.log('🎉 All sites are now UP. Process complete.');
    }
}

// ----------------------------------------------------
// DUMMY SERVER FOR RAILWAY (To satisfy PORT requirement)
// ----------------------------------------------------
// Railway expects a web service to bind to a port often.
// If this is deployed as a Worker, this block isn't strictly necessary but harmless.
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Uptime Monitor Running.\nPending Sites: ${pendingUrls.length}`);
});

server.listen(PORT, () => {
    console.log(`Dummy HTTP server listening on port ${PORT} (for Railway health checks)`);
});

// Start the Monitor
startApp();
