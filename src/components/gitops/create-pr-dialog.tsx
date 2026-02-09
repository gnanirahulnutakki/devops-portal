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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GitPullRequest, Loader2 } from 'lucide-react';

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

interface CreatePRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: string;
  branches: Branch[];
  sourceBranch: string;
  onCreatePR: (title: string, body: string, head: string, base: string) => Promise<void>;
}

export function CreatePRDialog({
  open,
  onOpenChange,
  repo,
  branches,
  sourceBranch,
  onCreatePR,
}: CreatePRDialogProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [headBranch, setHeadBranch] = useState(sourceBranch);
  const [baseBranch, setBaseBranch] = useState('main');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreatePR(title, body, headBranch, baseBranch);
      setTitle('');
      setBody('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            Create Pull Request
          </DialogTitle>
          <DialogDescription>
            Create a new pull request in {repo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="pr-title">Title</Label>
            <Input
              id="pr-title"
              placeholder="Pull request title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pr-body">Description</Label>
            <Textarea
              id="pr-body"
              placeholder="Describe your changes..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>

          {/* Branch Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source Branch</Label>
              <Select value={headBranch} onValueChange={setHeadBranch}>
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Target Branch</Label>
              <Select value={baseBranch} onValueChange={setBaseBranch}>
                <SelectTrigger>
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
            </div>
          </div>

          <p className="text-xs text-gray-500">
            This will create a PR to merge <code className="text-blue-600">{headBranch}</code> into <code className="text-blue-600">{baseBranch}</code>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || headBranch === baseBranch || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Pull Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
