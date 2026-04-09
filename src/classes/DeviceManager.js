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
        if (el) {
            el.style.transform = `rotate(${heading}deg)`;
        }
    }

    toggleWakeLock(e) {
        if ('wakeLock' in navigator && !this.wakeLockActive) {
            navigator.wakeLock.request('screen').then(sentinel => {
                this.wakeLockSentinel = sentinel;
                e.target.innerHTML = "Disable Keep Awake";
                this.wakeLockActive = true;
            }).catch(err => {
                console.error('Wake Lock failed:', err);
                this.supportLogger("Wake Lock", "Failed to activate Wake Lock.");
            });
        } else if (this.wakeLockActive && this.wakeLockSentinel) {
            this.wakeLockSentinel.release().then(() => {
                e.target.innerHTML = "Keep Awake";
                this.wakeLockActive = false;
            });
        } else {
            this.supportLogger("Wake Lock", "Wake Lock API not supported in this browser.");
        }
    }
}