(function(){

// ============================================================
// Estado
// ============================================================
let notasList = [];
let notaTipoActivo = "checklist";
let notaColorSeleccionado = "#F2E14C";
let editingItem = null; // {notaId, idx, tipo:"checklist"|"gasto"}
const NOTE_COLORS = ["#F2E14C", "#F7B6C2", "#B8E8C8", "#AEDBF2", "#F7C59F"];

const pad = n => String(n).padStart(2,"0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

// ============================================================
// Usuario (separación simple por nombre/código, sin contraseña)
// ============================================================
let usuarioActual = localStorage.getItem("notasUsuario") || null;
let unsubNotas = null;

function renderUsuarioBox(){
  const box = document.getElementById("usuarioBox");
  if (!box) return;
  box.innerHTML = usuarioActual
    ? `Viendo notas de <span class="nombre">${escapeHtml(usuarioActual)}</span><span class="cambiar" id="cambiarUsuarioBtn">cambiar</span>`
    : "";
  const btn = document.getElementById("cambiarUsuarioBtn");
  if (btn) btn.addEventListener("click", cerrarSesionUsuario);
}

function cerrarSesionUsuario(){
  if (!confirm("¿Cambiar de usuario? No perderás tus notas, solo dejarás de verlas hasta que vuelvas a poner tu nombre/código.")) return;
  localStorage.removeItem("notasUsuario");
  usuarioActual = null;
  if (unsubNotas) { unsubNotas(); unsubNotas = null; }
  notasList = [];
  renderUsuarioBox();
  render();
}

function iniciarSesionUsuario(valor){
  const nombre = (valor||"").trim();
  if (!nombre){ alert("Escribe un nombre o código."); return; }
  usuarioActual = nombre;
  localStorage.setItem("notasUsuario", nombre);
  renderUsuarioBox();
  subscribeNotas();
  render();
}

function renderLogin(){
  return `
    <div class="login-card">
      <h2>¿Quién eres?</h2>
      <p>Escribe tu nombre o un código corto. Así separamos tus notas de las de otros. No es una contraseña — cualquiera que escriba el mismo nombre verá las mismas notas.</p>
      <input type="text" id="loginInput" placeholder="Ej. Roberto, Sucursal Periférico..." maxlength="40">
      <button class="btn-primary" id="loginBtn">Entrar</button>
    </div>
  `;
}

// ============================================================
// Conexión
// ============================================================
window.addEventListener("online", updateStatus);
window.addEventListener("offline", updateStatus);
function updateStatus(){
  const dot = document.getElementById("statusDot");
  const txt = document.getElementById("statusText");
  if (navigator.onLine){ dot.className="status-dot online"; txt.textContent="En línea · sincronizado"; }
  else { dot.className="status-dot offline"; txt.textContent="Sin conexión · guardando local"; }
}
updateStatus();

function isTypingIn(ids){
  const el = document.activeElement;
  return el && ids.includes(el.id);
}

// ============================================================
// Firestore: suscripción en tiempo real a notas_rapidas, filtrada por usuario
// (el orden se hace en el cliente para no requerir un índice compuesto en Firestore)
// ============================================================
function subscribeNotas(){
  if (unsubNotas) unsubNotas();
  if (!usuarioActual) return;
  unsubNotas = db.collection("notas_rapidas").where("usuario","==",usuarioActual).onSnapshot(snap=>{
    notasList = snap.docs.map(d=>({id:d.id, ...d.data()}))
      .sort((a,b)=> (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0));
    const notaFields = ["notaTitulo","notaGastoDesc","notaGastoMonto","notaGastoCantidad","notaGastoFecha","notaTextoInicial"];
    const activeEl = document.activeElement;
    const skip = activeEl && (
      notaFields.includes(activeEl.id) ||
      (activeEl.classList && activeEl.classList.contains("sticky-texto")) ||
      (activeEl.hasAttribute && (activeEl.hasAttribute("data-additem") || activeEl.hasAttribute("data-gm") || activeEl.hasAttribute("data-gc") || activeEl.hasAttribute("data-gd")))
    );
    if (!skip && !editingItem) render();
  }, err=>console.error("Error leyendo notas:", err));
}
if (usuarioActual) subscribeNotas();

// ============================================================
// Helpers
// ============================================================
function escapeHtml(str){
  return String(str||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function hashRot(id){
  let h=0; for(let i=0;i<id.length;i++){ h=(h*31+id.charCodeAt(i))|0; }
  return (Math.abs(h)%7)-3; // -3..3 grados
}

// ============================================================
// Render: formulario para agregar nota
// ============================================================
function renderAddNotaForm(){
  const typeButtons = [["checklist","Checklist"],["gasto","Gasto"],["texto","Texto"]].map(([key,label])=>
    `<div class="note-type-tab ${notaTipoActivo===key?'active':''}" data-notatipo="${key}">${label}</div>`).join("");
  const colorHtml = NOTE_COLORS.map(c=>
    `<div class="color-swatch ${notaColorSeleccionado===c?'selected':''}" style="background:${c}" data-notacolor="${c}"></div>`).join("");

  let fieldsHtml = "";
  if (notaTipoActivo === "checklist"){
    fieldsHtml = `<div class="form-group"><label>Título de la lista</label><input type="text" id="notaTitulo" placeholder="Ej. Súper, Encargos..."></div>`;
  } else if (notaTipoActivo === "gasto"){
    fieldsHtml = `<div class="form-group"><label>Nombre de la lista de gasto</label><input type="text" id="notaTitulo" placeholder="Ej. Gasolina camioneta, Viáticos evento..."></div>`;
  } else {
    fieldsHtml = `<div class="form-group"><label>Nota</label><textarea id="notaTextoInicial" placeholder="Escribe tu nota..." style="min-height:60px;"></textarea></div>`;
  }

  return `
    <div class="expense-form">
      <div class="note-type-tabs">${typeButtons}</div>
      ${fieldsHtml}
      <div class="color-picker">${colorHtml}</div>
      <button class="btn-primary" id="btnAddNota">Agregar nota</button>
    </div>
  `;
}

// ============================================================
// Render: tarjeta post-it individual
// ============================================================
function stickyCardHtml(nota){
  const rot = hashRot(nota.id);
  let inner = "";
  if (nota.tipo === "checklist"){
    inner = `<div class="sticky-title">${escapeHtml(nota.titulo||"Lista")}</div>`;
    (nota.items||[]).forEach((it,idx)=>{
      const isEditing = editingItem && editingItem.notaId===nota.id && editingItem.tipo==="checklist" && editingItem.idx===idx;
      if (isEditing){
        inner += `<div class="sticky-item editing">
          <input type="text" class="edit-input" value="${escapeHtml(it.text)}" data-editchecklistinput="${nota.id}:${idx}">
          <div class="item-save" data-saveeditchecklist="${nota.id}:${idx}">✓</div>
          <div class="item-cancel" data-canceledit="1">✕</div>
        </div>`;
      } else {
        inner += `<div class="sticky-item ${it.done?'done':''}" data-notaid="${nota.id}" data-itemidx="${idx}">
          <div class="chk">${it.done?'✓':''}</div>
          <div class="item-text">${escapeHtml(it.text)}</div>
          <div class="item-edit" data-editchecklist="${nota.id}:${idx}">✎</div>
        </div>`;
      }
    });
    inner += `<div class="sticky-add-item">
      <input type="text" placeholder="+ agregar" data-additem="${nota.id}">
      <button data-additembtn="${nota.id}">+</button>
    </div>`;
  } else if (nota.tipo === "gasto"){
    const fmt = n => "$" + Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2, maximumFractionDigits:2});
    const lineTotal = it => Number(it.monto||0) * (Number(it.cantidad) || 1);
    const total = (nota.items||[]).reduce((s,it)=> s + lineTotal(it), 0);
    inner = `<div class="sticky-title">${escapeHtml(nota.titulo||"Gastos")}</div>
      <div class="sticky-gasto-total">${fmt(total)}</div>`;
    (nota.items||[]).forEach((it,idx)=>{
      const isEditing = editingItem && editingItem.notaId===nota.id && editingItem.tipo==="gasto" && editingItem.idx===idx;
      if (isEditing){
        inner += `<div class="sticky-gasto-item editing">
          <div class="form-row-mini">
            <input type="number" class="edit-input" placeholder="Precio unit." value="${it.monto||''}" data-editgm="${nota.id}:${idx}" step="0.01">
            <input type="number" class="edit-input" placeholder="Cant." value="${it.cantidad||''}" data-editgc="${nota.id}:${idx}" step="1">
          </div>
          <input type="text" class="edit-input" placeholder="Descripción" value="${escapeHtml(it.descripcion||'')}" data-editgd="${nota.id}:${idx}">
          <div style="display:flex;gap:6px;">
            <div class="item-save" data-saveeditgasto="${nota.id}:${idx}">✓ Guardar</div>
            <div class="item-cancel" data-canceledit="1">✕</div>
          </div>
        </div>`;
      } else {
        const showQty = it.cantidad && Number(it.cantidad) !== 1;
        inner += `<div class="sticky-gasto-item">
          <div class="gi-left"><span class="gi-amount">${fmt(lineTotal(it))}</span>${showQty?` <span class="gi-sub">(${fmt(it.monto)} × ${escapeHtml(String(it.cantidad))})</span>`:""} ${escapeHtml(it.descripcion||"")}<div class="gi-date">${it.fecha||""}</div></div>
          <div class="gi-edit" data-editgasto="${nota.id}:${idx}">✎</div>
          <div class="gi-del" data-delgastoitem="${nota.id}" data-idx="${idx}">✕</div>
        </div>`;
      }
    });
    inner += `<div class="sticky-add-gasto">
      <div class="form-row-mini">
        <input type="number" placeholder="Precio unit." data-gm="${nota.id}" step="0.01">
        <input type="number" placeholder="Cant." data-gc="${nota.id}" step="1">
      </div>
      <input type="text" placeholder="Descripción" data-gd="${nota.id}">
      <button data-addgastobtn="${nota.id}">+ Agregar gasto</button>
    </div>`;
  } else {
    inner = `<textarea class="sticky-texto" data-notatexto="${nota.id}" placeholder="Escribe aquí...">${escapeHtml(nota.contenido)}</textarea>`;
  }
  const isEditingThisNota = editingItem && editingItem.notaId === nota.id;
  return `<div class="sticky-note ${isEditingThisNota?'sticky-note-wide':''}" style="background:${nota.color||'#F2E14C'};transform:rotate(${isEditingThisNota?0:rot}deg);">
    <div class="sticky-share" data-sharenota="${nota.id}" title="Compartir">↗</div>
    <div class="sticky-del" data-delnota="${nota.id}">✕</div>
    ${inner}
  </div>`;
}

function buildShareText(nota){
  const fmt = n => "$" + Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2, maximumFractionDigits:2});
  if (nota.tipo === "checklist"){
    let text = `📋 ${nota.titulo||"Lista"}\n\n`;
    (nota.items||[]).forEach(it=> text += `${it.done?"✅":"⬜"} ${it.text}\n`);
    text += `\n— Notas`;
    return text;
  }
  if (nota.tipo === "gasto"){
    const lineTotal = it => Number(it.monto||0) * (Number(it.cantidad) || 1);
    const total = (nota.items||[]).reduce((s,it)=> s+lineTotal(it), 0);
    let text = `💰 ${nota.titulo||"Gastos"}\nTotal: ${fmt(total)}\n\n`;
    (nota.items||[]).forEach((it,idx)=>{
      const showQty = it.cantidad && Number(it.cantidad) !== 1;
      text += `${idx+1}. ${fmt(lineTotal(it))}${showQty?` (${fmt(it.monto)} × ${it.cantidad})`:""} — ${it.descripcion||""}${it.fecha?`\n   📅 ${it.fecha}`:""}\n\n`;
    });
    text += `— Notas`;
    return text;
  }
  return `📝 ${nota.contenido||""}\n\n— Notas`;
}

async function shareNota(id){
  const nota = notasList.find(n=>n.id===id);
  if (!nota) return;
  const text = buildShareText(nota);
  if (navigator.share){
    try{ await navigator.share({text}); } catch(e){ /* cancelado por el usuario */ }
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
}

function renderNotas(){
  const filtered = notasList.filter(n => n.tipo === notaTipoActivo);
  const emptyMsgs = {
    checklist: "Aún no tienes listas. Agrega tu primera (súper, encargos, etc.) arriba.",
    gasto: "Aún no tienes listas de gasto. Créala arriba y ve agregando gastos conforme salgan.",
    texto: "Aún no tienes notas de texto. Escribe la primera arriba."
  };
  const cards = filtered.length
    ? filtered.map(stickyCardHtml).join("")
    : `<div class="empty-cork">${emptyMsgs[notaTipoActivo]}</div>`;
  return `${renderAddNotaForm()}<div class="corkboard"><div class="notes-grid">${cards}</div></div>`;
}

// ============================================================
// Acciones sobre notas
// ============================================================
async function addNota(){
  const btn = document.getElementById("btnAddNota");
  const data = { tipo: notaTipoActivo, color: notaColorSeleccionado, usuario: usuarioActual, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (notaTipoActivo === "checklist" || notaTipoActivo === "gasto"){
    const titulo = document.getElementById("notaTitulo").value.trim();
    if (!titulo){ alert("Ponle un nombre a la lista."); return; }
    data.titulo = titulo; data.items = [];
  } else {
    const contenido = document.getElementById("notaTextoInicial").value.trim();
    if (!contenido){ alert("Escribe algo antes de guardar."); return; }
    data.contenido = contenido;
  }
  btn.disabled = true;
  try{ await db.collection("notas_rapidas").add(data); }
  catch(e){ console.error("Error guardando nota:", e); alert("No se pudo guardar."); }
  btn.disabled = false;
}

async function deleteNota(id){
  if (!confirm("¿Eliminar esta nota?")) return;
  try{ await db.collection("notas_rapidas").doc(id).delete(); }
  catch(e){ console.error("Error eliminando nota:", e); }
}

async function toggleChecklistItem(notaId, idx){
  const nota = notasList.find(n=>n.id===notaId);
  if (!nota) return;
  const items = (nota.items||[]).map((it,i)=> i===idx ? {...it, done:!it.done} : it);
  try{ await db.collection("notas_rapidas").doc(notaId).update({items}); }
  catch(e){ console.error("Error actualizando item:", e); }
}

async function addChecklistItem(notaId, text){
  if (!text || !text.trim()) return;
  const nota = notasList.find(n=>n.id===notaId);
  if (!nota) return;
  const items = [...(nota.items||[]), {text:text.trim(), done:false}];
  try{ await db.collection("notas_rapidas").doc(notaId).update({items}); }
  catch(e){ console.error("Error agregando item:", e); }
}

async function addGastoItem(notaId, {monto, cantidad, descripcion}){
  if (!monto || monto <= 0) { alert("Ingresa un monto válido."); return; }
  const nota = notasList.find(n=>n.id===notaId);
  if (!nota) return;
  const items = [...(nota.items||[]), {
    monto: Number(monto), cantidad: cantidad||"", descripcion: descripcion||"", fecha: dateKey(new Date())
  }];
  try{ await db.collection("notas_rapidas").doc(notaId).update({items}); }
  catch(e){ console.error("Error agregando gasto:", e); }
}

async function deleteGastoItem(notaId, idx){
  if (!confirm("¿Eliminar este gasto de la lista?")) return;
  const nota = notasList.find(n=>n.id===notaId);
  if (!nota) return;
  const items = (nota.items||[]).filter((_,i)=> i!==idx);
  try{ await db.collection("notas_rapidas").doc(notaId).update({items}); }
  catch(e){ console.error("Error eliminando gasto:", e); }
}

function saveChecklistItemEdit(notaId, idx, newText){
  const nota = notasList.find(n=>n.id===notaId);
  if (!nota) return;
  const text = newText.trim();
  if (!text){ editingItem = null; render(); return; }
  nota.items = (nota.items||[]).map((it,i)=> i===idx ? {...it, text} : it);
  editingItem = null;
  render();
  db.collection("notas_rapidas").doc(notaId).update({items: nota.items})
    .catch(e=>console.error("Error editando item:", e));
}

function saveGastoItemEdit(notaId, idx, {monto, cantidad, descripcion}){
  const nota = notasList.find(n=>n.id===notaId);
  if (!nota) return;
  if (!monto || monto <= 0){ alert("Ingresa un monto válido."); return; }
  nota.items = (nota.items||[]).map((it,i)=> i===idx ? {...it, monto:Number(monto), cantidad:cantidad||"", descripcion:descripcion||""} : it);
  editingItem = null;
  render();
  db.collection("notas_rapidas").doc(notaId).update({items: nota.items})
    .catch(e=>console.error("Error editando gasto:", e));
}

function cancelEdit(){
  editingItem = null;
  render();
}

let textoNotaTimer = {};
function saveTextoNotaDebounced(notaId, value){
  clearTimeout(textoNotaTimer[notaId]);
  textoNotaTimer[notaId] = setTimeout(()=>{
    db.collection("notas_rapidas").doc(notaId).update({contenido:value})
      .catch(e=>console.error("Error guardando texto:", e));
  }, 600);
}

// ============================================================
// Render principal + listeners
// ============================================================
function render(){
  const content = document.getElementById("content");
  renderUsuarioBox();

  if (!usuarioActual){
    content.innerHTML = renderLogin();
    document.getElementById("loginBtn").addEventListener("click", ()=>{
      iniciarSesionUsuario(document.getElementById("loginInput").value);
    });
    document.getElementById("loginInput").addEventListener("keydown", (e)=>{
      if (e.key === "Enter") iniciarSesionUsuario(e.target.value);
    });
    document.getElementById("loginInput").focus();
    return;
  }

  content.innerHTML = renderNotas();

  content.querySelectorAll("[data-notatipo]").forEach(el=>{
    el.addEventListener("click", ()=>{ notaTipoActivo = el.dataset.notatipo; render(); });
  });
  content.querySelectorAll("[data-notacolor]").forEach(el=>{
    el.addEventListener("click", ()=>{
      notaColorSeleccionado = el.dataset.notacolor;
      content.querySelectorAll(".color-swatch").forEach(sw=>
        sw.classList.toggle("selected", sw.dataset.notacolor === notaColorSeleccionado));
    });
  });
  document.getElementById("btnAddNota").addEventListener("click", addNota);
  content.querySelectorAll("[data-delnota]").forEach(el=>{
    el.addEventListener("click", ()=> deleteNota(el.dataset.delnota));
  });
  content.querySelectorAll("[data-sharenota]").forEach(el=>{
    el.addEventListener("click", ()=> shareNota(el.dataset.sharenota));
  });
  content.querySelectorAll(".sticky-item").forEach(el=>{
    el.addEventListener("click", (e)=>{
      if (e.target.closest(".item-edit")) return;
      if (!el.dataset.notaid) return;
      toggleChecklistItem(el.dataset.notaid, parseInt(el.dataset.itemidx,10));
    });
  });
  content.querySelectorAll("[data-additembtn]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const input = content.querySelector(`[data-additem="${el.dataset.additembtn}"]`);
      addChecklistItem(el.dataset.additembtn, input.value);
      input.value = "";
    });
  });
  content.querySelectorAll("[data-additem]").forEach(el=>{
    el.addEventListener("keydown", (e)=>{
      if (e.key === "Enter"){ addChecklistItem(el.dataset.additem, el.value); el.value = ""; }
    });
  });
  content.querySelectorAll("[data-addgastobtn]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.dataset.addgastobtn;
      const montoEl = content.querySelector(`[data-gm="${id}"]`);
      const cantEl = content.querySelector(`[data-gc="${id}"]`);
      const descEl = content.querySelector(`[data-gd="${id}"]`);
      addGastoItem(id, {monto: parseFloat(montoEl.value), cantidad: cantEl.value, descripcion: descEl.value});
      montoEl.value = ""; cantEl.value = ""; descEl.value = "";
    });
  });
  content.querySelectorAll("[data-delgastoitem]").forEach(el=>{
    el.addEventListener("click", ()=> deleteGastoItem(el.dataset.delgastoitem, parseInt(el.dataset.idx,10)));
  });
  content.querySelectorAll("[data-editchecklist]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const [notaId, idx] = el.dataset.editchecklist.split(":");
      editingItem = {notaId, idx:parseInt(idx,10), tipo:"checklist"};
      render();
    });
  });
  content.querySelectorAll("[data-saveeditchecklist]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const [notaId, idx] = el.dataset.saveeditchecklist.split(":");
      const input = content.querySelector(`[data-editchecklistinput="${notaId}:${idx}"]`);
      saveChecklistItemEdit(notaId, parseInt(idx,10), input.value);
    });
  });
  content.querySelectorAll("[data-editchecklistinput]").forEach(el=>{
    el.addEventListener("keydown", (e)=>{
      if (e.key === "Enter"){
        const [notaId, idx] = el.dataset.editchecklistinput.split(":");
        saveChecklistItemEdit(notaId, parseInt(idx,10), el.value);
      }
      if (e.key === "Escape") cancelEdit();
    });
  });
  content.querySelectorAll("[data-editgasto]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const [notaId, idx] = el.dataset.editgasto.split(":");
      editingItem = {notaId, idx:parseInt(idx,10), tipo:"gasto"};
      render();
    });
  });
  content.querySelectorAll("[data-saveeditgasto]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const [notaId, idx] = el.dataset.saveeditgasto.split(":");
      const m = content.querySelector(`[data-editgm="${notaId}:${idx}"]`);
      const c = content.querySelector(`[data-editgc="${notaId}:${idx}"]`);
      const d = content.querySelector(`[data-editgd="${notaId}:${idx}"]`);
      saveGastoItemEdit(notaId, parseInt(idx,10), {monto:parseFloat(m.value), cantidad:c.value, descripcion:d.value});
    });
  });
  content.querySelectorAll("[data-canceledit]").forEach(el=>{
    el.addEventListener("click", cancelEdit);
  });
  content.querySelectorAll("[data-notatexto]").forEach(el=>{
    el.addEventListener("input", ()=> saveTextoNotaDebounced(el.dataset.notatexto, el.value));
  });
}

render();
})();
