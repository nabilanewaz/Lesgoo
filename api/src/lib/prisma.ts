import { PrismaClient } from '@prisma/client';

// One shared client (and connection pool) for the whole process.
export const prisma = new PrismaClient();
