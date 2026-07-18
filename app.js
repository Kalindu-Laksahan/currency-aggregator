/* ================================================================
   ExchangeWatch LK — app.js
   Full application logic: data fetching, parsing, rendering,
   skeleton loader, Chart.js integration, and event handling.
   Zero dependencies beyond Chart.js (loaded via CDN).
   ================================================================ */

'use strict';

/* ================================================================
   SECTION A — CONFIGURATION & CONSTANTS
   ================================================================ */

const CONFIG = {
  SHEET_ID:       '1ZXvoy_yDJEFN5LA3mrCFzg7L2REZ3gY4X4mQIXJ-r1Q',
  BUYING_SHEET:   'Buying Rates Dashboard',
  SELLING_SHEET:  'Selling Rates Dashboard',
  HISTORY_PATH:   'public/data/history.json',
  SKELETON_ROWS:  20,
};

/**
 * 24 target currencies with their column index in the gviz table.
 * Indices 0-3 are: Bank, Range, Buy Col, Sell Col (metadata).
 * Currency values start at index 4.
 */
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',              flag: '🇺🇸', index: 4  },
  { code: 'GBP', name: 'British Pound',           flag: '🇬🇧', index: 5  },
  { code: 'EUR', name: 'Euro',                    flag: '🇪🇺', index: 6  },
  { code: 'AED', name: 'UAE Dirham',              flag: '🇦🇪', index: 7  },
  { code: 'AUD', name: 'Australian Dollar',       flag: '🇦🇺', index: 8  },
  { code: 'BHD', name: 'Bahraini Dinar',          flag: '🇧🇭', index: 9  },
  { code: 'CAD', name: 'Canadian Dollar',         flag: '🇨🇦', index: 10 },
  { code: 'CHF', name: 'Swiss Franc',             flag: '🇨🇭', index: 11 },
  { code: 'CNY', name: 'Chinese Yuan',            flag: '🇨🇳', index: 12 },
  { code: 'DKK', name: 'Danish Krone',            flag: '🇩🇰', index: 13 },
  { code: 'HKD', name: 'Hong Kong Dollar',        flag: '🇭🇰', index: 14 },
  { code: 'JOD', name: 'Jordanian Dinar',         flag: '🇯🇴', index: 15 },
  { code: 'JPY', name: 'Japanese Yen',            flag: '🇯🇵', index: 16 },
  { code: 'KWD', name: 'Kuwaiti Dinar',           flag: '🇰🇼', index: 17 },
  { code: 'NOK', name: 'Norwegian Krone',         flag: '🇳🇴', index: 18 },
  { code: 'NZD', name: 'New Zealand Dollar',      flag: '🇳🇿', index: 19 },
  { code: 'OMR', name: 'Omani Rial',              flag: '🇴🇲', index: 20 },
  { code: 'QAR', name: 'Qatari Riyal',            flag: '🇶🇦', index: 21 },
  { code: 'RMB', name: 'Renminbi (RMB)',          flag: '🇨🇳', index: 22 },
  { code: 'SAR', name: 'Saudi Riyal',             flag: '🇸🇦', index: 23 },
  { code: 'SEK', name: 'Swedish Krona',           flag: '🇸🇪', index: 24 },
  { code: 'SGD', name: 'Singapore Dollar',        flag: '🇸🇬', index: 25 },
  { code: 'TBH', name: 'Thai Baht',              flag: '🇹🇭', index: 26 },
  { code: 'ZAR', name: 'South African Rand',      flag: '🇿🇦', index: 27 },
];

/** Fixed 20-bank master list as structural reference */
const MASTER_BANKS = [
  'Amana', 'Bank of China', 'BOC', 'Cargills', 'Commercial',
  'Deutsche Bank', 'DFCC', 'HNB', 'HSBC', 'MCB',
  'NDB', 'NSB', 'NTB', 'Pan Asia', 'Peoples Bank',
  'Sampath', 'Seylan', 'Standard Chartered', 'State Bank of India', 'Union Bank',
];

/** 20 visually distinct colors for Chart.js (HSL evenly spaced) */
const BANK_COLORS = MASTER_BANKS.map((_, i) => {
  const hue  = Math.round((i * 360) / MASTER_BANKS.length);
  const sat  = 65 + (i % 3) * 5;
  const lig  = 55 + (i % 4) * 4;
  return `hsl(${hue}, ${sat}%, ${lig}%)`;
});


