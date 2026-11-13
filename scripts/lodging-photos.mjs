// Local illustrative photos keep the prototype gallery independent of external services.
export function lodgingPhotos(id) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return [
    `lodgings/room-${(seed % 4) + 1}.jpg`,
    `lodgings/room-${((seed + 1) % 4) + 1}.jpg`,
    `lodgings/room-${((seed + 2) % 4) + 1}.jpg`,
  ];
}
