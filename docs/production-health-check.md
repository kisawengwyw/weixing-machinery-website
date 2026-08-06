# Production website health check

## Purpose and scope

The production health check is a read-only audit of `https://www.weixingmachinery.com`. It discovers indexable pages from the live sitemap and checks English/Chinese language pairs, required key pages, redirects, metadata, custom 404 behavior, contact-form endpoint availability, and every unique same-origin static resource referenced by the HTML. It also explicitly checks the site's CSS, JavaScript, logo, favicons, and Apple touch icon.

The audit recognizes common Hostinger, PHP, gateway, and GitHub Pages error bodies rather than trusting an HTTP 200 response alone. Sitemap page and unique-resource totals are reported at the end of every run.

## Safety guarantees

The checker only makes `GET` and `HEAD` requests. It does **not** execute JavaScript, carry cookies, submit RFQ forms, send email, upload files, invoke WhatsApp, read SMTP configuration, use secrets, or change production. Form endpoints are probed without query parameters or form data; no `POST` request exists in the checker. It writes no report or generated file to the repository.

## Run manually

Use Node.js 22 or newer:

```sh
npm run check:production
npm run check:production:verbose
node scripts/check-production-site.mjs --url https://www.weixingmachinery.com/products/orfs-hydraulic-fittings/
```

The single-page option is useful for diagnosis and must point to the production origin. The offline fixture suite never accesses the public internet:

```sh
npm run test:production-checker
```

## GitHub Actions

The production audit runs automatically every Monday at 02:20 UTC. After a Hostinger deployment has completed, open **Actions**, choose **Check Production Website**, and select **Run workflow** to run it on demand. Pull requests run only the local fixture test through the existing site-check workflow; they do not contact production.

## Reading results

The summary gives counts for sitemap pages, HTML pages, unique resources, redirects, language pairs, missing-page URLs, form endpoints, errors, warnings, and duration. Each finding includes its type, source URL, requested URL, final URL, status, and detail.

- **ERROR** is a deterministic violation, such as a broken resource, invalid canonical, missing title, redirect loop, or confirmed server error body. At least one error produces a non-zero exit status.
- **WARNING** is inconclusive or advisory and does not fail the run. Rate limiting (`403`/`429`) is reported as unverified instead of declaring a resource permanently broken.

A custom “Page Not Found” response with HTTP 200 is a warning (a soft 404), not an immediate failure. Configure the host to return a real HTTP 404 when possible.

Because this is an external network check, transient routing, hosting, or rate-limit conditions can affect a run. The checker retries network failures twice, limits concurrency to five, uses a 15-second request timeout, and falls back from unreliable `HEAD` responses to `GET`. Review the finding type and status, retry an isolated URL with `--url`, and use verbose mode to inspect redirect chains before treating an unverified warning as an outage. Do not commit individual run output.
