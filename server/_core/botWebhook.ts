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
 * - /status <job_id> → real job lookup
 * - /cancel → cancel pending SSN flow
 * - SSN (XXX-XX-XXXX) → if in pending_ssn flow, inject SSN and resume job
 * - Free text with data → create a job (single mode, safe-test), return result
 * - callback_query → inline keyboard handlers
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type { Request, Response } from "express";
import { ENV } from "./env";
import {
  createSingleJob,
  getBotTextTemplate,
  sendTelegramMessage,
  sendTelegramDocument,
  getJobDetails,
} from "../platformService";
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
    language_code?: string;
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

interface TelegramCallbackQuery {
  id: string;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    language_code?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: string;
    };
  };
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: unknown;
  channel_post?: unknown;
  callback_query?: TelegramCallbackQuery;
}

// ---------------------------------------------------------------------------
// Multi-language support
// ---------------------------------------------------------------------------

type BotLanguage = "en" | "ru";

interface BotMessages {
  welcome: string;
  help: string;
  jobAccepted: string;
  jobResult: string;
  jobResultWithKeyboard: string;
  ssnRequired: string;
  error: string;
  ssnAccepted: string;
  ssnInvalid: string;
  provideJobId: string;
  jobNotFound: string;
  cancelled: string;
  sendData: string;
  missingFields: string;
  partialData: string;
  jobFailed: string;
  jobTimeout: string;
  scoreGuide: string;
  scoreGuideTitle: string;
  jobDetails: string;
  jobDetailsTitle: string;
  unknownCommand: string;
}

