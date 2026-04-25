import React from 'react';
interface FileDiff {
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    previous_filename?: string;
}
interface DiffViewerProps {
    files: FileDiff[];
}
export declare const DiffViewer: React.FC<DiffViewerProps>;
export {};
//# sourceMappingURL=DiffViewer.d.ts.map