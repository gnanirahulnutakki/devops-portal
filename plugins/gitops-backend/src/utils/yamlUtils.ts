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
