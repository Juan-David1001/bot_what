import qrcode from 'qrcode-terminal';
import { Client, LocalAuth } from 'whatsapp-web.js';

// Minimal temporary WhatsApp test client that replies "Hola" to any incoming message.
// Use this file to isolate the WhatsApp flow from the rest of the app.

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

client.on('qr', (qr: string) => {
  qrcode.generate(qr, { small: true });
  console.log('🔲 QR code received — scan with your phone to authenticate');
});

client.on('authenticated', () => console.log('✅ Authenticated'));
client.on('ready', () => console.log('✅ Ready'));
client.on('auth_failure', (msg: any) => console.error('❌ Auth failure:', msg));
client.on('disconnected', (reason: any) => console.error('⚠️ Disconnected:', reason));

client.on('message', async (msg: any) => {
  try {
    if (msg.fromMe) return; // ignore self messages

    console.log('📩 Incoming message from', msg.from, 'body:', msg.body || '[media]');

    // Reply with a simple greeting
    await client.sendMessage(msg.from, 'Hola');
    console.log('✅ Replied "Hola" to', msg.from);
  } catch (err: any) {
    console.error('❌ Error replying to message:', err?.message || err);
  }
});

client.initialize();

// Global error handlers for the test client
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection in test client:', reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('Uncaught Exception in test client:', err);
});
