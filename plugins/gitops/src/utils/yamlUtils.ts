import * as yaml from 'js-yaml';

/**
 * Get a value from a YAML object using dot notation path
 * Example: getValue(obj, 'fid.image.tag') => '8.1.2'
 */
export function getValueAtPath(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Set a value in a YAML object using dot notation path
 * Example: setValueAtPath(obj, 'fid.image.tag', '8.1.3')
 */
export function setValueAtPath(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const lastKey = keys.pop()!;

  let current = obj;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
  return obj;
}

/**
 * Extract all possible paths from a YAML object
 * Example: ['fid.image.tag', 'fid.image.repository', 'fid.replicaCount']
 */
export function extractYamlPaths(obj: any, prefix = ''): string[] {
  const paths: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return paths;
  }

  for (const key in obj) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recurse into nested objects
      paths.push(...extractYamlPaths(value, newPrefix));
    } else {
      // Leaf node - add the path
      paths.push(newPrefix);
    }
  }

  return paths;
}

/**
 * Parse YAML string to object
 */
export function parseYaml(content: string): any {
  try {
    return yaml.load(content);
  } catch (error: any) {
    throw new Error(`Failed to parse YAML: ${error.message}`);
  }
}

/**
 * Convert object back to YAML string
 */
export function stringifyYaml(obj: any): string {
  try {
    return yaml.dump(obj, {
      indent: 2,
      lineWidth: -1, // Don't wrap lines
      noRefs: true,   // Don't use references
    });
  } catch (error: any) {
    throw new Error(`Failed to stringify YAML: ${error.message}`);
  }
}

/**
 * Update a specific field in YAML content
 */
export function updateYamlField(yamlContent: string, fieldPath: string, newValue: any): string {
  const obj = parseYaml(yamlContent);
  setValueAtPath(obj, fieldPath, newValue);
  return stringifyYaml(obj);
}

/**
 * Get common fields from values.yaml files
 * These are the fields typically updated across tenant branches
 */
export function getCommonValuesPaths(): Array<{ path: string; description: string }> {
  return [
    { path: 'fid.image.tag', description: 'FID Image Version' },
    { path: 'fid.image.repository', description: 'FID Image Repository' },
    { path: 'fid.replicaCount', description: 'FID Replica Count' },
    { path: 'fid.resources.limits.cpu', description: 'FID CPU Limit' },
    { path: 'fid.resources.limits.memory', description: 'FID Memory Limit' },
    { path: 'fid.resources.requests.cpu', description: 'FID CPU Request' },
    { path: 'fid.resources.requests.memory', description: 'FID Memory Request' },
    { path: 'igrcanalytics.image.tag', description: 'Analytics Image Version' },
    { path: 'igrcanalytics.replicaCount', description: 'Analytics Replica Count' },
    { path: 'observability.enabled', description: 'Observability Enabled' },
  ];
}

/**
 * Compare two YAML objects and get differences
 */
export function getYamlDiff(
  oldContent: string,
  newContent: string,
  fieldPath?: string
): Array<{ path: string; oldValue: any; newValue: any }> {
  const oldObj = parseYaml(oldContent);
  const newObj = parseYaml(newContent);
  const diffs: Array<{ path: string; oldValue: any; newValue: any }> = [];

  if (fieldPath) {
    // Only check the specific field
    const oldValue = getValueAtPath(oldObj, fieldPath);
    const newValue = getValueAtPath(newObj, fieldPath);

    if (oldValue !== newValue) {
      diffs.push({ path: fieldPath, oldValue, newValue });
    }
  } else {
    // Check all fields
    const paths = extractYamlPaths(newObj);

    for (const path of paths) {
      const oldValue = getValueAtPath(oldObj, path);
      const newValue = getValueAtPath(newObj, path);

      if (oldValue !== newValue) {
        diffs.push({ path, oldValue, newValue });
      }
    }
  }

  return diffs;
}
