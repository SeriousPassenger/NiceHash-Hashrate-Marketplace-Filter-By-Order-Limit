# NiceHash Hashrate Marketplace Filter By Order Limit

A simple userscript that adds a small filter panel to the NiceHash hashrate marketplace.

It helps hide orders with a low **Limit** value, so the marketplace table is easier to scan.

## Features

- Hide marketplace rows where **Limit ≤ your chosen threshold**
- Save a separate setting for each marketplace, like `EAGLESONG` or `RANDOMXMONERO`
- Enable or disable the filter per marketplace
- Drag the settings panel anywhere on the screen
- Remember the panel position after refresh
- Hide the panel automatically when you leave marketplace pages

## Install

First, install a userscript manager:

- [Tampermonkey](https://www.tampermonkey.net/)
- [Violentmonkey](https://violentmonkey.github.io/)
- [Greasemonkey](https://www.greasespot.net/)

Then click here:

[Install userscript](https://raw.githubusercontent.com/SeriousPassenger/NiceHash-Hashrate-Marketplace-Filter-By-Order-Limit/refs/heads/main/nicehash-marketplace-limit-filter.user.js)

Your userscript manager should open an install screen. Confirm the install, then open a NiceHash marketplace page.

## Usage

Open a marketplace page, for example:

```text
https://www.nicehash.com/my/marketplace/EAGLESONG
https://www.nicehash.com/my/marketplace/RANDOMXMONERO
