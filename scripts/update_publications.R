# =============================================================================
# Met à jour data/publications.json : métriques Google Scholar (profil + par
# article), résumés et BibTeX de chaque DOI cité dans publications.qmd.
#
#   Rscript scripts/update_publications.R            # métriques seulement
#   Rscript scripts/update_publications.R --refresh  # re-télécharge aussi
#                                                     # résumés et BibTeX
#
# Résumés et BibTeX sont mis en cache : seuls les nouveaux DOI sont interrogés.
# Si Google Scholar refuse la requête, les métriques précédentes sont gardées.
# Ensuite : quarto render publications.qmd
# =============================================================================

suppressPackageStartupMessages({
  library(scholar)
  library(jsonlite)
  library(httr)
})

scholar_id <- "p-N6-8YAAAAJ"
qmd_file   <- "publications.qmd"
out_file   <- "data/publications.json"
refresh    <- "--refresh" %in% commandArgs(trailingOnly = TRUE)
ua         <- user_agent("abodein.github.io (mailto:bodein.antoine@gmail.com)")

norm_title <- function(x) tolower(gsub("[^[:alnum:]]", "", iconv(x, to = "ASCII//TRANSLIT")))

# --- DOI listés dans la page ------------------------------------------------
qmd  <- paste(readLines(qmd_file, warn = FALSE), collapse = "\n")
dois <- regmatches(qmd, gregexpr("https?://(dx\\.)?doi\\.org/[^[:space:]>)]+", qmd))[[1]]
dois <- unique(tolower(sub("^https?://(dx\\.)?doi\\.org/", "", dois)))
message(length(dois), " DOI trouvés dans ", qmd_file)

old <- if (file.exists(out_file)) fromJSON(out_file, simplifyVector = FALSE) else list()
old_pubs <- old$publications %||% list()

# --- Résumé : Crossref, sinon OpenAlex (index inversé) ----------------------
clean_abstract <- function(x) {
  x <- gsub("<[^>]+>", " ", x)                          # balises JATS
  x <- gsub("^\\s*(Abstract|ABSTRACT)\\s*", "", x)
  x <- gsub("\\s+", " ", x)
  trimws(x)
}

fetch_crossref <- function(doi) {
  r <- GET(paste0("https://api.crossref.org/works/", URLencode(doi, reserved = TRUE)), ua, timeout(20))
  if (status_code(r) != 200) return(NULL)
  content(r, as = "parsed", simplifyVector = FALSE)$message
}

fetch_openalex_abstract <- function(doi) {
  r <- GET(paste0("https://api.openalex.org/works/doi:", doi), ua, timeout(20))
  if (status_code(r) != 200) return(NA_character_)
  inv <- content(r, as = "parsed", simplifyVector = FALSE)$abstract_inverted_index
  if (is.null(inv)) return(NA_character_)
  pos   <- unlist(lapply(names(inv), function(w) setNames(unlist(inv[[w]]), rep(w, length(inv[[w]])))))
  words <- names(pos)[order(pos)]
  paste(words, collapse = " ")
}

# --- BibTeX : négociation de contenu doi.org, une ligne par champ ------------
fetch_bibtex <- function(doi) {
  r <- GET(paste0("https://doi.org/", doi), ua, add_headers(Accept = "application/x-bibtex"), timeout(20))
  if (status_code(r) != 200) return(NA_character_)
  b <- trimws(content(r, as = "text", encoding = "UTF-8"))
  # Clé DataCite = URL du DOI : on la remplace par Titre_Année.
  if (grepl("^@\\w+\\{https?://", b)) {
    t <- sub(".*title\\s*=\\s*\\{([^}]+)\\}.*", "\\1", b)
    y <- sub(".*year\\s*=\\s*\\{?(\\d{4}).*", "\\1", b)
    b <- sub("^(@\\w+\\{)[^,]+,", paste0("\\1", gsub("\\W", "", t), "_", y, ","), b)
  }
  b <- sub("^(@\\w+\\{[^,]+,)\\s*", "\\1\n  ", b)
  b <- gsub("\\},\\s+(?=[a-zA-Z]+=)", "},\n  ", b, perl = TRUE)
  b <- gsub(",\\s+(month=\\w+),\\s*", ",\n  \\1,\n  ", b)
  sub("\\s*\\}$", "\n}", b)
}

pubs <- lapply(dois, function(doi) {
  prev <- old_pubs[[doi]] %||% list()
  p <- prev
  p$doi <- doi
  if (refresh || is.null(prev$title) || is.null(prev$abstract) || is.null(prev$bibtex)) {
    message("  métadonnées : ", doi)
    cr <- tryCatch(fetch_crossref(doi), error = function(e) NULL)
    p$title <- if (!is.null(cr$title)) clean_abstract(cr$title[[1]]) else prev$title %||% NA_character_
    abs <- if (!is.null(cr$abstract)) clean_abstract(cr$abstract) else NA_character_
    if (is.na(abs) || nchar(abs) < 50) abs <- tryCatch(fetch_openalex_abstract(doi), error = function(e) NA_character_)
    p$abstract <- if (!is.na(abs)) abs else prev$abstract %||% NA_character_
    bib <- tryCatch(fetch_bibtex(doi), error = function(e) NA_character_)
    p$bibtex <- if (!is.na(bib)) bib else prev$bibtex %||% NA_character_
    Sys.sleep(0.3)
  }
  p
})
names(pubs) <- dois

# --- Google Scholar : profil et citations par article -----------------------
profile <- old$profile
sch <- tryCatch({
  prof <- get_profile(scholar_id)
  list(prof = prof,
       hist = get_citation_history(scholar_id),
       pubs = get_publications(scholar_id))
}, error = function(e) { message("Google Scholar indisponible : ", conditionMessage(e)); NULL })

if (!is.null(sch)) {
  profile <- list(
    total_cites = sch$prof$total_cites,
    h_index     = sch$prof$h_index,
    i10_index   = sch$prof$i10_index,
    history     = unname(lapply(seq_len(nrow(sch$hist)), function(i)
                    list(year = sch$hist$year[i], cites = sch$hist$cites[i]))),
    url         = paste0("https://scholar.google.com/citations?user=", scholar_id)
  )
  keys <- norm_title(sch$pubs$title)
  for (doi in dois) {
    t <- pubs[[doi]]$title
    if (is.null(t) || is.na(t)) next
    i <- match(norm_title(t), keys)
    if (is.na(i)) { message("  pas de correspondance Scholar : ", t); next }
    h <- tryCatch(get_article_cite_history(scholar_id, sch$pubs$pubid[i]), error = function(e) NULL)
    pubs[[doi]]$scholar <- list(
      pubid   = sch$pubs$pubid[i],
      cites   = sch$pubs$cites[i],
      url     = paste0("https://scholar.google.com/citations?view_op=view_citation&user=",
                       scholar_id, "&citation_for_view=", scholar_id, ":", sch$pubs$pubid[i]),
      history = if (is.null(h) || nrow(h) == 0) list() else
        unname(lapply(seq_len(nrow(h)), function(j) list(year = h$year[j], cites = h$cites[j])))
    )
    Sys.sleep(1)                                         # ménager Scholar
  }
}

dir.create(dirname(out_file), showWarnings = FALSE)
write_json(list(updated = format(Sys.Date()), profile = profile, publications = pubs),
           out_file, auto_unbox = TRUE, pretty = TRUE, na = "null")
message("Écrit : ", out_file)
