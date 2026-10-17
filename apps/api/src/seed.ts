import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, StationType, StretchType } from './generated/prisma/client.js';

interface StationSeed {
  code: string;
  name: string;
  stationType: StationType;
  isOutsourced: boolean;
}

interface FabricSeed {
  code: string;
  name: string;
  weightOz: number;
  composition: string;
  stretchType: StretchType;
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL or DIRECT_URL is required to seed.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log('Seeding catalog master data...');

  // 1. Stations
  const stations: StationSeed[] = [
    {
      code: 'CUT-01',
      name: 'Xưởng Cắt Bán Thành Phẩm 01',
      stationType: StationType.CUTTING,
      isOutsourced: false,
    },
    {
      code: 'SEW-01',
      name: 'Chuyền May Ráp 01',
      stationType: StationType.SEWING,
      isOutsourced: false,
    },
    {
      code: 'EMB-01',
      name: 'Xưởng Thêu & In Ấn Gia Công',
      stationType: StationType.EMBROIDERY,
      isOutsourced: true,
    },
    {
      code: 'DYE-01',
      name: 'Xưởng Nhuộm Màu Chàm',
      stationType: StationType.DYEING,
      isOutsourced: true,
    },
    {
      code: 'WSH-01',
      name: 'Xưởng Giặt Mài Hiệu Ứng',
      stationType: StationType.WASH,
      isOutsourced: true,
    },
    {
      code: 'FIN-01',
      name: 'Chuyền Đóng Nút & Hoàn Thiện',
      stationType: StationType.FINISHING,
      isOutsourced: false,
    },
    {
      code: 'QC-01',
      name: 'Bàn Kiểm Định KCS & QC',
      stationType: StationType.QC,
      isOutsourced: false,
    },
    {
      code: 'PCK-01',
      name: 'Khu Đóng Gói & Xuất Hàng',
      stationType: StationType.PACKING,
      isOutsourced: false,
    },
  ];

  for (const s of stations) {
    await prisma.station.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
  }
  console.log(`Seeded ${stations.length} stations.`);

  // 2. Styles
  const styles = [
    {
      styleCode: 'JN-SLIM-01',
      name: 'Quần Jeans Slim Fit Nam',
      fitType: 'Slim',
      hasEmbroidery: false,
      isActive: true,
    },
    {
      styleCode: 'JN-REG-02',
      name: 'Quần Jeans Regular Cổ Điển',
      fitType: 'Regular',
      hasEmbroidery: true,
      isActive: true,
    },
    {
      styleCode: 'JN-BAGGY-03',
      name: 'Quần Jeans Ống Suông Baggy',
      fitType: 'Baggy',
      hasEmbroidery: false,
      isActive: true,
    },
  ];

  for (const st of styles) {
    await prisma.style.upsert({
      where: { styleCode: st.styleCode },
      update: st,
      create: st,
    });
  }
  console.log(`Seeded ${styles.length} styles.`);

  // 3. Fabric Types
  const fabricTypes: FabricSeed[] = [
    {
      code: 'DN-12-RIGID',
      name: 'Denim 12oz Không Co Giãn',
      weightOz: 12.0,
      composition: '100% Cotton Bền Chắc',
      stretchType: StretchType.RIGID,
    },
    {
      code: 'DN-10-STRETCH',
      name: 'Denim 10oz Co Giãn Nhẹ',
      weightOz: 10.0,
      composition: '98% Cotton, 2% Spandex',
      stretchType: StretchType.STRETCH,
    },
    {
      code: 'DN-14-HEAVY',
      name: 'Denim 14oz Dày Cao Cấp',
      weightOz: 14.0,
      composition: '100% Cotton Chải Kỹ',
      stretchType: StretchType.RIGID,
    },
  ];

  for (const f of fabricTypes) {
    await prisma.fabricType.upsert({
      where: { code: f.code },
      update: f,
      create: f,
    });
  }
  console.log(`Seeded ${fabricTypes.length} fabric types.`);

  // 4. Color Options
  const colors = [
    { code: 'CLR-INDIGO', name: 'Xanh Chàm Indigo Truyền Thống', colorFamily: 'Xanh' },
    { code: 'CLR-BLACK', name: 'Đen Tuyền Classic', colorFamily: 'Đen' },
    { code: 'CLR-GREY', name: 'Xám Khói Vintage', colorFamily: 'Xám' },
    { code: 'CLR-LIGHTBLUE', name: 'Xanh Nhạt Mài Sáng', colorFamily: 'Xanh' },
  ];

  for (const c of colors) {
    await prisma.colorOption.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }
  console.log(`Seeded ${colors.length} color options.`);

  // 5. Wash Types
  const washes = [
    {
      code: 'WSH-STONE',
      name: 'Giặt Mài Đá (Stone Wash)',
      description: 'Mài nhẹ tự nhiên bằng đá bọt núi lửa, tạo màu sờn mềm mại',
    },
    {
      code: 'WSH-ACID',
      name: 'Giặt Tẩy Axit (Acid Wash)',
      description: 'Tẩy loang tương phản mạnh phong cách đường phố thập niên 90',
    },
    {
      code: 'WSH-BLEACH',
      name: 'Giặt Tẩy Trắng (Bleach Wash)',
      description: 'Hạ màu xanh chàm xuống tông xanh băng sáng',
    },
    {
      code: 'WSH-RAW',
      name: 'Giặt Mộc (Raw / Rinse Wash)',
      description: 'Chỉ rũ hồ giữ nguyên độ cứng cáp và màu vải thô nguyên bản',
    },
  ];

  for (const w of washes) {
    await prisma.washType.upsert({
      where: { code: w.code },
      update: w,
      create: w,
    });
  }
  console.log(`Seeded ${washes.length} wash types.`);

  console.log('Catalog seeding finished successfully!');
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
