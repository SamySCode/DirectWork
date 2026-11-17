// Things kept in memory for the person using the app (an unsent application
// note, a link to return to) must not carry over to the next account on the
// same device. A module that keeps such a thing registers how to drop it
// here; the session hook calls `accountChanged` whenever the signed-in user
// changes, including to nobody.
const cleaners = new Set<() => void>();

export function onAccountChange(clean: () => void): void {
  cleaners.add(clean);
}

export function accountChanged(): void {
  cleaners.forEach((clean) => clean());
}
