export class NavigationManager {
    constructor(mapManager, gpxManager, speechManager, deviceManager) {
        this.mapManager = mapManager;
        this.gpxManager = gpxManager;
        this.speechManager = speechManager;
        this.deviceManager = deviceManager;
        this.isNavigating = false;
        this.followUser = true;
        this.lastKnownLocation = null;
        this.lastKnownAccuracy = null;
        this.trackThreshold = 50;

        this.setupLocationHandlers();
    }

    setupLocationHandlers() {
        this.mapManager.map.on('locationfound', (e) => this.onLocationFound(e));
        this.mapManager.map.on('locationerror', (e) => this.onLocationError(e));
    }

    startLocationTracking() {
        this.mapManager.map.locate({ 
            watch: true, 
            enableHighAccuracy: true,
            minimumAge: 3000,
            setTimeout: 8000,
            setView: false, 
            maxZoom: 16 
        });
    }

    onLocationFound(e) { 
        this.deviceManager.supportLogger("Location Update", `Location found: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)} (accuracy: ${Math.round(e.accuracy)}m)`);
        if (!this.lastKnownLocation) {
            this.mapManager.createUserMarker(e.latlng);
            this.mapManager.createAccuracyCircle(e.latlng, e.accuracy);
        } else {
            this.mapManager.updateUserMarker(e.latlng, e.accuracy);
        }

        if (this.followUser) {
            this.mapManager.map.panTo(e.latlng);
        }

        this.lastKnownLocation = e.latlng; 
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

    startNavigation() {
        //this.mapManager.navigating = true;
        this.isNavigating = true;
        // window.navigationManager = this;

        const trkpts = this.gpxManager.getTrackPoints();
        if (trkpts.length < 1) {
            this.speechManager.speak("Route not found in the GPX file.");
            return;
        }

        const { closestTrkpt, dist } = this.mapManager.getClosestTrackPoint(this.lastKnownLocation, trkpts);
        if (dist > this.trackThreshold + this.lastKnownAccuracy) {
            this.isNavigating = false;
            console.log("Too far from route", `You are ${Math.round(dist)} meters from the route.`);
            this.speechManager.speak(`Navigation not started. You are to far from the route. Route is ${Math.round(dist)} meters away.`);
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

        if (distanceMeters > this.trackThreshold + this.lastKnownAccuracy) {
            console.log("Off route", `You are ${Math.round(distanceMeters)} meters from the route.`);
            this.speechManager.speak(`You are ${Math.round(distanceMeters)} meters from the route.`);
        }
    }

    toggleFollowUser(e) {
        this.followUser = !this.followUser;
        const icon = e.currentTarget.querySelector("i");
        icon.classList.toggle("bi-crosshair", !this.followUser);
        icon.classList.toggle("bi-crosshair2", this.followUser);
    }

    stopFollowingUser() {
        this.followUser = false;
        const icon = document.querySelector("#follow-user i");
        if (icon) {
            icon.classList.remove("bi-crosshair2");
            icon.classList.add("bi-crosshair");
        }
    }
}
