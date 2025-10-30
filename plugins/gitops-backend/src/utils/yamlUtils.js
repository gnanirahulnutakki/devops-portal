import * as yaml from 'js-yaml';
/**
 * Get a value from a YAML object using dot notation path
 * Example: getValue(obj, 'fid.image.tag') => '8.1.2'
 */
export function getValueAtPath(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        }
        else {
            return undefined;
        }
    }
    return current;
}
/**
 * Set a value in a YAML object using dot notation path
 * Example: setValueAtPath(obj, 'fid.image.tag', '8.1.3')
 */
export function setValueAtPath(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
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
export function parseYaml(content) {
    try {
        return yaml.load(content);
    }
    catch (error) {
        throw new Error(`Failed to parse YAML: ${error.message}`);
    }
}
/**
 * Convert object back to YAML string
 */
export function stringifyYaml(obj) {
    try {
        return yaml.dump(obj, {
            indent: 2,
            lineWidth: -1,
            noRefs: true, // Don't use references
        });
    }
    catch (error) {
        throw new Error(`Failed to stringify YAML: ${error.message}`);
    }
}
/**
 * Update a specific field in YAML content
 */
export function updateYamlField(yamlContent, fieldPath, newValue) {
    const obj = parseYaml(yamlContent);
    setValueAtPath(obj, fieldPath, newValue);
    return stringifyYaml(obj);
}
//# sourceMappingURL=yamlUtils.js.map