const MESSAGES: Record<BotLanguage, BotMessages> = {
  en: {
    welcome: "👋 <b>Welcome to ONE CS Bot!</b>\n\nSend me your data and get a credit score in seconds.\n\n<i>Format (any order):\nFull Name\nAddress\nCity, State ZIP\nDate of Birth\nPhone / Email (optional)</i>",
    help: "📋 <b>How to use</b>\n\nSend your data in any format — the bot understands free text.\n\n<b>Example:</b>\nJohn Doe\n123 Main St\nNew York NY 10001\n01/15/1985\n555-123-4567\njohn@example.com\n\n<b>Commands:</b>\n• /start — welcome\n• /help  — this message\n• /status &lt;job_id&gt; — check job status\n• /cancel — cancel current flow\n\n<b>Format:</b> SSN: <code>XXX-XX-XXXX</code>",
    jobAccepted: "✅ <b>Request accepted!</b>\n\nID: <code>{id}</code>\nMode: browser automation (Evomi)\nStatus: queued\n\nResult will arrive automatically (up to 60 sec)...",
    jobResult: "📊 <b>Credit Score Result</b>\n\n<b>Score:</b> <code>{score}</code>/850 — {grade}\n<i>{description}</i>\n\nData quality: {quality}/20\nStatus: {status}\nSource: {source}\nPrice: ${price}",
    jobResultWithKeyboard: "📊 <b>Credit Score Result</b>\n\n<b>Score:</b> <code>{score}</code>/850 — {grade}\n<i>{description}</i>\n\nData quality: {quality}/20\nStatus: {status}\nSource: {source}\nPrice: ${price}\n\nID: <code>{id}</code>",
    ssnRequired: "🔑 <b>SSN Required</b>\n\nTo complete your credit check, please enter your SSN:\nFormat: <code>XXX-XX-XXXX</code>",
    error: "❌ <b>Error</b>\n\n{message}",
    ssnAccepted: "🔑 <b>SSN accepted.</b>\n\nJob <code>{id}</code> will be re-processed with SSN.\n\n<i>(SSN injection into job context — integration point for worker pool.)</i>",
    ssnInvalid: "⚠️ <b>Invalid SSN format</b>\n\nExpected: <code>XXX-XX-XXXX</code>\nArea numbers 000, 666, 900–999 are invalid.\nGroup and serial must be non-zero.",
    provideJobId: "📋 Please provide a job ID.\n\nUsage: /status &lt;job_id&gt;",
    jobNotFound: "🔍 <b>Job not found</b>\n\nNo job found with that ID. Check the ID and try again.",
    cancelled: "🚫 <b>Cancelled.</b>\n\nYour current flow has been cancelled.",
    sendData: "📝 Please send your data in free text format.",
    missingFields: "⚠️ <b>Missing fields</b>\n\nMissing:\n{missing}\n\n<b>Example:</b>\nJohn Doe\n123 Main St\nNew York NY 10001\n01/15/1985",
    partialData: "📝 <b>Partial data received</b>\n\nGot: {got}\n⚠️ Missing: {missing}\n\nPlease send the complete data.",
    jobFailed: "❌ <b>Job failed</b>\n\nStatus: {status}\n\nTry again or contact the administrator.",
    jobTimeout: "⏰ <b>Timeout</b>\n\nJob <code>{id}</code> is still processing.\nCheck status later with /status {id}.",
    scoreGuide: "📊 <b>Credit Score Guide</b>\n\n🏆 <b>800–850</b> Exceptional\n<i>Excellent creditworthiness</i>\n\n✅ <b>740–799</b> Very Good\n<i>Strong creditworthiness</i>\n\n👍 <b>670–739</b> Good\n<i>Good creditworthiness</i>\n\n⚠️ <b>580–669</b> Fair\n<i>Moderate risk</i>\n\n🔴 <b>500–579</b> Poor\n<i>High risk</i>\n\n🚫 <b>Below 500</b> Very Poor\n<i>Very high risk</i>",
    scoreGuideTitle: "📊 Score Guide",
    jobDetails: "📋 <b>Job Details</b>\n\nID: <code>{id}</code>\nStatus: {status}\nScore: <code>{score}</code>/850 — {grade}\nQuality: {quality}/20\nSource: {source}\nPrice: ${price}",
    jobDetailsTitle: "📋 Job Details",
    unknownCommand: "🤖 Unknown command. Send /help for available commands.",
  },
  ru: {
    welcome: "👋 <b>Добро пожаловать в ONE CS Bot!</b>\n\nОтправьте данные для проверки кредитного скора за секунды.\n\n<i>Формат (любой порядок):\nФИО\nАдрес\nГород, Область, Индекс\nДата рождения\nТелефон / Email (опц.)</i>",
    help: "📋 <b>Справка</b>\n\nОтправьте текст с данными (ФИО, адрес, телефон, email, DOB) — бот создаст запрос на кредитный скор.\n\n<b>Пример:</b>\nИван Иванов\nул. Пушкина 10\nМосква 123456\n15.01.1985\n+7 999 123-45-67\nivan@example.com\n\n<b>Команды:</b>\n• /start — приветствие\n• /help  — эта справка\n• /status &lt;job_id&gt; — статус задания\n• /cancel — отмена\n\n<b>Формат SSN:</b> <code>XXX-XX-XXXX</code>",
    jobAccepted: "✅ <b>Запрос принят!</b>\n\nID: <code>{id}</code>\nРежим: browser automation (Evomi)\nСтатус: в очереди\n\nРезультат придёт автоматически (до 60 сек)...",
    jobResult: "📊 <b>Результат кредитного скора</b>\n\n<b>Скор:</b> <code>{score}</code>/850 — {grade}\n<i>{description}</i>\n\nКачество данных: {quality}/20\nСтатус: {status}\nИсточник: {source}\nЦена: ${price}",
    jobResultWithKeyboard: "📊 <b>Результат кредитного скора</b>\n\n<b>Скор:</b> <code>{score}</code>/850 — {grade}\n<i>{description}</i>\n\nКачество данных: {quality}/20\nСтатус: {status}\nИсточник: {source}\nЦена: ${price}\n\nID: <code>{id}</code>",
    ssnRequired: "🔑 <b>Требуется SSN</b>\n\nДля завершения проверки кредитного скора введите SSN:\nФормат: <code>XXX-XX-XXXX</code>",
    error: "❌ <b>Ошибка</b>\n\n{message}",
    ssnAccepted: "🔑 <b>SSN принят.</b>\n\nЗадание <code>{id}</code> будет обработано повторно с SSN.\n\n<i>(Инъекция SSN в контекст задания — integration point для worker pool.)</i>",
    ssnInvalid: "⚠️ <b>Неверный формат SSN</b>\n\nОжидается: <code>XXX-XX-XXXX</code>\nArea numbers 000, 666, 900–999 — недопустимы.\nGroup и serial должны быть ненулевыми.",
    provideJobId: "📋 Укажите ID задания.\n\nИспользование: /status &lt;job_id&gt;",
    jobNotFound: "🔍 <b>Задание не найдено</b>\n\nЗадание с таким ID не найдено. Проверьте ID и попробуйте снова.",
    cancelled: "🚫 <b>Отменено.</b>\n\nТекущий поток отменён.",
    sendData: "📝 Пожалуйста, отправьте данные в свободной форме.",
    missingFields: "⚠️ <b>Недостающие поля</b>\n\nОтсутствуют:\n{missing}\n\n<b>Пример:</b>\nИван Иванов\nул. Пушкина 10\nМосква 123456\n15.01.1985",
    partialData: "📝 <b>Частичные данные получены</b>\n\nПолучено: {got}\n⚠️ Отсутствуют: {missing}\n\nПожалуйста, отправьте полные данные.",
    jobFailed: "❌ <b>Задание не выполнено</b>\n\nСтатус: {status}\n\nПопробуйте ещё раз или обратитесь к администратору.",
    jobTimeout: "⏰ <b>Время ожидания истекло</b>\n\nЗадание <code>{id}</code> ещё обрабатывается.\nПроверьте статус позже командой /status {id}.",
    scoreGuide: "📊 <b>Руководство по кредитному скору</b>\n\n🏆 <b>800–850</b> Exceptional\n<i>Отличная кредитоспособность</i>\n\n✅ <b>740–799</b> Very Good\n<i>Высокая кредитоспособность</i>\n\n👍 <b>670–739</b> Good\n<i>Хорошая кредитоспособность</i>\n\n⚠️ <b>580–669</b> Fair\n<i>Умеренный риск</i>\n\n🔴 <b>500–579</b> Poor\n<i>Высокий риск</i>\n\n🚫 <b>Ниже 500</b> Very Poor\n<i>Очень высокий риск</i>",
    scoreGuideTitle: "📊 Руководство по скору",
    jobDetails: "📋 <b>Детали задания</b>\n\nID: <code>{id}</code>\nСтатус: {status}\nСкор: <code>{score}</code>/850 — {grade}\nКачество: {quality}/20\nИсточник: {source}\nЦена: ${price}",
    jobDetailsTitle: "📋 Детали задания",
    unknownCommand: "🤖 Неизвестная команда. Отправьте /help для списка команд.",
  },
};

