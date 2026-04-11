export class GPXManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.trackPoints = null;
        this.totalDistance = 0;
        this.currentGpxLayer = null;
    }

    loadGPX(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => this.parseGPX(evt.target.result);
        reader.readAsText(file);
    }

    parseGPX(gpxData) {
        // Remove previous GPX layer
        if (this.currentGpxLayer) {
            this.mapManager.map.removeLayer(this.currentGpxLayer);
        }

        this.trackPoints = null;
        this.createPolyline(gpxData);

        //switch the icon to filled version to indicate a route is loaded
        const uploadBtnIcon = document.querySelector("#gpx-upload i");
        if (uploadBtnIcon) {
            uploadBtnIcon.classList.remove("bi-file-earmark-arrow-up");
            uploadBtnIcon.classList.add("bi-file-earmark-arrow-up-fill");
        }
    }

    createPolyline(gpxData) {
        this.currentGpxLayer = new L.GPX(gpxData, {
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
        .on('loaded', (e) => {
            const polylines = this.extractAllPolylines(e.target);

            // Pick the first polyline (usually the route)
            this.polyline = polylines[0];
            this.mapManager.createVisibleMarkers(e);

        })
        .addTo(this.mapManager.map);
    }

    /**
     * Recursively extract all polylines from a layer (handles nested layers)
     * @param {L.Layer} layer - The layer to search for polylines
     * @returns {L.Polyline[]} - An array of polylines found in the layer
     */
    extractAllPolylines(layer) {
        let result = [];

        // If this layer IS a polyline, store it
        if (layer instanceof L.Polyline) {
            result.push(layer);
        }

        // If this layer contains sublayers, search inside them
        if (layer.getLayers) {
            layer.getLayers().forEach(sub => {
                result = result.concat(this.extractAllPolylines(sub));
            });
        }

        return result;
    }


    getTrackPoints() {
        if (this.trackPoints && this.trackPoints.length > 0) {
            console.log("Using cached track points.");
            return this.trackPoints;
        }

        const xml = new DOMParser().parseFromString(this.currentGpxLayer._gpx, "text/xml");
        this.trackPoints = [...xml.getElementsByTagName("trkpt")].map(pt => ({
            lat: parseFloat(pt.getAttribute("lat")),
            lon: parseFloat(pt.getAttribute("lon"))
        }));

        // const averageDistanceBetweenPoints = this.totalDistance / (this.trackPoints.length - 1);
        // this.trackThreshold = (averageDistanceBetweenPoints / 2) + this.mapManager.lastKnownAccuracy;

        return this.trackPoints;
    }
}