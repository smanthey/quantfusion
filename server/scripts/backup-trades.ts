#!/usr/bin/env tsx
/**
 * Daily Trade Data Backup Script
 * 
 * Exports all trade data to JSON and CSV formats with timestamp
 * Run daily via cron: 0 0 * * * cd /path/to/project && npm run backup:trades
 */

import { db } from '../db';
import { trades, users, positions } from '@shared/schema';
import { desc } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
  }
}

async function backupTrades() {
  try {
    console.log('🔄 Starting trade data backup...');
    
    await ensureBackupDir();
    
    // Fetch all trades
    const allTrades = await db.select().from(trades).orderBy(desc(trades.executedAt));
    console.log(`📊 Found ${allTrades.length} trades to backup`);
    
    // Fetch all users
    const allUsers = await db.select().from(users);
    console.log(`👥 Found ${allUsers.length} users to backup`);
    
    // Fetch all positions
    const allPositions = await db.select().from(positions);
    console.log(`📈 Found ${allPositions.length} positions to backup`);
    
    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    // Create backup object
    const backup = {
      timestamp: new Date().toISOString(),
      exported: timestamp,
      counts: {
        trades: allTrades.length,
        users: allUsers.length,
        positions: allPositions.length
      },
      data: {
        trades: allTrades,
        users: allUsers.map(u => ({ ...u, passwordHash: '[REDACTED]' })), // Don't export passwords
        positions: allPositions
      }
    };
    
    // Save as JSON
    const jsonFilename = `backup-${timestamp}.json`;
    const jsonPath = path.join(BACKUP_DIR, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(backup, null, 2));
    console.log(`✅ JSON backup saved: ${jsonPath}`);
    
    // Save trades as CSV
    const csvFilename = `trades-${timestamp}.csv`;
    const csvPath = path.join(BACKUP_DIR, csvFilename);
    const csvContent = convertTradesToCSV(allTrades);
    fs.writeFileSync(csvPath, csvContent);
    console.log(`✅ CSV backup saved: ${csvPath}`);
    
    // Calculate statistics
    const stats = calculateStats(allTrades);
    console.log('\n📊 Backup Statistics:');
    console.log(`   Total Trades: ${stats.totalTrades}`);
    console.log(`   Open Positions: ${stats.openTrades}`);
    console.log(`   Closed Positions: ${stats.closedTrades}`);
    console.log(`   Total P&L: $${stats.totalPnL.toFixed(2)}`);
    console.log(`   Total Fees: $${stats.totalFees.toFixed(2)}`);
    console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
    
    // Keep only last 30 days of backups
    cleanOldBackups(30);
    
    console.log('\n✅ Backup completed successfully!\n');
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

function convertTradesToCSV(trades: any[]): string {
  if (trades.length === 0) {
    return 'No trades to export';
  }
  
  // CSV header
  const headers = ['ID', 'Symbol', 'Side', 'Size', 'Entry Price', 'Exit Price', 'P&L', 'Profit', 'Loss', 'Fees', 'Status', 'Strategy', 'Executed At'];
  let csv = headers.join(',') + '\n';
  
  // CSV rows
  for (const trade of trades) {
    const row = [
      trade.id,
      trade.symbol,
      trade.side,
      trade.size,
      trade.entryPrice,
      trade.exitPrice || '',
      trade.pnl || '0',
      trade.profit || '0',
      trade.loss || '0',
      trade.fees || '0',
      trade.status,
      trade.strategyId || '',
      trade.executedAt.toISOString()
    ];
    csv += row.join(',') + '\n';
  }
  
  return csv;
}

function calculateStats(trades: any[]) {
  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  
  let totalPnL = 0;
  let totalFees = 0;
  let wins = 0;
  
  for (const trade of closedTrades) {
    const pnl = parseFloat(trade.pnl || '0');
    const fees = parseFloat(trade.fees || '0');
    totalPnL += pnl;
    totalFees += fees;
    if (pnl > 0) wins++;
  }
  
  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    totalPnL,
    totalFees,
    winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0
  };
}

function cleanOldBackups(daysToKeep: number) {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    
    for (const file of files) {
      if (file.startsWith('backup-') || file.startsWith('trades-')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🗑️  Deleted ${deletedCount} old backup(s) (keeping last ${daysToKeep} days)`);
    }
  } catch (error) {
    console.error('Warning: Failed to clean old backups:', error);
  }
}

// Run the backup
backupTrades().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
