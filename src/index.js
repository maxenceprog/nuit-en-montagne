import 'leaflet/dist/leaflet.css';
import 'tabulator-tables/dist/css/tabulator.min.css';

import L from 'leaflet';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import markerRedUrl from './data/red-marker-icon.png';
import refuges_availabilities from './data/refuge_availabilities.json';
import refuges_metadata from './data/refuges.json';
import './styles.css';
// Fix Leaflet's default icon paths for vite
delete L.Icon.Default.prototype._getIconUrl;

// ---------------------- State ----------------------
let allRefuges = [];
let currentDate = getCurrentDate();

let table, map, markers = [];

const welcomeHtml = document.getElementById('info-panel').outerHTML;
const infoPanel = document.getElementById('info-panel');
const dateInput = document.getElementById('date-picker');

// ---------------------- Utility Functions ----------------------
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCurrentDate() {
  let today = new Date();
  let formatter = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris'
  });

  let [day, month, year] = formatter.format(today).split('/');
  return `${year}-${month}-${day}`;
}


// ---------------------- Icons ----------------------

const greenIcon = L.icon({
  iconUrl: markerIconUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: markerShadowUrl
});

const redIcon = L.icon({
  iconUrl: markerRedUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: markerShadowUrl
});

// ---------------------- Formatting ----------------------
function formatAvailability(val) {
  if (val === null || val === undefined) return `<span class="unknown">?</span>`;
  return val > 0 ? `<span class="available">${escapeHTML(val)}</span>`
    : `<span class="unavailable">0</span>`;
}

function showInfo(refuge) {
  const raw = refuge.availability?.[currentDate];
  const avail = raw === undefined || raw === null ? '?' : raw;

  let urlsHTML = '';
  if (Array.isArray(refuge.urls)) {
    urlsHTML = refuge.urls
      .map(url => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`)
      .join('<br>');
  }

  infoPanel.innerHTML = `
    <h3>${escapeHTML(refuge.name)}</h3>
    <p><strong>Altitude:</strong> ${escapeHTML(refuge.altitude_m || '?')} m</p>
    <p><strong>Capacity:</strong> ${escapeHTML(refuge.places || '?')} places</p>
    <p><strong>Gardien(s):</strong> ${escapeHTML(refuge.gardien || 'Non renseigné')}</p>
    <p><strong>Available on ${escapeHTML(currentDate)}:</strong> ${escapeHTML(avail)}</p>
    ${refuge.description ? `<p>${escapeHTML(refuge.description)}</p>` : ''}
    ${urlsHTML}
  `;
}

function resetView() {
  table.clearFilter();
  updateTableAndMap();
  infoPanel.innerHTML = welcomeHtml;
}

// ---------------------- Main Update ----------------------
function updateTableAndMap() {
  const bounds = map.getBounds();

  const filtered = allRefuges
    .map(r => {
      const raw = r.availability?.[currentDate];
      return { ...r, available_places: raw === undefined ? null : raw };
    })
    .filter(r => r.lat && r.lng && bounds.contains([r.lat, r.lng]));

  table.setData(filtered);

  markers.forEach(({ marker, refuge }) => {
    const raw = refuge.availability?.[currentDate];
    marker.setIcon(raw > 0 ? greenIcon : redIcon);
    const safeName = escapeHTML(refuge.name);
    const safeRaw = escapeHTML(raw ?? '?');
    marker.setPopupContent(
      `<strong>${safeName}</strong><br>Available on ${escapeHTML(currentDate)}: ${safeRaw}`
    );
  });
}

// ---------------------- Init Functions ----------------------
function initMap() {
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap contributors, © OpenStreetMap contributors',
    maxZoom: 17
  });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  });

  map = L.map('map', {
    center: [45.5, 6.5],
    zoom: 8,
    layers: [topo]
  });

  L.control.layers({ OpenStreetMap: osm, Topographic: topo }).addTo(map);

  map.on('popupclose', resetView);
  map.on('click', resetView);
  map.on('moveend', updateTableAndMap);
}

function initTable() {
  table = new Tabulator('#refuge-table', {
    layout: 'fitColumns',
    pagination: 'local',
    paginationSize: 10,
    columns: [
      { title: 'Refuge', field: 'name', headerFilter: 'input', widthGrow: 2 },
      { title: 'Altitude', field: 'altitude_m', hozAlign: 'center', width: 90 },
      { title: 'Places', field: 'places', hozAlign: 'center', width: 80 },
      {
        title: 'Available',
        field: 'available_places',
        hozAlign: 'center',
        width: 110,
        formatter: cell => formatAvailability(cell.getValue())
      }
    ]
  });

  table.on('tableBuilt', function () {
    table.on('rowClick', (e, row) => {
      const refuge = row.getData();
      if (refuge.lat && refuge.lng) {
        showInfo(refuge);
        table.clearFilter();
        table.setFilter('structure', '=', refuge.structure);

        const markerObj = markers.find(m => m.refuge.lat === refuge.lat && m.refuge.lng === refuge.lng);
        if (markerObj) markerObj.marker.openPopup();
      }
    });
  });
}

function initMarkers() {
  markers = allRefuges
    .map(refuge => {
      if (!refuge.lat || !refuge.lng) return null;
      const marker = L.marker([refuge.lat, refuge.lng]).addTo(map).bindPopup('');
      marker.on('click', () => {
        showInfo(refuge);
        table.clearFilter();
        table.setFilter('structure', '=', refuge.structure);
      });
      return { marker, refuge };
    })
    .filter(Boolean);
}

// ---------------------- Data Loading ----------------------

Object.keys(refuges_metadata).forEach(structure => {
  refuges_metadata[structure].availability =
    refuges_availabilities[structure]?.availability
});

allRefuges = Object.values(refuges_metadata);

initMap();
initTable();
initMarkers();
table.on('tableBuilt', () => {
  updateTableAndMap();
});



// ---------------------- Event Listeners ----------------------
dateInput.addEventListener('change', e => {
  currentDate = e.target.value;
  updateTableAndMap();
});

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('minimized');
    });
  }
});
