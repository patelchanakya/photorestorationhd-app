import { InteractionManager } from 'react-native';

interface PerformanceMetrics {
  frameDrops: number;
  memoryWarnings: number;
  slowOperations: Array<{
    operation: string;
    duration: number;
    timestamp: number;
  }>;
  videoPlayerCount: number;
  componentMountCount: number;
  componentUnmountCount: number;
  lastReset: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    frameDrops: 0,
    memoryWarnings: 0,
    slowOperations: [],
    videoPlayerCount: 0,
    componentMountCount: 0,
    componentUnmountCount: 0,
    lastReset: Date.now(),
  };

  private frameDropCallback: (() => void) | null = null;
  private memoryWarningCallback: (() => void) | null = null;
  private reportingCleanup: (() => void) | null = null;

  start() {
    if (__DEV__) {
      console.log('🔍 Performance monitoring started');
      
      // Monitor interaction manager queue for blocked operations
      const originalRunAfterInteractions = InteractionManager.runAfterInteractions;
      InteractionManager.runAfterInteractions = (task: () => void) => {
        const start = Date.now();
        return originalRunAfterInteractions(() => {
          const duration = Date.now() - start;
          if (duration > 100) { // Log operations that take longer than 100ms
            this.recordSlowOperation('interaction_delay', duration);
          }
          task();
        });
      };

      // Monitor memory warnings (iOS specific, but safe to call on Android)
      try {
        // Memory pressure monitoring would need native modules
        // For now, we'll focus on JavaScript performance
      } catch (error) {
        if (__DEV__) {
          console.log('Memory monitoring not available on this platform');
        }
      }
    }
  }

  stop() {
    // Clean up the periodic reporting interval
    if (this.reportingCleanup) {
      this.reportingCleanup();
      this.reportingCleanup = null;
    }

    if (__DEV__) {
      console.log('🛑 Performance monitoring stopped');
    }
  }

  recordSlowOperation(operation: string, duration: number) {
    this.metrics.slowOperations.push({
      operation,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 50 slow operations to prevent memory buildup
    if (this.metrics.slowOperations.length > 50) {
      this.metrics.slowOperations = this.metrics.slowOperations.slice(-50);
    }

    if (__DEV__ && duration > 200) {
      console.warn(`⚠️ Slow operation detected: ${operation} took ${duration}ms`);
    }
  }

  recordFrameDrop() {
    this.metrics.frameDrops++;
    if (__DEV__) {
      console.log(`📉 Frame drop detected (total: ${this.metrics.frameDrops})`);
    }
  }

  recordMemoryWarning() {
    this.metrics.memoryWarnings++;
    if (__DEV__) {
      console.warn(`🧠 Memory warning (total: ${this.metrics.memoryWarnings})`);
    }
  }

  recordVideoPlayerCreated() {
    this.metrics.videoPlayerCount++;
  }

  recordVideoPlayerDestroyed() {
    this.metrics.videoPlayerCount = Math.max(0, this.metrics.videoPlayerCount - 1);
  }

  recordComponentMount(componentName: string) {
    this.metrics.componentMountCount++;
    
    // Warn about excessive mounting
    if (this.metrics.componentMountCount > 100) {
      if (__DEV__) {
        console.warn(`⚠️ High component mount count: ${this.metrics.componentMountCount} (${componentName})`);
      }
    }
  }

  recordComponentUnmount(componentName: string) {
    this.metrics.componentUnmountCount++;
  }

  measureAsync<T>(operation: string, asyncOperation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    return asyncOperation().finally(() => {
      const duration = Date.now() - start;
      if (duration > 100) {
        this.recordSlowOperation(operation, duration);
      }
    });
  }

  measure<T>(operation: string, syncOperation: () => T): T {
    const start = Date.now();
    const result = syncOperation();
    const duration = Date.now() - start;
    
    if (duration > 16) { // Longer than 1 frame at 60fps
      this.recordSlowOperation(operation, duration);
    }
    
    return result;
  }

  getMetrics(): PerformanceMetrics & { 
    averageSlowOperationTime: number;
    slowOperationsInLastMinute: number;
    uptime: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentSlowOps = this.metrics.slowOperations.filter(op => op.timestamp > oneMinuteAgo);
    
    return {
      ...this.metrics,
      averageSlowOperationTime: this.metrics.slowOperations.length > 0 
        ? this.metrics.slowOperations.reduce((sum, op) => sum + op.duration, 0) / this.metrics.slowOperations.length
        : 0,
      slowOperationsInLastMinute: recentSlowOps.length,
      uptime: now - this.metrics.lastReset,
    };
  }

  reset() {
    this.metrics = {
      frameDrops: 0,
      memoryWarnings: 0,
      slowOperations: [],
      videoPlayerCount: 0,
      componentMountCount: 0,
      componentUnmountCount: 0,
      lastReset: Date.now(),
    };
    
    if (__DEV__) {
      console.log('🔄 Performance metrics reset');
    }
  }

  logSummary() {
    if (!__DEV__) return;

    const metrics = this.getMetrics();
    const uptimeMinutes = (metrics.uptime / 1000 / 60).toFixed(1);
    
    console.log('📊 Performance Summary:');
    console.log(`⏱️  Uptime: ${uptimeMinutes} minutes`);
    console.log(`📉 Frame drops: ${metrics.frameDrops}`);
    console.log(`🧠 Memory warnings: ${metrics.memoryWarnings}`);
    console.log(`🎬 Video players: ${metrics.videoPlayerCount}`);
    console.log(`📱 Components: ${metrics.componentMountCount} mounts, ${metrics.componentUnmountCount} unmounts`);
    console.log(`⚠️  Slow operations: ${metrics.slowOperations.length} total, ${metrics.slowOperationsInLastMinute} in last minute`);
    
    if (metrics.slowOperations.length > 0) {
      console.log(`🐌 Average slow operation time: ${metrics.averageSlowOperationTime.toFixed(1)}ms`);
      
      // Show the 5 slowest operations
      const slowest = [...metrics.slowOperations]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);
      
      console.log('🚨 Slowest operations:');
      slowest.forEach(op => {
        console.log(`   ${op.operation}: ${op.duration}ms`);
      });
    }
  }

  // Hook for regular performance reporting
  startPeriodicReporting(intervalMinutes: number = 2) {
    if (!__DEV__) return;

    // Clear existing interval if one exists
    if (this.reportingCleanup) {
      this.reportingCleanup();
    }

    const interval = setInterval(() => {
      this.logSummary();
    }, intervalMinutes * 60 * 1000);

    this.reportingCleanup = () => clearInterval(interval);
    return this.reportingCleanup;
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Auto-start monitoring in development
if (__DEV__) {
  performanceMonitor.start();
  performanceMonitor.startPeriodicReporting(2); // Report every 2 minutes
}