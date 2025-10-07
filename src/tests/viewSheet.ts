/**
 * Script para ver el contenido de la hoja
 */

import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1p79w-78L2WOVp8qiomaCvTpe-iEyN714eaR3gIc_0Ec';

async function viewSheetContent() {
  try {
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                        path.join(process.cwd(), 'gen-lang-client-0594774333-95a18bb02c4b.json');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    const sheetName = process.argv[2] || 'Hoja 1';
    console.log(`📋 Fetching data from "${sheetName}"...\n`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z50`, // Leer las primeras 50 filas
    });

    const rows = response.data.values || [];
    
    console.log(`Found ${rows.length} rows\n`);
    console.log('Content:\n========\n');

    rows.forEach((row, index) => {
      console.log(`Row ${index + 1}:`, row.join(' | '));
    });

  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
  }
}

viewSheetContent();
