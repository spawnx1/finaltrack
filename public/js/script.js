const socket = io();

const BUS_SOCKET_ID = 'PASTE_BUS_SOCKET_ID_HERE'; // Replace with actual bus socket id

// Custom icons
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

let mySocketId = null;
let myLocation = null;
let busLocation = null;
let myMarker = null;
let busMarker = null;

const map = L.map("map").setView([0,0],16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    attribution:"Vaibhav"
}).addTo(map);

socket.on('connect', () => {
  mySocketId = socket.id;

  if(navigator.geolocation){
    navigator.geolocation.watchPosition((position)=>{
        const {latitude,longitude}=position.coords;
        myLocation = { latitude, longitude };
        socket.emit("send-Location",{latitude,longitude});
    },
    (error)=>{
        console.error(error);
    },   
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });
  }
});

socket.on("receive-location",(data)=>{
  const {id,latitude,longitude} = data;

  // My marker
  if(id === mySocketId) {
    myLocation = { latitude, longitude };
    if(myMarker) {
      myMarker.setLatLng([latitude,longitude]);
    } else {
      myMarker = L.marker([latitude,longitude], {icon: myIcon, title: "Me"}).addTo(map);
      map.setView([latitude,longitude], 16);
    }
  }
  // Bus marker
  else if(id === BUS_SOCKET_ID) {
    busLocation = { latitude, longitude };
    if(busMarker) {
      busMarker.setLatLng([latitude,longitude]);
    } else {
      busMarker = L.marker([latitude,longitude], {icon: busIcon, title: "Bus"}).addTo(map);
    }
  }

  // Show distance if both locations are known
  if(myLocation && busLocation) {
    const distance = getDistanceFromLatLonInKm(
      myLocation.latitude, myLocation.longitude,
      busLocation.latitude, busLocation.longitude
    );
    showDistance(distance);
  }
});

socket.on("user-disconnected",(id)=>{
  if(id === BUS_SOCKET_ID && busMarker) {
    map.removeLayer(busMarker);
    busMarker = null;
    busLocation = null;
    showDistance(null);
  }
});

function showDistance(distance) {
  let distDiv = document.getElementById('distance');
  if (!distDiv) {
    distDiv = document.createElement('div');
    distDiv.id = 'distance';
    distDiv.style.position = 'absolute';
    distDiv.style.top = '10px';
    distDiv.style.right = '10px';
    distDiv.style.background = 'white';
    distDiv.style.padding = '10px';
    distDiv.style.borderRadius = '8px';
    distDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    document.body.appendChild(distDiv);
  }
  if(distance !== null) {
    distDiv.innerHTML = `Bus is ${distance.toFixed(2)} km away from you.`;
  } else {
    distDiv.innerHTML = '';
  }
}

// Haversine formula
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