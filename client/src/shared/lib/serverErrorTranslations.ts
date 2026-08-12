import type { SupportedLanguage } from "@/shared/i18n";

/**
 * The API has no i18n of its own — every AppError/Zod message it returns is a fixed Russian
 * string (see server/src/modules/*, prisma schema comments). Rather than touch 60+ call sites
 * across every module (and risk anything that might branch on `error.code`), this translates by
 * matching the exact Russian text the server already sends. The Russian string effectively *is*
 * the stable identifier here — every distinct message the API can produce is enumerated below.
 *
 * A message the server adds later (or any typo'd mismatch) just falls through untranslated —
 * same Russian text a user would have seen before this file existed, never a blank or broken UI.
 */
const UZ_BY_RU: Record<string, string> = {
  "Вариант товара не найден": "Mahsulot varianti topilmadi",
  "Введите имя": "Ismni kiriting",
  "Введите логин": "Loginni kiriting",
  "Введите название": "Nomini kiriting",
  "Введите название категории": "Kategoriya nomini kiriting",
  "Введите название поставщика": "Yetkazib beruvchi nomini kiriting",
  "Введите пароль": "Parolni kiriting",
  "Введите сообщение": "Xabarni kiriting",
  "Введите текущий пароль": "Joriy parolni kiriting",
  "Выберите ингредиент": "Ingredientni tanlang",
  "Выберите категорию": "Kategoriyani tanlang",
  "Выберите стол перед отправкой заказа": "Buyurtmani yuborishdan oldin stolni tanlang",
  "Добавьте хотя бы один вариант цены": "Kamida bitta narx varianti qo'shing",
  "Добавьте хотя бы один ингредиент": "Kamida bitta ingredient qo'shing",
  "Добавьте хотя бы одну позицию": "Kamida bitta pozitsiya qo'shing",
  "Заказ уже обработан": "Buyurtma allaqachon ko'rib chiqilgan",
  "Закупка не найдена": "Xarid topilmadi",
  "Изображение используется товаром": "Rasm mahsulot tomonidan ishlatilmoqda",
  "Ингредиент не может повторяться в одном рецепте": "Ingredient bitta retseptda takrorlanishi mumkin emas",
  "Ингредиент не найден": "Ingredient topilmadi",
  "Ингредиент с таким названием уже существует": "Bunday nomli ingredient allaqachon mavjud",
  "Категория не найдена": "Kategoriya topilmadi",
  "Количество в упаковке должно быть больше нуля": "Qadoqdagi miqdor noldan katta bo'lishi kerak",
  "Количество должно быть больше нуля": "Miqdor noldan katta bo'lishi kerak",
  "Количество упаковок должно быть больше нуля": "Qadoqlar soni noldan katta bo'lishi kerak",
  "Корзина пуста": "Savat bo'sh",
  "Минимальный остаток не может быть отрицательным": "Minimal qoldiq manfiy bo'lishi mumkin emas",
  "Минимум 3 символа": "Kamida 3 ta belgi",
  "Минимум 6 символов": "Kamida 6 ta belgi",
  "Начало периода не может быть позже конца": "Davr boshi oxiridan keyin bo'lishi mumkin emas",
  "Неверный логин или пароль": "Login yoki parol noto'g'ri",
  "Неверный текущий пароль": "Joriy parol noto'g'ri",
  "Недействительный или истёкший токен": "Token yaroqsiz yoki muddati o'tgan",
  "Недостаточно прав для этого действия": "Bu amal uchun huquqlar yetarli emas",
  "Некорректная дата": "Noto'g'ri sana",
  "Некорректная единица измерения": "Noto'g'ri o'lchov birligi",
  "Некорректная роль": "Noto'g'ri rol",
  "Некорректные данные запроса": "So'rov ma'lumotlari noto'g'ri",
  "Некорректный тип продажи": "Noto'g'ri sotuv turi",
  "Нельзя деактивировать себя или снять с себя роль администратора":
    "O'zingizni faolsizlantira olmaysiz yoki o'zingizdan administrator rolini olib tashlay olmaysiz",
  "Нельзя оставить систему без единственного администратора": "Tizimni yagona administratorsiz qoldirib bo'lmaydi",
  "Нельзя удалить вариант: он используется в продажах": "Variantni o'chirib bo'lmaydi: u sotuvlarda ishlatilgan",
  "Нельзя удалить единственного администратора": "Yagona administratorni o'chirib bo'lmaydi",
  "Нельзя удалить свою учётную запись": "O'z hisobingizni o'chira olmaysiz",
  "Нельзя удалить: в категории появились товары": "O'chirib bo'lmaydi: kategoriyada mahsulotlar paydo bo'ldi",
  "Нельзя удалить: товар используется в продажах": "O'chirib bo'lmaydi: mahsulot sotuvlarda ishlatilgan",
  "Нельзя удалить: у пользователя есть история операций. Деактивируйте его вместо удаления":
    "O'chirib bo'lmaydi: foydalanuvchida amaliyotlar tarixi bor. O'chirish o'rniga uni faolsizlantiring",
  "Нельзя удалить: за этим столом появились заказы": "O'chirib bo'lmaydi: bu stolda buyurtmalar paydo bo'ldi",
  "Один из товаров в корзине не найден": "Savatdagi mahsulotlardan biri topilmadi",
  "Один или несколько ингредиентов не найдены": "Bir yoki bir nechta ingredient topilmadi",
  "Полученная сумма меньше суммы заказа": "Qabul qilingan summa buyurtma summasidan kam",
  "Пользователь не найден": "Foydalanuvchi topilmadi",
  "Пользователь недоступен": "Foydalanuvchi mavjud emas",
  "Пользователь с таким логином уже существует": "Bunday loginli foydalanuvchi allaqachon mavjud",
  "Поставщик не найден": "Yetkazib beruvchi topilmadi",
  "Продажа не найдена": "Sotuv topilmadi",
  "Сессия истекла, войдите снова": "Sessiya muddati tugadi, qayta kiring",
  "Слишком много запросов. Попробуйте позже.": "Juda ko'p so'rov. Keyinroq urinib ko'ring.",
  "Слишком много попыток входа. Попробуйте позже.": "Kirish urinishlari juda ko'p. Keyinroq urinib ko'ring.",
  "Слишком много сообщений. Подождите немного.": "Xabarlar juda ko'p. Bir oz kuting.",
  "Сообщение слишком длинное": "Xabar juda uzun",
  "Стол не найден": "Stol topilmadi",
  "Стол с таким номером уже существует": "Bunday raqamli stol allaqachon mavjud",
  "Сумма не может быть отрицательной": "Summa manfiy bo'lishi mumkin emas",
  "Товар не найден": "Mahsulot topilmadi",
  "Требуется авторизация": "Avtorizatsiya talab qilinadi",
  "Этот стол отключён": "Bu stol o'chirilgan",
  "Укажите валюту": "Valyutani kiriting",
  "Укажите название варианта": "Variant nomini kiriting",
  "Укажите начало и конец периода": "Davr boshi va oxirini ko'rsating",
  "Укажите начало и конец периода для произвольного диапазона": "Erkin diapazon uchun davr boshi va oxirini ko'rsating",
  "Файл должен быть изображением (JPEG, PNG, WEBP) до 5 МБ": "Fayl rasm bo'lishi kerak (JPEG, PNG, WEBP), 5 MB gacha",
  "Файл не получен": "Fayl qabul qilinmadi",
  "Цена не может быть отрицательной": "Narx manfiy bo'lishi mumkin emas",
};

