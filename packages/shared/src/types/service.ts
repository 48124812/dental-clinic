/**
 * Service (療程 / 服務項目) DTO.
 *
 * ServiceCategory 是字串聯合 — 對應 Prisma schema 的 enum，JSON 序列化後就是這 6 個字串之一。
 */

export type ServiceCategory =
  | 'PREVENTIVE'
  | 'RESTORATIVE'
  | 'COSMETIC'
  | 'ORTHODONTIC'
  | 'SURGERY'
  | 'PEDIATRIC';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  priceMin: number;
  priceMax: number | null;
  isNhi: boolean;
  descriptionMd: string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
