/**
 * Универсальная карточка клиента (улучшенный вариант)
 * Дизайн основан на правой части скриншота, с добавлением элементов слева
 * Одна карточка для всех разделов (Клиенты, Контракты, Шахматка)
 */

class UniversalClientCard {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.data = options.data || {};
    this.callbacks = options.callbacks || {};
    this.language = options.language || 'ru';

    if (!this.container) {
      console.error(`Container "${containerId}" not found`);
      return;
    }

    this.render();
    this.attachEventListeners();
  }

  updateData(newData) {
    this.data = { ...this.data, ...newData };
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = this.renderCard();
  }

  renderCard() {
    const {
      // Информация о клиенте
      clientName = 'Клиент',
      clientInitials = 'К',
      passport = '',
      birthDate = '',
      address = '',
      apartment = '',

      // Финансы
      issued = 0,        // Выданно всего
      received = 0,      // Получено платежей
      debt = 0,          // Остаток долга

      // Платежи
      payments = [],

      // Дополнительно
      status = 'Активный',
      lastUpdate = ''
    } = this.data;

    const debtAmount = Math.max(0, issued - received);
    const progressPercent = issued > 0 ? Math.round((received / issued) * 100) : 0;

    return `
      <div class="universal-card">
        <!-- Заголовок с информацией о клиенте -->
        <div class="card-header">
          <div class="header-top">
            <div class="client-avatar">${clientInitials}</div>
            <div class="client-info">
              <h2 class="client-name">${clientName}</h2>
              <p class="client-meta">
                ${passport ? `Паспорт: ${passport}` : ''}
                ${birthDate ? ` • ${birthDate}` : ''}
              </p>
              <p class="client-address">
                ${address ? `📍 ${address}` : ''}
                ${apartment ? ` • ${apartment}` : ''}
              </p>
            </div>
            <div class="header-status">
              <span class="status-badge">${status}</span>
              ${lastUpdate ? `<p class="last-update">${lastUpdate}</p>` : ''}
            </div>
          </div>
          <div class="header-divider"></div>
        </div>

        <!-- Оплата и чеки (финансовые показатели) -->
        <div class="payment-section">
          <h3 class="section-title">📋 Оплата и чеки</h3>
          <div class="metrics-grid">
            <!-- Получено -->
            <div class="metric-card metric-card--success">
              <div class="metric-label">Получено платежей</div>
              <div class="metric-value">${this.formatCurrency(received)}</div>
              <div class="metric-unit">USD</div>
              <div class="metric-bar">
                <div class="metric-bar-fill" style="width: 100%"></div>
              </div>
            </div>

            <!-- Остаток долга -->
            <div class="metric-card metric-card--danger">
              <div class="metric-label">Остаток долга</div>
              <div class="metric-value">${this.formatCurrency(debtAmount)}</div>
              <div class="metric-unit">USD</div>
              <div class="metric-bar">
                <div class="metric-bar-fill" style="width: ${Math.min(100, (debtAmount / issued) * 100)}%"></div>
              </div>
            </div>

            <!-- Выданно (если есть информация) -->
            <div class="metric-card metric-card--info">
              <div class="metric-label">Выданно всего</div>
              <div class="metric-value">${this.formatCurrency(issued)}</div>
              <div class="metric-unit">USD</div>
              <div class="metric-bar">
                <div class="metric-bar-fill" style="width: 100%"></div>
              </div>
            </div>
          </div>

          <!-- Прогресс оплаты -->
          <div class="progress-section">
            <div class="progress-header">
              <span class="progress-label">Прогресс оплаты</span>
              <span class="progress-percent">${progressPercent}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="progress-info">
              <span>Оплачено: ${this.formatCurrency(received)} USD</span>
              <span>•</span>
              <span>Остаток: ${this.formatCurrency(debtAmount)} USD</span>
            </div>
          </div>
        </div>

        <!-- Быстрые действия -->
        <div class="actions-section">
          <button class="action-btn action-btn--primary" data-action="payment">
            <span class="btn-icon">💳</span> Быстрая опалата
          </button>
          <button class="action-btn action-btn--secondary" data-action="history">
            <span class="btn-icon">📊</span> История
          </button>
          <button class="action-btn action-btn--secondary" data-action="contract">
            <span class="btn-icon">📄</span> Договор
          </button>
          <button class="action-btn action-btn--secondary" data-action="print">
            <span class="btn-icon">🖨️</span> Печать
          </button>
        </div>

        <!-- Платежи -->
        <div class="payments-section">
          <h3 class="section-title">💰 Платежи</h3>
          ${payments && payments.length > 0 ? `
            <table class="payments-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                ${payments.slice(0, 8).map((p, idx) => `
                  <tr class="payment-row" data-idx="${idx}">
                    <td class="payment-date">${p.date || '—'}</td>
                    <td class="payment-amount">${this.formatCurrency(p.amount)} ${p.currency || 'USD'}</td>
                    <td class="payment-status">
                      <span class="status-pill ${p.status === 'paid' ? 'status-pill--success' : 'status-pill--pending'}">
                        ${p.status === 'paid' ? '✓ Оплачено' : p.status === 'pending' ? '⏳ Ожидание' : '—'}
                      </span>
                    </td>
                    <td class="payment-action">
                      <button class="payment-action-btn" data-action="edit-payment" data-id="${idx}">✏️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${payments.length > 8 ? `
              <button class="show-all-btn" data-action="show-all-payments">
                ➕ Показать все платежи (${payments.length})
              </button>
            ` : ''}
          ` : `
            <div class="no-data-placeholder">
              <p>📭 Нет платежей</p>
            </div>
          `}
        </div>

        <!-- История платежей (если отличается от платежей выше) -->
        ${this.data.paymentHistory && this.data.paymentHistory.length > 0 ? `
          <div class="history-section">
            <h3 class="section-title">📅 История платежей</h3>
            <div class="history-list">
              ${this.data.paymentHistory.slice(0, 5).map(h => `
                <div class="history-item">
                  <div class="history-icon">${h.icon || '💵'}</div>
                  <div class="history-content">
                    <p class="history-title">${h.title || ''}</p>
                    <p class="history-date">${h.date || ''}</p>
                  </div>
                  <div class="history-amount">${this.formatCurrency(h.amount || 0)} USD</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  formatCurrency(amount) {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('ru-RU').format(Math.round(amount));
  }

  attachEventListeners() {
    // Основные действия
    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (this.callbacks[action]) {
          this.callbacks[action](this.data);
        }
      });
    });

    // Клики на строки таблицы платежей
    this.container.querySelectorAll('.payment-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.payment-action-btn')) {
          if (this.callbacks['select-payment']) {
            const idx = row.dataset.idx;
            this.callbacks['select-payment'](this.data.payments[idx], idx);
          }
        }
      });
    });
  }
}

// Экспорт если используется как модуль
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UniversalClientCard;
}
