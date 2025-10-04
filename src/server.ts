import app from './app';
// Initialize WhatsApp client (side-effect import)
import './services/whatsapp';

const port = process.env.PORT ?? '3000';

console.log('Starting server...');
console.log('NODE_ENV=', process.env.NODE_ENV ?? 'development');

app.listen(parseInt(port, 10), () => {
  console.log(`Server listening on port ${port}`);
});
