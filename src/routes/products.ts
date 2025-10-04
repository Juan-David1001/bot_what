import { Router } from 'express';
import { getProducts, createProduct, searchProducts } from '../controllers/productController';

const router = Router();

// Catálogo de productos
router.get('/', getProducts);
router.post('/', createProduct);
router.get('/search', searchProducts);

export default router;
