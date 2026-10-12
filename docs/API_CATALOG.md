# API catalog

The **API Explorer** (`/apis` in the dashboard, `GET /api/runtime/apis` on the runtime) lists 1,700+ public APIs, of which about 750 need no key and use HTTPS. They are the pool agents draw tools from.

## Source and license

The catalog is generated from the README of [public-apis/public-apis](https://github.com/public-apis/public-apis), which is MIT licensed. Entries keep the original name, description, category, auth type, HTTPS and CORS flags and link back to each API's own documentation.

Regenerate it after updating that repository:

```bash
git clone --depth 1 https://github.com/public-apis/public-apis.git
node scripts/build-api-catalog.mjs public-apis/README.md
```

The script writes `runtime/src/missions/data/public-apis.json`.

## Fields

| Field | Meaning |
|---|---|
| `name`, `description`, `category` | As listed upstream |
| `auth` | `none`, `apiKey`, `OAuth`, `X-Mashape-Key`, `User-Agent` or `unknown` |
| `https` | The API is served over HTTPS |
| `cors` | `yes`, `no` or `unknown` |
| `url` | Documentation or landing page |
| `featured` | Added by AgencyForge: the API is a built-in agent tool |

## Caveats

- The list is community maintained. APIs disappear and change terms; verify before depending on one.
- "No key" does not mean "no limits". Respect each provider's terms and rate limits.
- AgencyForge does not proxy or cache third-party responses.
