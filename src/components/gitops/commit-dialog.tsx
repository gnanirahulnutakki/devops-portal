'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GitBranch, GitPullRequest, FileCode, Loader2 } from 'lucide-react';

interface PendingChange {
  repo: string;
  repoFullName: string;
  path: string;
  originalContent: string;
  newContent: string;
  sha: string;
  branch: string;
}

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: PendingChange[];
  branches: Branch[];
  currentBranch: string;
  onCommit: (message: string, createPR: boolean, baseBranch?: string) => Promise<void>;
}

export function CommitDialog({
  open,
  onOpenChange,
  changes,
  branches,
  currentBranch,
  onCommit,
}: CommitDialogProps) {
  const [commitMessage, setCommitMessage] = useState('');
  const [createPR, setCreatePR] = useState(false);
  const [baseBranch, setBaseBranch] = useState('main');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group changes by repo
  const changesByRepo = changes.reduce((acc, change) => {
    if (!acc[change.repo]) {
      acc[change.repo] = [];
    }
    acc[change.repo].push(change);
    return acc;
  }, {} as Record<string, PendingChange[]>);

  const handleSubmit = async () => {
    if (!commitMessage.trim()) return;

    setIsSubmitting(true);
    try {
      await onCommit(commitMessage, createPR, createPR ? baseBranch : undefined);
      setCommitMessage('');
      setCreatePR(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Commit Changes
          </DialogTitle>
          <DialogDescription>
            Review and commit {changes.length} file{changes.length !== 1 ? 's' : ''} to your repositories
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Commit Message */}
          <div className="space-y-2">
            <Label htmlFor="commit-message">Commit Message</Label>
            <Textarea
              id="commit-message"
              placeholder="Describe your changes..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Create PR Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="create-pr"
              checked={createPR}
              onCheckedChange={(checked) => setCreatePR(checked === true)}
            />
            <Label htmlFor="create-pr" className="flex items-center gap-2 cursor-pointer">
              <GitPullRequest className="h-4 w-4" />
              Create Pull Request after commit
            </Label>
          </div>

          {/* Base Branch for PR */}
          {createPR && (
            <div className="space-y-2 pl-6">
              <Label>Target Branch</Label>
              <Select value={baseBranch} onValueChange={setBaseBranch}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Changes will be committed to <code className="text-blue-600">{currentBranch}</code> and a PR will be created to merge into <code className="text-blue-600">{baseBranch}</code>
              </p>
            </div>
          )}

          {/* Changed Files Summary */}
          <div className="space-y-2">
            <Label>Files to Commit</Label>
            <Accordion type="single" collapsible className="border rounded-lg">
              {Object.entries(changesByRepo).map(([repo, repoChanges]) => (
                <AccordionItem key={repo} value={repo}>
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{repo}</span>
                      <Badge variant="secondary">{repoChanges.length} file{repoChanges.length !== 1 ? 's' : ''}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-1">
                      {repoChanges.map((change) => (
                        <div
                          key={change.path}
                          className="flex items-center gap-2 text-sm py-1"
                        >
                          <FileCode className="h-4 w-4 text-blue-500" />
                          <span className="text-gray-700 dark:text-gray-300">{change.path}</span>
                          <Badge variant="outline" className="text-xs">
                            @{change.branch}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!commitMessage.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Committing...
              </>
            ) : (
              <>
                {createPR ? 'Commit & Create PR' : 'Commit Changes'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
