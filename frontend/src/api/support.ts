import api from './client';
import { getOrgId } from '../utils/org';

export interface TicketMessage {
  id: string;
  user: { id: string; email: string; first_name: string; last_name: string; full_name: string } | null;
  message: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  category: 'bug' | 'ui_feedback' | 'enhancement' | 'question' | 'other';
  resolution_notes: string;
  source: 'manual' | 'sentry';
  external_id: string;
  user: { id: string; email: string; first_name: string; last_name: string; full_name: string } | null;
  organization_name: string | null;
  messages: TicketMessage[];
  created_at: string;
  updated_at: string;
}

export async function getTickets(scope?: 'platform'): Promise<SupportTicket[]> {
  const orgId = getOrgId();
  const params = scope ? { scope } : {};
  const response = await api.get<SupportTicket[]>('/auth/support/tickets/', {
    params,
    headers: orgId ? { 'X-Organization': orgId } : {},
  });
  return response.data;
}

export async function getTicket(ticketId: string): Promise<SupportTicket> {
  const orgId = getOrgId();
  const response = await api.get<SupportTicket>(`/auth/support/tickets/${ticketId}/`, {
    headers: orgId ? { 'X-Organization': orgId } : {},
  });
  return response.data;
}

export async function createTicket(data: {
  subject: string;
  description: string;
  priority: string;
  category?: string;
}): Promise<SupportTicket> {
  const orgId = getOrgId();
  const response = await api.post<SupportTicket>('/auth/support/tickets/', data, {
    headers: orgId ? { 'X-Organization': orgId } : {},
  });
  return response.data;
}

export async function addTicketMessage(ticketId: string, message: string): Promise<TicketMessage> {
  const orgId = getOrgId();
  const response = await api.post<TicketMessage>(`/auth/support/tickets/${ticketId}/`, { message }, {
    headers: orgId ? { 'X-Organization': orgId } : {},
  });
  return response.data;
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<SupportTicket> {
  const orgId = getOrgId();
  const response = await api.patch<SupportTicket>(`/auth/support/tickets/${ticketId}/`, { status }, {
    headers: orgId ? { 'X-Organization': orgId } : {},
  });
  return response.data;
}

export async function updateTicket(
  ticketId: string,
  data: { status?: string; category?: string; resolution_notes?: string },
): Promise<SupportTicket> {
  const orgId = getOrgId();
  const response = await api.patch<SupportTicket>(`/auth/support/tickets/${ticketId}/`, data, {
    headers: orgId ? { 'X-Organization': orgId } : {},
  });
  return response.data;
}
