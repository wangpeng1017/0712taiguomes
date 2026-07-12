"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function registerMoldMaintenance(input: {
  moldId: string;
  maintType: string;
  startTime: string;
  endTime: string;
  person: string;
  content?: string;
  replacedParts?: string;
  result?: string;
  canContinue: boolean;
}) {
  const mold = await prisma.moldMaster.findUniqueOrThrow({ where: { id: input.moldId } });

  await prisma.$transaction([
    prisma.moldMaintenanceRecord.create({
      data: {
        moldId: input.moldId,
        maintType: input.maintType,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        person: input.person,
        content: input.content,
        replacedParts: input.replacedParts,
        result: input.result,
        canContinue: input.canContinue,
      },
    }),
    prisma.moldMaster.update({
      where: { id: input.moldId },
      data: input.canContinue
        ? { status: "可用", lastMaintDate: new Date(input.endTime), lastMaintCount: mold.currentCount }
        : { status: "维修中" },
    }),
  ]);

  revalidatePath("/molds");
  revalidatePath("/injection");
  revalidatePath("/stamping");
  revalidatePath("/dashboard");
  revalidatePath("/work-orders");
}
