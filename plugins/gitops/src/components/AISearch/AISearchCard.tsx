import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Card,
  CardContent,
  Collapse,
  CircularProgress,
  Paper,
  Divider,
  Tooltip,
  makeStyles,
  fade,
} from '@material-ui/core';
import { InfoCard } from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import SearchIcon from '@material-ui/icons/Search';
import ClearIcon from '@material-ui/icons/Clear';
import DescriptionIcon from '@material-ui/icons/Description';
import CodeIcon from '@material-ui/icons/Code';
import SettingsIcon from '@material-ui/icons/Settings';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import HttpIcon from '@material-ui/icons/Http';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import QuestionAnswerIcon from '@material-ui/icons/QuestionAnswer';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import debounce from 'lodash/debounce';

const useStyles = makeStyles((theme) => ({
  searchContainer: {
    marginBottom: theme.spacing(2),
  },
  searchInput: {
    width: '100%',
    '& .MuiOutlinedInput-root': {
      borderRadius: 24,
      backgroundColor: theme.palette.background.paper,
      '&:hover': {
        backgroundColor: fade(theme.palette.background.paper, 0.9),
      },
      '&.Mui-focused': {
        backgroundColor: theme.palette.background.paper,
      },
    },
  },
  suggestionsContainer: {
    marginTop: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  suggestionChip: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.primary.light,
      color: theme.palette.primary.contrastText,
    },
  },
  resultCard: {
    marginBottom: theme.spacing(1),
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: fade(theme.palette.primary.main, 0.05),
      transform: 'translateX(4px)',
    },
  },
  sourceChip: {
    marginRight: theme.spacing(1),
  },
  highlight: {
    backgroundColor: fade(theme.palette.warning.main, 0.3),
    padding: '0 4px',
    borderRadius: 2,
  },
  summaryBox: {
    padding: theme.spacing(2),
    backgroundColor: fade(theme.palette.info.main, 0.08),
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
    borderLeft: `4px solid ${theme.palette.info.main}`,
  },
  answerBox: {
    padding: theme.spacing(2),
    backgroundColor: fade(theme.palette.success.main, 0.08),
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
    borderLeft: `4px solid ${theme.palette.success.main}`,
  },
  relevanceScore: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  modeToggle: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  modeButton: {
    borderRadius: 20,
    textTransform: 'none',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  noResults: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  sourceIcon: {
    minWidth: 40,
  },
}));

interface SearchResult {
  id: string;
  title: string;
  content: string;
  source: 'documentation' | 'code' | 'config' | 'runbook' | 'api';
  path: string;
  relevanceScore: number;
  highlights: string[];
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  summary: string;
  suggestedQueries: string[];
  totalResults: number;
  searchTime: number;
  llmModel?: string;
}

interface AnswerResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

type SearchMode = 'search' | 'ask';

interface AISearchCardProps {
  /** Default search mode */
  defaultMode?: SearchMode;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Filter results by source */
  sourceFilter?: ('documentation' | 'code' | 'config' | 'runbook' | 'api')[];
  /** Maximum number of results */
  maxResults?: number;
  /** Show summary section */
  showSummary?: boolean;
  /** Enable auto-search on type */
  autoSearch?: boolean;
}

const sourceIcons: Record<string, React.ReactNode> = {
  documentation: <DescriptionIcon />,
  code: <CodeIcon />,
  config: <SettingsIcon />,
  runbook: <MenuBookIcon />,
  api: <HttpIcon />,
};

const sourceColors: Record<string, 'default' | 'primary' | 'secondary'> = {
  documentation: 'primary',
  code: 'default',
  config: 'secondary',
  runbook: 'primary',
  api: 'secondary',
};

