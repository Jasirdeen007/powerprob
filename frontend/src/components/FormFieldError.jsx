function FormFieldError({ error, id }) {
  if (!error) return null;
  
  return (
    <span className="form-field-error" id={id} role="alert" aria-live="polite">
      {error}
    </span>
  );
}

export default FormFieldError;
