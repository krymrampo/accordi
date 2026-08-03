import { memo, useEffect, useMemo, useRef, useState } from "react";
import { transposeMusicBlock } from "./music.js";

function PairRow({ row }) {
  return (
    <div className="music-row music-pair-row">
      <div className="music-pair-track">
        {row.segments.map((segment, index) => {
          const chordLen = segment.chord?.display?.length || 0;
          const segmentCh = Math.max(segment.width, chordLen, 1);
          return (
            <span
              className="music-segment"
              key={`${segment.chord?.original || "text"}-${index}`}
              style={{ "--segment-ch": segmentCh }}
            >
              <span className={`music-chord${segment.chord ? "" : " is-empty"}`}>{segment.chord?.display || "\u00a0"}</span>
              <span className="music-lyric">{segment.text || "\u00a0"}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}


function MusicRow({ row }) {
  if (row.kind === "pair") return <PairRow row={row} />;
  if (row.kind === "chords") {
    return (
      <div className="music-row music-progression">
        {row.tokens.map((token, index) => <span className="music-chord" key={`${token.start}-${index}`}>{token.chord.display}</span>)}
      </div>
    );
  }
  if (row.kind === "blank") return <div className="music-row music-blank" aria-hidden="true" />;
  if (row.kind === "raw") return <div className="music-row music-raw" tabIndex="0">{row.text}</div>;
  return <div className="music-row music-text">{row.text}</div>;
}

export const ChordSheet = memo(function ChordSheet({ block, transpose, fontSize = 16 }) {
  const renderedBlock = useMemo(() => transposeMusicBlock(block, transpose), [block, transpose]);
  const scrollRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return undefined;

    const updateOverflow = () => {
      setIsOverflowing(viewport.scrollWidth > viewport.clientWidth + 1);
    };
    const frame = window.requestAnimationFrame(updateOverflow);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(updateOverflow) : null;
    observer?.observe(viewport);
    if (viewport.firstElementChild) observer?.observe(viewport.firstElementChild);
    window.addEventListener("resize", updateOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [renderedBlock, fontSize]);

  return (
    <section
      className={`chord-sheet${isOverflowing ? " is-overflowing" : ""}`}
      aria-label="Testo e accordi"
      style={{ "--reader-font-size": `${fontSize}px` }}
    >
      {isOverflowing ? <p className="chord-scroll-hint" aria-hidden="true">Scorri lateralmente <span>→</span></p> : null}
      <div
        className="chord-sheet-scroll"
        ref={scrollRef}
        tabIndex="0"
        aria-label={isOverflowing ? "Testo e accordi, scorri lateralmente per leggere le righe complete" : "Testo e accordi"}
      >
        <div className="chord-sheet-content">
          {renderedBlock.sections.map((section, sectionIndex) => (
            <div className="music-section" data-key={section.transposedKey || undefined} key={`${section.key || "section"}-${sectionIndex}`}>
              {section.rows.map((row, rowIndex) => <MusicRow row={row} key={`${row.kind}-${rowIndex}`} />)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
