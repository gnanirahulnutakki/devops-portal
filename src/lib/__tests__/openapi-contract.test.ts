import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { OPENAPI_SPEC } from '@/lib/openapi';

const apiRoot = path.join(process.cwd(), 'src', 'app', 'api');

function walkRoutes(dir: string, files: string[] = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkRoutes(fullPath, files);
    } else if (entry.isFile() && entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

function toOpenApiPath(routeFile: string) {
  const relative = path.relative(apiRoot, path.dirname(routeFile));
  const segments = relative.split(path.sep).filter(Boolean);
  const normalized = segments
    .map((seg) => {
      if (seg.startsWith('[') && seg.endsWith(']')) {
        const inner = seg.slice(1, -1);
        if (inner.startsWith('...')) return `{${inner.slice(3)}}`;
        return `{${inner}}`;
      }
      return seg;
    })
    .join('/');
  return `/api/${normalized}`;
}

function extractMethods(contents: string) {
  const methods = new Set<string>();
  const patterns = [
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g,
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(contents))) {
      methods.add(match[1].toLowerCase());
    }
  }
  return Array.from(methods);
}

describe('OpenAPI contract', () => {
  // Tracks every API route present under src/app/api against the OpenAPI spec.
  // 22 routes are currently undocumented; see CHANGELOG.md follow-up notes.
  it('includes every API route and method', () => {
    const routes = walkRoutes(apiRoot);
    const paths = (OPENAPI_SPEC.paths || {}) as Record<string, any>;
    const missing: string[] = [];

    for (const routeFile of routes) {
      const routePath = toOpenApiPath(routeFile);
      const contents = fs.readFileSync(routeFile, 'utf8');
      const methods = extractMethods(contents);

      if (!paths[routePath]) {
        missing.push(`${routePath} (all methods)`);
        continue;
      }

      for (const method of methods) {
        if (!paths[routePath]?.[method]) {
          missing.push(`${method.toUpperCase()} ${routePath}`);
        }
      }
    }

    expect(missing, `Missing OpenAPI entries:\n${missing.join('\n')}`).toHaveLength(0);
  });
});
