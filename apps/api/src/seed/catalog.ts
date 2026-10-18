import {
  type PrismaClient,
  QcProfileType,
  StationType,
  StretchType,
} from '../generated/prisma/client.js';

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

// Reference data: stations, styles, fabrics, colors, wash types, Fabric-Color matrix (BR-04)
// and the two QC Profiles per style (BR-19). Everything is upserted by code.
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
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
  console.log(`[1/6] Đã khởi tạo ${stations.length} trạm làm việc (Station).`);

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
  console.log(`[2/6] Đã khởi tạo ${styles.length} kiểu dáng (Style).`);

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
  console.log(`[3/6] Đã khởi tạo ${fabricTypes.length} loại vải (FabricType).`);

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
  console.log(`[4/6] Đã khởi tạo ${colors.length} tùy chọn màu (ColorOption).`);

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
  console.log(`[5/6] Đã khởi tạo ${washes.length} kiểu giặt (WashType).`);

  // 6. Fabric-Color Matrix (T1.4, BR-04)
  // Demo Scenario PRD §6:
  // DN-12-RIGID: Indigo, Black, LightBlue allowed; Grey disallowed.
  const dbFabrics = await prisma.fabricType.findMany();
  const dbColors = await prisma.colorOption.findMany();

  const fabricByCode = new Map(dbFabrics.map((f) => [f.code, f.id]));
  const colorByCode = new Map(dbColors.map((c) => [c.code, c.id]));

  const matrixRules: Array<{ fabricCode: string; colorCode: string; isAllowed: boolean }> = [
    // DN-12-RIGID
    { fabricCode: 'DN-12-RIGID', colorCode: 'CLR-INDIGO', isAllowed: true },
    { fabricCode: 'DN-12-RIGID', colorCode: 'CLR-BLACK', isAllowed: true },
    { fabricCode: 'DN-12-RIGID', colorCode: 'CLR-GREY', isAllowed: false },
    { fabricCode: 'DN-12-RIGID', colorCode: 'CLR-LIGHTBLUE', isAllowed: true },
    // DN-10-STRETCH
    { fabricCode: 'DN-10-STRETCH', colorCode: 'CLR-INDIGO', isAllowed: true },
    { fabricCode: 'DN-10-STRETCH', colorCode: 'CLR-BLACK', isAllowed: true },
    { fabricCode: 'DN-10-STRETCH', colorCode: 'CLR-GREY', isAllowed: true },
    { fabricCode: 'DN-10-STRETCH', colorCode: 'CLR-LIGHTBLUE', isAllowed: true },
    // DN-14-HEAVY
    { fabricCode: 'DN-14-HEAVY', colorCode: 'CLR-INDIGO', isAllowed: true },
    { fabricCode: 'DN-14-HEAVY', colorCode: 'CLR-BLACK', isAllowed: true },
    { fabricCode: 'DN-14-HEAVY', colorCode: 'CLR-GREY', isAllowed: false },
    { fabricCode: 'DN-14-HEAVY', colorCode: 'CLR-LIGHTBLUE', isAllowed: false },
  ];

  for (const rule of matrixRules) {
    const fabricTypeId = fabricByCode.get(rule.fabricCode);
    const colorId = colorByCode.get(rule.colorCode);
    if (fabricTypeId && colorId) {
      await prisma.fabricColorRule.upsert({
        where: {
          fabricTypeId_colorId: {
            fabricTypeId,
            colorId,
          },
        },
        update: { isAllowed: rule.isAllowed },
        create: {
          fabricTypeId,
          colorId,
          isAllowed: rule.isAllowed,
        },
      });
    }
  }
  console.log(`[T1.4] Đã khởi tạo ma trận vải - màu (Fabric-Color Matrix).`);

  // 7. QC Profiles per Style (T1.5, BR-19, R-14)
  const dbStyles = await prisma.style.findMany();
  for (const style of dbStyles) {
    // 1. FULL_PROCESS (Tiêu chuẩn khi chạy qua bước giặt sạch)
    await prisma.qcProfile.upsert({
      where: {
        styleId_profileType: {
          styleId: style.id,
          profileType: QcProfileType.FULL_PROCESS,
        },
      },
      update: {
        maxShrinkagePercent: 3.0,
        maxColorFadingLevel: 1,
        isActive: true,
      },
      create: {
        styleId: style.id,
        profileType: QcProfileType.FULL_PROCESS,
        maxShrinkagePercent: 3.0,
        maxColorFadingLevel: 1,
        isActive: true,
      },
    });

    // 2. SKIP_CLEAN_WASH (Dung sai nới lỏng khi khách hàng ký cam kết bỏ giặt sạch)
    await prisma.qcProfile.upsert({
      where: {
        styleId_profileType: {
          styleId: style.id,
          profileType: QcProfileType.SKIP_CLEAN_WASH,
        },
      },
      update: {
        maxShrinkagePercent: 5.0,
        maxColorFadingLevel: 2,
        isActive: true,
      },
      create: {
        styleId: style.id,
        profileType: QcProfileType.SKIP_CLEAN_WASH,
        maxShrinkagePercent: 5.0,
        maxColorFadingLevel: 2,
        isActive: true,
      },
    });
  }
  console.log(
    `[T1.5] Đã khởi tạo cấu hình QC Profile (FULL_PROCESS & SKIP_CLEAN_WASH) cho ${dbStyles.length} kiểu dáng.`,
  );
}
