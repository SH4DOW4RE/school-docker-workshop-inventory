import 'angular/angular';
import './styles.css';

const angular = window.angular;

document.getElementById('app').innerHTML = `
  <div ng-controller="InventoryController as vm" class="shell" ng-cloak>
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">W<span>+</span></div><div><strong>workbench</strong><small>OPERATOR SPACE</small></div></div>
      <div class="sidebar-section">WORKSPACE</div>
      <button class="nav-item" ng-class="{'selected': vm.tab === 'inventory'}" ng-click="vm.tab = 'inventory'"><span class="nav-icon">▦</span> Inventory <span class="nav-count">{{vm.items.length}}</span></button>
      <button class="nav-item" ng-class="{'selected': vm.tab === 'activity'}" ng-click="vm.tab = 'activity'"><span class="nav-icon">↗</span> Stock history</button>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-help"><span class="help-orbit">✦</span><strong>Keep things moving.</strong><p>Manage your team's stock, one part at a time.</p></div>
      <div class="sidebar-footer"><span class="online-dot"></span> OPERATOR CONSOLE <span class="version">v1.0</span></div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div class="crumbs">Workspace <span>/</span> <strong>{{vm.tab === 'inventory' ? 'Inventory' : 'Stock history'}}</strong></div>
        <div class="topbar-right"><span class="api-state"><span class="online-dot"></span> Live data</span><span class="avatar">OP</span></div>
      </header>

      <div class="content">
        <div class="notice error" ng-if="vm.error"><strong>Request failed.</strong> {{vm.error}} <button ng-click="vm.error = ''">×</button></div>
        <div class="notice success" ng-if="vm.success"><strong>All set.</strong> {{vm.success}} <button ng-click="vm.success = ''">×</button></div>

        <section class="page-heading">
          <div><p class="eyebrow">WORKSHOP OPERATIONS</p><h1>{{vm.tab === 'inventory' ? 'Inventory overview' : 'Movement history'}}</h1><p class="lead">{{vm.tab === 'inventory' ? 'Every part, right where you need it.' : 'An audit trail of the stock going in and out.'}}</p></div>
          <button class="primary-button" ng-click="vm.openCreate()" ng-if="vm.tab === 'inventory'"><span>＋</span> Add new item</button>
        </section>

        <div ng-show="vm.tab === 'inventory'">
          <section class="kpi-grid">
            <div class="kpi-card"><div class="kpi-head">Total items <span class="kpi-icon purple">▣</span></div><div class="kpi-number">{{vm.stats.total_items || 0}}</div><p>Unique parts registered</p></div>
            <div class="kpi-card"><div class="kpi-head">Units in stock <span class="kpi-icon blue">▤</span></div><div class="kpi-number">{{(vm.stats.total_units || 0) | number}}</div><p>Across all categories</p></div>
            <div class="kpi-card warning-card"><div class="kpi-head">Needs attention <span class="kpi-icon orange">!</span></div><div class="kpi-number">{{vm.stats.low_stock_items || 0}}</div><p>At or below reorder level</p></div>
          </section>

          <section class="panel table-panel">
            <div class="panel-heading"><div><h2>All inventory</h2><p>Search, track and update your materials</p></div><button class="ghost-button" ng-click="vm.refresh()">↻ Refresh</button></div>
            <div class="filters"><label class="search-field"><span>⌕</span><input type="search" placeholder="Search by item or SKU..." ng-model="vm.search" ng-model-options="{ debounce: 200 }" /></label><label class="filter-field"><span>Category</span><select ng-model="vm.categoryFilter"><option value="">All categories</option><option ng-repeat="cat in vm.stats.categories track by cat.category" value="{{cat.category}}">{{cat.category}}</option></select></label></div>
            <div class="table-scroll"><table><thead><tr><th>ITEM / SKU</th><th>CATEGORY</th><th>AVAILABLE</th><th>STATUS</th><th class="actions-header">ACTIONS</th></tr></thead><tbody>
              <tr ng-repeat="item in vm.visibleItems() track by item.id"><td><div class="item-cell"><span class="item-glyph">{{item.name.charAt(0).toUpperCase()}}</span><div><strong>{{item.name}}</strong><small>{{item.sku}}</small></div></div></td><td><span class="category-pill">{{item.category}}</span></td><td><strong class="qty">{{item.quantity | number}}</strong> <small class="unit">{{item.unit}}</small></td><td><span class="status-pill" ng-class="item.quantity <= item.reorder_level ? 'low' : 'healthy'"><span>●</span> {{item.quantity <= item.reorder_level ? 'Low stock' : 'In stock'}}</span></td><td class="row-actions"><button title="Adjust stock" ng-click="vm.openStock(item)">± Stock</button><button title="Edit item" ng-click="vm.openEdit(item)">Edit</button><button title="Delete item" class="remove" ng-click="vm.removeItem(item)">×</button></td></tr>
              <tr ng-if="vm.visibleItems().length === 0"><td colspan="5" class="empty">Nothing matches your filters yet. Add a new item to get started.</td></tr>
            </tbody></table></div>
            <div class="table-bottom">Showing <strong>{{vm.visibleItems().length}}</strong> of <strong>{{vm.items.length}}</strong> items <span>Quantities update immediately after stock changes</span></div>
          </section>
        </div>

        <section class="panel history-panel" ng-show="vm.tab === 'activity'">
          <div class="panel-heading"><div><h2>Recent adjustments</h2><p>Latest 40 recorded stock movements</p></div><button class="ghost-button" ng-click="vm.refresh()">↻ Refresh</button></div>
          <div class="table-scroll"><table><thead><tr><th>ITEM</th><th>CHANGE</th><th>NOTE</th><th>DATE</th></tr></thead><tbody>
            <tr ng-repeat="movement in vm.movements track by movement.id"><td><strong>{{movement.item_name}}</strong><small class="muted-block">#{{movement.item_id || 'removed'}}</small></td><td><span class="movement-amount" ng-class="movement.delta > 0 ? 'positive' : 'negative'">{{movement.delta > 0 ? '+' : ''}}{{movement.delta}}</span></td><td>{{movement.note || 'Manual adjustment'}}</td><td class="date">{{movement.created_at | date:'MMM d, y · HH:mm'}}</td></tr>
            <tr ng-if="vm.movements.length === 0"><td colspan="4" class="empty">No movements yet. Your stock history will show up here.</td></tr>
          </tbody></table></div>
        </section>
        <footer class="footer">WORKBENCH / INVENTORY OPERATIONS <span>Powered by Starlette + MySQL</span></footer>
      </div>
    </main>

    <div class="modal-cover" ng-if="vm.modal" ng-click="vm.closeModal()">
      <div class="modal" ng-click="$event.stopPropagation()">
        <div class="modal-header"><div><p class="eyebrow">{{vm.modal === 'stock' ? 'STOCK MOVEMENT' : 'INVENTORY RECORD'}}</p><h2>{{vm.modal === 'stock' ? 'Adjust stock' : vm.modal === 'edit' ? 'Edit item' : 'New inventory item'}}</h2></div><button class="modal-close" ng-click="vm.closeModal()">×</button></div>
        <form ng-if="vm.modal !== 'stock'" ng-submit="vm.saveItem()" class="editor-form">
          <label>Item name <input ng-model="vm.draft.name" maxlength="120" minlength="2" placeholder="e.g. Hex bolt M8" required /></label>
          <label>SKU <input ng-model="vm.draft.sku" maxlength="48" placeholder="e.g. BLT-M8-001" required /></label>
          <div class="form-pair"><label>Category <input ng-model="vm.draft.category" maxlength="64" placeholder="Fasteners" required /></label><label>Unit <input ng-model="vm.draft.unit" maxlength="16" placeholder="pcs" required /></label></div>
          <div class="form-pair"><label>Reorder level <input type="number" ng-model="vm.draft.reorder_level" min="0" max="1000000" required /></label><label ng-if="vm.modal === 'create'">Starting quantity <input type="number" ng-model="vm.draft.quantity" min="0" max="1000000" required /></label></div>
          <p class="form-note" ng-if="vm.modal === 'edit'">To change quantities, use the stock adjustment action.</p>
          <div class="modal-actions"><button type="button" class="ghost-button" ng-click="vm.closeModal()">Cancel</button><button type="submit" class="primary-button" ng-disabled="vm.saving">{{vm.saving ? 'Saving...' : vm.modal === 'edit' ? 'Save changes' : 'Create item'}}</button></div>
        </form>
        <form ng-if="vm.modal === 'stock'" ng-submit="vm.saveStock()" class="editor-form">
          <div class="adjust-target"><strong>{{vm.stockItem.name}}</strong><span>{{vm.stockItem.quantity}} {{vm.stockItem.unit}} currently available</span></div>
          <div class="direction-buttons"><button type="button" ng-class="{'direction-active': vm.direction === 'in'}" ng-click="vm.direction = 'in'">＋ Add stock</button><button type="button" ng-class="{'direction-active': vm.direction === 'out'}" ng-click="vm.direction = 'out'">− Remove stock</button></div>
          <label>Quantity <input type="number" ng-model="vm.adjustQuantity" min="1" max="1000000" required /></label>
          <label>Reason / note <input ng-model="vm.adjustNote" maxlength="255" placeholder="e.g. New delivery" /></label>
          <div class="modal-actions"><button type="button" class="ghost-button" ng-click="vm.closeModal()">Cancel</button><button type="submit" class="primary-button" ng-disabled="vm.saving">{{vm.saving ? 'Saving...' : 'Record adjustment'}}</button></div>
        </form>
      </div>
    </div>
  </div>
`;

