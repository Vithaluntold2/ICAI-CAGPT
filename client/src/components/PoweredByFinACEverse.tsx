export default function PoweredByFinACEverse() {
  return (
    <div className="border-t border-primary/15 bg-background/95 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 text-sm font-display">
        <span className="text-foreground/80">Powered by</span>
        <a
          href="https://finaceverse.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 inline-flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-primary/5"
          aria-label="Visit FinACEverse"
        >
          <img
            src="/finaceverse-icon.svg"
            alt="FinACEverse"
            className="h-5 w-5"
          />
          <span className="font-semibold finaceverse-gradient-text">
            FinACEverse
          </span>
        </a>
      </div>
    </div>
  );
}
