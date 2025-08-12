let allRefuges = []
let currentDate = getCurrentDate()

let table,
  map,
  markers = []

const welcomeHtml = document.getElementById('info-panel').outerHTML

const infoPanel = document.getElementById('info-panel')
const dateInput = document.getElementById('date-picker')

function escapeHTML (str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getCurrentDate () {
  let today = new Date()
  let formatter = new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris'
  })

  let [day, month, year] = formatter.format(today).split('/')
  return `${year}-${month}-${day}`
}
// ---------------------- Constants ----------------------
const normalize = str =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const greenIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const redIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

// ---------------------- Utility Functions ----------------------
function formatAvailability (val) {
  if (val === null || val === undefined) return `<span class="unknown">?</span>`
  return val > 0
    ? `<span class="available">${escapeHTML(val)}</span>`
    : `<span class="unavailable">0</span>`
}

function showInfo (refuge) {
  const raw = refuge.availability?.[currentDate]
  const avail = raw === undefined || raw === null ? '?' : raw

  let urlsHTML = ''
  if (Array.isArray(refuge.urls)) {
    urlsHTML = refuge.urls
      .map(
        url =>
          `<a href="${escapeHTML(
            url
          )}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`
      )
      .join('<br>')
  }

  infoPanel.innerHTML = `
    <h3>${escapeHTML(refuge.name)}</h3>
    <p><strong>Altitude:</strong> ${escapeHTML(refuge.altitude_m || '?')} m</p>
    <p><strong>Capacity:</strong> ${escapeHTML(refuge.places || '?')} places</p>
    <p><strong>Gardien(s):</strong> ${escapeHTML(
      refuge.gardien || 'Non renseigné'
    )}</p>
    <p><strong>Available on ${escapeHTML(currentDate)}:</strong> ${escapeHTML(
    avail
  )}</p>
    ${refuge.description ? `<p>${escapeHTML(refuge.description)}</p>` : ''}
    ${urlsHTML}
  `
}

function resetView () {
  table.clearFilter()
  updateTableAndMap()
  infoPanel.innerHTML = welcomeHtml
}

// ---------------------- Main Update ----------------------
function updateTableAndMap () {
  const bounds = map.getBounds()

  const filtered = allRefuges
    .map(r => {
      const raw = r.availability?.[currentDate]
      return {
        ...r,
        available_places: raw === undefined ? null : raw
      }
    })
    .filter(r => r.lat && r.lng && bounds.contains([r.lat, r.lng]))

  table.setData(filtered)

  markers.forEach(({ marker, refuge }) => {
    const raw = refuge.availability?.[currentDate]
    marker.setIcon(raw > 0 ? greenIcon : redIcon)
    const safeName = escapeHTML(refuge.name)
    const safeRaw = escapeHTML(raw ?? '?')
    marker.setPopupContent(
      `<strong>${safeName}</strong><br>Available on ${escapeHTML(
        currentDate
      )}: ${safeRaw}`
    )
  })
}

// ---------------------- Init Functions ----------------------
function initMap () {
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap contributors, © OpenStreetMap contributors',
    maxZoom: 17
  })
  const osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '© OpenStreetMap contributors'
    }
  )
  const baseLayers = {
    OpenStreetMap: osm,
    Topographic: topo
  }

  map = L.map('map', {
    center: [45.5, 6.5],
    zoom: 8,
    layers: [topo]
  })

  L.control.layers(baseLayers).addTo(map)

  map.on('popupclose', resetView)
  map.on('click', resetView)
  map.on('moveend', updateTableAndMap)
}

function initTable () {
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
  })
  table.on('tableBuilt', function () {
    table.on('rowClick', (e, row) => {
      const refuge = row.getData()
      if (refuge.lat && refuge.lng) {
        showInfo(refuge)
        table.clearFilter()
        table.setFilter('structure', '=', refuge.structure)

        const markerObj = markers.find(
          m => m.refuge.lat === refuge.lat && m.refuge.lng === refuge.lng
        )
        if (markerObj) markerObj.marker.openPopup()
      }
    })
  })
}

function initMarkers () {
  markers = allRefuges
    .map(refuge => {
      if (!refuge.lat || !refuge.lng) return null

      const marker = L.marker([refuge.lat, refuge.lng]).addTo(map).bindPopup('')

      marker.on('click', () => {
        showInfo(refuge)
        table.clearFilter()
        table.setFilter('structure', '=', refuge.structure)
      })

      return { marker, refuge }
    })
    .filter(Boolean)
}

// ---------------------- Data Loading ----------------------
Promise.all([
  fetch('refuges.json').then(r => r.json()),
  fetch('refuge_availabilities.json').then(r => r.json())
]).then(([metaData, availabilityData]) => {
  const metaMap = {}
  metaData.forEach(ref => {
    const norm = normalize(ref.name)
    if (norm) metaMap[norm] = ref
  })

  allRefuges = availabilityData.map(ref => {
    const norm = normalize(ref.name)
    const meta = metaMap[norm] || {}
    return {
      ...ref,
      lat: meta.lat || null,
      lng: meta.lng || null,
      description: meta.description || '',
      urls: meta.urls || [],
      gardien: meta.gardien || '',
      altitude_m: meta.altitude_m || ref.altitude_m || null,
      places: meta.places || ref.places || null
    }
  })

  initMap()
  initTable()
  initMarkers()
  updateTableAndMap()
})

// ---------------------- Event Listeners ----------------------
dateInput.addEventListener('change', e => {
  currentDate = e.target.value
  updateTableAndMap()
})
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-sidebar')
  const sidebar = document.getElementById('sidebar')
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('minimized')
    })
  }
})
