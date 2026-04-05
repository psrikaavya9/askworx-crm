import * as captureRepo from "../repositories/capture.repository";
import * as leadRepo from "../repositories/lead.repository";
import type { CreateCaptureFormInput, UpdateCaptureFormInput } from "../schemas/client.schema";
import type { FormFieldDefinition, LeadSource, PipelineStage } from "../types";
import type { CreateLeadInput } from "../schemas/lead.schema";

export async function getCaptureForms(activeOnly = false) {
  return captureRepo.findAllCaptureForms(activeOnly);
}

export async function getCaptureFormById(id: string) {
  const form = await captureRepo.findCaptureFormById(id);
  if (!form) throw new Error(`Capture form not found: ${id}`);
  return form;
}

export async function createCaptureForm(data: CreateCaptureFormInput) {
  const existing = await captureRepo.findCaptureFormBySlug(data.slug);
  if (existing) throw new Error(`A form with slug "${data.slug}" already exists.`);
  return captureRepo.createCaptureForm(data);
}

export async function updateCaptureForm(id: string, data: UpdateCaptureFormInput) {
  await getCaptureFormById(id);
  return captureRepo.updateCaptureForm(id, data);
}

export async function deleteCaptureForm(id: string) {
  await getCaptureFormById(id);
  return captureRepo.deleteCaptureForm(id);
}

/**
 * Handle a public form submission.
 * Validates required fields, maps to Lead fields, creates the lead, and logs the submission.
 */
export async function handleSubmission(
  slug: string,
  body: Record<string, unknown>,
  meta: { ipAddress?: string; userAgent?: string }
) {
  const form = await captureRepo.findCaptureFormBySlug(slug);
  if (!form || !form.isActive) throw new Error("Form not found or inactive.");

  const fields = form.fields as unknown as FormFieldDefinition[];

  // Validate required fields
  const missing = fields
    .filter((f) => f.required && !body[f.name])
    .map((f) => f.label);
  if (missing.length > 0)
    throw new Error(`Missing required fields: ${missing.join(", ")}`);

  // Map submission to Lead fields
  const leadData: CreateLeadInput = {
    firstName: String(body["firstName"] ?? body["first_name"] ?? ""),
    lastName: String(body["lastName"] ?? body["last_name"] ?? ""),
    email: String(body["email"] ?? ""),
    phone: body["phone"] ? String(body["phone"]) : undefined,
    company: body["company"] ? String(body["company"]) : undefined,
    source: form.defaultSource as LeadSource,
    stage: form.defaultStage as PipelineStage,
    assignedTo: form.assignedTo ?? undefined,
    priority: "MEDIUM",
    currency: "USD",
    tags: [],
  };

  if (!leadData.firstName || !leadData.lastName || !leadData.email)
    throw new Error("firstName, lastName, and email are required.");

  // Create lead (or skip if duplicate email)
  let leadId: string | null = null;
  try {
    const existing = await leadRepo.findLeadByEmail(leadData.email);
    if (!existing) {
      const lead = await leadRepo.createLead(leadData);
      leadId = lead.id;
    } else {
      leadId = existing.id;
    }
  } catch {
    // Log submission even if lead creation fails
  }

  await captureRepo.logSubmission(form.id, body, leadId, meta);

  return { success: true, leadId, redirectUrl: form.redirectUrl, thankYouMsg: form.thankYouMsg };
}
