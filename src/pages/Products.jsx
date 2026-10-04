import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import ProductForm from '../components/ProductForm.jsx';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const LOW_STOCK_LIMIT = 5;

function stockStatus(quantity) {
  const qty = Number(quantity);
  if (qty === 0) return { label: 'Out of stock', className: 'pill pill-out' };
  if (qty <= LOW_STOCK_LIMIT) return { label: 'Low stock', className: 'pill pill-low' };
  return { label: 'In stock', className: 'pill pill-ok' };
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Products() {
  const { user, logout } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null); // null | { mode: 'add' } | { mode: 'edit', product }
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await api.get('/products');
      setProducts(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        String(p.product_name ?? '').toLowerCase().includes(term) ||
        String(p.description ?? '').toLowerCase().includes(term)
    );
  }, [products, query]);

  const lowStockCount = useMemo(
    () => products.filter((p) => Number(p.quantity) <= LOW_STOCK_LIMIT).length,
    [products]
  );

  const closeEditor = useCallback(() => setEditor(null), []);

  const handleSave = async (values) => {
    if (editor?.mode === 'edit') {
      const { data } = await api.put(`/products/${editor.product.id}`, values);
      setProducts((current) =>
        current.map((p) => (p.id === editor.product.id ? data.data : p))
      );
      setNotice('Product updated.');
    } else {
      const { data } = await api.post('/products', values);
      setProducts((current) => [data.data, ...current]);
      setNotice('Product added.');
    }
    setEditor(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/products/${toDelete.id}`);
      setProducts((current) => current.filter((p) => p.id !== toDelete.id));
      setToDelete(null);
      setNotice('Product deleted.');
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setToDelete(null);
    setDeleteError('');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Product Management</span>
          <div className="topbar-user">
            <span className="muted user-email">{user?.email}</span>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <div className="page-head">
          <div>
            <h1>Products</h1>
            {!loading && !loadError && (
              <p className="muted">
                {products.length} {products.length === 1 ? 'product' : 'products'}
                {lowStockCount > 0 && `, ${lowStockCount} low or out of stock`}
              </p>
            )}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setEditor({ mode: 'add' })}>
            Add product
          </button>
        </div>

        <div className="toolbar">
          <label htmlFor="search" className="sr-only">
            Search products
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search by name or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {notice && (
          <p className="alert alert-ok" role="status">
            {notice}
          </p>
        )}

        {loading && <p className="state">Loading products...</p>}

        {!loading && loadError && (
          <div className="state">
            <p className="alert alert-error" role="alert">
              {loadError}
            </p>
            <button type="button" className="btn btn-ghost" onClick={loadProducts}>
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && products.length === 0 && (
          <div className="state">
            <p>No products yet.</p>
            <button type="button" className="btn btn-primary" onClick={() => setEditor({ mode: 'add' })}>
              Add your first product
            </button>
          </div>
        )}

        {!loading && !loadError && products.length > 0 && visibleProducts.length === 0 && (
          <p className="state">No products match "{query}".</p>
        )}

        {!loading && !loadError && visibleProducts.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Price</th>
                  <th className="num">Quantity</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const status = stockStatus(product.quantity);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-name">{product.product_name}</div>
                        {product.description && (
                          <div className="product-desc">{product.description}</div>
                        )}
                      </td>
                      <td className="num">{peso.format(Number(product.price))}</td>
                      <td className="num">{product.quantity}</td>
                      <td>
                        <span className={status.className}>{status.label}</span>
                      </td>
                      <td className="nowrap">{formatDate(product.created_at)}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-ghost"
                          onClick={() => setEditor({ mode: 'edit', product })}
                          aria-label={`Edit ${product.product_name}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger-ghost"
                          onClick={() => setToDelete(product)}
                          aria-label={`Delete ${product.product_name}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editor && (
        <Modal title={editor.mode === 'edit' ? 'Edit product' : 'Add product'} onClose={closeEditor}>
          <ProductForm
            initial={editor.mode === 'edit' ? editor.product : null}
            submitLabel={editor.mode === 'edit' ? 'Save changes' : 'Add product'}
            onSubmit={handleSave}
            onCancel={closeEditor}
          />
        </Modal>
      )}

      {toDelete && (
        <Modal title="Delete product" onClose={closeDelete}>
          <p>
            Delete <strong>{toDelete.product_name}</strong>? This cannot be undone.
          </p>
          {deleteError && (
            <p className="alert alert-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={closeDelete} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete product'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}