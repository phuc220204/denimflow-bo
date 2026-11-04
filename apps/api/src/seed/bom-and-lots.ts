import type { PrismaClient } from '../generated/prisma/client.js';
import { DEMO_STYLE_CODE } from './workflow.js';

// BOM norms for the demo style (T3.3, FR-09) and fabric lots for DN-12-RIGID / CLR-INDIGO
// (T3.4, BR-06), so a demo order can be created, costed and allocated.
export async function seedBomAndLots(prisma: PrismaClient): Promise<void> {
  const demoStyle = await prisma.style.findUniqueOrThrow({ where: { styleCode: DEMO_STYLE_CODE } });
  const demoFabricType = await prisma.fabricType.findUniqueOrThrow({
    where: { code: 'DN-12-RIGID' },
  });
  const demoColorIndigo = await prisma.colorOption.findUniqueOrThrow({
    where: { code: 'CLR-INDIGO' },
  });

  const bomNormsData = [
    // FABRIC norms per size (meters + 5% wastage)
    {
      size: '28',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.3,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      size: '29',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.35,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      size: '30',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.4,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      size: '31',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.45,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      size: '32',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.5,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      size: '33',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.55,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      size: '34',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.6,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      size: '36',
      materialType: 'FABRIC' as const,
      qtyPerPiece: 1.7,
      unit: 'meter',
      wastagePercent: 5,
    },

    // Universal trims across all sizes (size = 'ALL')
    {
      size: 'ALL',
      materialType: 'THREAD' as const,
      qtyPerPiece: 120,
      unit: 'meter',
      wastagePercent: 8,
    },
    {
      size: 'ALL',
      materialType: 'BUTTON' as const,
      qtyPerPiece: 1,
      unit: 'piece',
      wastagePercent: 2,
    },
    {
      size: 'ALL',
      materialType: 'RIVET' as const,
      qtyPerPiece: 6,
      unit: 'piece',
      wastagePercent: 3,
    },
    {
      size: 'ALL',
      materialType: 'ZIPPER' as const,
      qtyPerPiece: 1,
      unit: 'piece',
      wastagePercent: 0,
    },
    {
      size: 'ALL',
      materialType: 'LABEL' as const,
      qtyPerPiece: 2,
      unit: 'piece',
      wastagePercent: 1,
    },
    {
      size: 'ALL',
      materialType: 'PACKAGING' as const,
      qtyPerPiece: 1,
      unit: 'piece',
      wastagePercent: 0,
    },
  ];

  for (const norm of bomNormsData) {
    await prisma.bomNorm.upsert({
      where: {
        styleId_size_materialType: {
          styleId: demoStyle.id,
          size: norm.size,
          materialType: norm.materialType,
        },
      },
      update: {
        qtyPerPiece: norm.qtyPerPiece,
        unit: norm.unit,
        wastagePercent: norm.wastagePercent,
      },
      create: {
        styleId: demoStyle.id,
        size: norm.size,
        materialType: norm.materialType,
        qtyPerPiece: norm.qtyPerPiece,
        unit: norm.unit,
        wastagePercent: norm.wastagePercent,
      },
    });
  }

  console.log(`Seeded standard BOM norms for Style ${demoStyle.styleCode}.`);

  const lotsData = [
    {
      lotNo: 'LOT-DN12-IND-01',
      availableMeters: 1500,
      shrinkagePercent: 2.5,
    },
    {
      lotNo: 'LOT-DN12-IND-02',
      availableMeters: 300,
      shrinkagePercent: 2.8,
    },
  ];

  for (const lot of lotsData) {
    await prisma.fabricLot.upsert({
      where: { lotNo: lot.lotNo },
      update: {
        availableMeters: lot.availableMeters,
        shrinkagePercent: lot.shrinkagePercent,
      },
      create: {
        lotNo: lot.lotNo,
        fabricTypeId: demoFabricType.id,
        colorId: demoColorIndigo.id,
        availableMeters: lot.availableMeters,
        shrinkagePercent: lot.shrinkagePercent,
      },
    });
  }
  console.log('Seeded demo fabric lots for DN-12-RIGID / CLR-INDIGO.');
}
