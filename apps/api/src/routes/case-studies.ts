import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
export async function caseStudiesRoutes(app: FastifyInstance) { app.get('/api/case-studies', () => prisma.caseStudy.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' } })); }