angular.module('workshopApp', []).controller('InventoryController', ['$http', '$q', '$window', function ($http, $q, $window) {
  const vm = this;
  vm.tab = 'inventory';
  vm.items = [];
  vm.movements = [];
  vm.stats = { total_items: 0, total_units: 0, low_stock_items: 0, categories: [] };
  vm.search = '';
  vm.categoryFilter = '';
  vm.modal = null;
  vm.saving = false;
  vm.error = '';
  vm.success = '';

  const reportError = (error) => {
    vm.success = '';
    vm.error = error?.data?.error || 'The server could not complete the request. Check the API connection.';
  };
  const reportSuccess = (message) => { vm.error = ''; vm.success = message; };

  vm.refresh = () => $q.all([
    $http.get('/api/items'), $http.get('/api/stats'), $http.get('/api/movements'),
  ]).then(([items, stats, movements]) => {
    vm.items = items.data.items;
    vm.stats = stats.data.stats;
    vm.movements = movements.data.movements;
    vm.error = '';
  }).catch(reportError);

  vm.visibleItems = () => vm.items.filter((item) => {
    const q = vm.search.toLowerCase().trim();
    return (!q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)) &&
      (!vm.categoryFilter || item.category === vm.categoryFilter);
  });

  vm.closeModal = () => { if (!vm.saving) vm.modal = null; };
  vm.openCreate = () => {
    vm.draft = { name: '', sku: '', category: 'Fasteners', unit: 'pcs', quantity: 0, reorder_level: 5 };
    vm.modal = 'create';
  };
  vm.openEdit = (item) => {
    vm.draft = { name: item.name, sku: item.sku, category: item.category, unit: item.unit, reorder_level: item.reorder_level };
    vm.editingId = item.id;
    vm.modal = 'edit';
  };
  vm.saveItem = () => {
    vm.saving = true;
    const isEdit = vm.modal === 'edit';
    const request = isEdit ? $http.put(`/api/items/${vm.editingId}`, vm.draft) : $http.post('/api/items', vm.draft);
    request.then(() => {
      vm.modal = null;
      reportSuccess(isEdit ? 'Item updated.' : 'Item added to inventory.');
      return vm.refresh();
    }).catch(reportError).finally(() => { vm.saving = false; });
  };

  vm.openStock = (item) => {
    vm.stockItem = item;
    vm.direction = 'in';
    vm.adjustQuantity = 1;
    vm.adjustNote = '';
    vm.modal = 'stock';
  };
  vm.saveStock = () => {
    vm.saving = true;
    const quantity = Number(vm.adjustQuantity);
    const delta = vm.direction === 'in' ? quantity : -quantity;
    $http.post('/api/movements', { item_id: vm.stockItem.id, delta, note: vm.adjustNote || '' })
      .then(() => {
        vm.modal = null;
        reportSuccess('Stock adjustment recorded.');
        return vm.refresh();
      }).catch(reportError).finally(() => { vm.saving = false; });
  };
  vm.removeItem = (item) => {
    if (!$window.confirm(`Delete ${item.name}? Its movement history will be kept.`)) return;
    $http.delete(`/api/items/${item.id}`).then(() => {
      reportSuccess('Item removed. Movement history was preserved.');
      return vm.refresh();
    }).catch(reportError);
  };
  vm.refresh();
}]);

angular.element(document).ready(() => angular.bootstrap(document.getElementById('app'), ['workshopApp']));
