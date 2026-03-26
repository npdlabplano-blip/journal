#!/usr/bin/env node
/**
 * Transaction categorization and monthly budget summary generator.
 *
 * Usage: node categorize.js [YYYY-MM]
 *   If no month specified, generates summaries for all months found in data.
 *   If month specified, generates summary for that month only.
 *
 * Reads from: finance/data/
 * Writes to:  finance/budget/YYYY-MM-summary.md
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BUDGET_DIR = path.join(__dirname, '..', 'budget');

// --- Categorization Rules ---
// Order matters: first match wins. More specific patterns should come first.
const RULES = [
  // Internal transfers & payments (NOT expenses)
  { pattern: /CAPITAL ONE.*MOBILE P|CAPITAL ONE MOBILE PYMT/i, category: '_transfer', note: 'CC Payment' },
  { pattern: /Online Transfer|ACCT_XFER/i, category: '_transfer', note: 'Internal Transfer' },
  { pattern: /SCHWAB BROKERAGE.*MONEYLINK/i, category: '_transfer', note: 'Schwab Transfer' },
  { pattern: /VENMO.*CASHOUT/i, category: '_transfer', note: 'Venmo Cashout' },
  { pattern: /BARCLAYCARD/i, category: '_transfer', note: 'Barclays CC Payment (closed)' },

  // Income
  { pattern: /PALO ALTO NETWOR.*PAYROLL/i, category: 'Income', note: 'Palo Alto Networks Salary' },
  { pattern: /JPMORGAN CHASE.*PAYROLL|JPMORGAN CHASE B.*PAYROLL/i, category: 'Income', note: 'JPMorgan Chase Salary' },
  { pattern: /MSPBNA.*ACH TRNSFR/i, category: 'Income', note: 'Morgan Stanley Transfer' },
  { pattern: /SCHWAB BROKERAGE/i, category: 'Income', note: 'Schwab Distribution' },
  { pattern: /INTEREST PAYMENT/i, category: 'Income', note: 'Interest' },

  // Housing
  { pattern: /JPMORGAN CHASE.*EXT TRNSFR|JPMorgan Chase.*Ext Trnsfr/i, category: 'Housing — Mortgage', note: 'Mortgage Payment' },

  // Insurance
  { pattern: /USAA INSURANCE/i, category: 'Insurance — Auto' },
  { pattern: /AMERICAN GEN LIF/i, category: 'Insurance — Life' },

  // Utilities
  { pattern: /CITY OF COPPELL.*WATER/i, category: 'Utilities — Water' },
  { pattern: /ATMOS ENERGY/i, category: 'Utilities — Gas' },
  { pattern: /TRIEAGLE ENERGY/i, category: 'Utilities — Electric' },
  { pattern: /FRONTIER.*COMMUNI|FRONTIER SEC/i, category: 'Utilities — Internet' },

  // Phone & Cable
  { pattern: /TMOBILE/i, category: 'Phone — T-Mobile' },
  { pattern: /ATT\* BILL/i, category: 'Phone — AT&T' },
  { pattern: /Netflix/i, category: 'Subscriptions — Netflix' },

  // Car Payment
  { pattern: /BMWFINANCIAL/i, category: 'Auto — Car Payment' },

  // Subscriptions
  { pattern: /HEADSPACE/i, category: 'Subscriptions — Headspace' },
  { pattern: /PELOTON/i, category: 'Subscriptions — Peloton' },
  { pattern: /PLURALSIGHT/i, category: 'Subscriptions — Pluralsight' },
  { pattern: /Google One/i, category: 'Subscriptions — Google One' },
  { pattern: /AMAZON PRIME\*/i, category: 'Subscriptions — Amazon Prime' },
  { pattern: /Amazon Kids\+/i, category: 'Subscriptions — Amazon Kids+' },
  { pattern: /Prime Video/i, category: 'Subscriptions — Prime Video' },
  { pattern: /Kindle Svcs/i, category: 'Subscriptions — Kindle' },
  { pattern: /APPLE\.COM\/BILL/i, category: 'Subscriptions — Apple' },
  { pattern: /ANTHROPIC|CLAUDE\.AI/i, category: 'Subscriptions — AI Tools' },
  { pattern: /PERPLEXITY/i, category: 'Subscriptions — AI Tools' },
  { pattern: /Adobe Inc/i, category: 'Subscriptions — Adobe' },
  { pattern: /BOOKOFMONTH/i, category: 'Subscriptions — Book of Month' },
  { pattern: /Walmart\+ Member/i, category: 'Subscriptions — Walmart+' },
  { pattern: /MICROSOFT.*G1\d|Microsoft-G\d|MICROSOFT#/i, category: 'Subscriptions — Microsoft' },

  // Kids
  { pattern: /GREENLIGHT/i, category: 'Kids — Greenlight' },
  { pattern: /COPPELL INDEPENDENT|GCISD/i, category: 'Kids — School (CISD)' },
  { pattern: /COLLEGEBOARD/i, category: 'Kids — Education' },
  { pattern: /RHYTHM ROOM|VTD DANCE/i, category: 'Kids — Dance' },
  { pattern: /ACT\*LE Rec Center/i, category: 'Kids — Recreation' },
  { pattern: /SIXFLAGS/i, category: 'Kids — Entertainment' },

  // Church & Giving
  { pattern: /COPPELLBIBLE/i, category: 'Giving — Church Tithe' },
  { pattern: /SQ \*EVENTS.*ONE COMMUNIT/i, category: 'Giving — Community' },
  { pattern: /GDP\*Watershed/i, category: 'Giving — Donations' },

  // Groceries
  { pattern: /KROGER/i, category: 'Groceries' },
  { pattern: /MARKET STREET/i, category: 'Groceries' },
  { pattern: /SPROUTS FARMERS/i, category: 'Groceries' },
  { pattern: /TOM THUMB/i, category: 'Groceries' },
  { pattern: /COSTCO WHSE/i, category: 'Groceries' },
  { pattern: /WHOLE FOODS/i, category: 'Groceries' },
  { pattern: /TRADER JOE/i, category: 'Groceries' },
  { pattern: /WM SUPERCENTER|WAL-MART/i, category: 'Groceries / Household' },
  { pattern: /365 MARKET|365 Market/i, category: 'Groceries — Convenience' },

  // Dining
  { pattern: /DOORDASH/i, category: 'Dining Out — Delivery' },
  { pattern: /UBER EATS/i, category: 'Dining Out — Delivery' },
  { pattern: /STARBUCKS/i, category: 'Dining Out — Coffee' },
  { pattern: /LIBERATION COFFEE/i, category: 'Dining Out — Coffee' },
  { pattern: /GREGORYS COFFEE/i, category: 'Dining Out — Coffee' },
  { pattern: /WHITE RHINO COFFEE/i, category: 'Dining Out — Coffee' },
  { pattern: /ROSAS CAFE/i, category: 'Dining Out' },
  { pattern: /ANDY'S/i, category: 'Dining Out' },
  { pattern: /PAPPASITOS/i, category: 'Dining Out' },
  { pattern: /ANAMIAS/i, category: 'Dining Out' },
  { pattern: /FREDDY'S/i, category: 'Dining Out' },
  { pattern: /PAPA JOHN/i, category: 'Dining Out' },
  { pattern: /JERSEY MIKE/i, category: 'Dining Out' },
  { pattern: /LITTLE CAESARS/i, category: 'Dining Out' },
  { pattern: /INSOMNIA COOKIES/i, category: 'Dining Out' },
  { pattern: /CAVA /i, category: 'Dining Out' },
  { pattern: /ZOMBIE TACO/i, category: 'Dining Out' },
  { pattern: /TST\*.*ENOS/i, category: 'Dining Out' },
  { pattern: /VELVET TACO/i, category: 'Dining Out' },
  { pattern: /HG SPLY/i, category: 'Dining Out' },
  { pattern: /MACKLINS GRILL/i, category: 'Dining Out' },
  { pattern: /FLYING SAUCER/i, category: 'Dining Out' },
  { pattern: /SAN DANIELE/i, category: 'Dining Out' },
  { pattern: /SONS OF HERMANN/i, category: 'Dining Out' },
  { pattern: /SPO\*CUATESKITCHEN/i, category: 'Dining Out' },
  { pattern: /IKEA.*REST/i, category: 'Dining Out' },
  { pattern: /AMK JPMC PLANO|JPMC.*HALL|JPMC.*STARP|JPMC.*CREAMER/i, category: 'Dining Out — Work Cafe' },
  { pattern: /LEVY.*CONCESSIONS/i, category: 'Dining Out — Events' },
  { pattern: /LANDON WINERY/i, category: 'Dining Out' },
  { pattern: /TRIP HOSPITALITY/i, category: 'Dining Out' },
  { pattern: /K-DOGS/i, category: 'Dining Out' },
  { pattern: /HTEAO/i, category: 'Dining Out' },
  { pattern: /COCA COLA.*SAN ANTONIO/i, category: 'Dining Out' },
  { pattern: /BUC-EE'S/i, category: 'Dining Out — Travel' },
  { pattern: /NJ MONTHLY.*EWR/i, category: 'Dining Out — Travel' },
  { pattern: /CTLP\*CULINARY/i, category: 'Dining Out' },

  // Gas & Auto
  { pattern: /QT \d+.*OUTSIDE|EXXON/i, category: 'Gas' },
  { pattern: /NTTA AUTOCHARGE/i, category: 'Auto — Tolls' },
  { pattern: /CARNATION AUTO SPA/i, category: 'Auto — Car Wash' },
  { pattern: /UBER TECHNOLOGIES/i, category: 'Auto — Rideshare' },
  { pattern: /ParkWhiz/i, category: 'Auto — Parking' },
  { pattern: /UT PTS.*PARKING/i, category: 'Auto — Parking' },
  { pattern: /UNITED EXPRESS/i, category: 'Gas' },

  // Personal Care
  { pattern: /SALON ON THE CREEK|SOHO SALON/i, category: 'Personal Care — Hair' },
  { pattern: /RESORT NAIL SPA/i, category: 'Personal Care — Nails' },
  { pattern: /MASSAGE ENVY/i, category: 'Personal Care — Massage' },
  { pattern: /ULTA/i, category: 'Personal Care — Beauty' },
  { pattern: /BATH AND BODY/i, category: 'Personal Care — Beauty' },

  // Health & Wellness
  { pattern: /HIS STORY COACHING|CHRYSALIS SACRED/i, category: 'Health — Coaching / Therapy' },
  { pattern: /WALGREENS|CVS.*PHARMACY/i, category: 'Health — Pharmacy' },
  { pattern: /QUEST.*DIAGNO/i, category: 'Health — Medical' },

  // Pet Care
  { pattern: /CAMP BOW WOW/i, category: 'Pet Care — Daycare' },
  { pattern: /CUTIE PIE PETS/i, category: 'Pet Care' },
  { pattern: /PETCO/i, category: 'Pet Care — Supplies' },
  { pattern: /ALLCAREVET/i, category: 'Pet Care — Vet' },

  // Household Services
  { pattern: /RAG MOPS/i, category: 'Household — Cleaning' },
  { pattern: /TEXAS CLEANERS/i, category: 'Household — Dry Cleaning' },
  { pattern: /All-Safe Pest/i, category: 'Household — Pest Control' },

  // Shopping
  { pattern: /AMAZON|Amzn\.com/i, category: 'Shopping — Amazon' },
  { pattern: /STITCH FIX/i, category: 'Shopping — Stitch Fix' },
  { pattern: /HOME DEPOT/i, category: 'Shopping — Home Improvement' },
  { pattern: /TARGET/i, category: 'Shopping — Target' },
  { pattern: /BEST BUY/i, category: 'Shopping — Electronics' },
  { pattern: /DSW|PAYPAL.*DSW/i, category: 'Shopping — Shoes' },
  { pattern: /ISTORE BY SWYFT|BETTER\+.*SWYFT/i, category: 'Shopping' },
  { pattern: /QT \d+.*INSIDE/i, category: 'Shopping — Convenience' },

  // Entertainment & Activities
  { pattern: /STUBHUB/i, category: 'Entertainment — Events' },
  { pattern: /Medieval Times/i, category: 'Entertainment — Events' },
  { pattern: /CIRQUE DU SOLEIL/i, category: 'Entertainment — Events' },
  { pattern: /Performing Arts/i, category: 'Entertainment — Events' },
  { pattern: /AMC \d+/i, category: 'Entertainment — Movies' },
  { pattern: /DALLAS SWING DANCE|FORT WORTH SWING/i, category: 'Entertainment — Dance' },

  // Travel
  { pattern: /AMERICAN AIR/i, category: 'Travel — Airfare' },
  { pattern: /OTIS.*MARRIOTT|MOXY/i, category: 'Travel — Hotel' },

  // Taxes
  { pattern: /IRS.*USATAXPYMT/i, category: 'Taxes — IRS' },

  // Other Financial
  { pattern: /BARCLAYCARD/i, category: 'Other — Barclays Payment' },
  { pattern: /Zelle.*SIXTOS GUERRERO|Zelle.*Hugo Guerrero/i, category: 'Household — Lawn Care' },
  { pattern: /VENMO.*PAYMENT/i, category: 'Other — Venmo (review manually)' },
  { pattern: /Zelle payment/i, category: 'Other — Zelle (review manually)' },
  { pattern: /PAYPAL.*GITHUB/i, category: 'Subscriptions — GitHub' },
  { pattern: /USPS/i, category: 'Other — Shipping' },
  { pattern: /UDEMY/i, category: 'Education' },

  // Cash
  { pattern: /ATM WITHDRAWAL/i, category: 'Cash Withdrawal' },

  // Catch-all
  { pattern: /CHECK \d+/i, category: 'Other — Check' },
];

function categorize(description) {
  for (const rule of RULES) {
    if (rule.pattern.test(description)) {
      return { category: rule.category, note: rule.note || '' };
    }
  }
  return { category: 'Uncategorized', note: description.substring(0, 50) };
}

// Parse Chase checking CSV
function parseChase(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').slice(1); // skip header
  const transactions = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Format: Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
    const match = line.match(/^(\w+),(\d{2}\/\d{2}\/\d{4}),"(.+?)",([-\d.]+),/);
    if (!match) continue;

    const [, details, dateStr, description, amountStr] = match;
    const [month, day, year] = dateStr.split('/');
    const date = `${year}-${month}-${day}`;
    const amount = parseFloat(amountStr);
    const { category, note } = categorize(description);

    transactions.push({
      date,
      description: description.trim().replace(/\s+/g, ' ').substring(0, 60),
      amount,
      category,
      note,
      source: 'Chase Checking'
    });
  }
  return transactions;
}

// Parse Capital One CSV
function parseCapitalOne(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').slice(1); // skip header
  const transactions = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Format: Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
    // Handle quoted fields
    const parts = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
    if (!parts || parts.length < 7) continue;

    const clean = parts.map(p => p.replace(/^,/, '').replace(/^"|"$/g, '').trim());
    const [txnDate, , , description, , debitStr, creditStr] = clean;

    if (!txnDate.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    const debit = parseFloat(debitStr) || 0;
    const credit = parseFloat(creditStr) || 0;
    const amount = credit > 0 ? credit : -debit; // credits positive, debits negative

    const { category, note } = categorize(description);

    transactions.push({
      date: txnDate,
      description: description.substring(0, 60),
      amount,
      category,
      note,
      source: 'Capital One'
    });
  }
  return transactions;
}

function getMonth(dateStr) {
  return dateStr.substring(0, 7); // YYYY-MM
}

function generateSummary(month, transactions) {
  // Filter to this month, exclude transfers
  const monthTxns = transactions.filter(t => getMonth(t.date) === month);
  const spending = monthTxns.filter(t => t.category !== '_transfer' && t.category !== 'Income' && t.amount < 0);
  const income = monthTxns.filter(t => t.category === 'Income');
  const transfers = monthTxns.filter(t => t.category === '_transfer');

  // Group spending by top-level category
  const categoryTotals = {};
  const categoryDetails = {};
  for (const t of spending) {
    const topCat = t.category.split(' — ')[0];
    categoryTotals[topCat] = (categoryTotals[topCat] || 0) + Math.abs(t.amount);
    if (!categoryDetails[t.category]) categoryDetails[t.category] = [];
    categoryDetails[t.category].push(t);
  }

  // Sort categories by total descending
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalSpending = spending.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netSavings = totalIncome - totalSpending;

  const [year, mon] = month.split('-');
  const monthName = new Date(parseInt(year), parseInt(mon) - 1).toLocaleString('en-US', { month: 'long' });

  let md = `# ${monthName} ${year} Budget Summary\n\n`;
  md += `> Generated ${new Date().toISOString().split('T')[0]}\n\n`;

  // Overview table
  md += `## Overview\n\n`;
  md += `| | Amount |\n`;
  md += `|---|---:|\n`;
  md += `| **Total Income** | $${totalIncome.toLocaleString('en-US', {minimumFractionDigits: 2})} |\n`;
  md += `| **Total Spending** | $${totalSpending.toLocaleString('en-US', {minimumFractionDigits: 2})} |\n`;
  md += `| **Net Savings** | $${netSavings.toLocaleString('en-US', {minimumFractionDigits: 2})} |\n\n`;

  // Income breakdown
  md += `## Income\n\n`;
  md += `| Source | Amount |\n`;
  md += `|---|---:|\n`;
  for (const t of income) {
    md += `| ${t.note || t.description} | $${t.amount.toLocaleString('en-US', {minimumFractionDigits: 2})} |\n`;
  }
  md += `| **Total** | **$${totalIncome.toLocaleString('en-US', {minimumFractionDigits: 2})}** |\n\n`;

  // Spending by category
  md += `## Spending by Category\n\n`;
  md += `| Category | Amount | % of Spend |\n`;
  md += `|---|---:|---:|\n`;
  for (const [cat, total] of sortedCats) {
    const pct = ((total / totalSpending) * 100).toFixed(1);
    md += `| ${cat} | $${Math.round(total).toLocaleString()} | ${pct}% |\n`;
  }
  md += `| **Total** | **$${Math.round(totalSpending).toLocaleString()}** | **100%** |\n\n`;

  // Detailed breakdown
  md += `## Detailed Breakdown\n\n`;
  // Group by subcategory
  const sortedDetails = Object.entries(categoryDetails).sort((a, b) => {
    const totalA = a[1].reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalB = b[1].reduce((s, t) => s + Math.abs(t.amount), 0);
    return totalB - totalA;
  });

  for (const [cat, txns] of sortedDetails) {
    const catTotal = txns.reduce((s, t) => s + Math.abs(t.amount), 0);
    md += `### ${cat} — $${Math.round(catTotal).toLocaleString()}\n\n`;
    md += `| Date | Description | Amount | Source |\n`;
    md += `|---|---|---:|---|\n`;
    const sorted = txns.sort((a, b) => a.date.localeCompare(b.date));
    for (const t of sorted) {
      md += `| ${t.date} | ${t.description} | $${Math.abs(t.amount).toFixed(2)} | ${t.source} |\n`;
    }
    md += `\n`;
  }

  // Uncategorized transactions
  const uncategorized = spending.filter(t => t.category === 'Uncategorized');
  if (uncategorized.length > 0) {
    md += `## ⚠ Uncategorized Transactions\n\n`;
    md += `| Date | Description | Amount | Source |\n`;
    md += `|---|---|---:|---|\n`;
    for (const t of uncategorized) {
      md += `| ${t.date} | ${t.description} | $${Math.abs(t.amount).toFixed(2)} | ${t.source} |\n`;
    }
    md += `\n`;
  }

  return md;
}

// --- Main ---
const targetMonth = process.argv[2]; // optional YYYY-MM

// Find data files
const files = fs.readdirSync(DATA_DIR);
const chaseFiles = files.filter(f => f.match(/^Chase0951/i));
const capOneFiles = files.filter(f => f.match(/transaction_download/i) && !f.includes('('));

let allTransactions = [];

for (const f of chaseFiles) {
  const txns = parseChase(path.join(DATA_DIR, f));
  allTransactions.push(...txns);
  console.log(`Parsed ${txns.length} transactions from ${f}`);
}

for (const f of capOneFiles) {
  const txns = parseCapitalOne(path.join(DATA_DIR, f));
  allTransactions.push(...txns);
  console.log(`Parsed ${txns.length} transactions from ${f}`);
}

// Deduplicate (same date + description + amount from same source)
const seen = new Set();
allTransactions = allTransactions.filter(t => {
  const key = `${t.date}|${t.description}|${t.amount}|${t.source}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`\nTotal unique transactions: ${allTransactions.length}`);

// Determine months to process
const months = [...new Set(allTransactions.map(t => getMonth(t.date)))].sort();
const monthsToProcess = targetMonth ? [targetMonth] : months.filter(m => m >= '2026-01');

console.log(`\nGenerating summaries for: ${monthsToProcess.join(', ')}`);

for (const month of monthsToProcess) {
  const summary = generateSummary(month, allTransactions);
  const outPath = path.join(BUDGET_DIR, `${month}-summary.md`);
  fs.writeFileSync(outPath, summary);
  console.log(`  ✓ ${outPath}`);
}
