# Assets

Every image in this folder is generated locally from the pages in `src/` in headless Chrome. No artwork is loaded from an external host at view time, so a redesign is one commit here, not a fetch upstream.

The README wordmark is `logo-light.png` and `logo-dark.png`, 1680 by 400 with a transparent ground, shown at `width="480"` inside a `picture` tag so each GitHub theme gets its own: navy for light, cream for dark. Nine tiles in a three by three grid, one per agent, the last one lit in signal blue with a tick: the step the owner has just approved. The tag line reads POD · DROPSHIP · MIT. Both render from `src/logo.html` (add `#dark` to the URL for the cream one) with `--window-size=840,200` and keep their two times pixels.

`harness-strip.png` is the compatibility strip in the README header: 838 by 92, rendered at three times scale. It shows the eleven harnesses in `docs/HARNESSES.md`, in that order, each a letter tile on a white chip so a dark mark never disappears into the navy. It renders from `src/harness-strip.html`, which reads the icons from `assets/icons/`; each icon is a generated monogram tile from `src/icon.html` (`chrome --headless=new --force-device-scale-factor=2 --window-size=96,96 --screenshot=assets/icons/<slug>.png "src/icon.html#<slug>"`), so the strip never hotlinks a brand asset. Rebuild it with `--allow-file-access-from-files --force-device-scale-factor=3 --window-size=838,92`. Adding a harness means adding it to `docs/HARNESSES.md`, to the lists in `src/harness-strip.html` and `src/icon.html`, and to the alt text in the README.

The header button is `btn-install.png`, 60 tall, rendered at three times scale from `src/header-buttons.html` with `#install` on the URL and `--window-size=<width>,60`. The same page renders `#star` and `#docs` variants for the repository's own links. The palette's three colours carry the order of importance: cream for the primary action, signal blue for the second, navy for the one that follows. Every button has a rim, so cream holds on GitHub's light theme and navy on its dark one.

Three more images live in this folder:

| File | What it is | Where it goes |
|---|---|---|
| `banner.png` | 1600 by 400. The Vietnamese promise on the left; on the right the app's four step loop (Mục tiêu, AI soạn nháp, Code kiểm tra, Bạn duyệt, the last one lit) above all nine kits as named monogram tiles. | `README.vi.md`, under the wordmark. |
| `banner-en.png` | 1600 by 400. The English promise on the left; on the right the same four step loop (Goal, AI draft, Code checks, You approve, the last one lit) above all nine kits as named monogram tiles. Renders from `src/banner-en.html`. | `README.md`, under the wordmark. |
| `social-preview.png` | 1280 by 640. The repo name and one line promise, the same four step loop and nine kits, with the GitHub URL. | The repository settings, under Social preview. GitHub does not read it from the tree, so upload it by hand after a change. |
| `cta-install-prompt.png` | 660 by 104, the project's primary button at two times scale. Shown at `width="330"`, so it stays crisp on a retina screen. | The README, in the install prompt block above What sets these Ecom Agents apart. |

The agent tiles in `banner.png` and `social-preview.png` are monograms rendered in the page itself, so no external image is fetched when they regenerate. All three are rendered from the pages in `src/` in headless Chrome at two times scale and downsampled, with Montserrat for the display line, Inter for text and JetBrains Mono for the eyebrow, which are the palette's three faces. No gradient text. To rebuild one:

```
chrome --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1600,400 --virtual-time-budget=8000 --default-background-color=00000000 --screenshot=banner@2x.png assets/src/banner.html
chrome --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1600,400 --virtual-time-budget=8000 --default-background-color=00000000 --screenshot=banner-en@2x.png assets/src/banner-en.html
```

then downsample to 1600 by 400. Headless Chrome can clip the bottom of the page at the exact window size, so it is safer to render with a window about 200 px taller and crop the top 3200 by 800 before downsampling (`convert banner@2x.png -crop 3200x800+0+0 +repage -resize 1600x400 assets/banner.png`). The same applies to the logo: render at `840,400` and crop to 1680 by 400. The social preview is the same with `--window-size=1280,640`, no transparent background, and 1280 by 640 at the end. The button is `--window-size=330,52` and keeps its two times pixels rather than being downsampled, because GitHub renders an `img` at `height: auto` and will only ever scale one down:

```
chrome --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=330,52 --virtual-time-budget=8000 --default-background-color=00000000 --screenshot=assets/cta-install-prompt.png assets/src/cta-install-prompt.html
```

The button is cream on a navy rim rather than cream alone, because GitHub's light theme washes out an unrimmed cream fill.

Still to make:

| File | What it is | Spec |
|---|---|---|
| `org-chart.png` | The nine agents as an org chart, with each one's cadence under its name. | 1280 by 640. Navy ground `#0D161B`, cream type `#f1e8cb`, signal blue accents `#0b7fc7`. No gradient text. |
| `demo.gif` | Twenty seconds, no sound: paste the install prompt into Claude Code, watch the routines register, cut to the next morning's brief opening. Recorded on the fictional business in `agents/gtm-engineer/examples/`, never on a real one. | Under 6 MB. Terminal on navy. |

Two rules for anything that lands here: no generated face of anyone, and nothing recorded against a real customer, a real contact, or a real account screen.
