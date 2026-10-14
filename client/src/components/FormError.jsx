/** Shows a parseApiError() result: the headline message plus any per-field problems. */
export default function FormError({ error }) {
  if (!error) return null
  return (
    <div className="alert" role="alert">
      <strong>{error.message}</strong>
      {error.fieldErrors.length > 0 && (
        <ul>
          {error.fieldErrors.map((e, i) => (
            <li key={`${e.field}-${i}`}>{e.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
