// Load saved transactions from localStorage or start with an empty array
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

const list = document.getElementById('transaction-list');
const form = document.getElementById('transaction-form');
const modal = document.getElementById('modal');
const openBtn = document.getElementById('open-dialog');
const closeBtn = document.getElementById('close-dialog');
const themeToggle = document.getElementById('theme-toggle');
const lastRecurringKey = 'lastRecurringDate';

let chartInstance = null;

// === Save to localStorage ===
function saveTransactions() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
}

// === Render Transaction List ===
function renderTransactions() {
  list.innerHTML = '';

  if (transactions.length === 0) {
    list.innerHTML = `<li style="text-align:center; color: gray;">No transactions yet</li>`;
    renderOverview();
    renderAnalyticsCharts();
    return;
  }

  transactions.forEach(t => {
    const li = document.createElement('li');
    const isIncome = t.type === 'income';
    const icon = isIncome ? '🔺' : '🔻';
    const iconColor = isIncome ? '#10b981' : '#ef4444';
    const sign = isIncome ? '+' : '-';

    const formattedDate = new Date(t.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    li.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 22px; color: ${iconColor};">${icon}</span>
        <div>
          <strong>${t.description}</strong><br/>
          <small>${t.category}</small><br/>
          <small>${formattedDate} ${t.recurring ? '🔁' : ''}</small>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: bold; color: ${iconColor};">
          ${sign}₹${t.amount.toFixed(2)}
        </div>
        <button onclick="deleteTransaction('${t.id}')" style="font-size: 14px; margin-top: 5px;">🗑️</button>
      </div>
    `;

    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    list.appendChild(li);
  });

  renderOverview();
  renderAnalyticsCharts();
}

// === Delete Transaction ===
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderTransactions();
}

// === Form Submit ===
form.addEventListener('submit', e => {
  e.preventDefault();

  const description = form.description.value.trim();
  const amount = parseFloat(form.amount.value);
  const category = form.category.value;
  const date = form.date.value;
  const type = form.type.value;
  const recurring = document.getElementById('recurring')?.checked || false;

  if (!description || isNaN(amount) || amount <= 0 || !category || !date || !type) {
    alert('Please fill all fields correctly.');
    return;
  }

  const newTransaction = {
    id: Date.now().toString(),
    description,
    amount,
    category,
    date,
    type,
    recurring
  };

  transactions.unshift(newTransaction);
  saveTransactions();

  form.reset();
  modal.style.display = 'none';
  renderTransactions();
});

// === Modal Controls ===
openBtn.onclick = () => modal.style.display = 'block';
closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

// === Overview Cards ===
function renderOverview() {
  const overview = document.getElementById('overview');
  const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = income - expense;
  const txCount = transactions.filter(t => {
    const d = new Date(t.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  overview.innerHTML = `
    <div class="dashboard-grid">
      <div class="card income">
        <h4>Monthly Income</h4>
        <div class="value">₹${income.toFixed(2)}</div>
        <p>This month</p>
      </div>
      <div class="card expense">
        <h4>Monthly Expenses</h4>
        <div class="value">₹${expense.toFixed(2)}</div>
        <p>This month</p>
      </div>
      <div class="card balance">
        <h4>Current Balance</h4>
        <div class="value">₹${balance.toFixed(2)}</div>
        <p>Income - Expenses</p>
      </div>
      <div class="card transactions">
        <h4>Transactions</h4>
        <div class="value">${txCount}</div>
        <p>This month</p>
      </div>
    </div>
  `;
}

// === Analytics Charts (Bar + Doughnut) ===
function renderAnalyticsCharts() {
  const chartWrapper = document.getElementById('chart-container');
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const currentMonthExpenses = transactions.filter(t => {
    const date = new Date(t.date);
    return t.type === 'expense' && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  if (currentMonthExpenses.length === 0) {
    chartWrapper.innerHTML = `
      <div class="card chart">
        <h3>📊 Spending Analytics</h3>
        <p class="text-center" style="color: gray;">No expense data available for this month</p>
      </div>
    `;
    return;
  }

  const categoryTotals = {};
  currentMonthExpenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const categories = Object.keys(categoryTotals);
  const amounts = Object.values(categoryTotals);

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#f9fafb' : '#111827';
  const gridColor = isDark ? '#4b5563' : '#e5e7eb';
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];

  chartWrapper.innerHTML = `
    <div class="dashboard-grid">
      <div class="card">
        <h3>📊 Expenses by Category</h3>
        <canvas id="bar-chart" height="300"></canvas>
      </div>
      <div class="card">
        <h3>📊 Category Distribution</h3>
        <canvas id="pie-chart" height="300"></canvas>
      </div>
    </div>
  `;

  if (chartInstance?.bar) chartInstance.bar.destroy();
  if (chartInstance?.pie) chartInstance.pie.destroy();

  const barCtx = document.getElementById('bar-chart').getContext('2d');
  const pieCtx = document.getElementById('pie-chart').getContext('2d');

  chartInstance = {
    bar: new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: 'Expenses',
          data: amounts,
          backgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `₹${ctx.raw.toFixed(2)}`
            }
          },
          legend: { display: false },
          title: {
            display: true,
            text: 'Expenses by Category',
            color: textColor
          }
        },
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            ticks: {
              color: textColor,
              callback: value => `₹${value}`
            },
            grid: { color: gridColor }
          }
        }
      }
    }),

    pie: new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          label: 'Category Split',
          data: amounts,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ₹${ctx.raw}`
            }
          },
          legend: {
            position: 'bottom',
            labels: { color: textColor }
          },
          title: {
            display: true,
            text: 'Category Distribution',
            color: textColor
          }
        }
      }
    })
  };
}

