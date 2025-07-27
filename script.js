const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let scanTimeout = null;
const SCAN_TIMEOUT = 30000; // 30 ثانية قبل إعادة التهيئة

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// إعداد الموقع عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  // تحميل مكتبة Instascan ديناميكياً
  loadInstascan().then(() => {
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

// تحميل مكتبة Instascan ديناميكياً
function loadInstascan() {
  return new Promise((resolve, reject) => {
    if (typeof Instascan !== 'undefined') {
      return resolve();
    }
    
    const script = document.createElement('script');
    script.src = 'https://rawgit.com/schmich/instascan-builds/master/instascan.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// إعداد الماسح الضوئي
function initializeScanner() {
  if (scanner) return;
  
  // إنشاء عنصر الفيديو إذا لم يكن موجوداً
  const scannerContainer = document.getElementById('scanner');
  scannerContainer.innerHTML = '<video id="scanner-video" playsinline></video>';
  
  const videoElem = document.getElementById('scanner-video');
  
  scanner = new Instascan.Scanner({
    video: videoElem,
    scanPeriod: 1, // زيادة سرعة المسح
    mirror: false,
    captureImage: false,
    backgroundScan: false
  });
  
  // إضافة مؤقت لإعادة التهيئة بعد 30 ثانية
  startScanTimeout();
  
  scanner.addListener('scan', function(content) {
    handleScanSuccess(content);
  });
  
  // بدء المسح
  Instascan.Camera.getCameras().then(function(cameras) {
    if (cameras.length > 0) {
      scanner.start(cameras[0]).catch(function(err) {
        console.error("Failed to start scanner:", err);
        showScannerError();
      });
    } else {
      console.error("No cameras found");
      showScannerError();
    }
  }).catch(function(err) {
    console.error("Camera error:", err);
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
  scanner.stop();
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
  if (scanner) {
    scanner.stop();
    scanner = null;
  }
  const scannerContainer = document.getElementById('scanner');
  scannerContainer.innerHTML = '<video id="scanner-video" playsinline></video>';
}

// باقي الدوال تبقى كما هي (handleTableScanned, showMenuSection, loadMenu, ...)
// ... [أدخل هنا باقي الدوال من الكود السابق بدون تغيير] ...

// تصدير الدوال للوصول إليها من HTML
window.enterTableManually = enterTableManually;
window.submitOrder = submitOrder;
window.goBack = goBack;
window.newOrder = newOrder;
window.initializeScanner = initializeScanner;
