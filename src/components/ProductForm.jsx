import { useState } from 'react';
import { getErrorMessage } from '../api/client.js';

export default function ProductForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState({
    product_name: initial?.product_name ?? '',
    description: initial?.description ?? '',
    price: initial?.price ?? '',
    quantity: initial?.quantity ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        product_name: values.product_name.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        quantity: parseInt(values.quantity, 10),
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="field">
        <label htmlFor="product_name">Product name</label>
        <input
          id="product_name"
          name="product_name"
          type="text"
          maxLength={100}
          required
          autoFocus
          value={values.product_name}
          onChange={handleChange}
        />
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={values.description}
          onChange={handleChange}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="price">Price (PHP)</label>
          <input
            id="price"
            name="price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max="99999999.99"
            required
            value={values.price}
            onChange={handleChange}
          />
        </div>
        <div className="field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            required
            value={values.quantity}
            onChange={handleChange}
          />
        </div>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}