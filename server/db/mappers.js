/**
 * Pure mapping functions: app objects (the same JSON the API always returned)
 * <-> flat table rows. No database access here, so they can be tested without SQL Server.
 */
const { ValidationError } = require('../utils/errors');
const {
    num, numOrNull, strOrNull, boolOrNull, isoToDb, jsonOrNull, parseJson, extraJson, setIf, groupBy
} = require('./helpers.pure');

const asArray = (v) => (Array.isArray(v) ? v : []);

// ============================================================================
// Cash flow
// ============================================================================
const MONTH_KNOWN = [
    'rowColor', 'month', 'startingBalance', 'income', 'mortgagePayment', 'loanPayment', 'manualLoanPayment',
    'installmentsPayment', 'additionalIncomes', 'regularExpenses', 'specialExpenses', 'endingBalance', 'savings'
];
const ITEM_KNOWN = ['description', 'amount', 'category', 'goalRelated', 'goalId'];
const ITEM_LISTS = [
    ['additionalIncomes', 'additionalIncome'],
    ['regularExpenses', 'regular'],
    ['specialExpenses', 'special']
];
const KIND_TO_LIST = Object.fromEntries(ITEM_LISTS.map(([list, kind]) => [kind, list]));

function monthDateOf(value) {
    const d = new Date(value);
    if (value === undefined || value === null || Number.isNaN(d.getTime())) {
        throw new ValidationError(`Invalid month value: ${value}`);
    }
    // Round to the nearest day: a month stamped at local midnight (e.g. 2026-02-28T22:00:00Z in Israel)
    // is really the 1st of the next month.
    const DAY = 24 * 60 * 60 * 1000;
    return new Date(Math.round(d.getTime() / DAY) * DAY).toISOString().slice(0, 10);
}

function monthToRow(m, index) {
    return {
        sort_order: index + 1,
        month_date: monthDateOf(m.month),
        starting_balance: num(m.startingBalance),
        income: num(m.income),
        mortgage_payment: num(m.mortgagePayment),
        loan_payment: num(m.loanPayment),
        manual_loan_payment: numOrNull(m.manualLoanPayment),
        installments_payment: numOrNull(m.installmentsPayment),
        ending_balance: num(m.endingBalance),
        savings: numOrNull(m.savings),
        row_color: strOrNull(m.rowColor),
        extra_json: extraJson(m, MONTH_KNOWN)
    };
}

/** All items of one month as rows (without month_id - the repository adds it). */
function monthItemRows(m) {
    const result = [];
    for (const [listName, kind] of ITEM_LISTS) {
        asArray(m[listName]).forEach((item, i) => {
            result.push({
                kind,
                sort_order: i + 1,
                description: item.description ?? '',
                amount: num(item.amount),
                category: kind === 'additionalIncome' ? null : strOrNull(item.category),
                goal_related: boolOrNull(item.goalRelated),
                goal_id: strOrNull(item.goalId),
                extra_json: extraJson(item, ITEM_KNOWN)
            });
        });
    }
    return result;
}

function assembleItem(row) {
    const item = { description: row.description, amount: Number(row.amount) };
    setIf(item, 'category', row.category);
    setIf(item, 'goalRelated', row.goal_related);
    setIf(item, 'goalId', row.goal_id);
    return Object.assign(item, parseJson(row.extra_json));
}

function assembleMonths(monthRows, itemRows) {
    const itemsByMonth = groupBy(itemRows, (r) => r.month_id);
    return monthRows.map((r) => {
        const m = {
            rowColor: r.row_color ?? null,
            month: `${r.month_date}T00:00:00.000Z`,
            startingBalance: Number(r.starting_balance),
            income: Number(r.income),
            mortgagePayment: Number(r.mortgage_payment),
            loanPayment: Number(r.loan_payment)
        };
        setIf(m, 'manualLoanPayment', r.manual_loan_payment === null ? null : Number(r.manual_loan_payment));
        setIf(m, 'installmentsPayment', r.installments_payment === null ? null : Number(r.installments_payment));

        const items = itemsByMonth.get(r.id) || [];
        for (const [listName, kind] of ITEM_LISTS) {
            m[listName] = items.filter((i) => i.kind === kind).map(assembleItem);
        }

        m.endingBalance = Number(r.ending_balance);
        setIf(m, 'savings', r.savings === null ? null : Number(r.savings));
        return Object.assign(m, parseJson(r.extra_json));
    });
}

