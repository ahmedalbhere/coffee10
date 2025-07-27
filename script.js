const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let codeReader = null;
let scanTimeout = null;
const SCAN_TIMEOUT = 30000; // 30 ثانية قبل إعادة التهيئة

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// إعداد الموقع عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  // تحميل مكتبة ZXing ديناميكياً
  loadZXing().then(() => {
    initializeScanner();
  }).catch(error => {
    console.error("Failed to load scanner library:", error);
    showScannerError();
  });
  
  // إعداد مستمعات الأحداث
  document.getElementById('manual-mode-btn').addEventListener('click', () => {
    document.getElementById('scanner-section').style.display = 'none';
    document.getElementById('manual-input-section').style.display = 'block';
    resetScanner();
  });
  
  document.getElementById('scan-mode-btn').addEventListener('click', () => {
    document.getElementById('scanner-section').style.display = 'block';
    document.getElementById('manual-input-section').style.display = 'none';
    initializeScanner();
  });
  
  document.getElementById('tableNumber').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      enterTableManually();
    }
  });
});

// تحميل مكتبة ZXing ديناميكياً
function loadZXing() {
  return new Promise((resolve, reject) => {
    if (typeof ZXing !== 'undefined') {
      return resolve();
    }
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@zxing/library@latest/umd/index.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// إعداد الماسح الضوئي
function initializeScanner() {
  if (codeReader) return;
  
  // إنشاء عناصر الماسح
  const scannerContainer = document.getElementById('scanner');
  scannerContainer.innerHTML = `
    <video id="scanner-video" playsinline></video>
    <div class="scan-line"></div>
    <div class="scanner-overlay">
      <div class="scanner-frame"></div>
      <p class="scanner-guide">ضع الباركود داخل الإطار</p>
    </div>
  `;
  
  const videoElem = document.getElementById('scanner-video');
  
  codeReader = new ZXing.BrowserMultiFormatReader();
  
  // إضافة مؤقت لإعادة التهيئة بعد 30 ثانية
  startScanTimeout();
  
  // بدء المسح
  codeReader.decodeFromVideoDevice(null, videoElem, (result, err) => {
    if (result) {
      handleScanSuccess(result.text);
    }
    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.error("Scan error:", err);
      showScannerError();
    }
  }).then(() => {
    console.log("Scanner started successfully");
  }).catch(err => {
    console.error("Failed to start scanner:", err);
    showScannerError();
  });
}

// بدء مؤقت إعادة التهيئة
function startScanTimeout() {
  clearScanTimeout();
  scanTimeout = setTimeout(() => {
    resetScanner();
    initializeScanner();
  }, SCAN_TIMEOUT);
}

// إلغاء مؤقت إعادة التهيئة
function clearScanTimeout() {
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }
}

// التعامل مع مسح الباركود بنجاح
function handleScanSuccess(decodedText) {
  clearScanTimeout();
  codeReader.reset();
  handleTableScanned(decodedText);
}

// عرض رسالة خطأ الماسح
function showScannerError() {
  const scannerContainer = document.getElementById('scanner');
  scannerContainer.innerHTML = `
    <div class="scanner-error">
      <i class="fas fa-exclamation-triangle"></i>
      <p>تعذر تشغيل الماسح الضوئي</p>
      <button onclick="initializeScanner()" class="btn-primary">
        <i class="fas fa-sync-alt"></i> إعادة المحاولة
      </button>
    </div>
  `;
}

// إعادة تعيين الماسح الضوئي
function resetScanner() {
  clearScanTimeout();
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
  const scannerContainer = document.getElementById('scanner');
  scannerContainer.innerHTML = `
    <video id="scanner-video" playsinline></video>
    <div class="scan-line"></div>
    <div class="scanner-overlay">
      <div class="scanner-frame"></div>
      <p class="scanner-guide">ضع الباركود داخل الإطار</p>
    </div>
  `;
}

// إدارة الطاولات
function handleTableScanned(tableNumber) {
  tableNumber = tableNumber.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء مسح باركود صالح");
    initializeScanner();
    return;
  }

  currentTable = tableNumber;
  showMenuSection();
  loadMenu();
}

// ... [بقية الدوال كما هي بدون تغيير] ...

// تصدير الدوال للوصول إليها من HTML
window.enterTableManually = enterTableManually;
window.submitOrder = submitOrder;
window.goBack = goBack;
window.newOrder = newOrder;
window.initializeScanner = initializeScanner;