/* ================================================================
   SECTION B — APPLICATION STATE
   ================================================================ */

const state = {
  buyingData:    [],   // parsed rows from Buying Rates Dashboard
  sellingData:   [],   // parsed rows from Selling Rates Dashboard
  currency:      'USD',
  mode:          'buying',   // 'buying' | 'selling'
  chartMode:     'buying',
  historyData:   [],
  chartInstance: null,
  isLoading:     true,
};


/* ================================================================
   SECTION C — DATA FETCHER
   ================================================================ */

/**
 * Fetches a Google Sheet tab via the GViz JSON API.
 * Strips the JSONP `/*O_o*\/` padding before parsing.
 * @param {string} sheetName - The exact tab name
 * @returns {Promise<Object>} Parsed GViz response object
 */
async function fetchSheetData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Network error fetching "${sheetName}": HTTP ${response.status}`);
  }

  const text = await response.text();

  // Strip JSONP wrapper: /*O_o*/ google.visualization.Query.setResponse({...});
  // Use indexOf to find the FIRST '(' and lastIndexOf to find the matching close,
  // which is robust against nested braces inside the JSON payload.
  const startIdx = text.indexOf('google.visualization.Query.setResponse(');
  if (startIdx === -1) {
    throw new Error(`Unexpected response format from Google Sheets API for sheet: "${sheetName}"`);
  }
  const jsonStart = text.indexOf('(', startIdx) + 1;
  // Find the matching closing paren by scanning from the end
  const jsonEnd = text.lastIndexOf(')');
  if (jsonStart <= 0 || jsonEnd <= jsonStart) {
    throw new Error(`Could not extract JSON payload from GViz response for sheet: "${sheetName}"`);
  }
  const jsonStr = text.slice(jsonStart, jsonEnd);

  return JSON.parse(jsonStr);
}

/**
 * Attempts to load 30-day history from local JSON file.
 * Returns empty array if file doesn't exist or can't be parsed.
 */
async function fetchHistoryData() {
  try {
    const response = await fetch(CONFIG.HISTORY_PATH, { cache: 'no-cache' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}


/* ================================================================
   SECTION D — DATA CLEANSING MIDDLEWARE
   ================================================================ */

/**
 * Normalizes a raw cell value from the GViz API.
 * Converts invalid/non-numeric values to null.
 * @param {*} v - Raw value from row.c[n].v or row.c[n].f
 * @returns {number|null}
 */
function cleanValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number')         return isFinite(v) ? v : null;

  const str = String(v).trim();

  // Reject known invalid sentinel strings
  // Note: '0' is also treated as N/A here because some cells (e.g. Peoples Bank DKK)
  //       use literal '0' as a placeholder meaning "not available".
  if (
    str === '' ||
    str === '-' ||
    str === '--' ||
    str === '—' ||
    str === '0' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'na' ||
    str.toLowerCase() === 'nil' ||
    str.toLowerCase() === 'null'
  ) return null;

  // Strip commas (thousands separators) then parse
  const num = parseFloat(str.replace(/,/g, ''));
  return isNaN(num) ? null : num;
}


/* ================================================================
   SECTION E — DATA PARSER
   ================================================================ */

/**
 * Transforms a raw GViz API response into a clean array of
 * { bank: string, rates: { [currencyCode]: number|null } } objects.
 *
 * Only rows with a valid string in column 0 (Bank Name) are kept.
 * Header/summary rows are filtered out.
 *
 * @param {Object} parsedResponse - The parsed JSON from fetchSheetData()
 * @returns {Array<{bank: string, rates: Object}>}
 */
function parseRows(parsedResponse) {
  const table = parsedResponse?.table;
  if (!table?.rows) return [];

  const results = [];

  for (const row of table.rows) {
    if (!row?.c || !row.c[0]) continue;

    const rawBankVal = row.c[0].v;
    if (rawBankVal === null || rawBankVal === undefined) continue;

    const bankName = String(rawBankVal).trim();
    if (!bankName || bankName.toLowerCase() === 'bank') continue;

    // Build rates map for all 24 currencies
    const rates = {};
    for (const cur of CURRENCIES) {
      const cell   = row.c[cur.index];
      const rawVal = cell?.v ?? cell?.f ?? null;
      rates[cur.code] = cleanValue(rawVal);
    }

    results.push({ bank: bankName, rates });
  }

  return results;
}


/* ================================================================
   SECTION F — RENDER ENGINE
   ================================================================ */

/**
 * Main render function — builds the exchange rate table.
 * Called on: initial load, currency change, mode tab change.
 */
function renderTable() {
  const { buyingData, sellingData, currency, mode } = state;

  // Build lookup maps keyed by bank name
  const sellMap = Object.fromEntries(sellingData.map(d => [d.bank, d.rates[currency]]));
  const buyMap  = Object.fromEntries(buyingData.map(d => [d.bank, d.rates[currency]]));

  // Construct unified row objects with spread
  const rows = buyingData.map(item => {
    const buyRate  = item.rates[currency] ?? null;
    const sellRate = sellMap[item.bank]   ?? null;

    return {
      bank:        item.bank,
      buyRate,
      sellRate,
      displayRate: mode === 'buying' ? buyRate : sellRate,
    };
  });

  // Compute benchmark values for badges
  const allBuyRates  = rows.map(r => r.buyRate).filter(v => v !== null);
  const allSellRates = rows.map(r => r.sellRate).filter(v => v !== null);
  const maxBuyRate   = allBuyRates.length  ? Math.max(...allBuyRates)  : null;
  const minSellRate  = allSellRates.length ? Math.min(...allSellRates) : null;
  const minBuyRate   = allBuyRates.length  ? Math.min(...allBuyRates)  : null;
  const maxSellRate  = allSellRates.length ? Math.max(...allSellRates) : null;

  // Sort: descending for buying (higher = you get more LKR per unit),
  //       ascending for selling (lower = you pay fewer LKR per unit)
  rows.sort((a, b) => {
    if (a.displayRate === null && b.displayRate === null) return 0;
    if (a.displayRate === null) return 1;
    if (b.displayRate === null) return -1;
    return mode === 'buying'
      ? b.displayRate - a.displayRate
      : a.displayRate - b.displayRate;
  });

  // Compute % vs Best for each row:
  //   Buying  → how many % below the best (MAX) rate this bank is
  //   Selling → how many % above the best (MIN) rate this bank is
  //   Best bank always gets 0.00%
  const bestRefRate = mode === 'buying' ? maxBuyRate : minSellRate;
  rows.forEach(row => {
    if (row.displayRate === null || bestRefRate === null) {
      row.pctVsBest = null;
      return;
    }
    row.pctVsBest = mode === 'buying'
      ? ((bestRefRate - row.displayRate) / bestRefRate) * 100
      : ((row.displayRate - bestRefRate) / bestRefRate) * 100;
    // Clamp floating point dust to true zero
    if (Math.abs(row.pctVsBest) < 0.001) row.pctVsBest = 0;
  });

  // Update stats strip
  renderStats(rows, mode, maxBuyRate, minSellRate, minBuyRate, maxSellRate);

  // Update table header labels
  const modeLabel = mode === 'buying' ? 'Buying Rates (Cash In)' : 'Selling Rates (Outward Remittance)';
  const curInfo   = CURRENCIES.find(c => c.code === currency);

  setTextContent('table-mode-label',       modeLabel);
  setTextContent('selected-currency-label', `${curInfo?.flag ?? ''} ${currency}`);

  const validCount = rows.filter(r => r.displayRate !== null).length;
  setTextContent('table-count-badge', `${validCount} bank${validCount !== 1 ? 's' : ''}`);

  // Build table rows HTML
  const tbody = document.getElementById('rates-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const fragment = document.createDocumentFragment();

  rows.forEach((row, index) => {
    const isBestBuying  = mode === 'buying'  && row.buyRate  !== null && row.buyRate  === maxBuyRate;
    const isBestSelling = mode === 'selling' && row.sellRate !== null && row.sellRate === minSellRate;
    const isBest        = isBestBuying || isBestSelling;

    const tr = document.createElement('tr');
    tr.className = `rate-row${isBest ? ' best-row' : ''}`;
    tr.setAttribute('aria-label', `${row.bank}: ${row.displayRate !== null ? row.displayRate.toFixed(2) + ' LKR' : 'N/A'}`);
    tr.style.animationDelay = `${Math.min(index * 25, 400)}ms`;

    // — Bank Cell —
    const tdBank = document.createElement('td');
    tdBank.innerHTML = `
      <div class="bank-cell">
        <div class="bank-rank">${index + 1}</div>
        <div class="bank-name">${escapeHtml(row.bank)}</div>
      </div>
    `;

    // — Rate Cell —
    const tdRate = document.createElement('td');
    tdRate.style.textAlign = 'right';
    if (row.displayRate !== null) {
      tdRate.innerHTML = `
        <span class="rate-value">${row.displayRate.toFixed(2)}</span>
        <span class="rate-currency-label">LKR</span>
      `;
    } else {
      tdRate.innerHTML = `<span class="rate-value rate-null">—</span>`;
    }

    // — % vs Best Cell —
    // Green at 0% (best), yellow 0–1%, amber 1–3%, red >3%
    const tdPct = document.createElement('td');
    tdPct.style.textAlign = 'right';
    if (row.pctVsBest !== null) {
      let pctClass = 'pct-best';
      if (row.pctVsBest === 0)          pctClass = 'pct-best';
      else if (row.pctVsBest <= 1.0)    pctClass = 'pct-tight';
      else if (row.pctVsBest <= 3.0)    pctClass = 'pct-mid';
      else                              pctClass = 'pct-wide';
      const pctDisplay = row.pctVsBest === 0
        ? '✦ 0.00%'
        : `+${row.pctVsBest.toFixed(2)}%`;
      tdPct.innerHTML = `<span class="pct-badge ${pctClass}">${pctDisplay}</span>`;
    } else {
      tdPct.innerHTML = `<span class="pct-badge pct-null">—</span>`;
    }

    // — Badge Cell —
    const tdBadge = document.createElement('td');
    tdBadge.style.textAlign = 'center';
    if (isBest) {
      const label = mode === 'buying' ? '▲ BEST BUY' : '▼ BEST DEAL';
      tdBadge.innerHTML = `<span class="badge badge-best" aria-label="Best rate">${label}</span>`;
    } else if (row.displayRate === null) {
      tdBadge.innerHTML = `<span class="badge badge-na" aria-label="Rate not available">N/A</span>`;
    }

    tr.appendChild(tdBank);
    tr.appendChild(tdRate);
    tr.appendChild(tdPct);
    tr.appendChild(tdBadge);
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

/**
 * Updates the 4-tile stats strip above the table.
 */
function renderStats(rows, mode, maxBuy, minSell, minBuy, maxSell) {
  const validRows = rows.filter(r => r.displayRate !== null);
  const bestRate  = mode === 'buying' ? maxBuy  : minSell;
  const worstRate = mode === 'buying' ? minBuy  : maxSell;

  // Rate Range %: how wide is the spread between best and worst reporting bank?
  // = (|best - worst| / best) * 100
  let rangePercent = null;
  if (bestRate !== null && worstRate !== null && bestRate !== 0) {
    rangePercent = (Math.abs(bestRate - worstRate) / bestRate) * 100;
  }

  setTextContent('stat-best',   bestRate     !== null ? bestRate.toFixed(2)     : '—');
  setTextContent('stat-worst',  worstRate    !== null ? worstRate.toFixed(2)    : '—');
  setTextContent('stat-spread', rangePercent !== null ? rangePercent.toFixed(2) + '%' : '—');
  setTextContent('stat-banks',  `${validRows.length} / ${rows.length}`);

  document.getElementById('stats-strip')?.classList.remove('hidden');
}


/* ================================================================
   SECTION G — SKELETON LOADER
   ================================================================ */

/** Inject shimmer skeleton rows and show the skeleton container */
function showSkeleton() {
  const rowsEl = document.getElementById('skeleton-rows');
  if (!rowsEl) return;

  let html = '';
  for (let i = 0; i < CONFIG.SKELETON_ROWS; i++) {
    html += `
      <div class="skeleton-row" style="animation-delay:${i * 45}ms">
        <div class="skeleton-block skeleton-cell-bank"></div>
        <div class="skeleton-block skeleton-cell-rate"></div>
        <div class="skeleton-block skeleton-cell-spread"></div>
        <div class="skeleton-block skeleton-cell-badge"></div>
      </div>
    `;
  }
  rowsEl.innerHTML = html;

  document.getElementById('skeleton-container')?.classList.remove('hidden');
  document.getElementById('rates-container')?.classList.add('hidden');
}

/** Fade out skeleton, reveal the live rates table */
function hideSkeleton() {
  const skeleton = document.getElementById('skeleton-container');
  const ratesEl  = document.getElementById('rates-container');

  if (skeleton) {
    skeleton.style.transition = 'opacity 0.4s ease';
    skeleton.style.opacity    = '0';
    setTimeout(() => skeleton.classList.add('hidden'), 420);
  }

  if (ratesEl) {
    ratesEl.classList.remove('hidden');
    ratesEl.classList.add('fade-in');
  }
}

/** Replace skeleton with inline error message */
function showError(msg) {
  const container = document.getElementById('skeleton-container');
  if (!container) return;
  container.innerHTML = `
    <div class="error-state" role="alert">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <h3>Unable to Load Rates</h3>
      <p>${escapeHtml(msg)}<br>Please verify the Google Sheet is publicly accessible.</p>
      <button class="retry-btn" onclick="location.reload()" id="retry-btn">↻ Retry</button>
    </div>
  `;
}


/* ================================================================
   SECTION H — CHART ENGINE
   ================================================================ */

/** Generate per-bank line chart datasets from history JSON */
function buildChartDatasets(historyData, currency, chartMode) {
  const modeKey  = chartMode === 'buying' ? 'buying' : 'selling';
  const bankSet  = new Set();

  historyData.forEach(entry => {
    if (entry[modeKey]) Object.keys(entry[modeKey]).forEach(b => bankSet.add(b));
  });

  const banks = [...bankSet];

  return banks.map((bank, i) => {
    const colorIdx = MASTER_BANKS.indexOf(bank);
    const color    = BANK_COLORS[colorIdx >= 0 ? colorIdx : i % BANK_COLORS.length];

    return {
      label:            bank,
      data:             historyData.map(entry => entry[modeKey]?.[bank]?.[currency] ?? null),
      borderColor:      color,
      backgroundColor:  color + '22',
      borderWidth:      1.8,
      pointRadius:      2.5,
      pointHoverRadius: 6,
      tension:          0.38,
      spanGaps:         true,
      fill:             false,
    };
  });
}

/** Render or re-render the Chart.js line chart */
function renderChart() {
  const { historyData, currency, chartMode, chartInstance } = state;
  const canvas    = document.getElementById('history-chart');
  const noDataEl  = document.getElementById('chart-no-data');
  const subtitleEl = document.getElementById('chart-subtitle');

  if (!canvas) return;

  // Destroy previous chart to avoid canvas reuse warnings
  if (chartInstance) {
    chartInstance.destroy();
    state.chartInstance = null;
  }

  if (!historyData || historyData.length === 0) {
    canvas.classList.add('hidden');
    noDataEl?.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  noDataEl?.classList.add('hidden');

  if (subtitleEl) {
    const curInfo = CURRENCIES.find(c => c.code === currency);
    subtitleEl.textContent =
      `${chartMode === 'buying' ? 'Buying' : 'Selling'} rates for ${curInfo?.flag ?? ''} ${currency} — last ${historyData.length} day${historyData.length !== 1 ? 's' : ''}`;
  }

  const labels   = historyData.map(d => d.date);
  const datasets = buildChartDatasets(historyData, currency, chartMode);

  const ctx = canvas.getContext('2d');
  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation: {
        duration: 600,
        easing:   'easeInOutQuart',
      },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          align:    'start',
          labels: {
            color:     '#94a3b8',
            font:      { family: 'Inter', size: 11 },
            padding:   14,
            boxWidth:  12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle:    'circle',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 26, 0.96)',
          titleColor:      '#f1f5f9',
          bodyColor:       '#94a3b8',
          borderColor:     'rgba(255,255,255,0.08)',
          borderWidth:     1,
          padding:         14,
          cornerRadius:    10,
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              return ` ${ctx.dataset.label}: ${val !== null ? val.toFixed(4) + ' LKR' : 'N/A'}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color:      '#4b5563',
            font:       { family: 'Inter', size: 11 },
            maxRotation: 35,
          },
        },
        y: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#4b5563',
            font:  { family: 'JetBrains Mono', size: 11 },
          },
        },
      },
    },
  });
}