// ---- defaults (template month)
function defaultsToRows(d) {
    const header = {
        id: 1,
        income: num(d.income),
        mortgage_payment: num(d.mortgagePayment),
        loan_payment: num(d.loanPayment)
    };
    const items = [];
    for (const [listName, kind] of ITEM_LISTS) {
        asArray(d[listName]).forEach((item, i) => {
            items.push({
                kind,
                sort_order: i + 1,
                description: item.description ?? '',
                amount: num(item.amount),
                category: kind === 'additionalIncome' ? null : strOrNull(item.category)
            });
        });
    }
    return { header, items };
}

function assembleDefaults(headerRow, itemRows) {
    const d = {
        income: Number(headerRow.income),
        mortgagePayment: Number(headerRow.mortgage_payment),
        loanPayment: Number(headerRow.loan_payment)
    };
    for (const [listName, kind] of ITEM_LISTS) {
        d[listName] = itemRows.filter((i) => i.kind === kind).map((r) => {
            const item = { description: r.description, amount: Number(r.amount) };
            return setIf(item, 'category', r.category);
        });
    }
    return d;
}

// ---- budget settings { CATEGORY: limit }
function budgetToRows(settings) {
    return Object.entries(settings || {}).map(([category, limit], i) => ({
        category,
        sort_order: i + 1,
        monthly_limit: num(limit)
    }));
}

function assembleBudget(budgetRows) {
    const settings = {};
    for (const r of budgetRows) settings[r.category] = Number(r.monthly_limit);
    return settings;
}

// ============================================================================
// Installments
// ============================================================================
const INSTALLMENT_KNOWN = [
    'id', 'name', 'totalAmount', 'downPayment', 'monthlyPayment', 'installmentsCount', 'startDate', 'color', 'notes',
    'manualPaidCount', 'lastManualPaymentDate', 'paymentType', 'linkedGoalId',
    'loanComponents', 'milestones', 'milestonePayments', 'payments'
];
const LOAN_KNOWN = [
    'id', 'description', 'totalLoanAmount', 'monthlyPayment', 'installmentsCount', 'startDate', 'paidCount',
    'lastPaidDate', 'interestRate', 'payoffDate', 'payoffAmount', 'payments'
];

function installmentToRows(inst) {
    const id = strOrNull(inst.id);
    if (!id) throw new ValidationError('Installment id is required');

    const parent = {
        id,
        name: inst.name ?? '',
        total_amount: num(inst.totalAmount),
        down_payment: num(inst.downPayment),
        monthly_payment: num(inst.monthlyPayment),
        installments_count: Math.trunc(num(inst.installmentsCount)),
        start_date: strOrNull(inst.startDate),
        color: inst.color ?? '#4f6ef7',
        notes: inst.notes ?? '',
        manual_paid_count: Math.trunc(num(inst.manualPaidCount)),
        last_manual_payment_date: strOrNull(inst.lastManualPaymentDate),
        payment_type: inst.paymentType ?? 'manual',
        linked_goal_id: strOrNull(inst.linkedGoalId),
        extra_json: extraJson(inst, INSTALLMENT_KNOWN)
    };

    const loans = [];
    const loanPayments = [];
    asArray(inst.loanComponents).forEach((l, i) => {
        const componentNo = i + 1;
        loans.push({
            installment_id: id,
            component_no: componentNo,
            component_id: strOrNull(l.id),
            description: l.description ?? '',
            total_loan_amount: num(l.totalLoanAmount),
            monthly_payment: num(l.monthlyPayment),
            installments_count: Math.trunc(num(l.installmentsCount)),
            start_date: strOrNull(l.startDate),
            paid_count: Math.trunc(num(l.paidCount)),
            last_paid_date: strOrNull(l.lastPaidDate),
            interest_rate: numOrNull(l.interestRate),
            payoff_date: strOrNull(l.payoffDate),
            payoff_amount: numOrNull(l.payoffAmount),
            // "payments: []" (tracked, nothing paid) is different from "no payments field" in the app
            payments_tracked: Array.isArray(l.payments),
            extra_json: extraJson(l, LOAN_KNOWN)
        });
        asArray(l.payments).forEach((p, j) => {
            loanPayments.push({
                installment_id: id,
                component_no: componentNo,
                sort_order: j + 1,
                payment_date: strOrNull(p.date),
                amount: num(p.amount)
            });
        });
    });

    const milestones = asArray(inst.milestones).map((m, i) => ({
        installment_id: id,
        sort_order: i + 1,
        milestone_id: strOrNull(m.id),
        description: m.description ?? '',
        percentage: num(m.percentage),
        amount: num(m.amount),
        milestone_date: strOrNull(m.date)
    }));

    const milestonePayments = asArray(inst.milestonePayments).map((p, i) => ({
        installment_id: id,
        sort_order: i + 1,
        payment_date: strOrNull(p.date),
        amount: num(p.amount),
        milestone_id: strOrNull(p.milestoneId),
        description: strOrNull(p.description)
    }));

    const payments = asArray(inst.payments).map((p, i) => ({
        installment_id: id,
        sort_order: i + 1,
        payment_date: strOrNull(p.date),
        amount: num(p.amount)
    }));

    return { parent, loans, loanPayments, milestones, milestonePayments, payments };
}

