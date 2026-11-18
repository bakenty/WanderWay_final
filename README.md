# WanderWay — Final Project

Multi-page responsive travel website for beginners who want trip inspiration, practical tips and live country facts.

**Team:** Yelubek Bakdaulet, Ismail Bolat · **Group:** SE-2512

- Live site: _add your GitHub Pages / Netlify link here_
- Repository: _add your repository link here_

## Pages (9)
`index` · `destinations` · `guides` · `tips` · `about` · `contact` · `login` · `signup` · `profile`

## Requirements checklist
| Requirement | Where |
|---|---|
| Responsive layout (Bootstrap grid + Flexbox/CSS Grid) | all pages, `css/style.css` |
| Light / dark toggle saved in `localStorage` | `js/theme.js`, switch in the navbar |
| Sign Up / Log In / Profile simulation | `js/auth.js`, `signup.html`, `login.html`, `profile.html` |
| Custom validation (email, password, required, phone) with inline errors, `novalidate`, no HTML validation attributes | `js/validator.js` + `data-rules` attributes |
| Search / filter with saved results | Destinations page: live search, autocomplete, category chips, recent searches + favourites in `localStorage` (`js/store.js`) |
| Hover transitions and animations | buttons, cards, theme switch, heart, counters, scroll bar |
| External API with loading and error states | REST Countries via `js/api.js` (Country facts + Country Explorer) |

## Folder structure
```
index.html  destinations.html  guides.html  tips.html  about.html  contact.html
login.html  signup.html  profile.html
css/style.css
js/theme.js  store.js  validator.js  auth.js  api.js  script.js
images/
```

## How it works
- **Accounts** are kept in `localStorage` (`ww_users`, `ww_session`). Passwords are salted + hashed (SHA-256), never stored as plain text. This is a simulation — real sites need a server.
- **Saved data** (favourites, recent searches) is stored per account (`ww_data_<email>`); guest data is merged into the account at first login.
- **Validation rules** are declared on fields: `data-rules="required email"`, `data-match="#password"`, `data-min="10"`.

## Run locally
Open `index.html` in a browser (internet is needed for the Bootstrap, jQuery and REST Countries CDNs).

## Deploy (GitHub Pages)
1. Create a repository and upload the contents of this folder (so `index.html` is in the root).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Wait ~1 minute, open the link, and check every page and image.
4. Paste the live link and the repository link at the top of this file and into your submission.
