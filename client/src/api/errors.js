/**
 * Turns any axios error into { message, fieldErrors } for display.
 * The API answers failures as { success:false, message, errors?: [{ field, message }] }.
 */
export function parseApiError(error) {
  if (!error.response) {
    return {
      message: 'Cannot reach the server. Check your connection and try again.',
      fieldErrors: [],
    }
  }
  const { message, errors } = error.response.data ?? {}
  return {
    message: message || 'Something went wrong. Please try again.',
    fieldErrors: Array.isArray(errors) ? errors : [],
  }
}
