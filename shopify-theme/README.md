# Aprilous — Shopify theme

A custom Online Store 2.0 theme for Luné by Aprilous, built from the static site in the repo root. Hebrew, right-to-left, with every text editable in the Shopify theme editor.

## Install

1. Zip the contents of this folder (the zip must have `layout/`, `sections/`, etc. at its top level):
   `cd shopify-theme && zip -r ../aprilous-shopify-theme.zip . -x README.md`
2. In Shopify admin: **Online Store → Themes → Add theme → Upload zip file**.
3. Click **Customize** to preview, then **Publish** when ready.

## Set up the store

- **Language:** Settings → Languages → make Hebrew the default. The theme switches to right-to-left automatically.
- **Products:** add Luné with a colour option (Blush Pink, Sky Blue, Butter Yellow, Silver, Midnight, or Hebrew names). Swatches pick up the colour automatically.
- **Menus:** Online Store → Navigation → "Main menu" (header) and "Footer menu" (footer).
- **Home page product grid:** shows all products; pick a collection in the "Featured products" section to narrow it.
- **Free-shipping bar:** Theme settings → Cart.

## Sections

Home page, in order: Hero with video → Scrolling text → Design & light modes → Ritual animation → UV-C specs → Drying → Adapters → Featured products → Reviews → FAQ → Offer banner. Each can be edited, reordered, hidden or added to other pages.

The product page uses a gallery, colour swatches, quantity, an AJAX cart drawer, then the ritual animation and FAQ.
