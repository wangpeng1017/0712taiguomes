import { prisma } from "@/lib/db";

export async function getMasterData() {
  const [skus, materials, equipments, defectReasons] = await Promise.all([
    prisma.productSku.findMany({ orderBy: { code: "asc" } }),
    prisma.materialMaster.findMany({ orderBy: { code: "asc" } }),
    prisma.equipmentMaster.findMany({ orderBy: { code: "asc" } }),
    prisma.defectReason.findMany({ orderBy: [{ appliesTo: "asc" }, { reason: "asc" }] }),
  ]);
  return { skus, materials, equipments, defectReasons };
}
