import React from 'react';
import { FileContent, Branch } from '../../api';
interface FileEditorProps {
    open: boolean;
    onClose: () => void;
    repository: string;
    fileContent: FileContent | null;
    branches: Branch[];
    currentBranch: string;
    onSuccess?: () => void;
}
export declare const FileEditor: ({ open, onClose, repository, fileContent, branches, currentBranch, onSuccess, }: FileEditorProps) => React.JSX.Element;
export {};
//# sourceMappingURL=FileEditor.d.ts.map