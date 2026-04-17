export default class TileUtil {

  static latLngToTile(lat, lon, zoom) {
    const x = (lon + 180) / 360 * Math.pow(2, zoom);
    const y = (
      1 - Math.log(Math.tan(lat * Math.PI/180) + 1/Math.cos(lat * Math.PI/180)) / Math.PI
    ) / 2 * Math.pow(2, zoom);

    return { x, y };
  }

  static generateTileUrls(bounds, zoom, tileUrlTemplate) {
    const urls = [];

    const sw = this.latLngToTile(bounds.getSouth(), bounds.getWest(), zoom);
    const ne = this.latLngToTile(bounds.getNorth(), bounds.getEast(), zoom);

    // Normalize tile ranges (Web Mercator Y increases downward)
    let minX = Math.floor(Math.min(sw.x, ne.x));
    let maxX = Math.floor(Math.max(sw.x, ne.x));

    let minY = Math.floor(Math.min(sw.y, ne.y));
    let maxY = Math.floor(Math.max(sw.y, ne.y));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        urls.push(
          tileUrlTemplate
            .replace("{z}", zoom)
            .replace("{x}", x)
            .replace("{y}", y)
        );
      }
    }

    return urls;
  }

  static generateForAllZooms(bounds, minZoom, maxZoom, tileUrlTemplate) {
    let urls = [];
    for (let z = minZoom; z <= maxZoom; z++) {
      urls.push(...this.generateTileUrls(bounds, z, tileUrlTemplate));
      //console.log('genForAllZooms', bounds, z, tileUrlTemplate);
    }
    // console.log('generateForAllZooms', urls, bounds, minZoom, maxZoom, tileUrlTemplate);
    return urls;
  }

  static sendToServiceWorker(urls) { //console.log('sending to service worker', urls);
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CACHE_TILES",
        tiles: urls
      });

      // Initiate the listeener but prevent duplicate listeners
      if (!TileUtil._listenerAdded) {
        TileUtil._listenerAdded = true;
        TileUtil.listenForTileCacheResponse();
      }
    }
  }

  static listenForTileCacheResponse() {
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type === "TILE_CACHE_PROGRESS") {
        const { percent, index, total } = event.data;
        TileUtil.updateProgress(percent);
      }
    });
  }

  static updateProgress(percent) {
    const parent = document.getElementById('progress');
    if (!parent) return;

    const bar = parent.querySelector('.progress-bar');
    if (!bar) return;

    if(percent === 100) {
      setTimeout(function() { parent.style.display = 'none' }, 3000);
    }
    else {
      parent.style.display = 'block';
    }

    bar.style.width = percent + '%';
    bar.setAttribute('aria-valuenow', percent);
    // bar.textContent = percent + '%';
  }

}