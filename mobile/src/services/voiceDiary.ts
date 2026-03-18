import api from './api';

export interface DiaryEntry {
  id: string;
  vault_file_id: string | null;
  duration_ms: number;
  transcript: string | null;
  transcript_status: string;
  ai_summary: string | null;
  ai_tags: string[];
  ai_mood: string | null;
  created_at: string;
}

export interface VoiceResult {
  recordingId: string;
  vaultFileId: string;
  transcript: string;
  summary: string;
  tags: string[];
  mood: string;
}

export async function uploadVoiceEntry(
  audioBase64: string,
  durationMs: number,
  mimeType = 'audio/m4a'
): Promise<VoiceResult> {
  const { data } = await api.post('/diary/voice', { audioBase64, durationMs, mimeType });
  return data;
}

export async function listEntries(limit = 50): Promise<DiaryEntry[]> {
  const { data } = await api.get('/diary/entries', { params: { limit } });
  return data.entries;
}

export async function getEntry(id: string): Promise<DiaryEntry> {
  const { data } = await api.get(`/diary/entries/${id}`);
  return data;
}

export async function askDiary(question: string): Promise<string> {
  const { data } = await api.post('/diary/ask', { question });
  return data.answer;
}