// Messages the server builds with `${}` interpolation — matched by pattern instead of exact
// text, then rebuilt in Uzbek with the captured value. Order matters: a more specific pattern
// (e.g. "доступно ...") must be tried before a more general one sharing the same prefix, or the
// general one would swallow it first.
const DYNAMIC_PATTERNS: { pattern: RegExp; translate: (m: RegExpMatchArray) => string }[] = [
  {
    pattern: /^Нельзя удалить: в категории (\d+) товар\(ов\)$/,
    translate: (m) => `O'chirib bo'lmaydi: kategoriyada ${m[1]} ta mahsulot bor`,
  },
  {
    pattern: /^Нельзя удалить: за этим столом есть история заказов \((\d+)\)$/,
    translate: (m) => `O'chirib bo'lmaydi: bu stolda buyurtmalar tarixi bor (${m[1]})`,
  },
  {
    pattern: /^Недостаточно на складе: доступно (.+)$/,
    translate: (m) => `Omborda yetarli emas: mavjud ${m[1]}`,
  },
  {
    pattern: /^Недостаточно на складе: (.+)$/,
    translate: (m) => `Omborda yetarli emas: ${m[1]}`,
  },
  {
    pattern: /^«(.+)» больше недоступен для продажи$/,
    translate: (m) => `«${m[1]}» endi sotuvga mavjud emas`,
  },
  {
    pattern: /^«(.+)» продаётся только целым количеством$/,
    translate: (m) => `«${m[1]}» faqat butun miqdorda sotiladi`,
  },
];

/** Translates a raw server error message for display, or returns it unchanged (Russian is the
 * server's native language and the fallback UI language, so returning `message` as-is is always
 * a safe no-op — never a blank string). */
export function translateServerMessage(message: string, language: string): string {
  // Same idiom as shared/lib/dateLocale.ts / locale.ts — only "uz" is special-cased, anything
  // else (ru, an unrecognized/未detected value, ...) is left as the Russian text the server sent.
  if (language !== ("uz" satisfies SupportedLanguage)) return message;

  const exact = UZ_BY_RU[message];
  if (exact) return exact;

  for (const { pattern, translate } of DYNAMIC_PATTERNS) {
    const m = message.match(pattern);
    if (m) return translate(m);
  }

  return message;
}
