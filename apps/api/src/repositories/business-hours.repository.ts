import type { BusinessHours } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * Repository Layer (DAO / 持久化層)
 *
 * 對應講義：NTU App Arch P.67
 * - 唯一直接呼叫 Prisma 的層
 * - 換 ORM、加 cache、改 schema 的「衝擊半徑」都收斂在這裡
 * - 不寫業務規則、不丟 HTTP error
 */

export async function findAllBusinessHours(): Promise<BusinessHours[]> {
  return prisma.businessHours.findMany({
    orderBy: { dayOfWeek: 'asc' },
  });
}

export async function findBusinessHoursByDayOfWeek(
  dayOfWeek: number,
): Promise<BusinessHours | null> {
  return prisma.businessHours.findUnique({
    where: { dayOfWeek },
  });
}