/** parts: { parents, loans, loanPayments, milestones, milestonePayments, payments } (all row arrays) */
function assembleInstallments(parts) {
    const loansBy = groupBy(parts.loans, (r) => r.installment_id);
    const loanPaymentsBy = groupBy(parts.loanPayments, (r) => `${r.installment_id}#${r.component_no}`);
    const milestonesBy = groupBy(parts.milestones, (r) => r.installment_id);
    const milestonePaymentsBy = groupBy(parts.milestonePayments, (r) => r.installment_id);
    const paymentsBy = groupBy(parts.payments, (r) => r.installment_id);

    return parts.parents.map((r) => {
        const inst = {
            name: r.name,
            totalAmount: Number(r.total_amount),
            downPayment: Number(r.down_payment),
            monthlyPayment: Number(r.monthly_payment),
            installmentsCount: r.installments_count,
            startDate: r.start_date,
            color: r.color,
            notes: r.notes,
            manualPaidCount: r.manual_paid_count,
            paymentType: r.payment_type
        };
        setIf(inst, 'lastManualPaymentDate', r.last_manual_payment_date);
        setIf(inst, 'linkedGoalId', r.linked_goal_id);

        inst.loanComponents = (loansBy.get(r.id) || []).map((l) => {
            const loan = {
                id: l.component_id,
                description: l.description,
                totalLoanAmount: Number(l.total_loan_amount),
                monthlyPayment: Number(l.monthly_payment),
                installmentsCount: l.installments_count,
                startDate: l.start_date,
                interestRate: l.interest_rate === null ? undefined : Number(l.interest_rate),
                paidCount: l.paid_count
            };
            setIf(loan, 'lastPaidDate', l.last_paid_date);
            setIf(loan, 'payoffAmount', l.payoff_amount === null ? null : Number(l.payoff_amount));
            setIf(loan, 'payoffDate', l.payoff_date);
            if (l.payments_tracked) {
                loan.payments = (loanPaymentsBy.get(`${r.id}#${l.component_no}`) || [])
                    .map((p) => ({ date: p.payment_date, amount: Number(p.amount) }));
            }
            Object.assign(loan, parseJson(l.extra_json));
            return stripUndefined(loan);
        });

        inst.milestones = (milestonesBy.get(r.id) || []).map((m) => ({
            id: m.milestone_id,
            description: m.description,
            percentage: Number(m.percentage),
            amount: Number(m.amount),
            date: m.milestone_date
        }));

        inst.milestonePayments = (milestonePaymentsBy.get(r.id) || []).map((p) => {
            const payment = { date: p.payment_date, amount: Number(p.amount), milestoneId: p.milestone_id };
            return setIf(payment, 'description', p.description);
        });

        inst.payments = (paymentsBy.get(r.id) || [])
            .map((p) => ({ date: p.payment_date, amount: Number(p.amount) }));

        inst.id = r.id;
        return Object.assign(inst, parseJson(r.extra_json));
    });
}

function stripUndefined(obj) {
    for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];
    return obj;
}

// ============================================================================
// Investments
// ============================================================================
const INVESTMENT_KNOWN = [
    'id', 'name', 'type', 'initialValue', 'annualReturn', 'transactions', 'snapshots', 'simulationRules'
];

