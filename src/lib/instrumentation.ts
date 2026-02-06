// =============================================================================
// OpenTelemetry Instrumentation
// Next.js instrumentation file - runs once on server startup
// =============================================================================

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const prometheusExporter = new PrometheusExporter({
  port: 9464,
});

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'devops-portal',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '2.0.0',
  }),
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable file system instrumentation (too noisy)
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      // HTTP instrumentation uses default config
      '@opentelemetry/instrumentation-http': {
        enabled: true,
      },
    }),
  ],
});

export function register() {
  if (process.env.OTEL_ENABLED === 'true') {
    sdk.start();
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => console.log('OpenTelemetry SDK shut down successfully'))
        .catch((error) => console.log('Error shutting down OpenTelemetry SDK', error))
        .finally(() => process.exit(0));
    });
  }
}
