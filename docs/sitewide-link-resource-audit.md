# Sitewide Link and Resource Audit

## Summary

- Audit date: 2026-08-06
- Public HTML pages: 41
- Indexable pages: 40
- English pages: 21 (including the shared 404)
- Chinese pages: 20
- Internal page/SEO URL references checked: 2,036
- HTML resource references checked: 721
- Fragments checked: 60
- CSS references checked: 2
- HTML form paths checked: 2
- Static JavaScript URL literals checked: 0
- Dynamic JavaScript URL dependencies: 1 (`fetch(form.action)`; its HTML action is checked separately)
- Sitemap URLs: 40
- 404 deployment simulations: 6
- Repository-missing internal links before/after repair: 0 / 0
- Repository-missing resources before/after repair: 0 / 0
- Invalid fragments before/after repair: 0 / 0
- GitHub Pages project-path-incompatible normal-page URL attributes before/after repair: 324 / 0
- Depth-dependent 404 URL attributes before/after repair: 23 / 0
- Orphan pages after graph correction: 0
- Dead-end pages after graph correction: 0
- External HTTP(S) URLs discovered: 2
- Deterministic validation failures after repair: 0

Counts above come from the latest deterministic checker output and the URL-only HTML diff. Discovery uses `git ls-files`; page totals are not hard-coded.

## Corrected Issues

| Source | Element/Attribute | Original URL | Resolved Target | Problem | Correction | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `404.html` | Navigation/resource URL attributes (23 occurrences) | Root-relative production paths such as `/favicon.ico`, `/products/`, `/zh/` | Production-domain URL | Root-relative references leave the GitHub Pages project path and are not stable for an arbitrary deployed 404 depth | Changed to `https://www.weixingmachinery.com/...` | Pass in six simulations |
| 40 normal pages | Navigation/resource URL attributes (324 occurrences) | Root-relative paths | Same tracked repository target | Production compatible, GitHub Pages project-path incompatible | Changed to page-depth-correct relative paths | Pass for repository and both deployment mappings |

No visible link text, alt text, SEO prose, structured-data prose, image, visual CSS, or JavaScript/RFQ business logic changed.

## Internal Page Links

| Scope | Resolution model | Exists | GitHub Pages project path | Result |
| --- | --- | --- | --- | --- |
| Normal public pages | Relative to each source document; query and fragment separated | All tracked targets exist with exact case | Relative URLs remain under `/weixing-machinery-website/` | Pass |
| Production SEO URLs | Mapped from `https://www.weixingmachinery.com/` to tracked files | All checked targets exist | Exempt: canonical/hreflang/OG/JSON-LD intentionally identify production | Pass |

Only cross-document `<a href>` and `<area href>` edges count toward inbound links. Self-links, same-page fragments, canonical, alternate, OG, JSON-LD, resources, 404 links, and sitemap locations do not count.

## Static Resources

| Source | Attribute | References | Repository Exists | Exact Case | Production Mapping | Preview Mapping | Result |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Public HTML | `src`, `srcset`, resource `href`, `poster`, `data` | 721 | Yes | Yes | Valid | Project-relative and valid | Pass |
| Tracked CSS | `url()` / `@import` | 2 | Yes | Yes | Valid | Valid | Pass |

This audit does **not** claim to enumerate unused resources; no unreferenced file was deleted.

## Fragment Validation

| References | Decode handling | Matching | Duplicate IDs | Result |
| ---: | --- | --- | --- | --- |
| 60 | Malformed percent encoding is reported without crashing | Decoded, case-sensitive, exactly one target ID | Checked per page | Pass |

JSON-LD hash node identifiers such as `#organization` remain structured-data identifiers and are not treated as DOM fragments.

## Language Pairing

| Requirement | Actual rule executed | Result |
| --- | --- | --- |
| One each of `en`, `zh-CN`, `x-default` | Parsed `rel` and `hreflang` independent of attribute order; missing, duplicate, empty, and unknown codes fail | Pass |
| Same route/slug | `en` maps to the English path and `zh-CN` to the corresponding `zh/` path | Pass |
| `x-default` | Must equal the paired English page | Pass |
| Canonical and OG | Exactly one canonical; canonical equals current route; when `og:url` exists it must equal canonical; duplicates fail | Pass |
| Language switch | Visible EN/中文 language controls must target the paired route | Pass |

