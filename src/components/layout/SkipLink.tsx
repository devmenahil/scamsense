export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-button border-2 border-teal bg-white px-4 py-3 label-button text-button text-teal focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to content
    </a>
  );
}
