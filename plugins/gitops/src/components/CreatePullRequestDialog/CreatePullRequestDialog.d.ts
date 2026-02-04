import React from 'react';
interface CreatePullRequestDialogProps {
    open: boolean;
    onClose: () => void;
    repository: string;
    currentBranch: string;
    onPullRequestCreated?: (pullRequest: any) => void;
    allowBranchCreation?: boolean;
    fileContent?: {
        path: string;
        content?: string;
        sha: string;
    };
    commitMessage?: string;
    fieldPath?: string;
    fieldValue?: string;
}
export declare const CreatePullRequestDialog: React.FC<CreatePullRequestDialogProps>;
export {};
//# sourceMappingURL=CreatePullRequestDialog.d.ts.map