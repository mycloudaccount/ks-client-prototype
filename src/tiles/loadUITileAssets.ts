import { getAllTiles } from "./tileLoader";

let imagesLoaded = false;

/**
 * Loads tiles.json AND ensures all tile images are loaded by the browser.
 * Safe to call multiple times.
 */
export async function loadTileAssets(): Promise<void> {
  if (imagesLoaded) return;

  const tiles = getAllTiles();

  // Collect unique image filenames
  const imageFiles = new Set<string>();

  for (const tile of tiles) {
    for (const file of Object.values(tile.images)) {
      imageFiles.add(file);
    }
  }

  // Preload images via browser
  await Promise.all(
    [...imageFiles].map((file) => {
      const src = `/assets/tiles/${file}`;

      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error(`Failed to load tile image: ${src}`));
      });
    })
  );

  imagesLoaded = true;
}
