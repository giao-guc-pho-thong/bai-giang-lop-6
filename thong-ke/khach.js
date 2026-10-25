/* =============================================================================================
   THỐNG KÊ KHÁCH — nhận diện thiết bị bằng Fingerprint (fingerprint.com) dùng chung cho MỌI trang
   của dự án (bài giảng, bài giải, luyện tập, kiểm tra online, mục lục, trang pháp lý), mọi lớp.

   - Tải độc lập: trang chỉ cần khối nạp <script id="thong-ke-nap" data-may data-web data-lop>
     do thong-ke/gan_khach.py chèn (deploy tự gọi). Không phụ thuộc gì vào nội dung trang, không có
     giao diện, không đổi gì trên trang.
   - CHỈ chạy trên trang web thật (https + đúng tên miền của dự án). Mở trên máy (file://), chạy
     offline hay trên máy chủ thử thì không gọi gì ra ngoài. Ghi đè bằng
     window.THONG_KE_CAU_HINH = { bat: true } TRƯỚC khi nạp file này (để thử).
   - Mỗi lượt tải trang gọi Fingerprint ĐÚNG MỘT LẦN (mỗi lần gọi = một "event" tính phí ở gói Pro),
     kèm nhãn (lớp, loại trang, môn, trang) để lọc trên bảng điều khiển của Fingerprint.
   - Kết quả (visitor_id, event_id) để ở window.ThongKe.khach + sessionStorage (khoá thongke.v1.khach),
     phát sự kiện "thong-ke:khach" trên document — công cụ khác (nút góp ý…) muốn gắn kèm thì nghe
     sự kiện này hoặc chờ window.ThongKe.sanSang. Không ghi gì lên console.
   - Lỗi mạng / CDN bị chặn / trình duyệt cũ: nuốt lỗi, trang vẫn chạy bình thường.
   - Điều khoản: DIEU-KHOAN-SU-DUNG.md, Điều 6.6. Hướng dẫn: thong-ke/README.md.
   ============================================================================================= */
(function () {
  'use strict';
  if (window.ThongKe) return;

  // Khoá CÔNG KHAI của Fingerprint (được phép lộ trong mã nguồn web; giới hạn tên miền trong bảng điều khiển
  // của Fingerprint → Settings → API keys → Allowed domains).
  var KHOA = 'fnbxtPyvWVkl68c2qsca';
  var CDN = 'https://fpjscdn.net/v4/';
  var TREN_WEB = location.protocol === 'https:' && location.hostname === 'giao-guc-pho-thong.github.io';
  var CH = Object.assign({ bat: TREN_WEB, khoa: KHOA, cdn: CDN }, window.THONG_KE_CAU_HINH || {});
  var KHOA_LUU = 'thongke.v1.khach';
  var NAP = document.getElementById('thong-ke-nap');
  var GOP_Y = document.getElementById('gop-y-nap'); // khối nạp nút góp ý: có sẵn loại trang, môn, file
  var TK = window.ThongKe = { khach: null, sanSang: null, cauHinh: CH };

  function docLuu() { try { var v = sessionStorage.getItem(KHOA_LUU); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function ghiLuu(v) { try { sessionStorage.setItem(KHOA_LUU, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  function phat(k) { try { document.dispatchEvent(new CustomEvent('thong-ke:khach', { detail: k })); } catch (e) { /* bỏ qua */ } }

  // Nhãn gửi kèm mỗi lượt (hiện ở cột "tag" trên bảng điều khiển): chỉ thông tin về TRANG, không có gì về người dùng.
  function nhan() {
    var d = NAP ? NAP.dataset : {}, g = GOP_Y ? GOP_Y.dataset : {};
    var t = { lop: d.lop || null, loai: g.loai || null, mon: g.mon || null,
              trang: (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '') };
    Object.keys(t).forEach(function (k) { if (!t[k]) delete t[k]; });
    return t;
  }

  TK.khach = docLuu(); // kết quả của lượt trước trong cùng phiên (nếu có) — để công cụ khác dùng ngay

  if (!CH.bat || !CH.khoa) { TK.sanSang = Promise.resolve(TK.khach); return; }
  // Địa chỉ đang mang gói bài làm của học sinh (giao-vien.html#nhap=… từ mã QR, có họ tên / lớp / trường):
  // KHÔNG gọi Fingerprint, để địa chỉ này không đi ra bên thứ ba (Điều khoản 6.2, 6.6). Lượt mở này không được
  // đếm — chấp nhận. (Trang giáo viên cũng tự xoá đoạn này khỏi địa chỉ ngay khi tải; đây là lớp chặn thứ hai.)
  if (/(^#|[&?])nhap=/.test(location.hash)) { TK.sanSang = Promise.resolve(TK.khach); return; }

  // import() động viết qua Function để trình duyệt cũ không hiểu cú pháp cũng không hỏng cả file.
  var nap;
  try { nap = new Function('u', 'return import(u)'); } catch (e) { TK.sanSang = Promise.resolve(TK.khach); return; }

  TK.sanSang = nap(CH.cdn + CH.khoa)
    .then(function (F) { return F.start(); })
    .then(function (fp) { return fp.get({ tag: nhan() }); })
    .then(function (r) {
      var k = { visitor_id: r.visitor_id || null, event_id: r.event_id || null, luc: new Date().toISOString() };
      TK.khach = k; ghiLuu(k); phat(k);
      return k;
    })
    .catch(function () { return TK.khach; });
})();
