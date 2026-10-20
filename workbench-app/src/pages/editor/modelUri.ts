/** URI of the Monaco model that shows `path` of the workspace `root` (shared by the editor group and live playback). */
export const modelUri = (root: string, path: string) => `inmemory://wb/${encodeURIComponent(root)}/${path}`
