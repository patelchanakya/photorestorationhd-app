import AsyncStorage from '@react-native-async-storage/async-storage';
import { photoUsageService } from './photoUsageService';

interface PendingRollback {
  id: string;
  userId: string;
  type: 'photo'; // Only photo rollbacks now
  timestamp: number;
  attempts: number;
  lastAttemptTime: number;
  maxRetries: number;
  reason: string; // Why the rollback is needed
}

interface RollbackMetrics {
  totalAttempts: number;
  successfulRollbacks: number;
  failedRollbacks: number;
  pendingRollbacks: number;
  lastSuccessTime?: number;
  lastFailureTime?: number;
}

class RollbackService {
  private readonly STORAGE_KEY = 'pending-rollbacks-v1';
  private readonly METRICS_KEY = 'rollback-metrics-v1';
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly INITIAL_RETRY_DELAY = 2000; // 2 seconds
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds
  private readonly CLEANUP_AGE_DAYS = 7; // Remove rollbacks older than 7 days

  /**
   * Attempt to rollback usage with robust retry logic
   * If immediate retry fails, adds to pending queue for later processing
   */
  async attemptRollback(
    userId: string, 
    type: 'photo', 
    reason: string = 'Generation failed'
  ): Promise<boolean> {
    try {
      if (__DEV__) {
        console.log(`🔄 [ROLLBACK] Attempting ${type} rollback for user:`, userId);
      }

      // Try immediate rollback first
      this.logAnalytics('rollback_attempted', userId, type, { reason, immediate: true });
      const success = await this.performRollback(userId, type);
      
      if (success) {
        if (__DEV__) {
          console.log(`✅ [ROLLBACK] Immediate ${type} rollback successful`);
        }
        this.logAnalytics('rollback_success', userId, type, { reason, immediate: true });
        await this.updateMetrics('success');
        return true;
      }

      // Immediate rollback failed, add to pending queue
      this.logAnalytics('rollback_failed', userId, type, { reason, immediate: true });
      await this.addToPendingQueue(userId, type, reason);
      this.logAnalytics('rollback_queued', userId, type, { reason });
      if (__DEV__) {
        console.log(`📝 [ROLLBACK] Added ${type} rollback to pending queue`);
      }
      
      // Try once more with delay
      await this.delay(this.INITIAL_RETRY_DELAY);
      const retrySuccess = await this.performRollback(userId, type);
      
      if (retrySuccess) {
        if (__DEV__) {
          console.log(`✅ [ROLLBACK] Delayed ${type} rollback successful`);
        }
        await this.removeFromPendingQueue(userId, type);
        await this.updateMetrics('success');
        return true;
      }

      if (__DEV__) {
        console.log(`⏳ [ROLLBACK] ${type} rollback will be retried in background`);
      }
      await this.updateMetrics('failure');
      return false;

    } catch (error) {
      if (__DEV__) {
        console.error(`❌ [ROLLBACK] Critical error in ${type} rollback:`, error);
      }
      
      // Even if there's an error, try to add to pending queue
      try {
        await this.addToPendingQueue(userId, type, `${reason} (error: ${(error as Error).message})`);
      } catch (queueError) {
        if (__DEV__) {
          console.error(`❌ [ROLLBACK] Failed to add to pending queue:`, queueError);
        }
      }
      
      await this.updateMetrics('failure');
      return false;
    }
  }

