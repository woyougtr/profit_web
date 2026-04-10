// App 状态
window.App = {
  currentMonth: new Date(),
  selectedDate: null,
  transactions: [],
  exchangeRate: 7.24,
  chartInstance: null,
  
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
    
    // 月份选择器
    document.getElementById('current-month').addEventListener('click', () => {
      this.showMonthPicker();
    });
    
    document.getElementById('picker-prev-year').addEventListener('click', () => {
      this.pickerYear--;
      this.renderMonthPicker();
    });
    
    document.getElementById('picker-next-year').addEventListener('click', () => {
      this.pickerYear++;
      this.renderMonthPicker();
    });
    
    // 日历导航
    document.getElementById('prev-month').addEventListener('click', () => {
      this.selectedDate = null;
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
      this.renderCalendar();
      this.renderHistory();
      this.renderMonthStats();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
      this.selectedDate = null;
      this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
      this.renderCalendar();
      this.renderHistory();
      this.renderMonthStats();
    });
    
    // 导出按钮
    document.getElementById('export-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('export-menu');
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    
    // 导出菜单选项
    document.querySelectorAll('#export-menu button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const range = e.target.dataset.range;
        document.getElementById('export-menu').style.display = 'none';
        
        if (range === 'current') {
          this.exportData(this.getCurrentMonthRange());
        } else if (range === 'last') {
          this.exportData(this.getLastMonthRange());
        } else if (range === 'custom') {
          this.showExportModal();
        }
      });
    });
    
    // 图表按钮
    document.getElementById('toggle-chart-btn').addEventListener('click', () => {
      this.showChartModal();
    });
    
    // 对比按钮
    document.getElementById('toggle-compare-btn').addEventListener('click', () => {
      this.showCompareModal();
    });
    
    // 点击其他区域关闭下拉菜单
    document.addEventListener('click', () => {
      document.getElementById('export-menu').style.display = 'none';
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
        await API.updateTransaction(editId, {
          amount: Math.abs(profit),
          note: noteText,
          occurred_at: new Date().toISOString()
        });
      } else {
        await API.createTransaction({
          account_id: 'cash',
          category_id: profit >= 0 ? 'ecommerce_profit' : 'ecommerce_loss',
          type: profit >= 0 ? 'income' : 'expense',
          amount: Math.abs(profit),
          note: noteText,
          occurred_at: (() => {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            if (!this.selectedDate || this.selectedDate === today) {
              return now.toISOString();
            }
            return `${this.selectedDate}T12:00:00Z`;
          })()
        });
      }
      
      await this.loadData();
      this.resetForm();
      this.showSaveSuccess();
    } catch (e) {
      this.showSaveError();
    }
  },
  
  // 显示保存成功动画
  showSaveSuccess() {
    const btn = document.getElementById('save-btn');
    btn.classList.add('success');
    btn.textContent = '已保存';
    setTimeout(() => {
      btn.classList.remove('success');
      btn.textContent = '保存记录';
    }, 1500);
  },
  
  // 显示保存失败动画
  showSaveError() {
    const btn = document.getElementById('save-btn');
    btn.classList.add('error');
    setTimeout(() => {
      btn.classList.remove('error');
    }, 400);
    this.showToast('保存失败', 'error');
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
  
  // 删除记录（显示确认弹窗）
  deleteRecord(id) {
    this.deleteId = id;
    document.getElementById('delete-modal').style.display = 'flex';
  },
  
  // Toast 提示
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: ${type === 'error' ? '#EF5350' : '#4CAF7C'};
      color: white;
      border-radius: 10px;
      font-size: 14px;
      z-index: 2000;
      animation: toastIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
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
          this.selectedDate = null;
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
  
  // 显示月份选择器
  showMonthPicker() {
    this.pickerYear = this.currentMonth.getFullYear();
    this.pickerMonth = this.currentMonth.getMonth();
    this.renderMonthPicker();
    document.getElementById('month-picker').style.display = 'block';
    
    // 点击其他区域关闭
    setTimeout(() => {
      document.addEventListener('click', this.monthPickerClickOutside);
    }, 0);
  },
  
  // 关闭月份选择器
  closeMonthPicker() {
    document.getElementById('month-picker').style.display = 'none';
    document.removeEventListener('click', this.monthPickerClickOutside);
  },
  
  // 点击外部关闭
  monthPickerClickOutside(e) {
    const picker = document.getElementById('month-picker');
    const trigger = document.getElementById('current-month');
    if (!picker.contains(e.target) && !trigger.contains(e.target)) {
      window.App.closeMonthPicker();
    }
  },
  
  // 渲染月份选择器
  renderMonthPicker() {
    document.getElementById('picker-year').textContent = this.pickerYear + '年';
    const grid = document.getElementById('month-picker-grid');
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const today = new Date();
    const currentYear = this.currentMonth.getFullYear();
    
    grid.innerHTML = months.map((m, i) => {
      const month = i;
      const isActive = this.pickerYear === currentYear && month === this.pickerMonth;
      const isFuture = this.pickerYear > today.getFullYear() || 
                       (this.pickerYear === today.getFullYear() && month > today.getMonth());
      return `<button class="${isActive ? 'active' : ''} ${isFuture ? 'disabled' : ''}" 
                     data-month="${month}" 
                     onclick="window.App.selectMonth(${month})">${m}</button>`;
    }).join('');
  },
  
  // 选择月份
  selectMonth(month) {
    this.currentMonth = new Date(this.pickerYear, month, 1);
    this.selectedDate = null;
    this.closeMonthPicker();
    this.renderCalendar();
    this.renderHistory();
    this.renderMonthStats();
  },
  
  // 月度对比弹窗
  showCompareModal() {
    const currentYear = this.currentMonth.getFullYear();
    const currentMonth = this.currentMonth.getMonth();
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
    
    const getMonthData = (monthStr) => {
      const txs = this.transactions.filter(tx => {
        const txDate = tx.occurred_at.split('T')[0];
        return txDate.startsWith(monthStr) && 
               (tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss');
      });
      const profit = txs.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
      return { profit, count: txs.length };
    };
    
    const current = getMonthData(currentMonthStr);
    const last = getMonthData(lastMonthStr);
    
    // 更新标题
    const lastMonthName = `${lastMonthDate.getMonth() + 1}月`;
    const currentMonthName = `${currentMonth + 1}月`;
    document.getElementById('compare-modal-title').textContent = `${currentMonthName} vs ${lastMonthName}`;
    
    // 更新数值
    document.getElementById('compare-current-value').textContent = `¥${Math.abs(current.profit).toFixed(2)}`;
    document.getElementById('compare-current-count').textContent = `${current.count} 笔`;
    document.getElementById('compare-last-value').textContent = `¥${Math.abs(last.profit).toFixed(2)}`;
    document.getElementById('compare-last-count').textContent = `${last.count} 笔`;
    
    // 更新对比结果
    const resultDiv = document.getElementById('compare-result');
    const changeDiv = resultDiv.querySelector('.compare-change');
    const summaryDiv = resultDiv.querySelector('.compare-summary');
    
    if (last.profit === 0 && current.profit === 0) {
      changeDiv.textContent = '--';
      changeDiv.className = 'compare-change neutral';
      summaryDiv.textContent = '两个月都没有数据';
    } else if (last.profit === 0) {
      changeDiv.textContent = current.profit >= 0 ? '+¥' + current.profit.toFixed(2) : '-¥' + Math.abs(current.profit).toFixed(2);
      changeDiv.className = 'compare-change ' + (current.profit >= 0 ? 'up' : 'down');
      summaryDiv.textContent = '上月无数据';
    } else {
      const change = ((current.profit - last.profit) / Math.abs(last.profit)) * 100;
      const isUp = change >= 0;
      changeDiv.textContent = `${isUp ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%`;
      changeDiv.className = 'compare-change ' + (isUp ? 'up' : 'down');
      
      const diff = current.profit - last.profit;
      if (isUp) {
        summaryDiv.textContent = `比上月多赚 ¥${diff.toFixed(2)}`;
      } else {
        summaryDiv.textContent = `比上月少赚 ¥${Math.abs(diff).toFixed(2)}`;
      }
    }
    
    document.getElementById('compare-modal').style.display = 'flex';
  },
  
  // 渲染历史记录
  renderHistory() {
    const titleEl = document.getElementById('history-title');
    
    let filteredTransactions = this.transactions.filter(tx => {
      return tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss';
    });
    
    if (this.selectedDate) {
      filteredTransactions = filteredTransactions.filter(tx => {
        const txDate = tx.occurred_at.split('T')[0];
        return txDate === this.selectedDate;
      });
      const date = new Date(this.selectedDate);
      titleEl.textContent = `${date.getMonth() + 1}月${date.getDate()}日 记录 (${filteredTransactions.length}条)`;
    } else {
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
            <button class="edit-btn" onclick="window.App.openEditModal(${JSON.stringify(tx).replace(/"/g, '&quot;')})">编辑</button>
            <button class="delete-btn" onclick="window.App.deleteRecord('${tx.id}')">删除</button>
          </div>
        </div>
      `;
    }).join('');
  },
  
  // ========== 导出 Excel ==========
  getCurrentMonthRange() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
    return { start, end };
  },
  
  getLastMonthRange() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const lastMonthDate = new Date(year, month - 1, 1);
    const lYear = lastMonthDate.getFullYear();
    const lMonth = lastMonthDate.getMonth() + 1;
    const start = `${lYear}-${String(lMonth).padStart(2, '0')}-01`;
    const end = `${lYear}-${String(lMonth).padStart(2, '0')}-${new Date(lYear, lMonth, 0).getDate()}`;
    return { start, end };
  },
  
  exportData(range) {
    const { start, end } = range;
    
    const filteredTransactions = this.transactions.filter(tx => {
      const txDate = tx.occurred_at.split('T')[0];
      return txDate >= start && txDate <= end && 
             (tx.category_id === 'ecommerce_profit' || tx.category_id === 'ecommerce_loss');
    }).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    
    if (filteredTransactions.length === 0) {
      this.showToast('该范围内没有数据', 'error');
      return;
    }
    
    const data = filteredTransactions.map(tx => {
      const date = new Date(tx.occurred_at);
      return {
        '日期': `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        '时间': `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
        '类型': tx.type === 'income' ? '利润' : '亏损',
        '金额': tx.amount,
        '备注': tx.note || ''
      };
    });
    
    // 添加汇总
    const totalProfit = filteredTransactions.reduce((sum, tx) => 
      sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
    
    data.push({});
    data.push({
      '日期': '汇总',
      '时间': '',
      '类型': totalProfit >= 0 ? '净利润' : '净亏损',
      '金额': Math.abs(totalProfit),
      '备注': `${filteredTransactions.length} 条记录`
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '利润记录');
    XLSX.writeFile(wb, `利润记录_${start}_${end}.xlsx`);
    
    this.showToast('导出成功！');
  },
  
  showExportModal() {
    const range = this.getCurrentMonthRange();
    document.getElementById('export-start').value = range.start;
    document.getElementById('export-end').value = range.end;
    document.getElementById('export-modal').style.display = 'flex';
  },
  
  // ========== 图表 ==========
  showChartModal() {
    document.getElementById('chart-modal').style.display = 'flex';
    this.renderChart();
  },
  
  renderChart() {
    const ctx = document.getElementById('profit-chart');
    if (!ctx) return;
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
    
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const today = new Date();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month + 1, 0).getDate();
    
    // 准备数据（只到今天）
    const labels = [];
    const cumulativeData = [];
    let cumulative = 0;
    let lastValidIndex = -1;
    
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      labels.push(`${month + 1}/${d}`);
      
      const profit = this.getDayProfit(dateStr);
      if (profit !== null) {
        cumulative += profit;
        lastValidIndex = d - 1;
      }
      
      // 没数据的日期设为null，这样图表会断开
      cumulativeData.push(profit !== null ? cumulative : null);
    }
    
    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '累计利润',
          data: cumulativeData,
          borderColor: '#4CAF7C',
          backgroundColor: 'rgba(76, 175, 124, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
          spanGaps: true  // 连接断开的线段
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            filter: (item) => item.raw !== null,
            callbacks: {
              label: (context) => context.raw !== null ? `¥${context.raw.toFixed(2)}` : ''
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              color: '#f0f0f0'
            },
            ticks: {
              callback: (value) => '¥' + value.toFixed(0)
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxTicksLimit: 15
            }
          }
        }
      }
    });
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
    window.App.showToast('请输入有效金额', 'error');
    return;
  }
  
  try {
    await API.updateTransaction(id, {
      amount: amount,
      note: note
    });
    closeEditModal();
    await window.App.loadData();
    window.App.showToast('保存成功！');
  } catch (e) {
    window.App.showToast('保存失败: ' + e.message, 'error');
  }
}

// 关闭对比弹窗
function closeCompareModal() {
  document.getElementById('compare-modal').style.display = 'none';
}

// 关闭图表弹窗
function closeChartModal() {
  document.getElementById('chart-modal').style.display = 'none';
}

// 关闭导出弹窗
function closeExportModal() {
  document.getElementById('export-modal').style.display = 'none';
}

// 确认导出
function confirmExport() {
  const start = document.getElementById('export-start').value;
  const end = document.getElementById('export-end').value;
  
  if (!start || !end) {
    window.App.showToast('请选择日期范围', 'error');
    return;
  }
  
  if (start > end) {
    window.App.showToast('开始日期不能晚于结束日期', 'error');
    return;
  }
  
  closeExportModal();
  window.App.exportData({ start, end });
}

// 添加 toast 动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes toastOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
`;
document.head.appendChild(style);

// 关闭删除弹窗
function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
}

// 确认删除
async function confirmDelete() {
  const id = window.App.deleteId;
  if (!id) return;
  
  try {
    await API.deleteTransaction(id);
    closeDeleteModal();
    await window.App.loadData();
    window.App.showToast('删除成功');
  } catch (e) {
    window.App.showToast('删除失败: ' + e.message, 'error');
  }
}

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