function investmentToRows(inv) {
    const id = strOrNull(inv.id);
    if (!id) throw new ValidationError('Investment id is required');

    return {
        parent: {
            id,
            name: inv.name ?? '',
            investment_type: inv.type ?? 'other',
            initial_value: numOrNull(inv.initialValue),
            annual_return: numOrNull(inv.annualReturn),
            extra_json: extraJson(inv, INVESTMENT_KNOWN)
        },
        transactions: asArray(inv.transactions).map((t, i) => ({
            investment_id: id,
            sort_order: i + 1,
            tx_id: strOrNull(t.id),
            tx_date: String(t.date ?? ''),
            amount: num(t.amount),
            tx_type: t.type ?? 'deposit'
        })),
        snapshots: asArray(inv.snapshots).map((s, i) => ({
            investment_id: id,
            sort_order: i + 1,
            snapshot_id: strOrNull(s.id),
            snapshot_date: String(s.date ?? ''),
            snapshot_value: num(s.value)
        })),
        rules: asArray(inv.simulationRules).map((r, i) => ({
            investment_id: id,
            sort_order: i + 1,
            rule_id: strOrNull(r.id),
            from_month: Math.trunc(num(r.fromMonth)),
            to_month: Math.trunc(num(r.toMonth)),
            monthly_amount: num(r.monthlyAmount),
            one_time_amount: num(r.oneTimeAmount),
            description: strOrNull(r.description)
        }))
    };
}

function assembleInvestments(parts) {
    const txBy = groupBy(parts.transactions, (r) => r.investment_id);
    const snapBy = groupBy(parts.snapshots, (r) => r.investment_id);
    const ruleBy = groupBy(parts.rules, (r) => r.investment_id);

    return parts.parents.map((r) => {
        const inv = {};
        inv.transactions = (txBy.get(r.id) || []).map((t) => {
            const tx = { date: t.tx_date, amount: Number(t.amount), type: t.tx_type };
            if (t.tx_id !== null) tx.id = t.tx_id;
            return tx;
        });
        inv.snapshots = (snapBy.get(r.id) || []).map((s) => {
            const snap = { date: s.snapshot_date, value: Number(s.snapshot_value) };
            if (s.snapshot_id !== null) snap.id = s.snapshot_id;
            return snap;
        });
        inv.simulationRules = (ruleBy.get(r.id) || []).map((x) => {
            const rule = {
                id: x.rule_id,
                fromMonth: x.from_month,
                toMonth: x.to_month,
                monthlyAmount: Number(x.monthly_amount),
                oneTimeAmount: Number(x.one_time_amount)
            };
            return stripUndefined(setIf(rule, 'description', x.description));
        });
        inv.id = r.id;
        inv.name = r.name;
        inv.type = r.investment_type;
        setIf(inv, 'initialValue', r.initial_value === null ? null : Number(r.initial_value));
        setIf(inv, 'annualReturn', r.annual_return === null ? null : Number(r.annual_return));
        return Object.assign(inv, parseJson(r.extra_json));
    });
}

// ============================================================================
// Financial goals
// ============================================================================
const GOAL_KNOWN = [
    'id', 'name', 'description', 'type', 'targetAmount', 'targetDate', 'loanDetails', 'schedule',
    'linkedInstallmentId', 'linkedToSpecialExpense', 'autoUpdateFromCashFlow', 'priority', 'analysis',
    'lastAnalyzed', 'createdDate', 'updatedDate', 'completed', 'isFixed', 'completedDate'
];

function goalToRow(g) {
    const id = strOrNull(g.id);
    if (!id) throw new ValidationError('Goal id is required');
    return {
        id,
        name: g.name ?? '',
        description: strOrNull(g.description),
        goal_type: g.type ?? 'PURCHASE',
        target_amount: num(g.targetAmount),
        target_date: strOrNull(g.targetDate),
        priority: Math.trunc(num(g.priority, 999)),
        completed: Boolean(g.completed),
        is_fixed: boolOrNull(g.isFixed),
        linked_installment_id: strOrNull(g.linkedInstallmentId),
        linked_to_special_expense: boolOrNull(g.linkedToSpecialExpense),
        auto_update_from_cash_flow: boolOrNull(g.autoUpdateFromCashFlow),
        loan_details_json: jsonOrNull(g.loanDetails),
        schedule_json: jsonOrNull(g.schedule),
        analysis_json: jsonOrNull(g.analysis),
        last_analyzed: isoToDb(g.lastAnalyzed),
        created_date: isoToDb(g.createdDate),
        updated_date: isoToDb(g.updatedDate),
        completed_date: isoToDb(g.completedDate),
        extra_json: extraJson(g, GOAL_KNOWN)
    };
}

