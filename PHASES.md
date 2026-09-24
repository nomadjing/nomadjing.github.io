# Implementation status

## Phase 1 — complete

- Recursive Markdown scan, Frontmatter, strict `publish: true`, HTML templates, responsive minimal CSS, and local build.
- `site.config.json` reads the sibling `../Nomad` vault; `CONTENT_ROOT` overrides it and `content/` is the fallback when the vault has no published notes.
- Three public examples plus one unpublished privacy fixture are included.

## Phase 2 — complete

- WikiLinks (including aliases), broken-link warnings, public-only backlinks, KaTeX, Mermaid, tags, breadcrumbs, and generated directory trees.

## Phase 3 — complete

- About and Now support, current-work summary, recently updated notes, and a searchable archive of published notes in their original folder structure.

## Phase 6 — partially complete

- The public-content terminal is available from the navigation and homepage, with a `coffee` command for a small randomized easter egg.
- Other enhancements remain intentionally deferred.

Full-text search and deployment are intentionally not implemented yet.
