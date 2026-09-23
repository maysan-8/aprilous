# Aprilous — אתר המותג

Static website for Luné by Aprilous, the UV-C makeup brush cleaner. Hebrew, RTL, no build step.

- `index.html`: home page, in marketing order: hero with the real brush-spin video → design and 5 light modes → how it works (animated canvas film synced to the steps) → UV-C → drying → adapters → reviews and FAQ → Late Pledge offer
- `products.html`: product catalog with prices, filters, colour swatches, a comparison table and a cart drawer (saved in localStorage)
- `assets/css/style.css`: design tokens and all styles
- `assets/js/brush-film.js`: the animated brush film in the "how it works" section
- `assets/video/`: the hero video (WebM + MP4, 1280px, no audio) and its poster frame
- `assets/js/main.js`: nav, scroll reveals, counters and cart
- `assets/img/lune-lineup.webp`: product photo of the five colours
- `assets/img/*.svg`: product illustrations for the product cards. Swap them for real product photos when you have them.

Open `index.html` in a browser, or serve the folder with any static host (GitHub Pages, Netlify, Vercel).
