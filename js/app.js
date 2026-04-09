// App 状态
const App = {
  currentMonth: new Date(),
  selectedDate: null,  // 选中的日期
  transactions: [],
  exchangeRate: 7.24,
  
  // 初始化
  async init() {
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
        await this.loadExchangeRate();
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
        await this.loadExchangeRate();
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
      this.selectedDate = null;
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
      this.renderCalendar();
      this.renderHistory();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
      this.selectedDate = null;
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
      const syncResult = await API.sync('1970-01-01T00:00:00Z', []);
      this.transactions = syncResult.serverUpdates || [];
      this.renderCalendar();
      this.renderHistory();
      this.renderMonthStats();
    } catch (e) {
      console.error('加载数据失败:', e);
    }
  },
  
  // 加载汇率
  async loadExchangeRate() {
    const rate = await API.getExchangeRate();
    if (rate) {
      this.exchangeRate = rate;
      document.getElementById('exchange-rate').value = rate.toFixed(4);
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
    const editId = document.getElementById('edit-id').value;
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
    
    const noteText = note || `售价${getCurrency('sale-currency')}${salePrice} 补贴${getCurrency('subsidy-currency')}${subsidy} 成本${getCurrency('cost-currency')}${cost} 头程${getCurrency('first-shipping-currency')}${firstShipping} 尾程${getCurrency('last-shipping-currency')}${lastShipping} 汇率${rate}`;
    
    try {
      if (editId) {
        // 编辑模式
        await API.updateTransaction(editId, {
          amount: Math.abs(profit),
          note: noteText,
          occurred_at: new Date().toISOString()
        });
      } else {
        // 新增模式
        await API.createTransaction({
          account_id: 'cash',
          category_id: profit >= 0 ? 'ecommerce_profit' : 'ecommerce_loss',
          type: profit >= 0 ? 'income' : 'expense',
          amount: Math.abs(profit),
          note: noteText,
          occurred_at: this.selectedDate ? `${this.selectedDate}T12:00:00Z` : new Date().toISOString()
        });
      }
      
      await this.loadData();
      this.resetForm();
      alert('保存成功！');
    } catch (e) {
      alert('保存失败: ' + e.message);
    }
  },
  
  // 重置表单
  resetForm() {
    ['sale-price', 'subsidy', 'cost', 'first-shipping', 'last-shipping', 'note'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('edit-id').value = '';
    document.getElementById('save-btn').textContent = '保存记录';
    this.calculateProfit();
  },
  
  // 打开编辑弹窗
  openEditModal(tx) {
    this.editingId = tx.id;
    document.getElementById('edit-amount').value = tx.amount;
    document.getElementById('edit-note').value = tx.note || '';
    document.getElementById('edit-modal').style.display = 'flex';
  },
  
  // 删除记录
  async deleteRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) return;
    
    try {
      await API.deleteTransaction(id);
      await this.loadData();
    } catch (e) {
      alert('删除失败: ' + e.message);
    }
  },
  
  // 获取某天的利润
  getDayProfit(dateStr) {
    const dayTransactions = this.transactions.filter(tx => {
      const txDate = tx.occurred_at.split('T')[0];
      return txDate === dateStr && (tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss');
    });
    
    if (dayTransactions.length === 0) return null;
    
    return dayTransactions.reduce((sum, tx) => {
      return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
    }, 0);
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
      const profit = this.getDayProfit(dateStr);
      
      let className = 'calendar-day';
      const isSelected = this.selectedDate === dateStr;
      const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
      
      if (isSelected) className += ' selected';
      else if (isToday) className += ' today';
      
      if (profit !== null) {
        className += profit >= 0 ? ' has-profit' : ' has-loss';
      }
      
      // 显示金额
      let amountHtml = '';
      if (profit !== null) {
        const displayProfit = profit >= 0 ? `+${profit.toFixed(0)}` : profit.toFixed(0);
        amountHtml = `<span class="day-amount">${displayProfit}</span>`;
      }
      
      grid.innerHTML += `<div class="${className}" data-date="${dateStr}">${d}${amountHtml}</div>`;
    }
    
    // 绑定点击事件
    grid.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
      day.addEventListener('click', () => {
        const date = day.dataset.date;
        if (this.selectedDate === date) {
          this.selectedDate = null;  // 取消选择
        } else {
          this.selectedDate = date;
        }
        this.renderCalendar();
        this.renderHistory();
      });
    });
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
    
    const profitEl = document.getElementById('month-profit');
    profitEl.textContent = `¥${totalProfit >= 0 ? '' : '-'}${Math.abs(totalProfit).toFixed(2)}`;
    profitEl.style.color = totalProfit >= 0 ? 'var(--income)' : 'var(--expense)';
    document.getElementById('month-count').textContent = monthTransactions.length;
  },
  
  // 渲染历史记录
  renderHistory() {
    const titleEl = document.getElementById('history-title');
    
    let filteredTransactions = this.transactions.filter(tx => {
      return tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss';
    });
    
    // 如果选了日期，按日期筛选
    if (this.selectedDate) {
      filteredTransactions = filteredTransactions.filter(tx => {
        const txDate = tx.occurred_at.split('T')[0];
        return txDate === this.selectedDate;
      });
      const date = new Date(this.selectedDate);
      titleEl.textContent = `${date.getMonth() + 1}月${date.getDate()}日 记录`;
    } else {
      // 显示当月所有记录，按时间倒序
      const year = this.currentMonth.getFullYear();
      const month = this.currentMonth.getMonth();
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      filteredTransactions = filteredTransactions
        .filter(tx => tx.occurred_at.startsWith(monthStr))
        .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
      titleEl.textContent = '本月记录';
    }
    
    const list = document.getElementById('history-list');
    
    if (filteredTransactions.length === 0) {
      list.innerHTML = '<div class="loading">暂无记录</div>';
      return;
    }
    
    list.innerHTML = filteredTransactions.map(tx => {
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
          <div class="actions">
            <button class="edit-btn" onclick="App.openEditModal(${JSON.stringify(tx).replace(/"/g, '&quot;')})">编辑</button>
            <button class="delete-btn" onclick="App.deleteRecord('${tx.id}')">删除</button>
          </div>
        </div>
      `;
    }).join('');
  }
};

// 关闭编辑弹窗
function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

// 提交编辑
async function submitEdit() {
  const id = window.App.editingId;
  if (!id) return;
  
  const amount = parseFloat(document.getElementById('edit-amount').value);
  const note = document.getElementById('edit-note').value;
  
  if (!amount || amount <= 0) {
    alert('请输入有效金额');
    return;
  }
  
  try {
    await API.updateTransaction(id, {
      amount: amount,
      note: note
    });
    closeEditModal();
    await window.App.loadData();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => window.App = App.init());
