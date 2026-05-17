/**
 * Telegram bot webhook handler.
 *
 * Handles incoming updates from Telegram for the @asdscsscbot.
 *
 * Flow:
 * 1. Webhook receives update from Telegram (POST /api/bot/webhook)
 * 2. We respond with 200 immediately (Telegram requires fast response)
 * 3. Processing happens asynchronously
 *
 * Incoming message handling:
 * - /start  → welcome message (from botTexts)
 * - /help   → help message
 * - SSN (XXX-XX-XXXX) → if in pending_ssn flow, inject SSN and resume job
 * - Free text with data → create a job (single mode, safe-test), return result
 */

import type { Request, Response } from "express";
import { ENV } from "./env";
import {
  createSingleJob,
  getBotTextTemplate,
  sendTelegramMessage,
  sendTelegramDocument,
} from "../platformService";
import { buildOneCsResult } from "../../shared/oneCsScoring";
import { parseImportedLeadText, toSafeImportedLeadRecord } from "../../shared/importedLeadFormat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    username?: string;
    first_name?: string;
  };
  date: number;
  text?: string;
  document?: {
    file_id: string;
    file_name?: string;
    mime_type: string;
    file_size: number;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: unknown;
  channel_post?: unknown;
}

// ---------------------------------------------------------------------------
// In-memory state for the bot FSM
// ---------------------------------------------------------------------------

/** Maps chat_id → job_public_id waiting for SSN input. */
const pendingSsnJobs = new Map<string, string>();

// ---------------------------------------------------------------------------
// SSN validation
// ---------------------------------------------------------------------------

const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;

function isSsnInput(text: string): boolean {
  return SSN_REGEX.test(text.trim());
}

// ---------------------------------------------------------------------------
// Bot token validation
// ---------------------------------------------------------------------------

