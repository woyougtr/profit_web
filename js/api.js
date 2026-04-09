// API 配置
const API_BASE = 'https://cfworkers.6666521.xyz';

// 汇率 API（免费，无需 Key）
const EXCHANGE_RATE_API = 'https://open.er-api.com/v6/latest/USD';

// Token 管理
const TokenManager = {
  get() {
    return localStorage.getItem('profit_token');
  },
  
  set(token) {
    localStorage.setItem('profit_token', token);
  },
  
  remove() {
    localStorage.removeItem('profit_token');
  },
  
  getHeaders() {
    const token = this.get();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }
};

// API 方法
const API = {
  // 注册
  async register(email, password) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    return data;
  },
  
  // 登录
  async login(email, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    return data;
  },
  
  // 登出
  async logout() {
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: TokenManager.getHeaders()
    });
    TokenManager.remove();
    return res.ok;
  },
  
  // 获取当前用户
  async me() {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: TokenManager.getHeaders()
    });
    if (!res.ok) throw new Error('获取用户信息失败');
    return res.json();
  },
  
  // 同步数据
  async sync(lastSyncTime = '1970-01-01T00:00:00Z', transactions = []) {
    const res = await fetch(`${API_BASE}/api/sync`, {
      method: 'POST',
      headers: TokenManager.getHeaders(),
      body: JSON.stringify({ lastSyncTime, transactions })
    });
    if (res.status === 401) {
      TokenManager.remove();
      throw new Error('登录已过期，请重新登录');
    }
    if (!res.ok) throw new Error('同步失败');
    return res.json();
  },
  
  // 获取交易记录
  async getTransactions(month = null) {
    let url = `${API_BASE}/api/transactions`;
    if (month) {
      url += `?month=${month}`;
    }
    const res = await fetch(url, {
      headers: TokenManager.getHeaders()
    });
    if (!res.ok) throw new Error('获取记录失败');
    return res.json();
  },
  
  // 创建交易
  async createTransaction(data) {
    const res = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: TokenManager.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('创建记录失败');
    return res.json();
  },
  
  // 更新交易
  async updateTransaction(id, data) {
    const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
      method: 'PUT',
      headers: TokenManager.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('更新记录失败');
    return res.json();
  },
  
  // 删除交易
  async deleteTransaction(id) {
    const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
      method: 'DELETE',
      headers: TokenManager.getHeaders()
    });
    if (!res.ok) throw new Error('删除记录失败');
    return res.ok;
  },
  
  // 获取分类
  async getCategories() {
    const res = await fetch(`${API_BASE}/api/categories`, {
      headers: TokenManager.getHeaders()
    });
    if (!res.ok) throw new Error('获取分类失败');
    return res.json();
  },
  
  // 获取账户
  async getAccounts() {
    const res = await fetch(`${API_BASE}/api/accounts`, {
      headers: TokenManager.getHeaders()
    });
    if (!res.ok) throw new Error('获取账户失败');
    return res.json();
  },
  
  // 获取美元兑人民币汇率（带自动刷新，每天首次访问更新）
  async getExchangeRate(forceRefresh = false) {
    const today = new Date().toDateString();
    const lastRefresh = localStorage.getItem('exchange_rate_date');
    const cachedRate = localStorage.getItem('exchange_rate_value');
    
    // 如果今天已经刷新过，直接用缓存
    if (!forceRefresh && lastRefresh === today && cachedRate) {
      return parseFloat(cachedRate);
    }
    
    try {
      const res = await fetch(EXCHANGE_RATE_API);
      if (res.ok) {
        const data = await res.json();
        if (data.result === 'success' && data.rates?.CNY) {
          const rate = data.rates.CNY;
          // 缓存今天的汇率
          localStorage.setItem('exchange_rate_date', today);
          localStorage.setItem('exchange_rate_value', rate.toString());
          return rate;
        }
      }
    } catch (e) {
      console.error('获取汇率失败:', e);
    }
    // 失败时用缓存或默认值
    return cachedRate ? parseFloat(cachedRate) : 7.24;
  }
};
