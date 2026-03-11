type BootOverlayProps = {
  asciiLogo: string;
  bootLines: string[];
  visibleLineCount: number;
  uiPhase: "boot" | "ready";
  isInteractionEnabled: boolean;
  onBegin: () => void;
  fontClassName: string;
  fontVariable: string;
};

export function BootOverlay({
  asciiLogo,
  bootLines,
  visibleLineCount,
  uiPhase,
  isInteractionEnabled,
  onBegin,
  fontClassName,
  fontVariable,
}: BootOverlayProps) {
  return (
    <section
      className={`${fontClassName} ${fontVariable} boot-overlay ${uiPhase === "ready" ? "boot-overlay--ready" : ""}`}
    >
      <pre className="boot-logo">{asciiLogo}</pre>
      <div className="boot-lines">
        {bootLines.slice(0, visibleLineCount).map((line, index) => (
          <p key={`${line}-${index}`} className="boot-line">
            {line || "\u00A0"}
          </p>
        ))}
      </div>
      {uiPhase === "ready" && (
        <button
          type="button"
          className={`boot-button ${isInteractionEnabled ? "" : "boot-button--disabled"}`}
          onClick={onBegin}
          disabled={!isInteractionEnabled}
        >
          Begin Now
        </button>
      )}
      <p className="boot-footer">Press DEL to Cancel or Press &lt;F2&gt; to enter BIOS Setup</p>
    </section>
  );
}
