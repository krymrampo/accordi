import { useEffect, useMemo, useState } from "react";
import { ChordSheet } from "./ChordSheet.jsx";
import {
  BookmarkIcon,
  ChevronIcon,
  DownloadIcon,
  ExternalIcon,
  MoonIcon,
  PlayIcon,
  PrintIcon,
  ReaderIcon,
  ResetIcon,
  SearchIcon,
  SunIcon,
  TrashIcon,
} from "./Icons.jsx";
import { parseSongPage, SOURCE_ORIGIN } from "./music.js";
import {
  readerFontPercentage,
  READER_FONT_DEFAULT,
  READER_FONT_MAX,
  READER_FONT_MIN,
} from "./readerPreferences.js";
import {
  readSavedPages,
  rememberSavedPage,
  removeSavedPage,
  TRANSPOSE_MAX,
  TRANSPOSE_MIN,
  updateSavedPagePreferences,
} from "./savedPages.js";
import { extractSearchResults, getSearchTerm, searchSavedPages } from "./searchResults.js";


const PAGE_CACHE = "accordi-pages-v1";
const EMPTY_PDF_STATE = { status: "idle", file: null, path: "", transpose: 0, message: "", error: "" };

function normalizePath(value) {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

function transposeLabel(value) {
  return value > 0 ? `+${value}` : String(value);
}

function SavedPreferenceSummary({ item }) {
  return (
    <span className="saved-item-preferences" aria-label={`Trasposizione ${transposeLabel(item.transpose)}, testo ${readerFontPercentage(item.fontSize)}%`}>
      <small>Trasposizione {transposeLabel(item.transpose)}</small>
      <small>Testo {readerFontPercentage(item.fontSize)}%</small>
    </span>
  );
}

export function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.href));
  const [page, setPage] = useState(() => normalizePath(window.location.href) === "/"
    ? { status: "home", html: "", title: "" }
    : { status: "loading", html: "", title: "" });
  const [query, setQuery] = useState(() => getSearchTerm(normalizePath(window.location.href)));
  const [requestVersion, setRequestVersion] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [savedPages, setSavedPages] = useState(() => readSavedPages(window.localStorage));
  const [savedFilter, setSavedFilter] = useState("");
  const [savedSort, setSavedSort] = useState("recent");
  const [pdfState, setPdfState] = useState(EMPTY_PDF_STATE);
  const [readerFontSize, setReaderFontSize] = useState(READER_FONT_DEFAULT);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = window.localStorage.getItem("accordi-clean:theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {}
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const isChordPage = useMemo(() => path.startsWith("/accordi/"), [path]);
  const isHome = path === "/";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("accordi-clean:theme", theme);
    } catch {}
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function navigate(nextPath) {
    const cleanPath = normalizePath(nextPath);
    window.history.pushState({}, "", cleanPath);
    setPath(cleanPath);
    setPdfState(EMPTY_PDF_STATE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    setQuery(getSearchTerm(path));
  }, [path]);

  useEffect(() => {
    function onPopState() {
      setPath(normalizePath(window.location.href));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  useEffect(() => {
    if (!isChordPage || page.status !== "ready") return undefined;
    let lock = null;
    let released = false;

    async function obtainWakeLock() {
      try {
        if ("wakeLock" in navigator && typeof navigator.wakeLock.request === "function") {
          lock = await navigator.wakeLock.request("screen");
          if (!released) {
            setWakeLockActive(true);
            lock.addEventListener("release", () => setWakeLockActive(false));
          }
        }
      } catch {
        setWakeLockActive(false);
      }
    }

    obtainWakeLock();

    return () => {
      released = true;
      if (lock && typeof lock.release === "function") {
        lock.release().catch(() => {});
      }
      setWakeLockActive(false);
    };
  }, [isChordPage, page.status]);

  useEffect(() => {
    const controller = new AbortController();
    const searchTerm = getSearchTerm(path);
    const savedPage = readSavedPages(window.localStorage).find((item) => item.path === path);
    setTranspose(savedPage?.transpose ?? 0);
    setReaderFontSize(savedPage?.fontSize ?? READER_FONT_DEFAULT);
    setPdfState(EMPTY_PDF_STATE);

    if (path === "/") {
      document.title = "Accordi e Spartiti · Cerca un brano";
      setSavedPages(readSavedPages(window.localStorage));
      setPage({ status: "home", html: "", title: "" });
      return () => controller.abort();
    }

    setPage({ status: searchTerm ? "searching" : "loading", html: "", title: "" });
    const localMatches = searchSavedPages(readSavedPages(window.localStorage), searchTerm);

    if (!navigator.onLine && searchTerm) {
      setPage({ status: "local-search", html: "", title: `Risultati salvati per “${searchTerm}”`, matches: localMatches });
      return () => controller.abort();
    }

    const requestUrl = `/api/page?path=${encodeURIComponent(path)}`;
    fetch(requestUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pagina non disponibile");
        if ("caches" in window) {
          try {
            const cache = await caches.open(PAGE_CACHE);
            await cache.put(requestUrl, response.clone());
          } catch {
            // Il contenuto online resta consultabile anche se il dispositivo rifiuta la cache.
          }
        }
        return response.json();
      })
      .then(({ html }) => {
        if (searchTerm) {
          const doc = new DOMParser().parseFromString(html, "text/html");
          const matches = extractSearchResults(doc, searchTerm);
          const title = `Risultati per “${searchTerm}”`;
          document.title = `${title} · Lettore pulito`;
          setPage({ status: "search-results", html: "", title, matches });
          return;
        }
        const song = parseSongPage(html, path);
        document.title = `${song.title} · Lettore pulito`;
        setPage({ status: "ready", song, title: song.title });
        setSavedPages(rememberSavedPage(window.localStorage, path, song.title, song.artist));
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (searchTerm) {
          if (localMatches.length) {
            setPage({
              status: "local-search",
              html: "",
              title: `Risultati salvati per “${searchTerm}”`,
              matches: localMatches,
              notice: "La ricerca online non è disponibile: mostro i brani salvati su questo dispositivo.",
            });
            return;
          }
          setPage({ status: "search-error", html: "", title: "Ricerca online non disponibile" });
          return;
        }
        setPage({ status: "error", html: "", title: error.message });
      });
    return () => controller.abort();
  }, [path, requestVersion]);

  useEffect(() => {
    if (!autoScroll) return undefined;
    const intervalMs = Math.max(10, Math.round(28 / scrollSpeed));
    const timer = window.setInterval(() => window.scrollBy({ top: 1, behavior: "instant" }), intervalMs);
    return () => window.clearInterval(timer);
  }, [autoScroll, scrollSpeed]);

  function removeSavedPageItem(pathToRemove, event) {
    event.stopPropagation();
    setSavedPages(removeSavedPage(window.localStorage, pathToRemove));
  }

  const filteredSavedPages = useMemo(() => {
    let list = savedPages;
    if (savedFilter.trim()) {
      const term = savedFilter.trim().toLowerCase();
      list = list.filter((item) => `${item.title} ${item.artist}`.toLowerCase().includes(term));
    }
    if (savedSort === "title") {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [savedPages, savedFilter, savedSort]);


  function handleContentClick(event) {
    const link = event.target.closest("a[data-local]");
    if (!link || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    navigate(link.getAttribute("href"));
  }

  function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setRequestVersion((value) => value + 1);
    navigate(`/?s=${encodeURIComponent(query.trim())}`);
  }

  function changeTranspose(nextValue) {
    const normalized = Math.max(TRANSPOSE_MIN, Math.min(TRANSPOSE_MAX, nextValue));
    setTranspose(normalized);
    setSavedPages(updateSavedPagePreferences(window.localStorage, path, { transpose: normalized }));
    setPdfState(EMPTY_PDF_STATE);
  }

  function changeReaderFontSize(nextValue) {
    const normalized = Math.max(READER_FONT_MIN, Math.min(READER_FONT_MAX, Math.round(nextValue)));
    setReaderFontSize(normalized);
    setSavedPages(updateSavedPagePreferences(window.localStorage, path, { fontSize: normalized }));
  }

  const visibleSongBlocks = useMemo(() => {
    if (page.status !== "ready") return [];
    const lastMusicIndex = page.song.contentBlocks.reduce((lastIndex, block, index) => (
      block.type === "music" ? index : lastIndex
    ), -1);
    return lastMusicIndex >= 0
      ? page.song.contentBlocks.slice(0, lastMusicIndex + 1)
      : page.song.contentBlocks;
  }, [page]);

  async function handlePdf() {
    if (page.status !== "ready" || pdfState.status === "preparing") return;
    setPdfState((current) => ({ ...current, status: "preparing", message: "", error: "" }));

    try {
      const pdfTools = await import("./songPdf.js");
      const isCurrentFile = pdfState.file && pdfState.path === path && pdfState.transpose === transpose;
      const file = isCurrentFile ? pdfState.file : await pdfTools.createSongPdfFile(page.song, transpose);

      if (pdfTools.canSharePdf(file)) {
        setPdfState({ status: "ready", file, path, transpose, message: "PDF pronto: puoi salvarlo o condividerlo.", error: "" });
        try {
          await pdfTools.sharePdf(file, page.song);
          setPdfState({ ...EMPTY_PDF_STATE, message: "PDF consegnato al dispositivo." });
        } catch (error) {
          if (error?.name !== "AbortError" && error?.name !== "NotAllowedError") throw error;
        }
      } else {
        pdfTools.downloadPdf(file);
        setPdfState({ ...EMPTY_PDF_STATE, message: "Download del PDF avviato." });
      }
    } catch (error) {
      setPdfState((current) => ({
        ...current,
        status: current.file ? "ready" : "idle",
        message: "",
        error: error instanceof Error ? error.message : "Non riesco a creare il PDF.",
      }));
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Vai al contenuto</a>
      <header className="site-header">
        <div className={`header-main${isHome ? " is-home" : ""}`}>
          <button className="brand" onClick={() => navigate("/")} aria-label="Torna alla home">
            <span>ACCORDI</span><b>&amp;</b><span>SPARTITI</span>
          </button>
          <div className="header-actions">
            {!isHome ? (
              <form className="search" onSubmit={handleSearch}>
                <input aria-label="Cerca una canzone o un artista" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca una canzone o un artista…" />
                <button type="submit" disabled={page.status === "searching"} aria-label={page.status === "searching" ? "Ricerca in corso" : "Cerca"}>
                  <SearchIcon />
                </button>
              </form>
            ) : null}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Attiva modalità giorno" : "Attiva modalità notte"}
              title={theme === "dark" ? "Passa a modalità giorno" : "Passa a modalità notte (palco)"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </header>

      {isHome ? (
        <main className="home-layout" id="main-content">
          <section className="home-search-section" aria-labelledby="home-search-title">
            <p className="eyebrow">Il tuo canzoniere</p>
            <h1 id="home-search-title">Cerca un brano o un artista</h1>
            <form className="home-search" onSubmit={handleSearch}>
              <input
                autoFocus
                aria-label="Cerca un brano o un artista"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Titolo del brano o nome dell’artista…"
              />
              <button type="submit" aria-label="Cerca">
                <SearchIcon /><span>Cerca</span>
              </button>
            </form>
          </section>

          <section className="saved-library" aria-labelledby="saved-library-title">
            <div className="saved-library-heading">
              <div>
                <BookmarkIcon />
                <h2 id="saved-library-title">Brani salvati</h2>
              </div>
              <span>{filteredSavedPages.length} di {savedPages.length} {savedPages.length === 1 ? "brano" : "brani"}</span>
            </div>

            {savedPages.length > 0 ? (
              <div className="saved-library-controls">
                <input
                  type="search"
                  placeholder="Filtra brani salvati…"
                  value={savedFilter}
                  onChange={(e) => setSavedFilter(e.target.value)}
                  aria-label="Filtra tra i brani salvati"
                />
                <select
                  value={savedSort}
                  onChange={(e) => setSavedSort(e.target.value)}
                  aria-label="Ordinamento brani salvati"
                >
                  <option value="recent">Ordina per: Più recenti</option>
                  <option value="title">Ordina per: Titolo A-Z</option>
                </select>
              </div>
            ) : null}

            {filteredSavedPages.length ? (
              <ul className="home-saved-list">
                {filteredSavedPages.map((item) => (
                  <li key={item.path}>
                    <div className="home-saved-item">
                      <button className="saved-item-link" onClick={() => navigate(item.path)}>
                        <span>
                          <strong>{item.title}</strong>
                          {item.artist ? <small>{item.artist}</small> : null}
                          <SavedPreferenceSummary item={item} />
                        </span>
                        <ChevronIcon />
                      </button>
                      <button
                        className="remove-saved-btn"
                        onClick={(event) => removeSavedPageItem(item.path, event)}
                        aria-label={`Rimuovi ${item.title} dai brani salvati`}
                        title="Rimuovi dai brani salvati"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : savedPages.length > 0 ? (
              <p className="home-saved-empty">Nessun brano salvato corrisponde al filtro inserito.</p>
            ) : (
              <p className="home-saved-empty">I brani che apri verranno salvati qui e resteranno disponibili anche offline.</p>
            )}
          </section>
        </main>
      ) : (
        <main className="layout" id="main-content">
          <section className="reader-panel">
            {page.status === "ready" ? (
              <div className="reader-meta">
                <div className="reader-meta-lead">
                  <ReaderIcon />
                  <span>Lettore senza interruzioni</span>
                  <span className={`connection-status ${online ? "is-online" : "is-offline"}`}>
                    <i aria-hidden="true" />{online ? "Online" : "Offline"}
                  </span>
                  {wakeLockActive ? (
                    <span className="wake-lock-badge" title="Lo schermo rimarrà sempre attivo durante l'esecuzione">
                      Schermo Attivo
                    </span>
                  ) : null}
                </div>
                <a href={`${SOURCE_ORIGIN}${path}`} target="_blank" rel="noreferrer">Apri originale <ExternalIcon /></a>
              </div>
            ) : null}
            {isChordPage && page.status === "ready" ? (
              <div className="music-toolbar" aria-label="Strumenti per gli accordi">
                <div className="toolbar-group toolbar-transpose" aria-label="Traspositore">
                  <span className="toolbar-label">Tonalità</span>
                  <button className="toolbar-square" disabled={transpose <= TRANSPOSE_MIN} onClick={() => changeTranspose(transpose - 1)} aria-label="Abbassa di un semitono">−</button>
                  <strong className="toolbar-value transpose-value">{transpose > 0 ? `+${transpose}` : transpose}</strong>
                  <button className="toolbar-square" disabled={transpose >= TRANSPOSE_MAX} onClick={() => changeTranspose(transpose + 1)} aria-label="Alza di un semitono">+</button>
                  <button className="toolbar-action toolbar-reset" disabled={transpose === 0} onClick={() => changeTranspose(0)} aria-label="Reimposta trasposizione">
                    <ResetIcon /><span>Reimposta</span>
                  </button>
                </div>
                <div className="toolbar-group toolbar-font" aria-label="Dimensione testo e accordi">
                  <span className="toolbar-label">Testo</span>
                  <button className="toolbar-square font-control" disabled={readerFontSize <= READER_FONT_MIN} onClick={() => changeReaderFontSize(readerFontSize - 1)} aria-label="Riduci dimensione testo">A−</button>
                  <strong className="toolbar-value font-size-value">{readerFontPercentage(readerFontSize)}%</strong>
                  <button className="toolbar-square font-control" disabled={readerFontSize >= READER_FONT_MAX} onClick={() => changeReaderFontSize(readerFontSize + 1)} aria-label="Aumenta dimensione testo">A+</button>
                  <button className="toolbar-action font-reset" disabled={readerFontSize === READER_FONT_DEFAULT} onClick={() => changeReaderFontSize(READER_FONT_DEFAULT)} aria-label="Reimposta dimensione testo al 100%">100%</button>
                </div>
                <div className="toolbar-group toolbar-main-actions">
                  <button className={`toolbar-action${autoScroll ? " is-active" : ""}`} onClick={() => setAutoScroll((value) => !value)}>
                    <PlayIcon paused={autoScroll} /><span>{autoScroll ? "Ferma" : "Auto-scroll"}</span>
                  </button>
                  {autoScroll ? (
                    <select
                      className="toolbar-speed-select"
                      value={scrollSpeed}
                      onChange={(e) => setScrollSpeed(Number(e.target.value))}
                      aria-label="Velocità autoscroll"
                    >
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1.0x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2.0x</option>
                    </select>
                  ) : null}
                  <button className="toolbar-action" onClick={() => window.print()} title="Stampa brano"><PrintIcon /><span>Stampa</span></button>
                  <button className="toolbar-action pdf-button" disabled={pdfState.status === "preparing"} onClick={handlePdf}>
                    <DownloadIcon /><span>{pdfState.status === "preparing" ? "Creo PDF…" : pdfState.status === "ready" ? "Salva PDF" : "PDF"}</span>
                  </button>
                </div>
              </div>
            ) : null}

            {isChordPage && (pdfState.message || pdfState.error) ? (
              <p className={`pdf-status${pdfState.error ? " is-error" : ""}`} role="status">{pdfState.error || pdfState.message}</p>
            ) : null}
            {page.status === "loading" ? <div className="loading">Caricamento della pagina pulita…</div> : null}
            {page.status === "searching" ? <div className="loading" role="status">Ricerca in corso… Il primo risultato può richiedere alcuni secondi.</div> : null}
            {page.status === "error" ? <div className="error">{page.title}. Riprova tra poco.</div> : null}
            {page.status === "search-error" ? <div className="error">{page.title}. Premi Cerca per riprovare.</div> : null}
            {page.status === "search-results" ? (
              <section className="search-results">
                <p className="eyebrow">Ricerca online</p>
                <h1>{page.title}</h1>
                {page.matches.length ? (
                  <ul>
                    {page.matches.map((item) => (
                      <li key={item.path}>
                        <button onClick={() => navigate(item.path)}>
                          <span>{item.title}</span>
                          {item.artist ? <small>{item.artist}</small> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p>Nessun brano trovato.</p>}
              </section>
            ) : null}
            {page.status === "local-search" ? (
              <section className="search-results local-results">
                <p className="eyebrow">Ricerca offline</p>
                <h1>{page.title}</h1>
                {page.notice ? <p className="search-notice">{page.notice}</p> : null}
                {page.matches.length ? (
                  <ul>
                    {page.matches.map((item) => (
                      <li key={item.path}><button onClick={() => navigate(item.path)}>{item.title}</button></li>
                    ))}
                  </ul>
                ) : <p>Nessun brano già salvato corrisponde alla ricerca.</p>}
              </section>
            ) : null}
            {page.status === "ready" ? (
              <>
                <article className="source-content" onClick={handleContentClick}>
                  {visibleSongBlocks.map((block, index) => block.type === "music" ? (
                    <ChordSheet block={page.song.musicBlocks[block.musicIndex]} fontSize={readerFontSize} transpose={transpose} key={`${path}-music-${block.musicIndex}`} />
                  ) : (
                    <div className="source-html-block" dangerouslySetInnerHTML={{ __html: block.html }} key={`html-${index}`} />
                  ))}
                </article>
                <section className="song-saved-library" aria-labelledby="song-saved-library-title">
                  <div className="song-saved-library-heading">
                    <BookmarkIcon />
                    <h2 id="song-saved-library-title">Brani salvati</h2>
                    <span>{savedPages.length}</span>
                  </div>
                  <ul className="song-saved-list">
                    {savedPages.map((item) => (
                      <li key={item.path}>
                        <button onClick={() => navigate(item.path)} aria-current={item.path === path ? "page" : undefined}>
                          <strong>{item.title}</strong>
                          <SavedPreferenceSummary item={item} />
                          <ChevronIcon />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}
          </section>
        </main>
      )}
    </div>
  );
}
