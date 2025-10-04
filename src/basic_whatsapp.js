import { Client } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

console.log('🟢 Iniciando cliente WhatsApp básico');

// Cliente simplificado sin autenticación local
const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// Manejo de eventos
client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('📱 Por favor escanea este código QR con WhatsApp');
});

client.on('ready', () => {
  console.log('✅ Cliente WhatsApp listo y conectado');
});

// Escuchando mensajes
client.on('message', async (msg) => {
  try {
    if (msg.fromMe) return;
    
    // Responder a cualquier mensaje con un echo
    const contact = await msg.getContact();
    const name = contact.name || contact.pushname || 'Usuario';
    
    console.log(`📩 Mensaje de ${name}: ${msg.body}`);
    await msg.reply(`Hola ${name}, recibí tu mensaje: "${msg.body}"`);
  } catch (err) {
    console.error('❌ Error al procesar mensaje:', err);
  }
});

// Iniciar cliente
console.log('⏳ Iniciando...');
client.initialize().catch(err => {
  console.error('❌ Error al inicializar:', err);
});

// Mantener proceso vivo
const keepAlive = () => setTimeout(keepAlive, 1000 * 60 * 60);
keepAlive();