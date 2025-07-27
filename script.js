// script.js - نظام طلبات الكافيه (إصدار معدل مع تصحيح الماسح الضوئي)

// تهيئة Firebase
const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// عناصر واجهة المستخدم
const tableInputSection = document.getElementById('table-input');
const menuSection = document.getElementById('menu');
const orderSummarySection = document.getElementById('order-summary');
const scannerSection = document.getElementById('scanner-section');
const manualInputSection = document.getElementById('manual-input-section');
const errorMessage = document.getElementById('input-error');
const menuItemsContainer = document.getElementById('menu-items');
const scannedTableNumber = document.getElementById('scanned-table-number');
const summaryTable = document.getElementById('summary-table');
const summaryItems = document.getElementById('summary-items');
const tableNumberInput = document.getElementById('tableNumber');
const flashToggle = document.getElementById('flash-toggle');
const scanModeBtn = document.getElementById('scan-mode-btn');
const manualModeBtn = document.getElementById('manual-mode-btn');

// متغيرات التطبيق
let currentTable = null;
let scanner = null;
let selectedItems = [];
let isFlashOn = false;
let isManualMode = false;
let isScannerInitialized = false;

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  setInputMode('scan');
  loadMenuItems();
});

// تعيين وضع إدخال رقم الطاولة
function setInputMode(mode) {
  if (mode === 'scan') {
    isManualMode = false;
    scannerSection.style.display = 'block';
    manualInputSection.style.display = 'none';
    scanModeBtn.classList.add('active');
    manualModeBtn.classList.remove('active');
    initScanner();
  } else {
    isManualMode = true;
    scannerSection.style.display = 'none';
    manualInputSection.style.display = 'block';
    scanModeBtn.classList.remove('active');
    manualModeBtn.classList.add('active');
    stopScanner();
    tableNumberInput.focus();
  }
}

// تهيئة ماسح الباركود (إصدار معدل)
function initScanner() {
  if (isScannerInitialized) return;
  
  // إنشاء عنصر الماسح إذا لم يكن موجوداً
  const scannerElement = document.getElementById('scanner');
  if (!scannerElement) {
    console.error("عنصر الماسح غير موجود في الصفحة");
    return;
  }

  scanner = new Html5QrcodeScanner(
    "scanner",
    {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
    },
    false
  );

  scanner.render(
    (decodedText) => {
      handleScannedCode(decodedText);
    },
    (error) => {
      handleScannerError(error);
    }
  ).then(() => {
    isScannerInitialized = true;
    console.log("تم تهيئة الماسح بنجاح");
  }).catch(error => {
    console.error("فشل في تهيئة الماسح:", error);
    showError("لا يمكن تشغيل الكاميرا. الرجاء التحقق من الأذونات.");
  });
}

// إيقاف الماسح الضوئي
function stopScanner() {
  if (scanner && isScannerInitialized) {
    scanner.clear().then(() => {
      console.log("تم إيقاف الماسح بنجاح");
      isScannerInitialized = false;
    }).catch(error => {
      console.error("خطأ في إيقاف الماسح:", error);
    });
  }
}

// معالجة الباركود الممسوح (إصدار معدل)
function handleScannedCode(decodedText) {
  if (!decodedText) return;
  
  console.log("تم مسح الباركود:", decodedText);
  
  // إيقاف الماسح مؤقتاً لمنع المسح المتعدد
  stopScanner();
  
  // التحقق من أن النص الممسوح هو رقم طاولة صالح
  const tableNumber = parseInt(decodedText);
  if (!isNaN(tableNumber) && tableNumber >= 1 && tableNumber <= 100) {
    handleTableNumber(tableNumber);
  } else {
    showError("باركود غير صالح. الرجاء مسح باركود الطاولة الصحيح.");
    // إعادة تشغيل الماسح بعد خطأ
    setTimeout(() => {
      if (!isManualMode) initScanner();
    }, 2000);
  }
}

// معالجة أخطاء الماسح الضوئي (إصدار معدل)
function handleScannerError(error) {
  console.error("خطأ في الماسح الضوئي:", error);
  
  let errorMessage = "حدث خطأ في الماسح الضوئي";
  if (error.includes('NotAllowedError')) {
    errorMessage = "تم رفض إذن الكاميرا. الرجاء السماح باستخدام الكاميرا.";
  } else if (error.includes('NotFoundError')) {
    errorMessage = "لم يتم العثور على كاميرا. الرجاء التأكد من وجود كاميرا متصلة.";
  } else if (error.includes('NotSupportedError')) {
    errorMessage = "المتصفح لا يدعم الماسح الضوئي. الرجاء استخدام متصفح حديث.";
  } else if (error.includes('NotReadableError')) {
    errorMessage = "لا يمكن قراءة الكاميرا. قد تكون قيد الاستخدام من قبل تطبيق آخر.";
  }
  
  showError(errorMessage);
  
  // إخفاء زر الفلاش إذا لم يكن مدعوماً
  flashToggle.style.display = 'none';
}

// تبديل وضع الفلاش (إصدار معدل)
function toggleFlash() {
  if (!scanner || !isScannerInitialized) return;
  
  isFlashOn = !isFlashOn;
  flashToggle.classList.toggle('active', isFlashOn);
  
  // هذه الميزة قد لا تعمل في جميع المتصفحات
  const videoElement = document.querySelector('#scanner video');
  if (videoElement && typeof videoElement.srcObject !== 'undefined') {
    const track = videoElement.srcObject.getVideoTracks()[0];
    if (track && typeof track.applyConstraints === 'function') {
      track.applyConstraints({
        advanced: [{ torch: isFlashOn }]
      }).then(() => {
        console.log("تم تبديل الفلاش:", isFlashOn);
      }).catch(err => {
        console.error("فشل في تبديل الفلاش:", err);
        flashToggle.style.display = 'none';
      });
    }
  }
}

// بقية الدوال تبقى كما هي (handleTableNumber, goBack, loadMenuItems, createMenuItemElement, updateQuantity, ...)
// ... [أدخل هنا بقية الدوال من الكود السابق دون تغيير] ...

// تصدير الدوال للوصول إليها من HTML
window.setInputMode = setInputMode;
window.toggleFlash = toggleFlash;
window.enterTableManually = enterTableManually;
window.goBack = goBack;
window.updateQuantity = updateQuantity;
window.submitOrder = submitOrder;
window.newOrder = newOrder;
