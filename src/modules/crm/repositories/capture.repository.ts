import { prisma } from "@/lib/prisma";
import type { CreateCaptureFormInput, UpdateCaptureFormInput } from "../schemas/client.schema";

export async function findAllCaptureForms(activeOnly = false) {
  return prisma.leadCaptureForm.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function findCaptureFormBySlug(slug: string) {
  return prisma.leadCaptureForm.findUnique({ where: { slug } });
}

export async function findCaptureFormById(id: string) {
  return prisma.leadCaptureForm.findUnique({
    where: { id },
    include: { submissions: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
}

export async function createCaptureForm(data: CreateCaptureFormInput) {
  return prisma.leadCaptureForm.create({ data });
}

export async function updateCaptureForm(id: string, data: UpdateCaptureFormInput) {
  return prisma.leadCaptureForm.update({ where: { id }, data });
}

export async function deleteCaptureForm(id: string) {
  return prisma.leadCaptureForm.delete({ where: { id } });
}

export async function logSubmission(
  formId: string,
  submissionData: Record<string, unknown>,
  leadId: string | null,
  meta: { ipAddress?: string; userAgent?: string }
) {
  return prisma.leadCaptureSubmission.create({
    data: {
      formId,
      data: submissionData as never,
      leadId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
}
