'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { loader } from '@monaco-editor/react';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    ),
  }
);

let loaderConfigured = false;
if (!loaderConfigured) {
  loader.config({ paths: { vs: '/monaco/vs' } });
  loaderConfigured = true;
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  path?: string;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'light';
  height?: string;
}

export function MonacoEditor({
  value,
  onChange,
  language = 'yaml',
  path,
  readOnly = false,
  theme,
  height = '100%',
}: MonacoEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>(theme || 'vs-dark');

  useEffect(() => {
    setMounted(true);
    // Detect system theme
    if (!theme) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setEditorTheme(isDark ? 'vs-dark' : 'light');

      // Listen for theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        setEditorTheme(e.matches ? 'vs-dark' : 'light');
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={editorTheme}
      path={path}
      onChange={(value) => onChange(value || '')}
      options={{
        readOnly,
        minimap: { enabled: true },
        fontSize: 13,
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
        formatOnType: true,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          indentation: true,
        },
        folding: true,
        foldingStrategy: 'indentation',
        quickSuggestions: {
          other: true,
          comments: false,
          strings: true,
        },
      }}
    />
  );
}
