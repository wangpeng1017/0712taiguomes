"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { MAINT_TYPES } from "@/lib/constants";

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
  if (!(MAINT_TYPES as readonly string[]).includes(input.maintType)) throw new Error("无效的保养类型");
  if (!input.person.trim()) throw new Error("保养人员不能为空");
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime < startTime) throw new Error("保养结束时间不可早于开始时间");

  await prisma.$transaction([
    prisma.moldMaintenanceRecord.create({
      data: {
        moldId: input.moldId,
        maintType: input.maintType,
        startTime,
        endTime,
        person: input.person.trim(),
        content: input.content,
        replacedParts: input.replacedParts,
        result: input.result,
        canContinue: input.canContinue,
      },
    }),
    prisma.moldMaster.update({
      where: { id: input.moldId },
      data: input.canContinue
        ? { status: "可用", lastMaintDate: endTime, lastMaintCount: mold.currentCount }
        : { status: "维修中" },
    }),
  ]);

  revalidatePath("/molds");
  revalidatePath("/injection");
  revalidatePath("/stamping");
  revalidatePath("/dashboard");
  revalidatePath("/work-orders");
}
