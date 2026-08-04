# Sitewide Link and Resource Audit

## Summary

- Audit date: 2026-08-04
- Public HTML pages: 41
- Indexable pages: 40
- English pages: 21 (including the shared `404.html`)
- Chinese pages: 20
- Internal links checked: 1,876
- Internal resources checked: 881
- Fragments checked: 60
- CSS references checked: 2
- Form/API paths checked: 2
- Sitemap URLs: 40
- Broken internal links before repair: 0
- Broken internal links after repair: 0
- Broken resources before repair: 0
- Broken resources after repair: 0
- Invalid fragments before repair: 0
- Invalid fragments after repair: 0
- Orphan pages: 0
- External links: 2 unique HTTP(S) URLs (special-protocol links are classified separately)
- External links not verified: 2
- Validation failures: 0

Discovery used `git ls-files`; counts are derived from the current tracked tree rather than hard-coded page lists. The audit found no confirmed content defect requiring an HTML, CSS, JavaScript, PHP, sitemap, or robots correction.

## Corrected Issues

| Source | Element/Attribute | Original URL | Resolved Target | Problem | Correction | Status |
| --- | --- | --- | --- | --- | --- | --- |
| None | — | — | — | No deterministic broken content links or assets found | No content change made | Pass |

## Internal Page Links

The checker prints source, element/attribute, original URL, resolved repository target, query, fragment, existence, and result for failures. All 1,876 internal link occurrences resolved successfully.

| Source Page | URL | Resolved Page | Exists | Language | Fragment | Result |
| --- | --- | --- | --- | --- | --- | --- |
| All 41 public pages | Local, production-domain, and preview-domain URLs | Tracked HTML targets | Yes | English/Chinese | Valid when present | Pass |

## Static Resources

| Source | Attribute | Resource | Resolved File | Exists | Case Match | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Public HTML and tracked CSS | `src`, `srcset`, `href`, `poster`, `data`, CSS `url()`/`@import` | 881 HTML and 2 CSS references | Tracked repository files | Yes | Yes | Pass |

Unreferenced assets were not deleted. Responsive image variants are retained because generated variants may be consumed through complex markup or tooling.

## Fragment Validation

| Source | Link | Target Page | Fragment | Target ID Exists | Result |
| --- | --- | --- | --- | --- | --- |
| Public HTML pages | 60 fragment-bearing hyperlinks | Current or cross-page HTML | Case-sensitive decoded ID | Yes | Pass |

JSON-LD hash identifiers such as `#organization` and `#webpage` were treated as structured-data node identifiers, not DOM anchors.

## Language Pairing

| English Page | Chinese Page | hreflang | Language Switch | Result |
| --- | --- | --- | --- | --- |
| 20 indexable English pages | Corresponding `zh/` path for each page | Targets exist | Same route/slug targets exist | Pass |

The shared English `404.html` is intentionally excluded from pair enforcement; no Chinese 404 page was added. Canonical, `en`, `zh-CN`, and `x-default` internal targets resolve to tracked pages.

## Sitemap Parity

| Page | Indexable | In Sitemap | Canonical Match | Result |
| --- | --- | --- | --- | --- |
| 40 canonical public pages | Yes | Yes | Yes | Pass |
| `404.html` | No | No | Not applicable | Pass |

All sitemap locations use the HTTPS `www.weixingmachinery.com` production origin. There are no duplicate, missing, stale, or non-indexable locations. `robots.txt` declares the production HTTPS sitemap and does not block the public language or asset trees.

## Orphan Pages

| Page | Language | Inbound Internal Links | Current Entry | Fixed | Notes |
| --- | --- | ---: | --- | --- | --- |
| None | — | — | Product/guide listings and language navigation provide entry paths | No repair needed | No indexable orphan or dead-end page found |

## 404 Validation

All navigation and required resources in the shared 404 document use depth-independent production URLs. Static resolution was simulated; no browser navigation was claimed.

| Simulated URL | Header | Mobile Menu | CTA | Footer | CSS | JavaScript | Logo | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `https://www.weixingmachinery.com/missing/` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| `https://www.weixingmachinery.com/a/b/missing/` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| `https://www.weixingmachinery.com/products/a/b/missing/` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| `https://www.weixingmachinery.com/zh/a/b/missing/` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| `https://sundaylee3100-ljl.github.io/weixing-machinery-website/missing/` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| `https://sundaylee3100-ljl.github.io/weixing-machinery-website/a/b/missing/` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Pass |

## External Links

External HTTP validation was not executed.

- Verified: none (network mode was not run)
- Redirected: none
- Unverified: 2 unique HTTP(S) URLs
- Failed: none

The default deterministic audit classifies external and special-protocol URLs without making CI depend on the network. Optional checks are exposed through `npm run check:links:external`; inaccessible, throttled, or blocked hosts remain warnings.

## Out-of-Scope Findings

- No binary or image files were changed, generated, or removed.
- No browser click testing, live HTTP crawling, form submission, email, or attachment upload was performed.
- Dynamic runtime-generated endpoints require runtime validation and are not converted into deterministic failures.
- Protected visible copy, SEO copy, headings, metadata text, alt text, structured-data text, contact details, RFQ/security logic, layout, and visual CSS were not modified.
