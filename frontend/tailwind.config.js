/** @type {import('tailwindcss').Config} */
function themeColor(name) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: themeColor("canvas"),
        surface: themeColor("surface"),
        "surface-hover": themeColor("surface-hover"),
        line: {
          DEFAULT: themeColor("line"),
          strong: themeColor("line-strong"),
        },
        ink: {
          DEFAULT: themeColor("ink"),
          secondary: themeColor("ink-secondary"),
          muted: themeColor("ink-muted"),
        },
        accent: {
          DEFAULT: themeColor("accent"),
          hover: themeColor("accent-hover"),
        },
        "on-accent": themeColor("on-accent"),
        stat: {
          DEFAULT: themeColor("stat-surface"),
          ink: themeColor("stat-ink"),
          muted: themeColor("stat-ink-muted"),
        },
      },
    },
  },
  plugins: [],
};
