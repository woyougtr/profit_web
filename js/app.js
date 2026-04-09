// App 状态
const App = {
  currentMonth: new Date(),
  transactions: [],
  exchangeRate: 7.24,
  
  // 初始化
  async init() {
    // 检查登录状态
    const token = TokenManager.get();
    if (token) {
      try {
        const user = await API.me();
        this.showMainPage(user.email);
        await this.loadExchangeRate();
        await this.loadData();
      } catch (e) {
        TokenManager.remove();
        this.showAuthPage();
      }
    } else {
      this.showAuthPage();
    }
    
    this.bindEvents();
  },
  
  // 加载汇率
  async loadExchangeRate() {
    const rate = await API.getExchangeRate();
    if (rate) {
      this.exchangeRate = rate;
      document.getElementById('exchange-rate').value = rate.toFixed(4);
    }
  },
  
  // 绑定事件
  bindEvents() {
    // Tab 切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const tab = e.target.dataset.tab;
        document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
        document.getElementById('auth-error').textContent = '';
      });
    });
    
    // 登录表单
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      
      try {
        const data = await API.login(email, password);
        TokenManager.set(data.token);
        this.showMainPage(data.user.email);
        await this.loadData();
      } catch (e) {
        document.getElementById('auth-error').textContent = e.message;
      }
    });
    
    // 注册表单
    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      
      try {
        const data = await API.register(email, password);
        TokenManager.set(data.token);
        this.showMainPage(data.user.email);
        await this.loadData();
      } catch (e) {
        document.getElementById('auth-error').textContent = e.message;
      }
    });
    
    // 登出
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await API.logout();
      this.showAuthPage();
    });
    
    // 汇率变化
    document.getElementById('exchange-rate').addEventListener('input', () => {
      this.exchangeRate = parseFloat(document.getElementById('exchange-rate').value) || 7.24;
      this.calculateProfit();
    });
    
    // 输入变化时重新计算
    ['sale-price', 'subsidy', 'cost', 'first-shipping', 'last-shipping'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.calculateProfit());
    });
    
    ['sale-currency', 'subsidy-currency', 'cost-currency', 'first-shipping-currency', 'last-shipping-currency'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.calculateProfit());
    });
    
    // 保存记录
    document.getElementById('save-btn').addEventListener('click', () => this.saveRecord());
    
    // 日历导航
    document.getElementById('prev-month').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
      this.renderCalendar();
      this.renderHistory();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
      this.renderCalendar();
      this.renderHistory();
    });
  },
  
  // 显示认证页
  showAuthPage() {
    document.getElementById('auth-page').style.display = 'block';
    document.getElementById('main-page').style.display = 'none';
  },
  
  // 显示主页
  showMainPage(email) {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('main-page').style.display = 'block';
    document.getElementById('user-email').textContent = email;
  },
  
  // 加载数据
  async loadData() {
    try {
      // 同步获取最新数据
      const syncResult = await API.sync('1970-01-01T00:00:00Z', []);
      this.transactions = syncResult.serverUpdates || [];
      this.renderCalendar();
      this.renderHistory();
      this.renderMonthStats();
    } catch (e) {
      console.error('加载数据失败:', e);
    }
  },
  
  // 计算利润
  calculateProfit() {
    const rate = this.exchangeRate;
    
    const getValue = (id, currencyId) => {
      const val = parseFloat(document.getElementById(id).value) || 0;
      const currency = document.getElementById(currencyId).value;
      return currency === 'USD' ? val * rate : val;
    };
    
    const saleAmount = getValue('sale-price', 'sale-currency');
    const subsidyAmount = getValue('subsidy', 'subsidy-currency');
    const costAmount = getValue('cost', 'cost-currency');
    const firstShipAmount = getValue('first-shipping', 'first-shipping-currency');
    const lastShipAmount = getValue('last-shipping', 'last-shipping-currency');
    
    // 利润 = (售价 + 补贴 - 尾程) - 成本 - 头程
    const profit = (saleAmount + subsidyAmount - lastShipAmount) - costAmount - firstShipAmount;
    
    const preview = document.getElementById('profit-preview');
    const amountEl = document.getElementById('profit-amount');
    
    if (profit >= 0) {
      preview.classList.remove('loss');
      amountEl.textContent = `¥${profit.toFixed(2)}`;
    } else {
      preview.classList.add('loss');
      amountEl.textContent = `-¥${Math.abs(profit).toFixed(2)}`;
    }
    
    return profit;
  },
  
  // 保存记录
  async saveRecord() {
    const profit = this.calculateProfit();
    const rate = this.exchangeRate;
    
    const getValue = (id) => parseFloat(document.getElementById(id).value) || 0;
    const getCurrency = (id) => document.getElementById(id).value;
    
    const salePrice = getValue('sale-price');
    const subsidy = getValue('subsidy');
    const cost = getValue('cost');
    const firstShipping = getValue('first-shipping');
    const lastShipping = getValue('last-shipping');
    const note = document.getElementById('note').value;
    
    // 构建备注
    const noteText = note || `售价${getCurrency('sale-currency')}${salePrice} 补贴${getCurrency('subsidy-currency')}${subsidy} 成本${getCurrency('cost-currency')}${cost} 头程${getCurrency('first-shipping-currency')}${firstShipping} 尾程${getCurrency('last-shipping-currency')}${lastShipping} 汇率${rate}`;
    
    try {
      await API.createTransaction({
        account_id: 'cash',
        category_id: profit >= 0 ? 'ecommerce_profit' : 'ecommerce_loss',
        type: profit >= 0 ? 'income' : 'expense',
        amount: Math.abs(profit),
        note: noteText,
        occurred_at: new Date().toISOString()
      });
      
      // 重新加载数据
      await this.loadData();
      
      // 清空表单
      ['sale-price', 'subsidy', 'cost', 'first-shipping', 'last-shipping', 'note'].forEach(id => {
        document.getElementById(id).value = '';
      });
      
      alert('保存成功！');
    } catch (e) {
      alert('保存失败: ' + e.message);
    }
  },
  
  // 渲染日历
  renderCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    
    document.getElementById('current-month').textContent = 
      `${year}年${month + 1}月`;
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // 星期头
    ['日', '一', '二', '三', '四', '五', '六'].forEach(day => {
      grid.innerHTML += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // 第一天是星期几
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    // 空格子
    for (let i = 0; i < firstDay; i++) {
      grid.innerHTML += '<div class="calendar-day empty"></div>';
    }
    
    // 日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTransactions = this.transactions.filter(tx => {
        const txDate = tx.occurred_at.split('T')[0];
        return txDate === dateStr && (tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss');
      });
      
      let className = 'calendar-day';
      if (year === today.getFullYear() && month === today.getMonth() && d === today.getDate()) {
        className += ' today';
      }
      
      if (dayTransactions.length > 0) {
        const total = dayTransactions.reduce((sum, tx) => {
          return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
        }, 0);
        className += total >= 0 ? ' has-profit' : ' has-loss';
      }
      
      grid.innerHTML += `<div class="${className}" data-date="${dateStr}">${d}</div>`;
    }
  },
  
  // 渲染月统计
  renderMonthStats() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const monthTransactions = this.transactions.filter(tx => {
      const txDate = tx.occurred_at.split('T')[0];
      return txDate.startsWith(monthStr) && 
             (tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss');
    });
    
    const totalProfit = monthTransactions.reduce((sum, tx) => {
      return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
    }, 0);
    
    document.getElementById('month-profit').textContent = 
      `¥${totalProfit >= 0 ? '' : '-'}${Math.abs(totalProfit).toFixed(2)}`;
    document.getElementById('month-profit').style.color = totalProfit >= 0 ? 'var(--income)' : 'var(--expense)';
    document.getElementById('month-count').textContent = monthTransactions.length;
  },
  
  // 渲染历史记录
  renderHistory() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const monthTransactions = this.transactions.filter(tx => {
      const txDate = tx.occurred_at.split('T')[0];
      return txDate.startsWith(monthStr) && 
             (tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss');
    }).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    
    const list = document.getElementById('history-list');
    
    if (monthTransactions.length === 0) {
      list.innerHTML = '<div class="loading">暂无记录</div>';
      return;
    }
    
    list.innerHTML = monthTransactions.map(tx => {
      const date = new Date(tx.occurred_at);
      const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const isProfit = tx.type === 'income';
      
      return `
        <div class="history-item">
          <div class="info">
            <div class="date">${dateStr}</div>
            <div class="note">${tx.note || (isProfit ? '电商利润' : '电商亏损')}</div>
          </div>
          <div class="amount ${isProfit ? 'profit' : 'loss'}">
            ${isProfit ? '+' : '-'}¥${tx.amount.toFixed(2)}
          </div>
        </div>
      `;
    }).join('');
  }
};

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
