import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          muted: "hsl(var(--success-muted))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          muted: "hsl(var(--warning-muted))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          muted: "hsl(var(--error-muted))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          muted: "hsl(var(--info-muted))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          selected: "hsl(var(--sidebar-selected))",
          "selected-foreground": "hsl(var(--sidebar-selected-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
        avatar: {
          1: "hsl(var(--avatar-1))",
          2: "hsl(var(--avatar-2))",
          3: "hsl(var(--avatar-3))",
          4: "hsl(var(--avatar-4))",
          5: "hsl(var(--avatar-5))",
          6: "hsl(var(--avatar-6))",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      fontSize: {
        xs: ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        sm: ["13px", { lineHeight: "20px", letterSpacing: "0.01em" }],
        base: ["15px", { lineHeight: "24px", letterSpacing: "0" }],
        lg: ["17px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        xl: ["20px", { lineHeight: "28px", letterSpacing: "-0.02em" }],
        "2xl": ["24px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        "3xl": ["30px", { lineHeight: "36px", letterSpacing: "-0.02em" }],
        "4xl": ["38px", { lineHeight: "40px", letterSpacing: "-0.03em" }],
        "5xl": ["48px", { lineHeight: "48px", letterSpacing: "-0.03em" }],
      },
      spacing: {
        "0": "0px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
        "24": "96px",
        "32": "128px",
      },
      borderRadius: {
        none: "0px",
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        full: "9999px",
      },
      boxShadow: {
        none: "none",
        px: "0 0 0 1px rgba(0,0,0,0.04)",
        xs: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)",
        sm: "0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        DEFAULT: "0 0 0 1px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)",
        md: "0 0 0 1px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)",
        lg: "0 0 0 1px rgba(0,0,0,0.04), 0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)",
        xl: "0 0 0 1px rgba(0,0,0,0.04), 0 20px 25px rgba(0,0,0,0.08), 0 10px 10px rgba(0,0,0,0.04)",
        "2xl": "0 0 0 1px rgba(0,0,0,0.04), 0 25px 50px rgba(0,0,0,0.12)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.08)",
      },
      backdropBlur: {
        glass: "12px",
      },
      transitionDuration: {
        instant: "50ms",
        fast: "100ms",
        DEFAULT: "200ms",
        slow: "300ms",
        slower: "500ms",
      },
      transitionTimingFunction: {
        default: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        in: "cubic-bezier(0.4, 0, 1, 1)",
        out: "cubic-bezier(0, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
        fadeIn: "fadeIn 200ms ease-out",
        fadeInUp: "fadeInUp 200ms ease-out",
        fadeInDown: "fadeInDown 200ms ease-out",
        scaleIn: "scaleIn 200ms ease-out",
        slideInLeft: "slideInLeft 200ms ease-out",
        slideInRight: "slideInRight 200ms ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        spin: "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;