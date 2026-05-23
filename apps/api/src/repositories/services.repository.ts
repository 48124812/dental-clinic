import type { Service } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * Repository Layer — Service 的 DB 操作。
 * 對應 US-04: 病患看到清楚的療程價格區間與健保註記。
 */

export async function findAllActiveServices(): Promise<Service[]> {
  return prisma.service.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
  });
}
