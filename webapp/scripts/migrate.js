#!/usr/bin/env node

// Database migration CLI script
const { program } = require('commander');
const database = require('../config/database');
const { 
  runMigrations, 
  rollbackMigrations, 
  getMigrationStatus, 
  generateMigration 
} = require('../config/migrations');
const { initializeEnvironment } = require('../config/environment');

// Initialize environment
const config = initializeEnvironment();

const connectDatabase = async () => {
  await database.init(config.DB_PATH);
  return database;
};

const disconnect = () => {
  database.close();
};

// Command: Run migrations
program
  .command('up')
  .description('Run pending migrations')
  .option('--dry-run', 'Show what would be executed without running')
  .action(async (options) => {
    try {
      console.log('🚀 Running database migrations...');
      const db = await connectDatabase();
      
      const result = await runMigrations(db, {
        migrationsDir: './migrations',
        dryRun: options.dryRun
      });
      
      if (options.dryRun) {
        console.log(`📋 Dry run completed. ${result.pending} migrations would be executed.`);
      } else {
        console.log(`✅ Migration completed. ${result.executed} migrations executed.`);
      }
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    } finally {
      disconnect();
    }
  });

// Command: Rollback migrations
program
  .command('down')
  .description('Rollback migrations')
  .option('-s, --steps <number>', 'Number of migrations to rollback', '1')
  .option('--dry-run', 'Show what would be executed without running')
  .action(async (options) => {
    try {
      console.log(`🔄 Rolling back ${options.steps} migration(s)...`);
      const db = await connectDatabase();
      
      const result = await rollbackMigrations(db, {
        migrationsDir: './migrations',
        steps: parseInt(options.steps),
        dryRun: options.dryRun
      });
      
      if (options.dryRun) {
        console.log(`📋 Dry run completed. ${result.rolledBack || 0} migrations would be rolled back.`);
      } else {
        console.log(`✅ Rollback completed. ${result.rolledBack} migrations rolled back.`);
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      process.exit(1);
    } finally {
      disconnect();
    }
  });

// Command: Migration status
program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    try {
      console.log('📊 Checking migration status...');
      const db = await connectDatabase();
      
      const status = await getMigrationStatus(db, {
        migrationsDir: './migrations'
      });
      
      console.log('\\n📈 Migration Status:');
      console.log(`   Total migrations: ${status.total}`);
      console.log(`   Executed: ${status.executed}`);
      console.log(`   Pending: ${status.pending}`);
      
      if (status.pendingMigrations.length > 0) {
        console.log('\\n📋 Pending migrations:');
        status.pendingMigrations.forEach(m => {
          console.log(`   ${m.version} - ${m.name}`);
        });
      }
      
      if (status.executedMigrations.length > 0) {
        console.log('\\n✅ Executed migrations:');
        status.executedMigrations.forEach(m => {
          console.log(`   ${m.version} - ${m.name} (${m.executed_at})`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to get status:', error.message);
      process.exit(1);
    } finally {
      disconnect();
    }
  });

// Command: Generate new migration
program
  .command('generate <name>')
  .description('Generate a new migration file')
  .action((name) => {
    try {
      console.log(`📝 Generating migration: ${name}`);
      
      const result = generateMigration(name, './migrations');
      
      console.log(`✅ Migration created: ${result.filename}`);
      console.log(`📁 Path: ${result.path}`);
      console.log('\\n📝 Don\\'t forget to implement the up() and down() functions!');
    } catch (error) {
      console.error('❌ Failed to generate migration:', error.message);
      process.exit(1);
    }
  });

// Command: Reset database (dangerous!)
program
  .command('reset')
  .description('Reset database by rolling back all migrations (DANGEROUS!)')
  .option('--force', 'Force reset without confirmation')
  .action(async (options) => {
    if (!options.force) {
      console.log('⚠️  This will reset your entire database!');
      console.log('Use --force flag to confirm this destructive action.');
      return;
    }
    
    try {
      console.log('🔥 Resetting database...');
      const db = await connectDatabase();
      
      const status = await getMigrationStatus(db);
      
      if (status.executed === 0) {
        console.log('📭 No migrations to rollback.');
        return;
      }
      
      const result = await rollbackMigrations(db, {
        migrationsDir: './migrations',
        steps: status.executed
      });
      
      console.log(`✅ Database reset completed. ${result.rolledBack} migrations rolled back.`);
    } catch (error) {
      console.error('❌ Reset failed:', error.message);
      process.exit(1);
    } finally {
      disconnect();
    }
  });

// Parse command line arguments
program
  .name('migrate')
  .description('Database migration tool for Bookmark Sync')
  .version('1.0.0');

program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}