/**
 * Detect language from Telegram message.
 * Priority: explicit locale from user profile > text-based heuristics.
 */
function detectLanguage(msg: TelegramMessage): BotLanguage {
  const locale = msg.from?.language_code;
  if (locale?.startsWith("ru")) return "ru";
  if (locale?.startsWith("en")) return "en";
  return "en";
}

/**
 * Translate a message key with optional variable substitution.
 */
function t(lang: BotLanguage, key: keyof BotMessages, vars?: Record<string, string | number>): string {
  const langMessages = MESSAGES[lang] ?? MESSAGES["en"];
  let msg: string = (langMessages[key] ?? MESSAGES["en"][key] ?? key) as string;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replaceAll(`{${k}}`, String(v));
    }
  }
  return msg;
}

// ---------------------------------------------------------------------------
// In-memory state for the bot FSM
// ---------------------------------------------------------------------------

/** Maps chat_id → job_public_id waiting for SSN input. */
const pendingSsnJobs = new Map<string, string>();

/** Maps chat_id → job_public_id for polling job completion. */
const pendingBotJobs = new Map<string, string>();

// ---------------------------------------------------------------------------
// SSN validation (enhanced with checksum)
// ---------------------------------------------------------------------------

const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;

function isSsnInput(text: string): boolean {
  return SSN_REGEX.test(text.trim());
}

