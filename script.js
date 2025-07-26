const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let isScannerActive = false;
let torchState = false;
const SCANNER_CONFIG = {
  fps: 60, // زيادة سرعة المعالجة
  qrbox: { width: 300, height: 300 },
  aspectRatio: 1.0,
  disableFlip: false,
  rememberLastUsedCamera: true,
  supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
};

// عناصر واجهة المستخدم
const yearElement = document.getElementById('year');
const scannerSection = document.getElementById('scanner-section');
const manualInputSection = document.getElementById('manual-input-section');
const menuSection = document.getElementById('menu');
const orderSummarySection = document.getElementById('order-summary');

// تهيئة السنة
yearElement.textContent = new Date().getFullYear();

// 1. نظام الماسح الضوئي المتقدم
function initializeScanner() {
  if (isScannerActive) return;
  isScannerActive = true;

  cleanUpScanner();

  try {
    scanner = new Html5QrcodeScanner(
      "scanner",
      SCANNER_CONFIG,
      /* verbose= */ false
    );

    // إضافة مؤثرات بصرية أثناء البحث
    addScanningEffects();

    scanner.render(
      qrCodeSuccessCallback,
      qrCodeErrorCallback
    ).then(() => {
      // إضافة زر الكشاف بعد تهيئة الماسح
      addTorchButton();
    }).catch(handleInitError);
  } catch (error) {
    handleInitError(error);
  }
}

function cleanUpScanner() {
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("Error cleaning scanner:", error);
    });
    removeScanningEffects();
  }
}

function qrCodeSuccessCallback(decodedText) {
  scanner.pause().then(() => {
    handleTableScanned(decodedText);
    removeScanningEffects();
  }).catch(console.error);
}

function qrCodeErrorCallback(error) {
  console.error("QR Scan Error:", error);
  showManualInput();
  scheduleRetry();
}

function handleInitError(error) {
  console.error("Scanner Init Error:", error);
  showManualInput();
  scheduleRetry();
}

// 2. مؤثرات بصرية للماسح
function addScanningEffects() {
  const scannerElement = document.getElementById('scanner');
  if (!scannerElement) return;

  // إضافة نقاط متحركة للبحث
  const dotsOverlay = document.createElement('div');
  dotsOverlay.className = 'scanning-dots';
  dotsOverlay.innerHTML = `
    <div class="dot dot-1"></div>
    <div class="dot dot-2"></div>
    <div class="dot dot-3"></div>
  `;
  scannerElement.appendChild(dotsOverlay);

  // إضافة رسالة توجيهية
  const guideMsg = document.createElement('div');
  guideMsg.className = 'scanning-guide';
  guideMsg.textContent = 'يتم البحث عن الباركود...';
  scannerElement.appendChild(guideMsg);
}

function removeScanningEffects() {
  const effects = document.querySelectorAll('.scanning-dots, .scanning-guide');
  effects.forEach(effect => effect.remove());
}

// 3. إدارة الكشاف
function addTorchButton() {
  const scannerContainer = document.querySelector('.scanner-container');
  if (!scannerContainer || scannerContainer.querySelector('.torch-btn')) return;

  const torchBtn = document.createElement('button');
  torchBtn.className = `torch-btn ${torchState ? 'active' : ''}`;
  torchBtn.innerHTML = `<i class="fas fa-lightbulb"></i>`;
  torchBtn.title = 'تشغيل/إطفاء الكشاف';
  torchBtn.addEventListener('click', toggleTorch);
  
  scannerContainer.appendChild(torchBtn);
}

async function toggleTorch() {
  if (!scanner) return;
  
  try {
    torchState = !torchState;
    const torchBtn = document.querySelector('.torch-btn');
    
    if (torchState) {
      await scanner.applyVideoConstraints({ advanced: [{ torch: true }] });
      torchBtn.classList.add('active');
      torchBtn.innerHTML = '<i class="fas fa-lightbulb"></i>';
    } else {
      await scanner.applyVideoConstraints({ advanced: [{ torch: false }] });
      torchBtn.classList.remove('active');
      torchBtn.innerHTML = '<i class="far fa-lightbulb"></i>';
    }
  } catch (error) {
    console.error("Torch Error:", error);
    alert("لا يدعم هذا الجهاز خاصية الكشاف");
  }
}

