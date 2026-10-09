/**
 * Test database connection script
 * Run: node tools/test-connection.js (from the server folder)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testConnection() {
    console.log('🔍 Testing database connection...\n');
    
    const connectionString = process.env.DB_CONNECTION_STRING;
    
    if (!connectionString) {
        console.error('❌ ERROR: DB_CONNECTION_STRING is not set in .env file');
        process.exit(1);
    }
    
    console.log('📋 Connection String (masked):');
    const maskedString = connectionString.replace(/Password=[^;]+/gi, 'Password=***');
    console.log(`   ${maskedString}\n`);
    
    // Check if Windows Authentication is used
    const isWindowsAuth = /trusted_connection|integrated security/i.test(connectionString);
    console.log(`🔐 Authentication: ${isWindowsAuth ? 'Windows Authentication (Integrated Security)' : 'SQL Authentication'}\n`);
    
    try {
        // Load appropriate driver
        let sql;
        if (isWindowsAuth) {
            console.log('📦 Loading msnodesqlv8 driver for Windows Authentication...');
            try {
                sql = require('mssql/msnodesqlv8');
            } catch (err) {
                console.error('❌ ERROR: msnodesqlv8 driver not found!');
                console.error('   Run: npm install msnodesqlv8');
                console.error(`   Details: ${err.message}`);
                process.exit(1);
            }
        } else {
            console.log('📦 Loading standard mssql driver...');
            sql = require('mssql');
        }
        
        console.log('✅ Driver loaded successfully\n');
        
        console.log('🔌 Attempting to connect...');
        const pool = new sql.ConnectionPool(connectionString);
        await pool.connect();
        
        console.log('✅ Connection successful!\n');
        
        // Get database info
        console.log('📊 Database Information:');
        console.log(`   Server: ${pool.config.server}`);
        console.log(`   Database: ${pool.config.database}`);
        console.log(`   Port: ${pool.config.port || 'default'}\n`);
        
        // Test query
        console.log('🔍 Testing query execution...');
        const result = await pool.request().query('SELECT @@VERSION AS version, DB_NAME() AS database_name');
        
        if (result.recordset && result.recordset.length > 0) {
            console.log('✅ Query executed successfully!\n');
            console.log('📄 SQL Server Version:');
            console.log(`   ${result.recordset[0].version.split('\n')[0]}`);
            console.log(`\n📁 Current Database: ${result.recordset[0].database_name}\n`);
        }
        
        // Check if CashFlowDB tables exist
        console.log('🔍 Checking for CashFlowDB tables...');
        const tablesResult = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE' 
            AND TABLE_CATALOG = 'CashFlowDB'
            ORDER BY TABLE_NAME
        `);
        
        if (tablesResult.recordset && tablesResult.recordset.length > 0) {
            console.log(`✅ Found ${tablesResult.recordset.length} tables in CashFlowDB:`);
            tablesResult.recordset.forEach(row => {
                console.log(`   - ${row.TABLE_NAME}`);
            });
        } else {
            console.log('⚠️  No tables found in CashFlowDB. You may need to run migrations.');
            console.log('   Run: npm run db:migrate');
        }
        
        await pool.close();
        console.log('\n✅ Connection test completed successfully!');
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ CONNECTION FAILED!\n');
        console.error('Error Details:');
        console.error(`   Message: ${err.message}`);
        console.error(`   Code: ${err.code || 'N/A'}`);
        
        if (err.originalError) {
            console.error(`   Original Error: ${err.originalError.message}`);
        }
        
        console.log('\n💡 Troubleshooting Tips:');
        
        if (err.code === 'ESOCKET' || err.message.includes('Failed to connect')) {
            console.log('   1. Check if SQL Server is running');
            console.log('   2. Verify the server name: localhost\\MSSQLSERVER01');
            console.log('   3. Check if TCP/IP is enabled in SQL Server Configuration Manager');
            console.log('   4. Verify the instance name is correct');
        }
        
        if (err.message.includes('Login failed') || err.code === 'ELOGIN') {
            console.log('   1. Check your username and password');
            console.log('   2. Verify the user has access to CashFlowDB');
            console.log('   3. For Windows Auth, run as the correct Windows user');
        }
        
        if (err.message.includes('database') && err.message.includes('does not exist')) {
            console.log('   1. The database "CashFlowDB" does not exist');
            console.log('   2. Create it using SQL Server Management Studio or run:');
            console.log('      CREATE DATABASE CashFlowDB');
        }
        
        if (isWindowsAuth && err.message.includes('msnodesqlv8')) {
            console.log('   1. Install msnodesqlv8 driver:');
            console.log('      npm install msnodesqlv8');
        }
        
        console.log('\n');
        process.exit(1);
    }
}

testConnection();
