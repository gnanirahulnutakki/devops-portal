/**
 * Get a value from a YAML object using dot notation path
 * Example: getValue(obj, 'fid.image.tag') => '8.1.2'
 */
export declare function getValueAtPath(obj: any, path: string): any;
/**
 * Set a value in a YAML object using dot notation path
 * Example: setValueAtPath(obj, 'fid.image.tag', '8.1.3')
 */
export declare function setValueAtPath(obj: any, path: string, value: any): any;
/**
 * Parse YAML string to object
 */
export declare function parseYaml(content: string): any;
/**
 * Convert object back to YAML string
 */
export declare function stringifyYaml(obj: any): string;
/**
 * Update a specific field in YAML content
 */
export declare function updateYamlField(yamlContent: string, fieldPath: string, newValue: any): string;
//# sourceMappingURL=yamlUtils.d.ts.map