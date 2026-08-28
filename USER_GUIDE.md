# Using the DomeCast Simulator

This guide is for a first visit. The Simulator lets you design a single-projector planetarium: a convex spherical mirror throws the image onto the inside of a dome. You adjust the real-world sizes, watch the light paths, then export a setup for playback.

In the app, open **Guide** in the top bar at any time — as a panel over the workspace, or in a new window. Your current rig stays as it is.

Open the live app at https://domecast.github.io/Simulator/ or run it locally (`npm install` then `npm run dev`). Nothing you do is uploaded; work stays in this browser.

## What you are looking at

The left column is the control panel. The large 3D view is the room. Floor labels **FRONT**, **BACK**, **LEFT**, and **RIGHT** match the dome: the mirror sits at the back (`−Y`), and the projector faces it.

Coloured rays show where projector pixels go:

| Colour | Meaning |
| --- | --- |
| Teal | **Valid path** — the ray hits the mirror’s optical face and lands on the dome |
| Orange | **Overshot** — it misses the mirror or the dome |
| Pink | **Chassis shadow** — the projector body blocks its own beam |

The **Live analysis** card (top right) updates as you change the rig. **Dome coverage** is the share of the inner surface that is lit. **Projector fill** is how much of the projector image hits the mirror. **Mirror use** is how much of the mirror is actually used. **Beam clearance** should stay positive so the chassis is out of the light path; a pink **Occluded** self-shadowing badge means the projector is blocking some rays.

## Look around

- Drag to orbit
- Scroll to zoom
- Right-drag to pan

The **View** card (top left of the 3D view) has two cameras:

- **Fly** — walk around the outside of the rig. Use this while you place the mirror and projector.
- **Inside dome** — sit at the centre looking at the sky, as an audience member would. Ray bundles and the pixel grid turn off so the picture is easier to see. **Dome apex** (a small ring at the zenith) can be toggled here.

**Viewport layers** hide or show the ray bundle, projector box, pixel grid, ground, source preview, and apex. Drag the strip between the control panel and the view if you want a wider workspace; double-click the strip to reset its width.

The ↺ button at the top of the panel restores the default optical setup. It does not delete saved setups.

## A first pass: build the room

Stay on the **Rig** tab. Units are metres.

### Environment

1. Set **Dome diameter** to the true inside diameter of the dome.
2. If the hemisphere sits on a short vertical wall, raise **Straight section**. `0` puts the equator on the floor.
3. **Inner colour** paints the inside of the dome and that wall. With no source image loaded, this is what you see looking in. A loaded image is drawn on top of it, only where the projector actually lights the surface.
4. Set **Mirror diameter** and **Mirror height**. The mirror stays in contact with the rear of the shell: as you raise it, it slides forward along the curve. Below the equator it sits against the cylindrical wall instead.
5. **Mirror pitch down** tilts the optical face toward the floor (`0` is upright).

### Projector

The projector always faces the mirror along the centre line. Horizontal lens shift is locked at zero so the image stays symmetrical.

1. Match **Aspect ratio** to the projector (`16:9`, `16:10`, or `4:3`).
2. **Mirror distance** is the gap from the front of the mirror to the front of the projector. `0` means they touch. The slider’s maximum places the projector front at the dome mid-plane.
3. **Height** and **Pitch** move and tilt the chassis.
4. **Diagonal FOV** is the projector’s diagonal field of view.
5. **Vertical lens shift** moves the image up or down on the mirror (`0` is centred).

Watch coverage climb and orange overshoot fall as you close in on a layout. If beam clearance goes negative or self-shadowing reads **Occluded**, pull the projector back or drop it so the chassis is no longer in the beam.

## Preview a fulldome picture

Open the **Source** tab.

1. **Choose image** — only two layouts are accepted:
   - Square (**1:1**), treated as a hemispherical fisheye (zenith in the centre, horizon on the circle)
   - Twice as wide as it is tall (**2:1**), treated as an equirectangular panorama
2. Leave **Source preview** on in the View card. The picture appears only in the projector’s lit footprint, not across the whole dome. That is deliberate: it is what this rig would actually show.
3. **Yaw**, **Pitch**, and **Roll** turn the image within that footprint. They stay locked until an image is loaded.
4. **Exclude occluded from mesh** (on by default) drops chassis-shadowed pixels from the preview and from later exports. Turn it off only if you want those rays kept.

The image is session-only. Reloading the page, loading a saved setup, or importing JSON does not bring the file back — choose it again.

Switch the camera to **Inside dome** to judge framing from the seats.

## Save and take the setup with you

**Setups** stores named snapshots in this browser (geometry, display options, and orientation — not the image). Give it a name and **Save**. Load or delete entries from the list. The same name overwrites the previous save.

**Export** is for files you can keep or hand to another machine:

- **Export setup JSON** writes the optical parameters for the DomeCast Player (or any other runtime that reads `domecast-setup-v1`).
- **Import setup JSON** loads a file you exported earlier.
- **Download warp mesh** writes a Paul Bourke `.data` mesh from the current rig and source layout. Load a source image first so the mesh type matches fisheye or equirectangular. Details of the file format are in the [README](README.md).

## A short checklist

1. Enter the real dome and mirror sizes on **Rig**.
2. Place the projector until coverage is high, overshoot is low, and the beam clears the chassis.
3. Load a 1:1 or 2:1 test image on **Source** and check it from **Inside dome**.
4. Save the setup in the browser, then export JSON (and a warp mesh if you need one).

If something looks wrong, reset with ↺ and start from the defaults — a 10 m dome, 1.3 m mirror, and a 16:9 projector are already a working example.
