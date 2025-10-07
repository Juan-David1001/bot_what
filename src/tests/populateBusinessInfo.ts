/**
 * Script para copiar datos de información del negocio a la hoja Informacion
 */

import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1p79w-78L2WOVp8qiomaCvTpe-iEyN714eaR3gIc_0Ec';

async function populateBusinessInfo() {
  try {
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                        path.join(process.cwd(), 'gen-lang-client-0594774333-95a18bb02c4b.json');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    console.log('📝 Poblando hoja "Informacion" con datos del negocio...\n');

    const businessData = [
      ['Campo', 'Valor'],
      ['nombre_negocio', 'Euforia'],
      ['direccion', 'calle 49#50-31, San Pedro de los Milagros'],
      ['horario', 'Todos los días de 11:00 AM a 8:00 PM'],
      ['telefono', '+57 311 434 0586'],
      ['email', 'contacto@euforia.com'],
      ['metodos_pago', 'Efectivo, Transferencia, Nequi, Daviplata'],
      ['envio_nacional', 'Sí - $16,000 COP'],
      ['politica_privacidad', 'Respetamos tu privacidad. Envíos discretos.'],
      ['politica_devolucion', '30 días para devoluciones de productos sin abrir'],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Informacion!A1:B10',
      valueInputOption: 'RAW',
      requestBody: {
        values: businessData,
      },
    });

    console.log('✅ Datos de negocio agregados a "Informacion"');
    console.log(`   ${businessData.length - 1} registros creados\n`);

  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
  }
}

populateBusinessInfo();
