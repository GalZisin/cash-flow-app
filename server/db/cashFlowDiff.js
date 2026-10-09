/**
 * Pure diff between the cash flow months already in the database and the months the client
 * sent, so a save only touches rows that actually changed (no database access here).
 *
 * Input rows are in "DB row" shape (snake_case, as produced by db/mappers monthToRow /
 * monthItemRows and as returned by SELECT). Items carry no month_id yet.
 */

const MONTH_FIELDS = [
    'month_date', 'starting_balance', 'income', 'mortgage_payment', 'loan_payment', 'manual_loan_payment',
    'installments_payment', 'ending_balance', 'savings', 'row_color', 'extra_json'
];
const ITEM_FIELDS = ['kind', 'sort_order', 'description', 'amount', 'category', 'goal_related', 'goal_id', 'extra_json'];

function normalize(value) {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Math.round(value * 100) / 100; // money columns are DECIMAL(18,2)
    const asNumber = Number(value);
    if (value !== '' && typeof value === 'string' && Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(value)) {
        return Math.round(asNumber * 100) / 100;
    }
    return String(value);
}

function sameRecord(a, b, fields) {
    return fields.every((f) => normalize(a[f]) === normalize(b[f]));
}

function sameItems(a, b) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => sameRecord(item, b[i], ITEM_FIELDS));
}

/**
 * @param {Array} existingMonths  rows from cash_flow_months (must include id and sort_order)
 * @param {Array} existingItems   rows from cash_flow_items (must include month_id)
 * @param {Array} incoming        [{ row, items }] in display order (row.sort_order = index + 1)
 */
function planCashFlowWrite(existingMonths, existingItems, incoming) {
    const bySortOrder = new Map(existingMonths.map((m) => [m.sort_order, m]));
    const itemsByMonth = new Map();
    for (const item of existingItems) {
        if (!itemsByMonth.has(item.month_id)) itemsByMonth.set(item.month_id, []);
        itemsByMonth.get(item.month_id).push(item);
    }
    // Items are compared in (kind, sort_order) order, the same order they are written.
    for (const list of itemsByMonth.values()) {
        list.sort((x, y) => x.kind.localeCompare(y.kind) || x.sort_order - y.sort_order);
    }
    const sortItems = (list) => [...list].sort((x, y) => x.kind.localeCompare(y.kind) || x.sort_order - y.sort_order);

    const plan = { insert: [], update: [], deleteIds: [], unchanged: 0 };

    incoming.forEach(({ row, items }, index) => {
        const sortOrder = index + 1;
        const current = bySortOrder.get(sortOrder);
        const incomingItems = sortItems(items);

        if (!current) {
            plan.insert.push({ row: { ...row, sort_order: sortOrder }, items: incomingItems });
            return;
        }

        const rowChanged = !sameRecord(current, row, MONTH_FIELDS);
        const itemsChanged = !sameItems(itemsByMonth.get(current.id) || [], incomingItems);
        if (!rowChanged && !itemsChanged) {
            plan.unchanged += 1;
            return;
        }
        plan.update.push({ id: current.id, row: { ...row, sort_order: sortOrder }, items: incomingItems, rowChanged, itemsChanged });
    });

    for (const m of existingMonths) {
        if (m.sort_order > incoming.length) plan.deleteIds.push(m.id);
    }

    return plan;
}

module.exports = { planCashFlowWrite, MONTH_FIELDS, ITEM_FIELDS };