The shared `404.html` remains excluded and no Chinese 404 page was added.

## Sitemap Parity

| Page set | Indexable | In Sitemap | Canonical Match | Result |
| --- | --- | --- | --- | --- |
| 40 public canonical pages | Yes | Exactly represented | Yes | Pass |
| `404.html` | No | No | Not applicable | Pass |

The checker rejects duplicate locations, non-production origins, missing canonical pages, and extra/non-indexable locations.

## Robots Validation

`robots.txt` is parsed into `User-agent`, `Allow`, `Disallow`, and `Sitemap` directives. The checker validates syntax, the exact HTTPS production sitemap, and rejects rules that block `/`, `/zh/`, `/products/`, `/guides/`, `/css/`, `/js/`, `/assets/`, the favicon, or sitemap. Current result: **Pass**.

## Orphan and Dead-End Pages

| Finding | Count | Graph rule | Result |
| --- | ---: | --- | --- |
| Orphan pages | 0 | Inbound edge must be an `<a>`/`<area>` from a different public non-404 page | Pass |
| Dead-end pages | 0 | At least one valid internal page outlink to a different page | Pass |
| Product/guide center reachability | All details | Each detail must be linked by its same-language center | Pass |

## 404 Validation

The checker applies `new URL(rawUrl, simulatedPageUrl)` to link, script, image, source/srcset, anchor, form, poster, object, favicon, stylesheet, logo, navigation, CTA, body-button, and Footer URL attributes. Relative or root-relative 404 references fail; stable production-domain absolute URLs pass.

| Simulated URL | URL construction | Project-path escape | Required target stability | Result |
| --- | --- | --- | --- | --- |
| `https://www.weixingmachinery.com/missing/` | Executed | None | Production absolute | Pass |
| `https://www.weixingmachinery.com/a/b/missing/` | Executed | None | Production absolute | Pass |
| `https://www.weixingmachinery.com/products/a/b/missing/` | Executed | None | Production absolute | Pass |
| `https://www.weixingmachinery.com/zh/a/b/missing/` | Executed | None | Production absolute | Pass |
| `https://sundaylee3100-ljl.github.io/weixing-machinery-website/missing/` | Executed | None | Redirects deliberately to stable production targets | Pass |
| `https://sundaylee3100-ljl.github.io/weixing-machinery-website/a/b/missing/` | Executed | None | Redirects deliberately to stable production targets | Pass |

## Form and JavaScript URLs

- Two local HTML `form action` attributes resolve to tracked PHP endpoints.
- No statically determinable `fetch("literal")`, XHR `.open(..., "literal")`, `new URL("literal", ...)`, or literal location assignment is present.
- `js/contact-rfq.js` contains `fetch(form.action)`. It is recorded as a **dynamic runtime dependency**, not falsely reported as a directly verified JavaScript URL; the referenced HTML form actions are independently checked.
- No form, email, or upload was submitted.

## External Links

External HTTP validation was not executed. The deterministic scan checks `target="_blank"` for both `noopener` and `noreferrer`, validates WhatsApp syntax, and validates `mailto:`, `tel:`, `javascript:`, and empty-fragment forms. Two unique external HTTP(S) URLs were discovered and remain network-unverified.

## Checker Mutation Tests

Twenty standard-library tests include 18 failing mutations plus dynamic-runtime and fully valid fixtures. They prove detection of missing pages/assets, fragments, duplicate IDs, hreflang/canonical errors, sitemap parity, robots blocking, 404 links, invalid `/zh/assets/`, JavaScript links, unsafe blank targets, self-only orphans, both 404 deployment failure modes, malformed encoding, and runtime `fetch(form.action)` classification.

## Out-of-Scope / Not Executed

- No browser click test, live deployment fetch, external HTTP validation, real form submission, email, or attachment upload was performed.
- Repository existence and static URL resolution do not claim that a production web server returned HTTP 200.
- Unreferenced-resource inventory was not computed and is not claimed.
