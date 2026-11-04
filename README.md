# Stephanie Adventure 🐚🌞

Your personal travel site, built with [Hugo](https://gohugo.io/). Warm sand, coral, sunshine and seafoam ("Sandy Toes"), with round cute fonts.

- **My map** (the home page): tap any country, province, state or capital to mark it as somewhere you've been. Zoom into Canada to tap its 5,000+ cities, towns and areas. It turns coral and the counters update.
- **My plans**: one page per country, with the places you want to see sorted into Food, Adventure, Nature and Attraction. Each place has a photo or emoji, why you want to go, and a cost.
- **My trips**: a journal for each trip, with where you went, your favourite foods and places, and your photos.

## Edit your site (no code)

Open https://slen-fullstack.github.io/stephanie-adventure/admin/ (or tap **✎ Edit my site** at the bottom of any page). Click **Sign In Using Access Token** and paste your GitHub token.

- **My plans → New Country** to add a country and its places.
- **My trips → New Trip** to log a trip.

Saved changes show up on the site in about a minute.

**On the map**, just tap places. Your changes are kept on your device until you press **Save to my site**. The first time, it asks for the same GitHub token (it stays only on that device).

### Making the token (once, free)

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token. Pick **Only select repositories → stephanie-adventure**, and under Repository permissions set **Contents: Read and write**. Copy it and keep it somewhere private.

This is a separate token from the one for Stephanie's Kitchen.

You can also edit at https://app.pagescms.org (sign in with GitHub and pick this repo).

## Where things live

| What | Where |
| --- | --- |
| Site name, tagline, currency | `hugo.toml` |
| Plans (one file per country) | `content/plans/*.md` |
| Trips (one file per trip) | `content/trips/*.md` |
| Places you've been on the map | `data/visited.json` |
| Map shapes and capitals ([Natural Earth](https://www.naturalearthdata.com/), public domain) | `static/map/` |
| Canadian city and town areas (2021 census subdivisions, [Statistics Canada](https://www150.statcan.gc.ca/n1/pub/92-162-g/92-162-g2022001-eng.htm), Open Government Licence – Canada) | `static/map/canada-cities.json` |
| Photos | `static/images/` |
| Styles | `assets/css/main.css` |
| Map code | `assets/js/map.js` |
| Templates | `layouts/` |
| Editor at /admin | `static/admin/config.yml` |

## Run locally

```sh
hugo server        # preview at http://localhost:1313/stephanie-adventure/
```

## Publishing (GitHub Pages)

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. After that, every push to `main` publishes the site.
