import { PrismaClient, ServiceCategory } from '@prisma/client';

/**
 * Seed script — 把樣本資料灌進空 DB。
 *
 * 對應講義：
 * - 12-Factor Factor 12 (P.39): Admin processes 應該獨立一支 script 跑
 * - Dev/prod parity (Factor 10): seed 只在 dev / staging 跑，prod 用真實資料
 *
 * 執行：pnpm --filter @dental-clinic/api db:seed
 *
 * 設計：upsert，重複跑不會炸（idempotent）。
 */

const prisma = new PrismaClient();

async function seedDoctors(): Promise<void> {
  const doctors = [
    {
      id: 'doc_wang',
      name: '王大明',
      title: '院長',
      specialties: ['一般牙科', '植牙', '根管治療'],
      bioMd:
        '王醫師執業超過 20 年，專精於植牙與複雜根管治療。曾任台大醫院牙科部住院醫師，並於日本東京齒科大學進修植牙專修課程。',
      credentials: [
        '台大牙醫系',
        '台大醫院牙科部住院醫師',
        '日本東京齒科大學植牙專修',
        '中華民國牙醫師全聯會專科醫師',
      ],
      photoUrl: null,
      displayOrder: 1,
    },
    {
      id: 'doc_li',
      name: '李美玲',
      title: '副院長',
      specialties: ['兒童牙科', '齒列矯正'],
      bioMd:
        '李醫師專長兒童牙科與齒列矯正，以親切耐心著稱，幫助無數小朋友克服看牙的恐懼。',
      credentials: [
        '陽明牙醫系',
        '台北馬偕兒童牙科訓練',
        '美國隱適美 Invisalign 認證醫師',
      ],
      photoUrl: null,
      displayOrder: 2,
    },
    {
      id: 'doc_zhang',
      name: '張小華',
      title: '主治醫師',
      specialties: ['美容牙科', '瓷牙貼片', '冷光美白'],
      bioMd:
        '張醫師專注於微笑設計與美學牙科，重視整體臉部和諧與自然感，協助患者展現自信笑容。',
      credentials: [
        '高醫牙醫系',
        '美國紐約大學 (NYU) 美容牙科進修',
        '陶瓷貼片臨床教學講師',
      ],
      photoUrl: null,
      displayOrder: 3,
    },
    {
      id: 'doc_chen',
      name: '陳建宏',
      title: '主治醫師',
      specialties: ['牙周病', '口腔外科'],
      bioMd:
        '陳醫師專長牙周治療與口腔外科手術，以保留自然牙為首要原則，致力於牙周病早期診斷與長期維護。',
      credentials: [
        '北醫牙醫系',
        '中華民國牙周病學會專科醫師',
        '中華民國口腔顎面外科學會會員',
      ],
      photoUrl: null,
      displayOrder: 4,
    },
  ];

  for (const d of doctors) {
    await prisma.doctor.upsert({
      where: { id: d.id },
      update: d,
      create: d,
    });
  }
  console.log(`✅ Doctors: ${doctors.length} upserted`);
}

