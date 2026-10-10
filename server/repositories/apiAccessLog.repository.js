/**
 * Writes one row per API request to [log].cash_flow_api_access (db/log-schema.sql).
 * Not traced on purpose: it runs after the response, outside the request chain.
 */
const { C, insertReturningId, getPool } = require('../db/helpers');

const TABLE = '[log].cash_flow_api_access';

const COLUMNS = [
    C.vchar('request_id', 50), C.str('user_name', 128), C.ts('start_time'),
    C.vchar('service_name', 100), C.vchar('method_name', 256), C.str('inner_method_name', 2000),
    C.vchar('http_method', 10), C.str('request_path', 512),
    C.text('request_data'), C.text('response_data'), C.id('entity_id'),
    C.bit('is_error'), C.text('event_message'),
    C.str('machine_name', 256), C.vchar('ip_address', 128),
    C.ts('end_time'), C.int('status')
];

class ApiAccessLogRepository {
    /** Inserts the entry (keys = column names, timestamps already in local 'YYYY-MM-DDTHH:mm:ss.SSS'). Returns event_id. */
    async insert(entry) {
        const pool = await getPool();
        return insertReturningId(pool, TABLE, COLUMNS, entry, 'event_id');
    }
}

module.exports = new ApiAccessLogRepository();