function getBotToken(): string {
  return ENV.botToken?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

function buildWelcomeMessage(texts: { welcome: string | null }): string {
  return (
    texts.welcome ??
    "Добро пожаловать! Бот готов помочь с запросами кредитного скора. Отправьте данные в свободной форме."
  );
}

function buildHelpMessage(): string {
  return (
    "📋 <b>Справка</b>\n\n" +
    "Отправьте текст с данными (ФИО, адрес, телефон, email, DOB, SSN) — бот создаст запрос на кредитный скор.\n\n" +
    "Команды:\n" +
    "• /start — приветствие\n" +
    "• /help  — эта справка\n" +
    "• /status &lt;job_id&gt; — статус задания\n\n" +
    "Формат SSN: <code>XXX-XX-XXXX</code>"
  );
}

function buildJobAcceptedMessage(publicId: string): string {
  return (
    `✅ <b>Запрос принят</b>\n\n` +
    `ID: <code>${publicId}</code>\n` +
    `Статус: в очереди\n\n` +
    `Результат придёт отдельным сообщением.`
  );
}

function buildJobResultMessage(result: {
  creditScore: number | null;
  productScore: number;
  status: string;
  source: string;
  priceUsd: number;
}): string {
  const score = result.creditScore ?? "—";
  const quality = result.productScore;
  const emoji = result.creditScore !== null ? "✅" : "⚠️";

  return (
    `${emoji} <b>Результат</b>\n\n` +
    `• Кредитный скор: <code>${score}</code>\n` +
    `• Качество данных: ${quality}/20\n` +
    `• Статус: ${result.status}\n` +
    `• Источник: ${result.source}\n` +
    `• Цена: $${result.priceUsd.toFixed(2)}`
  );
}

function buildSsnRequestMessage(): string {
  return (
    "🔑 Для продолжения нужен ваш SSN.\n" +
    "Введите в формате: <code>XXX-XX-XXXX</code>"
  );
}

function buildErrorMessage(error: string): string {
  return `❌ <b>Ошибка</b>\n\n${error}`;
}

// ---------------------------------------------------------------------------
// Telegram API helpers
// ---------------------------------------------------------------------------

async function tgSendMessage(chatId: string, text: string): Promise<void> {
  const token = getBotToken();
  if (!token) {
    console.warn("[BotWebhook] BOT_TOKEN not configured, skipping sendMessage");
    return;
  }
  try {
    await sendTelegramMessage({ botToken: token, chatId, text });
  } catch (err) {
    console.error("[BotWebhook] sendMessage failed:", err);
  }
}

async function tgSendDocument(chatId: string, url: string, caption?: string): Promise<void> {
  const token = getBotToken();
  if (!token) {
    console.warn("[BotWebhook] BOT_TOKEN not configured, skipping sendDocument");
    return;
  }
  try {
    await sendTelegramDocument({ botToken: token, chatId, url, caption });
  } catch (err) {
    console.error("[BotWebhook] sendDocument failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

async function processIncomingMessage(msg: TelegramMessage): Promise<void> {
  const chatId = String(msg.chat.id);
  const text = (msg.text ?? "").trim();

  // Handle commands
  if (text.startsWith("/start")) {
    const texts = await getBotTextTemplate("welcome");
    await tgSendMessage(chatId, buildWelcomeMessage({ welcome: texts?.body ?? null }));
    return;
  }

  if (text.startsWith("/help")) {
    await tgSendMessage(chatId, buildHelpMessage());
    return;
  }

  if (text.startsWith("/status")) {
    await tgSendMessage(chatId, "📋 Для проверки статуса используйте админ-панель или API /api/v1/jobs/:id");
    return;
  }

  // --- Check pending SSN flow first ---
  const pendingJobId = pendingSsnJobs.get(chatId);
  if (pendingJobId) {
    if (!isSsnInput(text)) {
      await tgSendMessage(chatId, buildSsnRequestMessage());
      return;
    }

    // SSN received — resume the job
    pendingSsnJobs.delete(chatId);
    console.info(`[BotWebhook] SSN received for job ${pendingJobId}, chat ${chatId}. TODO: inject SSN into job context.`);

    await tgSendMessage(
      chatId,
      `🔑 SSN принят. Задание <code>${pendingJobId}</code> будет обработано повторно.\n\n` +
        "(Инъекция SSN в контекст задания — integration point для worker pool.)",
    );
    return;
  }

  // --- Parse free-text input ---
  if (!text) {
    await tgSendMessage(chatId, buildHelpMessage());
    return;
  }

  // Try to parse the input as lead data
  const parsed = parseImportedLeadText(text);

  if (parsed.length > 0) {
    // Build job payload from parsed data
    const firstRecord = toSafeImportedLeadRecord(parsed[0]);
    const payload: Record<string, unknown> = {
      sourceLabel: firstRecord.sourceLabel,
      city: firstRecord.city,
      state: firstRecord.state,
      postalCode: firstRecord.postalCode,
      phoneNumbers: firstRecord.phoneNumbers,
      emailDomain: firstRecord.emailDomain,
      dobText: firstRecord.dobText,
      hasSsn: firstRecord.hasSsn,
      age: firstRecord.age,
      flags: firstRecord.flags,
      completenessScore: firstRecord.completenessScore,
      normalizedTarget: firstRecord.normalizedTarget,
    };

    // Use safe-test mode for Telegram-sourced jobs (no external calls)
    const result = await createSingleJob(
      {
        requestMode: "single",
        queueName: "telegram",
        priority: 80,
        payload,
        safeTestMode: true,
      },
      { source: "telegram" },
    );

    const publicId = result.data.job.publicId;
    const resultJson = result.data.job.resultJson as { oneCsResult?: { creditScore?: number | null; productScore?: number; status?: string; source?: string; priceUsd?: number } } | null;
    const oneCs = resultJson?.oneCsResult ?? null;

    // Acknowledge receipt
    await tgSendMessage(chatId, buildJobAcceptedMessage(publicId));

    // Simulate async result delivery (safe test is synchronous)
    if (oneCs) {
      await tgSendMessage(chatId, buildJobResultMessage({
        creditScore: oneCs.creditScore ?? null,
        productScore: oneCs.productScore ?? 0,
        status: oneCs.status ?? "unknown",
        source: oneCs.source ?? "unknown",
        priceUsd: oneCs.priceUsd ?? 0,
      }));
    }
  } else {
    // No parseable data — create generic job
    const result = await createSingleJob(
      {
        requestMode: "single",
        queueName: "telegram",
        priority: 80,
        payload: { rawInput: text, source: "telegram" },
        safeTestMode: true,
      },
      { source: "telegram" },
    );

    const publicId = result.data.job.publicId;
    const resultJson = result.data.job.resultJson as { oneCsResult?: { creditScore?: number | null; productScore?: number; status?: string; source?: string; priceUsd?: number } } | null;
    const oneCs = resultJson?.oneCsResult ?? null;

    await tgSendMessage(chatId, buildJobAcceptedMessage(publicId));

    if (oneCs) {
      await tgSendMessage(chatId, buildJobResultMessage({
        creditScore: oneCs.creditScore ?? null,
        productScore: oneCs.productScore ?? 0,
        status: oneCs.status ?? "unknown",
        source: oneCs.source ?? "unknown",
        priceUsd: oneCs.priceUsd ?? 0,
      }));
    }
  }
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

export async function handleBotWebhook(req: Request, res: Response): Promise<void> {
  // Telegram sends a GET to verify the webhook
  if (req.method === "GET") {
    res.json({ ok: true, mode: "webhook" });
    return;
  }

  // Only accept POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify bot token
  const token = getBotToken();
  if (!token) {
    console.warn("[BotWebhook] BOT_TOKEN not set — webhook endpoint accessible but bot messages will be silently dropped.");
  }

  // Parse update
  const update = req.body as TelegramUpdate;

  if (!update || typeof update.update_id !== "number") {
    // Telegram will retry invalid payloads — respond 200 to avoid storm
    res.json({ ok: false, description: "invalid_payload" });
    return;
  }

  // Respond 200 immediately — Telegram requires this within 60s
  // We process asynchronously so the response doesn't time out
  res.json({ ok: true });

  // Process off the request thread
  if (update.message && update.message.text !== undefined) {
    void processIncomingMessage(update.message).catch(err => {
      console.error("[BotWebhook] Error processing message:", err);
    });
  }
}