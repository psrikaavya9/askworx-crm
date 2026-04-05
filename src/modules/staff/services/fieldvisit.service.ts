import * as repo from "../repositories/fieldvisit.repository";
import * as staffRepo from "../repositories/staff.repository";
import type {
  CreateFieldVisitInput,
  AddWaypointInput,
  FieldVisitFiltersInput,
  ReviewFieldVisitInput,
} from "../schemas/fieldvisit.schema";

export async function createFieldVisit(input: CreateFieldVisitInput) {
  const staff = await staffRepo.findStaffById(input.staffId);
  if (!staff) throw new Error(`Staff member not found: ${input.staffId}`);
  if (staff.status === "INACTIVE") throw new Error("Inactive staff cannot start a field visit.");
  return repo.createFieldVisit(input);
}

export async function listFieldVisits(filters: FieldVisitFiltersInput) {
  return repo.findFieldVisits(filters);
}

export async function getFieldVisit(id: string) {
  const visit = await repo.findFieldVisitById(id);
  if (!visit) throw new Error("Field visit not found");
  return visit;
}

export async function addWaypoint(id: string, input: AddWaypointInput) {
  const visit = await repo.findFieldVisitById(id);
  if (!visit) throw new Error("Field visit not found");
  if (visit.status === "REJECTED" || visit.status === "COMPLETED") {
    throw new Error(`Cannot add waypoint to a ${visit.status.toLowerCase()} field visit.`);
  }
  return repo.addWaypoint(id, input);
}

export async function reviewFieldVisit(id: string, input: ReviewFieldVisitInput) {
  const visit = await repo.findFieldVisitById(id);
  if (!visit) throw new Error("Field visit not found");
  if (visit.status !== "PENDING") {
    throw new Error(`Field visit is already ${visit.status.toLowerCase()}.`);
  }
  return repo.reviewFieldVisit(id, input.action, input.reviewerId, input.reviewNote);
}

export async function completeFieldVisit(id: string, staffId: string) {
  const visit = await repo.findFieldVisitById(id);
  if (!visit) throw new Error("Field visit not found");
  if (visit.staffId !== staffId) throw new Error("Unauthorized: not your field visit.");
  if (visit.status !== "IN_PROGRESS" && visit.status !== "APPROVED") {
    throw new Error(`Cannot complete a ${visit.status.toLowerCase()} field visit.`);
  }
  return repo.completeFieldVisit(id);
}
