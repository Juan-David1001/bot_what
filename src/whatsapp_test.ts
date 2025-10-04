import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

console.log('📱 WhatsApp Test Client - Echo Bot');

// Crear directorio único para la sesión
const sessionDir = `.wwebjs_test_${Date.now()}`;

// Configuración minimalista
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'test-client',
    dataPath: sessionDir
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  }
});

// Eventos básicos
client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('📱 Escanea el código QR con WhatsApp');
});

client.on('ready', () => {
  console.log('✅ Cliente listo y conectado');
});

client.on('authenticated', () => {
  console.log('✅ Autenticado correctamente');
});

client.on('auth_failure', (err) => {
  console.error('❌ Error de autenticación:', err);
});

// Ignoramos completamente el evento de desconexión
client.on('disconnected', (reason) => {
  console.log(`📴 Cliente desconectado: ${reason}`);
  // No hacemos nada para evitar errores de archivos
});

// Responder "Hola" a todos los mensajes
client.on('message', async (msg) => {
  if (msg.fromMe) return;
  
  console.log(`📩 Mensaje de ${msg.from.split('@')[0]}: ${msg.body}`);
  
  try {
    // Responder simplemente con "Hola"
    await msg.reply('Hola');
    console.log('✅ Respondido con "Hola"');
  } catch (err) {
    console.error('❌ Error respondiendo:', err);
  }
});

// Inicializar
console.log('⏳ Iniciando cliente...');
client.initialize();

// Manejo global de errores
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  // No cerramos el proceso
});

process.on('unhandledRejection', (err) => {
  console.error('Rechazo no manejado:', err);
  // No cerramos el proceso
});

console.log('⏳ Cliente inicializado, esperando eventos...');