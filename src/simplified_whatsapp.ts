import qrcode from 'qrcode-terminal';
import { Client } from 'whatsapp-web.js';

console.log('📱 WhatsApp Simplified Client');

// Crear cliente sin autenticación local
const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

// Eventos básicos
client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('📱 Escanea este código QR con WhatsApp');
});

client.on('ready', () => {
  console.log('✅ Cliente WhatsApp conectado');
});

client.on('authenticated', () => {
  console.log('✅ Autenticado correctamente');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Error de autenticación:', msg);
});

// Responder a mensajes
client.on('message', async (msg) => {
  try {
    if (msg.fromMe) return;
    
    console.log(`📩 Mensaje recibido de ${msg.from}: ${msg.body}`);
    
    if (msg.body && msg.body.trim() !== '') {
      await msg.reply('¡Hola! Soy el bot de Euforia 🤖');
      console.log('✅ Respuesta enviada');
    }
  } catch (err) {
    console.error('❌ Error al procesar mensaje:', err);
  }
});

// Iniciar cliente
console.log('⏳ Iniciando cliente WhatsApp...');
client.initialize();

// Exportar para uso en otros archivos
export default client;
export const sendMessage = async (to: string, message: string) => {
  try {
    if (!client.info) {
      console.log('⚠️ Cliente no está listo');
      return null;
    }
    
    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    const response = await client.sendMessage(chatId, message);
    console.log(`✅ Mensaje enviado a ${chatId}`);
    return response;
  } catch (err) {
    console.error('❌ Error enviando mensaje:', err);
    return null;
  }
};