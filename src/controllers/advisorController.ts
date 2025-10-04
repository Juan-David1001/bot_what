import { Request, Response } from 'express';
import prisma from '../db/prisma';

/**
 * Controlador de asesores/empleados
 */

/**
 * GET /advisors
 * Obtener listado de asesores
 */
export async function getAdvisors(req: Request, res: Response) {
  try {
    const advisors = await prisma.advisor.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, advisors });
  } catch (err: any) {
    console.error('Error fetching advisors:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /advisors
 * Crear nuevo asesor
 */
export async function createAdvisor(req: Request, res: Response) {
  const { name, email, role } = req.body as {
    name: string;
    email: string;
    role?: string;
  };

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  try {
    const advisor = await prisma.advisor.create({
      data: {
        name,
        email,
        role: role ?? 'advisor',
      },
    });

    return res.json({ success: true, advisor });
  } catch (err: any) {
    console.error('Error creating advisor:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}