// === Dark/Light Theme Toggle ===
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
  themeToggle.textContent = '☀️ Light Mode';
}

themeToggle.onclick = () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  renderAnalyticsCharts(); // Refresh charts with new theme
};

// === Apply Recurring Transactions ===
function applyRecurringTransactions() {
  const lastApplied = localStorage.getItem(lastRecurringKey);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth()}`;

  if (lastApplied === currentKey) return;

  const recurringTx = transactions.filter(t => t.recurring);

  recurringTx.forEach(t => {
    const newTx = {
      ...t,
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      date: now.toISOString().split('T')[0]
    };
    transactions.push(newTx);
  });

  if (recurringTx.length > 0) {
    saveTransactions();
    localStorage.setItem(lastRecurringKey, currentKey);
  }
}

// === Export to CSV ===
document.getElementById('export-csv').addEventListener('click', () => {
  if (transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }

  const headers = ['ID', 'Description', 'Amount', 'Category', 'Date', 'Type', 'Recurring'];
  const csvRows = [headers.join(',')];

  transactions.forEach(tx => {
    const row = [
      tx.id,
      `"${tx.description}"`,
      tx.amount,
      `"${tx.category}"`,
      tx.date,
      tx.type,
      tx.recurring ? 'Yes' : 'No'
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// === Import CSV ===
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-csv').click();
});

document.getElementById('import-csv').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const csv = e.target.result;
    const lines = csv.split('\n').map(l => l.trim()).filter(l => l);
    const [headerLine, ...rows] = lines;

    const newTransactions = [];

    rows.forEach(row => {
      const cols = row.split(',').map(c => c.trim());
      if (cols.length < 7) return;

      const [id, description, amount, category, date, type, recurring] = cols;

      newTransactions.push({
        id: id || Date.now().toString(),
        description: description.replace(/^"|"$/g, ''),
        amount: parseFloat(amount),
        category: category.replace(/^"|"$/g, ''),
        date,
        type,
        recurring: recurring?.toLowerCase() === 'yes'
      });
    });

    transactions = [...transactions, ...newTransactions];
    saveTransactions();
    renderTransactions();
    alert('Import successful!');
  };

  reader.readAsText(file);
});

applyRecurringTransactions();
renderTransactions(); // === Initial Render ===
