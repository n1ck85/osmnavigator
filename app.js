function loadVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        console.log("Loaded voices:", voices);
    }
}
speechSynthesis.onvoiceschanged = loadVoices;

map = window.map = null;
initializeMap([51.505, -0.09], 13);
map.locate({ watch: true, setView: false, maxZoom: 16 });
window.lastknownLocation = null;

function initializeMap(coords, zoom) {
  map = L.map('map').setView(coords, zoom);
  
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}


map.on('locationfound', function(e) { 
    //console.log('Location found:', e.latlng, 'Accuracy:', e.accuracy);

    if (!window.lastknownLocation) {
        // First update -> create the marker
        // userMarker = L.marker(e.latlng).addTo(map);

        const headingIcon = L.divIcon({
            className: "",
            html: `<div id="heading-marker" class="my-location"></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        // Create the user marker
        window.userMarker = L.marker(e.latlng, { icon: headingIcon }).addTo(map);

        // Create the accuracy circle
        window.accuracyCircle = L.circle(e.latlng, {
            radius: e.accuracy,
            color: 'blue',
            fillOpacity: 0
        }).addTo(map);

        window.addEventListener("deviceorientation", (event) => {
            let heading;

            if (event.webkitCompassHeading) {
                // iOS gives true compass heading
                heading = event.webkitCompassHeading;
            } else {
                // Android: alpha is relative to device orientation
                heading = 360 - event.alpha;
            }

            const el = document.getElementById("heading-marker");
            if (el) {
                el.style.transform = `rotate(${heading}deg)`;
            }
        });

    } else {
        // All future updates -> move the same marker
        window.userMarker.setLatLng(e.latlng);
        window.accuracyCircle.setLatLng(e.latlng).setRadius(e.accuracy);
    }

    //center without zooming in
    map.panTo(e.latlng);

    window.lastknownLocation = e.latlng;

    if(window.navigating) {
        navigate();
    }
});

map.on('locationerror', function(e) {
  console.error(e.message);
});

function initNavigation() {
    window.navigating = true;
    const trkpts = getGpxPointsAsArray();

    if (trkpts.length < 1) {
        speak("No track points found in the GPX file.");
        alert("No track points found in the GPX file.");
        return
    }
    
    let { closestTrkpt, dist } = getClosestTrkpt(window.lastknownLocation, trkpts);
    console.log("Closest track point:", closestTrkpt, "Distance:", dist);

    if (dist > window.trackThreshold) {
        speak(`You are ${Math.round(dist)} meters from the route.`);
        return;
    }

    speak("Navigation started");

    navigate();
}

function navigate() {
    let { closestTrkpt, dist } = getClosestTrkpt(window.lastknownLocation, getGpxPointsAsArray());

    if (dist > window.trackThreshold) {
        notification("Off route", `You are ${Math.round(dist)} meters from the route.`);
        speak(`You are ${Math.round(dist)} meters from the next waypoint.`);
    }

}

function notify(title, message) {
    //popup modal or browser notification with autohide after x seconds
}



function getClosestTrkpt(currentPos, trkpts) { 
    console.log(currentPos.lat, currentPos.lng);
    let closest = null;
    let minDist = Infinity;

    trkpts.forEach(trkpt => {
        const dist = map.distance(
            L.latLng(currentPos.lat, currentPos.lng),
            L.latLng(trkpt.lat, trkpt.lon)
        );

        if (dist < minDist) {
            minDist = dist;
            closest = trkpt;
        }
    });

    return { closestTrkpt: closest, dist: minDist };
}                                                                     

function speak(text) {
    const msg = new SpeechSynthesisUtterance(text);

    const voices = speechSynthesis.getVoices();
    const chosenVoice = voices.find(v => v.name === "Microsoft Zira - English (United States)");

    if (chosenVoice) {
        msg.voice = chosenVoice;
        console.log("Using voice:", chosenVoice.name);
    } else {
        console.warn("Zira not found, using default voice.");
    }

    speechSynthesis.speak(msg);

    // if(!('speechSynthesis' in window)) {
    //     console.warn("Speech Synthesis not supported in this browser.");
    //     return;
    // }
    // const synth = window.speechSynthesis;
    // const voices = speechSynthesis.getVoices();
    // const zira = voices.find(v => v.name === "Microsoft Zira - English (United States)");

    // if (zira) {
    //     console.log("Using voice:", zira.name);
    // } else {
    //     console.warn("Zira not found, using default voice.");
    // }

    // const utterThis = new SpeechSynthesisUtterance(text);
    // if(!synth.speaking) {
    //     synth.speak(utterThis);
    // }
}

function getGpxPointsAsArray() {
    if (window.trkpts && window.trkpts.length > 0) { console.log("Using cached track points.");
        return window.trkpts;
    }

    const xml = new DOMParser().parseFromString(window.currentGpxLayer._gpx, "text/xml");
    window.trkpts = [...xml.getElementsByTagName("trkpt")].map(pt => ({
        lat: parseFloat(pt.getAttribute("lat")),
        lon: parseFloat(pt.getAttribute("lon"))
    }));

    //find the average distance between each point so we can use it as a threshold for accuracy durning navigation 
    let averageDistanceBetweenPoints = window.totalDistance / (window.trkpts.length - 1);
    window.trackThreshold = averageDistanceBetweenPoints * 1.3; // Set threshold to 1.5 times the average distance
    console.log("Track points loaded and cached. Average distance between points:", window.trackThreshold);

    return window.trkpts;
    
}

document.getElementById('navigate').addEventListener('click', initNavigation);
document.getElementById('gpx-upload').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (evt) {
    const gpxData = evt.target.result;

    // Remove previous GPX layer if needed
    if (window.currentGpxLayer) {
      map.removeLayer(window.currentGpxLayer);
    }

    // Clear cached track points when loading new file
    window.trkpts = null;

    // Load new GPX
    window.currentGpxLayer = new L.GPX(gpxData, {
      async: true,
      polyline_options: {
        color: 'red',
        weight: 4
      },
      marker_options: {
        startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
        endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png'
      }
    })
    .on('loaded', e => {
      map.fitBounds(e.target.getBounds());

      window.totalDistance = e.target.get_distance();

      // Visualize all track points
      const trkpts = getGpxPointsAsArray();
      trkpts.forEach(pt => {
        L.circleMarker([pt.lat, pt.lon], {
          radius: 5,
          color: '#0044ff',
          fillColor: '#0044ff',
          fillOpacity: 0.7,
          weight: 2
        }).bindPopup(`Lat: ${pt.lat.toFixed(4)}<br>Lon: ${pt.lon.toFixed(4)}`).addTo(map);
      });
      
    })
    .addTo(map);
  };

  reader.readAsText(file);
});

