let counter = 0;

export function generateId() {
  counter++;
  return `${Date.now().toString(36)}_${counter.toString(36)}`;
}
