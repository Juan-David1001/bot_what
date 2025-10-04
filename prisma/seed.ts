import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');
  // Delete in order to avoid foreign key constraint issues
  await prisma.message.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.satisfactionSurvey.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.advisor.deleteMany();
  await prisma.product.deleteMany();

  console.log('Seeding advisors...');
  const [juan, mariaSupervisor] = await Promise.all([
    prisma.advisor.create({ data: { name: 'Juan Pérez', email: 'juan@sexshop.local', role: 'advisor' } }),
    prisma.advisor.create({ data: { name: 'María López', email: 'maria@sexshop.local', role: 'supervisor' } }),
  ]);

  console.log('Seeding products...');
  const productsData = [
    {
      name: 'Vibrador Classic',
      category: 'juguetes',
      description: 'Vibrador clásico, material silicona, 3 velocidades.',
      // Precio en COP (aprox 1 USD = 3,900 COP)
      price: 116961,
      inStock: true,
      tags: 'vibrador,principiantes,silicona',
    },
    {
      name: 'Lubricante water-based 100ml',
      category: 'lubricantes',
      description: 'Lubricante a base de agua, fórmula suave para pieles sensibles.',
      price: 38961,
      inStock: true,
      tags: 'lubricante,agua,sensible',
    },
    {
      name: 'Anillo vibrador',
      category: 'juguetes',
      description: 'Anillo con vibración para parejas, recargable.',
      price: 77961,
      inStock: true,
      tags: 'anillo,pareja,recargable',
    },
    {
      name: 'Masajeador Pro',
      category: 'juguetes',
      description: 'Masajeador potente con múltiples modos de vibración.',
      price: 233961,
      inStock: false,
      tags: 'masajeador,potente',
    },
    {
      name: 'Conjunto lencería seda',
      category: 'lenceria',
      description: 'Conjunto elegante en seda para ocasiones especiales.',
      price: 194961,
      inStock: true,
      tags: 'lenceria,seda,discreto',
    },
    {
      name: 'Plug anal pequeño',
      category: 'juguetes',
      description: 'Plug anal tamaño pequeño, material seguro.',
      price: 58461,
      inStock: true,
      tags: 'plug,anal,principiantes',
    },
    // Productos adicionales para mayor variedad
    {
      name: 'Vibrador Punto G',
      category: 'juguetes',
      description: 'Diseñado para estimular el punto G con formas ergonómicas y 5 modos de vibración.',
      price: 149000,
      inStock: true,
      tags: 'vibrador,punto g,ergonomico',
    },
    {
      name: 'Set de masaje aromático 200ml',
      category: 'accesorios',
      description: 'Aceite de masaje con esencias relajantes, ideal para pareja.',
      price: 45000,
      inStock: true,
      tags: 'aceite,masaje,aromaterapia',
    },
    {
      name: 'Condones saborizados x12',
      category: 'accesorios',
      description: 'Pack de 12 condones con sabores variados y lubricados.',
      price: 32000,
      inStock: true,
      tags: 'condones,saborizados,seguridad',
    },
    {
      name: 'Lubricante anal 50ml',
      category: 'lubricantes',
      description: 'Lubricante a base de silicona de larga duración, diseñado para uso anal.',
      price: 42000,
      inStock: true,
      tags: 'lubricante,anal,silicona',
    },
    {
      name: 'Masajeador de cuello personal',
      category: 'bienestar',
      description: 'Masajeador compacto para puntos de tensión y relajación muscular.',
      price: 89000,
      inStock: true,
      tags: 'masajeador,bienestar,portatil',
    },
    {
      name: 'Kit de inicio pareja',
      category: 'pareja',
      description: 'Kit con vibrador, anillo, lubricante y guía de uso para parejas.',
      price: 129000,
      inStock: true,
      tags: 'kit,pareja,inicio',
    },
    {
      name: 'Plug anal mediano',
      category: 'juguetes',
      description: 'Plug anal tamaño mediano con base de seguridad, silicona suave.',
      price: 78000,
      inStock: true,
      tags: 'plug,anal,mediano',
    },
    {
      name: 'Kits de pilas recargables + cargador',
      category: 'accesorios',
      description: 'Baterías recargables y cargador rápido para juguetes recargables.',
      price: 65000,
      inStock: true,
      tags: 'pilas,recargables,cargador',
    },
    {
      name: 'Set de limpieza para juguetes',
      category: 'accesorios',
      description: 'Spray limpiador y paño microfibra para mantener higiene de los juguetes.',
      price: 28000,
      inStock: true,
      tags: 'limpieza,higiene,accesorios',
    },
    {
      name: 'Conjunto bondage básico',
      category: 'fetiche',
      description: 'Juego de ataduras y accesorios suaves para explorar de forma segura.',
      price: 99000,
      inStock: true,
      tags: 'bondage,fetiche,inicio',
    },
    {
      name: 'Anillos para masaje erótico x3',
      category: 'pareja',
      description: 'Pack de 3 anillos para masaje con texturas diferentes.',
      price: 46000,
      inStock: true,
      tags: 'anillos,pareja,texturas',
    },
    {
      name: 'Vibrador recargable mini',
      category: 'juguetes',
      description: 'Mini vibrador discreto, recargable, perfecto para llevar de viaje.',
      price: 55000,
      inStock: true,
      tags: 'mini,recargable,discreto',
    },
  ];

  const products = [];
  for (const p of productsData) {
    // Create each product; prices are in COP
    const prod = await prisma.product.create({ data: p });
    products.push(prod);
  }

  console.log('Seeding contacts and sessions...');
  const contacts = [];

  const c1 = await prisma.contact.create({
    data: {
      alias: 'Anonimo1',
      realName: null,
      number: '5215511000001',
      privacyMode: true,
    },
  });
  contacts.push(c1);

  const c2 = await prisma.contact.create({
    data: {
      alias: 'Laura',
      realName: 'Laura Gómez',
      number: '5215511000002',
      privacyMode: false,
    },
  });
  contacts.push(c2);

  const c3 = await prisma.contact.create({
    data: {
      alias: 'ParejaA',
      realName: null,
      number: '5215511000003',
      privacyMode: true,
    },
  });
  contacts.push(c3);

  console.log('Creating sessions and messages...');

  // Session 1 - simple product question
  const s1 = await prisma.session.create({
    data: {
      contactId: c1.id,
      channel: 'whatsapp',
      status: 'active',
      geminiThreadId: `seed-thread-${c1.id}`,
    },
  });

  await prisma.message.createMany({
    data: [
      { content: 'Hola, ¿tienen vibradores para principiantes?', direction: 'IN', contactId: c1.id, sessionId: s1.id },
      { content: 'Sí, te recomiendo el Vibrador Classic, es suave y discreto.', direction: 'OUT', contactId: c1.id, sessionId: s1.id },
    ],
  });

  const consultation1 = await prisma.consultation.create({
    data: {
      contactId: c1.id,
      sessionId: s1.id,
      advisorId: juan.id,
      category: 'recomendacion',
      topic: 'vibradores principiantes',
      description: 'Consulta sobre vibradores para principiantes',
      response: 'Recomendar Vibrador Classic',
      status: 'resolved',
      resolvedAt: new Date(),
    },
  });

  await prisma.satisfactionSurvey.create({
    data: {
      contactId: c1.id,
      consultationId: consultation1.id,
      rating: 5,
      comments: 'Muy útil, gracias',
    },
  });

  // Session 2 - support / escalation
  const s2 = await prisma.session.create({
    data: {
      contactId: c2.id,
      channel: 'web',
      status: 'active',
      geminiThreadId: `seed-thread-${c2.id}`,
    },
  });

  await prisma.message.createMany({
    data: [
      { content: 'Compré un masajeador y no enciende, ¿qué hago?', direction: 'IN', contactId: c2.id, sessionId: s2.id },
      { content: '¿Probaste cargarlo completamente y revisar el botón?', direction: 'OUT', contactId: c2.id, sessionId: s2.id },
    ],
  });

  const consultation2 = await prisma.consultation.create({
    data: {
      contactId: c2.id,
      sessionId: s2.id,
      advisorId: juan.id,
      category: 'soporte_uso',
      topic: 'masajeador no enciende',
      description: 'Producto no enciende tras la compra',
      response: 'Instrucciones básicas de troubleshooting',
      status: 'escalated',
    },
  });

  const escalation = await prisma.escalation.create({
    data: {
      consultationId: consultation2.id,
      reason: 'Puede ser defecto de fábrica',
      assignedToId: mariaSupervisor.id,
      status: 'pending',
    },
  });

  // Session 3 - general inquiry
  const s3 = await prisma.session.create({
    data: {
      contactId: c3.id,
      channel: 'whatsapp',
      status: 'active',
      geminiThreadId: `seed-thread-${c3.id}`,
    },
  });

  await prisma.message.createMany({
    data: [
      { content: '¿Qué lubricante es mejor para piel sensible?', direction: 'IN', contactId: c3.id, sessionId: s3.id },
      { content: 'Te recomiendo el Lubricante water-based 100ml, es suave y sin perfumes.', direction: 'OUT', contactId: c3.id, sessionId: s3.id },
    ],
  });

  const consultation3 = await prisma.consultation.create({
    data: {
      contactId: c3.id,
      sessionId: s3.id,
      category: 'producto',
      topic: 'lubricante piel sensible',
      description: 'Consulta sobre lubricante para piel sensible',
      response: 'Recomendar lubricante a base de agua',
      status: 'resolved',
      resolvedAt: new Date(),
    },
  });

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
