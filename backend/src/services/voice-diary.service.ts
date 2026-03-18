import OpenAI, { toFile } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { uploadEncryptedFile } from './vault-storage.service.js';
import { recordEvent } from './index-engine.service.js';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

/**
 * Voice Diary — record, transcribe, encrypt, analyze.
 *
 * Flow:
 * 1. User records audio on device
 * 2. Audio sent to backend as base64
 * 3. Whisper transcribes (Bulgarian language)
 * 4. Audio encrypted with AES-256-GCM → stored in Vault as diary entry
 * 5. Claude analyzes transcript → summary, tags, mood
 * 6. Transcript + analysis stored, searchable via Vault
 * 7. User can ask AI questions about their diary
 */

interface VoiceDiaryResult {
  recordingId: string;
  vaultFileId: string;
  transcript: string;
  summary: string;
  tags: string[];
  mood: string;
}

/**
 * Process a voice diary entry end-to-end.
 */
export async function processVoiceEntry(
  userId: string,
  audioBase64: string,
  durationMs: number,
  mimeType = 'audio/m4a'
): Promise<VoiceDiaryResult> {
  // 1. Create recording record
  const { data: recording, error: recError } = await supabaseAdmin
    .from('voice_recordings')
    .insert({
      user_id: userId,
      duration_ms: durationMs,
      transcript_status: 'processing',
    })
    .select('id')
    .single();

  if (recError || !recording) throw new Error(`Failed to create recording: ${recError?.message}`);

  const recordingId = recording.id;

  try {
    // 2. Transcribe with Whisper
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const transcript = await transcribeAudio(audioBuffer, mimeType);

    // 3. Encrypt and store audio in Vault
    const today = new Date().toLocaleDateString('bg-BG', { day: '2-digit', month: 'long', year: 'numeric' });
    const title = `Дневник — ${today}`;

    const { fileId: vaultFileId } = await uploadEncryptedFile(userId, audioBuffer, {
      category: 'diary',
      title,
      originalName: `diary_${Date.now()}.m4a`,
      mimeType,
      metadata: { recording_id: recordingId, duration_ms: durationMs },
    });

    // 4. Analyze with Claude
    const analysis = await analyzeEntry(transcript);

    // 5. Update recording with results
    await supabaseAdmin
      .from('voice_recordings')
      .update({
        vault_file_id: vaultFileId,
        transcript,
        transcript_status: 'done',
        ai_summary: analysis.summary,
        ai_tags: analysis.tags,
        ai_mood: analysis.mood,
      })
      .eq('id', recordingId);

    // 6. Update vault file with OCR text (transcript acts as OCR)
    await supabaseAdmin
      .from('vault_files')
      .update({
        ocr_text: `${title}\n\n${transcript}\n\nРезюме: ${analysis.summary}\nТагове: ${analysis.tags.join(', ')}\nНастроение: ${analysis.mood}`,
        ocr_status: 'done',
      })
      .eq('id', vaultFileId);

    // 7. Index points for diary entry
    await recordEvent(userId, {
      eventName: 'file_archived',
      delta: 0.5,
      source: 'system',
      pillar: 'behavioral',
      weight: 1.5,
    });

    logger.info({ userId, recordingId, durationMs, transcriptLength: transcript.length }, 'Voice diary processed');

    return {
      recordingId,
      vaultFileId,
      transcript,
      summary: analysis.summary,
      tags: analysis.tags,
      mood: analysis.mood,
    };

  } catch (err) {
    await supabaseAdmin
      .from('voice_recordings')
      .update({ transcript_status: 'failed' })
      .eq('id', recordingId);

    logger.error({ userId, recordingId, err }, 'Voice diary processing failed');
    throw err;
  }
}

/**
 * Transcribe audio using OpenAI Whisper.
 * Supports Bulgarian language.
 */
async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('wav') ? 'wav'
    : mimeType.includes('webm') ? 'webm'
    : 'mp3';

  const file = await toFile(audioBuffer, `recording.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: 'bg',
    response_format: 'text',
  });

  return response as unknown as string;
}

/**
 * Analyze a diary transcript with Claude.
 * Returns: summary, tags, mood.
 */
async function analyzeEntry(transcript: string): Promise<{
  summary: string;
  tags: string[];
  mood: string;
}> {
  const response = await anthropic.messages.create({
    model: env.AI_MODEL,
    max_tokens: 1024,
    system: 'Ти анализираш дневникови записи на български. Отговори САМО с JSON.',
    messages: [{
      role: 'user',
      content: `Анализирай този дневников запис и върни JSON с точно тези полета:
- "summary": кратко резюме на български (1-2 изречения)
- "tags": масив от тагове на български (макс 5), напр. ["работа", "здраве", "семейство"]
- "mood": едно от: "положително", "неутрално", "отрицателно", "смесено"

Запис:
${transcript}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'Без резюме',
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
        mood: parsed.mood || 'неутрално',
      };
    }
  } catch {}

  return { summary: 'Без резюме', tags: [], mood: 'неутрално' };
}

/**
 * List voice diary entries for a user.
 */
export async function listEntries(userId: string, limit = 50): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('voice_recordings')
    .select('id, vault_file_id, duration_ms, transcript, transcript_status, ai_summary, ai_tags, ai_mood, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get a single diary entry.
 */
export async function getEntry(userId: string, recordingId: string): Promise<any> {
  const { data } = await supabaseAdmin
    .from('voice_recordings')
    .select('*')
    .eq('id', recordingId)
    .eq('user_id', userId)
    .single();

  if (!data) throw new Error('Entry not found');
  return data;
}

/**
 * Ask AI about diary entries.
 */
export async function askDiary(userId: string, question: string): Promise<string> {
  // Get recent diary entries for context
  const { data: entries } = await supabaseAdmin
    .from('voice_recordings')
    .select('transcript, ai_summary, ai_tags, ai_mood, created_at')
    .eq('user_id', userId)
    .eq('transcript_status', 'done')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!entries || entries.length === 0) {
    return 'Нямаш записи в дневника все още. Натисни микрофона за да запишеш първия си.';
  }

  const context = entries.map((e: any, i: number) => {
    const date = new Date(e.created_at).toLocaleDateString('bg-BG');
    return `[${date}] ${e.ai_summary || e.transcript?.slice(0, 200) || ''}`;
  }).join('\n');

  const response = await anthropic.messages.create({
    model: env.AI_MODEL,
    max_tokens: 1024,
    system: `Ти си HOX AI и отговаряш на въпроси за дневника на потребителя. Отговаряй на БЪЛГАРСКИ. Бъди кратък и полезен. Базирай се САМО на предоставения контекст.`,
    messages: [{
      role: 'user',
      content: `Дневникови записи:\n${context}\n\nВъпрос: ${question}`,
    }],
  });

  return response.content[0].type === 'text' ? response.content[0].text : 'Не успях да отговоря.';
}
