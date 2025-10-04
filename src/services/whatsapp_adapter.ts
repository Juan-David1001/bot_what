import client, { sendMessage } from '../simplified_whatsapp';
import { handleClientMessage } from '../controllers/mcpController';

/**
 * Este archivo adapta el cliente simplificado de WhatsApp al controlador MCP
 */

console.log('🔄 Configurando adaptador WhatsApp-MCP');

// Escuchar mensajes y enviarlos al controlador MCP
client.on('message', async (msg: any) => {
  if (msg.fromMe) return;

  try {
    const isMedia = !!msg.hasMedia;
    const body = msg.body || (isMedia ? 'Imagen recibida' : '');
    
    console.log('📩 Mensaje recibido:', {
      from: msg.from,
      body: body || '[sin texto]',
      isMedia
    });

    // Crear request simulado para el controlador MCP
    const mockReq = {
      body: {
        message: body,
        contactNumber: msg.from,
        channel: 'whatsapp',
        isMedia,
        mediaType: isMedia ? msg.type : undefined,
      }
    };

    // Crear response simulado
    const mockRes = {
      json: (data: any) => {
        console.log('✅ Respuesta MCP procesada');
        return mockRes;
      },
      status: (code: number) => {
        console.error('❌ Error MCP:', code);
        return mockRes;
      }
    };

    // Enviar al controlador MCP
    await handleClientMessage(mockReq, mockRes);
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
  }
});

// Exportar la función para enviar mensajes
export { sendMessage as sendWhatsAppMessage };

// Reexportar el cliente para uso interno
export default client;