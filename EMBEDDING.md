# Embedding Solar System Visualization

This solar system visualization can be easily embedded into any website using an iframe.

## Quick Start

Add this to your HTML:

```html
<iframe
  src="https://sbhaigh.github.io/solar-system/embed.html"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none;"
>
</iframe>
```

## URL Parameters

Customize the embedded visualization with URL parameters:

### Basic Parameters

| Parameter      | Values            | Default | Description                         |
| -------------- | ----------------- | ------- | ----------------------------------- |
| `controls`     | `hidden` / (omit) | visible | Hide/show control panel             |
| `instructions` | `true` / `false`  | `false` | Show/hide instruction text          |
| `labels`       | `true` / `false`  | `true`  | Show/hide planet labels             |
| `orbits`       | `true` / `false`  | `true`  | Show/hide orbit lines               |
| `performance`  | `true` / `false`  | `false` | Show/hide performance monitor (FPS) |

### Camera Parameters

| Parameter   | Values       | Default | Description                                                   |
| ----------- | ------------ | ------- | ------------------------------------------------------------- |
| `focus`     | `-1` to `7`  | `-1`    | Initial focus target (`-1`=Sun, `0`=Mercury, `1`=Venus, etc.) |
| `zoom`      | `1` - `3000` | `800`   | Initial zoom level                                            |
| `timeScale` | `0` - `100`  | `50`    | Orbit speed (0=slowest, 100=fastest)                          |

## Examples

### Clean Embed (No Controls)

```html
<iframe
  src="https://sbhaigh.github.io/solar-system/embed.html?controls=hidden"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

### Focus on Earth with Labels Only

```html
<iframe
  src="https://sbhaigh.github.io/solar-system/embed.html?controls=hidden&focus=2&zoom=50"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

### Show Saturn's Rings

```html
<iframe
  src="https://sbhaigh.github.io/solar-system/embed.html?controls=hidden&focus=5&zoom=200"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

### Full Page Embed with Controls

```html
<iframe
  src="https://sbhaigh.github.io/solar-system/embed.html?instructions=true"
  width="100%"
  height="100vh"
  frameborder="0"
></iframe>
```

### Minimal View (No UI)

```html
<iframe
  src="https://sbhaigh.github.io/solar-system/embed.html?controls=hidden&labels=false&orbits=false"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

## Planet Index Reference

- `-1` = Sun (center)
- `0` = Mercury
- `1` = Venus
- `2` = Earth
- `3` = Mars
- `4` = Jupiter
- `5` = Saturn
- `6` = Uranus
- `7` = Neptune

## Responsive Sizing

For responsive embeds, use percentage widths:

```html
<div
  style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;"
>
  <iframe
    src="https://sbhaigh.github.io/solar-system/embed.html?controls=hidden"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    frameborder="0"
  >
  </iframe>
</div>
```

This creates a 16:9 aspect ratio container.

## Full Page Mode

To use the regular (non-embed) version:

```html
<iframe
  src="https://sbhaigh.github.io/solar-system/"
  width="100%"
  height="100vh"
  frameborder="0"
></iframe>
```

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (requires page reload to see changes due to aggressive caching)

## License

See LICENSE file for usage terms.
