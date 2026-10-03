/**
 * Test ADO.NET style connection with regular mssql driver
 */
const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testADO() {
    console.log('🔍 Testing ADO.NET connection with mssql driver...\n');

    // Parse ADO.NET connection string to config object
    const connectionString = process.env.DB_CONNECTION_STRING;
    console.log('Connection String:', connectionString, '\n');

    // Convert ADO.NET to mssql config
    const config = {
        server: 'GAL-VICTUS\\MSSQLSERVER01',
        database: 'CashFlowDB',
        options: {
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true,
            instanceName: 'MSSQLSERVER01'
        },
        authentication: {
            type: 'default'
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };

    console.log('Config:', JSON.stringify(config, null, 2), '\n');

    try {
        console.log('🔌 Connecting...');
        const pool = new sql.ConnectionPool(config);

        pool.on('error', err => {
            console.error('Pool error:', err);
        });

        await pool.connect();
        console.log('✅ Connected successfully!\n');

        // Test query
        const result = await pool.request().query('SELECT @@VERSION AS version, DB_NAME() AS database_name');
        console.log('SQL Server Version:', result.recordset[0].version.split('\n')[0]);
        console.log('Current Database:', result.recordset[0].database_name, '\n');

        // Check tables
        const tables = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);

        if (tables.recordset.length > 0) {
            console.log(`✅ Found ${tables.recordset.length} tables in CashFlowDB:`);
            tables.recordset.forEach(row => {
                console.log(`   - ${row.TABLE_NAME}`);
            });
        } else {
            console.log('⚠️  No tables found - database is empty');
        }

        await pool.close();
        console.log('\n✅ Connection test successful!');
        console.log('\n📋 Use this connection string format in .env:');
        console.log('DB_CONNECTION_STRING=Server=GAL-VICTUS;Database=CashFlowDB;Integrated Security=true;Encrypt=false;TrustServerCertificate=true;');

        process.exit(0);

    } catch (err) {
        console.error('\n❌ Connection failed!');
        console.error('Error:', err.message);
        console.error('\nFull error:', err);
        process.exit(1);
    }
}

testADO();
