export class GPXManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.trackPoints = null;
        this.trackPointMarkers = [];
        this.totalDistance = 0;
        this.currentGpxObject = null;
        this.gpxXmlText = null;
    }

    loadGPX(e) {
        const file = e.target.files[0];
        if (!file) return;

        const blobUrl = URL.createObjectURL(file);
        this.createPolyline(blobUrl);

        //switch the icon to filled version to indicate a route is loaded
        const uploadBtnIcon = document.querySelector("#gpx-upload i");
        if (uploadBtnIcon) {
            uploadBtnIcon.classList.remove("bi-file-earmark-arrow-up");
            uploadBtnIcon.classList.add("bi-file-earmark-arrow-up-fill");
        }
    }

    createPolyline(gpxData) {
        this.removePreviousTrack();
        this.currentGpxObject = new L.GPX(gpxData, {
            async: true,
            polyline_options: {
                color: 'red',
                weight: 4
            },
            marker_options: {
                className: 'gpx-marker',
                startIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-start.png',
                endIconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-icon-end.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-gpx/1.7.0/pin-shadow.png'
            }
        })
        .on('loaded', async (e) => {         
            //extract the trackpoints form the file and save
            const url = this.currentGpxObject._gpx;
            this.gpxXmlText = await fetch(url).then(r => r.text());
            this.trackPoints = this.parseTrackPoints(this.gpxXmlText);
            this.mapManager.map.fitBounds(e.target.getBounds());
            this.createTrkptMarkers();
        })
        .addTo(this.mapManager.map);
    }

    parseTrackPoints(xmlText) {
        const xml = new DOMParser().parseFromString(xmlText, "text/xml");
        return [...xml.getElementsByTagName("trkpt")].map(pt => ({
            lat: parseFloat(pt.getAttribute("lat")),
            lon: parseFloat(pt.getAttribute("lon"))
        }));
    }

    createTrkptMarkers() {
        const trkpts = this.trackPoints;
        trkpts.forEach(pt => {
            const marker = L.circleMarker([pt.lat, pt.lon], {
                radius: 5,
                color: '#0044ff',
                fillColor: '#0044ff',
                fillOpacity: 0.7,
                weight: 2,
                className: 'track-point-marker'
            })
            //.bindPopup(`Lat: ${pt.lat.toFixed(4)}<br>Lon: ${pt.lon.toFixed(4)}`)
            .addTo(this.mapManager.map);
            this.trackPointMarkers.push(marker);
        });
    }

    removePreviousTrack() {
        if(this.currentGpxObject) {
            this.mapManager.map.removeLayer(this.currentGpxObject);
            // this.mapManager.map.eachLayer(l => {
            //     if (l instanceof L.Polyline) {
            //         this.mapManager.map.removeLayer(l);
            //     }
            // });
        }

        if(this.trackPoints) {
            this.trackPoints = [];
            this.gpxXmlText = null;
        }

        if (this.trackPointMarkers) {
            this.trackPointMarkers.forEach(m => {
                this.mapManager.map.removeLayer(m);
            });
            this.trackPointMarkers = [];
        }
    }
}