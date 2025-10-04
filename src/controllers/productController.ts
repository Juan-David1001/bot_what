import { Request, Response } from 'express';
import prisma from '../db/prisma';

/**
 * Controlador de productos - Catálogo
 */

/**
 * GET /products
 * Obtener listado de productos
 */
export async function getProducts(req: Request, res: Response) {
  const { category, inStock } = req.query;

  try {
    const products = await prisma.product.findMany({
      where: {
        category: category ? (category as string) : undefined,
        inStock: inStock === 'true' ? true : undefined,
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, products });
  } catch (err: any) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /products
 * Crear nuevo producto
 */
export async function createProduct(req: Request, res: Response) {
  const { name, category, description, price, inStock, tags, imageUrl } = req.body as {
    name: string;
    category: string;
    description: string;
    price?: number;
    inStock?: boolean;
    tags?: string;
    imageUrl?: string;
  };

  if (!name || !category || !description) {
    return res.status(400).json({ error: 'name, category and description are required' });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name,
        category,
        description,
        price: price ?? undefined,
        inStock: inStock ?? true,
        tags: tags ?? undefined,
        imageUrl: imageUrl ?? undefined,
      },
    });

    return res.json({ success: true, product });
  } catch (err: any) {
    console.error('Error creating product:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * GET /products/search
 * Buscar productos por nombre, categoría o tags
 */
export async function searchProducts(req: Request, res: Response) {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'query parameter q is required' });
  }

  try {
    // SQLite doesn't support case-insensitive contains, use lowercase comparison
    const lowerQ = q.toLowerCase();
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { category: { contains: q } },
          { tags: { contains: q } },
        ],
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, products, count: products.length });
  } catch (err: any) {
    console.error('Error searching products:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}
