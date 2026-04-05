import * as staffRepo from "../repositories/staff.repository";
import type { CreateStaffInput, UpdateStaffInput, StaffFiltersInput } from "../schemas/staff.schema";

// ---------------------------------------------------------------------------
// Staff CRUD
// ---------------------------------------------------------------------------

export async function getAllStaff(filters: StaffFiltersInput) {
  return staffRepo.findStaff(filters);
}

export async function getStaffById(id: string) {
  const staff = await staffRepo.findStaffById(id);
  if (!staff) throw new Error(`Staff member not found: ${id}`);
  return staff;
}

export async function createStaff(data: CreateStaffInput) {
  const existing = await staffRepo.findStaffByEmail(data.email);
  if (existing) throw new Error(`A staff member with email "${data.email}" already exists.`);
  return staffRepo.createStaff(data);
}

export async function updateStaff(id: string, data: UpdateStaffInput) {
  await getStaffById(id);

  if (data.email) {
    const conflict = await staffRepo.findStaffByEmail(data.email);
    if (conflict && conflict.id !== id) {
      throw new Error(`Email "${data.email}" is already used by another staff member.`);
    }
  }

  return staffRepo.updateStaff(id, data);
}

export async function deactivateStaff(id: string) {
  await getStaffById(id);
  return staffRepo.updateStaff(id, { status: "INACTIVE" });
}

export async function deleteStaff(id: string) {
  await getStaffById(id);
  return staffRepo.deleteStaff(id);
}

export async function getAllActiveStaff() {
  return staffRepo.findAllActiveStaff();
}
