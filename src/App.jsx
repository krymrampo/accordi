import { useEffect, useMemo, useState } from "react";
import { ChordSheet } from "./ChordSheet.jsx";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronIcon,
  DownloadIcon,
  ExternalIcon,
  PhoneIcon,
  PlayIcon,
  PrintIcon,
  ReaderIcon,
  RemovedIcon,
  ResetIcon,
  SearchIcon,
} from "./Icons.jsx";
import { parseSongPage, SOURCE_ORIGIN } from "./music.js";
import {
  readReaderFontSize,
  readerFontPercentage,
  READER_FONT_DEFAULT,
  READER_FONT_MAX,
  READER_FONT_MIN,
  saveReaderFontSize,
} from "./readerPreferences.js";
import { extractSearchResults, getSearchTerm, searchSavedPages } from "./searchResults.js";

const SAVED_PAGES_KEY = "accordi-clean:saved-pages";
const PAGE_CACHE = "accordi-pages-v1";
const EMPTY_PDF_STATE = { status: "idle", file: null, path: "", transpose: 0, message: "", error: "" };
const NAV_ITEMS = [
  ["Accordi", "/accordi-chitarra/"],
  ["Spartiti", "/spartiti-pianoforte/"],
  ["Videolezioni", "/videolezioni/"],
  ["Libri", "/tutti-i-libri/"],
];

