import { supabaseAdmin } from '../config/supabase.js';
import { listBills } from './bills.service.js';
import { listObligations } from './obligations.service.js';
import { listVaultFiles } from './vault-storage.service.js';
import { fullTextSearch } from './vault-search.service.js';
import { computeScore } from './index-engine.service.js';
import { listDeals } from './deal.service.js';
import { checkExpiringDocuments } from './reminders.service.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';

/**
 * HOX AI Tools — functions the AI can call to access user data.
 *
 * The AI NEVER sees raw sensitive data (EGN, encryption keys).
 * It only sees summaries, totals, and non-PII metadata.
 */

// Tool definitions for Claude
export const AI_TOOLS: Tool[] = [
  {
    name: 'get_bills_summary',
    description: 'Вземи списък на сметките на потребителя — ток, вода, парно, интернет. Включва статус (платена/неплатена/просрочена), сума, доставчик и светофар.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status_filter: {
          type: 'string',
          enum: ['all', 'unpaid', 'overdue', 'paid'],
          description: 'Филтър по статус',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_obligations_summary',
    description: 'Вземи списък на държавните задължения — НАП данъци, КАТ глоби, осигуровки, общински данъци. Включва тип, сума, срок.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_hox_score',
    description: 'Вземи HOX Index Score на потребителя — общ процент, разбивка по стълбове (финансов, поведенчески, физически, граждански), брой събития.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_vault',
    description: 'Търси в документите на потребителя във Vault — по ключови думи в OCR текста. Например: "договор 2024", "гаранция хладилник", "кръвна група".',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Текст за търсене',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_vault_files',
    description: 'Покажи файловете във Vault по категория — документи, бележки, гаранции, здраве, деца, любимци, дневник, договори, сертификати.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          enum: ['documents', 'receipts', 'warranties', 'health', 'children', 'pets', 'diary', 'contracts', 'certificates'],
          description: 'Категория',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_deals_summary',
    description: 'Вземи списък на сделките — активни, завършени, чакащи подпис. Включва шаблон, сума, статус.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status_filter: {
          type: 'string',
          enum: ['all', 'active', 'completed'],
          description: 'Филтър по статус',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_expiring_documents',
    description: 'Покажи документи с наближаващ срок на изтичане — лични карти, паспорти, гаранции, застраховки, договори.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_financial_overview',
    description: 'Вземи пълен финансов преглед — общо дължимо, просрочени сметки, задължения, предстоящи плащания, HOX Score.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_diary',
    description: 'Търси в дневника на потребителя — гласови или текстови записи във Vault категория "diary".',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Текст за търсене в дневника',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Execute an AI tool call and return the result.
 */
export async function executeTool(
  userId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_bills_summary':
        return await getBillsSummary(userId, input.status_filter as string);
      case 'get_obligations_summary':
        return await getObligationsSummary(userId);
      case 'get_hox_score':
        return await getHoxScore(userId);
      case 'search_vault':
        return await searchVault(userId, input.query as string);
      case 'list_vault_files':
        return await getVaultFiles(userId, input.category as string);
      case 'get_deals_summary':
        return await getDealsSummary(userId, input.status_filter as string);
      case 'get_expiring_documents':
        return await getExpiringDocs(userId);
      case 'get_financial_overview':
        return await getFinancialOverview(userId);
      case 'search_diary':
        return await searchDiary(userId, input.query as string);
      default:
        return JSON.stringify({ error: 'Unknown tool' });
    }
  } catch (err) {
    logger.error({ userId, toolName, err }, 'AI tool execution failed');
    return JSON.stringify({ error: 'Tool execution failed' });
  }
}

async function getBillsSummary(userId: string, filter?: string): Promise<string> {
  let bills = await listBills(userId);
  if (filter === 'unpaid') bills = bills.filter((b: any) => b.status !== 'paid');
  else if (filter === 'overdue') bills = bills.filter((b: any) => b.traffic_light?.color === 'red');
  else if (filter === 'paid') bills = bills.filter((b: any) => b.status === 'paid');

  const summary = bills.map((b: any) => ({
    provider: b.provider,
    title: b.title,
    amount: `${b.amount} ${b.currency}`,
    status: b.status,
    due_date: b.due_date,
    traffic_light: b.traffic_light?.color,
    days_left: b.traffic_light?.daysLeft,
  }));

  const total = bills.filter((b: any) => b.status !== 'paid').reduce((s: number, b: any) => s + parseFloat(b.amount), 0);

  return JSON.stringify({
    count: bills.length,
    total_unpaid: `${total.toFixed(2)} BGN`,
    bills: summary,
  });
}

