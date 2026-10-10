/**
 * Simple connection test - without specifying database
 */
const sql = require('mssql');

async function testSimple() {
    console.log('🔍 Testing simple connection to SQL Server...\n');
    
    // Try different connection methods
    const configs = [
        {
            name: 'Default Instance',
            config: {
                server: 'localhost',
                options: {
                    trustServerCertificate: true,
                    enableArithAbort: true
                },
                authentication: {
                    type: 'default'
                }
            }
        },
        {
            name: 'MSSQLSERVER01 Instance',
            config: {
                server: 'localhost\\MSSQLSERVER01',
                options: {
                    trustServerCertificate: true,
                    enableArithAbort: true,
                    instanceName: 'MSSQLSERVER01'
                },
                authentication: {
                    type: 'default'
                }
            }
        },
        {
            name: 'MSSQLSERVER Instance (explicit)',
            config: {
                server: 'localhost\\MSSQLSERVER',
                options: {
                    trustServerCertificate: true,
                    enableArithAbort: true
                },
                authentication: {
                    type: 'default'
                }
            }
        }
    ];
    
    for (const test of configs) {
        console.log(`\n📡 Testing: ${test.name}`);
        console.log(`   Server: ${test.config.server}`);
        
        try {
            const pool = new sql.ConnectionPool(test.config);
            await pool.connect();
            
            console.log('   ✅ Connected successfully!');
            
            // List databases
            const result = await pool.request().query('SELECT name FROM sys.databases ORDER BY name');
            console.log('   📁 Available databases:');
            result.recordset.forEach(db => {
                const marker = db.name === 'CashFlowDB' ? '   👉' : '     ';
                console.log(`${marker} ${db.name}`);
            });
            
            // Check if CashFlowDB exists
            const cashFlowExists = result.recordset.some(db => db.name === 'CashFlowDB');
            if (cashFlowExists) {
                console.log('\n   ✅ CashFlowDB exists!');
                
                // Try to use CashFlowDB
                try {
                    await pool.request().query('USE CashFlowDB');
                    const tables = await pool.request().query(`
                        SELECT TABLE_NAME 
                        FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_NAME
                    `);
                    
                    if (tables.recordset.length > 0) {
                        console.log(`   📊 Found ${tables.recordset.length} tables in CashFlowDB`);
                    } else {
                        console.log('   ⚠️  CashFlowDB exists but has no tables - run migrations');
                    }
                } catch (err) {
                    console.log(`   ❌ Cannot access CashFlowDB: ${err.message}`);
                }
            } else {
                console.log('\n   ⚠️  CashFlowDB does NOT exist!');
                console.log('   💡 Create it with: CREATE DATABASE CashFlowDB');
            }
            
            await pool.close();
            
            // If we got here, we found a working connection
            console.log('\n✅ WORKING CONNECTION FOUND!');
            console.log(`   Use this connection string:`);
            console.log(`   Server=${test.config.server};Database=CashFlowDB;Integrated Security=true;Encrypt=false;TrustServerCertificate=true;`);
            process.exit(0);
            
        } catch (err) {
            console.log(`   ❌ Failed: ${err.message}`);
        }
    }
    
    console.log('\n❌ No working connection found.');
    console.log('\n💡 Possible solutions:');
    console.log('   1. Use SQL Authentication instead of Windows Authentication');
    console.log('   2. Add your Windows user to SQL Server logins');
    console.log('   3. Run SQL Server Management Studio to check connection manually');
    
    process.exit(1);
}

testSimple();
