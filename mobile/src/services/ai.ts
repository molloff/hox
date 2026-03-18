import api from './api';

export interface AiConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls: string[];
  created_at: string;
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  toolsUsed: string[];
}

export async function sendMessage(message: string, conversationId?: string): Promise<ChatResponse> {
  const { data } = await api.post('/ai/chat', { message, conversationId });
  return data;
}

export async function quickAction(prompt: string): Promise<string> {
  const { data } = await api.post('/ai/quick', { prompt });
  return data.response;
}

export async function listConversations(): Promise<AiConversation[]> {
  const { data } = await api.get('/ai/conversations');
  return data.conversations;
}

export async function getMessages(conversationId: string): Promise<AiMessage[]> {
  const { data } = await api.get(`/ai/conversations/${conversationId}/messages`);
  return data.messages;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await api.delete(`/ai/conversations/${conversationId}`);
}
