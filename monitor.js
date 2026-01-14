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
    'https://www.google.com/',
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

// Validate Critical Environment Variables
if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ CRITICAL ERROR: EMAIL_USER or EMAIL_PASS environment variables are missing.');
    console.error('Please configure them in your Railway project settings.');
    process.exit(1);
}

// Track which sites are already UP to avoid re-checking them
let pendingUrls = [...TARGET_URLS];

// Email Configuration - Using Port 465 (SSL) is often more reliable in containers than 587
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    // Force IPv4 and use simplified SSL settings
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 20000, // 20s
    greetingTimeout: 20000
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
        console.log(`📨 Attempting to send email (Background): "${subject}"...`);
        transporter.sendMail(mailOptions).then(() => {
            console.log(`📧 Email sent successfully: "${subject}"`);
        }).catch(err => {
            console.error(`❌ Error sending email "${subject}":`, err.message);
        });
    } catch (error) {
        console.error('❌ Error preparing email:', error.message);
    }
}

async function startApp() {
    console.log('🚀 Process starting...');
    console.log(`Monitoring ${TARGET_URLS.length} websites:`, TARGET_URLS);

    sendEmail(
        'Uptime Monitor Started',
        `Monitoring:\n${TARGET_URLS.join('\n')}`
    );

    // Give the container network a moment to settle
    console.log('⏳ Waiting 5 seconds before first check...');
    setTimeout(checkWebsites, 5000);
}

async function checkWebsites() {
    if (pendingUrls.length === 0) {
        console.log('🎉 All websites are UP! Monitoring finished.');
        console.log('Idling...');
        return;
    }

    console.log(`\n[${new Date().toLocaleTimeString()}] Checking ${pendingUrls.length} pending sites (Parallel)...`);

    // Create a copy for the loop
    const currentBatch = [...pendingUrls];

    // Check ALL sites in parallel
    await Promise.all(currentBatch.map(async (url) => {
        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });

            if (response.status === 200) {
                console.log(`✅ UP: ${url}`);
                // Send email immediately
                sendEmail(`Website is UP: ${url}`, `Good news! ${url} is now accessible (Status 200).`);

                // Remove from pending list (atomic filter not needed since we work on a copy, but we need to update global)
                // We'll update the global list by filtering out THIS url
                pendingUrls = pendingUrls.filter(u => u !== url);
            } else {
                console.log(`⚠️ Status ${response.status}: ${url}`);
            }
        } catch (error) {
            // Only log if it's NOT a timeout to reduce noise? OR log everything.
            // On Railway, timeouts are common if the site blocks the IP.
            console.log(`❌ DOWN: ${url} (${error.code || error.message})`);
        }
    }));

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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Dummy HTTP server listening on port ${PORT} (0.0.0.0)`);
});

// Start the Monitor
startApp();