function normalizePath(value) {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

function readSavedPages() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVED_PAGES_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function rememberSavedPage(path, title) {
  if (!path.startsWith("/accordi/")) return readSavedPages();
  const current = readSavedPages().filter((item) => item.path !== path);
  const next = [{ path, title, savedAt: Date.now() }, ...current].slice(0, 250);
  try {
    window.localStorage.setItem(SAVED_PAGES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return current;
  }
}

function isNavItemActive(path, href) {
  if (href === "/accordi-chitarra/") return path.startsWith("/accordi/") || path.startsWith(href);
  return path.startsWith(href);
}

export function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.href));
  const [page, setPage] = useState({ status: "loading", html: "", title: "" });
  const [query, setQuery] = useState(() => getSearchTerm(normalizePath(window.location.href)));
  const [requestVersion, setRequestVersion] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [savedPages, setSavedPages] = useState(() => readSavedPages());
  const [pdfState, setPdfState] = useState(EMPTY_PDF_STATE);
  const [readerFontSize, setReaderFontSize] = useState(() => readReaderFontSize(window.localStorage));

  const isChordPage = useMemo(() => path.startsWith("/accordi/"), [path]);

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
    const controller = new AbortController();
    const searchTerm = getSearchTerm(path);
    setPage({ status: searchTerm ? "searching" : "loading", html: "", title: "" });
    setTranspose(0);
    setPdfState(EMPTY_PDF_STATE);
    const localMatches = searchSavedPages(readSavedPages(), searchTerm);

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
        setSavedPages(rememberSavedPage(path, song.title));
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
    const timer = window.setInterval(() => window.scrollBy({ top: 1, behavior: "instant" }), 28);
    return () => window.clearInterval(timer);
  }, [autoScroll]);

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
    setTranspose(Math.max(-6, Math.min(6, nextValue)));
    setPdfState(EMPTY_PDF_STATE);
  }

  function changeReaderFontSize(nextValue) {
    setReaderFontSize(saveReaderFontSize(window.localStorage, nextValue));
  }

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
        <div className="header-main">
          <button className="brand" onClick={() => navigate("/")} aria-label="Torna alla home">
            <span>ACCORDI</span><b>&amp;</b><span>SPARTITI</span>
          </button>
          <form className="search" onSubmit={handleSearch}>
            <input aria-label="Cerca una canzone o un artista" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca una canzone o un artista…" />
            <button type="submit" disabled={page.status === "searching"} aria-label={page.status === "searching" ? "Ricerca in corso" : "Cerca"}>
              <SearchIcon />
            </button>
          </form>
        </div>
        <nav className="site-nav" aria-label="Navigazione principale">
          {NAV_ITEMS.map(([label, href]) => {
            const active = isNavItemActive(path, href);
            return (
              <button className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} key={href} onClick={() => navigate(href)}>
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="layout" id="main-content">
        <section className="reader-panel">
          <div className="reader-meta">
            <div className="reader-meta-lead">
              <ReaderIcon />
              <span>Lettore senza interruzioni</span>
              <span className={`connection-status ${online ? "is-online" : "is-offline"}`}>
                <i aria-hidden="true" />{online ? "Online" : "Offline"}
              </span>
            </div>
            <a href={`${SOURCE_ORIGIN}${path}`} target="_blank" rel="noreferrer">Apri originale <ExternalIcon /></a>
          </div>
          {isChordPage && page.status === "ready" ? (
            <div className="music-toolbar" aria-label="Strumenti per gli accordi">
              <div className="toolbar-group toolbar-transpose" aria-label="Traspositore">
                <span className="toolbar-label">Traspositore</span>
                <button className="toolbar-square" disabled={transpose <= -6} onClick={() => changeTranspose(transpose - 1)} aria-label="Abbassa di un semitono">−</button>
                <strong className="toolbar-value transpose-value">{transpose > 0 ? `+${transpose}` : transpose}</strong>
                <button className="toolbar-square" disabled={transpose >= 6} onClick={() => changeTranspose(transpose + 1)} aria-label="Alza di un semitono">+</button>
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
                  <PlayIcon paused={autoScroll} /><span>{autoScroll ? "Ferma auto-scroll" : "Auto-scroll"}</span>
                </button>
                <button className="toolbar-action" onClick={() => window.print()}><PrintIcon /><span>Stampa</span></button>
                <button className="toolbar-action pdf-button" disabled={pdfState.status === "preparing"} onClick={handlePdf}>
                  <DownloadIcon /><span>{pdfState.status === "preparing" ? "Creo PDF…" : pdfState.status === "ready" ? "Salva PDF" : "Scarica PDF"}</span>
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
            <article className="source-content" onClick={handleContentClick}>
              {page.song.contentBlocks.map((block, index) => block.type === "music" ? (
                <ChordSheet block={page.song.musicBlocks[block.musicIndex]} fontSize={readerFontSize} transpose={transpose} key={`${path}-music-${block.musicIndex}`} />
              ) : (
                <div className="source-html-block" dangerouslySetInnerHTML={{ __html: block.html }} key={`html-${index}`} />
              ))}
            </article>
          ) : null}
        </section>
        <aside className="side-panel">
          <section className="side-card removed-card">
            <div className="side-card-heading"><span className="side-icon"><RemovedIcon /></span><h2>Cosa viene rimosso</h2></div>
            <ul>
              <li>Immagini, video e contenuti incorporati</li>
              <li>Popup, overlay e newsletter</li>
              <li>Pubblicità, consenso e tracciatori</li>
            </ul>
            <p className="offline-summary"><span><CheckIcon /></span><span><strong>{savedPages.length}</strong> {savedPages.length === 1 ? "brano disponibile" : "brani disponibili"} offline su questo dispositivo.</span></p>
          </section>
          <section className="side-card recent-card">
            <div className="side-card-heading"><span className="side-icon"><BookmarkIcon /></span><h2>Salvati di recente</h2></div>
            {savedPages.length ? (
              <div className="saved-pages">
                {savedPages.slice(0, 5).map((item) => (
                  <button key={item.path} onClick={() => navigate(item.path)}><span>{item.title}</span><ChevronIcon /></button>
                ))}
              </div>
            ) : <p className="empty-saved">I brani aperti compariranno qui e resteranno disponibili offline.</p>}
          </section>
          <section className="side-card install-card">
            <div className="side-card-heading"><span className="side-icon"><PhoneIcon /></span><h2>Installa su iPhone</h2></div>
            <p>Apri in Safari, tocca Condividi e poi <strong>“Aggiungi alla schermata Home”.</strong></p>
          </section>
        </aside>
      </main>
    </div>
  );
}
