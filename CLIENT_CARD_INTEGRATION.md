# 📋 Интеграция унифицированной карточки клиента

## 🎯 Обзор

Компонент `ClientCard` объединяет две отдельные карточки клиента из разных разделов в **один переиспользуемый компонент**.

**Файлы:**
- `ClientCardComponent.js` — логика компонента
- `ClientCardComponent.css` — все стили для трёх вариантов

## 🚀 Быстрый старт

### 1️⃣ Подключить в `index.html`

```html
<!-- В секции <head> -->
<link rel="stylesheet" href="/ClientCardComponent.css">

<!-- Перед </body> -->
<script src="/ClientCardComponent.js"></script>
```

### 2️⃣ Использовать в коде

```javascript
// Создать карточку
const card = new ClientCard('card-container', {
  variant: 'auto', // 'compact', 'expanded', 'modern', или 'auto' (адаптивный)
  data: {
    name: 'Давлатхочаева Тамано Аломидиновна',
    initials: 'ДА',
    passport: 'AD1228834',
    address: 'Блок А / Дарсметохон 2, №10-3',
    debt: 13698,
    issued: 21300,
    received: 21300,
    progress: 64,
    lastPayments: [
      { date: '30/06/2026', amount: 2400, status: 'Чес' },
      { date: '20/05/2026', amount: 1000 }
    ],
    allPayments: [
      { date: '30/06/2026', amount: 2400, status: 'Чес' },
      { date: '20/05/2026', amount: 1000 },
      { date: '29/04/2026', amount: 1000 }
    ],
    activity: [
      { icon: '✓', title: 'Оплачено 2 400 USD', date: '30/06/2026' },
      { icon: '→', title: 'Начислено за период', date: '01/06/2026' }
    ]
  },
  callbacks: {
    payment: (data) => console.log('Оплата', data),
    history: (data) => console.log('История', data),
    contract: (data) => console.log('Договор', data),
    call: (data) => console.log('Звонок', data),
    email: (data) => console.log('Письмо', data),
    'all-payments': (data) => console.log('Все платежи', data)
  }
});
```

### 3️⃣ HTML контейнер

```html
<!-- В нужном месте в HTML -->
<div id="card-container"></div>
```

## 📊 Три варианта карточки

### Вариант 1: Компактный (Compact)
**Когда использовать:** Мобильные устройства, списки клиентов, боковые панели

```javascript
const card = new ClientCard('container', {
  variant: 'compact',
  data: { /* данные */ }
});
```

**Особенности:**
- Минимальная высота
- 2 колонки метрик (Долг/Поступления)
- Быстрые действия
- Последние 2 платежа

### Вариант 2: Развёрнутый (Expanded)
**Когда использовать:** Десктоп, подробный просмотр, шахматка контрактов

```javascript
const card = new ClientCard('container', {
  variant: 'expanded',
  data: { /* данные */ }
});
```

**Особенности:**
- Полная информация
- 3 колонки метрик (Выданно/Долг/Прогресс)
- Таблица с 10 платежами
- Цветные кнопки действий

### Вариант 3: Современный (Modern)
**Когда использовать:** Презентации, красивые дашборды, главная страница

```javascript
const card = new ClientCard('container', {
  variant: 'modern',
  data: { /* данные */ }
});
```

**Особенности:**
- Градиентный анимированный заголовок
- Интерактивные кнопки с эффектами
- Плавающие элементы в фоне
- Timeline активности с анимациями

### Адаптивный вариант (Auto)
```javascript
const card = new ClientCard('container', {
  variant: 'auto', // Мобильный < 768px → compact, остальное → expanded
  data: { /* данные */ }
});
```

## 🔄 Обновление данных (без перезагрузки)

```javascript
// Обновить конкретные поля
card.updateData({
  debt: 10000,
  progress: 75,
  lastPayments: [
    { date: '31/07/2026', amount: 3698 }
  ]
});

// Компонент автоматически перерендеризуется
```

## 📱 Реактивность

Компонент автоматически переключается между вариантами при изменении размера окна:

```javascript
window.addEventListener('resize', () => {
  card.onResize();
});
```

## 🎨 Кастомизация

### Изменить цвета (в CSS переменных)

Отредактируйте `ClientCardComponent.css`:

```css
:root {
  --cc-primary: #39B980;        /* Основной цвет */
  --cc-danger: #E53E3E;         /* Цвет долга */
  --cc-success: #22863A;        /* Цвет успеха */
  --cc-warning: #DD6B20;        /* Цвет предупреждения */
  --cc-radius: 10px;            /* Скругление */
}
```

### Добавить новые кнопки

В методе `renderCompact()` добавьте новую кнопку и обработчик:

```javascript
// В data-action
<button class="client-card__btn" data-action="sms">💬 SMS</button>

// В callbacks
callbacks: {
  sms: (data) => { /* ваша логика */ }
}
```

## 🔗 Интеграция с существующим кодом

### Замена старой карточки клиента

**Было:**
```javascript
// Старая функция
function renderClientCard(clientId) {
  const client = getClient(clientId);
  document.getElementById('card').innerHTML = /* HTML... */
}
```

