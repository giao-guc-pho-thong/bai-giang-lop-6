/* =============================================================================================
   GÓP Ý — nút góp ý nổi (góc dưới bên phải) dùng chung cho MỌI trang của "Trợ lý học tập lớp 6":
   bài giảng, bài giải, kiểm tra online, trang mục lục.

   - Tải độc lập: trang chỉ cần khối nạp <script id="gop-y-nap" data-…> do gop-y/gan_gop_y.py chèn
     (hoặc tự thêm <script src=".../gop-y/gop-y.js">). Không phụ thuộc gì vào nội dung trang.
   - Toàn bộ giao diện nằm trong Shadow DOM: CSS của trang và của góp ý không đè lên nhau.
   - Tự thu ngữ cảnh: trang, mục đang xem, đoạn bôi đen, khối được "chỉ vào", chế độ HS/GV,
     thao tác gần đây, lỗi JS gần đây, thiết bị.
   - Lưu localStorage (khoá gopy.v1.*). Khi có API: đặt window.GOP_Y_CAU_HINH = { endpoint: "…" }
     TRƯỚC khi nạp file này → góp ý chưa gửi sẽ tự gửi lên (hàng chờ, tự thử lại khi có mạng).
   - Cấu trúc bản ghi: gop-y/schema.json. Hướng dẫn: gop-y/README.md.
   ============================================================================================= */
