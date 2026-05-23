import type { Service } from '@prisma/client';
import * as repo from '../repositories/services.repository.js';

/**
 * Service Layer — Service (服務 / 療程) 的業務邏輯。
 *
 * 檔名 "services.service.ts" 經典 OOP 命名梗：
 *   ServiceLayer + ServiceModel = ServiceService。
 *   無解，業界一般接受這種疊字。Java Spring 也是這樣 (ProductService、UserService)。
 */

export async function listServices(): Promise<Service[]> {
  return repo.findAllActiveServices();
}
