/**
 * Cashflow Engine — pure deterministic logic, no AI.
 * All calculations here; AI only gets the summarized output.
 */
const traceMethods = require('../utils/traceMethods');
const { getPaymentProgress, resolvePaymentType, toDateStr } = require('../utils/installmentSchedule');

/** How many months the category averages and the upcoming special expenses cover. */
const CATEGORY_MONTHS = 12;
const UPCOMING_MONTHS = 12;
const MAX_UPCOMING_SPECIAL = 15;

function sumExpenses(items = []) {
  return items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

const round = (v) => Math.round(Number(v) || 0);

/** Due date of the last scheduled entry (schedule entries are sorted by date). */
const lastDueDate = (entries) => {
  const dated = entries.filter(e => e.dueDate);
  return dated.length ? dated[dated.length - 1].dueDate : undefined;
};

/** { date, amount } of the next unpaid entry, or undefined. */
const nextPaymentOf = (entries) => {
  const next = entries.find(e => !e.paid);
  return next ? { date: next.dueDate, amount: round(next.amount) } : undefined;
};

/** Average monthly spend per category over the last CATEGORY_MONTHS months up to the current one. */
function expensesByCategory(months, nowStr) {
  const window = months.filter(m => (m.month || '').substring(0, 7) <= nowStr).slice(-CATEGORY_MONTHS);
  if (!window.length) return undefined;

  const totals = {};
  for (const m of window) {
    for (const e of [...(m.regularExpenses || []), ...(m.specialExpenses || [])]) {
      const category = e.category || 'OTHER';
      totals[category] = (totals[category] || 0) + (Number(e.amount) || 0);
    }
  }
  const avgMonthly = Object.fromEntries(
    Object.entries(totals)
      .map(([category, total]) => [category, round(total / window.length)])
      .filter(([, avg]) => avg > 0)
      .sort((a, b) => b[1] - a[1])
  );
  return {
    from: window[0].month.substring(0, 7),
    to: window[window.length - 1].month.substring(0, 7),
    months: window.length,
    avgMonthly
  };
}

/** Special (one-time) expenses planned after the current month, within UPCOMING_MONTHS months. */
function upcomingSpecialExpenses(months, nowStr) {
  return months
    .filter(m => (m.month || '').substring(0, 7) > nowStr)
    .slice(0, UPCOMING_MONTHS)
    .flatMap(m => (m.specialExpenses || []).map(e => ({
      month: m.month.substring(0, 7),
      description: e.description,
      category: e.category || undefined,
      amount: round(e.amount)
    })))
    .filter(e => e.amount > 0)
    .slice(0, MAX_UPCOMING_SPECIAL);
}

/** Investment entry: latest value, trend over the last 12 months and net deposits. */
function investmentSummaryOf(inv) {
  const snaps = [...(inv.snapshots || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latestSnap = snaps.length ? snaps[snaps.length - 1] : null;

  // Baseline: the last snapshot at least 12 months before the latest one, else the oldest snapshot.
  let change;
  if (latestSnap && snaps.length > 1) {
    const d = new Date(String(latestSnap.date).substring(0, 10));
    const yearBefore = isNaN(d) ? '' : `${d.getFullYear() - 1}${String(latestSnap.date).substring(4, 10)}`;
    const base = [...snaps].reverse().find(s => String(s.date) <= yearBefore) || snaps[0];
    change = {
      since: String(base.date).substring(0, 10),
      amount: round(latestSnap.value - base.value),
      percent: base.value ? Math.round(((latestSnap.value - base.value) / base.value) * 1000) / 10 : undefined
    };
  }

  const tx = inv.transactions || [];
  const sumOf = (type) => round(tx.filter(t => (t.type || 'deposit') === type).reduce((s, t) => s + (Number(t.amount) || 0), 0));
  const deposits = sumOf('deposit');
  const withdrawals = sumOf('withdraw');

  return {
    name: inv.name,
    type: inv.type,
    currentValue: latestSnap?.value ?? null,
    lastUpdated: latestSnap ? String(latestSnap.date).substring(0, 10) : undefined,
    snapshotsCount: snaps.length,
    initialValue: inv.initialValue ?? undefined,
    expectedAnnualReturn: inv.annualReturn ?? undefined,
    change,
    deposits: deposits || undefined,
    withdrawals: withdrawals || undefined
  };
}

/**
 * Build a compact financial summary from raw data files.
 * This is the DTO sent to AI — small, structured, no raw history.
 * `today` (Date or 'YYYY-MM-DD') decides which installment payments are already paid.
 */
function buildSummary({ cashFlow, installments = [], investments = [], defaults = {}, today = new Date() }) {
  const months = cashFlow?.months || [];
  if (!months.length) return { error: 'No cashflow data' };

  const latest = months[months.length - 1];
  const oldest = months[0];

  // --- Income / Expense Stats ---
  let totalIncome = 0, totalExpenses = 0, totalMortgage = 0, totalLoan = 0, totalInstallments = 0;
  for (const m of months) {
    const addInc = sumExpenses(m.additionalIncomes);
    totalIncome += (Number(m.income) || 0) + addInc;
    totalMortgage += Number(m.mortgagePayment) || 0;
    totalLoan += Number(m.loanPayment) || 0;
    totalInstallments += Number(m.installmentsPayment) || 0;
    totalExpenses += sumExpenses(m.regularExpenses) + sumExpenses(m.specialExpenses);
  }

  const avgMonthlyIncome = totalIncome / months.length;
  const avgMonthlyExpenses = (totalExpenses + totalMortgage + totalLoan + totalInstallments) / months.length;
  const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpenses;

  // --- Balance Trend ---
  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthEntry = months.find(m => m.month.startsWith(nowStr));

  const balanceStart = oldest.startingBalance;
  const balanceEnd = latest.endingBalance;
  const currentBalance = currentMonthEntry ? currentMonthEntry.endingBalance : balanceEnd;
  const balanceDelta = balanceEnd - balanceStart;
  const monthCount = months.length;

  // --- Active Loans / Installments ---
  // Progress follows the date-based rule (utils/installmentSchedule.js): a payment counts as paid once
  // its due date arrives, unless paymentOverrides say otherwise. manualPaidCount / paidCount are ignored.
  const withProgress = installments.map(i => ({
    i,
    type: resolvePaymentType(i),
    progress: getPaymentProgress(i, today)
  }));
  const isActive = ({ progress }) => progress.remainingCount > 0 && progress.remainingAmount > 0;

  const activeLoans = withProgress
    .filter(x => x.type === 'loan')
    .filter(isActive)
    .map(({ i, progress }) => ({
      name: i.name,
      totalAmount: i.totalAmount,
      monthlyPayment: Number(i.monthlyPayment) ||
        (i.loanComponents || []).reduce((s, l) => s + (Number(l.monthlyPayment) || 0), 0),
      remainingPayments: progress.remainingCount,
      remainingBalance: progress.remainingAmount,
      paidPayments: progress.paidCount,
      startDate: i.startDate || undefined,
      endDate: lastDueDate(progress.entries),
      nextPayment: nextPaymentOf(progress.entries),
      components: (i.loanComponents || []).map(l => {
        const own = progress.entries.filter(e => e.loanId === l.id);
        return {
          description: l.description || undefined,
          amount: l.totalLoanAmount ?? undefined,
          monthlyPayment: l.monthlyPayment,
          interestRate: l.interestRate ?? undefined,
          startDate: l.startDate || undefined,
          endDate: lastDueDate(own),
          remainingPayments: own.filter(e => !e.paid).length,
          payoffDate: l.payoffDate || undefined,
          payoffAmount: l.payoffAmount ?? undefined
        };
      })
    }));

  const activeInstallments = withProgress
    .filter(x => x.type !== 'loan')
    .filter(isActive)
    .map(({ i, type, progress }) => {
      if (type === 'milestone') {
        const unpaidMilestones = progress.entries.filter(e => e.kind === 'milestone' && !e.paid);
        const next = unpaidMilestones[0];
        return {
          name: i.name,
          totalAmount: i.totalAmount,
          paymentType: 'milestone',
          remainingMilestones: unpaidMilestones.length,
          remainingAmount: progress.remainingAmount,
          nextMilestone: next ? (i.milestones || []).find(m => m.id === next.milestoneId) : undefined,
          remainingSchedule: unpaidMilestones.map(e => ({
            date: e.dueDate, amount: round(e.amount), description: e.description || undefined
          }))
        };
      }

      const manual = progress.entries.filter(e => e.kind === 'manual');
      return {
        name: i.name,
        totalAmount: i.totalAmount,
        monthlyPayment: i.monthlyPayment,
        remainingPayments: manual.filter(e => !e.paid).length,
        remainingAmount: progress.remainingAmount,
        startDate: i.startDate || undefined,
        endDate: lastDueDate(manual),
        nextPayment: nextPaymentOf(manual)
      };
    });

  // --- Investments ---
  const investmentSummary = investments.map(investmentSummaryOf);

  // --- 6-month Forecast (simple linear projection) ---
  const forecast = [];
  let projectedBalance = currentBalance;
  let forecastDate = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 1; i <= 6; i++) {
    forecastDate.setMonth(forecastDate.getMonth() + 1);
    projectedBalance += avgMonthlySavings;
    forecast.push({
      // Local date parts, not toISOString(): in a UTC+ timezone the ISO string of a local
      // "1st of month 00:00" is still the previous month, which mislabelled every forecast month.
      month: `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`,
      projectedBalance: Math.round(projectedBalance)
    });
  }

  // --- Monthly Snapshots (for dashboard charts) ---
  const monthlySnapshots = months.map(m => ({
    month: m.month?.substring(0, 7),
    startingBalance: m.startingBalance || 0,
    endingBalance: m.endingBalance || 0,
    income: (Number(m.income) || 0) + sumExpenses(m.additionalIncomes || []),
    expenses: sumExpenses(m.regularExpenses || []) + sumExpenses(m.specialExpenses || []) +
      (Number(m.mortgagePayment) || 0) + (Number(m.loanPayment) || 0) +
      (Number(m.installmentsPayment) || 0)
  }));

  return {
    asOf: toDateStr(today),
    periodCovered: {
      from: oldest.month?.substring(0, 7),
      to: latest.month?.substring(0, 7),
      months: monthCount
    },
    monthlySnapshots,
    currentBalance: currentBalance,
    balanceGrowth: Math.round(balanceDelta),
    income: {
      average: Math.round(avgMonthlyIncome),
      defaults: defaults.income || 0
    },
    expenses: {
      averageTotal: Math.round(avgMonthlyExpenses),
      avgMortgage: Math.round(totalMortgage / monthCount),
      avgLoan: Math.round(totalLoan / monthCount),
      avgInstallments: Math.round(totalInstallments / monthCount),
      avgRegular: Math.round(totalExpenses / monthCount)
    },
    expensesByCategory: expensesByCategory(months, nowStr),
    upcomingSpecialExpenses: upcomingSpecialExpenses(months, nowStr),
    monthlySavingsAvg: Math.round(avgMonthlySavings),
    loans: activeLoans,
    installments: activeInstallments,
    investments: investmentSummary,
    forecast
  };
}

/**
 * Simulate adding a one-time expense (e.g. buying a car).
 */
function simulateScenario({ summary, description, amount, date }) {
  // Compare month keys (YYYY-MM): a purchase on the 15th hits that month, not the next one.
  const purchaseMonth = String(date).slice(0, 7);
  const forecast = summary.forecast || [];
  const impactIndex = forecast.findIndex(f => f.month >= purchaseMonth);

  // Months before the purchase keep the original projection; from the purchase month on,
  // the amount is deducted once and the balance keeps growing by the average monthly savings.
  const impactMonths = forecast.map((f, i) => {
    if (impactIndex === -1 || i < impactIndex) {
      return { month: f.month, projectedBalance: f.projectedBalance, note: null };
    }
    const afterPurchase = forecast[impactIndex].projectedBalance - amount;
    const projectedBalance = afterPurchase + (i - impactIndex) * summary.monthlySavingsAvg;
    return {
      month: f.month,
      projectedBalance: Math.round(projectedBalance),
      note: i === impactIndex ? `Purchase: ${description} (−${amount.toLocaleString()})` : null
    };
  });

  const balanceAfterPurchase = impactIndex === -1
    ? summary.currentBalance - amount                       // purchase is beyond the forecast window
    : impactMonths[impactIndex].projectedBalance;

  return {
    scenario: { description, amount, date },
    balanceAfterPurchase,
    forecast: impactMonths
  };
}

module.exports = traceMethods({ buildSummary, simulateScenario }, 'cashflowEngine');
