import { google } from 'googleapis';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { createBill } from './bills.service.js';
import { logger } from '../utils/logger.js';

/**
 * Gmail OAuth integration — scope=gmail.readonly
 * Only reads Subject + From + Amount from white-listed domains.
 * NEVER reads full email body or personal emails.
 *
 * White-list: ЧЕЗ, ЕВН, Енерго-Про, Виваком, A1, Yettel, Топлофикация, Софийска вода
 */

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  'postmessage' // redirect handled by mobile
);

/**
 * Generate OAuth consent URL for Gmail readonly access.
 */
export function getGmailAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent',
  });
}

/**
 * Exchange auth code for tokens and store refresh token.
 */
export async function exchangeGmailCode(userId: string, code: string): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);

  // Store refresh token (encrypted in practice)
  await supabaseAdmin
    .from('users')
    .update({
      metadata: { gmail_refresh_token: tokens.refresh_token },
    } as any)
    .eq('id', userId);

  logger.info({ userId }, 'Gmail OAuth connected');
}

/**
 * Scan recent emails for bills from white-listed providers.
 * Only extracts: From domain, Subject, Amount (via regex).
 */
export async function scanGmailForBills(userId: string): Promise<number> {
  // Get user's refresh token
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('metadata')
    .eq('id', userId)
    .single();

  const refreshToken = (user?.metadata as any)?.gmail_refresh_token;
  if (!refreshToken) return 0;

  // Get white-listed providers
  const { data: providers } = await supabaseAdmin
    .from('gmail_providers')
    .select('*');

  if (!providers || providers.length === 0) return 0;

  const domains = providers.map((p: any) => p.domain);

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Search for emails from white-listed domains in last 30 days
  const fromQuery = domains.map((d: string) => `from:${d}`).join(' OR ');
  const query = `(${fromQuery}) newer_than:30d`;

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50,
  });

  const messages = res.data.messages || [];
  let billsCreated = 0;

  for (const msg of messages) {
    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      });

      const headers = full.data.payload?.headers || [];
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

      // Match provider by domain
      const provider = providers.find((p: any) => from.includes(p.domain));
      if (!provider) continue;

      // Extract amount using provider-specific regex
      const amountMatch = subject.match(new RegExp(provider.amount_regex));
      if (!amountMatch) continue;

      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      if (isNaN(amount) || amount <= 0) continue;

      // Check if already tracked
      const { data: existing } = await supabaseAdmin
        .from('bills')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', provider.provider_name)
        .eq('amount', amount)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .single();

      if (existing) continue;

      await createBill(userId, {
        provider: provider.provider_name,
        title: `${provider.provider_name} — ${subject.slice(0, 100)}`,
        amount,
        source: 'gmail',
        merchantId: provider.merchant_id || undefined,
      });

      billsCreated++;
    } catch (err) {
      // Skip individual message errors
      continue;
    }
  }

  logger.info({ userId, scanned: messages.length, created: billsCreated }, 'Gmail scan complete');
  return billsCreated;
}
