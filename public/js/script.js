

// --- Real-time Bus Tracking Client Script ---
// Handles role selection, location sharing, and map updates for both admin/user and bus roles.
// Admin/user sees both bus and self, with ETA and route. Bus only sees route.
// Uses OpenRouteService for route and ETA.


// Connect to backend via Socket.IO
const socket = io();

// --- Custom icons for user and bus ---
const myIcon = L.icon({
  iconUrl: 'pin.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});
const busIcon = L.icon({
  iconUrl: 'bus.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});


// --- State variables ---

let mySocketId = null; // This client's socket ID
let role = null; // 'admin' or 'bus'
let adminSocketId = null; // Socket ID of admin
let busSocketId = null; // Socket ID of bus
let adminLocation = null; // Admin's current location
let busLocation = null; // Bus's current location
let adminMarker = null; // Marker for admin
let busMarker = null; // Marker for bus


// --- Initialize map ---
const map = L.map("map").setView([20.5937,78.9629],5); // Default to India

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    attribution:"Vaibhav"
}).addTo(map);


// --- Role selection modal logic ---

window.onload = function() {
  // Show modal for role selection
  document.getElementById('roleModal').style.display = 'flex';
  document.getElementById('adminBtn').onclick = function() {
    role = 'admin';
    document.getElementById('roleModal').style.display = 'none';
    document.getElementById('infoPanel').style.display = 'block';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('roleLabel').innerText = 'Role: Admin/User';
    socket.emit('select-role', { role: 'admin' });
    startLocationWatch();
    updateDashboard();
  };
  document.getElementById('busBtn').onclick = function() {
    role = 'bus';
    document.getElementById('roleModal').style.display = 'none';
    document.getElementById('infoPanel').style.display = 'block';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('roleLabel').innerText = 'Role: Bus';
    socket.emit('select-role', { role: 'bus' });
    startLocationWatch();
    updateDashboard();
  };
};


// --- Start watching geolocation and send updates to server ---
function startLocationWatch() {
  if(navigator.geolocation){
    navigator.geolocation.watchPosition((position)=>{
        const {latitude,longitude}=position.coords;
        if(role === 'admin') {
          adminLocation = { latitude, longitude };
        } else if(role === 'bus') {
          busLocation = { latitude, longitude };
        }
        socket.emit("send-Location",{latitude,longitude, role});
        updateDashboard();
        // On first location, zoom to user
        if ((role === 'admin' && adminMarker) || (role === 'bus' && busMarker)) {
          const marker = role === 'admin' ? adminMarker : busMarker;
          if(marker) {
            map.setView(marker.getLatLng(), 16, { animate: true });
          }
        }
    },
    (error)=>{
        alert('Geolocation error: ' + error.message);
    },   
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });
  } else {
    alert('Geolocation not supported!');
  }
}


// --- Socket events ---
// On connect, store our socket ID
socket.on('connect', () => {
  mySocketId = socket.id;
});

// Receive current role assignments from server
socket.on('role-assignments', ({adminId, busId}) => {
  adminSocketId = adminId;
  busSocketId = busId;
});

// Receive all locations from server
socket.on("receive-location",(data)=>{
  const {id,latitude,longitude,role:senderRole} = data;

  // Update admin marker and location
  if(senderRole === 'admin') {
    adminLocation = { latitude, longitude };
    if(adminMarker) {
      adminMarker.setLatLng([latitude,longitude]);
    } else {
      adminMarker = L.marker([latitude,longitude], {icon: myIcon, title: "Admin/User"}).addTo(map);
    }
  }
  // Update bus marker and location
  if(senderRole === 'bus') {
    busLocation = { latitude, longitude };
    if(busMarker) {
      busMarker.setLatLng([latitude,longitude]);
    } else {
      busMarker = L.marker([latitude,longitude], {icon: busIcon, title: "Bus"}).addTo(map);
    }
  }
  updateDashboard();
// --- Dashboard update function ---
function updateDashboard() {
  const dash = document.getElementById('dashboard');
  if(!dash) return;
  // Show role
  document.getElementById('dashRole').innerHTML = `<b>Your Role:</b> ${role === 'admin' ? 'Admin/User' : 'Bus'}`;
  // Show your coordinates
  let youText = '';
  if(role === 'admin' && adminLocation) {
    youText = `<b>Your Location:</b> ${adminLocation.latitude.toFixed(5)}, ${adminLocation.longitude.toFixed(5)}`;
  } else if(role === 'bus' && busLocation) {
    youText = `<b>Your Location:</b> ${busLocation.latitude.toFixed(5)}, ${busLocation.longitude.toFixed(5)}`;
  } else {
    youText = `<b>Your Location:</b> Not available`;
  }
  document.getElementById('dashYou').innerHTML = youText;
  // Show other party's coordinates
  let otherText = '';
  if(role === 'admin' && busLocation) {
    otherText = `<b>Bus Location:</b> ${busLocation.latitude.toFixed(5)}, ${busLocation.longitude.toFixed(5)}`;
  } else if(role === 'bus' && adminLocation) {
    otherText = `<b>Admin Location:</b> ${adminLocation.latitude.toFixed(5)}, ${adminLocation.longitude.toFixed(5)}`;
  } else {
    otherText = `<b>Other Location:</b> Not available`;
  }
  document.getElementById('dashOther').innerHTML = otherText;
}

  // Center map on both markers if both exist
  if(adminMarker && busMarker) {
    const group = new L.featureGroup([adminMarker, busMarker]);
    map.fitBounds(group.getBounds().pad(0.2));
  } else if(adminMarker) {
    map.setView(adminMarker.getLatLng(), 16);
  } else if(busMarker) {
    map.setView(busMarker.getLatLng(), 16);
  }

  // Only admin sees ETA and route
  if(role === 'admin' && adminLocation && busLocation) {
    const distance = getDistanceFromLatLonInKm(
      adminLocation.latitude, adminLocation.longitude,
      busLocation.latitude, busLocation.longitude
    );
    showDistance(distance);
    getRouteAndETA(busLocation, adminLocation);
  }
});

// Remove markers if user disconnects
socket.on("user-disconnected",(id)=>{
  if(busMarker && id === busSocketId) {
    map.removeLayer(busMarker);
    busMarker = null;
    busLocation = null;
    showDistance(null);
    document.getElementById('route').innerHTML = '';
  }
  if(adminMarker && id === adminSocketId) {
    map.removeLayer(adminMarker);
    adminMarker = null;
    adminLocation = null;
    showDistance(null);
    document.getElementById('route').innerHTML = '';
  }
});


// --- UI helpers ---
let routePolyline = null; // Polyline for route
// Show distance in info panel
function showDistance(distance) {
  let etaDiv = document.getElementById('eta');
  if(distance !== null) {
    etaDiv.innerHTML = `Bus is <b>${distance.toFixed(2)} km</b> away from you.`;
  } else {
    etaDiv.innerHTML = '';
  }
}

// Draw route and show ETA using OpenRouteService API
async function getRouteAndETA(start, end) {
  // Remove previous route
  if(routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
  // OpenRouteService API key (demo, replace with your own for production)
  const apiKey = '5b3ce3597851110001cf6248b8b0b6fa6b1e4e0a8e1bfae6e1e2e1e2';
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start.longitude},${start.latitude}&end=${end.longitude},${end.latitude}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
      // Uber-style: bold, black, slightly transparent
      routePolyline = L.polyline(coords, {
        color: 'black',
        weight: 8,
        opacity: 0.85,
        lineJoin: 'round',
        dashArray: null
      }).addTo(map);
      // Fit map to route and markers
      if(adminMarker && busMarker) {
        const group = new L.featureGroup([adminMarker, busMarker, routePolyline]);
        map.fitBounds(group.getBounds().pad(0.2));
      }
      // Show route info
      const summary = data.features[0].properties.summary;
      const durationMin = Math.round(summary.duration/60);
      document.getElementById('route').innerHTML = `Route distance: <b>${(summary.distance/1000).toFixed(2)} km</b><br>Estimated arrival: <b>${durationMin} min</b>`;
    } else {
      document.getElementById('route').innerHTML = 'No route found.';
    }
  } catch (e) {
    document.getElementById('route').innerHTML = 'Route/ETA error.';
  }
}


// --- Haversine formula for distance (used for quick distance) ---
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371;
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return d;
}
function deg2rad(deg) {
  return deg * (Math.PI/180)
}