const axios = require('axios');
const nodemailer = require('nodemailer');
const http = require('http');

// ==========================================
// HARDCODED CONFIGURATION (DEBUGGING)
// ==========================================

const EMAIL_USER = 'thegarbage0@gmail.com';
const EMAIL_PASS = 'ufgq ivnn nokr wzeh';
const RECIPIENTS = ['thegarbage0@gmail.com', 'thehk12@gmail.com'];
const TARGET_URLS = [
    'https://www.google.com/',
    'https://www.digital.diplo.de/',
    'https://www.digital.diplo.de/visa'
];
const RETRY_INTERVAL_SECONDS = 120; // 2 minutes

// ==========================================

let pendingUrls = [...TARGET_URLS];

// Ultra-reliable Transporter Config for Cloud/Containers
const transporter = nodemailer.createTransport({
    service: 'gmail', // Simple 'gmail' service is often best
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    logger: true, // Log SMTP exchanges
    debug: true   // Include debug info
});

async function sendEmail(subject, text) {
    console.log(`📨 [Trying] Sending email: "${subject}"`);

    // We strictly use a Promise wrapper to ensure we catch everything
    try {
        const info = await transporter.sendMail({
            from: `"Uptime Monitor" <${EMAIL_USER}>`,
            to: RECIPIENTS.join(', '),
            subject: subject,
            text: text
        });
        console.log(`✅ [Success] Email sent: "${subject}" (ID: ${info.messageId})`);
    } catch (error) {
        console.error(`❌ [Failed] Email error for "${subject}":`, error);
    }
}

async function startApp() {
    console.log('🚀 Process starting (Hardcoded Config)...');
    console.log(`Monitoring:`, TARGET_URLS);

    // NON-BLOCKING startup email
    sendEmail('Monitor Started', `Monitoring:\n${TARGET_URLS.join('\n')}`);

    console.log('⏳ Waiting 5 seconds for network...');
    setTimeout(checkWebsites, 5000);
}

async function checkWebsites() {
    if (pendingUrls.length === 0) {
        console.log('🎉 All websites are UP! Monitoring finished.');
        return;
    }

    console.log(`\n[${new Date().toLocaleTimeString()}] Checking ${pendingUrls.length} sites...`);

    // Check all in parallel
    const currentBatch = [...pendingUrls];

    await Promise.all(currentBatch.map(async (url) => {
        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            if (response.status === 200) {
                console.log(`✅ UP: ${url}`);
                sendEmail(`Website Up: ${url}`, `URL is reachable: ${url}`);
                pendingUrls = pendingUrls.filter(u => u !== url);
            } else {
                console.log(`⚠️ Status ${response.status}: ${url}`);
            }
        } catch (error) {
            console.log(`❌ DOWN: ${url} (${error.code || error.message})`);
        }
    }));

    if (pendingUrls.length > 0) {
        console.log(`Waiting ${RETRY_INTERVAL_SECONDS} seconds...`);
        setTimeout(checkWebsites, RETRY_INTERVAL_SECONDS * 1000);
    } else {
        console.log('🎉 Done.');
    }
}

// Dummy Server
const port = 3000;
http.createServer((req, res) => res.end('Monitor Running')).listen(port, '0.0.0.0', () => {
    console.log(`Server listening on ${port}`);
});

startApp();
