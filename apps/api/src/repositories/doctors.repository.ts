import type { Doctor } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * Repository Layer — Doctor 的 DB 操作。
 *
 * 對應講義：NTU App Arch P.67 持久化層
 * 規則：
 *   - 只負責「翻譯 Prisma 呼叫」，不寫業務規則
 *   - 不丟 HTTP error；資料不存在就回 null
 */

export async function findAllActiveDoctors(): Promise<Doctor[]> {
  return prisma.doctor.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
  });
}

export async function findDoctorById(id: string): Promise<Doctor | null> {
  return prisma.doctor.findUnique({
    where: { id },
  });
}
