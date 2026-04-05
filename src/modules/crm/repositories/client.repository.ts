import { prisma } from "@/lib/prisma";
import type { CreateClientInput, UpdateClientInput, ClientFiltersInput } from "../schemas/client.schema";
import type { PaginatedResult, Client } from "../types";

function buildWhereClause(filters: Partial<ClientFiltersInput>) {
  const where: Record<string, unknown> = {};
  if (filters.assignedTo) where.assignedTo = filters.assignedTo;
  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { firstName: { contains: s, mode: "insensitive" } },
      { lastName: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { company: { contains: s, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function findClients(
  filters: ClientFiltersInput
): Promise<PaginatedResult<Client>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const where = buildWhereClause(filters);
  const skip = (page - 1) * pageSize;

  const [data, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: pageSize,
      include: { _count: { select: { leads: true } } },
    }),
    prisma.client.count({ where }),
  ]);

  return {
    data: data as Client[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      leads: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function findClientByEmail(email: string) {
  return prisma.client.findUnique({ where: { email } });
}

export async function createClient(data: CreateClientInput) {
  return prisma.client.create({ data });
}

export async function updateClient(id: string, data: UpdateClientInput) {
  return prisma.client.update({ where: { id }, data });
}

export async function deleteClient(id: string) {
  return prisma.client.delete({ where: { id } });
}
