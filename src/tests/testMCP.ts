/**
 * Script de prueba para el sistema MCP
 * Prueba la integración de Gemini con las herramientas MCP
 */

import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

import { queryGeminiWithMCP } from '../services/geminiConversation';

async function testMCP() {
  console.log('🧪 Iniciando prueba del sistema MCP...\n');

  const testCases = [
    {
      name: 'Búsqueda de productos',
      threadId: 'test-search-123',
      message: 'Hola, qué productos tienes disponibles?',
    },
    {
      name: 'Búsqueda específica',
      threadId: 'test-search-456',
      message: 'Busco algo de lubricantes',
    },
    {
      name: 'Información del negocio',
      threadId: 'test-info-789',
      message: 'Cuál es el horario de atención?',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Prueba: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`💬 Usuario: ${testCase.message}\n`);

    try {
      const response = await queryGeminiWithMCP(testCase.threadId, testCase.message);
      console.log(`\n🤖 Asistente: ${response}\n`);
    } catch (error: any) {
      console.error(`❌ Error en prueba "${testCase.name}":`, error.message);
    }

    // Esperar un poco entre pruebas para no saturar la API
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Pruebas completadas');
}

// Ejecutar pruebas
testMCP().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
