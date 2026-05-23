import type { Doctor } from '@prisma/client';
import * as repo from '../repositories/doctors.repository.js';

/**
 * Service Layer — Doctor 的業務邏輯。
 *
 * 業務規則範例：「不上架（active=false）的醫師，即便 ID 對也視為不存在」
 * → 這就是 service 層該存在的證明：route + repo 都不該做這個判斷
 */

export async function listDoctors(): Promise<Doctor[]> {
  return repo.findAllActiveDoctors();
}

/**
 * 回 Doctor 或 null。讓 route 自己決定要 map 成 404 還是其他。
 * 不丟 Exception 是因為「找不到」是預期內結果，不是錯誤。
 */
export async function getDoctorById(id: string): Promise<Doctor | null> {
  const doctor = await repo.findDoctorById(id);
  if (!doctor || !doctor.active) {
    return null;
  }
  return doctor;
}
