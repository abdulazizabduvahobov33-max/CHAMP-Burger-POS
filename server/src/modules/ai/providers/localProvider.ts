import { getDashboardSummary, getProductProfitability } from "../../reports/report.service.js";
import { productProfitabilityQuerySchema } from "../../reports/report.schema.js";
import { listIngredients } from "../../ingredients/ingredient.service.js";
import { listIngredientsQuerySchema } from "../../ingredients/ingredient.schema.js";
import type { AIContext, AIProvider, AIReply } from "./types.js";

function formatSum(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return `${Math.round(n).toLocaleString("ru-RU")} сум`;
}

function parseAmount(raw: string): number {
  return parseInt(raw.replace(/\s/g, ""), 10);
}

function cleanPhrase(raw: string): string {
  return raw.trim().replace(/[.,!?]+$/, "").trim();
}

const NUMBER = "(\\d[\\d\\s]*\\d|\\d+)";
// `\w` is ASCII-only in JS regex (even with the `u` flag), so it can never extend past a
// Cyrillic word stem — "бутыл\w*" matches only "бутыл", never "бутылок". Every word-ending
// wildcard below uses this Cyrillic letter class instead.
const RU = "а-яё";

// ── Record-intent parsing (purchases / expenses mentioned in free text) ────
// These never write to the database — Purchases/expenses need a real ingredient, supplier and
// unit selected through the existing forms, which free text can't safely resolve on its own.
// The local provider only proves it understood the message; a real LLM provider (or a future
// confirmation step) can turn this into an actual record without any other component changing.

function tryParsePurchaseWithPrice(message: string): string | null {
  const match = new RegExp(
    `куп(?:ил|или|ила|ить)[${RU}]*\\s+(\\d+(?:[.,]\\d+)?)\\s*(кг|г|гр|л|мл|шт|литр[${RU}]*|бутыл[${RU}]*|упак[${RU}]*|пач[${RU}]*|мешк[${RU}]*)?\\.?\\s+([${RU}a-z\\s]+?)\\s+по\\s+${NUMBER}`,
    "iu",
  ).exec(message);
  if (!match) return null;

  const quantity = match[1].replace(",", ".");
  const unit = match[2] ?? "";
  const item = cleanPhrase(match[3]);
  const unitPrice = parseAmount(match[4]);
  const total = Number(quantity) * unitPrice;

  return (
    `Понял ✅\n\n` +
    `Зафиксировано (тестовый режим):\n` +
    `• Покупка: ${item}\n` +
    `• Количество: ${quantity}${unit ? ` ${unit}` : ""}\n` +
    `• Цена за единицу: ${formatSum(unitPrice)}\n` +
    `• Итого: ${formatSum(total)}\n\n` +
    `Автоматическая запись в закупки появится в одном из следующих обновлений — сейчас я только распознаю сообщение.`
  );
}

function tryParsePurchaseTotal(message: string): string | null {
  const match = new RegExp(`куп(?:ил|или|ила|ить)[${RU}]*\\s+([${RU}a-z\\s]+?)\\s+на\\s+${NUMBER}`, "iu").exec(message);
  if (!match) return null;

  const item = cleanPhrase(match[1]);
  const total = parseAmount(match[2]);

  return (
    `Понял ✅\n\n` +
    `Зафиксировано (тестовый режим):\n` +
    `• Покупка: ${item}\n` +
    `• Сумма: ${formatSum(total)}\n\n` +
    `Автоматическая запись в закупки появится в одном из следующих обновлений — сейчас я только распознаю сообщение.`
  );
}

function tryParseExpense(message: string): string | null {
  const addMatch = new RegExp(`расход[${RU}]*\\s+${NUMBER}\\s*(?:сум[${RU}]*)?\\s*на\\s+([${RU}a-z\\s]+)`, "iu").exec(message);
  const payMatch = addMatch
    ? null
    : new RegExp(`(?:заплати[${RU}]*|оплати[${RU}]*)\\s+${NUMBER}\\s*(?:сум[${RU}]*)?\\s*за\\s+([${RU}a-z\\s]+)`, "iu").exec(
        message,
      );
  const match = addMatch ?? payMatch;
  if (!match) return null;

  const amount = parseAmount(match[1]);
  const category = cleanPhrase(match[2]);

  return (
    `Понял ✅\n\n` +
    `Зафиксировано (тестовый режим):\n` +
    `• Расход: ${category}\n` +
    `• Сумма: ${formatSum(amount)}\n\n` +
    `Автоматическая запись расходов появится в одном из следующих обновлений — сейчас я только распознаю сообщение.`
  );
}

