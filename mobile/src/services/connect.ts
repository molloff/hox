import api from './api';

export interface SearchProfile {
  user_id: string;
  display_name: string | null;
  skills: string[];
  description: string;
  profile_type: string | null;
  hox_score: number;
  is_verified: boolean;
}

export interface Conversation {
  conversation: {
    id: string;
    last_message_at: string | null;
    created_at: string;
  };
  otherUser: SearchProfile;
  lastMessage?: {
    ciphertext: string;
    created_at: string;
    sender_id: string;
  };
}

export interface Message {
  id: string;
  sender_id: string;
  ciphertext: string;
  nonce: string;
  message_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function searchUsers(query: string, limit = 20): Promise<SearchProfile[]> {
  const { data } = await api.get('/connect/search', { params: { q: query, limit } });
  return data.results;
}

export async function getPublicProfile(userId: string): Promise<SearchProfile> {
  const { data } = await api.get(`/connect/profile/${userId}`);
  return data;
}

export async function listConversations(): Promise<Conversation[]> {
  const { data } = await api.get('/connect/conversations');
  return data.conversations;
}

export async function createConversation(userId: string): Promise<string> {
  const { data } = await api.post('/connect/conversations', { userId });
  return data.conversationId;
}

export async function getMessages(conversationId: string, limit = 50, before?: string): Promise<Message[]> {
  const { data } = await api.get(`/connect/conversations/${conversationId}/messages`, {
    params: { limit, before },
  });
  return data.messages;
}

export async function sendMessage(
  conversationId: string,
  ciphertext: string,
  nonce: string,
  messageType = 'text'
): Promise<string> {
  const { data } = await api.post(`/connect/conversations/${conversationId}/messages`, {
    ciphertext, nonce, messageType,
  });
  return data.messageId;
}

export async function uploadKeyBundle(bundle: {
  identityKey: string;
  signedPrekey: string;
  signedPrekeySig: string;
  prekeyId: number;
}): Promise<void> {
  await api.post('/connect/keys/bundle', bundle);
}

export async function fetchKeyBundle(userId: string) {
  const { data } = await api.get(`/connect/keys/${userId}`);
  return data;
}
