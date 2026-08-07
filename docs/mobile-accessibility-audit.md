# Mobile Accessibility and Frontend Performance Audit

## Scope and static results

The audit covers every Git-managed public HTML document and uses deterministic source checks rather than a claimed lab score.

| Measure | Count |
| --- | ---: |
| Public HTML pages | 41 |
| English pages | 21 |
| Chinese pages | 20 |
| Images checked | 235 |
| Buttons checked | 221 |
| Links checked | 1,777 |
| Forms checked | 2 |
| Tables checked | 78 |
| Product galleries checked | 24 |
| Accessibility errors before | 271 |
| Accessibility errors after | 0 |

“Before” is the strengthened checker's deterministic result against the previous PR head. It includes malformed table markup, scope-context errors, and duplicate attributes that the original checker missed. “After” is the same checker against the corrected change. The count is not a browser accessibility score.

## Changes

### Mobile menu and navigation

All desktop and mobile navigation landmarks now have language-appropriate distinct names. Menu triggers expose `aria-controls`, `aria-expanded`, and an action-specific accessible name; the closed menu is `aria-hidden` and `inert`. JavaScript synchronizes every state, moves focus to the first menu link on open, closes on link activation or Escape, returns focus after Escape, clears the body scroll lock, and resets an open menu above the mobile breakpoint. Active desktop, mobile, and language links expose `aria-current="page"`.

### Galleries

The 24 English and Chinese product galleries are named regions. The current image and dot are exposed through synchronized `aria-hidden` and `aria-current` values. Previous, Next, dot, ArrowLeft, ArrowRight, Home, and End interactions remain available. The four-second `setInterval` autoplay was removed, so galleries change only after user input.

### Reduced motion, focus, and touch

The shared script detects `prefers-reduced-motion: reduce`: counters render their final value without animation, fade-in content is immediately visible, and anchor scrolling uses `auto`. The shared stylesheet also minimizes animation and transition duration without hiding content. A consistent three-pixel orange `:focus-visible` outline covers links, buttons, form fields, summaries, and tabindex targets. Skip links appear above the header on focus. Gallery dot buttons now provide approximately 44 by 44 CSS-pixel hit areas while retaining a small visual dot; existing menu and floating WhatsApp controls retain at least 44-pixel targets.

### Images, forms, tables, and landmarks

All checked images retain their existing alt text, dimensions, responsive sources, loading priorities, and gallery order. Every page now has one `main#main-content` target and a localized skip link. RFQ upload controls have explicit labels and `aria-describedby` help associations; existing required attributes and polite live status regions remain unchanged. Table header cells now use `scope="col"` inside `thead` and `scope="row"` for existing row headers inside `tbody`, without changing technical data. The malformed `th` elements that had accidentally replaced `thead` opening tags were restored across all public pages.

### Icon names and decorative graphics

Floating WhatsApp links have localized accessible names. Decorative inline SVGs are hidden from assistive technology with `aria-hidden="true"` and `focusable="false"`, avoiding duplicate icon announcements.

### Contrast

The confirmed `--text-muted` on white combination changed from `#999999` (2.85:1) to `#6B6B6B` (5.33:1), meeting WCAG AA for normal text. The calculation used WCAG relative luminance against `#FFFFFF`. Brand backgrounds and the primary `#0F2640` color were not changed.

## Automated safeguards

`scripts/check-accessibility.mjs` uses only Node.js standard-library modules and discovers Git-managed HTML. It checks language, heading count, image alternatives, control/link names, safe new-window links, mobile-menu ARIA, named navigation, current links, main and skip-link targets, IDs, form labels and references, gallery state, tabindex, unsafe/empty href values, and ARIA ID references. Table checks now validate balanced and ordered `thead`/`tbody` structure, context-aware `th` scope, malformed attribute boundaries, and case-insensitive duplicate attributes. Its fixture suite covers 20 exact failure categories plus four valid page/table-context cases, including valid English and Chinese pages.

The product image optimizer now identifies `product-gallery` and `gallery-dots` by class token rather than requiring an exact opening tag. It recognizes all 24 localized product pages and 60 unique source images while preserving gallery region ARIA, image visibility state, dot current state, responsive candidates, loading priority, intrinsic dimensions, and alt text. Two consecutive optimizer runs produced no substantive HTML or binary-image changes.

## Performance and protected content

Responsive 768/1280/1600 WebP hero candidates, 480-pixel product candidates, first-gallery-image priority, lazy loading for later gallery images, intrinsic image dimensions, and end-of-body shared scripts remain in place. No font, third-party JavaScript, dependency, image, compression setting, or render-blocking resource was added.

Titles, meta descriptions, canonical and hreflang links, Open Graph and Twitter metadata, JSON-LD, H1/H2 text, product parameters, FAQs, product and hero images, alt text, logo, favicon, RFQ field names/actions/business logic, PHP, SMTP, contact details, sitemap, robots, `.htaccess`, brand primary colors, layout, and font stack were not intentionally changed.

Lighthouse/PageSpeed score was not claimed unless an actual browser Lighthouse run was executed. No browser Lighthouse run was executed for this audit.
