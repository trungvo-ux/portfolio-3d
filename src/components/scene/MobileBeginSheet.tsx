type MobileBeginSheetProps = {
  onClose: () => void;
  fontClassName: string;
  fontVariable: string;
};

export function MobileBeginSheet({ onClose, fontClassName, fontVariable }: MobileBeginSheetProps) {
  return (
    <section className="mobile-sheet-overlay">
      <div className={`${fontClassName} ${fontVariable} mobile-sheet`}>
        <p className="mobile-sheet-title">HI THERE,THANKS FOR VIEWING!</p>
        <p className="mobile-sheet-message">
          I RECOMMEND TO VIEW THIS
          <br />
          PORTFOLIO ON DESKTOP
        </p>
        <button type="button" className="mobile-sheet-button" onClick={onClose}>
          OKAY
        </button>
      </div>
    </section>
  );
}
