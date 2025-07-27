const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let isScannerActive = false;
const SCANNER_RETRY_DELAY = 3000; // 3 ثواني لإعادة المحاولة

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// إدارة الماسح الضوئي (معدّل للباركود فقط)
function initializeScanner() {
  if (isScannerActive) return;
  isScannerActive = true;

  // تنظيف الماسح السابق إذا كان موجوداً
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("Error clearing scanner:", error);
    });
  }

  try {
    // إنشاء مثيل جديد للماسح
    scanner = new Html5QrcodeScanner(
      "scanner",
      {
        fps: 10, // تقليل معدل الإطارات لتحسين الأداء
        qrbox: { width: 250, height: 100 }, // حجم مناسب للباركود
        aspectRatio: 1.0,
        disableFlip: true, // تعطيل التقليب لتحسين الأداء
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A
        ] // دعم صيغ الباركود الشائعة فقط
      },
      /* verbose= */ false
    );

    // عرض الماسح
    scanner.render(
      decodedText => {
        handleScanSuccess(decodedText);
      },
      error => {
        handleScanError(error);
      }
    ).catch(error => {
      console.error("Error rendering scanner:", error);
      handleScanError(error);
    });

  } catch (error) {
    console.error("فشل تهيئة الماسح:", error);
    handleScanError(error);
  }
}

// معالجة المسح الناجح (مع تحقق من صحة الباركود)
function handleScanSuccess(decodedText) {
  console.log("تم مسح الباركود:", decodedText);
  
  // تحقق من أن الباركود يحتوي على أرقام فقط
  if (!/^\d+$/.test(decodedText)) {
    alert("الرجاء مسح باركود صالح (يجب أن يحتوي على أرقام فقط)");
    try {
      if (scanner) {
        scanner.resume().catch(error => {
          console.error("Error resuming scanner:", error);
        });
      }
    } catch (error) {
      console.error("Error handling scan success:", error);
    }
    return;
  }

  // إيقاف الماسح مؤقتاً
  if (scanner) {
    scanner.pause().then(() => {
      handleTableScanned(decodedText);
    }).catch(error => {
      console.error("Error pausing scanner:", error);
      handleTableScanned(decodedText);
    });
  } else {
    handleTableScanned(decodedText);
  }
}

function handleScanError(error) {
  console.error("خطأ في المسح:", error);
  document.getElementById('scanner-section').style.display = 'none';
  document.getElementById('manual-input-section').style.display = 'block';
  isScannerActive = false;
  
  // إعادة المحاولة بعد تأخير
  setTimeout(() => {
    if (document.getElementById('scanner-section').style.display !== 'none') {
      initializeScanner();
    }
  }, SCANNER_RETRY_DELAY);
}

// إدارة الطاولات
function handleTableScanned(tableNumber) {
  tableNumber = tableNumber.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء مسح باركود صالح (يجب أن يكون رقمًا)");
    try {
      if (scanner) {
        scanner.resume().catch(error => {
          console.error("Error resuming scanner:", error);
        });
      }
    } catch (error) {
      console.error("Error handling table scan:", error);
    }
    return;
  }

  currentTable = tableNumber;
  showMenuSection();
  loadMenu();
}

// باقي الدوال تبقى كما هي دون تغيير (loadMenu, renderMenuItems, setupQuantityControls, submitOrder, ...)
// [يجب الحفاظ على جميع الدوال الأخرى كما هي في الكود الأصلي]

// تهيئة الصفحة مع تحسينات
document.addEventListener('DOMContentLoaded', () => {
  // تهيئة الماسح عند تحميل الصفحة
  initializeScanner();
  
  // إضافة مستمع للأحداث للوضع اليدوي
  document.getElementById('manual-mode-btn')?.addEventListener('click', () => {
    document.getElementById('scanner-section').style.display = 'none';
    document.getElementById('manual-input-section').style.display = 'block';
    if (scanner) {
      scanner.clear().catch(error => {
        console.error("Error clearing scanner:", error);
      });
      scanner = null;
    }
    isScannerActive = false;
  });
  
  document.getElementById('scan-mode-btn')?.addEventListener('click', () => {
    document.getElementById('scanner-section').style.display = 'block';
    document.getElementById('manual-input-section').style.display = 'none';
    initializeScanner();
  });
  
  document.getElementById('tableNumber')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      enterTableManually();
    }
  });
});

// تصدير الدوال للوصول إليها من HTML
window.initializeScanner = initializeScanner;
window.handleScanSuccess = handleScanSuccess;
window.handleScanError = handleScanError;
window.handleTableScanned = handleTableScanned;
window.enterTableManually = enterTableManually;
window.goBack = goBack;
window.newOrder = newOrder;
window.submitOrder = submitOrder;
