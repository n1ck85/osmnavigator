export class DeviceManager {
    constructor() {
        this.wakeLockSentinel = null;
        this.wakeLockActive = false;
    }

    startOrientationTracking() {
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
    }

    toggleWakeLock(e) {
        if ('wakeLock' in navigator && !this.wakeLockActive) {
            navigator.wakeLock.request('screen').then(sentinel => {
                this.wakeLockSentinel = sentinel;
                e.target.innerHTML = "Disable Keep Awake";
                this.wakeLockActive = true;
            }).catch(err => {
                console.error('Wake Lock failed:', err);
                alert("Failed to activate Wake Lock.");
            });
        } else if (this.wakeLockActive && this.wakeLockSentinel) {
            this.wakeLockSentinel.release().then(() => {
                e.target.innerHTML = "Keep Awake";
                this.wakeLockActive = false;
            });
        } else {
            alert("Wake Lock API not supported in this browser.");
        }
    }
}