const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let isScannerActive = false;
let scannerRetryTimer = null;
const SCANNER_RETRY_DELAY = 30000; // 30 ثانية لإعادة المحاولة

document.getElementById('year').textContent = new Date().getFullYear();

// دالة لتهيئة الماسح الضوئي
function initializeScanner() {
  // إذا كان الماسح نشط بالفعل، لا تقم بأي شيء
  if (isScannerActive) return;
  
  console.log("جاري تهيئة الماسح الضوئي...");
  isScannerActive = true;

  // تنظيف الماسح السابق إذا كان موجوداً
  if (scanner) {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        scanner.clear().then(() => {
          console.log("تم تنظيف الماسح السابق");
          startNewScanner();
        }).catch(err => {
          console.error("خطأ في تنظيف الماسح:", err);
          startNewScanner();
        });
      }
    }).catch(err => {
      console.error("خطأ في الحصول على الكاميرات:", err);
      handleScanError(err);
    });
  } else {
    startNewScanner();
  }
}

function startNewScanner() {
  try {
    scanner = new Html5QrcodeScanner(
      "scanner",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      false
    );

    scanner.render(
      (decodedText) => {
        console.log("تم مسح الباركود:", decodedText);
        handleScanSuccess(decodedText);
      },
      (error) => {
        console.error("خطأ في المسح:", error);
        handleScanError(error);
      }
    );
    
    console.log("تم تهيئة الماسح بنجاح");
  } catch (error) {
    console.error("فشل تهيئة الماسح:", error);
    handleScanError(error);
  }
}

function handleScanSuccess(decodedText) {
  if (scanner) {
    scanner.pause().then(() => {
      console.log("تم إيقاف الماسح بعد النجاح");
      cleanUpScanner();
      handleTableScanned(decodedText);
    }).catch(err => {
      console.error("خطأ في إيقاف الماسح:", err);
      cleanUpScanner();
      handleTableScanned(decodedText);
    });
  } else {
    handleTableScanned(decodedText);
  }
}

function handleScanError(error) {
  console.error("حدث خطأ في الماسح:", error);
  isScannerActive = false;
  
  // عرض رسالة خطأ للمستخدم
  const errorElement = document.getElementById('input-error');
  errorElement.textContent = "حدث خطأ في الماسح الضوئي. جاري إعادة المحاولة...";
  errorElement.style.display = 'block';
  
  // إخفاء رسالة الخطأ بعد 5 ثواني
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
  
  // إعادة المحاولة بعد 30 ثانية إذا كان الماسح معروضاً
  if (document.getElementById('scanner-section').style.display !== 'none') {
    if (scannerRetryTimer) {
      clearTimeout(scannerRetryTimer);
    }
    scannerRetryTimer = setTimeout(() => {
      if (document.getElementById('scanner-section').style.display !== 'none') {
        console.log("إعادة تهيئة الماسح بعد الخطأ");
        initializeScanner();
      }
    }, SCANNER_RETRY_DELAY);
  }
}

function cleanUpScanner() {
  console.log("جاري تنظيف الماسح...");
  if (scanner) {
    scanner.clear().then(() => {
      console.log("تم تنظيف الماسح بنجاح");
      scanner = null;
      isScannerActive = false;
      
      if (scannerRetryTimer) {
        clearTimeout(scannerRetryTimer);
        scannerRetryTimer = null;
      }
    }).catch(err => {
      console.error("خطأ في تنظيف الماسح:", err);
      scanner = null;
      isScannerActive = false;
    });
  } else {
    isScannerActive = false;
  }
}

// باقي الدوال保持不变 (handleTableScanned, showMenuSection, loadMenu, etc...)
// ... [ابق جميع الدوال الأخرى كما هي] ...

// تعديل دالة setInputMode
function setInputMode(mode) {
  if (mode === 'scan') {
    document.getElementById('scanner-section').style.display = 'block';
    document.getElementById('manual-input-section').style.display = 'none';
    document.getElementById('scan-mode-btn').classList.add('active');
    document.getElementById('manual-mode-btn').classList.remove('active');
    initializeScanner();
  } else {
    document.getElementById('scanner-section').style.display = 'none';
    document.getElementById('manual-input-section').style.display = 'block';
    document.getElementById('scan-mode-btn').classList.remove('active');
    document.getElementById('manual-mode-btn').classList.add('active');
    cleanUpScanner();
  }
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
  // إضافة مستمع للأحداث للوضع اليدوي
  document.getElementById('manual-mode-btn')?.addEventListener('click', () => {
    setInputMode('manual');
  });
  
  document.getElementById('scan-mode-btn')?.addEventListener('click', () => {
    setInputMode('scan');
  });
  
  document.getElementById('tableNumber')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      enterTableManually();
    }
  });
});

// تصدير الدوال للوصول إليها من HTML
window.enterTableManually = enterTableManually;
window.setInputMode = setInputMode;
window.goBack = goBack;
window.newOrder = newOrder;
window.submitOrder = submitOrder;
window.toggleFlash = toggleFlash;
