/**
 * Script para inicializar las hojas de Google Sheets con sus headers
 * Crea las estructuras necesarias para el sistema MCP
 */

import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1p79w-78L2WOVp8qiomaCvTpe-iEyN714eaR3gIc_0Ec';

async function initializeSheets() {
  try {
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                        path.join(process.cwd(), 'gen-lang-client-0594774333-95a18bb02c4b.json');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    console.log('🔧 Inicializando hojas de Google Sheets...\n');

    // 1. Headers para Estado_Contactos (sesiones y handoff)
    console.log('📝 Configurando hoja "Estado_Contactos"...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Estado_Contactos!A1:M1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'sessionId',
          'contactNumber',
          'contactAlias',
          'status',
          'channel',
          'startedAt',
          'closedAt',
          'handoff',
          'handoffReason',
          'assignedAgentId',
          'handoffStartedAt',
          'lastMessageAt',
          'metadata'
        ]],
      },
    });
    console.log('✅ Headers de Estado_Contactos creados\n');

    // 2. Verificar que Productos tenga headers correctos
    console.log('📝 Verificando hoja "Productos"...');
    const productResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Productos!A1:F1',
    });
    
    if (!productResponse.data.values || productResponse.data.values.length === 0) {
      console.log('⚠️  Productos no tiene headers, creándolos...');
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Productos!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'nombre',
            'categoria',
            'precio',
            'descripcion',
            'stock',
            'tags'
          ]],
        },
      });
      console.log('✅ Headers de Productos creados');
    } else {
      console.log('✅ Productos ya tiene headers');
    }
    console.log();

    // 3. Crear hoja de Mensajes para logs (opcional pero útil)
    console.log('📝 Creando hoja "Mensajes" para logs...');
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Mensajes',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 10,
                },
              },
            },
          }],
        },
      });
      console.log('✅ Hoja "Mensajes" creada');
      
      // Agregar headers a Mensajes
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Mensajes!A1:H1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'timestamp',
            'sessionId',
            'contactNumber',
            'direction',
            'messageType',
            'content',
            'status',
            'metadata'
          ]],
        },
      });
      console.log('✅ Headers de Mensajes creados');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  Hoja "Mensajes" ya existe');
      } else {
        throw error;
      }
    }
    console.log();

    // 4. Crear hoja de Ordenes para gestión de pedidos
    console.log('📝 Creando hoja "Ordenes" para gestión de pedidos...');
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Ordenes',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 12,
                },
              },
            },
          }],
        },
      });
      console.log('✅ Hoja "Ordenes" creada');
      
      // Agregar headers a Ordenes
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Ordenes!A1:L1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'orderId',
            'sessionId',
            'contactNumber',
            'status',
            'total',
            'currency',
            'items',
            'shippingAddress',
            'paymentMethod',
            'createdAt',
            'updatedAt',
            'notes'
          ]],
        },
      });
      console.log('✅ Headers de Ordenes creados');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  Hoja "Ordenes" ya existe');
      } else {
        throw error;
      }
    }
    console.log();

    console.log('🎉 Todas las hojas han sido inicializadas correctamente!\n');
    console.log('Estructura final:');
    console.log('  📄 Hoja 1: Información del negocio (Campo | Valor)');
    console.log('  📦 Productos: Catálogo de productos (6 columnas)');
    console.log('  👥 Estado_Contactos: Sesiones y handoff (13 columnas)');
    console.log('  💬 Mensajes: Log de mensajes (8 columnas)');
    console.log('  🛒 Ordenes: Gestión de pedidos (12 columnas)');

  } catch (error: any) {
    console.error('❌ Error inicializando hojas:', error?.message || error);
  }
}

initializeSheets();
