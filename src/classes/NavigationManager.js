export class NavigationManager {
    constructor(mapManager, gpxManager, speechManager) {
        this.mapManager = mapManager;
        this.gpxManager = gpxManager;
        this.speechManager = speechManager;
        this.isNavigating = false;
        this.lastKnownLocation = null;
        this.lastKnownAccuracy = null;
        this.trackThreshold = 50;

        this.setupLocationHandlers();
    }

    setupLocationHandlers() {
        this.mapManager.map.on('locationfound', (e) => this.onLocationFound(e));
        this.mapManager.map.on('locationerror', (e) => this.onLocationError(e));
    }

    onLocationFound(e) {
        if (!this.lastKnownLocation) {
            this.mapManager.createUserMarker(e.latlng);
            this.mapManager.createAccuracyCircle(e.latlng, e.accuracy);
        } else {
            this.mapManager.updateUserMarker(e.latlng, e.accuracy);
        }

        this.mapManager.map.panTo(e.latlng);
        this.lastKnownLocation = e.latlng; 
        console.log("Updated location:", this.lastKnownLocation);
        this.lastKnownAccuracy = e.accuracy;
        document.getElementById("accuracy-value").textContent = `${Math.round(e.accuracy)} meters`;

        // Trigger navigation update if active
        if (this.isNavigating) {
            this.updateNavigation();
        }
    }

    onLocationError(e) {
        console.error(e.message);
    }

    startLocationTracking() {
        this.mapManager.map.locate({ 
            watch: true, 
            enableHighAccuracy: true,
            minimumAge: 1000,
            setTimeout: 10000,
            setView: false, 
            maxZoom: 16 
        });
    }

    startNavigation() { console.log("Starting navigation...");
        //this.mapManager.navigating = true;
        this.isNavigating = true;
        window.navigationManager = this;

        const trkpts = this.gpxManager.getTrackPoints();

        if (trkpts.length < 1) {
            this.speechManager.speak("No track points found in the GPX file.");
            alert("No track points found in the GPX file.");
            return;
        }

        const { closestTrkpt, dist } = this.mapManager.getClosestTrackPoint(this.lastKnownLocation, trkpts);
        console.log("Closest track point:", closestTrkpt, "Distance:", dist);

        if (dist > this.trackThreshold + this.lastKnownAccuracy) {
            this.speechManager.speak(`You are ${Math.round(dist)} meters from the route.`);
            return;
        }

        this.speechManager.speak("Navigation started");
        this.updateNavigation();
    }

    updateNavigation() {
        if (!this.isNavigating) return;

        const { latlng, distanceMeters } = this.mapManager.getClosestPointOnPolyline(this.lastKnownLocation);
        // const trkpts = this.getTrackPoints();
        // const { closestTrkpt, dist } = this.mapManager.getClosestTrackPoint(this.lastKnownLocation, trkpts);

        console.log("Last known location:", this.lastKnownLocation);

        if (distanceMeters > this.trackThreshold + this.lastKnownAccuracy) {
            console.log("Off route", `You are ${Math.round(distanceMeters)} meters from the route.`);
            this.speechManager.speak(`You are ${Math.round(distanceMeters)} meters from the route line.`);
        }
    }
}
