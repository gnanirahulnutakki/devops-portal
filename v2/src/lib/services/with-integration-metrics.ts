// =============================================================================
// Integration Metrics Wrapper
// Automatically records metrics for external service calls
// =============================================================================

import { recordIntegrationRequest } from '@/lib/metrics';
import { logger } from '@/lib/logger';

export type IntegrationType = 'argocd' | 'grafana' | 's3' | 'github' | 'prometheus';

/**
 * Wrap an async function to automatically record integration metrics
 */
export function withIntegrationMetrics<T extends unknown[], R>(
  integration: IntegrationType,
  operation: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      recordIntegrationRequest(integration, operation, 'success', duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      recordIntegrationRequest(integration, operation, 'error', duration);
      
      logger.error(
        { integration, operation, duration, error: (error as Error).message },
        'Integration request failed'
      );
      
      throw error;
    }
  };
}

/**
 * Create a metrics-instrumented version of a service class
 * Wraps all methods that return promises
 */
export function instrumentService<T extends object>(
  service: T,
  integration: IntegrationType
): T {
  const handler: ProxyHandler<T> = {
    get(target, prop: string) {
      const value = target[prop as keyof T];
      
      // Only wrap functions
      if (typeof value !== 'function') {
        return value;
      }
      
      // Return a wrapped function
      return async function (this: T, ...args: unknown[]) {
        const startTime = Date.now();
        const operation = prop;
        
        try {
          const result = await (value as Function).apply(target, args);
          const duration = Date.now() - startTime;
          
          recordIntegrationRequest(integration, operation, 'success', duration);
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          recordIntegrationRequest(integration, operation, 'error', duration);
          
          throw error;
        }
      };
    },
  };
  
  return new Proxy(service, handler);
}

/**
 * Decorator for integration metrics (for class methods)
 * Usage: @trackIntegration('argocd', 'listApplications')
 */
export function trackIntegration(integration: IntegrationType, operation?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operationName = operation || propertyKey;
    
    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        recordIntegrationRequest(integration, operationName, 'success', duration);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        recordIntegrationRequest(integration, operationName, 'error', duration);
        
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Track a single integration request manually
 */
export async function trackIntegrationCall<T>(
  integration: IntegrationType,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    recordIntegrationRequest(integration, operation, 'success', duration);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    recordIntegrationRequest(integration, operation, 'error', duration);
    
    throw error;
  }
}
