import * as repo from "../repositories/pipeline-template.repository";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateStageInput,
  UpdateStageConfigInput,
  ReorderStagesInput,
  AssignPipelineInput,
  MoveStageInput,
} from "../schemas/pipeline-template.schema";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function listTemplates(activeOnly = false) {
  return repo.findTemplates(activeOnly);
}

export async function getTemplate(id: string) {
  const t = await repo.findTemplateById(id);
  if (!t) throw new Error(`Pipeline template not found: ${id}`);
  return t;
}

export async function createTemplate(data: CreateTemplateInput) {
  return repo.createTemplate(data);
}

export async function updateTemplate(id: string, data: UpdateTemplateInput) {
  await getTemplate(id);
  return repo.updateTemplate(id, data);
}

export async function deactivateTemplate(id: string) {
  await getTemplate(id);
  return repo.deleteTemplate(id);
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export async function addStage(templateId: string, data: CreateStageInput) {
  await getTemplate(templateId);

  // Guard: order must not already exist in this template
  const existing = (await getTemplate(templateId)).stages;
  const orderTaken = existing.some((s) => s.order === data.order);
  if (orderTaken) {
    // Shift all stages at or above data.order up by 1
    await repo.reorderStages(templateId, {
      stages: existing
        .filter((s) => s.order >= data.order)
        .map((s) => ({ id: s.id, order: s.order + 1 })),
    });
  }

  return repo.addStage(templateId, data);
}

export async function updateStage(
  templateId: string,
  stageId: string,
  data: UpdateStageConfigInput
) {
  const template = await getTemplate(templateId);
  const stage = template.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`Stage ${stageId} not found in template ${templateId}`);
  return repo.updateStageConfig(stageId, data);
}

export async function deleteStage(templateId: string, stageId: string) {
  const template = await getTemplate(templateId);
  const stage = template.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`Stage ${stageId} not found in template ${templateId}`);
  return repo.deleteStageConfig(stageId);
}

export async function reorderStages(templateId: string, input: ReorderStagesInput) {
  await getTemplate(templateId);
  return repo.reorderStages(templateId, input);
}

// ---------------------------------------------------------------------------
// Lead pipeline
// ---------------------------------------------------------------------------

export async function assignPipeline(leadId: string, input: AssignPipelineInput) {
  return repo.assignPipeline(leadId, input);
}

export async function getLeadPipeline(leadId: string) {
  return repo.findLeadPipeline(leadId);
}

export async function moveStage(leadId: string, input: MoveStageInput) {
  const lp = await repo.findLeadPipeline(leadId);
  if (!lp) throw new Error(`Lead ${leadId} has no pipeline assigned`);
  return repo.moveLeadStage(leadId, input);
}

// ---------------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------------

export async function getKanban(templateId: string) {
  await getTemplate(templateId); // validates existence
  return repo.getKanbanView(templateId);
}
