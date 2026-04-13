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
        this.trackThreshold = 50 + this.lastKnownAccuracy;
        this.updateThrottle = 5000; // Minimum gap between navigation updates in milliseconds
        this.lastUpdateTime = 0;
        this.offRoute = false;

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
        if(this.isNavigating) {
            this.speechManager.speak("Navigation stopped");
            this.isNavigating = false;
            // switch navigation btn icon back to outline version
            const navigateBtnIcon = document.querySelector("#navigate i");
            if (navigateBtnIcon) {
                navigateBtnIcon.classList.remove("bi-signpost-split-fill");
                navigateBtnIcon.classList.add("bi-signpost-split");
            }
            return;
        }

        //make sure we have a valid set of track points to navigate on
        const trkpts = this.gpxManager.trackPoints;
        if (trkpts.length < 1) {
            this.speechManager.speak("Route not found in the GPX file.");
            return;
        }

        const { latlng, distanceMeters } = this.mapManager.getClosestPointOnPolyline(this.lastKnownLocation);
        if (distanceMeters > this.trackThreshold + this.lastKnownAccuracy) {
            this.isNavigating = false;
            console.log("Too far from route", `You are ${Math.round(distanceMeters)} meters from the route.`);
            this.speechManager.speak(`Navigation stopped. You are too far from the route. Route is ${Math.round(distanceMeters)} meters away.`);
            return;
        }

        this.isNavigating = true;
        this.speechManager.speak("Navigation started");

        // switch navigation btn icon to filled version
        const navigateBtnIcon = document.querySelector("#navigate i");
        if (navigateBtnIcon) {
            navigateBtnIcon.classList.remove("bi-signpost-split");
            navigateBtnIcon.classList.add("bi-signpost-split-fill");
        }
        this.updateNavigation();
    }

    updateNavigation() {
        if (!this.isNavigating) return;

        //make sure the updates are throttled to avoid excessive processing, updates
        const now = performance.now();
        if (now - this.lastUpdateTime < this.updateThrottle) return;
        this.lastUpdateTime = now;
        
        const distanceOffRoute = this.offRouteDetection();
        if(distanceOffRoute > 0) {
            if(!this.offRoute) {
                this.offRoute = true;
                console.log("Off route", `You are ${Math.round(distanceOffRoute)} meters away.`);
                this.speechManager.speak(`Off route. You are ${Math.round(distanceOffRoute)} meters from the route.`);
            }
        }
        else
        {
            if(this.offRoute) { 
                this.offRoute = false;
                console.log("On route", `You are back on route.`);
                this.speechManager.speak(`You are back on route.`);
            }
        }
    }

    offRouteDetection() {
        const { latlng, distanceMeters } = this.mapManager.getClosestPointOnPolyline(this.lastKnownLocation);
        if (distanceMeters > this.trackThreshold + this.lastKnownAccuracy)
            return distanceMeters;
        else
            return 0;
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