export const AISearchCard: React.FC<AISearchCardProps> = ({
  defaultMode = 'search',
  placeholder,
  sourceFilter,
  maxResults = 10,
  showSummary = true,
  autoSearch = true,
}) => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [answerResponse, setAnswerResponse] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResponse(null);
      setAnswerResponse(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'search') {
        const params = new URLSearchParams({
          q: searchQuery,
          maxResults: maxResults.toString(),
        });
        if (sourceFilter) {
          params.append('sources', sourceFilter.join(','));
        }

        const response = await fetch(`${backendUrl}/api/gitops/search?${params}`);
        if (!response.ok) throw new Error('Search failed');

        const data: SearchResponse = await response.json();
        setSearchResponse(data);
        setAnswerResponse(null);
      } else {
        // Ask mode - use RAG
        const response = await fetch(`${backendUrl}/api/gitops/search/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: searchQuery }),
        });
        if (!response.ok) throw new Error('Failed to get answer');

        const data: AnswerResponse = await response.json();
        setAnswerResponse(data);
        setSearchResponse(null);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search for auto-search mode
  const debouncedSearch = useCallback(
    debounce((q: string) => performSearch(q), 500),
    [mode, sourceFilter, maxResults]
  );

  useEffect(() => {
    if (autoSearch && query.length >= 3) {
      debouncedSearch(query);
    }
    return () => debouncedSearch.cancel();
  }, [query, autoSearch, debouncedSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };

  const handleClear = () => {
    setQuery('');
    setSearchResponse(null);
    setAnswerResponse(null);
    setError(null);
    inputRef.current?.focus();
  };

  /**
   * Safely render content with highlights as React elements
   * NO dangerouslySetInnerHTML - prevents XSS from malicious highlight content
   */
  const renderHighlightedContent = (content: string, highlights: string[]): React.ReactNode => {
    if (!highlights || highlights.length === 0) {
      return content;
    }

    // Build a regex that matches any of the highlight terms
    const escapedHighlights = highlights.map(h => 
      h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const combinedPattern = new RegExp(`(${escapedHighlights.join('|')})`, 'gi');

    // Split content by matches and render as React elements
    const parts = content.split(combinedPattern);
    
    return (
      <span>
        {parts.map((part, index) => {
          // Check if this part matches any highlight (case-insensitive)
          const isHighlight = highlights.some(
            h => part.toLowerCase() === h.toLowerCase()
          );
          
          if (isHighlight) {
            return (
              <mark key={index} className={classes.highlight}>
                {part}
              </mark>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </span>
    );
  };

  const defaultPlaceholder = mode === 'search'
    ? 'Search documentation, code, configs...'
    : 'Ask a question about your services...';

  return (
    <InfoCard
      title="AI-Powered Search"
      subheader="Search across documentation, code, and configurations using natural language"
    >
      {/* Mode Toggle */}
      <Box className={classes.modeToggle}>
        <Chip
          icon={<SearchIcon />}
          label="Search"
          color={mode === 'search' ? 'primary' : 'default'}
          onClick={() => setMode('search')}
          variant={mode === 'search' ? 'default' : 'outlined'}
          className={classes.modeButton}
        />
        <Chip
          icon={<QuestionAnswerIcon />}
          label="Ask AI"
          color={mode === 'ask' ? 'primary' : 'default'}
          onClick={() => setMode('ask')}
          variant={mode === 'ask' ? 'default' : 'outlined'}
          className={classes.modeButton}
        />
      </Box>

      {/* Search Input */}
      <Box className={classes.searchContainer}>
        <form onSubmit={handleSearch}>
          <TextField
            inputRef={inputRef}
            className={classes.searchInput}
            variant="outlined"
            placeholder={placeholder || defaultPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {mode === 'search' ? <SearchIcon color="action" /> : <QuestionAnswerIcon color="primary" />}
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {loading ? (
                    <CircularProgress size={20} />
                  ) : query ? (
                    <IconButton size="small" onClick={handleClear}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </InputAdornment>
              ),
            }}
          />
        </form>
      </Box>

      {/* Error State */}
      {error && (
        <Typography color="error" variant="body2" gutterBottom>
          {error}
        </Typography>
      )}

      {/* Loading State */}
      {loading && (
        <Box className={classes.loadingContainer}>
          <AutorenewIcon className="rotating" />
          <Typography variant="body2" color="textSecondary">
            {mode === 'search' ? 'Searching...' : 'Thinking...'}
          </Typography>
        </Box>
      )}

      {/* Answer Response (Ask Mode) */}
      {answerResponse && !loading && (
        <>
          <Box className={classes.answerBox}>
            <Typography variant="subtitle2" gutterBottom>
              <QuestionAnswerIcon fontSize="small" style={{ marginRight: 8, verticalAlign: 'middle' }} />
              AI Answer
            </Typography>
            <Typography variant="body1">
              {answerResponse.answer}
            </Typography>
            <Box mt={1}>
              <Chip
                size="small"
                label={`Confidence: ${Math.round(answerResponse.confidence * 100)}%`}
                color={answerResponse.confidence > 0.7 ? 'primary' : 'default'}
              />
            </Box>
          </Box>

          {answerResponse.sources.length > 0 && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Sources ({answerResponse.sources.length})
              </Typography>
              <List dense>
                {answerResponse.sources.map((source) => (
                  <ListItem key={source.id} className={classes.resultCard}>
                    <ListItemIcon className={classes.sourceIcon}>
                      {sourceIcons[source.source]}
                    </ListItemIcon>
                    <ListItemText
                      primary={source.title}
                      secondary={source.path}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </>
      )}

      {/* Search Response */}
      {searchResponse && !loading && (
        <>
          {/* Summary */}
          {showSummary && searchResponse.summary && (
            <Box className={classes.summaryBox}>
              <Typography variant="body2">
                {searchResponse.summary}
              </Typography>
              {searchResponse.llmModel && (
                <Typography variant="caption" color="textSecondary">
                  Powered by {searchResponse.llmModel}
                </Typography>
              )}
            </Box>
          )}

          {/* Results Count */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="body2" color="textSecondary">
              {searchResponse.totalResults} results in {searchResponse.searchTime}ms
            </Typography>
          </Box>

          {/* Results List */}
          {searchResponse.results.length > 0 ? (
            <List disablePadding>
              {searchResponse.results.map((result, index) => (
                <React.Fragment key={result.id}>
                  <ListItem
                    className={classes.resultCard}
                    component={Paper}
                    elevation={0}
                    onClick={() => {
                      // Navigate to source
                      console.log('Navigate to:', result.path);
                    }}
                  >
                    <ListItemIcon className={classes.sourceIcon}>
                      {sourceIcons[result.source]}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                          <Typography variant="subtitle2">{result.title}</Typography>
                          <Chip
                            size="small"
                            label={result.source}
                            color={sourceColors[result.source]}
                            className={classes.sourceChip}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="textSecondary" component="div">
                            {renderHighlightedContent(result.content.substring(0, 200) + '...', result.highlights)}
                          </Typography>
                          <Box className={classes.relevanceScore} mt={0.5}>
                            <TrendingUpIcon fontSize="small" style={{ marginRight: 4 }} />
                            {Math.round(result.relevanceScore * 100)}% match • {result.path}
                          </Box>
                        </>
                      }
                    />
                  </ListItem>
                  {index < searchResponse.results.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Box className={classes.noResults}>
              <SearchIcon style={{ fontSize: 48, color: '#ccc' }} />
              <Typography variant="body1" color="textSecondary">
                No results found for "{searchResponse.query}"
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Try different keywords or check the spelling
              </Typography>
            </Box>
          )}

          {/* Suggested Queries */}
          {searchResponse.suggestedQueries && searchResponse.suggestedQueries.length > 0 && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Related searches:
              </Typography>
              <Box className={classes.suggestionsContainer}>
                {searchResponse.suggestedQueries.map((suggestion, idx) => (
                  <Chip
                    key={idx}
                    label={suggestion}
                    variant="outlined"
                    size="small"
                    className={classes.suggestionChip}
                    onClick={() => handleSuggestionClick(suggestion)}
                  />
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !searchResponse && !answerResponse && !error && (
        <Box className={classes.noResults}>
          {mode === 'search' ? (
            <>
              <SearchIcon style={{ fontSize: 48, color: '#ccc' }} />
              <Typography variant="body1" color="textSecondary">
                Start typing to search
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Search across documentation, code, configs, and more
              </Typography>
            </>
          ) : (
            <>
              <QuestionAnswerIcon style={{ fontSize: 48, color: '#ccc' }} />
              <Typography variant="body1" color="textSecondary">
                Ask me anything
              </Typography>
              <Typography variant="body2" color="textSecondary">
                I can answer questions based on your documentation and codebase
              </Typography>
            </>
          )}

          {/* Quick Suggestions */}
          <Box className={classes.suggestionsContainer} mt={2} justifyContent="center">
            <Chip
              label="How do I deploy to production?"
              variant="outlined"
              size="small"
              className={classes.suggestionChip}
              onClick={() => handleSuggestionClick('How do I deploy to production?')}
            />
            <Chip
              label="Kubernetes troubleshooting"
              variant="outlined"
              size="small"
              className={classes.suggestionChip}
              onClick={() => handleSuggestionClick('Kubernetes troubleshooting')}
            />
            <Chip
              label="ArgoCD sync issues"
              variant="outlined"
              size="small"
              className={classes.suggestionChip}
              onClick={() => handleSuggestionClick('ArgoCD sync issues')}
            />
          </Box>
        </Box>
      )}
    </InfoCard>
  );
};

export default AISearchCard;
