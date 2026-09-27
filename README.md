# Slumber Line

A train ride from a passenger's seat, made for relaxing and falling asleep. You watch made-up scenery roll past the window and hear the rhythm of the rails. Overlays show speed, a route map, weather and temperature, and details of the train. Each overlay can be turned off.

This is a standalone web app, separate from Coda. It needs no build step, has no dependencies and downloads no assets.

## Run it

Serve this folder with any static server and open it in a browser:

```sh
cd train
python3 -m http.server 8000     # then open http://localhost:8000
# or: npx serve .
```

Opening `index.html` directly from disk also works.

## What's in it

**Routes (all made up)**

| On Earth | The future |
| --- | --- |
| Countryside: fields, windmills, sheep, villages | Neon Metropolis: kilometre-high towers, sky traffic, holograms, street canyons |
| Mountains: snow peaks, alpine lakes, pines, long tunnels | Celestial Line: a ringed giant planet, floating islands with waterfalls, crystal spires, glowing forests, sky whales |
| City: skylines with thousands of lit windows | Orbital Ring: a railway 400 km up, with the planet turning below, city lights on its night side and passing space stations |
| Seaside: sailboats, lighthouses, dunes | |
| Deep Forest: pines, mist, cabins | |
| Desert: red mesas, saguaros | |
| Snowy North: fjells, red cabins, the northern lights | |
| Grand Tour: all seven in turn, with a tunnel between each | |

**Time of day:** dawn, day, dusk, night, a continuous day-and-night cycle (one day every 48 minutes), or matching your own clock. The sun, moon, stars, Milky Way, lighting and colours follow the hour.

**Weather:** clear, cloudy, rain, thunderstorm (with lightning and thunder), snow or fog. "Changing" lets it drift from one to another as you travel. Rain beads and streaks run across the glass. Frost creeps in from the edges of the window in the cold.

**Where you sit:** window seat (curtains, a cup of tea steaming on the table), compartment (two windows, luggage rack, seat backs), dining car (tablecloth, table lamp, wine glasses), sleeper berth (blind half down, bed, reading lamp), observation dome, or scenery only. At night and in tunnels the glass faintly reflects the lit carriage.

**Overlays (each can be switched off; H hides them all):**
- Speed, with elevation (or skyway level or altitude on the future routes)
- Route map showing your position, the stations ahead and behind, tunnels, a north arrow and a scale
- Weather and temperature, wind and humidity (°C or °F)
- Train information: name, operator, train number, locomotive, carriages, your coach and seat, the next stop and its ETA, and the distance travelled
- Clock, showing the scene's time and your own

**The journey:** the train stops at stations (optional). Each has a platform, a name board, people waiting and a clock, with chimes and announcements such as "Next stop: Brookwell" and "Doors closing". It sounds its horn before tunnels. Pace can be gentle, normal or express. Units are metric or imperial.

**Sound (synthesised on the device, no audio files):** wheels over rail joints in the familiar two-bogie rhythm, rumble, wind, rain, thunder, a maglev hum on the future lines, station chimes, the horn, and an optional slow ambient pad. There are separate volume sliders for each.

**For sleep:**
- A sleep timer (15 min to 2 h). The sound fades and the screen dims over the final minutes, then the ride pauses to save battery.
- The screen stays awake while you ride (Wake Lock API).
- Sound keeps playing when the tab is in the background.
- Controls and the cursor fade out after a few seconds.

**Also:** save a postcard (PNG) of the current view, go full screen, and use keyboard shortcuts (S settings, V seat, T time, W weather, H overlays, M mute, F full screen, P postcard). Settings are remembered on the device.

## Does it need the internet?

No. Streaming video or photographs of scenery would mean gigabytes of downloads, so every landscape here is generated instead, from the train's position on an endless track. The same stretch of line always looks the same, the ride never runs out, and the whole app is about 200 KB. It works offline. On slower devices it lowers its resolution automatically to stay smooth.

If you later want painted or photographic scenery, the renderer already draws in parallax layers. Each layer could be replaced by a streamed image strip (tiles fetched from a CDN a few kilometres ahead of the train and cached). That makes the internet optional: generated scenery offline, richer packs when connected.

## Code

| File | What it does |
| --- | --- |
| `js/world.js` | Routes, landscape layer recipes, trains, stations and their names, tunnels, climate |
| `js/sky.js` | Time-of-day lighting, sky, sun, moon, stars, clouds, aurora, planets, shooting stars, birds, sky whales |
| `js/objects.js` | Things in the landscape: trees, houses, windmills, lighthouses, boats, cacti, crystals, glowing mushrooms, … |
| `js/scenery.js` | Draws the terrain layers, cities, megatowers, water, the orbital planet, stations, tunnels and outside weather |
| `js/interior.js` | The six seats, raindrops and frost on the glass, reflections |
| `js/audio.js` | Web Audio synthesis of every sound |
| `js/app.js` | The ride simulation (acceleration, braking into stations), overlays, map, settings, sleep timer, start screen |

To jump along a route while testing, run `slumber.ride.d = 12000` in the browser console.

## Ideas for later

- Seasons (autumn colours, spring blossom, winter snow cover) as a separate setting
- More future lines: an underwater glass tube, a train across a desert of glass under two suns, a cloud-top railway on a gas giant
- Bridges and viaducts over valleys and rivers
- Passing trains on the other track
- Other passengers in the carriage (a conductor who punches tickets, someone reading)
- Rain sounds on the carriage roof when the rain gets heavy
- Soundscapes by route: seagulls on the coast, owls in the forest, a city hum
- A "journey" mode with a real start and end, e.g. an overnight 8-hour sleeper that arrives at sunrise
- Install as an app (PWA) and wrap for iOS, Android and TV
- Casting to a TV or a second screen
