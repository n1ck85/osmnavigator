export class DeviceManager {
    constructor() {
        this.wakeLockSentinel = null;
        this.wakeLockActive = false;
        this.getHeading = this.getHeading.bind(this);
    }

    supportLogger(name,message) {
        const logEl = document.getElementById("device-support-log");
        if (logEl) {
            const entry = document.createElement("div");
            entry.textContent = `${name}: ${message}`;
            //log without duplicates
            if (!logEl.textContent.includes(entry.textContent)) {
                logEl.appendChild(entry);
            }
        }
    }

    startOrientationTracking() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ Safari requires this call
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', this.getHeading);
                    }
                }).catch(console.error);
        } else {
            // Non-iOS 13+ or desktop: events fire automatically
            window.addEventListener('deviceorientation', this.getHeading);
        }
    }

    getHeading(event) {
        let heading;

        if (event.webkitCompassHeading) {
            // iOS gives true compass heading
            heading = event.webkitCompassHeading;
        } else {
            // Android: use absolute orientation to calculate heading
            if (event.alpha !== null) {
                heading = 360 - event.alpha; // Convert to compass heading
            } else {
                heading = null; // No valid heading available
                this.supportLogger("Device Orientation", "Device orientation does not provide a valid heading.");
            }
        }

        const el = document.getElementById("heading-marker");

        //calibrate heading to north using gps location if available
        navigator.geolocation.watchPosition(pos => { 
            if (!pos.coords.heading) {
                this.supportLogger("Debug", "GPS heading not available");
            }
            else {               
                this.supportLogger("Debug", `GPS Heading: ${pos.coords.heading.toFixed(2)}°`);
            }

            const gpsHeading = pos.coords.heading; // degrees, 0–360
            if (gpsHeading !== null && !isNaN(gpsHeading)) {
                const deviceAlpha = currentAlpha; // from DeviceOrientationEvent
                const offset = (gpsHeading - deviceAlpha + 360) % 360;
                const heading = (deviceAlpha + offset + 360) % 360;
                console.log(`GPS Heading: ${gpsHeading.toFixed(2)}°`);
                //update the heading marker
                el.style.transform = `rotate(${heading}deg)`;
            }

        });

        if (el) {
            el.style.transform = `rotate(${heading}deg)`;
        }
    }

    toggleWakeLock(e) {
        if ('wakeLock' in navigator && !this.wakeLockActive) {
            navigator.wakeLock.request('screen').then(sentinel => {
                this.wakeLockSentinel = sentinel;
                e.target.parentElement.innerHTML = "<i class='bi bi-eye-slash'></i>";
                this.wakeLockActive = true;
            }).catch(err => {
                console.error('Wake Lock failed:', err);
                this.supportLogger("Wake Lock", "Failed to activate Wake Lock.");
            });
        } else if (this.wakeLockActive && this.wakeLockSentinel) {
            this.wakeLockSentinel.release().then(() => {
                e.target.parentElement.innerHTML = "<i class='bi bi-eye'></i>";
                this.wakeLockActive = false;
            });
        } else {
            this.supportLogger("Wake Lock", "Wake Lock API not supported in this browser.");
        }
    }
}