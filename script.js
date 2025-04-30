let materialData = {};
const selectedMaterials = {};

// Load materials JSON
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    materialData = groupByLocation(data);
    populateLocationDropdown();
  });

// Group materials by location
function groupByLocation(data) {
  const grouped = {};
  data.forEach(item => {
    (grouped[item.location] ||= []).push(item);
  });
  return grouped;
}

// Populate location dropdown
function populateLocationDropdown() {
  const select = document.getElementById('locationSelect');
  select.innerHTML = '';
  Object.keys(materialData).forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc.charAt(0).toUpperCase() + loc.slice(1);
    select.appendChild(opt);
  });
  select.addEventListener('change', updateMaterialCheckboxes);
  updateMaterialCheckboxes();
}

// Update checkbox list when location changes
function updateMaterialCheckboxes() {
  const location = document.getElementById('locationSelect').value;
  const container = document.getElementById('materialCheckboxContainer');
  container.innerHTML = '';

  materialData[location].forEach((item, index) => {
    const id = `${location}-${index}`;
    const checked = id in selectedMaterials;
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}> ${item.name}`;
    label.querySelector('input').addEventListener('change', e => handleToggle(e, item, id));
    container.appendChild(label);
  });
}

// Handle checkbox toggle
function handleToggle(e, item, id) {
  const container = document.getElementById('materialInputsContainer');
  const existing = document.getElementById(id);

  if (e.target.checked) {
    selectedMaterials[id] = item;
    if (!existing) {
      const group = document.createElement('div');
      group.className = 'material-group';
      group.id = id;
      group.innerHTML = `
        <h4>${item.name}</h4>
        <div class="field-row">
          <label>Quantity (${item.unit})</label>
          <input type="number" name="quantity" data-weight="${item.weightPerUnit}" required>
          <span class="calc-value" data-field="totalWeight">Total Weight: 0.00 lbs</span>
        </div>
        <div class="field-row">
          <label>Reuse (lbs)</label>
          <input type="number" name="reuse" required>
        </div>
        <div class="field-row">
          <label>Recycle (lbs)</label>
          <input type="number" name="recycle" required>
          <span class="calc-value" data-field="disposal">Total Landfill: 0.00 lbs</span>
        </div>`;
      // Attach input listeners
      group.querySelectorAll('input[name="quantity"],input[name="reuse"],input[name="recycle"]').forEach(input => {
        input.addEventListener('input', () => updateCalc(group));
      });
      container.appendChild(group);
    }
  } else {
    delete selectedMaterials[id];
    existing?.remove();
  }
}

// Live calculations
function updateCalc(group) {
  const qty = parseFloat(group.querySelector('input[name="quantity"]').value) || 0;
  const reuse = parseFloat(group.querySelector('input[name="reuse"]').value) || 0;
  const recycle = parseFloat(group.querySelector('input[name="recycle"]').value) || 0;
  const wpu = parseFloat(group.querySelector('input[name="quantity"]').dataset.weight) || 0;

  const total = qty * wpu;
  const disposal = Math.max(total - reuse - recycle, 0);

  group.querySelector('[data-field="totalWeight"]').textContent = `${total.toFixed(2)} lbs`;
  group.querySelector('[data-field="disposal"]').textContent = `${disposal.toFixed(2)} lbs`;
}

// Final submit
function handleSubmit(ev) {
  ev.preventDefault();
  alert('Entries submitted successfully!');
}