async function getObligationsSummary(userId: string): Promise<string> {
  const obligations = await listObligations(userId);

  const summary = obligations.map((o: any) => ({
    type: o.type,
    title: o.title,
    amount: `${o.amount} ${o.currency}`,
    status: o.status,
    due_date: o.due_date,
    source: o.source,
  }));

  const totalUnpaid = obligations
    .filter((o: any) => o.status !== 'paid')
    .reduce((s: number, o: any) => s + parseFloat(o.amount), 0);

  return JSON.stringify({
    count: obligations.length,
    total_unpaid: `${totalUnpaid.toFixed(2)} BGN`,
    obligations: summary,
  });
}

async function getHoxScore(userId: string): Promise<string> {
  const score = await computeScore(userId);
  return JSON.stringify({
    percentage: `${score.percentage}%`,
    total_points: score.total,
    event_count: score.eventCount,
    pillars: score.pillars.map((p) => ({
      name: p.pillar,
      weight: `${(p.weight * 100).toFixed(0)}%`,
      score: p.weightedScore.toFixed(1),
    })),
  });
}

async function searchVault(userId: string, query: string): Promise<string> {
  const results = await fullTextSearch(userId, query, 10);
  return JSON.stringify({
    count: results.length,
    results: results.map((r: any) => ({
      title: r.title,
      category: r.category,
      ocr_excerpt: r.ocr_text?.slice(0, 200),
      created_at: r.created_at,
    })),
  });
}

async function getVaultFiles(userId: string, category?: string): Promise<string> {
  const files = await listVaultFiles(userId, category as any);
  return JSON.stringify({
    count: files.length,
    files: files.map((f: any) => ({
      title: f.title,
      category: f.category,
      size: f.size_bytes,
      ocr_status: f.ocr_status,
      expires_at: f.expires_at,
      created_at: f.created_at,
    })),
  });
}

async function getDealsSummary(userId: string, filter?: string): Promise<string> {
  let deals = await listDeals(userId);
  if (filter === 'active') deals = deals.filter((d) => !['completed', 'cancelled', 'refunded'].includes(d.status));
  else if (filter === 'completed') deals = deals.filter((d) => d.status === 'completed');

  return JSON.stringify({
    count: deals.length,
    deals: deals.map((d) => ({
      title: d.title,
      template: d.template,
      amount: d.amount ? `${d.amount} ${d.currency}` : null,
      status: d.status,
      signature_type: d.signature_type,
      created_at: d.created_at,
    })),
  });
}

async function getExpiringDocs(userId: string): Promise<string> {
  const all = await checkExpiringDocuments();
  const userDocs = all.filter((d) => d.userId === userId);
  return JSON.stringify({
    count: userDocs.length,
    documents: userDocs.map((d) => ({
      title: d.title,
      days_left: d.daysLeft,
      file_id: d.fileId,
    })),
  });
}

async function getFinancialOverview(userId: string): Promise<string> {
  const [bills, obligations, score] = await Promise.all([
    listBills(userId),
    listObligations(userId),
    computeScore(userId),
  ]);

  const unpaidBills = bills.filter((b: any) => b.status !== 'paid');
  const overdueBills = unpaidBills.filter((b: any) => b.traffic_light?.color === 'red');
  const unpaidObligations = obligations.filter((o: any) => o.status !== 'paid');

  const totalBills = unpaidBills.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
  const totalObligations = unpaidObligations.reduce((s: number, o: any) => s + parseFloat(o.amount), 0);

  return JSON.stringify({
    total_due: `${(totalBills + totalObligations).toFixed(2)} BGN`,
    unpaid_bills: unpaidBills.length,
    overdue_bills: overdueBills.length,
    unpaid_obligations: unpaidObligations.length,
    hox_score: `${score.percentage}%`,
    next_due: unpaidBills[0] ? {
      title: unpaidBills[0].title,
      amount: `${unpaidBills[0].amount} ${unpaidBills[0].currency}`,
      due_date: unpaidBills[0].due_date,
    } : null,
  });
}

async function searchDiary(userId: string, query: string): Promise<string> {
  // Search vault files in diary category
  const { data } = await supabaseAdmin
    .from('vault_files')
    .select('id, title, ocr_text, created_at')
    .eq('user_id', userId)
    .eq('category', 'diary')
    .textSearch('ocr_text', query, { type: 'websearch' })
    .limit(10);

  return JSON.stringify({
    count: (data || []).length,
    entries: (data || []).map((d: any) => ({
      title: d.title,
      excerpt: d.ocr_text?.slice(0, 300),
      created_at: d.created_at,
    })),
  });
}
