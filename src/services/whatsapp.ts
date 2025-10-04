import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
  WAMessage,
  WASocket,
  MessageUpsertType,
  isJidGroup,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Logger configuration
const logger = pino({ level: 'silent' }); // Use 'info' for debugging

let sock: WASocket | null = null;
let qrCodeGenerated = false;

// Auth state directory
const authDir = path.join(process.cwd(), '.baileys_auth');

console.log('Creating WhatsApp client (Baileys)');

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

export async function initializeWhatsApp(): Promise<void> {
  try {
    // Use multi-file auth state for better reliability
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      logger,
      auth: state,
      printQRInTerminal: false, // We'll handle QR display ourselves
      defaultQueryTimeoutMs: 60000,
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !qrCodeGenerated) {
        console.log('🔲 QR code received, scan with your phone:');
        console.log('⏳ Waiting for authentication...\n');
        
        try {
          // Generate QR in terminal
          const qrString = await QRCode.toString(qr, { 
            type: 'terminal',
            small: true 
          });
          console.log(qrString);
          qrCodeGenerated = true;
        } catch (err) {
          console.error('Error generating QR code:', err);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = 
          (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        console.log('Connection closed due to:', lastDisconnect?.error);
        
        if (shouldReconnect) {
          console.log('Reconnecting...');
          qrCodeGenerated = false;
          setTimeout(() => initializeWhatsApp(), 3000);
        } else {
          console.log('Logged out. Please restart the application.');
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp client is ready and connected!');
        qrCodeGenerated = false;
      }
    });

    // Save credentials on creds update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }: { messages: WAMessage[], type: MessageUpsertType }) => {
      if (type === 'notify') {
        for (const message of messages) {
          await handleIncomingMessage(message);
        }
      }
    });

  } catch (error) {
    console.error('Error initializing WhatsApp:', error);
    throw error;
  }
}

async function handleIncomingMessage(message: WAMessage): Promise<void> {
  try {
    // Skip if no message content or if it's from a group
    if (!message.message || !message.key.remoteJid || isJidGroup(message.key.remoteJid)) {
      return;
    }

    // Extract message text
    const messageText = 
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      '';

    // Skip empty messages
    if (!messageText.trim()) {
      return;
    }

    // Normalize phone number (remove @s.whatsapp.net)
    const from = jidNormalizedUser(message.key.remoteJid || '');
    const phoneNumber = from.replace('@s.whatsapp.net', '');
    
    console.log('📩 INCOMING WhatsApp message:');
    console.log('  From:', phoneNumber);
    console.log('  Body:', messageText);
    console.log('  Timestamp:', new Date().toISOString());
    console.log('  Message ID:', message.key.id);

    // Process message through MCP controller
    try {
      const { handleClientMessage } = await import('../controllers/mcpController');
      
      // Create mock request/response objects
      const mockReq = {
        body: {
          message: messageText,
          contactNumber: phoneNumber,
          channel: 'whatsapp',
        },
      } as any;

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            console.log(`MCP Response Status ${code}:`, data);
            return mockRes;
          },
        }),
        json: (data: any) => {
          console.log('MCP Response:', data.success ? '✅ Success' : '❌ Error');
          if (data.error) {
            console.error('MCP Error:', data.error);
          }
          return mockRes;
        },
      } as any;

      // Process the message through MCP
      await handleClientMessage(mockReq, mockRes);
      console.log('✅ Message processed through MCP system');
      
    } catch (mcpError) {
      console.error('❌ Error processing message through MCP:', mcpError);
      
      // Send error message to user
      try {
        await sendWhatsAppMessage(
          from,
          'Lo siento, hubo un error procesando tu mensaje. Por favor intenta nuevamente en unos momentos.'
        );
      } catch (sendError) {
        console.error('❌ Error sending error message:', sendError);
      }
    }
    
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<any> {
  console.log('sendWhatsAppMessage: to=', to);
  console.log('sendWhatsAppMessage: messagePreview=', message.slice(0, 160));
  
  if (!sock) {
    console.error('sendWhatsAppMessage: WhatsApp client not initialized');
    throw new Error('WhatsApp client not initialized');
  }

  try {
    // Ensure the phone number is in the correct format
    let formattedNumber = to;
    if (!to.includes('@s.whatsapp.net')) {
      // Remove any non-digit characters except +
      const cleanNumber = to.replace(/[^\d+]/g, '');
      formattedNumber = `${cleanNumber}@s.whatsapp.net`;
    }

    const result = await sock.sendMessage(formattedNumber, { text: message });
    console.log('✅ sendWhatsAppMessage: success to=', to);
    console.log('📤 OUTGOING WhatsApp message sent');
    
    return result;
  } catch (error) {
    console.error('❌ sendWhatsAppMessage: failed', error);
    throw error;
  }
}

export function isWhatsAppReady(): boolean {
  return sock !== null;
}

export function getWhatsAppSocket(): WASocket | null {
  return sock;
}

// Auto-initialize when module is imported
initializeWhatsApp().catch(console.error);
