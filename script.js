const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let html5QrCode = null;
let isScannerActive = false;
let isFlashOn = false;
const SCANNER_RETRY_DELAY = 30000; // 30 ثانية لإعادة المحاولة

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// إدارة الماسح الضوئي
function initializeScanner() {
  if (isScannerActive) return;
  
  // تنظيف الماسح السابق إذا كان موجوداً
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().catch(console.error);
  }

  html5QrCode = new Html5Qrcode("scanner");
  
  const config = {
    fps: 30,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
    supportedScanTypes: [
      Html5QrcodeScanType.SCAN_TYPE_CAMERA,
      Html5QrcodeScanType.SCAN_TYPE_FILE
    ],
    formatsToSupport: [
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.AZTEC,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.MAXICODE,
      Html5QrcodeSupportedFormats.PDF_417,
      Html5QrcodeSupportedFormats.RSS_14,
      Html5QrcodeSupportedFormats.RSS_EXPANDED
    ]
  };

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      // البحث عن الكاميرا الخلفية (عادةً ما تحتوي على كلمة "back" في التسمية)
      const backCamera = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      );
      
      const cameraId = backCamera ? backCamera.id : devices[0].id;
      isScannerActive = true;
      
      html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        (error) => {
          handleScanError(error);
        }
      ).then(() => {
        // إظهار زر المصباح إذا كانت الكاميرا تدعم الفلاش
        if (html5QrCode.getRunningTrackCapabilities().torch) {
          document.getElementById('flash-toggle').style.display = 'flex';
        }
      }).catch(error => {
        console.error("Scanner start error:", error);
        handleScanError(error);
      });
    } else {
      throw new Error("No cameras found");
    }
  }).catch(error => {
    console.error("Camera access error:", error);
    handleScanError(error);
  });
}

// تبديل المصباح (الفلاش)
function toggleFlash() {
  if (!html5QrCode || !html5QrCode.isScanning) return;
  
  isFlashOn = !isFlashOn;
  const flashBtn = document.getElementById('flash-toggle');
  
  html5QrCode.applyVideoConstraints({
    advanced: [{ torch: isFlashOn }]
  }).then(() => {
    flashBtn.classList.toggle('active', isFlashOn);
    flashBtn.innerHTML = `<i class="fas fa-lightbulb"></i>`;
  }).catch(error => {
    console.error("Error toggling flash:", error);
    isFlashOn = !isFlashOn; // التراجع عن التغيير في حالة الخطأ
  });
}

function handleScanSuccess(decodedText) {
  html5QrCode.pause().then(() => {
    handleTableScanned(decodedText);
  }).catch(console.error);
}

function handleScanError(error) {
  console.error("Scan error:", error);
  document.querySelector('.fallback-input').style.display = 'block';
  isScannerActive = false;
  
  // إعادة المحاولة بعد 30 ثانية
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
    alert("الرجاء مسح باركود صالح");
    html5QrCode.resume().catch(console.error);
    return;
  }

  currentTable = tableNumber;
  showMenuSection();
  loadMenu();
}

function showMenuSection() {
  document.getElementById('table-input').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.getElementById('scanned-table-number').textContent = currentTable;
}

// ... (بقية الدوال تبقى كما هي بدون تغيير)

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
  // إضافة مستمع للأحداث للوضع اليدوي
  document.getElementById('manual-mode-btn')?.addEventListener('click', () => {
    document.getElementById('scanner-section').style.display = 'none';
    document.getElementById('manual-input-section').style.display = 'block';
    resetScanner();
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
  
  // إضافة مستمع لزر المصباح
  document.getElementById('flash-toggle')?.addEventListener('click', toggleFlash);
});

// ... (بقية الدوال تبقى كما هي بدون تغيير)