// 4. إعادة المحاولة التلقائية
function scheduleRetry() {
  setTimeout(() => {
    if (scannerSection.style.display !== 'none') {
      initializeScanner();
    }
  }, 30000); // 30 ثانية
}

// 5. إدارة واجهة المستخدم
function showManualInput() {
  manualInputSection.style.display = 'block';
  scannerSection.style.display = 'none';
  isScannerActive = false;
}

function showScanner() {
  manualInputSection.style.display = 'none';
  scannerSection.style.display = 'block';
  initializeScanner();
}

function showMenuSection() {
  scannerSection.style.display = 'none';
  manualInputSection.style.display = 'none';
  menuSection.style.display = 'block';
  orderSummarySection.style.display = 'none';
}

function showOrderSummary() {
  menuSection.style.display = 'none';
  orderSummarySection.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 6. إدارة الطلبات
function handleTableScanned(tableNumber) {
  tableNumber = tableNumber.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء مسح باركود صالح");
    scanner.resume().catch(console.error);
    return;
  }

  currentTable = tableNumber;
  document.getElementById('scanned-table-number').textContent = tableNumber;
  showMenuSection();
  loadMenu();
}

function loadMenu() {
  db.ref("menu").on("value", (snapshot) => {
    const items = snapshot.val();
    const itemsDiv = document.getElementById('menu-items');
    
    itemsDiv.innerHTML = items ? renderMenuItems(items) : showEmptyMenu();
    setupEventDelegation();
  });
}

function renderMenuItems(items) {
  return Object.entries(items).map(([key, item]) => `
    <div class="menu-item" data-id="${key}">
      <div class="item-info">
        <h3>${item.name}</h3>
        <div class="item-price">${item.price} جنيه</div>
      </div>
      <div class="item-controls">
        <div class="quantity-selector">
          <button class="qty-btn minus-btn"><i class="fas fa-minus"></i></button>
          <span class="qty-value">0</span>
          <button class="qty-btn plus-btn"><i class="fas fa-plus"></i></button>
        </div>
        <textarea class="item-note" placeholder="ملاحظات"></textarea>
      </div>
    </div>
  `).join('');
}

function setupEventDelegation() {
  document.getElementById('menu-items').addEventListener('click', (e) => {
    const qtyElement = e.target.closest('.quantity-selector')?.querySelector('.qty-value');
    if (!qtyElement) return;
    
    let qty = parseInt(qtyElement.textContent) || 0;
    
    if (e.target.closest('.minus-btn')) {
      qtyElement.textContent = Math.max(0, qty - 1);
    } else if (e.target.closest('.plus-btn')) {
      qtyElement.textContent = qty + 1;
    }
  });
}

// 7. الأحداث الرئيسية
document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
  // أحداث الأزرار
  document.getElementById('manual-mode-btn')?.addEventListener('click', showManualInput);
  document.getElementById('scan-mode-btn')?.addEventListener('click', showScanner);
  document.getElementById('back-to-scanner')?.addEventListener('click', showScanner);
  document.getElementById('submit-order')?.addEventListener('click', submitOrder);
  document.getElementById('new-order')?.addEventListener('click', newOrder);
  document.getElementById('go-back')?.addEventListener('click', goBack);
  
  // إدخال يدوي
  document.getElementById('tableNumber')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enterTableManually();
  });
});

// 8. دوال مساعدة
function enterTableManually() {
  const tableNumber = document.getElementById('tableNumber').value.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء إدخال رقم طاولة صحيح");
    return;
  }
  
  handleTableScanned(tableNumber);
  document.getElementById('tableNumber').value = '';
}

function goBack() {
  resetScanner();
  currentTable = null;
  showScanner();
}

function newOrder() {
  resetScanner();
  currentTable = null;
  showScanner();
}

function resetScanner() {
  if (scanner) {
    scanner.clear().then(() => {
      scanner = null;
      isScannerActive = false;
      torchState = false;
    }).catch(console.error);
  }
}
