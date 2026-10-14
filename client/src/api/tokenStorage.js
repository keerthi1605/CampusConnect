const KEY = 'campusconnect_token'

// localStorage can throw (blocked site data, private windows), so never let it crash the app
export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(KEY, token)
    } catch {
      /* the session just won't survive a refresh */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* nothing to clear */
    }
  },
}
