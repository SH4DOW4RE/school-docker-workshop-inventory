import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Boxes, Check,
  ChevronDown, ClipboardList, LayoutDashboard, Menu, PackagePlus, Plus, RefreshCw,
  Search, Settings2, ShieldAlert, Trash2, TrendingUp, Warehouse, X,
} from 'lucide-react';
import { api } from './api';
import type { InventoryStats, ItemForm, Movement, StockItem } from './types';

const EMPTY_FORM: ItemForm = {
  name: '', sku: '', category: 'Hardware', unit: 'pcs', quantity: 0, reorder_level: 5,
};
const INITIAL_STATS: InventoryStats = { total_items: 0, total_units: 0, low_stock_items: 0, categories: [] };
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const date = (value: string) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const time = (value: string) => value ? new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

type Page = 'overview' | 'inventory' | 'activity';

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-window" role="dialog" aria-modal="true">{children}</div>
  </div>;
}

function ItemEditor({ item, onClose, onSaved }: {
  item: StockItem | null;
  onClose: () => void;
  onSaved: (text: string) => Promise<void>;
}) {
  const [form, setForm] = useState<ItemForm>(item ? {
    name: item.name, sku: item.sku, category: item.category, unit: item.unit,
    quantity: item.quantity, reorder_level: item.reorder_level,
  } : { ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((old) => ({ ...old, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (item) {
        const { quantity: _quantity, ...fields } = form;
        void _quantity;
        await api.updateItem(item.id, fields);
      } else {
        await api.createItem(form);
      }
      await onSaved(item ? 'Item details updated.' : 'New item added successfully.');
      onClose();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <Modal onClose={onClose}>
    <div className="modal-heading"><div><span className="overline">INVENTORY MANAGEMENT</span><h2>{item ? 'Edit item' : 'Add new item'}</h2><p>{item ? 'Update the catalog details for this part.' : 'Create a new part in your inventory catalog.'}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <form onSubmit={save} className="edit-form">
      {error && <p className="inline-error">{error}</p>}
      <label>Item name<input value={form.name} required minLength={2} maxLength={120} placeholder="e.g. Steel washer M6" onChange={(e) => set('name', e.target.value)} /></label>
      <label>SKU / reference<input value={form.sku} required minLength={2} maxLength={48} placeholder="e.g. WSH-M6-020" onChange={(e) => set('sku', e.target.value.toUpperCase())} /></label>
      <div className="input-grid"><label>Category<input value={form.category} required minLength={2} maxLength={64} onChange={(e) => set('category', e.target.value)} /></label><label>Unit<input value={form.unit} required maxLength={16} onChange={(e) => set('unit', e.target.value)} /></label></div>
      <div className="input-grid"><label>Reorder level<input type="number" value={form.reorder_level} required min={0} max={1000000} onChange={(e) => set('reorder_level', Number(e.target.value))} /></label>{!item && <label>Starting quantity<input type="number" value={form.quantity} required min={0} max={1000000} onChange={(e) => set('quantity', Number(e.target.value))} /></label>}</div>
      {item && <p className="form-hint">Stock is adjusted separately, so every movement is recorded.</p>}
      <div className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Create item'} <ArrowRight size={15} /></button></div>
    </form>
  </Modal>;
}

function StockEditor({ item, onClose, onSaved }: {
  item: StockItem;
  onClose: () => void;
  onSaved: (text: string) => Promise<void>;
}) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.adjustStock(item.id, direction === 'in' ? quantity : -quantity, note);
      await onSaved('Stock adjustment recorded.');
      onClose();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <Modal onClose={onClose}>
    <div className="modal-heading"><div><span className="overline">STOCK OPERATIONS</span><h2>Adjust inventory</h2><p>Record stock received or used by your workshop.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <form onSubmit={save} className="edit-form">
      {error && <p className="inline-error">{error}</p>}
      <div className="stock-target"><span className="part-symbol">{item.name.charAt(0)}</span><div><strong>{item.name}</strong><small>{item.quantity} {item.unit} available</small></div></div>
      <div className="direction-select"><button type="button" className={direction === 'in' ? 'chosen' : ''} onClick={() => setDirection('in')}><ArrowDownLeft size={17} /> Stock in</button><button type="button" className={direction === 'out' ? 'chosen' : ''} onClick={() => setDirection('out')}><ArrowUpRight size={17} /> Stock out</button></div>
      <label>Quantity<input type="number" value={quantity} required min={1} max={1000000} onChange={(e) => setQuantity(Number(e.target.value))} /></label>
      <label>Movement note (optional)<input value={note} maxLength={255} placeholder="Delivery, work order, correction…" onChange={(e) => setNote(e.target.value)} /></label>
      <div className="modal-footer"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Recording…' : 'Record movement'} <Check size={15} /></button></div>
    </form>
  </Modal>;
}

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [items, setItems] = useState<StockItem[]>([]);
  const [stats, setStats] = useState<InventoryStats>(INITIAL_STATS);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState<StockItem | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [nextItems, nextStats, nextMovements] = await Promise.all([api.items(), api.stats(), api.movements()]);
      setItems(nextItems);
      setStats(nextStats);
      setMovements(nextMovements);
      setError('');
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const onSaved = async (message: string) => { setNotice(message); await refresh(); };
  const deleteItem = async (item: StockItem) => {
    if (!window.confirm(`Delete ${item.name}? Recorded movements will be kept.`)) return;
    try { await api.deleteItem(item.id); await onSaved('Item deleted. Movement history retained.'); }
    catch (err) { setError((err as Error).message); }
  };
  const filtered = useMemo(() => items.filter((item) => {
    const q = search.trim().toLowerCase();
    return (category === 'all' || category === item.category) &&
      (!q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q));
  }), [items, search, category]);
  const lowStock = useMemo(() => items.filter((item) => item.quantity <= item.reorder_level), [items]);
  const maxCategory = Math.max(...stats.categories.map((entry) => entry.units), 1);
  const pageNames: Record<Page, string> = { overview: 'Overview', inventory: 'Inventory', activity: 'Activity log' };

  function navTo(value: Page) { setPage(value); setMobileNav(false); setNotice(''); }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="logo-lockup"><div className="logo-square"><Warehouse size={21} strokeWidth={2.5} /></div><div><strong>workbench<span>.</span></strong><small>INVENTORY INTELLIGENCE</small></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav">
        <button className={page === 'overview' ? 'active' : ''} onClick={() => navTo('overview')}><LayoutDashboard size={18} /> Overview</button>
        <button className={page === 'inventory' ? 'active' : ''} onClick={() => navTo('inventory')}><Boxes size={18} /> Inventory <span className="nav-badge">{stats.total_items}</span></button>
        <button className={page === 'activity' ? 'active' : ''} onClick={() => navTo('activity')}><Activity size={18} /> Activity log</button>
      </nav>
      <div className="nav-caption secondary-caption">QUICK ACCESS</div>
      <nav className="side-nav"><button onClick={() => setEditing('new')}><PackagePlus size={18} /> Add inventory item</button><button onClick={() => { navTo('inventory'); setCategory('all'); setSearch(''); }}><Settings2 size={18} /> Manage stock</button></nav>
      <div className="sidebar-bottom"><div className="sidebar-insight"><span className="insight-star">✳</span><strong>A clearer workspace.</strong><p>Better stock visibility. Fewer surprises on the workshop floor.</p></div><div className="workspace-identity"><span className="workspace-avatar">W</span><div><strong>Workshop team</strong><small>Connected workspace</small></div><ChevronDown size={16} /></div></div>
    </aside>

    <main className="main-area">
      <header className="top-nav"><button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><strong>{pageNames[page]}</strong></div><div className="top-nav-right"><div className="live-status"><span className="green-dot" /> System live</div><span className="top-divider" /><button className="top-avatar" aria-label="Workshop account">WT</button></div></header>

      <div className="main-content">
        {error && <div className="alert error-alert"><ShieldAlert size={17} /><span>{error}</span><button aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button></div>}
        {notice && <div className="alert success-alert"><Check size={17} /><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X size={16} /></button></div>}
        <div className="page-intro"><div><p className="overline">WORKSHOP / {pageNames[page].toUpperCase()}</p><h1>{page === 'overview' ? 'Your workshop at a glance.' : page === 'inventory' ? 'Inventory management' : 'Stock movement log'}</h1><p className="page-subtitle">{page === 'overview' ? 'A real-time snapshot of the parts that keep your work moving.' : page === 'inventory' ? 'One organized place for every part, supply, and material.' : 'Every addition and withdrawal, with a clear audit trail.'}</p></div><div className="header-actions"><button className="button secondary refresh-button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} className={busy ? 'spinning' : ''} /> Refresh</button><button className="button primary" onClick={() => setEditing('new')}><Plus size={17} /> Add item</button></div></div>

        {(page === 'overview' || page === 'inventory') && <section className="stats-grid">
          <div className="stat-card"><div className="stat-header"><span>Total inventory items</span><div className="stat-icon lavender"><Boxes size={20} /></div></div><div className="stat-value">{number(stats.total_items)}</div><div className="stat-meta"><span className="meta-dot purple-dot" /> Unique SKUs tracked</div></div>
          <div className="stat-card"><div className="stat-header"><span>Units available</span><div className="stat-icon aqua"><Warehouse size={20} /></div></div><div className="stat-value">{number(stats.total_units)}</div><div className="stat-meta"><TrendingUp size={14} className="mint-text" /> Across your workspace</div></div>
          <div className="stat-card"><div className="stat-header"><span>Low-stock alerts</span><div className="stat-icon peach"><ShieldAlert size={20} /></div></div><div className="stat-value">{number(stats.low_stock_items)}</div><div className="stat-meta"><span className="meta-dot orange-dot" /> Items at reorder threshold</div></div>
          <div className="stat-card"><div className="stat-header"><span>Active categories</span><div className="stat-icon sky"><BarChart3 size={20} /></div></div><div className="stat-value">{number(stats.categories.length)}</div><div className="stat-meta"><span className="meta-dot blue-dot" /> Organized material groups</div></div>
        </section>}

        {page === 'overview' && <>
          <div className="overview-grid">
            <section className="surface distribution"><div className="surface-heading"><div><h2>Stock distribution</h2><p>Available units by category</p></div><div className="small-tag">CATEGORY VIEW</div></div>
              <div className="category-bars">{stats.categories.length === 0 && <div className="empty-state">Add some inventory items to see category distribution.</div>}{stats.categories.slice(0, 6).map((cat, index) => <div className="category-row" key={cat.category}><div className="category-label"><span className={`category-swatch swatch-${index % 5}`} /> <span>{cat.category}</span><strong>{number(cat.units)} <small>units</small></strong></div><div className="bar-track"><span className={`bar-fill bar-${index % 5}`} style={{ width: `${Math.max(2, (cat.units / maxCategory) * 100)}%` }} /></div></div>)}</div>
              <div className="surface-bottom"><span>{stats.categories.length} categories in total</span><button onClick={() => navTo('inventory')}>View inventory <ArrowRight size={15} /></button></div>
            </section>
            <section className="surface attention"><div className="surface-heading"><div><h2>Needs attention</h2><p>Parts approaching minimum levels</p></div><span className="attention-count">{lowStock.length} alerts</span></div>
              <div className="attention-list">{lowStock.length === 0 && <div className="empty-state good"><Check size={26} /><strong>Everything looks good!</strong><span>No low-stock items at the moment.</span></div>}{lowStock.slice(0, 4).map((item) => <div className="attention-item" key={item.id}><span className="attention-glyph">{item.name.slice(0, 1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.sku}</small></div><div className="attention-quantity"><strong>{item.quantity} {item.unit}</strong><span>Min. {item.reorder_level}</span></div><button aria-label={`Adjust ${item.name}`} className="small-icon" onClick={() => setAdjusting(item)}><ArrowRight size={16} /></button></div>)}</div>
              <div className="surface-bottom"><span>Make sure essential parts stay available</span><button onClick={() => navTo('inventory')}>Manage stock <ArrowRight size={15} /></button></div>
            </section>
          </div>
          <RecentMovements movements={movements.slice(0, 6)} onAll={() => navTo('activity')} />
        </>}

        {page === 'inventory' && <section className="surface inventory-surface"><div className="surface-heading"><div><h2>Inventory catalog</h2><p>All items and their current stock levels</p></div><span className="small-tag">{filtered.length} ITEMS</span></div>
          <div className="inventory-filters"><label className="search-box"><Search size={17} /><input placeholder="Search item name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} /></label><label className="category-box"><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{stats.categories.map((cat) => <option value={cat.category} key={cat.category}>{cat.category}</option>)}</select><ChevronDown size={14} /></label></div>
          <div className="table-scroll"><table><thead><tr><th>ITEM NAME</th><th>CATEGORY</th><th>QUANTITY</th><th>STOCK STATUS</th><th className="last-column">ACTIONS</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><div className="item-name"><span className="table-glyph">{item.name.slice(0, 1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.sku}</small></div></div></td><td><span className="neutral-pill">{item.category}</span></td><td><strong className="count-text">{number(item.quantity)}</strong> <span className="unit-text">{item.unit}</span></td><td>{item.quantity <= item.reorder_level ? <span className="status low">● Low stock</span> : <span className="status well">● Healthy</span>}</td><td className="last-column"><div className="table-actions"><button onClick={() => setAdjusting(item)}>± Stock</button><button onClick={() => setEditing(item)}>Edit</button><button title="Delete item" aria-label={`Delete ${item.name}`} className="danger-icon" onClick={() => void deleteItem(item)}><Trash2 size={15} /></button></div></td></tr>)}{filtered.length === 0 && <tr><td colSpan={5} className="empty-state">No inventory items found. Try a different filter or create a new item.</td></tr>}</tbody></table></div><div className="table-caption">Showing {filtered.length} of {items.length} inventory items</div>
        </section>}

        {page === 'activity' && <RecentMovements movements={movements} all />}
        <footer className="footer">© WORKBENCH INVENTORY <span>Python · Starlette · MySQL &nbsp;/&nbsp; React + TypeScript</span></footer>
      </div>
    </main>
    {editing && <ItemEditor item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    {adjusting && <StockEditor item={adjusting} onClose={() => setAdjusting(null)} onSaved={onSaved} />}
  </div>;
}

function RecentMovements({ movements, onAll, all = false }: { movements: Movement[]; onAll?: () => void; all?: boolean }) {
  return <section className="surface activity-surface"><div className="surface-heading"><div><h2>{all ? 'Full activity log' : 'Recent activity'}</h2><p>{all ? 'The 40 most recent stock movements' : 'Latest movements across your inventory'}</p></div><span className="activity-visual"><ClipboardList size={20} /></span></div>
    <div className="table-scroll"><table><thead><tr><th>ITEM / REFERENCE</th><th>MOVEMENT</th><th>NOTE</th><th className="last-column">DATE</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td><div className="item-name"><span className="table-glyph small"><Activity size={17} /></span><div><strong>{movement.item_name}</strong><small>{movement.item_id === null ? 'Deleted item' : `Item #${movement.item_id}`}</small></div></div></td><td><span className={`movement-tag ${movement.delta > 0 ? 'incoming' : 'outgoing'}`}>{movement.delta > 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{movement.delta > 0 ? '+' : ''}{number(movement.delta)}</span></td><td className="note-text">{movement.note || 'Manual stock adjustment'}</td><td className="date-cell last-column">{date(movement.created_at)} <span>· {time(movement.created_at)}</span></td></tr>)}{movements.length === 0 && <tr><td colSpan={4} className="empty-state">Your activity feed is empty. Stock changes will appear here.</td></tr>}</tbody></table></div>
    {!all && <div className="surface-bottom"><span>A full audit trail for every movement</span><button onClick={onAll}>View all activity <ArrowRight size={15} /></button></div>}
  </section>;
}
