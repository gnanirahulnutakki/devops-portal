// Next.js instrumentation entry point
// This file must be at the root of src/ or root level

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { register } = await import('./src/lib/instrumentation');
    register();
  }
}
