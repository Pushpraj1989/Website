/** Tailwind mapping: components use bg-surface, text-muted, border-input; never raw hex. */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx,html}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)", surface: "var(--color-surface)", border: "var(--color-border)",
        "border-input": "var(--color-border-input)", text: "var(--color-text)", "text-muted": "var(--color-text-muted)",
        accent: "var(--color-accent)", "on-accent": "var(--color-on-accent)", danger: "var(--color-danger)",
        success: "var(--color-success)", warning: "var(--color-warning)"
      },
      borderRadius: { sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)" },
      boxShadow: { card: "var(--shadow-card)", pop: "var(--shadow-pop)" },
      fontFamily: { sans: "var(--font-sans)", arabic: "var(--font-arabic)", mono: "var(--font-mono)" }
    }
  }
};
