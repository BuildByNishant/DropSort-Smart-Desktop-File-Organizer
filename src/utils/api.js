// The preload script exposes window.dropsort. When the page is opened outside
// Electron (for example in a normal browser) it does not exist.
export const api = typeof window !== 'undefined' ? window.dropsort : undefined;
export const hasApi = Boolean(api);
