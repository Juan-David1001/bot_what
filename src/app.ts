import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import healthRoutes from './routes/health';
import mcpRoutes from './routes/mcp';
import productRoutes from './routes/products';
import advisorRoutes from './routes/advisors';
import orderRoutes from './routes/orders';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();

app.use(express.json());
console.log('Express JSON middleware enabled');

// Servir archivos estáticos (frontend)
app.use((express as any).static(path.join(__dirname, '../public')));
console.log('Static files served from /public');

// Rutas principales
app.use('/health', healthRoutes);
console.log('Mounted route: /health');
app.use('/mcp', mcpRoutes);
console.log('Mounted route: /mcp');
app.use('/products', productRoutes);
console.log('Mounted route: /products');
app.use('/advisors', advisorRoutes);
console.log('Mounted route: /advisors');
app.use('/orders', orderRoutes);
console.log('Mounted route: /orders');

// Global error handler
app.use(errorHandler);

export default app;
