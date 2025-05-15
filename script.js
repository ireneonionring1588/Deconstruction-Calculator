'use strict';

const endpoint = document.querySelector('meta[name="endpoint"]').content;


const form          = document.getElementById('surveyForm');
const progress      = document.getElementById('progressBar');
const statusEl      = document.getElementById('formStatus');

const locationSelect     = document.getElementById('locationSelect');
const materialCheckWrap  = document.getElementById('materialCheckboxContainer');
const materialInputsWrap = document.getElementById('materialInputsContainer');

let materialData      = {};   // all materials loaded from data.json, grouped by location
let selectedMaterials = {};   // { id: materialObj } for items the user checked

function updateProgressBar () {
  const required = [...form.querySelectorAll('[required]')]
                    .filter(el => el.dataset.ignore !== 'true');
  const filled   = required.filter(el => el.value.trim()).length;
  const pct      = Math.round((filled / required.length) * 100);

  progress.style.width = `${pct}%`;
  progress.parentElement.setAttribute('aria-valuenow', pct);
}

(function autofillDate () {
  const d = document.getElementById('dateInput');
  d.value = new Date().toISOString().split('T')[0];
  d.dataset.ignore = 'true';
})();

async function loadMaterials () {
  const list = await (await fetch(new URL('./data.json', import.meta.url))).json();

  // group by location
  materialData = list.reduce((acc, cur) => {
    (acc[cur.location] ||= []).push(cur);
    return acc;
  }, {});

  // populate <select>
  Object.keys(materialData).forEach(loc => {
    locationSelect.add(new Option(loc[0].toUpperCase() + loc.slice(1), loc));
  });

  updateCheckboxList();
}

function updateCheckboxList () {
  const loc = locationSelect.value;
  materialCheckWrap.innerHTML = '';

  materialData[loc].forEach((m, i) => {
    const id = `${loc}-${i}`;
    materialCheckWrap.insertAdjacentHTML(
      'beforeend',
      `<label class="material-checkbox">
         <input type="checkbox"
                class="material-checkbox__input"
                data-id="${id}"
                ${id in selectedMaterials ? 'checked' : ''}>
         ${m.name}
       </label>`
    );
  });
}

function addMaterialGroup (id, mat) {
  if (document.getElementById(id)) return; 

  materialInputsWrap.insertAdjacentHTML(
    'beforeend',
    `<div class="material-group" id="${id}">
       <button type="button" class="material-remove" data-id="${id}" aria-label="Remove">✕</button>
       <h4 class="material-group__title">${mat.name}</h4>

       <div class="material-field">
         <label>Quantity (${mat.unit})</label>
         <input type="number" step="any" name="quantity" data-weight="${mat.weightPerUnit}" required>
         <span class="material-field__calc" data-total>Total Weight: 0.00 lbs</span>
       </div>

       <div class="material-field">
         <label>Reuse (lbs)</label>
         <input type="number" step="any" name="reuse" required>
       </div>

       <div class="material-field">
         <label>Recycle (lbs)</label>
         <input type="number" step="any" name="recycle" required>
         <span class="material-field__calc" data-landfill>Total Landfill: 0.00 lbs</span>
       </div>
     </div>`
  );
}

locationSelect.addEventListener('change', updateCheckboxList);

// checkbox change → add/remove material input blocks
materialCheckWrap.addEventListener('change', e => {
  if (!e.target.matches('.material-checkbox__input')) return;

  const id  = e.target.dataset.id;
  const [loc, idx] = id.split('-');
  const mat = materialData[loc][idx];

  if (e.target.checked) {
    selectedMaterials[id] = mat;
    addMaterialGroup(id, mat);
  } else {
    delete selectedMaterials[id];
    document.getElementById(id)?.remove();
  }

  updateProgressBar();
});

// remove button inside material block
materialInputsWrap.addEventListener('click', e => {
  if (!e.target.matches('.material-remove')) return;

  const id = e.target.dataset.id;
  document.getElementById(id)?.remove();
  delete selectedMaterials[id];

  const cb = document.querySelector(`.material-checkbox__input[data-id="${id}"]`);
  if (cb) cb.checked = false;

  updateProgressBar();
});

// live calculations in each material group
materialInputsWrap.addEventListener('input', e => {
  const group = e.target.closest('.material-group');
  if (!group) return;

  const quantity = parseFloat(group.querySelector('[name="quantity"]').value) || 0;
  const reuse    = parseFloat(group.querySelector('[name="reuse"]').value)    || 0;
  const recycle  = parseFloat(group.querySelector('[name="recycle"]').value)  || 0;
  const weightPU = parseFloat(group.querySelector('[name="quantity"]').dataset.weight) || 0;

  const totalWeight = quantity * weightPU;
  const landfill    = Math.max(totalWeight - reuse - recycle, 0);

  group.querySelector('[data-total]').textContent    = `Total Weight: ${totalWeight.toFixed(2)}`;
  group.querySelector('[data-landfill]').textContent = `Total Landfill: ${landfill.toFixed(2)}`;
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  statusEl.hidden = true;       

  if (!form.reportValidity()) return;

  // build payload
  const fd = new FormData(form);
  const payload = {
    projectName   : fd.get('projectName').trim(),
    projectAddress: fd.get('projectAddress').trim(),
    taxParcel     : fd.get('taxParcel').trim(),
    jurisdiction  : fd.get('jurisdiction').trim(),
    date          : fd.get('date'),
    evaluatorName : fd.get('evaluatorName').trim(),
    evaluatorPhone: fd.get('evaluatorPhone').trim(),
    email         : fd.get('email').trim(),
    data          : []
  };

  for (const [id, m] of Object.entries(selectedMaterials)) {
    const g  = document.getElementById(id);
    const q  = parseFloat(g.querySelector('[name="quantity"]').value) || 0;
    const ru = parseFloat(g.querySelector('[name="reuse"]').value)    || 0;
    const rc = parseFloat(g.querySelector('[name="recycle"]').value)  || 0;
    const w  = parseFloat(g.querySelector('[name="quantity"]').dataset.weight) || 0;

    const tot = q * w;
    const lf  = Math.max(tot - ru - rc, 0);

    payload.data.push({
      material   : m.name,
      quantity   : q,
      totalWeight: tot.toFixed(2),
      reuse      : ru,
      recycle    : rc,
      landfill   : lf.toFixed(2),
      category   : m.category
    });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(payload));

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });


    if (!res.ok) throw new Error(res.statusText);

    statusEl.textContent = '✓ Submission successful!';
    statusEl.className   = 'form-status';
    statusEl.hidden      = false;

    // reset UI
    form.reset();
    selectedMaterials = {};
    materialInputsWrap.innerHTML = '';
    updateCheckboxList();
    updateProgressBar();

  } catch (err) {
    console.error(err);
    statusEl.textContent = '✕ Submission failed. Please try again.';
    statusEl.className   = 'form-status form-status--error';
    statusEl.hidden      = false;
  }
});

form.addEventListener('input',  updateProgressBar);
form.addEventListener('change', updateProgressBar);

updateProgressBar();
loadMaterials();
