import { memo, useMemo } from "react";
import { transposeMusicBlock } from "./music.js";

function PairRow({ row }) {
  return (
    <div className="music-row music-pair-row">
      <div className="music-pair-track">
        {row.segments.map((segment, index) => (
          <span
            className="music-segment"
            key={`${segment.chord?.original || "text"}-${index}`}
            style={{ "--segment-ch": Math.max(segment.width, segment.chord?.display?.length || 0, 1) + (segment.chord ? 1 : 0) }}
          >
            <span className={`music-chord${segment.chord ? "" : " is-empty"}`}>{segment.chord?.display || "\u00a0"}</span>
            <span className="music-lyric">{segment.text || "\u00a0"}</span>
          </span>
        ))}
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

export const ChordSheet = memo(function ChordSheet({ block, transpose }) {
  const renderedBlock = useMemo(() => transposeMusicBlock(block, transpose), [block, transpose]);

  return (
    <section className="chord-sheet" aria-label="Testo e accordi">
      {renderedBlock.sections.map((section, sectionIndex) => (
        <div className="music-section" data-key={section.transposedKey || undefined} key={`${section.key || "section"}-${sectionIndex}`}>
          {section.rows.map((row, rowIndex) => <MusicRow row={row} key={`${row.kind}-${rowIndex}`} />)}
        </div>
      ))}
    </section>
  );
});
