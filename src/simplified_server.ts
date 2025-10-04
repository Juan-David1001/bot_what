import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Importar adaptador de WhatsApp simplificado
import './services/whatsapp_adapter';

// Cargar variables de entorno
dotenv.config();

// Configurar servidor Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use((express as any).static(path.join(__dirname, '../public')));

// Conexión a la base de datos
const prisma = new PrismaClient();
prisma.$connect()
  .then(() => console.log('✅ Base de datos conectada'))
  .catch(err => console.error('❌ Error conectando a la base de datos:', err));

// Importar rutas
import healthRoutes from './routes/health';
import mcpRoutes from './routes/mcp';
import productRoutes from './routes/products';
import advisorRoutes from './routes/advisors';
import orderRoutes from './routes/orders';

// Montar rutas
app.use('/health', healthRoutes);
app.use('/mcp', mcpRoutes);
app.use('/products', productRoutes);
app.use('/advisors', advisorRoutes);
app.use('/orders', orderRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor simplificado ejecutándose en puerto ${PORT}`);
  console.log(`🌐 API disponible en http://localhost:${PORT}`);
  console.log(`📱 Cliente WhatsApp conectándose...`);
});