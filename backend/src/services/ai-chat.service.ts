import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AI_TOOLS, executeTool } from './ai-tools.service.js';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Ти си HOX AI — личен асистент в приложението HOX, българска платформа за доверие и финанси.

Твоята роля:
- Помагаш на потребителя да управлява финансите си (сметки, задължения, данъци)
- Търсиш и обясняваш документи от Vault (криптирано хранилище)
- Даваш съвети за подобряване на HOX Index Score
- Помагаш при сделки и договори
- Четеш дневника и отговаряш на въпроси
- Напомняш за изтичащи документи, лични карти, гаранции

Правила:
- ВИНАГИ отговаряй на БЪЛГАРСКИ език
- Бъди кратък и полезен — потребителят е на телефона си
- Използвай инструментите си за да вземеш реални данни преди да отговориш
- НИКОГА не измисляй данни — ако нямаш информация, кажи го
- НИКОГА не споменавай ЕГН, лични номера или криптографски ключове
- Форматирай сумите с "лв" (BGN)
- При финансови въпроси, винаги провери текущите сметки и задължения
- Когато потребителят пита за Score, обясни какво може да направи за да го подобри

Контекст за HOX модулите:
- Pay: сметки за ток/вода/парно/интернет + държавни задължения (НАП, КАТ, община)
- Vault: криптирано хранилище за документи с OCR и търсене
- Deal: сделки с escrow и електронен подпис (обикновен или КЕП)
- Index: HOX Score = доверие, базирано на финансова дисциплина
- Connect: чат + marketplace за услуги, наредени по Score`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResult {
  response: string;
  conversationId: string;
  toolsUsed: string[];
  tokensUsed: number;
}

/**
 * Create a new AI conversation.
 */
export async function createConversation(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('ai_conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`);
  return data.id;
}

/**
 * Send a message to HOX AI and get a response.
 * Supports multi-turn conversation with tool use.
 */
export async function chat(
  userId: string,
  conversationId: string,
  userMessage: string
): Promise<ChatResult> {
  // Get conversation history
  const { data: history } = await supabaseAdmin
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  const messages: Anthropic.MessageParam[] = (history || []).map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Add new user message
  messages.push({ role: 'user', content: userMessage });

  // Store user message
  await supabaseAdmin.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
  });

  // Call Claude with tools
  const toolsUsed: string[] = [];
  let totalTokens = 0;
  let finalResponse = '';

  try {
    let response = await anthropic.messages.create({
      model: env.AI_MODEL,
      max_tokens: env.AI_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: AI_TOOLS,
      messages,
    });

    totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Tool use loop — keep calling tools until we get a final text response
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);
        logger.info({ userId, tool: toolUse.name, input: toolUse.input }, 'AI tool call');

        const result = await executeTool(userId, toolUse.name, toolUse.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });

        // Log action
        await supabaseAdmin.from('ai_actions').insert({
          user_id: userId,
          conversation_id: conversationId,
          action_type: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
          output: { result_length: result.length },
        });
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: env.AI_MODEL,
        max_tokens: env.AI_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: AI_TOOLS,
        messages,
      });

      totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    }

    // Extract final text
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
    finalResponse = textBlocks.map((b) => b.text).join('\n');

  } catch (err) {
    logger.error({ userId, err }, 'AI chat failed');
    finalResponse = 'Съжалявам, възникна грешка. Опитай отново.';
  }

  // Store assistant response
  await supabaseAdmin.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: finalResponse,
    tool_calls: toolsUsed,
    tokens_used: totalTokens,
  });

  // Update conversation title from first message
  if ((history || []).length === 0) {
    const title = userMessage.slice(0, 100);
    await supabaseAdmin
      .from('ai_conversations')
      .update({ title })
      .eq('id', conversationId);
  }

  return {
    response: finalResponse,
    conversationId,
    toolsUsed,
    tokensUsed: totalTokens,
  };
}

/**
 * List conversations for a user.
 */
export async function listConversations(userId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('ai_conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  return data || [];
}

/**
 * Get conversation messages.
 */
export async function getConversationMessages(conversationId: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('ai_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  await supabaseAdmin
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);
}

/**
 * Quick AI action — single question, no conversation history.
 * Used for inline AI features (e.g., Vault search, bill explanation).
 */
export async function quickAction(
  userId: string,
  prompt: string
): Promise<string> {
  const convId = await createConversation(userId);
  const result = await chat(userId, convId, prompt);
  return result.response;
}