/**
 * Validate SSN format and checksum rules.
 * - Area (first 3 digits): 000, 666, 900-999 are invalid
 * - Group (middle 2 digits): must be non-zero
 * - Serial (last 4 digits): must be non-zero
 */
function validateSsn(ssn: string): boolean {
  const trimmed = ssn.trim();
  if (!SSN_REGEX.test(trimmed)) return false;
  const parts = trimmed.split("-");
  const area = parseInt(parts[0], 10);
  if (area === 0 || area === 666 || area >= 900) return false;
  if (parseInt(parts[1], 10) === 0) return false;
  if (parseInt(parts[2], 10) === 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Bot token validation
// ---------------------------------------------------------------------------

function getBotToken(): string {
  return ENV.botToken?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Score grade helpers
// ---------------------------------------------------------------------------

interface ScoreGradeResult {
  grade: string;
  description: string;
}

function getScoreGradeInfo(lang: BotLanguage, score: number | null): ScoreGradeResult {
  if (score === null) {
    return { grade: "⚠️", description: lang === "ru" ? "Скор недоступен" : "Score unavailable" };
  }
  if (score >= 800) return { grade: "🏆 Exceptional", description: lang === "ru" ? "Отличная кредитоспособность" : "Excellent creditworthiness" };
  if (score >= 740) return { grade: "✅ Very Good", description: lang === "ru" ? "Высокая кредитоспособность" : "Strong creditworthiness" };
  if (score >= 670) return { grade: "👍 Good", description: lang === "ru" ? "Хорошая кредитоспособность" : "Good creditworthiness" };
  if (score >= 580) return { grade: "⚠️ Fair", description: lang === "ru" ? "Умеренный риск" : "Moderate risk" };
  if (score >= 500) return { grade: "🔴 Poor", description: lang === "ru" ? "Высокий риск" : "High risk" };
  return { grade: "🚫 Very Poor", description: lang === "ru" ? "Очень высокий риск" : "Very high risk" };
}

// ---------------------------------------------------------------------------
// Job payload validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean;
  missing: string[];
  provided: string[];
}

const REQUIRED_FIELDS = ["fullName", "address", "dob"];

function validateJobPayload(data: Record<string, unknown>): ValidationResult {
  const provided = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== "");
  const missing = REQUIRED_FIELDS.filter(f => !provided.includes(f));
  return { valid: missing.length === 0, missing, provided };
}

// ---------------------------------------------------------------------------
// Message builders (language-aware, rich formatting)
// ---------------------------------------------------------------------------

function buildWelcomeMessage(lang: BotLanguage): string {
  return t(lang, "welcome");
}

function buildHelpMessage(lang: BotLanguage): string {
  return t(lang, "help");
}

function buildJobAcceptedMessage(publicId: string, lang: BotLanguage): string {
  return t(lang, "jobAccepted", { id: publicId });
}

/**
 * Build the inline keyboard for job result messages.
 */
function buildResultKeyboard(publicId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } {
  return {
    inline_keyboard: [
      [
        { text: "📋 Details", callback_data: `job:${publicId}` },
        { text: "🔄 New Check", callback_data: "new_check" },
      ],
      [
        { text: "📊 Score Guide", callback_data: "score_guide" },
      ],
    ],
  };
}

function buildJobResultMessage(
  result: {
    creditScore: number | null;
    productScore: number;
    status: string;
    source: string;
    priceUsd: number;
  },
  publicId: string,
  lang: BotLanguage,
  includeKeyboard = true,
): { text: string; reply_markup?: ReturnType<typeof buildResultKeyboard> } {
  const scoreStr = result.creditScore !== null ? String(result.creditScore) : "—";
  const gradeInfo = getScoreGradeInfo(lang, result.creditScore);

  const text = includeKeyboard
    ? t(lang, "jobResultWithKeyboard", {
        score: scoreStr,
        grade: gradeInfo.grade,
        description: gradeInfo.description,
        quality: String(result.productScore),
        status: result.status,
        source: result.source,
        price: result.priceUsd.toFixed(2),
        id: publicId,
      })
    : t(lang, "jobResult", {
        score: scoreStr,
        grade: gradeInfo.grade,
        description: gradeInfo.description,
        quality: String(result.productScore),
        status: result.status,
        source: result.source,
        price: result.priceUsd.toFixed(2),
      });

  return includeKeyboard
    ? { text, reply_markup: buildResultKeyboard(publicId) }
    : { text };
}

function buildSsnRequestMessage(lang: BotLanguage): string {
  return t(lang, "ssnRequired");
}

function buildSsnAcceptedMessage(publicId: string, lang: BotLanguage): string {
  return t(lang, "ssnAccepted", { id: publicId });
}

function buildSsnInvalidMessage(lang: BotLanguage): string {
  return t(lang, "ssnInvalid");
}

function buildErrorMessage(message: string, lang: BotLanguage): string {
  return t(lang, "error", { message });
}

function buildMissingFieldsMessage(missingFields: string[], lang: BotLanguage): string {
  return t(lang, "missingFields", { missing: missingFields.map(f => `• ${f}`).join("\n") });
}

function buildPartialDataMessage(provided: string[], missing: string[], lang: BotLanguage): string {
  return t(lang, "partialData", {
    got: provided.join(", "),
    missing: missing.join(", "),
  });
}

function buildJobFailedMessage(status: string, lang: BotLanguage): string {
  return t(lang, "jobFailed", { status });
}

function buildJobTimeoutMessage(publicId: string, lang: BotLanguage): string {
  return t(lang, "jobTimeout", { id: publicId });
}

function buildProvideJobIdMessage(lang: BotLanguage): string {
  return t(lang, "provideJobId");
}

function buildJobNotFoundMessage(lang: BotLanguage): string {
  return t(lang, "jobNotFound");
}

function buildCancelledMessage(lang: BotLanguage): string {
  return t(lang, "cancelled");
}

function buildScoreGuideMessage(lang: BotLanguage): { text: string; reply_markup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } } {
  return {
    text: t(lang, "scoreGuide"),
    reply_markup: {
      inline_keyboard: [[{ text: "🔄 New Check", callback_data: "new_check" }]],
    },
  };
}

