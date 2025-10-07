/**
 * Script de prueba para verificar conexión con Google Sheets
 * Ejecutar con: npx ts-node src/tests/testGoogleSheets.ts
 */

import {
  getProducts,
  getBusinessInfo,
  searchProducts,
  formatProductsForGemini,
  formatBusinessInfoForGemini,
} from '../services/googleSheets';

async function testGoogleSheets() {
  console.log('🧪 Testing Google Sheets Integration...\n');

  try {
    // Test 1: Get business info
    console.log('📋 Test 1: Fetching business info...');
    const businessInfo = await getBusinessInfo();
    console.log('✅ Business info retrieved:', businessInfo.length, 'rows');
    console.log('Formatted:\n', formatBusinessInfoForGemini(businessInfo));
    console.log('\n---\n');

    // Test 2: Get all products
    console.log('🛍️ Test 2: Fetching all products...');
    const products = await getProducts();
    console.log('✅ Products retrieved:', products.length, 'products');
    console.log('First 3 products:\n', formatProductsForGemini(products.slice(0, 3)));
    console.log('\n---\n');

    // Test 3: Search products
    console.log('🔍 Test 3: Searching products (query: "vibrador")...');
    const searchResults = await searchProducts('vibrador');
    console.log('✅ Search results:', searchResults.length, 'found');
    console.log('Results:\n', formatProductsForGemini(searchResults));
    console.log('\n---\n');

    console.log('✅ All tests passed! Google Sheets integration is working correctly.');
  } catch (error: any) {
    console.error('❌ Test failed:', error?.message || error);
    console.error('Stack:', error?.stack);
    process.exit(1);
  }
}

testGoogleSheets();
