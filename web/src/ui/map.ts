import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RADIUS_KM } from '../config';
import type { Place } from '../location';
import { escapeHtml } from '../text';
import { onLeave } from './lifecycle';

const ign = (layer: string, style = 'normal') =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=${style}` +
  '&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

// No road map: soft relief, rivers and lakes, place names. Water is what the site is about.
const BASE_LAYERS: [string, L.TileLayerOptions][] = [
  [ign('ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW', 'estompage_grayscale'), { maxNativeZoom: 15, opacity: 0.3, className: 'tiles-relief' }],
  [ign('HYDROGRAPHY.HYDROGRAPHY'), { minZoom: 6 }],
  [ign('GEOGRAPHICALNAMES.NAMES'), { minZoom: 6, className: 'tiles-overlay' }],
];

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  /** HTML shown in the marker (label + mini reservoir); without it the marker is a dot. */
  html?: HTMLElement;
  title: string;
  /** Dots only: HTML of the small card shown on hover (must already be escaped). */
  tip?: string;
}

export interface StationMap {
  el: HTMLElement;
  highlight(id: string | null): void;
  /** Dots only: replace the hover card, recolour the dot (CSS class). */
  update(id: string, tip: string, dotClass?: string): void;
}

/** IGN base map with HTML markers; around a place (with the radius circle) when one is given. */
export function stationMap(
  place: Place | null,
  markers: MapMarker[],
  hooks: { onHover?: (id: string | null) => void; onSelect?: (id: string) => void } = {},
  options: { zoomIn?: number } = {},
): StationMap {
  const el = document.createElement('div');
  // Many stations: show symbols only, names on hover / selection.
  el.className = markers.length > 12 ? 'map compact' : 'map';
  const byId = new Map<string, HTMLElement>();
  const leafletMarkers = new Map<string, L.Marker>();
  const pending = new Map<string, [string, string | undefined]>();

  // Leaflet needs the element in the document and sized: build on first layout.
  const observer = new ResizeObserver(() => {
    if (el.clientWidth === 0 || el.dataset.ready) return;
    el.dataset.ready = '1';
    observer.disconnect();
    const first = markers[0];
    const center: L.LatLngExpression = place ? [place.lat, place.lon] : first ? [first.lat, first.lon] : [46.6, 2.4];
    // A view must exist before layers that need projection (circle bounds, markers).
    // No zoom animation: leaving the page mid-animation would make Leaflet throw after removal.
    const map = L.map(el, { scrollWheelZoom: false, attributionControl: true, zoomAnimation: false }).setView(center, 11);
    BASE_LAYERS.forEach(([url, options], i) =>
      L.tileLayer(url, { maxZoom: 18, ...options, attribution: i === 0 ? '© <a href="https://www.ign.fr/">IGN</a>' : undefined }).addTo(map),
    );
    let bounds = L.latLngBounds([center, center]);
    if (place) {
      const circle = L.circle(center, {
        radius: RADIUS_KM * 1000,
        color: getComputedStyle(document.documentElement).getPropertyValue('--soft').trim() || '#888',
        weight: 1,
        dashArray: '4 4',
        fill: false,
      }).addTo(map);
      L.circleMarker(center, { radius: 5, color: '#b4532a', fillColor: '#b4532a', fillOpacity: 1 }).addTo(map).bindTooltip(escapeHtml(place.label));
      bounds = circle.getBounds();
    }
    for (const m of markers) {
      const wrapper = document.createElement('div');
      if (!m.html) {
        // A dot centred exactly on the station; the name and value go in the hover card.
        wrapper.className = 'station-dot';
        const marker = L.marker([m.lat, m.lon], {
          icon: L.divIcon({ html: wrapper, className: '', iconSize: [14, 14], iconAnchor: [7, 7] }),
          riseOnHover: true,
        }).addTo(map);
        marker.bindTooltip(m.tip ?? escapeHtml(m.title), { direction: 'top', offset: [0, -8], className: 'station-tip' });
        marker.on('mouseover', () => hooks.onHover?.(m.id));
        marker.on('mouseout', () => hooks.onHover?.(null));
        marker.on('click', () => hooks.onSelect?.(m.id));
        byId.set(m.id, wrapper);
        leafletMarkers.set(m.id, marker);
        bounds.extend([m.lat, m.lon]);
        continue;
      }
      wrapper.className = 'marker';
      wrapper.title = m.title;
      wrapper.append(m.html);
      wrapper.addEventListener('mouseenter', () => hooks.onHover?.(m.id));
      wrapper.addEventListener('mouseleave', () => hooks.onHover?.(null));
      wrapper.addEventListener('click', () => {
        hooks.onHover?.(m.id);
        hooks.onSelect?.(m.id);
      });
      byId.set(m.id, wrapper);
      L.marker([m.lat, m.lon], { icon: L.divIcon({ html: wrapper, className: '', iconSize: undefined }) }).addTo(map);
      bounds.extend([m.lat, m.lon]);
    }
    map.fitBounds(bounds, { padding: [24, 40] });
    // Closer than "everything fits", centred on the place when there is one.
    if (options.zoomIn) map.setView(place ? center : bounds.getCenter(), map.getZoom() + options.zoomIn);
    for (const [id, [tip, cls]] of pending) apply(id, tip, cls);
    pending.clear();
    onLeave(() => map.remove());
  });
  observer.observe(el);
  onLeave(() => observer.disconnect());

  function apply(id: string, tip: string, cls?: string) {
    leafletMarkers.get(id)?.setTooltipContent(tip);
    const dot = byId.get(id);
    if (dot && cls !== undefined) dot.className = `station-dot ${cls}${dot.classList.contains('hl') ? ' hl' : ''}`;
  }

  return {
    el,
    highlight(id) {
      for (const [key, node] of byId) node.classList.toggle('hl', key === id);
      // Hovering a station elsewhere (river profile) opens its card on the map.
      for (const [key, marker] of leafletMarkers) {
        if (key === id) marker.openTooltip();
        else marker.closeTooltip();
      }
    },
    update(id, tip, dotClass) {
      // The map is built on first layout: keep updates that arrive before.
      if (leafletMarkers.size === 0) pending.set(id, [tip, dotClass]);
      else apply(id, tip, dotClass);
    },
  };
}
