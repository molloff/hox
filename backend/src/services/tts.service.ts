import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

/**
 * Generate speech audio from text using OpenAI TTS.
 * Returns raw audio buffer (mp3).
 */
export async function synthesizeSpeech(
  text: string,
  voice: TtsVoice = 'nova',
  speed = 1.0
): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
    speed,
    response_format: 'mp3',
  });

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  logger.info({ textLength: text.length, voice, audioSize: buffer.length }, 'TTS generated');
  return buffer;
}

/**
 * Generate speech for an AI diary response.
 * Splits long text into chunks if needed (TTS has a 4096 char limit).
 */
export async function synthesizeDiaryResponse(
  text: string,
  voice: TtsVoice = 'nova'
): Promise<Buffer> {
  const MAX_CHARS = 4096;

  if (text.length <= MAX_CHARS) {
    return synthesizeSpeech(text, voice);
  }

  // Split by sentences, keeping under limit
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > MAX_CHARS) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current.trim());

  // Generate audio for each chunk and concatenate
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const audio = await synthesizeSpeech(chunk, voice);
    buffers.push(audio);
  }

  return Buffer.concat(buffers);
}