  /**
   * Process all pending rollbacks with exponential backoff
   * Called by background recovery hook
   */
  async processPendingRollbacks(): Promise<void> {
    try {
      const pending = await this.getPendingRollbacks();
      
      if (pending.length === 0) {
        return;
      }

      if (__DEV__) {
        console.log(`🔄 [ROLLBACK] Processing ${pending.length} pending rollbacks`);
      }

      // Clean up old rollbacks first
      await this.cleanupOldRollbacks();

      // Process each pending rollback
      for (const rollback of pending) {
        await this.processIndividualRollback(rollback);
      }

    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error processing pending rollbacks:', error);
      }
    }
  }

  /**
   * Get current rollback metrics for monitoring
   */
  async getMetrics(): Promise<RollbackMetrics> {
    try {
      const stored = await AsyncStorage.getItem(this.METRICS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error reading metrics:', error);
      }
    }

    return {
      totalAttempts: 0,
      successfulRollbacks: 0,
      failedRollbacks: 0,
      pendingRollbacks: 0
    };
  }

  /**
   * Get pending rollbacks count for UI display
   */
  async getPendingCount(): Promise<number> {
    try {
      const pending = await this.getPendingRollbacks();
      return pending.length;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error getting pending count:', error);
      }
      return 0;
    }
  }

  // Private methods

  private async performRollback(userId: string, type: 'photo'): Promise<boolean> {
    try {
      return await photoUsageService.rollbackUsage();
    } catch (error) {
      if (__DEV__) {
        console.error(`❌ [ROLLBACK] ${type} rollback failed:`, error);
      }
      return false;
    }
  }

  private async addToPendingQueue(userId: string, type: 'photo', reason: string): Promise<void> {
    const rollback: PendingRollback = {
      id: `${type}-${userId}-${Date.now()}`,
      userId,
      type,
      timestamp: Date.now(),
      attempts: 0,
      lastAttemptTime: 0,
      maxRetries: this.MAX_RETRY_ATTEMPTS,
      reason
    };

    const pending = await this.getPendingRollbacks();
    
    // Check if similar rollback already exists (prevent duplicates)
    const exists = pending.some(p => 
      p.userId === userId && 
      p.type === type && 
      (Date.now() - p.timestamp) < 600000 // Within 10 minutes (extended for safety)
    );

    if (exists) {
      if (__DEV__) {
        console.log(`⚠️ [ROLLBACK] Duplicate ${type} rollback prevented for user:`, userId);
      }
      return;
    }

    pending.push(rollback);
    await this.savePendingRollbacks(pending);
    await this.updateMetrics('pending');
  }

  private async removeFromPendingQueue(userId: string, type: 'photo'): Promise<void> {
    const pending = await this.getPendingRollbacks();
    const filtered = pending.filter(p => !(p.userId === userId && p.type === type));
    await this.savePendingRollbacks(filtered);
  }

  private async processIndividualRollback(rollback: PendingRollback): Promise<void> {
    const now = Date.now();
    
    // Check if we've exceeded max retries
    if (rollback.attempts >= rollback.maxRetries) {
      if (__DEV__) {
        console.log(`⚠️ [ROLLBACK] Max retries exceeded for ${rollback.type} rollback:`, rollback.id);
      }
      await this.markRollbackFailed(rollback);
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.INITIAL_RETRY_DELAY * Math.pow(2, rollback.attempts),
      this.MAX_RETRY_DELAY
    );

    // Check if enough time has passed since last attempt
    if (rollback.lastAttemptTime > 0 && (now - rollback.lastAttemptTime) < delay) {
      return; // Not time to retry yet
    }

    if (__DEV__) {
      console.log(`🔄 [ROLLBACK] Retrying ${rollback.type} rollback (attempt ${rollback.attempts + 1}/${rollback.maxRetries}):`, rollback.id);
    }

    // Update attempt tracking
    rollback.attempts++;
    rollback.lastAttemptTime = now;
    await this.updateRollbackAttempt(rollback);

    // Attempt the rollback
    const success = await this.performRollback(rollback.userId, rollback.type);

    if (success) {
      if (__DEV__) {
        console.log(`✅ [ROLLBACK] Background ${rollback.type} rollback successful:`, rollback.id);
      }
      await this.removeFromPendingQueue(rollback.userId, rollback.type);
      await this.updateMetrics('success');
    } else {
      if (__DEV__) {
        console.log(`❌ [ROLLBACK] Background ${rollback.type} rollback failed (attempt ${rollback.attempts}):`, rollback.id);
      }
      await this.updateMetrics('failure');
    }
  }

  private async markRollbackFailed(rollback: PendingRollback): Promise<void> {
    // Log critical failure for manual intervention
    console.error(`🚨 [ROLLBACK] CRITICAL: ${rollback.type} rollback permanently failed after ${rollback.attempts} attempts:`, {
      rollbackId: rollback.id,
      userId: rollback.userId,
      type: rollback.type,
      reason: rollback.reason,
      timestamp: new Date(rollback.timestamp).toISOString()
    });

    // Remove from pending queue
    await this.removeFromPendingQueue(rollback.userId, rollback.type);
    
    // TODO: Could add to a "failed rollbacks" log for manual correction
    // For now, we log it for monitoring systems to pick up
  }

  private async getPendingRollbacks(): Promise<PendingRollback[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error reading pending rollbacks:', error);
      }
      return [];
    }
  }

  private async savePendingRollbacks(rollbacks: PendingRollback[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(rollbacks));
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error saving pending rollbacks:', error);
      }
    }
  }

  private async updateRollbackAttempt(rollback: PendingRollback): Promise<void> {
    const pending = await this.getPendingRollbacks();
    const index = pending.findIndex(p => p.id === rollback.id);
    if (index !== -1) {
      pending[index] = rollback;
      await this.savePendingRollbacks(pending);
    }
  }

  private async cleanupOldRollbacks(): Promise<void> {
    const pending = await this.getPendingRollbacks();
    const cutoff = Date.now() - (this.CLEANUP_AGE_DAYS * 24 * 60 * 60 * 1000);
    
    const cleaned = pending.filter(rollback => rollback.timestamp > cutoff);
    
    if (cleaned.length !== pending.length) {
      if (__DEV__) {
        console.log(`🧹 [ROLLBACK] Cleaned up ${pending.length - cleaned.length} old rollbacks`);
      }
      await this.savePendingRollbacks(cleaned);
    }
  }

  private async updateMetrics(type: 'success' | 'failure' | 'pending'): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      metrics.totalAttempts++;
      
      switch (type) {
        case 'success':
          metrics.successfulRollbacks++;
          metrics.lastSuccessTime = Date.now();
          break;
        case 'failure':
          metrics.failedRollbacks++;
          metrics.lastFailureTime = Date.now();
          break;
        case 'pending':
          metrics.pendingRollbacks++;
          break;
      }

      await AsyncStorage.setItem(this.METRICS_KEY, JSON.stringify(metrics));
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error updating metrics:', error);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logAnalytics(
    eventType: 'rollback_attempted' | 'rollback_success' | 'rollback_failed' | 'rollback_queued',
    userId: string,
    type: 'photo',
    metadata?: any
  ): void {
    // Structured logging for analytics and monitoring
    const logData = {
      timestamp: new Date().toISOString(),
      event: eventType,
      userId: userId ? `${userId.substring(0, 8)}...` : 'unknown', // Truncated for privacy
      type,
      metadata,
      platform: 'mobile'
    };

    if (__DEV__) {
      console.log(`📊 [ROLLBACK-ANALYTICS] ${eventType.toUpperCase()}:`, logData);
    } else {
      // Production structured logging for external systems
      console.log(JSON.stringify({
        level: 'info',
        category: 'rollback_analytics',
        ...logData
      }));
    }
  }
}

// Export singleton instance
export const rollbackService = new RollbackService();