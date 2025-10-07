/**
 * Script para listar todas las hojas (sheets) del spreadsheet
 */

import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1p79w-78L2WOVp8qiomaCvTpe-iEyN714eaR3gIc_0Ec';

async function listSheets() {
  try {
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                        path.join(process.cwd(), 'gen-lang-client-0594774333-95a18bb02c4b.json');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    console.log('📋 Fetching spreadsheet metadata...\n');

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const spreadsheet = response.data;
    console.log('Spreadsheet Title:', spreadsheet.properties?.title);
    console.log('\nAvailable Sheets:');
    console.log('=================\n');

    if (spreadsheet.sheets) {
      spreadsheet.sheets.forEach((sheet, index) => {
        const title = sheet.properties?.title || 'Untitled';
        const sheetId = sheet.properties?.sheetId;
        const gridProperties = sheet.properties?.gridProperties;
        
        console.log(`${index + 1}. Sheet Name: "${title}"`);
        console.log(`   Sheet ID: ${sheetId}`);
        console.log(`   Rows: ${gridProperties?.rowCount || 'unknown'}`);
        console.log(`   Columns: ${gridProperties?.columnCount || 'unknown'}`);
        console.log('');
      });
    }

    console.log('\n✅ Use these exact sheet names in your code (case-sensitive)');
  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
    if (error.code === 403) {
      console.error('\n⚠️  Permission Error: The service account may not have access to this spreadsheet.');
      console.error('Solution: Share the spreadsheet with the service account email:');
      console.error('  node-374@gen-lang-client-0594774333.iam.gserviceaccount.com');
    }
  }
}

listSheets();
