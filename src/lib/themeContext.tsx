import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { useTenant } from './tenantContext';

interface ThemeColors {
  primary?: string;
  primaryHover?: string;
  secondary?: string;
  secondaryHover?: string;
  textPrimary?: string;
  textSecondary?: string;
  background?: string;
  backgroundSecondary?: string;
  border?: string;
  accent?: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  loading: boolean;
  updateTheme: (colors: ThemeColors) => void;
  refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const defaultColors: ThemeColors = {
  primary: '#008374',
  primaryHover: '#006b5e',
  secondary: '#89BA16',
  secondaryHover: '#72970f',
  textPrimary: '#171717',
  textSecondary: '#737373',
  background: '#ffffff',
  backgroundSecondary: '#f5f5f5',
  border: '#e5e5e5',
  accent: '#89BA16',
};

const colorKeyMap: Record<string, keyof ThemeColors> = {
  'primary': 'primary',
  'primary_hover': 'primaryHover',
  'secondary': 'secondary',
  'secondary_hover': 'secondaryHover',
  'text_primary': 'textPrimary',
  'text_secondary': 'textSecondary',
  'background': 'background',
  'background_secondary': 'backgroundSecondary',
  'border': 'border',
  'accent': 'accent',
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  const [colors, setColors] = useState<ThemeColors>(defaultColors);
  const [loading, setLoading] = useState(true);

  const applyColorsToDOM = (themeColors: ThemeColors) => {
    const root = document.documentElement;

    if (themeColors.primary) {
      root.style.setProperty('--color-primary', themeColors.primary);
    }
    if (themeColors.primaryHover) {
      root.style.setProperty('--color-primary-hover', themeColors.primaryHover);
    }
    if (themeColors.secondary) {
      root.style.setProperty('--color-secondary', themeColors.secondary);
    }
    if (themeColors.secondaryHover) {
      root.style.setProperty('--color-secondary-hover', themeColors.secondaryHover);
    }
    if (themeColors.textPrimary) {
      root.style.setProperty('--color-text-primary', themeColors.textPrimary);
    }
    if (themeColors.textSecondary) {
      root.style.setProperty('--color-text-secondary', themeColors.textSecondary);
    }
    if (themeColors.background) {
      root.style.setProperty('--color-background', themeColors.background);
    }
    if (themeColors.backgroundSecondary) {
      root.style.setProperty('--color-background-secondary', themeColors.backgroundSecondary);
    }
    if (themeColors.border) {
      root.style.setProperty('--color-border', themeColors.border);
    }
    if (themeColors.accent) {
      root.style.setProperty('--color-accent', themeColors.accent);
    }
  };

  const loadTheme = async () => {
    if (!tenant.businessId) {
      applyColorsToDOM(defaultColors);
      setColors(defaultColors);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('booking_form_colors')
        .select('*')
        .eq('business_id', tenant.businessId);

      if (error) {
        console.error('Error loading theme:', error);
        applyColorsToDOM(defaultColors);
        setColors(defaultColors);
      } else if (data && data.length > 0) {
        const loadedColors: ThemeColors = { ...defaultColors };

        data.forEach((colorEntry) => {
          const mappedKey = colorKeyMap[colorEntry.color_key];
          if (mappedKey && colorEntry.color_value) {
            loadedColors[mappedKey] = colorEntry.color_value;
          }
        });

        applyColorsToDOM(loadedColors);
        setColors(loadedColors);
      } else {
        applyColorsToDOM(defaultColors);
        setColors(defaultColors);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      applyColorsToDOM(defaultColors);
      setColors(defaultColors);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTheme();
  }, [tenant.businessId]);

  const updateTheme = (newColors: ThemeColors) => {
    const updatedColors = { ...colors, ...newColors };
    setColors(updatedColors);
    applyColorsToDOM(updatedColors);
  };

  const refreshTheme = async () => {
    setLoading(true);
    await loadTheme();
  };

  return (
    <ThemeContext.Provider value={{ colors, loading, updateTheme, refreshTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return {
      colors: defaultColors,
      loading: false,
      updateTheme: () => {},
      refreshTheme: async () => {},
    };
  }
  return context;
}
