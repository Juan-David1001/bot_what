import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

prisma.$use(async (params, next) => {
	// Simple query middleware to log model and action
	try {
		const result = await next(params);
		console.log('Prisma query:', params.model ?? 'UnknownModel', params.action);
		return result;
	} catch (err) {
		console.error('Prisma error:', params.model ?? 'UnknownModel', params.action, err);
		throw err;
	}
});

console.log('Prisma client initialized');

export default prisma;
