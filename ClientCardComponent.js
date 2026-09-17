/**
 * Унифицированный компонент карточки клиента
 * Использует: Компактный вариант для мобильных, Развёрнутый для десктопа
 * Поддерживает синхронизацию данных без перезагрузки
 */

class ClientCard {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.variant = options.variant || 'auto'; // 'auto', 'compact', 'expanded', 'modern'
    this.data = options.data || {};
    this.callbacks = options.callbacks || {};
    this.theme = options.theme || 'light';

    if (!this.container) {
      console.error(`Container with id "${containerId}" not found`);
      return;
    }

    this.render();
    this.attachEventListeners();
  }

  // Обновить данные и перерендер
  updateData(newData) {
    this.data = { ...this.data, ...newData };
    this.render();
  }

  // Определить вариант на основе ширины экрана
  getVariant() {
    if (this.variant !== 'auto') return this.variant;
    return window.innerWidth < 768 ? 'compact' : 'expanded';
  }

  // Главный метод рендеринга
  render() {
    const variant = this.getVariant();

    this.container.innerHTML = variant === 'compact'
      ? this.renderCompact()
      : variant === 'modern'
      ? this.renderModern()
      : this.renderExpanded();
  }

  // Вариант 1: Компактный
  renderCompact() {
    const { name, initials, address, debt, received, lastPayments = [], onPayment, onHistory } = this.data;

    return `
      <div class="client-card client-card--compact">
        <div class="client-card__header">
          <div class="client-card__avatar">${initials || '—'}</div>
          <div class="client-card__info">
            <h3 class="client-card__name">${name || 'Клиент'}</h3>
            <p class="client-card__address">${address || '—'}</p>
          </div>
        </div>

        <div class="client-card__metrics">
          <div class="client-card__metric">
            <span class="client-card__metric-label">Остаток долга</span>
            <span class="client-card__metric-value client-card__metric-value--danger">${this.formatCurrency(debt)}</span>
          </div>
          <div class="client-card__metric">
            <span class="client-card__metric-label">Поступления</span>
            <span class="client-card__metric-value client-card__metric-value--success">${this.formatCurrency(received)}</span>
          </div>
        </div>

        <div class="client-card__actions">
          <button class="client-card__btn client-card__btn--primary" data-action="payment">💰 Быстрая опалата</button>
          <button class="client-card__btn" data-action="history">📋 История</button>
        </div>

        <div class="client-card__section">
          <p class="client-card__section-title">Последние платежи</p>
          <div class="client-card__payments">
            ${lastPayments.slice(0, 2).map(p => `
              <div class="client-card__payment-item">
                <span class="client-card__payment-date">${p.date}</span>
                <span class="client-card__payment-amount">${this.formatCurrency(p.amount)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Вариант 2: Развёрнутый
  renderExpanded() {
    const { name, initials, passport, address, debt, issued, received, progress = 0, lastPayments = [], allPayments = [] } = this.data;

    return `
      <div class="client-card client-card--expanded">
        <div class="client-card__header-expanded">
          <div class="client-card__avatar client-card__avatar--lg">${initials || '—'}</div>
          <div class="client-card__info">
            <h3 class="client-card__name">${name || 'Клиент'}</h3>
            <p class="client-card__meta">Паспорт: ${passport || '—'}</p>
            <p class="client-card__meta">📍 ${address || '—'}</p>
          </div>
        </div>

        <div class="client-card__metrics-grid">
          <div class="client-card__metric-card">
            <span class="client-card__metric-label">Выданно</span>
            <span class="client-card__metric-value">${this.formatCurrency(issued)}</span>
            <span class="client-card__metric-unit">USD</span>
          </div>
          <div class="client-card__metric-card">
            <span class="client-card__metric-label">Долг</span>
            <span class="client-card__metric-value client-card__metric-value--danger">${this.formatCurrency(debt)}</span>
            <span class="client-card__metric-unit">USD</span>
          </div>
          <div class="client-card__metric-card">
            <span class="client-card__metric-label">Прогресс</span>
            <div class="client-card__progress-bar">
              <div class="client-card__progress-fill" style="width: ${progress}%"></div>
            </div>
            <span class="client-card__metric-unit">${Math.round(progress)}%</span>
          </div>
        </div>

        <div class="client-card__content">
          <div class="client-card__section">
            <p class="client-card__section-title">Быстрые действия</p>
            <div class="client-card__quick-actions">
              <button class="client-card__action-btn client-card__action-btn--success" data-action="payment">✓ Оплата</button>
              <button class="client-card__action-btn client-card__action-btn--warning" data-action="contract">📝 Договор</button>
            </div>
          </div>

          <div class="client-card__section">
            <p class="client-card__section-title">История платежей</p>
            <table class="client-card__table">
              <tbody>
                ${(allPayments || lastPayments).slice(0, 10).map(p => `
                  <tr class="client-card__table-row">
                    <td class="client-card__table-cell">${p.date}</td>
                    <td class="client-card__table-cell client-card__table-cell--amount">${this.formatCurrency(p.amount)}</td>
                    <td class="client-card__table-cell client-card__table-cell--status">${p.status ? '✓ ' + p.status : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <button class="client-card__show-all" data-action="all-payments">+ Показать все платежи (${allPayments ? allPayments.length : lastPayments.length})</button>
          </div>
        </div>
      </div>
    `;
  }

  // Вариант 3: Современный (с анимациями)
  renderModern() {
    const { name, initials, passport, address, debt, received, progress = 0, activity = [] } = this.data;

    return `
      <div class="client-card client-card--modern">
        <div class="client-card__header-modern">
          <div class="client-card__animated-bg"></div>
          <div class="client-card__header-content">
            <div class="client-card__avatar client-card__avatar--modern">${initials || '—'}</div>
            <div class="client-card__info">
              <h3 class="client-card__name">${name || 'Клиент'}</h3>
              <p class="client-card__meta">Паспорт ${passport || '—'}</p>
            </div>
          </div>
          <div class="client-card__header-metrics">
            <div class="client-card__header-metric">
              <span class="client-card__label">Остаток</span>
              <span class="client-card__value">${this.formatCurrency(debt)}</span>
            </div>
            <div class="client-card__header-metric">
              <span class="client-card__label">Статус</span>
              <span class="client-card__value">👤 Активный</span>
            </div>
          </div>
        </div>

        <div class="client-card__modern-content">
          <div class="client-card__action-bar">
            <button class="client-card__modern-btn client-card__modern-btn--success" data-action="payment">💳 Оплата</button>
            <button class="client-card__modern-btn client-card__modern-btn--accent" data-action="call">📞 Звонок</button>
            <button class="client-card__modern-btn client-card__modern-btn--warning" data-action="email">📧 Письмо</button>
          </div>

          <div class="client-card__section">
            <p class="client-card__section-title">Платежная активность</p>
            <div class="client-card__progress-section">
              <div class="client-card__progress-bar-modern">
                <div class="client-card__progress-fill-modern" style="width: ${progress}%">
                  <span>${Math.round(progress)}% выполнено</span>
                </div>
              </div>
              <div class="client-card__stats">
                <div class="client-card__stat-item">
                  <p class="client-card__stat-label">Всего получено</p>
                  <p class="client-card__stat-value">${this.formatCurrency(received)}</p>
                </div>
                <div class="client-card__stat-item">
                  <p class="client-card__stat-label">Осталось</p>
                  <p class="client-card__stat-value">${this.formatCurrency(debt)}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="client-card__section">
            <p class="client-card__section-title">Последняя активность</p>
            <div class="client-card__timeline">
              ${(activity || []).slice(0, 3).map((item, i) => `
                <div class="client-card__timeline-item" style="animation-delay: ${i * 0.1}s">
                  <div class="client-card__timeline-icon">${item.icon || '✓'}</div>
                  <div class="client-card__timeline-content">
                    <p class="client-card__timeline-title">${item.title}</p>
                    <p class="client-card__timeline-date">${item.date}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Форматирование валюты
  formatCurrency(amount) {
    if (amount === undefined || amount === null) return '—';
    return new Intl.NumberFormat('ru-RU').format(amount);
  }

  // Подключить обработчики событий
  attachEventListeners() {
    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (this.callbacks[action]) {
          this.callbacks[action](this.data);
        }
      });
    });
  }

  // Перестроить при изменении размера окна
  onResize() {
    const oldVariant = this.variant === 'auto' ? this.getVariant() : this.variant;
    setTimeout(() => {
      const newVariant = this.getVariant();
      if (oldVariant !== newVariant) {
        this.render();
        this.attachEventListeners();
      }
    }, 100);
  }
}

// Экспортировать если используется в модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClientCard;
}