async function seedServices(): Promise<void> {
  const services: Array<{
    id: string;
    name: string;
    category: ServiceCategory;
    priceMin: number;
    priceMax: number | null;
    isNhi: boolean;
    descriptionMd: string;
    displayOrder: number;
  }> = [
    {
      id: 'svc_checkup',
      name: '定期檢查與洗牙',
      category: ServiceCategory.PREVENTIVE,
      priceMin: 0,
      priceMax: 300,
      isNhi: true,
      descriptionMd:
        '半年一次的口腔檢查與超音波洗牙，預防牙周病、蛀牙與口腔疾病。健保給付（每半年一次免費）。',
      displayOrder: 1,
    },
    {
      id: 'svc_filling',
      name: '蛀牙填補',
      category: ServiceCategory.RESTORATIVE,
      priceMin: 200,
      priceMax: 1500,
      isNhi: true,
      descriptionMd: '蛀牙清除後以複合樹脂或玻璃離子體填補，恢復牙齒功能與外觀。',
      displayOrder: 2,
    },
    {
      id: 'svc_root_canal',
      name: '根管治療',
      category: ServiceCategory.RESTORATIVE,
      priceMin: 1500,
      priceMax: 8000,
      isNhi: true,
      descriptionMd: '俗稱「抽神經」。清除受感染的牙髓組織，保留自然牙。前牙、小臼齒、大臼齒費用不同。',
      displayOrder: 3,
    },
    {
      id: 'svc_crown',
      name: '全瓷牙冠',
      category: ServiceCategory.RESTORATIVE,
      priceMin: 12000,
      priceMax: 25000,
      isNhi: false,
      descriptionMd: '根管治療後或大面積缺損的牙齒以全瓷材料製作牙冠，恢復強度與美觀。',
      displayOrder: 4,
    },
    {
      id: 'svc_implant',
      name: '人工植牙',
      category: ServiceCategory.SURGERY,
      priceMin: 50000,
      priceMax: 90000,
      isNhi: false,
      descriptionMd:
        '在缺牙處植入鈦合金植體，再裝上牙冠。價格依品牌（如 Straumann、Nobel Biocare）與是否需要補骨而定。',
      displayOrder: 5,
    },
    {
      id: 'svc_pediatric',
      name: '兒童牙科',
      category: ServiceCategory.PEDIATRIC,
      priceMin: 0,
      priceMax: 2500,
      isNhi: true,
      descriptionMd: '包含塗氟、溝隙封填、乳牙拔除、行為塑造等。多數項目健保給付。',
      displayOrder: 6,
    },
    {
      id: 'svc_invisalign',
      name: '隱形矯正 (Invisalign)',
      category: ServiceCategory.ORTHODONTIC,
      priceMin: 150000,
      priceMax: 280000,
      isNhi: false,
      descriptionMd:
        '使用透明牙套逐步矯正齒列，美觀且方便清潔。療程約 1.5～2.5 年，依齒列複雜度而定。',
      displayOrder: 7,
    },
    {
      id: 'svc_whitening',
      name: '冷光美白',
      category: ServiceCategory.COSMETIC,
      priceMin: 8000,
      priceMax: 15000,
      isNhi: false,
      descriptionMd: '診間單次療程約 1 小時，可提亮 3～8 個色階。維持效果約 1～2 年。',
      displayOrder: 8,
    },
    {
      id: 'svc_veneer',
      name: '全瓷貼片',
      category: ServiceCategory.COSMETIC,
      priceMin: 18000,
      priceMax: 25000,
      isNhi: false,
      descriptionMd: '0.3～0.5mm 薄瓷貼片黏附於牙齒表面，改善牙齒顏色、形狀與排列。微量修磨自然牙。',
      displayOrder: 9,
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }
  console.log(`✅ Services: ${services.length} upserted`);
}

async function seedBusinessHours(): Promise<void> {
  // 一週 7 天；週日休診，週六 09:00-17:00，週一~五 09:00-21:00
  const hours = [
    { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },    // Sun
    { dayOfWeek: 1, isClosed: false, openTime: '09:00', closeTime: '21:00' }, // Mon
    { dayOfWeek: 2, isClosed: false, openTime: '09:00', closeTime: '21:00' },
    { dayOfWeek: 3, isClosed: false, openTime: '09:00', closeTime: '21:00' },
    { dayOfWeek: 4, isClosed: false, openTime: '09:00', closeTime: '21:00' },
    { dayOfWeek: 5, isClosed: false, openTime: '09:00', closeTime: '21:00' },
    { dayOfWeek: 6, isClosed: false, openTime: '09:00', closeTime: '17:00' }, // Sat
  ];

  for (const h of hours) {
    await prisma.businessHours.upsert({
      where: { dayOfWeek: h.dayOfWeek },
      update: h,
      create: h,
    });
  }
  console.log(`✅ BusinessHours: ${hours.length} upserted`);
}

async function main(): Promise<void> {
  console.log('🌱 Seeding...');
  await seedDoctors();
  await seedServices();
  await seedBusinessHours();
  console.log('🎉 Seed complete.');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
