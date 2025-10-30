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
 * Extract all possible paths from a YAML object
 * Example: ['fid.image.tag', 'fid.image.repository', 'fid.replicaCount']
 */
export declare function extractYamlPaths(obj: any, prefix?: string): string[];
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
/**
 * Get common fields from values.yaml files
 * These are the fields typically updated across tenant branches
 */
export declare function getCommonValuesPaths(): Array<{
    path: string;
    description: string;
}>;
/**
 * Compare two YAML objects and get differences
 */
export declare function getYamlDiff(oldContent: string, newContent: string, fieldPath?: string): Array<{
    path: string;
    oldValue: any;
    newValue: any;
}>;
//# sourceMappingURL=yamlUtils.d.ts.map