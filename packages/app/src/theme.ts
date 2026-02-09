import {
  createUnifiedTheme,
  palettes,
  UnifiedThemeOptions,
} from '@backstage/theme';

// Radiant Logic Official Brand Theme
// Colors from https://www.radiantlogic.com/
export const radiantLogicTheme = createUnifiedTheme({
  palette: {
    ...palettes.light,
    primary: {
      main: '#09143F', // Radiant Logic Dark Navy Blue (official primary)
      light: '#2ea3f2', // Radiant Logic Link Blue
      dark: '#050a24',
    },
    secondary: {
      main: '#e25a1a', // Radiant Logic Orange (official accent)
      light: '#ff7a3d',
      dark: '#b8460d',
    },
    success: {
      main: '#00b12b', // Radiant Logic Green (hover/success states)
    },
    info: {
      main: '#2ea3f2', // Radiant Logic Link Blue
    },
    navigation: {
      background: '#09143F', // Dark Navy
      indicator: '#e25a1a', // Orange indicator
      color: '#ffffff',
      selectedColor: '#e25a1a', // Orange for selected items
    },
    background: {
      default: '#ffffff',
      paper: '#f8f9fa',
    },
  },
  defaultPageTheme: 'home',
  fontFamily: '"Open Sans", "Arial", sans-serif', // Radiant Logic official font
  components: {
    BackstageHeader: {
      styleOverrides: {
        header: () => ({
          backgroundColor: '#09143F', // Solid dark navy like radiantlogic.com
          backgroundImage: 'none', // No gradient, just solid color
        }),
      },
    },
  },
});

// Dark variant with Radiant Logic branding
export const radiantLogicDarkTheme = createUnifiedTheme({
  palette: {
    ...palettes.dark,
    primary: {
      main: '#2ea3f2', // Light blue for dark mode
      light: '#5db7f5',
      dark: '#1976d2',
    },
    secondary: {
      main: '#e25a1a', // Keep orange accent
      light: '#ff7a3d',
      dark: '#b8460d',
    },
    success: {
      main: '#00b12b', // Radiant Logic Green
    },
    info: {
      main: '#2ea3f2',
    },
    navigation: {
      background: '#09143F', // Dark Navy even in dark mode
      indicator: '#e25a1a',
      color: '#ffffff',
      selectedColor: '#e25a1a',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  defaultPageTheme: 'home',
  fontFamily: '"Open Sans", "Arial", sans-serif',
  components: {
    BackstageHeader: {
      styleOverrides: {
        header: () => ({
          backgroundColor: '#09143F',
          backgroundImage: 'none',
        }),
      },
    },
  },
});
