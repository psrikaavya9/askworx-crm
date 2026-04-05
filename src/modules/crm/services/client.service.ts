import * as clientRepo from "../repositories/client.repository";
import type { CreateClientInput, UpdateClientInput, ClientFiltersInput } from "../schemas/client.schema";

export async function getClients(filters: ClientFiltersInput) {
  return clientRepo.findClients(filters);
}

export async function getClientById(id: string) {
  const client = await clientRepo.findClientById(id);
  if (!client) throw new Error(`Client not found: ${id}`);
  return client;
}

export async function createClient(data: CreateClientInput) {
  const existing = await clientRepo.findClientByEmail(data.email);
  if (existing) throw new Error(`A client with email "${data.email}" already exists.`);
  return clientRepo.createClient(data);
}

export async function updateClient(id: string, data: UpdateClientInput) {
  await getClientById(id);
  if (data.email) {
    const existing = await clientRepo.findClientByEmail(data.email);
    if (existing && existing.id !== id)
      throw new Error(`Email "${data.email}" is already in use.`);
  }
  return clientRepo.updateClient(id, data);
}

export async function deleteClient(id: string) {
  await getClientById(id);
  return clientRepo.deleteClient(id);
}
