// Firebase إعداد الاتصال بـ
const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// دالة بدء تشغيل الماسح
function initializeScanner() {
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#scanner'),
      constraints: {
        facingMode: "environment" // الكاميرا الخلفية
      }
    },
    decoder: {
      readers: [
        "ean_reader",        // لباركود المنتجات الشائع
        "code_128_reader",   // شائع في المحلات
        "upc_reader"         // في السوبرماركت
      ]
    },
    locate: true
  }, function (err) {
    if (err) {
      console.error("حدث خطأ في التهيئة:", err);
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(function (result) {
    const code = result.codeResult.code;
    console.log("تم قراءة الباركود:", code);
    document.getElementById('result').textContent = "تم قراءة الباركود: " + code;

    // أوقف الماسح بعد قراءة واحدة
    Quagga.stop();

    // نفذ الإجراء المطلوب بعد القراءة
    handleTableScanned(code);
  });
}

// دالة وهمية لمعالجة البيانات (تقدر تغيرها حسب مشروعك)
function handleTableScanned(code) {
  alert("الباركود: " + code);
  // مثال: حفظه في قاعدة بيانات أو عرضه في جدول
}

// تحديث سنة التذييل تلقائياً
document.getElementById('year').textContent = new Date().getFullYear();

// بدء تشغيل الماسح عند فتح الصفحة
window.onload = () => {
  initializeScanner();
};
