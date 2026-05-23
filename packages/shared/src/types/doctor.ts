/**
 * Doctor DTO — 牙醫資料，網路傳輸格式 (JSON serialized)。
 *
 * 為什麼用 string 而不是 Date：
 *   - JSON 不認識 Date；Fastify reply.send() 會自動把 Date.toJSON() 變 ISO 字串
 *   - FE 從 fetch 拿到的本來就是 string
 *   - 把 wire format 明確寫出來，避免「忘了 new Date() 包回去」的 bug
 */
export interface Doctor {
  id: string;
  name: string;
  title: string;
  specialties: string[];
  bioMd: string;
  credentials: string[];
  photoUrl: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
