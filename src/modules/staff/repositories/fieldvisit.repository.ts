import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CreateFieldVisitInput,
  AddWaypointInput,
  FieldVisitFiltersInput,
} from "../schemas/fieldvisit.schema";
import { toDateOnly } from "./attendance.repository";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaypointEntry = {
  lat:       number;
  lng:       number;
  timestamp: string; // ISO string
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findFieldVisits(filters: FieldVisitFiltersInput) {
  const { page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.FieldVisitWhereInput = {};
  if (filters.staffId) where.staffId = filters.staffId;
  if (filters.status)  where.status  = filters.status;
  if (filters.date) {
    where.date = toDateOnly(new Date(filters.date));
  }

  const [data, total] = await Promise.all([
    prisma.fieldVisit.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
      include: {
        staff: { select: { firstName: true, lastName: true, department: true } },
      },
    }),
    prisma.fieldVisit.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findFieldVisitById(id: string) {
  return prisma.fieldVisit.findUnique({
    where: { id },
    include: {
      staff: { select: { firstName: true, lastName: true, department: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createFieldVisit(input: CreateFieldVisitInput) {
  const date = input.date ? toDateOnly(new Date(input.date)) : toDateOnly();
  return prisma.fieldVisit.create({
    data: {
      staffId:    input.staffId,
      date,
      clientName: input.clientName,
      purpose:    input.purpose,
      notes:      input.notes,
      gpsRoute:   [],
    },
    include: {
      staff: { select: { firstName: true, lastName: true, department: true } },
    },
  });
}

export async function addWaypoint(id: string, input: AddWaypointInput) {
  const visit = await prisma.fieldVisit.findUnique({ where: { id } });
  if (!visit) throw new Error("Field visit not found");

  const existing = (visit.gpsRoute as WaypointEntry[]) ?? [];
  const newEntry: WaypointEntry = {
    lat:       input.latitude,
    lng:       input.longitude,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
  const updated = [...existing, newEntry];

  // Rough cumulative distance (Haversine between consecutive points)
  let distanceMeters = 0;
  for (let i = 1; i < updated.length; i++) {
    distanceMeters += haversineMeters(
      updated[i - 1].lat, updated[i - 1].lng,
      updated[i].lat,     updated[i].lng
    );
  }

  return prisma.fieldVisit.update({
    where: { id },
    data: {
      gpsRoute:   updated,
      distanceKm: distanceMeters / 1000,
      status:     visit.status === "PENDING" || visit.status === "APPROVED"
        ? "IN_PROGRESS"
        : visit.status,
    },
  });
}

export async function reviewFieldVisit(
  id: string,
  action: "approve" | "reject",
  reviewerId: string,
  reviewNote?: string
) {
  const now = new Date();
  return prisma.fieldVisit.update({
    where: { id },
    data:
      action === "approve"
        ? { status: "APPROVED", approvedBy: reviewerId, approvedAt: now, reviewNote }
        : { status: "REJECTED", rejectedBy: reviewerId, rejectedAt: now, reviewNote },
    include: {
      staff: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function completeFieldVisit(id: string) {
  return prisma.fieldVisit.update({
    where: { id },
    data: { status: "COMPLETED" },
  });
}

// ---------------------------------------------------------------------------
// Haversine (server-side, no DOM dependency)
// ---------------------------------------------------------------------------

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