/* ================================================================
   SECTION I — UI HELPERS
   ================================================================ */

/** Safely set text content of an element by ID */
function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** XSS-safe HTML escaper */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Populate the currency <select> dropdown with all 24 currencies */
function populateCurrencyDropdown() {
  const select = document.getElementById('currency-select');
  if (!select) return;

  select.innerHTML = '';
  const fragment = document.createDocumentFragment();

  for (const cur of CURRENCIES) {
    const option = document.createElement('option');
    option.value       = cur.code;
    option.textContent = `${cur.flag} ${cur.code} — ${cur.name}`;
    if (cur.code === 'USD') option.selected = true;
    fragment.appendChild(option);
  }

  select.appendChild(fragment);
}

/** Update the "Updated: HH:MM:SS DD/MM/YYYY" display */
function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (!el) return;
  const now = new Date();
  el.textContent = `Updated: ${now.toLocaleTimeString()} · ${now.toLocaleDateString()}`;
}


/* ================================================================
   SECTION J — EVENT HANDLERS
   ================================================================ */

function setupEventListeners() {

  /* ---- Currency Dropdown ---- */
  document.getElementById('currency-select')?.addEventListener('change', e => {
    state.currency = e.target.value;
    renderTable();
    renderChart();
  });

  /* ---- Buy / Sell Tabs ---- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newMode = btn.dataset.mode;
      if (newMode === state.mode) return;

      state.mode = newMode;

      // Update active state
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === newMode);
        b.setAttribute('aria-selected', String(b.dataset.mode === newMode));
      });

      // Slide indicator
      const indicator = document.querySelector('.tab-indicator');
      if (indicator) {
        indicator.style.left = newMode === 'buying' ? '4px' : 'calc(50% + 0px)';
        indicator.style.width = 'calc(50% - 4px)';
      }

      renderTable();
    });
  });

  /* ---- Chart Mode Buttons ---- */
  document.getElementById('chart-buying-btn')?.addEventListener('click', () => {
    state.chartMode = 'buying';
    document.getElementById('chart-buying-btn')?.classList.add('active');
    document.getElementById('chart-selling-btn')?.classList.remove('active');
    document.getElementById('chart-buying-btn')?.setAttribute('aria-pressed', 'true');
    document.getElementById('chart-selling-btn')?.setAttribute('aria-pressed', 'false');
    renderChart();
  });

  document.getElementById('chart-selling-btn')?.addEventListener('click', () => {
    state.chartMode = 'selling';
    document.getElementById('chart-selling-btn')?.classList.add('active');
    document.getElementById('chart-buying-btn')?.classList.remove('active');
    document.getElementById('chart-selling-btn')?.setAttribute('aria-pressed', 'true');
    document.getElementById('chart-buying-btn')?.setAttribute('aria-pressed', 'false');
    renderChart();
  });
}


