/**
 * Cashflow Engine — pure deterministic logic, no AI.
 * All calculations here; AI only gets the summarized output.
 */

function sumExpenses(items = []) {
  return items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

/**
 * Build a compact financial summary from raw data files.
 * This is the DTO sent to AI — small, structured, no raw history.
 */
function buildSummary({ cashFlow, installments = [], investments = [], defaults = {} }) {
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
  const activeLoans = installments
    .filter(i => i.loanComponents?.length > 0)
    .map(i => ({
      name: i.name,
      totalAmount: i.totalAmount,
      monthlyPayment: i.monthlyPayment,
      remainingPayments: i.installmentsCount - (i.manualPaidCount || 0),
      remainingBalance: i.monthlyPayment * (i.installmentsCount - (i.manualPaidCount || 0))
    }));

  const activeInstallments = installments
    .filter(i => !i.loanComponents?.length)
    .map(i => ({
      name: i.name,
      totalAmount: i.totalAmount,
      monthlyPayment: i.monthlyPayment,
      remainingPayments: i.installmentsCount - (i.manualPaidCount || 0)
    }));

  // --- Investments ---
  const investmentSummary = investments.map(inv => {
    const snaps = inv.snapshots || [];
    const latestSnap = snaps.length ? snaps[snaps.length - 1] : null;
    return {
      name: inv.name,
      type: inv.type,
      currentValue: latestSnap?.value ?? null,
      snapshotsCount: snaps.length
    };
  });

  // --- 6-month Forecast (simple linear projection) ---
  const forecast = [];
  let projectedBalance = currentBalance;
  let forecastDate = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 1; i <= 6; i++) {
    forecastDate.setMonth(forecastDate.getMonth() + 1);
    projectedBalance += avgMonthlySavings;
    forecast.push({
      month: forecastDate.toISOString().substring(0, 7),
      projectedBalance: Math.round(projectedBalance)
    });
  }

  return {
    periodCovered: {
      from: oldest.month?.substring(0, 7),
      to: latest.month?.substring(0, 7),
      months: monthCount
    },
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
  const impactMonths = [];
  let balance = summary.currentBalance;
  const startDate = new Date(date);

  for (const f of summary.forecast) {
    const fDate = new Date(f.month + '-01');
    const isImpactMonth = fDate >= startDate && impactMonths.length === 0;
    const deduction = isImpactMonth ? amount : 0;
    balance = f.projectedBalance - (isImpactMonth ? amount : 0);

    impactMonths.push({
      month: f.month,
      projectedBalance: Math.round(balance),
      note: isImpactMonth ? `Purchase: ${description} (−${amount.toLocaleString()})` : null
    });

    if (isImpactMonth) {
      // re-project from this point with updated balance
      let adj = balance;
      for (let i = impactMonths.length; i < summary.forecast.length; i++) {
        adj += summary.monthlySavingsAvg;
        impactMonths.push({
          month: summary.forecast[i].month,
          projectedBalance: Math.round(adj),
          note: null
        });
      }
      break;
    }
  }

  return {
    scenario: { description, amount, date },
    balanceAfterPurchase: impactMonths[0]?.projectedBalance ?? summary.currentBalance - amount,
    forecast: impactMonths
  };
}

module.exports = { buildSummary, simulateScenario };
