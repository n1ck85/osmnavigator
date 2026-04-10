export class GPXManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.trackPoints = null;
        this.totalDistance = 0;
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
        this.mapManager.createPolyline(gpxData);

        //switch the icon to filled version to indicate a route is loaded
        const uploadBtnIcon = document.querySelector("#gpx-upload i");
        if (uploadBtnIcon) {
            uploadBtnIcon.classList.remove("bi-file-earmark-arrow-up");
            uploadBtnIcon.classList.add("bi-file-earmark-arrow-up-fill");
        }
    }

    getTrackPoints() {
        if (this.trackPoints && this.trackPoints.length > 0) {
            console.log("Using cached track points.");
            return this.trackPoints;
        }

        const xml = new DOMParser().parseFromString(this.mapManager.currentGpxLayer._gpx, "text/xml");
        this.trackPoints = [...xml.getElementsByTagName("trkpt")].map(pt => ({
            lat: parseFloat(pt.getAttribute("lat")),
            lon: parseFloat(pt.getAttribute("lon"))
        }));

        // const averageDistanceBetweenPoints = this.totalDistance / (this.trackPoints.length - 1);
        // this.trackThreshold = (averageDistanceBetweenPoints / 2) + this.mapManager.lastKnownAccuracy;

        return this.trackPoints;
    }
}