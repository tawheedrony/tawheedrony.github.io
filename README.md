# tawheedrony.github.io

Source for my personal website, <https://tawheedrony.github.io>, built with
[Jekyll](https://jekyllrb.com/) and the [al-folio](https://github.com/alshedivat/al-folio) theme (v1.x).

## Editing content

| What               | Where                                      |
| ------------------ | ------------------------------------------ |
| Bio / home page    | `_pages/about.md`                          |
| Publications       | `_bibliography/papers.bib`                 |
| News items         | `_news/`                                   |
| Projects           | `_projects/`                               |
| CV                 | `_data/cv.yml`, `assets/pdf/`              |
| Social links       | `_data/socials.yml`                        |
| Site settings      | `_config.yml`                              |
| Theme overrides    | `_includes/`, `_layouts/`, `_sass/`        |

The theme itself lives in the `al_folio_*` gems pinned in `Gemfile`; only files
that intentionally differ from the theme are kept in this repository.

## Local preview

```bash
docker compose up
```

Then open <http://localhost:8080>.

## Deployment

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds the site
and publishes it to the `gh-pages` branch.
