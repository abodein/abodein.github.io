// Cartes de publication dépliables : résumé à gauche, citations à droite,
// bouton « Cite » qui ouvre le BibTeX. Données : data/publications.json,
// injecté dans la page (#pub-data) par publications.qmd.
(function () {
  const src = document.getElementById("pub-data");
  if (!src) return;
  const pubs = JSON.parse(src.textContent).publications || {};
  const SVG = "http://www.w3.org/2000/svg";

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Barres SVG : citations par année, valeur au-dessus, année dessous.
  function barplot(history) {
    const W = 260, H = 120, top = 16, bottom = 18, gap = 4;
    const max = Math.max(1, ...history.map(h => h.cites));
    const bw = (W - gap * (history.length - 1)) / history.length;
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "pub-bars");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Citations per year: " +
      history.map(h => `${h.year}: ${h.cites}`).join(", "));
    history.forEach((h, i) => {
      const x = i * (bw + gap), bh = (H - top - bottom) * h.cites / max;
      const y = H - bottom - bh;
      const r = document.createElementNS(SVG, "rect");
      Object.entries({ x, y, width: bw, height: Math.max(bh, h.cites ? 1 : 0), rx: 2 })
        .forEach(([k, v]) => r.setAttribute(k, v));
      const partial = h.year === new Date().getFullYear();
      if (partial) r.setAttribute("class", "partial");
      const t = document.createElementNS(SVG, "title");
      t.textContent = `${h.year}: ${h.cites} citations` + (partial ? " (year in progress)" : "");
      r.appendChild(t);
      svg.appendChild(r);
      const lab = (txt, ty, cls) => {
        const n = document.createElementNS(SVG, "text");
        n.setAttribute("x", x + bw / 2); n.setAttribute("y", ty);
        n.setAttribute("class", cls); n.textContent = txt;
        svg.appendChild(n);
      };
      if (h.cites) lab(h.cites, y - 4, "pub-bar-val");
      lab(history.length > 8 ? String(h.year).slice(2) : h.year, H - 4, "pub-bar-year");
    });
    return svg;
  }

  // --- Fenêtre BibTeX (une seule, partagée) --------------------------------
  const dlg = el("dialog", "bib-dialog");
  dlg.setAttribute("aria-labelledby", "bib-title");
  dlg.innerHTML = `
    <div class="bib-head"><h5 id="bib-title">Cite</h5>
      <button type="button" class="bib-close" aria-label="Close">&times;</button></div>
    <pre class="bib-code"><code></code></pre>
    <div class="bib-actions">
      <button type="button" class="pub-btn bib-copy">Copy</button>
      <a class="pub-btn bib-download" download="citation.bib">Download .bib</a>
    </div>`;
  document.body.appendChild(dlg);
  const code = dlg.querySelector("code");
  const copyBtn = dlg.querySelector(".bib-copy");
  const dl = dlg.querySelector(".bib-download");
  dlg.querySelector(".bib-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(code.textContent).then(() => {
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    });
  });
  function openBib(p) {
    code.textContent = p.bibtex;
    const key = (p.bibtex.match(/^@\w+\{([^,]+),/) || [, "citation"])[1];
    if (dl.href) URL.revokeObjectURL(dl.href);
    dl.href = URL.createObjectURL(new Blob([p.bibtex + "\n"], { type: "application/x-bibtex" }));
    dl.download = key + ".bib";
    dlg.showModal();
  }

  // --- Panneau de détails --------------------------------------------------
  function details(p) {
    const box = el("div", "pub-details");
    const grid = el("div", "pub-details-grid");

    const left = el("div", "pub-abstract");
    left.appendChild(el("div", "pub-details-label", "Abstract"));
    if (p.abstract) {
      const txt = el("p", "pub-abstract-text clamped", p.abstract);
      left.appendChild(txt);
      const more = el("button", "pub-more", "Show more");
      more.type = "button";
      more.addEventListener("click", () => {
        const open = txt.classList.toggle("clamped");
        more.textContent = open ? "Show more" : "Show less";
      });
      left.appendChild(more);
      // Pas de bouton si le texte tient déjà dans les lignes visibles.
      requestAnimationFrame(() => {
        if (txt.scrollHeight <= txt.clientHeight + 2) more.hidden = true;
      });
    } else {
      left.appendChild(el("p", "pub-muted", "No abstract available."));
    }
    grid.appendChild(left);

    const right = el("div", "pub-metrics");
    const s = p.scholar;
    if (s) {
      right.appendChild(el("div", "pub-details-label", "Citations"));
      const n = el("div", "pub-cites");
      n.appendChild(el("span", "pub-cites-value", s.cites));
      n.appendChild(el("span", "pub-cites-unit", " total"));
      right.appendChild(n);
      if (s.history && s.history.length) right.appendChild(barplot(s.history));
    } else {
      right.appendChild(el("p", "pub-muted", "No citation data."));
    }
    grid.appendChild(right);
    box.appendChild(grid);

    const actions = el("div", "pub-actions");
    if (p.bibtex) {
      const cite = el("button", "pub-btn pub-cite", "❝ Cite");
      cite.type = "button";
      cite.addEventListener("click", () => openBib(p));
      actions.appendChild(cite);
    }
    if (s && s.url) {
      const a = el("a", "pub-btn pub-btn-ghost", "Google Scholar");
      a.href = s.url; a.target = "_blank"; a.rel = "noopener";
      actions.appendChild(a);
    }
    const doi = el("a", "pub-btn pub-btn-ghost", "DOI");
    doi.href = "https://doi.org/" + p.doi; doi.target = "_blank"; doi.rel = "noopener";
    actions.appendChild(doi);
    box.appendChild(actions);
    return box;
  }

  // --- Branchement sur les cartes -----------------------------------------
  document.querySelectorAll(".pub-section li, .pkg-section li").forEach(li => {
    const link = li.querySelector('a[href*="doi.org/"]');
    if (!link) return;
    const doi = decodeURIComponent(link.getAttribute("href"))
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
    const p = pubs[doi];
    if (!p) return;

    li.classList.add("pub-card");
    if (p.scholar) {
      const badge = el("span", "pub-badge", `Cited by ${p.scholar.cites}`);
      li.insertBefore(badge, li.firstChild);
    }
    const head = li.querySelector("p") || li;
    head.setAttribute("tabindex", "0");
    head.setAttribute("role", "button");
    head.setAttribute("aria-expanded", "false");
    head.classList.add("pub-head");

    let panel = null;
    function toggle() {
      if (!panel) { panel = details(p); li.appendChild(panel); }
      const open = li.classList.toggle("open");
      panel.hidden = !open;
      head.setAttribute("aria-expanded", String(open));
    }
    li.addEventListener("click", e => {
      if (e.target.closest("a, button, .pub-details")) return;
      if (String(window.getSelection())) return;   // laisse sélectionner le texte
      toggle();
    });
    head.addEventListener("keydown", e => {
      if (e.target === head && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); }
    });
  });
})();
