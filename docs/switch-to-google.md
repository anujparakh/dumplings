# Switching place search to Google

Place search uses Photon (free, no key) by default. Google Places finds far more restaurants. These steps switch to it without any code changes.

1. Go to https://console.cloud.google.com and create a project (for example "dumpling-map").
2. Turn on billing for the project (Billing > Link a billing account). Google requires a card, but this app's usage should stay inside the free monthly allowance.
3. Turn on the API: APIs and services > Library > search "Places API (New)" > Enable.
4. Create a key: APIs and services > Credentials > Create credentials > API key.
5. Restrict the key: open it, and under "API restrictions" choose "Restrict key" and select only "Places API (New)". Leave "Application restrictions" as None (the key is only used by the server, never the browser).
6. Set a budget alert: Billing > Budgets and alerts > Create budget (for example $1, alert at 50% and 100%).
7. Cap daily usage: APIs and services > Places API (New) > Quotas, and lower the "Text Search requests per day" limit (for example 500).
8. Save the key in Cloudflare, from the project folder (paste the key when asked):
   ```bash
   npx wrangler pages secret put GOOGLE_PLACES_KEY
   ```
9. In `wrangler.toml`, change `SEARCH_PROVIDER = "photon"` to `SEARCH_PROVIDER = "google"`.
10. Redeploy:
    ```bash
    npm run build && npx wrangler pages deploy dist --branch main
    ```
11. Test it: open the add-spot screen and search for a restaurant Photon could not find.

To try Google locally first, add these two lines to `.dev.vars` and restart `npm run dev:api`:

```
SEARCH_PROVIDER=google
GOOGLE_PLACES_KEY=your-key
```

To switch back, set `SEARCH_PROVIDER = "photon"` in `wrangler.toml` and redeploy.

Note: Google's terms only allow keeping its place IDs indefinitely. The app saves each spot's name, address and coordinates permanently. That is very unlikely to matter for a small personal map, but it is not strictly compliant.
