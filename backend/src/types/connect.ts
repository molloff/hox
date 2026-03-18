export interface ConversationRow {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  nonce: string;
  message_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KeyBundle {
  user_id: string;
  identity_key: string;
  signed_prekey: string;
  signed_prekey_sig: string;
  prekey_id: number;
}

export interface SearchProfile {
  user_id: string;
  display_name: string | null;
  skills: string[];
  description: string;
  profile_type: string | null;
  hox_score: number;
  is_verified: boolean;
  location: string | null;
}

export interface ConversationWithProfile {
  conversation: ConversationRow;
  otherUser: SearchProfile;
  lastMessage?: {
    ciphertext: string;
    created_at: string;
    sender_id: string;
  };
}