/* ================================================================
   SECTION K — INITIALIZATION
   ================================================================ */

async function init() {
  // 1. Populate UI controls
  populateCurrencyDropdown();
  setupEventListeners();

  // 2. Show skeleton immediately
  showSkeleton();

  // 3. Fetch live data from both sheets in parallel
  try {
    const [buyingResponse, sellingResponse] = await Promise.all([
      fetchSheetData(CONFIG.BUYING_SHEET),
      fetchSheetData(CONFIG.SELLING_SHEET),
    ]);

    state.buyingData  = parseRows(buyingResponse);
    state.sellingData = parseRows(sellingResponse);
    state.isLoading   = false;

    if (state.buyingData.length === 0 && state.sellingData.length === 0) {
      throw new Error('No rate data found in the spreadsheet. Verify sheet names and public access.');
    }

    // 4. Render table and hide skeleton
    renderTable();
    hideSkeleton();
    updateTimestamp();

    // 5. Load historical data and render chart (non-blocking)
    fetchHistoryData().then(history => {
      state.historyData = history;
      renderChart();
    });

  } catch (error) {
    console.error('[ExchangeWatch] Initialization failed:', error);
    showError(error.message || 'An unexpected error occurred while fetching exchange rate data.');
  }
}

// Boot the app when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
