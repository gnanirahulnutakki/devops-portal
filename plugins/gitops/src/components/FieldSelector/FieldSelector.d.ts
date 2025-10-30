import React from 'react';
import { Branch, FileContent } from '../../api';
interface FieldSelectorProps {
    repository: string;
    fileContent: FileContent | null;
    branches: Branch[];
    selectedBranches: string[];
    onFieldChange?: (fieldPath: string, newValue: string) => void;
}
export declare const FieldSelector: ({ repository, fileContent, branches, selectedBranches, onFieldChange, }: FieldSelectorProps) => React.JSX.Element;
export {};
//# sourceMappingURL=FieldSelector.d.ts.map