**Стало:**
```javascript
// Новая функция
function renderClientCard(clientId) {
  const client = getClient(clientId);
  const card = new ClientCard('card', {
    variant: 'auto',
    data: {
      name: client.name,
      initials: client.initials,
      debt: client.debt,
      // ... остальные поля
    },
    callbacks: {
      payment: () => handlePayment(client),
      history: () => showHistory(client)
    }
  });
}
```

## 💾 Синхронизация данных

Компонент **НЕ синхронизирует** данные автоматически с сервером. Используйте `updateData()`:

```javascript
// Подписаться на изменения в реальном времени
supabase
  .from('clients')
  .on('*', payload => {
    card.updateData(payload.new);
  })
  .subscribe();

// Или при получении обновлений
async function refreshClient(clientId) {
  const data = await fetchClientData(clientId);
  card.updateData(data);
}
```

## 📊 Структура данных

```javascript
{
  // Информация о клиенте
  name: string,           // ФИО
  initials: string,       // Инициалы для аватара (макс 3 символа)
  passport: string,       // Номер паспорта
  address: string,        // Адрес

  // Финансовые показатели
  debt: number,           // Остаток долга (USD)
  issued: number,         // Выданно всего (USD)
  received: number,       // Поступления (USD)
  progress: number,       // Прогресс выполнения (0-100)

  // История платежей
  lastPayments: [         // Последние платежи (compact, modern)
    { date: string, amount: number, status?: string }
  ],
  allPayments: [          // Все платежи (expanded)
    { date: string, amount: number, status?: string }
  ],

  // Активность
  activity: [             // Для modern варианта
    { icon: string, title: string, date: string }
  ]
}
```

## 🎯 Примеры использования

### Вариант 1: Список клиентов

```html
<div id="clients-list"></div>
```

```javascript
async function renderClientsList() {
  const clients = await fetchClients();
  const container = document.getElementById('clients-list');
  
  clients.forEach((client, index) => {
    const div = document.createElement('div');
    div.id = `client-${client.id}`;
    container.appendChild(div);
    
    new ClientCard(`client-${client.id}`, {
      variant: 'compact',
      data: {
        name: client.name,
        debt: client.debt,
        // ...
      },
      callbacks: {
        payment: () => openPaymentModal(client.id)
      }
    });
  });
}
```

### Вариант 2: Детальный просмотр

```html
<div id="client-detail"></div>
```

```javascript
function showClientDetail(clientId) {
  const client = getClientDetail(clientId);
  const card = new ClientCard('client-detail', {
    variant: 'expanded',
    data: {
      name: client.name,
      passport: client.passport,
      address: client.address,
      debt: client.debt,
      issued: client.issued,
      received: client.received,
      progress: (client.received / client.issued) * 100,
      allPayments: client.payments
    },
    callbacks: {
      payment: () => openPaymentModal(clientId),
      contract: () => showContract(clientId)
    }
  });
}
```

### Вариант 3: Главная страница

```html
<div id="featured-client"></div>
```

```javascript
function showFeaturedClient(clientId) {
  const client = getClient(clientId);
  new ClientCard('featured-client', {
    variant: 'modern',
    data: {
      name: client.name,
      initials: client.initials,
      debt: client.debt,
      received: client.received,
      progress: calculateProgress(client),
      activity: getRecentActivity(clientId)
    },
    callbacks: {
      payment: () => handlePayment(clientId),
      call: () => initiateCall(clientId),
      email: () => sendEmail(clientId)
    }
  });
}
```

## 🛠️ Методы компонента

```javascript
const card = new ClientCard('container', options);

// Обновить данные
card.updateData(newData);

// Получить текущие данные
console.log(card.data);

// Получить текущий вариант
console.log(card.getVariant());

// Перестроить при изменении размера
card.onResize();

// Отформатировать сумму
card.formatCurrency(1234567); // → "1 234 567"
```

## 🐛 Отладка

```javascript
// Включить логирование
const card = new ClientCard('container', {
  data: { /* ... */ },
  debug: true
});

// Консоль будет выводить события клика
```

## ✨ Особенности

✅ **Три варианта** — выбирайте нужный  
✅ **Адаптивный дизайн** — работает на всех устройствах  
✅ **Тёмный режим** — поддержка @media (prefers-color-scheme)  
✅ **Синхронизация данных** — updateData() без перезагрузки  
✅ **Анимации** — плавные переходы и slide-in эффекты  
✅ **Доступность** — правильный HTML и семантика  
✅ **Производительность** — минимальный переренд  

## 📝 Лицензия и примечания

- Компонент использует ванильный JavaScript (нет зависимостей)
- CSS использует CSS переменные для кастомизации
- Совместим с современными браузерами (Chrome, Firefox, Safari, Edge)
- IE11 не поддерживается (используются CSS Grid и CSS variables)

## 🔄 Миграция со старого кода

Если у вас есть старые версии этих карточек:

1. Найдите функции рендеринга старых карточек
2. Замените их на `new ClientCard(...)`
3. Обновите структуру данных согласно документации
4. Протестируйте синхронизацию платежей

## 📞 Поддержка

Компонент полностью переиспользуемый и может быть скопирован в другие проекты.

Все стили самодостаточны и не зависят от глобального CSS вашего проекта.
