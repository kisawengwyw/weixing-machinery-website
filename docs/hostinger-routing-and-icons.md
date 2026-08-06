# Hostinger routing and site icons

## Why this configuration exists

The first production health check found three deployment problems: the apex domain stopped at a non-canonical HTTPS URL instead of `https://www.weixingmachinery.com/`, missing URLs returned HTTP 404 without the repository's branded page, and the SVG favicon and Apple touch icon returned 404.

The root `.htaccess` is deployed by Hostinger Git into `public_html`. Its narrowly scoped rewrite matches only `weixingmachinery.com`, sends it to the HTTPS `www` origin with a permanent redirect, and preserves the request path and query string. It intentionally does not match previews, temporary Hostinger domains, localhost, or arbitrary non-`www` hosts.

`ErrorDocument 404 /404.html` serves the local branded document while Apache retains the real HTTP 404 status. Missing pages must not redirect to the home page.

## Icons

`favicon.svg` is a compact extraction of the two exact paths used by the embedded footer brand mark. It uses the original square viewBox and geometry, a transparent background, and brand blue `#0F2640`; it contains no text, bitmap, profile, or editor metadata.

Run `npm run images:icons` to render `apple-touch-icon.png` deterministically from that SVG with Sharp. The output is a 180×180 sRGB PNG with a white background and a centered 140×140 mark. `npm run check:icons` checks its format, dimensions, and byte-for-byte agreement with a fresh render without changing the file.

The **Optimize Homepage Images** GitHub Actions workflow runs both homepage and icon generators. For an in-repository pull request or a manual dispatch, it commits only genuine generated changes to the homepage image directory, `apple-touch-icon.png`, and (if genuinely changed) the lockfile. This workflow, rather than a hand-created or text-encoded substitute, produces the binary PNG.

Tracked public HTML pages use paths relative to their actual directory depth so the same files work at the production origin and under a GitHub Pages project path. For example, a root page uses `favicon.svg`, a first-level `index.html` uses `../favicon.svg`, and deeper pages add the necessary `../` components. The exception is `404.html`: because Apache can serve it for a missing URL at any depth, its four icon links use complete `https://www.weixingmachinery.com/` URLs. The 404 navigation links likewise remain complete production URLs.

## Deployment verification

1. Run `npm run test:hosting-config`, `npm run check:icons`, and the site link checks on the final pull-request head.
2. In Hostinger hPanel, open the site file manager and confirm that `public_html/.htaccess` exists (enable display of hidden files) and contains the exact apex rewrite and local `ErrorDocument` directive from this repository.
3. Confirm `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, and `404.html` are present in `public_html`.
4. Clear the website/cache-manager cache in hPanel and any enabled CDN cache so routing and asset changes are not masked by stale responses.
5. Test both HTTP and HTTPS apex URLs, including a path and query string, and verify the final URL uses HTTPS and `www`.
6. Request missing URLs at the root, nested, and Chinese nested paths. Confirm each response retains status 404 and displays the branded repository page.
7. Open both new icon URLs and verify their successful response types.
8. In GitHub Actions, manually re-run **Check Production Website** after Hostinger deployment and review every redirect, 404, and resource result.

The repository test reads and validates configuration text; it does not execute Apache. `.htaccess` validation is static; final behavior is verified by the production health workflow after Hostinger deployment.