const isoFromDb = (v) => (v === null || v === undefined ? null : v);

function assembleGoal(r) {
    const g = { id: r.id, name: r.name };
    setIf(g, 'description', r.description);
    g.type = r.goal_type;
    g.targetAmount = Number(r.target_amount);
    setIf(g, 'targetDate', r.target_date);
    setIf(g, 'loanDetails', parseJson(r.loan_details_json));
    setIf(g, 'schedule', parseJson(r.schedule_json));
    setIf(g, 'linkedInstallmentId', r.linked_installment_id);
    setIf(g, 'linkedToSpecialExpense', r.linked_to_special_expense);
    setIf(g, 'autoUpdateFromCashFlow', r.auto_update_from_cash_flow);
    g.priority = r.priority;
    setIf(g, 'analysis', parseJson(r.analysis_json));
    setIf(g, 'lastAnalyzed', isoFromDb(r.last_analyzed));
    setIf(g, 'createdDate', isoFromDb(r.created_date));
    setIf(g, 'updatedDate', isoFromDb(r.updated_date));
    g.completed = Boolean(r.completed);
    setIf(g, 'isFixed', r.is_fixed);
    setIf(g, 'completedDate', isoFromDb(r.completed_date));
    return Object.assign(g, parseJson(r.extra_json));
}

// ============================================================================
// Conversations
// ============================================================================
const CONVERSATION_KNOWN = ['id', 'title', 'messages', 'createdAt', 'updatedAt'];
const MESSAGE_KNOWN = ['role', 'content', 'timestamp'];

function conversationToRows(c) {
    const id = strOrNull(c.id);
    if (!id) throw new ValidationError('Conversation id is required');
    return {
        parent: {
            id,
            title: c.title ?? '',
            created_at: isoToDb(c.createdAt),
            updated_at: isoToDb(c.updatedAt),
            extra_json: extraJson(c, CONVERSATION_KNOWN)
        },
        messages: asArray(c.messages).map((m, i) => ({
            conversation_id: id,
            sort_order: i + 1,
            role: m.role ?? 'user',
            content: m.content ?? '',
            sent_at: isoToDb(m.timestamp),
            extra_json: extraJson(m, MESSAGE_KNOWN)
        }))
    };
}

function assembleConversations(parentRows, messageRows) {
    const messagesBy = groupBy(messageRows, (r) => r.conversation_id);
    return parentRows.map((r) => {
        const messages = (messagesBy.get(r.id) || []).map((m) => {
            const msg = { role: m.role, content: m.content };
            setIf(msg, 'timestamp', isoFromDb(m.sent_at));
            return Object.assign(msg, parseJson(m.extra_json));
        });
        const c = { id: r.id, title: r.title };
        setIf(c, 'createdAt', isoFromDb(r.created_at));
        setIf(c, 'updatedAt', isoFromDb(r.updated_at));
        c.messages = messages;
        return Object.assign(c, parseJson(r.extra_json));
    });
}

// ============================================================================
// AI reports
// ============================================================================
const REPORT_KNOWN = ['id', 'type', 'content', 'scenarioDetails', 'createdAt'];

function reportToRow(r) {
    const id = strOrNull(r.id);
    if (!id) throw new ValidationError('Report id is required');
    return {
        id,
        report_type: strOrNull(r.type),
        content: strOrNull(r.content),
        scenario_details_json: jsonOrNull(r.scenarioDetails),
        created_at: isoToDb(r.createdAt),
        extra_json: extraJson(r, REPORT_KNOWN)
    };
}

function assembleReport(row) {
    const r = { id: row.id };
    setIf(r, 'type', row.report_type);
    setIf(r, 'content', row.content);
    setIf(r, 'scenarioDetails', parseJson(row.scenario_details_json));
    setIf(r, 'createdAt', isoFromDb(row.created_at));
    return Object.assign(r, parseJson(row.extra_json));
}

module.exports = {
    KIND_TO_LIST,
    monthToRow, monthItemRows, assembleMonths,
    defaultsToRows, assembleDefaults,
    budgetToRows, assembleBudget,
    installmentToRows, assembleInstallments,
    investmentToRows, assembleInvestments,
    goalToRow, assembleGoal,
    conversationToRows, assembleConversations,
    reportToRow, assembleReport
};