function buildJobDetailsMessage(
  jobData: { job: any; events?: any[] },
  publicId: string,
  lang: BotLanguage,
): { text: string; reply_markup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } } {
  const job = jobData.job;
  const resultJson = job?.resultJson as { oneCsResult?: { creditScore?: number | null; productScore?: number; status?: string; source?: string; priceUsd?: number } } | null;
  const oneCs = resultJson?.oneCsResult ?? null;
  const scoreStr = oneCs?.creditScore !== undefined && oneCs?.creditScore !== null ? String(oneCs.creditScore) : "—";
  const gradeInfo = getScoreGradeInfo(lang, oneCs?.creditScore ?? null);
  return {
    text: t(lang, "jobDetails", {
      id: publicId,
      status: job.status,
      score: scoreStr,
      grade: gradeInfo.grade,
      quality: String(oneCs?.productScore ?? 0),
      source: oneCs?.source ?? "—",
      price: (oneCs?.priceUsd ?? 0).toFixed(2),
    }),
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 New Check", callback_data: "new_check" }],
        [{ text: "📊 Score Guide", callback_data: "score_guide" }],
      ],
    },
  };
}

function buildUnknownCommandMessage(lang: BotLanguage): string {
  return t(lang, "unknownCommand");
}

// ---------------------------------------------------------------------------
// Telegram API helpers
// ---------------------------------------------------------------------------

