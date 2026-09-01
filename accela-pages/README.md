# Perpetual Hive Custom Accela Pages

This is the isolated application foundation for custom pages embedded in Accela.

Canonical production route:

`https://theperpetualhive.com/Accela/{AgencyID}/{Page}`

## Current milestone

The application currently provides a diagnostic route at:

`/Accela/[agencyId]/[page]`

It displays the requested agency and page while intentionally leaving Accela authentication/context unvalidated. The URL agency identifier is routing context only and must never be treated as authorization.

## Architecture

- Separate application from ImportEase.
- Next.js App Router.
- `basePath: /Accela` so assets and internal routes remain under the Accela prefix when reverse proxied from the root domain.
- Dynamic tenant/page route: `[agencyId]/[page]`.
- No Accela credentials, API calls, or customer data are present in this initial shell.

## Deployment target

Deploy this directory as its own application/service, then configure the root `theperpetualhive.com` proxy to forward `/Accela/:path*` to this service in the same way `/ImportEase` is currently forwarded to the ImportEase service.

Do not deploy this directory as part of the ImportEase application itself.
