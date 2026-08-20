# Elite Dangerous Megaship Mapping Project

## Local preview in VS Code

This site is configured to use Bun for local development and preview.

1. Install Bun if it is not already available on your machine.
2. From the repository root, run `bun install`.
3. Start the dev server with `bun run dev`.
4. In VS Code, open the terminal task `EPI: start preview`, or run the command manually.
5. Open the preview URL in your browser, usually `http://localhost:3000`.
6. Vite will watch the HTML, CSS, and SVG source files and auto-refresh the page whenever they change.

This project is an attempt to map the interior spaces of megaships and other large structures in **Elite Dangerous** in a form that is actually useful while playing.

The maps are not intended to be engineering drawings, nor do I expect the measurements to be exact. They are navigational schematics, built from direct observation, screenshots, repeated architectural features, player movement, and whatever reasonably repeatable measurements the game allows.

In other words:
"I'm a tinkerer, not an engineer."

## What these maps are trying to do

The useful questions are fairly simple:

* Where am I?
* Where does this corridor go?
* How do these rooms connect?
* Where is the lift, stairwell, terminal, or other point of interest?
* How large is this space relative to the one beside it?

If the map answers those questions clearly, it is doing its job.

I try to preserve relative scale and spatial relationships wherever practical, but these should be treated as **proportional schematics**, not authoritative blueprints. Some dimensions are measured more confidently than others. Some are inferred. Some may simply be wrong.

Navigation clarity takes priority over pretending to a degree of precision the source material does not support.

## Method

Layouts are reconstructed through exploration of the in-game environment.

Measurements and placement may be based on:

* repeatable in-game distances
* player movement
* relative room and corridor dimensions
* repeated structural elements
* alignment between connected spaces
* screenshots and visual comparison

Where a measurement is uncertain, I would rather preserve that uncertainty than manufacture precision.

As the maps improve, better observations can replace earlier approximations.

## Found something wrong?

Please open a GitHub issue.

Useful reports include misplaced rooms, incorrect corridor connections, missing spaces, bad dimensions, mislabeled locations, misplaced lifts or stairs, or anything else that makes the map misleading or harder to use.

Screenshots, measurements, or enough detail to reproduce what you observed are especially useful.

I could be mistaken. That is rather the point of making the work inspectable.

## Legal

Elite Dangerous and its associated names, assets, and intellectual property belong to **Frontier Developments plc** and their respective rights holders.

This is an unofficial fan-created project and is not affiliated with or endorsed by Frontier Developments.