async function tgSendMessage(
  chatId: string,
  text: string,
  reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
): Promise<void> {
  const token = getBotToken();
  if (!token) {
    console.warn("[BotWebhook] BOT_TOKEN not configured, skipping sendMessage");
    return;
  }
  try {
    await sendTelegramMessage({ botToken: token, chatId, text, replyMarkup: reply_markup });
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
// Async job polling (for real browser automation mode)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 20;

interface JobStatusResponse {
  publicId: string;
  status: string;
  resultJson: {
    oneCsResult?: {
      creditScore?: number | null;
      productScore?: number;
      status?: string;
      source?: string;
      priceUsd?: number;
    };
  } | null;
}

async function fetchJobStatus(publicId: string): Promise<JobStatusResponse | null> {
  const baseUrl = ENV.forgeApiUrl || `http://localhost:${ENV.port}`;
  const token = ENV.privateApiKey || ENV.adminPasswordHash;
  if (!token) return null;
  try {
    const res = await fetch(`${baseUrl}/api/v1/jobs/${publicId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { job?: JobStatusResponse } };
    return data.data?.job ?? null;
  } catch {
    return null;
  }
}

async function sendJobResultToUser(
  chatId: string,
  status: string,
  resultJson: JobStatusResponse["resultJson"],
  publicId: string,
  lang: BotLanguage,
): Promise<void> {
  if (status === "succeeded" && resultJson?.oneCsResult) {
    const oneCs = resultJson.oneCsResult;
    const { text, reply_markup } = buildJobResultMessage(
      {
        creditScore: oneCs.creditScore ?? null,
        productScore: oneCs.productScore ?? 0,
        status: oneCs.status ?? "unknown",
        source: oneCs.source ?? "unknown",
        priceUsd: oneCs.priceUsd ?? 0,
      },
      publicId,
      lang,
      true,
    );
    await tgSendMessage(chatId, text, reply_markup);
  } else if (status === "failed") {
    await tgSendMessage(chatId, buildJobFailedMessage(status, lang));
  } else {
    await tgSendMessage(chatId, t(lang, "scoreGuide") + `\n\n<b>Status:</b> ${status}`);
  }
}

async function pollBotJobUntilDone(publicId: string, chatId: string, lang: BotLanguage): Promise<void> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const job = await fetchJobStatus(publicId);
    if (!job) continue;
    if (job.status === "succeeded" || job.status === "failed") {
      pendingBotJobs.delete(chatId);
      await sendJobResultToUser(chatId, job.status, job.resultJson, publicId, lang);
      return;
    }
  }
  // Max polls reached
  pendingBotJobs.delete(chatId);
  await tgSendMessage(chatId, buildJobTimeoutMessage(publicId, lang));
}

// ---------------------------------------------------------------------------
// Inline keyboard handlers
// ---------------------------------------------------------------------------

async function handleCallbackQuery(
  query: TelegramCallbackQuery,
  lang: BotLanguage,
): Promise<void> {
  const chatId = String(query.message?.chat.id ?? "");
  const data = query.data ?? "";

  if (!chatId) return;

  if (data === "new_check") {
    await tgSendMessage(chatId, t(lang, "sendData"));
  } else if (data === "score_guide") {
    const { text, reply_markup } = buildScoreGuideMessage(lang);
    await tgSendMessage(chatId, text, reply_markup);
  } else if (data.startsWith("job:")) {
    const publicId = data.replace(/^job:/, "");
    await sendJobDetailsResponse(chatId, publicId, lang);
  }
}

async function sendJobDetailsResponse(chatId: string, publicId: string, lang: BotLanguage): Promise<void> {
  const job = await getJobDetails(publicId);
  if (!job) {
    await tgSendMessage(chatId, buildJobNotFoundMessage(lang));
    return;
  }
  const { text, reply_markup } = buildJobDetailsMessage(job, publicId, lang);
  await tgSendMessage(chatId, text, reply_markup);
}

// ---------------------------------------------------------------------------
// /status command
// ---------------------------------------------------------------------------

async function handleStatusCommand(chatId: string, rawText: string, lang: BotLanguage): Promise<void> {
  const jobId = rawText.replace(/^\/status/, "").replace(/^@\w+/, "").trim();
  if (!jobId) {
    await tgSendMessage(chatId, buildProvideJobIdMessage(lang));
    return;
  }
  const job = await getJobDetails(jobId);
  if (!job) {
    await tgSendMessage(chatId, buildJobNotFoundMessage(lang));
    return;
  }
  const { text, reply_markup } = buildJobDetailsMessage(job, jobId, lang);
  await tgSendMessage(chatId, text, reply_markup);
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

async function processIncomingMessage(msg: TelegramMessage): Promise<void> {
  const chatId = String(msg.chat.id);
  const text = (msg.text ?? "").trim();
  const lang = detectLanguage(msg);

  // Handle commands
  if (text.startsWith("/start")) {
    const texts = await getBotTextTemplate("welcome");
    const welcomeText = texts?.body ?? buildWelcomeMessage(lang);
    await tgSendMessage(chatId, welcomeText);
    return;
  }

  if (text.startsWith("/help")) {
    await tgSendMessage(chatId, buildHelpMessage(lang));
    return;
  }

  if (text.startsWith("/status")) {
    await handleStatusCommand(chatId, text, lang);
    return;
  }

  if (text.startsWith("/cancel")) {
    pendingSsnJobs.delete(chatId);
    pendingBotJobs.delete(chatId);
    await tgSendMessage(chatId, buildCancelledMessage(lang));
    return;
  }

  // --- Check pending SSN flow first ---
  const pendingJobId = pendingSsnJobs.get(chatId);
  if (pendingJobId) {
    if (!isSsnInput(text)) {
      await tgSendMessage(chatId, buildSsnRequestMessage(lang));
      return;
    }
    if (!validateSsn(text)) {
      await tgSendMessage(chatId, buildSsnInvalidMessage(lang));
      return;
    }

    // SSN received — resume the job
    pendingSsnJobs.delete(chatId);
    console.info(`[BotWebhook] SSN received for job ${pendingJobId}, chat ${chatId}.`);
    await tgSendMessage(chatId, buildSsnAcceptedMessage(pendingJobId, lang));
    return;
  }

  // --- Parse free-text input ---
  if (!text) {
    await tgSendMessage(chatId, buildHelpMessage(lang));
    return;
  }

  // Try to parse the input as lead data
  const parsed = parseImportedLeadText(text);

  if (parsed.length > 0) {
    // Use raw parsed data with firstName/lastName for browser automation
    const rawRecord = parsed[0];
    const safeRecord = toSafeImportedLeadRecord(rawRecord);
    const nameParts = rawRecord.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Validate required fields
    const validation = validateJobPayload({
      fullName: rawRecord.fullName,
      address: rawRecord.addressRaw,
      dob: rawRecord.dobText,
    });

    if (!validation.valid) {
      await tgSendMessage(chatId, buildMissingFieldsMessage(validation.missing, lang));
      return;
    }

    // If some fields are present but not all required — acknowledge partial
    if (validation.missing.length > 0) {
      await tgSendMessage(
        chatId,
        buildPartialDataMessage(validation.provided, validation.missing, lang),
      );
      return;
    }

    // Determine mode: real browser if Evomi is configured, otherwise safe-test
    const safeTestMode = !Boolean(ENV.evomiUsername);

    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      street: rawRecord.addressRaw ?? "",
      city: rawRecord.city ?? "",
      state: rawRecord.state ?? "",
      zipCode: rawRecord.postalCode ?? "",
      dob: rawRecord.dobText ?? "",
      annualIncome: "",
      email: rawRecord.email ?? "",
      phone: rawRecord.phoneNumbers[0] ?? "",
      telegramChatId: chatId,
      sourceLabel: safeRecord.sourceLabel,
      cityMeta: safeRecord.city,
      stateMeta: safeRecord.state,
      postalCodeMeta: safeRecord.postalCode,
      phoneNumbers: safeRecord.phoneNumbers,
      emailDomain: safeRecord.emailDomain,
      dobText: safeRecord.dobText,
      hasSsn: safeRecord.hasSsn,
      age: safeRecord.age,
      flags: safeRecord.flags,
      completenessScore: safeRecord.completenessScore,
      normalizedTarget: safeRecord.normalizedTarget,
    };

    const result = await createSingleJob(
      {
        requestMode: "single",
        queueName: "telegram",
        priority: 80,
        payload,
        safeTestMode,
      },
      { source: "telegram" },
    );

    const publicId = result.data.job.publicId;

    // Track job for polling if in real mode
    if (!safeTestMode) {
      pendingBotJobs.set(chatId, publicId);
      void pollBotJobUntilDone(publicId, chatId, lang);
    }

    // Acknowledge receipt
    await tgSendMessage(chatId, buildJobAcceptedMessage(publicId, lang));

    // Safe-test: result is synchronous, show it immediately
    if (safeTestMode) {
      const resultJson = result.data.job.resultJson as {
        oneCsResult?: {
          creditScore?: number | null;
          productScore?: number;
          status?: string;
          source?: string;
          priceUsd?: number;
        };
      } | null;
      const oneCs = resultJson?.oneCsResult ?? null;
      if (oneCs) {
        const { text: msgText, reply_markup } = buildJobResultMessage(
          {
            creditScore: oneCs.creditScore ?? null,
            productScore: oneCs.productScore ?? 0,
            status: oneCs.status ?? "unknown",
            source: oneCs.source ?? "unknown",
            priceUsd: oneCs.priceUsd ?? 0,
          },
          publicId,
          lang,
          true,
        );
        await tgSendMessage(chatId, msgText, reply_markup);
      }
    }
  } else {
    // No parseable data — create generic job in safe-test mode
    const safeTestMode = true;
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
    const resultJson = result.data.job.resultJson as {
      oneCsResult?: {
        creditScore?: number | null;
        productScore?: number;
        status?: string;
        source?: string;
        priceUsd?: number;
      };
    } | null;
    const oneCs = resultJson?.oneCsResult ?? null;

    await tgSendMessage(chatId, buildJobAcceptedMessage(publicId, lang));

    if (oneCs) {
      const { text: msgText, reply_markup } = buildJobResultMessage(
        {
          creditScore: oneCs.creditScore ?? null,
          productScore: oneCs.productScore ?? 0,
          status: oneCs.status ?? "unknown",
          source: oneCs.source ?? "unknown",
          priceUsd: oneCs.priceUsd ?? 0,
        },
        publicId,
        lang,
        true,
      );
      await tgSendMessage(chatId, msgText, reply_markup);
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
  res.json({ ok: true });

  // Handle callback_query (inline keyboard)
  if (update.callback_query) {
    const lang: BotLanguage = update.callback_query.from?.language_code?.startsWith("ru") ? "ru" : "en";
    void handleCallbackQuery(update.callback_query, lang).catch(err => {
      console.error("[BotWebhook] Error handling callback_query:", err);
    });
    return;
  }

  // Process incoming text message off the request thread
  if (update.message && update.message.text !== undefined) {
    void processIncomingMessage(update.message).catch(err => {
      console.error("[BotWebhook] Error processing message:", err);
    });
  }
}
