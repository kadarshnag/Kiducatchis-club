import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
    theme: 'light',
    isLight: true,
    toggleTheme: () => { },
    setTheme: () => { },
    logoSrc: '/assets/logo-blue.webp',
    jerseySrc: '/assets/jersey-ice.webp',
    altJerseySrc: '/assets/jersey-purple.webp'
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => {
        try {
            const saved = localStorage.getItem('kiducatchis_theme');
            if (saved === 'light' || saved === 'dark') return saved;
            return 'light';
        } catch {
            return 'light';
        }
    });

    const setTheme = (next) => {
        setThemeState(next);
        try {
            localStorage.setItem('kiducatchis_theme', next);
        } catch (e) {
            console.warn('Could not save theme:', e);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);

        if (theme === 'light') {
            root.classList.add('theme-light');
            root.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
        } else {
            root.classList.add('theme-dark');
            root.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-light');
        }

        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.setAttribute('content', theme === 'light' ? '#f3f6fc' : '#0d0818');
        }
    }, [theme]);

    const isLight = theme === 'light';
    const logoSrc = isLight ? '/assets/logo-blue.webp' : '/assets/logo-purple.webp';
    const jerseySrc = isLight ? '/assets/jersey-ice.webp' : '/assets/jersey-purple.webp';
    const altJerseySrc = isLight ? '/assets/jersey-purple.webp' : '/assets/jersey-ice.webp';

    return (
        <ThemeContext.Provider value={{
            theme,
            isLight,
            toggleTheme,
            setTheme,
            logoSrc,
            jerseySrc,
            altJerseySrc
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function ThemeSwitcher({ className = '', compact = false }) {
    const { toggleTheme, isLight } = useTheme();

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`frisbee-switcher ${isLight ? 'is-light' : 'is-dark'} ${compact ? 'is-compact' : ''} ${className}`}
            title={isLight ? 'Switch to Dark Purple Jersey theme' : 'Switch to Light Ice Jersey (Pastel) theme'}
            aria-label={isLight ? 'Switch to Dark Purple Jersey theme' : 'Switch to Light Ice Jersey (Pastel) theme'}
        >
            <span className="frisbee-track">
                {/* Night / Moon cue */}
                <span className="frisbee-marker marker-dark" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
                        <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
                    </svg>
                </span>

                {/* Day / Sun cue */}
                <span className="frisbee-marker marker-light" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <circle cx="8" cy="8" r="3.2" fill="currentColor" />
                        <line x1="8" y1="1" x2="8" y2="2.5" />
                        <line x1="8" y1="13.5" x2="8" y2="15" />
                        <line x1="1" y1="8" x2="2.5" y2="8" />
                        <line x1="13.5" y1="8" x2="15" y2="8" />
                    </svg>
                </span>

                {/* Flying Frisbee Disc */}
                <span className="frisbee-flight-unit">
                    <span className="frisbee-trail" aria-hidden="true" />
                    <span className="frisbee-disc">
                        <svg
                            viewBox="0 0 32 32"
                            className="frisbee-disc-svg"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle cx="16" cy="16" r="14" className="frisbee-rim" />
                            <circle cx="16" cy="16" r="11" className="frisbee-groove-1" strokeWidth="1" strokeDasharray="3 1.5" />
                            <circle cx="16" cy="16" r="8" className="frisbee-groove-2" strokeWidth="0.9" />
                            <circle cx="16" cy="16" r="5" className="frisbee-groove-3" strokeWidth="0.8" />
                            <circle cx="16" cy="16" r="2.5" className="frisbee-core" />
                            <path d="M16 4.5 L16 7 M16 25 L16 27.5 M4.5 16 L7 16 M25 16 L27.5 16" className="frisbee-notches" strokeWidth="1.2" strokeLinecap="round" />
                            <path d="M16 11.5 C18.5 11.5 20.5 13.5 20.5 16 M16 20.5 C13.5 20.5 11.5 18.5 11.5 16" className="frisbee-swirl" strokeWidth="1.1" strokeLinecap="round" />
                        </svg>
                    </span>
                </span>
            </span>
        </button>
    );
}
