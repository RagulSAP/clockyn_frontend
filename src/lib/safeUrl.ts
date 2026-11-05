/** True for absolute http(s) URLs only — use before handing a server- or user-supplied link to `Linking.openURL`. */
export function isHttpUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim());
}
