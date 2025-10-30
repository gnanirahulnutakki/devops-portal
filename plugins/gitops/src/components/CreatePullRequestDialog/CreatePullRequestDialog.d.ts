import React from 'react';
interface CreatePullRequestDialogProps {
    open: boolean;
    onClose: () => void;
    repository: string;
    currentBranch: string;
    onPullRequestCreated?: (pullRequest: any) => void;
}
export declare const CreatePullRequestDialog: React.FC<CreatePullRequestDialogProps>;
export {};
//# sourceMappingURL=CreatePullRequestDialog.d.ts.map