// ── Business-question intents — answered from REAL data via the existing report/ingredient
// services (read-only), so the "free tier" is genuinely useful today, not just a stub. ────────

type QuestionIntent = {
  test: RegExp;
  handle: (ctx: AIContext) => Promise<string>;
};

const QUESTION_INTENTS: QuestionIntent[] = [
  {
    // Salary / rent / utilities aren't tracked as a business concept anywhere in the app yet —
    // say so honestly instead of guessing, and check this BEFORE the generic profit intent so
    // "сколько ушло на зарплаты" doesn't fall through to the revenue/profit answer.
    test: new RegExp(`зарплат[${RU}]*|аренд[${RU}]*|коммунал[${RU}]*`, "iu"),
    handle: async () =>
      "Учёт зарплат, аренды и коммунальных расходов появится в одном из следующих обновлений. " +
      "Сейчас я могу рассказать о выручке, прибыли, продажах и остатках на складе.",
  },
  {
    test: new RegExp(`сам(?:ые|ая)?\\s*прибыльн[${RU}]*|прибыльные\\s*товар[${RU}]*|лучшие\\s*товар[${RU}]*`, "iu"),
    handle: async (ctx) => {
      const query = productProfitabilityQuerySchema.parse({ preset: "month", sortBy: "profit", sortDir: "desc", pageSize: 5 });
      const result = await getProductProfitability(ctx.locationId, query);
      if (result.items.length === 0) return "За последние 30 дней данных о продажах пока нет.";
      const lines = result.items.map(
        (it, i) => `${i + 1}. ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""} — прибыль ${formatSum(it.profit)}, маржа ${it.margin}%`,
      );
      return `Самые прибыльные товары за последние 30 дней:\n\n${lines.join("\n")}`;
    },
  },
  {
    test: new RegExp(`худш[${RU}]*\\s*товар[${RU}]*|плохо продаются|хуже всего продаются|продаются хуже всего`, "iu"),
    handle: async (ctx) => {
      const query = productProfitabilityQuerySchema.parse({ preset: "month", sortBy: "quantity", sortDir: "asc", pageSize: 5 });
      const result = await getProductProfitability(ctx.locationId, query);
      if (result.items.length === 0) return "За последние 30 дней данных о продажах пока нет.";
      const lines = result.items.map(
        (it, i) => `${i + 1}. ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""} — продано ${it.quantitySold} шт.`,
      );
      return `Хуже всего продаются за последние 30 дней:\n\n${lines.join("\n")}`;
    },
  },
  {
    test: new RegExp(`что.*заказать|советуй\\s*заказ[${RU}]*|что докупить|закажи[${RU}]*`, "iu"),
    handle: async (ctx) => {
      const query = listIngredientsQuerySchema.parse({ lowStock: "true", pageSize: 10 });
      const result = await listIngredients(ctx.locationId, query);
      if (result.items.length === 0) return "Пополнять склад пока не нужно — все остатки в норме.";
      const lines = result.items.map((it) => `• ${it.name}: осталось ${it.quantity} (минимум ${it.minQuantity})`);
      return `Рекомендую заказать в первую очередь:\n\n${lines.join("\n")}`;
    },
  },
  {
    test: new RegExp(`заканчивается на складе|мало на складе|нехватк[${RU}]*|что.*склад[${RU}]*.*(заканчивается|мало)`, "iu"),
    handle: async (ctx) => {
      const query = listIngredientsQuerySchema.parse({ lowStock: "true", pageSize: 10 });
      const result = await listIngredients(ctx.locationId, query);
      if (result.items.length === 0) return "Все остатки на складе в норме, ничего не заканчивается.";
      const lines = result.items.map((it) => `• ${it.name}: осталось ${it.quantity} (минимум ${it.minQuantity})`);
      return `На складе заканчивается:\n\n${lines.join("\n")}`;
    },
  },
  {
    test: /чистой прибыли|чистая прибыль|сколько.*(осталось|остаётся).*после расход/iu,
    handle: async (ctx) => {
      const summary = await getDashboardSummary(ctx.locationId);
      return (
        `Прибыль (выручка минус себестоимость товаров) за последние 30 дней: ${formatSum(summary.month.profit)}.\n\n` +
        `Учёт дополнительных расходов (зарплаты, аренда, коммунальные) появится в одном из следующих обновлений — пока эта сумма их не включает.`
      );
    },
  },
  {
    test: /как увеличить прибыль|как поднять прибыль|увеличить доход/iu,
    handle: async () =>
      "Несколько общих идей:\n\n" +
      "• Проверьте товары с самой низкой маржой — возможно, стоит поднять цену или найти поставщика подешевле\n" +
      "• Сократите списания на складе — точнее настройте минимальные остатки\n" +
      "• Продвигайте в POS товары с высокой прибылью в первую очередь\n" +
      "• Периодически сравнивайте закупочные цены у разных поставщиков\n\n" +
      "Персональные рекомендации на основе ваших данных появятся с подключением полноценного ИИ.",
  },
  {
    test: new RegExp(
      `(заработал|выработк[${RU}]*|выручк[${RU}]*|доход[${RU}]*).*недел[${RU}]*|недел[${RU}]*.*(заработал|выручк[${RU}]*|доход[${RU}]*)`,
      "iu",
    ),
    handle: async (ctx) => {
      const summary = await getDashboardSummary(ctx.locationId);
      return `За последние 7 дней:\n• Выручка: ${formatSum(summary.week.revenue)}\n• Прибыль: ${formatSum(summary.week.profit)}\n• Чеков: ${summary.week.count}`;
    },
  },
  {
    test: new RegExp(
      `(заработал|выручк[${RU}]*|доход[${RU}]*).*месяц[${RU}]*|месяц[${RU}]*.*(заработал|выручк[${RU}]*|доход[${RU}]*)`,
      "iu",
    ),
    handle: async (ctx) => {
      const summary = await getDashboardSummary(ctx.locationId);
      return `За последние 30 дней:\n• Выручка: ${formatSum(summary.month.revenue)}\n• Прибыль: ${formatSum(summary.month.profit)}\n• Чеков: ${summary.month.count}`;
    },
  },
  {
    test: new RegExp(`заработал|выручк[${RU}]*|доход[${RU}]*`, "iu"),
    handle: async (ctx) => {
      const summary = await getDashboardSummary(ctx.locationId);
      return `Сегодня:\n• Выручка: ${formatSum(summary.today.revenue)}\n• Прибыль: ${formatSum(summary.today.profit)}\n• Чеков: ${summary.today.count}`;
    },
  },
];

