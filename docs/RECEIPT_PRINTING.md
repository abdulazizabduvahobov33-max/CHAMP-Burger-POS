# Печать чеков — архитектура

Статус: **реальная печать работает** — ESC/POS через WebUSB и через Web Bluetooth, любые
совместимые термопринтеры (не только XPrinter), несколько именованных принтеров на одном
устройстве. Пока нет паринга — печать идёт в окно предпросмотра, а не теряется.

## Почему печать запускается с устройства кассира, а не с сервера

Backend работает в облаке (Render). Принтер физически подключён к компьютеру/планшету кассира.
Облачный сервер не может достучаться до USB/Bluetooth-устройства в кассе — печать обязана
запускаться из браузера/устройства кассира.

## Способы подключения (транспорты)

| Транспорт | Как работает | Где доступен |
|---|---|---|
| **WebUSB** | Браузер → USB напрямую, ESC/POS-байты через `transferOut` на bulk-endpoint | Chrome/Edge (десктоп и Android, через OTG-адаптер на телефоне/планшете) |
| **Web Bluetooth** | Браузер → GATT-характеристика принтера, ESC/POS-байты частями (см. лимит MTU) | Chrome/Edge (десктоп и Android) |

Оба транспорта не требуют установки ничего на кассу — обычный человек проходит мастер
подключения (Настройки → «Чековые принтеры» → «Подключить принтер») и печатает без диалогов
печати ОС. Ни Safari, ни Firefox не поддерживают ни один из этих API — на них печать остаётся
как предпросмотр.

**Архитектурный принцип:** способ подключения — **подменяемый драйвер**
(`ReceiptPrinterDriver`), а не зашитое в код решение. Третий транспорт (например, локальный
принт-агент для сетевых принтеров) — это новый файл-драйвер и одна строка в реестре, без
переписывания остального.

## Как устроено сейчас

```
Sale (из БД) + настройки компании (/api/receipt-info)
        │
        ▼
buildReceiptDocument(sale, settings, paperWidthMm)   ← чистая функция, ничего не знает о принтерах
        │
        ▼
   ReceiptDocument        ← универсальное описание чека (строки, отступы, обрезка)
        │
        ▼
driver.print(doc, profile)   ← driver = printerRegistry по PrinterProfile.transport
```

### Профили принтеров (`PrinterProfile`)

Каждый спаренный принтер — это профиль: `{ id, name, role, transport, paperWidthMm, usb?,
bluetooth? }`, хранится **на устройстве** (`localStorage`, `printerProfilesStore.ts`), не в общих
настройках компании — у каждой кассы может быть свой принтер (или несколько). `role` —
`"register" | "kitchen" | "bar"`: сегодня к печати подключена только роль `"register"`
(`usePrintReceipt.ts` берёт первый профиль с этой ролью); `"kitchen"`/`"bar"` можно спарить и
назвать уже сейчас — маршрутизация чеков на них появится позже без изменения модели данных.

### Файлы

- `client/src/shared/printing/model.ts` — типы `ReceiptDocument`/`ReceiptLine`, `PrinterProfile`,
  `PrinterTransport`, `PrinterRole`, интерфейс `ReceiptPrinterDriver` (`isSupported`, `pair`, `print`).
- `client/src/shared/printing/buildReceiptDocument.ts` — `Sale` + настройки → `ReceiptDocument`. Не знает о печати вообще.
- `client/src/shared/printing/escpos.ts` — `ReceiptDocument` → сырые байты ESC/POS (кодировка CP1251, ширина строки).
- `client/src/shared/printing/drivers/webUsbEscPosDriver.ts` — реальная печать через WebUSB.
- `client/src/shared/printing/drivers/webBluetoothEscPosDriver.ts` — реальная печать через Web Bluetooth (см. файл — GATT service/characteristic UUID подобраны по наиболее распространённому профилю дешёвых BLE-принтеров; для нестандартного принтера это первое, что нужно проверить/добавить).
- `client/src/shared/printing/drivers/previewDriver.ts` — запасной вариант: показывает превью, когда для роли `register` не спарен ни один принтер.
- `client/src/shared/printing/printerRegistry.ts` — реестр драйверов по транспорту + `getActiveReceiptTarget()` (профиль роли `register` или превью).
- `client/src/shared/printing/printerProfilesStore.ts` — профили принтеров этого устройства (localStorage), с миграцией из старого формата Phase 9 (один принтер без имени/роли).
- `client/src/shared/printing/printerModels.ts` — пресеты моделей для шага мастера «модель принтера» (только подсказка ширины чека, не отдельный код).
- `client/src/shared/printing/usePrintReceipt.ts` — хук `printReceipt(sale)`, которым пользуются все кнопки печати.
- `client/src/shared/printing/ReceiptPreviewDialog.tsx` — окно предпросмотра (смонтировано один раз в `App.tsx`).
- `client/src/widgets/printer-wizard/PrinterSetupWizard.tsx` — пошаговый мастер подключения (Настройки → «Чековые принтеры»).
- `server/src/modules/settings/settings.service.ts` → `getReceiptSettings()` + эндпоинт `GET /api/receipt-info` — узкий, доступный и SELLER, и SUPER_ADMIN набор данных для чека.

### Где уже подключена печать

- `PosCart.tsx` — кнопка "Печать чека" в баннере после оплаты; кнопка "Повторить чек" в пустой корзине; в режиме кассы (`mode="accept"`) печать после «Принять заказ» идёт автоматически, без клика.
- `widgets/notifications/OrderNotificationStack.tsx` и `widgets/pending-orders/PendingOrdersPanel.tsx` — автопечать сразу после «Принять заказ» из очереди заказов официантов.
- `SaleHistoryDetailDialog.tsx` — кнопка "Печать чека" в деталях любого принятого чека из истории продавца.

Все они вызывают один и тот же `usePrintReceipt().printReceipt(sale)`.

## Как добавить новый транспорт или модель

1. Новый **транспорт** (например, локальный принт-агент для сетевых принтеров): новый файл в
   `drivers/`, реализующий `ReceiptPrinterDriver`; одна строка в `printerRegistry.ts`'s `DRIVERS`;
   одна кнопка в первом шаге мастера (`getPairableDrivers()` уже вернёт его автоматически).
2. Новая **модель/бренд** принтера на уже поддерживаемом транспорте: обычно ничего добавлять не
   нужно — ESC/POS достаточно стандартен. При желании добавить пункт в
   `printerModels.ts`'s `PRINTER_MODEL_PRESETS` — это только подсказка ширины чека в мастере.

Ни кнопки печати, ни `buildReceiptDocument()`, ни данные о продаже трогать не нужно — это и есть
смысл разделения на слои.
