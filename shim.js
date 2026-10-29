/* Local stand-in for the Claude artifact runtime (db, user, downloads).
   Loaded only when window.claude is missing, e.g. on GitHub Pages or a local server.
   Data lives in this browser's localStorage: NOT shared between devices or people. */
(function(){
  if (window.claude && window.claude.use) return;
  var PFX = "apvms:", listeners = [], bc = null;
  try { bc = new BroadcastChannel("apvms"); bc.onmessage = notify; } catch(e){}
  function key(p){ return PFX + p; }
  function readDoc(p){ try { var r = localStorage.getItem(key(p)); return r ? JSON.parse(r) : null; } catch(e){ return null; } }
  function writeDoc(p, rec){ localStorage.setItem(key(p), JSON.stringify(rec)); ping(); }
  function delDoc(p){ localStorage.removeItem(key(p)); ping(); }
  function ping(){ notify(); try { bc && bc.postMessage(1); } catch(e){} }
  function notify(){ listeners.slice().forEach(function(f){ try { f(); } catch(e){} }); }
  window.addEventListener("storage", function(e){ if (e.key && e.key.indexOf(PFX) === 0) notify(); });
  function snap(id, rec){
    return { id: id, exists: !!rec, data: function(){ return rec ? JSON.parse(JSON.stringify(rec.data)) : undefined; },
             metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function merge(a, b){
    var o = Object.assign({}, a);
    Object.keys(b).forEach(function(k){
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) o[k] = merge(o[k], b[k]);
      else o[k] = b[k];
    });
    return o;
  }
  function rid(){ return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function docRef(path){
    var id = path.split("/").pop();
    var ref = {
      id: id, path: path,
      get: function(){ return Promise.resolve(snap(id, readDoc(path))); },
      set: function(d){ var cur = readDoc(path); writeDoc(path, { data: JSON.parse(JSON.stringify(d)), version: (cur ? cur.version : 0) + 1, updatedAt: new Date().toISOString() }); return Promise.resolve(); },
      update: function(d){
        var cur = readDoc(path);
        if (!cur) return Promise.reject({ code: "invalid_argument", message: "document does not exist" });
        writeDoc(path, { data: merge(cur.data, JSON.parse(JSON.stringify(d))), version: cur.version + 1, updatedAt: new Date().toISOString() });
        return Promise.resolve();
      },
      delete: function(){ delDoc(path); return Promise.resolve(); },
      acquire: function(o){ return Promise.resolve({ acquired: true, holder: o && o.holder, expiresAt: new Date(Date.now() + 5000).toISOString() }); },
      onSnapshot: function(next){
        var last = null;
        function run(){ var s = JSON.stringify(readDoc(path)); if (s === last) return; last = s; next(snap(id, readDoc(path))); }
        listeners.push(run); setTimeout(run, 0);
        return function(){ listeners = listeners.filter(function(f){ return f !== run; }); };
      },
      collection: function(sub){ return colRef(path + "/" + sub); }
    };
    return ref;
  }
  function list(path){
    var depth = path.split("/").length + 1, out = [];
    for (var i = 0; i < localStorage.length; i++){
      var k = localStorage.key(i);
      if (k.indexOf(PFX + path + "/") !== 0) continue;
      var p = k.slice(PFX.length);
      if (p.split("/").length !== depth) continue;
      var rec = readDoc(p); if (rec) out.push({ id: p.split("/").pop(), rec: rec });
    }
    return out;
  }
  function query(path, filters, order, lim){
    function run(){
      var rows = list(path).filter(function(r){
        return filters.every(function(f){
          var v = r.rec.data[f[0]], w = f[2];
          switch (f[1]){
            case "==": return v === w; case "!=": return v !== w;
            case "<": return v < w; case "<=": return v <= w; case ">": return v > w; case ">=": return v >= w;
            case "in": return w.indexOf(v) >= 0; case "not-in": return w.indexOf(v) < 0;
            case "array-contains": return Array.isArray(v) && v.indexOf(w) >= 0;
          } return true; });
      });
      if (order){ rows.sort(function(a, b){ var x = a.rec.data[order[0]], y = b.rec.data[order[0]];
        if (x === undefined) return 1; if (y === undefined) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * (order[1] === "desc" ? -1 : 1); }); }
      else rows.sort(function(a, b){ return a.id < b.id ? -1 : 1; });
      if (lim) rows = rows.slice(0, lim);
      return rows;
    }
    function qs(rows){
      var docs = rows.map(function(r){ return snap(r.id, r.rec); });
      return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function(){ return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    var q = {
      where: function(f, o, v){ return query(path, filters.concat([[f, o, v]]), order, lim); },
      orderBy: function(f, d){ return query(path, filters, [f, d || "asc"], lim); },
      limit: function(n){ return query(path, filters, order, n); },
      get: function(){ return Promise.resolve(qs(run())); },
      onSnapshot: function(next){
        var last = null;
        function go(){ var rows = run(), s = JSON.stringify(rows); if (s === last) return; last = s; next(qs(rows)); }
        listeners.push(go); setTimeout(go, 0);
        return function(){ listeners = listeners.filter(function(f){ return f !== go; }); };
      }
    };
    return q;
  }
  function colRef(path){
    var q = query(path, [], null, 0);
    q.path = path;
    q.doc = function(id){ return docRef(path + "/" + (id || rid())); };
    q.add = function(d){ var r = docRef(path + "/" + rid()); return r.set(d).then(function(){ return r; }); };
    return q;
  }
  var db = { doc: docRef, collection: colRef };
  var uid = "demo-owner";
  var user = {
    id: function(){ return Promise.resolve(uid); },
    isOwner: function(){ return Promise.resolve(true); },
    canEdit: function(){ return Promise.resolve(true); },
    can: function(){ return Promise.resolve(true); },
    me: function(){ return Promise.resolve({ id: uid, name: "Demo Admin" }); },
    profiles: function(ids){ var o = {}; (ids || []).forEach(function(i){ o[i] = { name: i === uid ? "Demo Admin" : "" }; }); return Promise.resolve(o); }
  };
  var downloads = { save: function(o){
    var a = document.createElement("a"); a.href = URL.createObjectURL(o.data); a.download = o.filename;
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return Promise.resolve();
  } };
  window.claude = { use: function(name){ return Promise.resolve({ db: db, user: user, downloads: downloads }[name] || null); } };
  document.addEventListener("DOMContentLoaded", function(){
    var b = document.createElement("div");
    b.textContent = "Demo copy: data is stored only in this browser.";
    b.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:#ffc700;color:#16202e;font:600 13px sans-serif;text-align:center;padding:6px;z-index:9999";
    document.body.appendChild(b);
  });
})();
