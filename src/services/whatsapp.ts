import qrcode from 'qrcode-terminal';
import { Client, LocalAuth } from 'whatsapp-web.js';

// Crear un nuevo directorio temporal único para cada sesión
const sessionDir = `.wwebjs_auth_${Date.now()}`;

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'wp-bot-client',
    dataPath: sessionDir
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-composition',
      '--no-first-run',
      '--single-process',
      '--disable-gpu'
    ],
    ignoreHTTPSErrors: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  },
  restartOnAuthFail: false,
  qrMaxRetries: 5,
  disableSpins: true,
});

console.log('Creating WhatsApp client (whatsapp-web.js)');

client.on('qr', (qr: string) => {
  qrcode.generate(qr, { small: true });
  console.log('🔲 QR code received, scan with your phone.');
  console.log('⏳ Waiting for authentication...');
});

client.on('authenticated', () => {
  console.log('✅ WhatsApp authenticated successfully');
});

client.on('ready', () => {
  console.log('✅ WhatsApp client is ready');
});

client.on('auth_failure', (msg: any) => {
  console.error('❌ Authentication failure:', msg);
  console.log('💡 Solution: Delete .wwebjs_auth folder and scan QR again');
});

// Escuchar mensajes entrantes de WhatsApp
client.on('message', async (msg: any) => {
  try {
    // Ignorar mensajes enviados por nosotros
    if (msg.fromMe) {
      return;
    }

    // Verificar si tiene contenido
    const hasContent = msg.body && msg.body.trim() !== '';
    const isMedia = msg.hasMedia;
    
    if (!hasContent && !isMedia) {
      return;
    }

    console.log('📩 WhatsApp mensaje recibido:', {
      from: msg.from,
      body: msg.body || '[imagen]',
      hasMedia: isMedia,
    });

    // Procesar el mensaje a través del sistema MCP
    const { handleClientMessage } = await import('../controllers/mcpController');
    
    const mockReq = {
      body: {
        message: msg.body || 'Imagen recibida',
        contactNumber: msg.from,
        channel: 'whatsapp',
        isMedia: isMedia,
        mediaType: isMedia ? msg.type : undefined,
      },
    } as any;

    const mockRes = {
      json: (data: any) => {
        console.log('📤 Respuesta procesada');
        return mockRes;
      },
      status: (code: number) => {
        console.error('❌ Error al procesar, status:', code);
        return mockRes;
      },
    } as any;

    await handleClientMessage(mockReq, mockRes);
  } catch (error: any) {
    console.error('❌ Error procesando mensaje:', error.message);
  }
});

console.log('⏳ Initializing WhatsApp client...');
client.initialize();

// Desactivar completamente el manejo de desconexiones
// No haremos nada cuando WhatsApp se desconecte para evitar el error EBUSY
client.on('disconnected', (reason: any) => {
  console.log('⚠️ Desconexión detectada:', reason);
  // No hacemos nada para evitar que intente eliminar archivos en uso
  
  // Simplemente volvemos a mostrar el QR para reconectar
  console.log('Escanea el QR nuevamente cuando aparezca');
});

// Enviar mensaje de WhatsApp de manera segura
export async function sendWhatsAppMessage(to: string, message: string) {
  try {
    // No enviamos mensajes si el cliente no está listo
    if (!client.info) {
      console.warn('⚠️ Cliente WhatsApp no está listo, omitiendo mensaje');
      return null;
    }
    
    // Verificamos formato del número
    const formattedTo = to.includes('@c.us') ? to : `${to}@c.us`;
    
    // Timeout para evitar bloqueos
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout sending message')), 5000);
    });
    
    // Intento con timeout
    const res = await Promise.race([
      client.sendMessage(formattedTo, message),
      timeoutPromise
    ]);
    
    console.log('✅ Mensaje enviado a:', formattedTo.split('@')[0]);
    return res;
  } catch (err: any) {
    // Error controlado
    console.error('❌ Error enviando mensaje:', err.message);
    return null;
  }
}

export default client;