const FALLBACK_REPLY =
  "Пока я работаю в бесплатном тестовом режиме и понимаю ограниченный набор сообщений. Вот что я умею:\n\n" +
  "• «Сколько я заработал за неделю?»\n" +
  "• «Какие товары самые прибыльные?»\n" +
  "• «Что заканчивается на складе?»\n" +
  "• «Купил 5 кг мяса по 120000 сум»\n" +
  "• «Заплати 50000 за бензин»\n\n" +
  "Более умные и точные ответы появятся при подключении полноценного ИИ.";

/**
 * Free, offline, zero-API-key default. Detects a handful of record intents via regex (purchase
 * / expense messages) and a handful of business questions answered from real data through the
 * existing report/ingredient services — everything else falls back to a capability summary.
 * This is intentionally simple: it exists so the module works out of the box with no
 * configuration, not to replace a real LLM.
 */
export const localProvider: AIProvider = {
  name: "local",

  async generateResponse(message: string, context: AIContext): Promise<AIReply> {
    const recorded = tryParsePurchaseWithPrice(message) ?? tryParsePurchaseTotal(message) ?? tryParseExpense(message);
    if (recorded) return { text: recorded };

    for (const intent of QUESTION_INTENTS) {
      if (intent.test.test(message)) {
        const text = await intent.handle(context);
        return { text };
      }
    }

    return { text: FALLBACK_REPLY };
  },
};
