/**
 * Small helpers on top of the "mssql" package:
 *  - typed parameters (always explicit, so decimals / Hebrew text are never mangled)
 *  - transactions
 *  - multi-row INSERT in chunks
 *  - JSON "extra" column helpers
 */
const sql = require('mssql');
const { getPool } = require('./connection');
const pure = require('./helpers.pure');

// ---------------------------------------------------------------- column specs
// A column spec says: column name, SQL parameter type and (optionally) a SQL expression
// that wraps the parameter. "{p}" is replaced by the parameter name.
const col = (name, type, expr) => ({ name, type, expr });

const C = {
    id: (name = 'id') => col(name, sql.NVarChar(50)),
    str: (name, len) => col(name, sql.NVarChar(len)),
    text: (name) => col(name, sql.NVarChar(sql.MAX)),
    vchar: (name, len) => col(name, sql.VarChar(len)),
    int: (name) => col(name, sql.Int),
    bit: (name) => col(name, sql.Bit),
    money: (name) => col(name, sql.Decimal(18, 2)),
    pct: (name) => col(name, sql.Decimal(9, 4)),
    // DATE column, value is a 'YYYY-MM-DD' string
    date: (name) => col(name, sql.VarChar(10), 'CONVERT(date, {p}, 23)'),
    // DATETIME2(3) column, value is an ISO string WITHOUT the trailing "Z" (see isoToDb)
    ts: (name) => col(name, sql.VarChar(30), 'CONVERT(datetime2(3), {p}, 126)')
};

// SELECT expressions that give the values back in the format the app uses.
const SEL = {
    date: (name) => `CONVERT(varchar(10), ${name}, 23) AS ${name}`,
    ts: (name) => `CONVERT(varchar(23), ${name}, 126) + 'Z' AS ${name}`
};

// ---------------------------------------------------------------- execution
function addInputs(request, params) {
    for (const [name, [type, value]] of Object.entries(params)) {
        request.input(name, type, value);
    }
    return request;
}

/** Runs a statement; `executor` is a pool or a transaction. params: { name: [type, value] } */
async function exec(executor, text, params = {}) {
    return addInputs(executor.request(), params).query(text);
}

/** Runs a SELECT and returns the rows. */
async function rows(executor, text, params = {}) {
    const result = await exec(executor, text, params);
    return result.recordset || [];
}

async function withTransaction(work) {
    const pool = await getPool();
    const tx = pool.transaction();
    await tx.begin();
    try {
        const result = await work(tx);
        await tx.commit();
        return result;
    } catch (err) {
        try {
            await tx.rollback();
        } catch (rollbackErr) {
            // connection may already be gone - original error is the important one
        }
        throw err;
    }
}

const paramRef = (column, name) => (column.expr ? column.expr.replace('{p}', `@${name}`) : `@${name}`);

/** Multi-row INSERT, split into chunks to stay under SQL Server's 2100-parameter limit. */
async function insertMany(executor, table, columns, records) {
    if (!records.length) return;
    const perChunk = Math.max(1, Math.min(1000, Math.floor(2000 / columns.length)));

    for (let start = 0; start < records.length; start += perChunk) {
        const request = executor.request();
        const slice = records.slice(start, start + perChunk);

        const valueLists = slice.map((record, r) => {
            const refs = columns.map((column, c) => {
                const name = `p${r}_${c}`;
                request.input(name, column.type, record[column.name] === undefined ? null : record[column.name]);
                return paramRef(column, name);
            });
            return `(${refs.join(', ')})`;
        });

        await request.query(
            `INSERT INTO ${table} (${columns.map((c) => c.name).join(', ')}) VALUES ${valueLists.join(', ')}`
        );
    }
}

/** UPDATE one row identified by a single key column. */
async function updateRow(executor, table, columns, record, keyColumn = 'id') {
    const request = executor.request();
    const assignments = [];
    for (const column of columns) {
        request.input(column.name, column.type, record[column.name] === undefined ? null : record[column.name]);
        if (column.name !== keyColumn) assignments.push(`${column.name} = ${paramRef(column, column.name)}`);
    }
    const keyColumnSpec = columns.find((c) => c.name === keyColumn);
    const result = await request.query(
        `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${keyColumn} = ${paramRef(keyColumnSpec, keyColumn)}`
    );
    return result.rowsAffected[0] || 0;
}

module.exports = {
    sql, C, SEL, col,
    ...pure,
    exec, rows, withTransaction, insertMany, updateRow,
    getPool
};
