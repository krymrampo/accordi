import { useEffect, useMemo, useRef, useState } from "react";

const SOURCE_ORIGIN = "https://www.accordiespartiti.it";
const SAVED_PAGES_KEY = "accordi-clean:saved-pages";
const PAGE_CACHE = "accordi-pages-v1";
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

function searchSavedPages(savedPages, term) {
  const normalized = term.trim().toLocaleLowerCase("it");
  if (!normalized) return [];
  return savedPages.filter((item) => `${item.title} ${item.path}`.toLocaleLowerCase("it").includes(normalized));
}

function toLocalPath(href) {
  try {
    const url = new URL(href, SOURCE_ORIGIN);
    if (url.origin !== SOURCE_ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function safeExternalHref(href) {
  try {
    const url = new URL(href, SOURCE_ORIGIN);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function prepareContent(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const unwanted = [
    "script", "style", "noscript", "ins", "form", "footer", "header", "nav", "button",
    ".adv", ".tfp-adv", ".ezoic-adpicker-ad", ".promo", ".comments-area",
    "#tools", "#tools-responsive", "#autoscroll-responsive", ".second-row",
    "[id*='cookie' i]", "[id*='consent' i]", "[id*='popup' i]", "[id*='modal' i]",
    "iframe:not([src*='youtube.com']):not([src*='youtu.be'])",
  ];
  doc.querySelectorAll(unwanted.join(",")).forEach((node) => node.remove());

  const content = doc.querySelector("#content .post-content")
    || doc.querySelector("#content")
    || doc.querySelector("article, main, .site-content, .content")
    || doc.body;
  content.querySelectorAll("aside, .sidebar, [role='dialog']").forEach((node) => node.remove());
  content.querySelectorAll("h1, h2, h3, h4").forEach((heading) => {
    if (/lascia un commento|commenti/i.test(heading.textContent || "")) heading.remove();
  });

  content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (attribute.name.startsWith("on") || attribute.name === "style" || attribute.name === "srcset") {
        node.removeAttribute(attribute.name);
      }
    });
  });

  content.querySelectorAll("a[href]").forEach((link) => {
    const rawHref = link.getAttribute("href");
    const localPath = toLocalPath(rawHref);
    if (localPath) {
      link.setAttribute("href", localPath);
      link.dataset.local = "true";
    } else {
      const externalHref = safeExternalHref(rawHref);
      if (externalHref) {
        link.setAttribute("href", externalHref);
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      } else {
        link.removeAttribute("href");
      }
    }
  });

  content.querySelectorAll("a[href*='chitarrafacile.com']").forEach((link) => {
    link.remove();
  });

  content.querySelectorAll("img[src]").forEach((image) => {
    const source = new URL(image.getAttribute("src"), SOURCE_ORIGIN).href;
    image.setAttribute("src", `/api/asset?src=${encodeURIComponent(source)}`);
    image.setAttribute("loading", "lazy");
  });

  content.querySelectorAll("iframe[src]").forEach((frame) => {
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("allowfullscreen", "true");
  });

  return {
    html: content.innerHTML,
    title: content.querySelector("h1")?.textContent?.trim() || doc.title || "Accordi e Spartiti",
  };
}

function transposeChord(value, delta) {
  const notes = ["DO", "DO#", "RE", "RE#", "MI", "FA", "FA#", "SOL", "SOL#", "LA", "LA#", "SI"];
  const normalized = value.replace("Db", "DO#").replace("Eb", "RE#").replace("Gb", "FA#").replace("Ab", "SOL#").replace("Bb", "LA#");
  return normalized.replace(/(^|\s)(DO#?|RE#?|MI|FA#?|SOL#?|LA#?|SI)([A-Za-z0-9/#()+-]*)(?=\s|$)/g, (_match, lead, note, suffix) => {
    const index = notes.indexOf(note);
    return index === -1 ? `${lead}${note}${suffix}` : `${lead}${notes[(index + delta + 12) % 12]}${suffix}`;
  });
}

export function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.href));
  const [page, setPage] = useState({ status: "loading", html: "", title: "" });
  const [query, setQuery] = useState("");
  const [transpose, setTranspose] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [savedPages, setSavedPages] = useState(() => readSavedPages());
  const contentRef = useRef(null);

  const isChordPage = useMemo(() => path.startsWith("/accordi/"), [path]);

  function navigate(nextPath) {
    const cleanPath = normalizePath(nextPath);
    window.history.pushState({}, "", cleanPath);
    setPath(cleanPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
    setPage({ status: "loading", html: "", title: "" });
    setTranspose(0);
    const searchTerm = new URLSearchParams(path.split("?")[1] || "").get("s") || "";
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
        const prepared = prepareContent(html);
        document.title = `${prepared.title} · Lettore pulito`;
        setPage({ status: "ready", ...prepared });
        setSavedPages(rememberSavedPage(path, prepared.title));
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (searchTerm) {
          setPage({ status: "local-search", html: "", title: `Risultati salvati per “${searchTerm}”`, matches: localMatches });
          return;
        }
        setPage({ status: "error", html: "", title: error.message });
      });
    return () => controller.abort();
  }, [path]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || !isChordPage) return;
    container.querySelectorAll("pre").forEach((node) => {
      const original = node.dataset.originalChordText || node.textContent;
      node.dataset.originalChordText = original;
      node.textContent = transposeChord(original, transpose);
    });
  }, [page.html, isChordPage, transpose]);

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
    navigate(`/?s=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="app-shell">
      <div className="source-note">
        <span>Versione pulita · le pagine aperte vengono salvate sul dispositivo</span>
        <strong className={online ? "online" : "offline"}>{online ? "Online" : "Offline"}</strong>
      </div>
      <header className="site-header">
        <button className="brand" onClick={() => navigate("/")} aria-label="Torna alla home">
          <span>ACCORDI</span><b>&amp;</b><span>SPARTITI</span>
        </button>
        <form className="search" onSubmit={handleSearch}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca una canzone o un artista..." />
          <button type="submit">Cerca</button>
        </form>
      </header>
      <nav className="site-nav" aria-label="Navigazione principale">
        {NAV_ITEMS.map(([label, href]) => <button key={href} onClick={() => navigate(href)}>{label}</button>)}
        <a href="https://www.youtube.com/channel/UCmvZB6boJyLkexCTmRWU6bA" target="_blank" rel="noreferrer">YouTube</a>
      </nav>

      <main className="layout">
        <section className="reader-panel">
          <div className="reader-meta">
            <span>lettore senza interruzioni</span>
            <a href={`${SOURCE_ORIGIN}${path}`} target="_blank" rel="noreferrer">Apri originale</a>
          </div>
          {isChordPage && page.status === "ready" ? (
            <div className="music-toolbar" aria-label="Strumenti per gli accordi">
              <span>Traspositore</span>
              <button onClick={() => setTranspose((value) => value - 1)} aria-label="Abbassa di un semitono">−</button>
              <strong>{transpose > 0 ? `+${transpose}` : transpose}</strong>
              <button onClick={() => setTranspose((value) => value + 1)} aria-label="Alza di un semitono">+</button>
              <button className={autoScroll ? "is-active" : ""} onClick={() => setAutoScroll((value) => !value)}>{autoScroll ? "Ferma auto-scroll" : "Auto-scroll"}</button>
              <button onClick={() => window.print()}>Stampa</button>
            </div>
          ) : null}
          {page.status === "loading" ? <div className="loading">Caricamento della pagina pulita…</div> : null}
          {page.status === "error" ? <div className="error">{page.title}. Riprova tra poco.</div> : null}
          {page.status === "local-search" ? (
            <section className="local-results">
              <p className="eyebrow">Ricerca offline</p>
              <h1>{page.title}</h1>
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
            <article ref={contentRef} className="source-content" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: page.html }} />
          ) : null}
        </section>
        <aside className="side-panel">
          <h2>Cosa viene rimosso</h2>
          <ul>
            <li>Banner e iframe pubblicitari</li>
            <li>Popup, overlay e newsletter</li>
            <li>Consenso invasivo e tracciatori</li>
          </ul>
          <p><strong>{savedPages.length}</strong> {savedPages.length === 1 ? "brano disponibile" : "brani disponibili"} offline su questo dispositivo.</p>
          {savedPages.length ? (
            <div className="saved-pages">
              <h3>Salvati di recente</h3>
              {savedPages.slice(0, 5).map((item) => (
                <button key={item.path} onClick={() => navigate(item.path)}>{item.title}</button>
              ))}
            </div>
          ) : null}
          <div className="install-note">
            <h3>Installa su iPhone</h3>
            <p>Apri in Safari, tocca Condividi e poi “Aggiungi alla schermata Home”.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