(function () {
  'use strict';
  if (window.GopY || !document.body) return;

  var SCHEMA = '1.0';
  var KHOA = { ds: 'gopy.v1.items', nguoi: 'gopy.v1.reporter', nhap: 'gopy.v1.draft', goiY: 'gopy.v1.hint' };
  var CH = Object.assign({ endpoint: null, headers: {}, toiDa: 500 }, window.GOP_Y_CAU_HINH || {});
  var NAP = document.getElementById('gop-y-nap');
  var META = NAP ? NAP.dataset : {};
  var T0 = Date.now();

  var LOAI = [
    ['content_error', '🐞', 'Sai kiến thức / đáp án', 'Chỗ nào sai? Ví dụ: “Đáp số câu b phải là 1 250, không phải 1 205.”'],
    ['typo_format', '✏️', 'Chính tả, trình bày', 'Chữ nào sai chính tả, chỗ nào trình bày bị vỡ, khó đọc?'],
    ['interaction_bug', '🖱️', 'Nút, tương tác không chạy', 'Em/bạn đã bấm vào đâu, mong đợi điều gì, nhưng trang lại làm gì?'],
    ['audio_issue', '🔊', 'Âm thanh, phát âm', 'Từ / câu nào nghe không được, phát âm chưa đúng?'],
    ['hard_to_understand', '🤔', 'Khó hiểu, quá khó', 'Phần nào khó hiểu? Cần giải thích thêm ở đâu?'],
    ['suggestion', '💡', 'Đề xuất, ý tưởng', 'Bạn muốn trang này có thêm / bớt điều gì?'],
    ['praise', '👍', 'Khen, thích phần này', 'Bạn thích điều gì ở phần này? (không bắt buộc)'],
    ['other', '💬', 'Ý kiến khác', 'Bạn muốn góp ý điều gì?']
  ];
  var CO_DUNG_RA = { content_error: 1, typo_format: 1 };
  var VAI = [['teacher', '🧑‍🏫', 'Giáo viên'], ['student', '🎒', 'Học sinh'], ['parent', '👪', 'Phụ huynh'], ['other', '🙂', 'Khác']];
  var DIEM = [[1, '😞', 'Rất chưa tốt'], [2, '🙁', 'Chưa tốt'], [3, '😐', 'Bình thường'], [4, '🙂', 'Tốt'], [5, '😍', 'Rất tốt']];

  // ------------------------------------------------------------------ lưu trữ
  function doc(k, md) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : md; } catch (e) { return md; } }
  function ghi(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function xoa(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } }
  function docDs() { var d = doc(KHOA.ds, []); return Array.isArray(d) ? d : []; }

  function maNgauNhien() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function nguoiGui() {
    var n = doc(KHOA.nguoi, null);
    if (!n || !n.device_id) { n = { device_id: maNgauNhien(), role: null, display_name: null }; ghi(KHOA.nguoi, n); }
    return n;
  }
  function p2(n) { n = Math.floor(Math.abs(n)); return (n < 10 ? '0' : '') + n; }
  function isoNay(d) {
    d = d || new Date();
    var o = -d.getTimezoneOffset();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' +
      p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + (o >= 0 ? '+' : '-') + p2(o / 60) + ':' + p2(o % 60);
  }
  function giay() { return Math.round((Date.now() - T0) / 1000); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function gon(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ------------------------------------------------------------------ nhật kí thao tác + lỗi (để tái hiện lỗi)
  var HOST; // phần tử chứa Shadow DOM của góp ý
  var thaoTac = [];
  var loiGanDay = (window.__gopYLoi || []).slice();
  function cuaGopY(el) { return HOST && el && (el === HOST || HOST.contains(el)); }
  function moTaPhanTu(el) {
    if (!el || !el.tagName) return '';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    var ten = el.getAttribute('aria-label') || el.getAttribute('title') || (el.dataset && el.dataset.ten) || '';
    var chu = ten || (/^(input|select|textarea)$/i.test(el.tagName) ? '' : el.textContent);
    chu = gon(chu, 60);
    return chu ? s + ' “' + chu + '”' : s;
  }
  document.addEventListener('click', function (e) {
    if (cuaGopY(e.target)) return;
    var el = e.target.closest && e.target.closest('button,a,[role=button],input,select,label,summary,[data-ten],[id]');
    thaoTac.push({ t_s: giay(), action: 'click', target: moTaPhanTu(el || e.target) });
    if (thaoTac.length > 15) thaoTac.shift();
  }, true);
  function ghiLoi(msg, nguon) {
    loiGanDay.push({ t_s: giay(), message: gon(msg, 300), source: gon(nguon, 160) });
    if (loiGanDay.length > 8) loiGanDay.shift();
  }
  window.addEventListener('error', function (e) {
    if (e.message) ghiLoi(e.message, (e.filename || '').split('/').pop() + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) { ghiLoi('Promise: ' + (e.reason && e.reason.message || e.reason), ''); });

  // ------------------------------------------------------------------ thu ngữ cảnh
  function duongDan() { try { return decodeURIComponent(location.pathname); } catch (e) { return location.pathname; } }
  function loaiTrang() {
    if (META.loai) return META.loai;
    var p = duongDan(), ten = p.split('/').pop();
    if (/\/(kiem-tra|bài kiểm tra)\//.test(p)) return ten === 'giao-vien.html' ? 'test_teacher' : (ten === 'index.html' ? 'index' : 'test');
    if (ten === 'index.html' || ten === '') return 'index';
    if (/\/(bai-giai|bài giải)\//.test(p)) return 'solution';
    return 'lesson';
  }
  function monHoc() {
    if (META.mon) return META.mon;
    var p = duongDan().toLowerCase();
    if (/(\/toan\/|\/toán\/|\/toan-lop-6)/.test(p)) return 'toan';
    if (/(\/ngu-van\/|\/ngữ văn\/|\/ngu-van-lop-6)/.test(p)) return 'ngu-van';
    if (/(\/tieng-anh\/|\/tiếng anh\/|\/tieng-anh-lop-6)/.test(p)) return 'tieng-anh';
    return null;
  }
  function urlGon() {
    // Trang mở trên máy (file://): không ghi đường dẫn ổ đĩa của người dùng, chỉ ghi đường trong dự án
    if (location.protocol === 'file:') return 'file://…/' + (META.tep || duongDan().split('/').slice(-2).join('/'));
    return location.origin + location.pathname;
  }
  function hienThi(el) { return el && el.getClientRects().length > 0; }
  function chuoiTieuDe(neo) {
    var hs = document.querySelectorAll('h1,h2,h3,h4'), ngan = [], vach = innerHeight * 0.35;
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!hienThi(h)) continue;
      var truoc = neo ? (h === neo || h.contains(neo) || (h.compareDocumentPosition(neo) & Node.DOCUMENT_POSITION_FOLLOWING))
        : h.getBoundingClientRect().top < vach;
      if (!truoc) { if (neo) break; else continue; }
      var cap = +h.tagName[1];
      while (ngan.length && ngan[ngan.length - 1].cap >= cap) ngan.pop();
      ngan.push({ cap: cap, chu: gon(h.textContent, 90) });
    }
    return ngan.map(function (x) { return x.chu; }).filter(Boolean);
  }
  function boChon(el) {
    var s = [], d = 0;
    while (el && el.nodeType === 1 && el !== document.body && d < 5) {
      if (el.id) { s.unshift('#' + el.id); break; }
      var t = el.tagName.toLowerCase(), cha = el.parentElement;
      if (cha) {
        var cung = Array.prototype.filter.call(cha.children, function (c) { return c.tagName === el.tagName; });
        if (cung.length > 1) t += ':nth-of-type(' + (cung.indexOf(el) + 1) + ')';
      }
      s.unshift(t); el = cha; d++;
    }
    return s.join(' > ');
  }
  var CHON_KHOI = 'button,a,input,select,textarea,label,img,svg,figure,table,li,p,h1,h2,h3,h4,h5,h6,blockquote,pre,[data-ten],article,section,[id]';
  function chonKhoi(el) {
    if (!el || el.nodeType !== 1) el = el && el.parentElement;
    if (!el) return null;
    if (el.ownerSVGElement) el = el.ownerSVGElement;
    var k = el.closest(CHON_KHOI);
    return k && k !== document.body ? k : el;
  }
  function thongTinKhoi(el) {
    if (!el) return null;
    var vung = el.closest('[data-ten],article,section,[id]:not(body)') || el;
    var td = vung.querySelector && vung.querySelector('h1,h2,h3,h4');
    var nhan = (vung.dataset && vung.dataset.ten) || (td && gon(td.textContent, 90)) || '';
    var data = {};
    if (el.dataset) Object.keys(el.dataset).slice(0, 8).forEach(function (k) { data[k] = gon(el.dataset[k], 60); });
    return {
      id: (el.closest('[id]:not(body)') || {}).id || null,
      section_id: vung.id || null,
      label: nhan || null,
      tag: el.tagName.toLowerCase(),
      selector: boChon(el),
      text: gon(el.textContent, 300) || null,
      data: Object.keys(data).length ? data : null
    };
  }
  function chuQuanh(khoi, chon) {
    var all = gon(khoi.textContent, 100000), i = chon ? all.indexOf(gon(chon, 100000)) : -1;
    if (i < 0) return gon(all, 400);
    return (i > 200 ? '…' : '') + all.slice(Math.max(0, i - 200), i + chon.length + 200) + (i + chon.length + 200 < all.length ? '…' : '');
  }
  function manKiemTra() {
    var ids = ['man-thong-tin', 'man-lam-bai', 'man-ket-qua'];
    for (var i = 0; i < ids.length; i++) {
      var m = document.getElementById(ids[i]);
      if (m && !m.classList.contains('an')) return ids[i].replace('man-', '');
    }
    return null;
  }
  function thietBi() {
    var ua = navigator.userAgent;
    return /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : (/Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'desktop');
  }

  /** Chụp ngữ cảnh. neo = { nguon: 'selection'|'picked'|'viewport', el, chon } */
  function thuNguCanh(neo) {
    neo = neo || {};
    var el = neo.el;
    if (!el) {
      var x = Math.round(innerWidth * 0.35), y = Math.round(innerHeight * 0.4);
      el = chonKhoi(document.elementFromPoint(x, y));
      if (cuaGopY(el)) el = null;
    }
    var khoi = el && (el.closest('[data-ten],article,section,[id]:not(body)') || el);
    var cuon = document.documentElement.scrollHeight - innerHeight;
    var h1 = document.querySelector('h1');
    return {
      page: {
        type: loaiTrang(),
        subject: monHoc(),
        lesson_id: (duongDan().split('/').pop() || 'index.html').replace(/\.html?$/, ''),
        title: document.title || null,
        h1: h1 ? gon(h1.textContent, 140) : null,
        url: urlGon(),
        file: META.tep || null,
        source_path: META.nguon || null,
        content_version: META.phienBan || null,
        lang: document.documentElement.lang || null
      },
      location: {
        anchor_source: neo.nguon || 'viewport',
        heading_path: chuoiTieuDe(neo.nguon === 'viewport' || !neo.nguon ? null : el),
        block: thongTinKhoi(el),
        selected_text: neo.chon ? gon(neo.chon, 1000) : null,
        surrounding_text: khoi ? chuQuanh(khoi, neo.chon) : null,
        scroll_pct: cuon > 0 ? Math.round(scrollY / cuon * 100) : 0
      },
      state: {
        view_mode: document.body.dataset.mode || null,
        presenting: document.body.classList.contains('tc-dang'),
        exam_screen: manKiemTra(),
        url_hash: location.hash || null,
        seconds_on_page: giay(),
        recent_actions: thaoTac.slice()
      },
      tech: {
        viewport: innerWidth + 'x' + innerHeight,
        screen: screen.width + 'x' + screen.height,
        dpr: window.devicePixelRatio || 1,
        device: thietBi(),
        touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        ua: navigator.userAgent,
        online: navigator.onLine,
        language: navigator.language || null,
        timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
        recent_errors: loiGanDay.slice()
      }
    };
  }

  // ------------------------------------------------------------------ đồng bộ lên API (khi có endpoint)
  var dangDongBo = false;
  function dongBo() {
    if (!CH.endpoint || dangDongBo || !navigator.onLine) return Promise.resolve(0);
    var cho = docDs().filter(function (r) { return r.sync.status !== 'sent' && r.sync.status !== 'rejected'; });
    if (!cho.length) return Promise.resolve(0);
    dangDongBo = true;
    var goi = cho.map(function (r) { var b = JSON.parse(JSON.stringify(r)); delete b.sync; return b; });
    return fetch(CH.endpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, CH.headers),
      body: JSON.stringify({ schema_version: SCHEMA, items: goi })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return {}; });
    }).then(function (kq) {
      // Máy chủ có thể trả { accepted: [id…] }; không trả gì = nhận hết
      var nhan = kq && Array.isArray(kq.accepted) ? kq.accepted : cho.map(function (r) { return r.id; });
      // { rejected: [{ id, reason }] }: bản ghi không hợp lệ -> không gửi lại nữa (giữ trên máy để xem lí do)
      var bo = {};
      (kq && Array.isArray(kq.rejected) ? kq.rejected : []).forEach(function (x) { if (x && x.id) bo[x.id] = gon(x.reason || 'rejected', 200); });
      capNhatSync(function (r) {
        if (nhan.indexOf(r.id) >= 0) r.sync = { status: 'sent', attempts: r.sync.attempts + 1, last_error: null, sent_at: isoNay() };
        else if (bo[r.id]) r.sync = { status: 'rejected', attempts: r.sync.attempts + 1, last_error: bo[r.id], sent_at: null };
      });
      return nhan.length;
    }).catch(function (e) {
      capNhatSync(function (r) { if (r.sync.status !== 'sent') { r.sync.status = 'failed'; r.sync.attempts++; r.sync.last_error = gon(e.message, 200); } });
      return 0;
    }).then(function (n) { dangDongBo = false; veDanhSach(); return n; });
  }
  function capNhatSync(fn) { var ds = docDs(); ds.forEach(fn); ghi(KHOA.ds, ds); }
  window.addEventListener('online', dongBo);

  // ------------------------------------------------------------------ giao diện
  HOST = document.createElement('div');
  HOST.id = 'gop-y-host';
  var R = HOST.attachShadow({ mode: 'open' });
  var inStyle = document.createElement('style');
  inStyle.textContent = '@media print{#gop-y-host{display:none!important}}';
  document.head.appendChild(inStyle);

  R.innerHTML = '<style>' + [
    ':host{all:initial;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}',
    '*{box-sizing:border-box}',
    '[hidden]{display:none!important}',
    'button{font:inherit;cursor:pointer}',
    '.fab{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483000;display:flex;align-items:center;gap:6px;',
    ' padding:11px 16px 11px 13px;border:0;border-radius:999px;background:#33498a;color:#fff;font-size:15px;font-weight:600;',
    ' box-shadow:0 6px 18px rgba(20,30,70,.28);transition:transform .15s,background .15s}',
    '.fab:hover{background:#26386e;transform:translateY(-2px)}',
    '.fab:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}',
    '.fab .ic{font-size:19px;line-height:1}',
    '.fab.xong{background:#1f8a5b}',
    '.goi-y{position:fixed;right:16px;bottom:74px;z-index:2147483000;max-width:240px;background:#1f2430;color:#fff;font-size:13.5px;line-height:1.4;',
    ' padding:9px 12px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
    '.goi-y:after{content:"";position:absolute;right:28px;bottom:-6px;border:6px solid transparent;border-bottom:0;border-top-color:#1f2430}',
    '.pn{position:fixed;right:16px;bottom:78px;z-index:2147483001;width:390px;max-height:calc(100vh - 100px);display:flex;flex-direction:column;',
    ' background:#fff;color:#1d2433;border-radius:16px;box-shadow:0 14px 40px rgba(20,30,70,.3);font-size:14.5px;line-height:1.45;overflow:hidden}',
    '.pn:focus{outline:none}',
    'button:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid #ffbf47;outline-offset:1px}',
    '.dau{display:flex;align-items:center;gap:6px;padding:10px 10px 0 14px}',
    '.dau b{font-size:16px;flex:1}',
    '.dong{border:0;background:transparent;font-size:22px;line-height:1;width:34px;height:34px;border-radius:50%;color:#5a6378}',
    '.dong:hover{background:#eef1f7}',
    '.tabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid #e3e7ef}',
    '.tab{border:0;background:transparent;padding:8px 10px;border-bottom:3px solid transparent;color:#5a6378;font-weight:600}',
    '.tab[aria-selected=true]{color:#33498a;border-bottom-color:#33498a}',
    '.than{overflow:auto;padding:12px 14px 14px;flex:1}',
    '.nc{background:#f3f6fc;border:1px solid #dbe3f3;border-radius:12px;padding:9px 11px;margin-bottom:12px}',
    '.nc .nho{font-size:12px;color:#5a6378;text-transform:uppercase;letter-spacing:.04em}',
    '.nc .vt{font-weight:600;margin:2px 0}',
    '.nc q{display:block;margin:6px 0 2px;padding:5px 9px;border-left:3px solid #ffbf47;background:#fff;font-style:italic;quotes:none;max-height:72px;overflow:auto}',
    '.nc .hang{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}',
    '.nho-nut{border:1px solid #c9d3ea;background:#fff;color:#33498a;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:600}',
    '.nho-nut:hover{background:#e8eefb}',
    '.nhan{display:block;font-weight:700;margin:12px 0 6px}',
    '.nhan i{font-weight:400;color:#5a6378;font-style:normal;font-size:13px}',
    '.luoi{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '.chip{display:flex;align-items:center;gap:6px;text-align:left;border:1.5px solid #dfe4ee;background:#fff;color:#1d2433;border-radius:10px;padding:8px 9px;font-size:13.5px;line-height:1.25}',
    '.chip:hover{border-color:#9fb0dc}',
    '.chip[aria-pressed=true]{border-color:#33498a;background:#eaf0fd;box-shadow:inset 0 0 0 1px #33498a}',
    '.chip .e{font-size:18px}',
    '.hang-chip{display:flex;gap:6px;flex-wrap:wrap}',
    '.hang-chip .chip{padding:6px 10px}',
    '.diem{display:flex;gap:4px}',
    '.diem button{border:1.5px solid transparent;background:#f5f6fa;border-radius:10px;font-size:22px;width:44px;height:40px;filter:grayscale(.6);opacity:.75}',
    '.diem button:hover{opacity:1;filter:none}',
    '.diem button[aria-pressed=true]{border-color:#33498a;background:#eaf0fd;filter:none;opacity:1}',
    'textarea,input[type=text]{width:100%;border:1.5px solid #dfe4ee;border-radius:10px;padding:9px 10px;font:inherit;color:inherit;background:#fff}',
    'textarea{min-height:84px;resize:vertical}',
    'textarea:focus,input[type=text]:focus{outline:none;border-color:#33498a;box-shadow:0 0 0 3px rgba(51,73,138,.15)}',
    '.vai-da{display:flex;align-items:center;gap:8px;margin-top:12px;color:#5a6378;font-size:13.5px}',
    '.lienket{border:0;background:none;color:#33498a;text-decoration:underline;padding:0;font-size:13.5px}',
    '.loi{color:#b3261e;font-size:13.5px;margin-top:8px}',
    '.rieng{font-size:12.5px;color:#6b7387;margin-top:8px}',
    'details{margin-top:10px;font-size:13px;color:#4a5266}',
    'summary{cursor:pointer;font-weight:600;color:#33498a}',
    'dl{margin:6px 0 0;display:grid;grid-template-columns:auto 1fr;gap:3px 10px}',
    'dt{color:#6b7387}dd{margin:0;word-break:break-word}',
    'pre{white-space:pre-wrap;word-break:break-word;background:#f5f6fa;border-radius:8px;padding:8px;font:12px/1.4 ui-monospace,Consolas,monospace;max-height:220px;overflow:auto}',
    '.chan{display:flex;gap:8px;padding:10px 14px;border-top:1px solid #e3e7ef;background:#fafbfd}',
    '.nut{flex:1;border:0;border-radius:10px;padding:11px 14px;font-weight:700;font-size:15px;background:#33498a;color:#fff}',
    '.nut:hover{background:#26386e}',
    '.nut.phu{background:#eef1f7;color:#33498a;flex:0 0 auto}',
    '.nut.phu:hover{background:#e1e7f4}',
    '.xong-ok{text-align:center;padding:22px 6px}',
    '.xong-ok .to{font-size:44px}',
    '.the{border:1px solid #e3e7ef;border-radius:12px;padding:9px 11px;margin-bottom:8px}',
    '.the .t1{display:flex;gap:6px;align-items:center;font-weight:600}',
    '.the .t1 span:nth-child(2){flex:1}',
    '.the .mo{color:#6b7387;font-size:12.5px;margin:2px 0}',
    '.the .nd{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
    '.pill{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 8px;background:#fff4d6;color:#7a5a00;white-space:nowrap}',
    '.pill.sent{background:#dcf3e6;color:#1f6b46}.pill.failed,.pill.rejected{background:#fde2e0;color:#9b2219}',
    '.the .hang{display:flex;gap:6px;margin-top:6px}',
    '.loc{display:flex;gap:6px;margin-bottom:10px}',
    '.trong{color:#6b7387;text-align:center;padding:26px 8px}',
    '.chon-nut{position:fixed;z-index:2147483002;border:0;border-radius:999px;background:#1f2430;color:#fff;font-size:13.5px;font-weight:600;padding:7px 12px;box-shadow:0 4px 14px rgba(0,0,0,.3)}',
    '.vien-chon{position:fixed;z-index:2147483002;pointer-events:none;border:3px solid #ffbf47;border-radius:6px;background:rgba(255,191,71,.12);transition:all .06s}',
    '.bang-chon{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483003;background:#1f2430;color:#fff;border-radius:999px;padding:9px 10px 9px 16px;',
    ' display:flex;gap:10px;align-items:center;font-size:14px;box-shadow:0 6px 18px rgba(0,0,0,.3);max-width:calc(100vw - 24px)}',
    '.bang-chon button{border:0;border-radius:999px;background:#fff;color:#1f2430;font-weight:700;padding:5px 12px}',
    '.tb{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:2147483003;background:#1f2430;color:#fff;padding:9px 16px;border-radius:999px;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
    '@media (max-width:600px){',
    ' .pn{left:0;right:0;bottom:0;width:auto;max-height:88vh;border-radius:18px 18px 0 0}',
    ' .fab .chu{display:none}.fab{padding:13px}',
    ' .goi-y{bottom:76px}',
    '}',
    '@media (prefers-reduced-motion:reduce){*{transition:none!important}}'
  ].join('\n') + '</style>' +
    '<div class="goi-y" hidden>Thấy chỗ nào chưa ổn, hay muốn khen một phần nào? Bấm đây để góp ý nhé!</div>' +
    '<button class="fab" type="button" aria-label="Góp ý cho trang này (Alt+Shift+G)" title="Góp ý cho trang này (Alt+Shift+G)"><span class="ic">💬</span><span class="chu">Góp ý</span></button>' +
    '<button class="chon-nut" type="button" hidden>💬 Góp ý đoạn này</button>' +
    '<div class="vien-chon" hidden></div>' +
    '<div class="bang-chon" hidden><span>🎯 Chạm vào chỗ cần góp ý</span><button type="button" data-act="huy-chon">Huỷ (Esc)</button></div>' +
    '<div class="tb" hidden role="status"></div>' +
    '<section class="pn" role="dialog" aria-label="Góp ý" tabindex="-1" hidden>' +
    '  <div class="dau"><b>💬 Góp ý</b><button class="dong" type="button" data-act="dong" aria-label="Đóng">×</button></div>' +
    '  <div class="tabs" role="tablist">' +
    '    <button class="tab" role="tab" data-tab="gui" aria-selected="true">✍️ Gửi góp ý</button>' +
    '    <button class="tab" role="tab" data-tab="ds" aria-selected="false">📋 Góp ý của tôi <span class="dem"></span></button>' +
    '  </div>' +
    '  <div class="than"></div>' +
    '  <div class="chan"></div>' +
    '</section>';
  document.body.appendChild(HOST);

  // Sự kiện trong góp ý không lan ra trang (trang có phím tắt / bấm ra ngoài để đóng…)
  ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend',
    'keydown', 'keyup', 'keypress', 'input', 'change'].forEach(function (t) {
    R.addEventListener(t, function (e) {
      if (t === 'keydown' && e.key === 'Escape') { e.preventDefault(); dong(); }
      e.stopPropagation();
    });
  });

  function $(s) { return R.querySelector(s); }
  var FAB = $('.fab'), PN = $('.pn'), THAN = $('.than'), CHAN = $('.chan'), CHON_NUT = $('.chon-nut'), GOI_Y = $('.goi-y');

  var henTb;
  function thongBao(chu, ms) {
    var tb = $('.tb'); tb.textContent = chu; tb.hidden = false;
    clearTimeout(henTb); henTb = setTimeout(function () { tb.hidden = true; }, ms || 2600);
  }

  // ---------------------------------------------- trạng thái biểu mẫu
  var tab = 'gui', xem = 'form', locTrang = true;
  var F, NC, NC_goc, loiForm = '';
  function formMoi() {
    var n = nguoiGui();
    return { id: null, created_at: null, category: null, message: '', expected: '', rating: null,
      role: n.role, display_name: n.display_name || '', doiVai: !n.role };
  }
  function luuNhap() {
    if (F.id) return; // đang sửa bản ghi cũ: không ghi nháp
    if (F.category || F.message || F.expected || F.rating) ghi(KHOA.nhap, { url: urlGon(), f: F, t: Date.now() });
    else xoa(KHOA.nhap);
  }
  function layNhap() {
    var d = doc(KHOA.nhap, null);
    if (d && d.url === urlGon() && Date.now() - d.t < 864e5) return Object.assign(formMoi(), d.f, { id: null });
    return null;
  }

  // ---------------------------------------------- vẽ
  function ve() {
    R.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    var n = docDs().length;
    $('.dem').textContent = n ? '(' + n + ')' : '';
    if (tab === 'ds') return veDanhSach();
    if (xem === 'xong') return veXong();
    veForm();
  }

  function moTaViTri(nc) {
    var l = nc.location, hp = l.heading_path;
    var vt = hp.length ? hp.slice(-2).join(' › ') : (nc.page.h1 || nc.page.title || 'Trang này');
    if (l.anchor_source === 'picked' && l.block) vt += ' — ' + (l.block.label && hp.indexOf(l.block.label) < 0 ? l.block.label + ' · ' : '') + l.block.tag;
    return vt;
  }

  function veForm() {
    var l = NC.location, h = '';
    h += '<div class="nc"><div class="nho">' + (l.anchor_source === 'viewport' ? '📍 Bạn đang xem' : (l.anchor_source === 'selection' ? '📍 Đoạn bạn đã chọn' : '🎯 Chỗ bạn đã chỉ')) + '</div>';
    h += '<div class="vt">' + esc(moTaViTri(NC)) + '</div>';
    if (l.selected_text) h += '<q>' + esc(gon(l.selected_text, 300)) + '</q>';
    else if (l.anchor_source === 'picked' && l.block && l.block.text) h += '<q>' + esc(gon(l.block.text, 160)) + '</q>';
    h += '<div class="hang"><button class="nho-nut" type="button" data-act="chon">🎯 ' + (l.anchor_source === 'viewport' ? 'Chỉ vào đúng chỗ' : 'Chỉ chỗ khác') + '</button>';
    if (l.anchor_source !== 'viewport') h += '<button class="nho-nut" type="button" data-act="bo-ghim">✕ Bỏ chọn</button>';
    h += '</div></div>';

    h += '<span class="nhan">Bạn muốn góp ý về điều gì?</span><div class="luoi">';
    LOAI.forEach(function (x) {
      h += '<button class="chip" type="button" data-loai="' + x[0] + '" aria-pressed="' + (F.category === x[0]) + '"><span class="e">' + x[1] + '</span>' + esc(x[2]) + '</button>';
    });
    h += '</div>';

    var loai = LOAI.filter(function (x) { return x[0] === F.category; })[0];
    h += '<label class="nhan" for="gy-nd">Nội dung góp ý ' + (F.category === 'praise' ? '<i>(không bắt buộc)</i>' : '') + '</label>';
    h += '<textarea id="gy-nd" maxlength="3000" placeholder="' + esc(loai ? loai[3] : 'Chọn loại góp ý ở trên, rồi viết vài dòng…') + '">' + esc(F.message) + '</textarea>';
    if (CO_DUNG_RA[F.category]) {
      h += '<label class="nhan" for="gy-dr">Đúng ra phải là… <i>(nếu bạn biết)</i></label>';
      h += '<input type="text" id="gy-dr" maxlength="1000" placeholder="Ví dụ: 1 250 / “Thánh Gióng” / She goes to school…" value="' + esc(F.expected) + '">';
    }

    h += '<span class="nhan">Bạn thấy trang này thế nào? <i>(không bắt buộc)</i></span><div class="diem">';
    DIEM.forEach(function (d) {
      h += '<button type="button" data-diem="' + d[0] + '" aria-pressed="' + (F.rating === d[0]) + '" title="' + d[2] + '" aria-label="' + d[2] + '">' + d[1] + '</button>';
    });
    h += '</div>';

    if (F.doiVai || !F.role) {
      h += '<span class="nhan">Bạn là…</span><div class="hang-chip">';
      VAI.forEach(function (v) {
        h += '<button class="chip" type="button" data-vai="' + v[0] + '" aria-pressed="' + (F.role === v[0]) + '"><span class="e">' + v[1] + '</span>' + v[2] + '</button>';
      });
      h += '</div>';
    } else {
      var v = VAI.filter(function (x) { return x[0] === F.role; })[0];
      h += '<div class="vai-da">Bạn là: <b>' + v[1] + ' ' + v[2] + '</b>' + (F.display_name ? ' · ' + esc(F.display_name) : '') +
        ' <button class="lienket" type="button" data-act="doi-vai">đổi</button></div>';
    }
    if ((F.doiVai || !F.role) && F.role && F.role !== 'student') {
      h += '<input type="text" id="gy-ten" maxlength="120" style="margin-top:8px" placeholder="Tên, trường (không bắt buộc) — để tiện trao đổi lại" value="' + esc(F.display_name) + '">';
    }
    if (loiForm) h += '<div class="loi" role="alert">⚠️ ' + esc(loiForm) + '</div>';
    h += '<div class="rieng">🔒 Không cần ghi họ tên, số điện thoại hay thông tin cá nhân của học sinh.</div>';

    h += '<details><summary>📎 Thông tin tự đính kèm</summary><dl>' +
      '<dt>Trang</dt><dd>' + esc(NC.page.title || NC.page.lesson_id) + '</dd>' +
      '<dt>Vị trí</dt><dd>' + esc(NC.location.heading_path.join(' › ') || '—') + '</dd>' +
      '<dt>Khối</dt><dd>' + esc(NC.location.block ? NC.location.block.selector || NC.location.block.tag : '—') + '</dd>' +
      (NC.state.view_mode ? '<dt>Chế độ</dt><dd>' + esc(NC.state.view_mode === 'gv' ? 'Giáo viên' : 'Học sinh') + '</dd>' : '') +
      '<dt>Thiết bị</dt><dd>' + esc(NC.tech.device + ' · ' + NC.tech.viewport) + '</dd>' +
      '<dt>Thao tác</dt><dd>' + NC.state.recent_actions.length + ' lần bấm gần đây</dd>' +
      '<dt>Lỗi trang</dt><dd>' + (NC.tech.recent_errors.length ? NC.tech.recent_errors.length + ' lỗi' : 'không có') + '</dd>' +
      '</dl><details><summary>Xem dạng JSON</summary><pre>' + esc(JSON.stringify(NC, null, 2)) + '</pre></details></details>';
    THAN.innerHTML = h;
    CHAN.innerHTML = (F.id ? '<button class="nut phu" type="button" data-act="huy-sua">Huỷ sửa</button>' : '') +
      '<button class="nut" type="button" data-act="gui">' + (F.id ? '💾 Lưu thay đổi' : '📨 Gửi góp ý') + '</button>';
  }

  function veXong() {
    THAN.innerHTML = '<div class="xong-ok"><div class="to">🎉</div><p><b>Cảm ơn bạn đã góp ý!</b></p>' +
      '<p style="color:#5a6378;font-size:13.5px">' + (CH.endpoint ? 'Góp ý đã được ghi lại và sẽ tự gửi đi.' :
      'Góp ý đã được lưu trên máy này. <i>(Bản thử nghiệm — chưa gửi lên máy chủ; xem lại ở mục “Góp ý của tôi”.)</i>') + '</p></div>';
    CHAN.innerHTML = '<button class="nut phu" type="button" data-act="dong">Đóng</button><button class="nut" type="button" data-act="them">✍️ Góp ý thêm</button>';
  }

  function ngayGio(s) {
    var d = new Date(s);
    return isNaN(d) ? '' : p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function veDanhSach() {
    if (PN.hidden || tab !== 'ds') return;
    var ds = docDs(), url = urlGon();
    var hien = locTrang ? ds.filter(function (r) { return r.context.page.url === url; }) : ds;
    var h = '<div class="loc"><button class="nho-nut" type="button" data-loc="1" aria-pressed="' + locTrang + '"' + (locTrang ? ' style="background:#33498a;color:#fff"' : '') + '>Trang này</button>' +
      '<button class="nho-nut" type="button" data-loc="0"' + (!locTrang ? ' style="background:#33498a;color:#fff"' : '') + '>Tất cả (' + ds.length + ')</button></div>';
    if (!hien.length) h += '<div class="trong">Chưa có góp ý nào' + (locTrang ? ' cho trang này' : '') + '.</div>';
    hien.forEach(function (r) {
      var lo = LOAI.filter(function (x) { return x[0] === r.feedback.category; })[0] || LOAI[7];
      var st = r.sync.status, nhanSt = { sent: 'Đã gửi', failed: 'Gửi lỗi', rejected: 'Bị từ chối' }[st] || 'Trên máy';
      var vt = r.context.location.heading_path.slice(-1)[0] || '';
      h += '<div class="the"><div class="t1"><span>' + lo[1] + '</span><span>' + esc(lo[2]) + '</span><span class="pill ' + st + '">' + nhanSt + '</span></div>' +
        '<div class="mo">' + esc(ngayGio(r.created_at)) + (r.updated_at ? ' (đã sửa)' : '') + ' · ' + esc(gon(r.context.page.title || r.context.page.lesson_id, 60)) + (vt ? ' › ' + esc(gon(vt, 40)) : '') + '</div>' +
        (r.context.location.selected_text ? '<div class="mo">“' + esc(gon(r.context.location.selected_text, 90)) + '”</div>' : '') +
        '<div class="nd">' + (r.feedback.rating ? DIEM[r.feedback.rating - 1][1] + ' ' : '') + esc(r.feedback.message || '') + '</div>' +
        '<div class="hang">' + (st !== 'sent' && r.context.page.url === url ? '<button class="nho-nut" type="button" data-sua="' + r.id + '">✏️ Sửa</button>' : '') +
        '<button class="nho-nut" type="button" data-xoa="' + r.id + '">🗑 Xoá</button></div>' +
        '<details><summary>Chi tiết (JSON)</summary><pre>' + esc(JSON.stringify(r, null, 2)) + '</pre></details></div>';
    });
    THAN.innerHTML = h;
    CHAN.innerHTML = '<button class="nut phu" type="button" data-act="xoa-het"' + (ds.length ? '' : ' disabled') + '>🗑 Xoá hết</button>' +
      '<button class="nut phu" type="button" data-act="chep"' + (ds.length ? '' : ' disabled') + '>📋 Chép</button>' +
      '<button class="nut" type="button" data-act="tai"' + (ds.length ? '' : ' disabled') + '>⬇️ Tải file JSON</button>';
  }

  // ---------------------------------------------- mở / đóng
  var dangMo = false, nutTruoc = null;
  function mo(neo) {
    if (anVi()) return;
    tatGoiY();
    nutTruoc = document.activeElement;
    NC_goc = thuNguCanh({ nguon: 'viewport' });
    NC = neo ? thuNguCanh(neo) : NC_goc;
    if (!neo) { var c = layChon(); if (c) NC = thuNguCanh(c); }
    if (!F || (!F.id && !F.category && !F.message)) F = layNhap() || formMoi();
    tab = 'gui'; xem = 'form'; loiForm = '';
    PN.hidden = false; dangMo = true; CHON_NUT.hidden = true;
    FAB.setAttribute('aria-expanded', 'true');
    ve();
    PN.focus({ preventScroll: true }); // focus khung (không focus ô đầu: viền focus trông như đã chọn)
  }
  function dong() {
    if (dangChon) return huyChon();
    if (!dangMo) return;
    PN.hidden = true; dangMo = false;
    FAB.setAttribute('aria-expanded', 'false');
    if (xem === 'xong') { F = null; xem = 'form'; }
    if (nutTruoc && nutTruoc.focus && !cuaGopY(nutTruoc)) try { nutTruoc.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ }
  }
  FAB.addEventListener('click', function () { dangMo ? dong() : mo(); });
  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.shiftKey && (e.key === 'G' || e.key === 'g' || e.code === 'KeyG')) { e.preventDefault(); dangMo ? dong() : mo(); }
    else if (e.key === 'Escape' && dangChon) { e.preventDefault(); huyChon(); }
  }, true);

  // ---------------------------------------------- gửi
  function gui() {
    docInput();
    loiForm = '';
    if (!F.category) loiForm = 'Bạn chọn giúp một loại góp ý ở trên nhé.';
    else if (F.category !== 'praise' && F.message.trim().length < 3) loiForm = 'Bạn viết thêm vài chữ để mô tả góp ý nhé.';
    else if (!F.role) loiForm = 'Bạn cho biết mình là giáo viên, học sinh hay phụ huynh nhé.';
    if (loiForm) { veForm(); return; }
    var n = nguoiGui();
    n.role = F.role; n.display_name = F.role === 'student' ? null : (F.display_name.trim() || null);
    ghi(KHOA.nguoi, n);
    var ds = docDs(), cu = F.id && ds.filter(function (r) { return r.id === F.id; })[0];
    var rec = {
      schema_version: SCHEMA,
      id: cu ? cu.id : maNgauNhien(),
      created_at: cu ? cu.created_at : isoNay(),
      updated_at: cu ? isoNay() : null,
      reporter: { role: n.role, device_id: n.device_id, display_name: n.display_name },
      feedback: {
        category: F.category,
        message: F.message.trim(),
        expected: CO_DUNG_RA[F.category] && F.expected.trim() ? F.expected.trim() : null,
        rating: F.rating || null
      },
      context: cu ? cu.context : NC,
      sync: { status: 'pending', attempts: 0, last_error: null, sent_at: null }
    };
    if (cu) ds = ds.map(function (r) { return r.id === rec.id ? rec : r; });
    else ds.unshift(rec);
    while (ds.length > CH.toiDa) {
      var i = -1;
      for (var k = ds.length - 1; k >= 0; k--) if (ds[k].sync.status === 'sent') { i = k; break; }
      ds.splice(i >= 0 ? i : ds.length - 1, 1);
    }
    if (!ghi(KHOA.ds, ds)) { loiForm = 'Bộ nhớ trình duyệt đã đầy. Vào “Góp ý của tôi” → tải file JSON rồi xoá bớt góp ý cũ.'; veForm(); return; }
    xoa(KHOA.nhap);
    F = formMoi(); xem = 'xong'; ve();
    FAB.classList.add('xong'); setTimeout(function () { FAB.classList.remove('xong'); }, 1600);
    dongBo();
  }
  function docInput() {
    if (!F) return;
    var nd = R.getElementById('gy-nd'), dr = R.getElementById('gy-dr'), ten = R.getElementById('gy-ten');
    if (nd) F.message = nd.value;
    if (dr) F.expected = dr.value;
    if (ten) F.display_name = ten.value;
  }

  // ---------------------------------------------- xuất file
  function goiXuat() {
    return { export_version: SCHEMA, exported_at: isoNay(), device_id: nguoiGui().device_id, items: docDs() };
  }
  function taiFile() {
    var blob = new Blob([JSON.stringify(goiXuat(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = 'gop-y-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function chep() {
    var s = JSON.stringify(goiXuat(), null, 2);
    (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { thongBao('Đã chép toàn bộ góp ý (JSON)'); },
      function () { thongBao('Trình duyệt không cho chép — hãy dùng “Tải file JSON”.', 3500); });
  }

  // ---------------------------------------------- xử lí bấm trong khung
  R.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    var d = b.dataset;
    if (d.tab) { docInput(); luuNhap(); tab = d.tab; return ve(); }
    if (d.loai) { docInput(); F.category = d.loai; loiForm = ''; luuNhap(); veForm(); var t = R.getElementById('gy-nd'); if (t) t.focus({ preventScroll: true }); return; }
    if (d.diem) { docInput(); F.rating = F.rating === +d.diem ? null : +d.diem; luuNhap(); return veForm(); }
    if (d.vai) { docInput(); F.role = d.vai; F.doiVai = true; loiForm = ''; return veForm(); }
    if (d.loc) { locTrang = d.loc === '1'; return veDanhSach(); }
    if (d.xoa) {
      if (!confirm('Xoá góp ý này khỏi máy?')) return;
      ghi(KHOA.ds, docDs().filter(function (r) { return r.id !== d.xoa; })); return ve();
    }
    if (d.sua) {
      var r = docDs().filter(function (x) { return x.id === d.sua; })[0];
      if (!r) return;
      F = { id: r.id, created_at: r.created_at, category: r.feedback.category, message: r.feedback.message || '', expected: r.feedback.expected || '',
        rating: r.feedback.rating, role: r.reporter.role, display_name: r.reporter.display_name || '', doiVai: false };
      NC = r.context; tab = 'gui'; xem = 'form'; return ve();
    }
    switch (d.act) {
      case 'dong': return dong();
      case 'gui': return gui();
      case 'them': F = formMoi(); NC = NC_goc = thuNguCanh({ nguon: 'viewport' }); xem = 'form'; return ve();
      case 'huy-sua': F = formMoi(); NC = NC_goc; return ve();
      case 'doi-vai': docInput(); F.doiVai = true; return veForm();
      case 'chon': docInput(); return batDauChon();
      case 'huy-chon': return huyChon();
      case 'bo-ghim': docInput(); NC = NC_goc; return veForm();
      case 'tai': return taiFile();
      case 'chep': return chep();
      case 'xoa-het':
        if (!confirm('Xoá TẤT CẢ góp ý đã lưu trên máy này? (Nên tải file JSON về trước.)')) return;
        ghi(KHOA.ds, []); return ve();
    }
  });
  var henNhap;
  R.addEventListener('input', function () { clearTimeout(henNhap); henNhap = setTimeout(function () { docInput(); luuNhap(); }, 400); });

  // ---------------------------------------------- bôi đen → "Góp ý đoạn này"
  var chonLuu = null;
  function layChon() {
    var s = window.getSelection && getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    var chu = s.toString().trim();
    if (chu.length < 2) return null;
    var r = s.getRangeAt(0), el = r.commonAncestorContainer;
    if (el.nodeType !== 1) el = el.parentElement;
    if (!el || cuaGopY(el) || el.closest('input,textarea,[contenteditable=""],[contenteditable=true]')) return null;
    return { nguon: 'selection', el: chonKhoi(el), chon: chu, rect: r.getBoundingClientRect() };
  }
  function kiemChon() {
    if (dangMo || dangChon || anVi()) { CHON_NUT.hidden = true; return; }
    var c = layChon();
    if (!c) { CHON_NUT.hidden = true; chonLuu = null; return; }
    chonLuu = c;
    var x = Math.min(innerWidth - 170, Math.max(8, c.rect.left + c.rect.width / 2 - 75));
    var y = c.rect.bottom + 10;
    if (y > innerHeight - 50) y = Math.max(8, c.rect.top - 44);
    CHON_NUT.style.left = x + 'px'; CHON_NUT.style.top = y + 'px';
    CHON_NUT.hidden = false;
  }
  ['mouseup', 'touchend', 'keyup'].forEach(function (t) {
    document.addEventListener(t, function (e) { if (!cuaGopY(e.target)) setTimeout(kiemChon, 30); });
  });
  document.addEventListener('selectionchange', function () { if (!CHON_NUT.hidden && !layChon()) CHON_NUT.hidden = true; });
  var henCuon = false; // cuộn trang: nút đi theo vùng chọn (trên điện thoại kéo tay cầm chọn chữ hay làm trang cuộn nhẹ)
  window.addEventListener('scroll', function () {
    if (CHON_NUT.hidden || henCuon) return;
    henCuon = true; setTimeout(function () { henCuon = false; kiemChon(); }, 80);
  }, { passive: true });
  CHON_NUT.addEventListener('mousedown', function (e) { e.preventDefault(); }); // giữ vùng chọn
  CHON_NUT.addEventListener('click', function () { var c = chonLuu; CHON_NUT.hidden = true; if (c) mo(c); });

  // ---------------------------------------------- chế độ "chỉ vào chỗ cần góp ý"
  var dangChon = false, VIEN = $('.vien-chon'), BANG = $('.bang-chon');
  function veVien(el) {
    if (!el) { VIEN.hidden = true; return; }
    var r = el.getBoundingClientRect();
    VIEN.style.left = (r.left - 3) + 'px'; VIEN.style.top = (r.top - 3) + 'px';
    VIEN.style.width = (r.width + 6) + 'px'; VIEN.style.height = (r.height + 6) + 'px';
    VIEN.hidden = false;
  }
  function khoiTai(e) { return cuaGopY(e.target) ? null : chonKhoi(e.target); }
  function diChuot(e) { if (e.pointerType !== 'touch') veVien(khoiTai(e)); }
  function chan(e) { if (!cuaGopY(e.target)) { e.stopPropagation(); if (e.type !== 'pointerdown' && e.type !== 'touchstart') e.preventDefault(); } }
  function bamChon(e) {
    if (cuaGopY(e.target)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var el = khoiTai(e);
    ketThucChon();
    if (el) { veVien(el); setTimeout(function () { VIEN.hidden = true; }, 700); }
    PN.hidden = false; dangMo = true;
    NC = thuNguCanh({ nguon: 'picked', el: el });
    xem = 'form'; tab = 'gui'; ve();
  }
  var SU_KIEN_CHAN = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'touchstart', 'dblclick', 'contextmenu'];
  function batDauChon() {
    dangChon = true; PN.hidden = true; BANG.hidden = false;
    document.addEventListener('pointermove', diChuot, true);
    SU_KIEN_CHAN.forEach(function (t) { document.addEventListener(t, chan, true); });
    document.addEventListener('click', bamChon, true);
  }
  function ketThucChon() {
    dangChon = false; BANG.hidden = true; VIEN.hidden = true;
    document.removeEventListener('pointermove', diChuot, true);
    SU_KIEN_CHAN.forEach(function (t) { document.removeEventListener(t, chan, true); });
    document.removeEventListener('click', bamChon, true);
  }
  function huyChon() { ketThucChon(); PN.hidden = false; dangMo = true; ve(); }

  // ---------------------------------------------- tự ẩn khi đang chiếu / đang làm bài kiểm tra
  function anVi() {
    var b = document.body;
    if (b.classList.contains('tc-dang') || b.classList.contains('dang-lam') || document.fullscreenElement) return true;
    // Trang làm bài kiểm tra online: chỉ hiện sau khi nộp (màn kết quả)
    var lb = document.getElementById('man-lam-bai'), kq = document.getElementById('man-ket-qua');
    return !!(lb && kq && kq.classList.contains('an'));
  }
  var henAn = false;
  function capNhatAn() {
    henAn = false;
    var an = anVi();
    FAB.hidden = an;
    if (an) { if (dangChon) ketThucChon(); if (dangMo) dong(); CHON_NUT.hidden = true; tatGoiY(); }
  }
  new MutationObserver(function () { if (!henAn) { henAn = true; setTimeout(capNhatAn, 40); } })
    .observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
  document.addEventListener('fullscreenchange', capNhatAn);
  capNhatAn();

  // ---------------------------------------------- gợi ý lần đầu (mỗi máy một lần)
  function tatGoiY() { if (!GOI_Y.hidden) { GOI_Y.hidden = true; ghi(KHOA.goiY, 1); } }
  if (!doc(KHOA.goiY, 0)) {
    setTimeout(function () { if (!dangMo && !anVi()) { GOI_Y.hidden = false; setTimeout(tatGoiY, 7000); } }, 3500);
  }
  GOI_Y.addEventListener('click', function () { tatGoiY(); mo(); });

  // ---------------------------------------------- API công khai (để thử / tích hợp sau này)
  window.GopY = {
    version: SCHEMA,
    mo: function () { mo(); },
    dong: dong,
    danhSach: docDs,
    xuat: goiXuat,
    dongBo: dongBo,
    nguCanh: function () { return thuNguCanh({ nguon: 'viewport' }); },
    cauHinh: CH
  };
  dongBo();
})();
