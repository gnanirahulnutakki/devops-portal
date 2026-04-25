'use client';

import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  sha?: string;
  size?: number;
  children?: FileNode[];
}

interface FileBrowserProps {
  files: FileNode[];
  selectedPath?: string;
  modifiedPaths?: string[];
  onSelect: (node: FileNode) => void;
}

export function FileBrowser({
  files,
  selectedPath,
  modifiedPaths = [],
  onSelect,
}: FileBrowserProps) {
  // Build tree structure from flat file list
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          modifiedPaths={modifiedPaths}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  selectedPath?: string;
  modifiedPaths: string[];
  onSelect: (node: FileNode) => void;
  depth: number;
}

function FileTreeNode({
  node,
  selectedPath,
  modifiedPaths,
  onSelect,
  depth,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDirectory = node.type === 'directory';
  const isSelected = selectedPath === node.path;
  const isModified = modifiedPaths.includes(node.path);

  const handleClick = () => {
    if (isDirectory) {
      setExpanded(!expanded);
    } else {
      onSelect(node);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-sm',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          isSelected && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDirectory ? (
          <>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-blue-400 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" /> {/* Spacer for alignment */}
            <FileIcon filename={node.name} />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {isModified && (
          <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700">
            Modified
          </Badge>
        )}
      </div>
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              modifiedPaths={modifiedPaths}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'yaml':
    case 'yml':
      return <FileCode className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    case 'json':
      return <FileJson className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
    case 'md':
    case 'txt':
      return <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />;
    default:
      return <File className="h-4 w-4 text-gray-400 flex-shrink-0" />;
  }
}

// Build tree structure from flat file list
function buildTree(files: FileNode[]): FileNode[] {
  const root: FileNode[] = [];
  const map = new Map<string, FileNode>();

  // Sort files by path to ensure parent directories come first
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/');
    let currentPath = '';
    let parent: FileNode[] = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      const isLast = i === parts.length - 1;

      if (isLast) {
        // This is the file/directory itself
        const node: FileNode = {
          ...file,
          name: part,
          children: file.type === 'directory' ? [] : undefined,
        };
        parent.push(node);
        map.set(currentPath, node);
      } else {
        // This is an intermediate directory
        let dirNode = map.get(currentPath);
        if (!dirNode) {
          dirNode = {
            name: part,
            path: currentPath,
            type: 'directory',
            children: [],
          };
          parent.push(dirNode);
          map.set(currentPath, dirNode);
        }
        parent = dirNode.children!;
      }
    }
  }

  return root;
}
