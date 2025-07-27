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
  setupEventListeners();
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

// إعداد مستمعات الأحداث
function setupEventListeners() {
  document.getElementById('manual-mode-btn').addEventListener('click', () => {
    switchToManualInput();
  });
  
  document.getElementById('scan-mode-btn').addEventListener('click', () => {
    switchToScannerInput();
  });
  
  document.getElementById('tableNumber').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      enterTableManually();
    }
  });
}

// التحويل إلى وضع الإدخال اليدوي
function switchToManualInput() {
  document.getElementById('scanner-section').style.display = 'none';
  document.getElementById('manual-input-section').style.display = 'block';
  resetScanner();
  document.getElementById('tableNumber').focus();
}

// التحويل إلى وضع الماسح الضوئي
function switchToScannerInput() {
  document.getElementById('scanner-section').style.display = 'block';
  document.getElementById('manual-input-section').style.display = 'none';
  initializeScanner();
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
  
  // بدء المسح مع دعم جميع أنواع الباركود
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.QR_CODE,
    ZXing.BarcodeFormat.DATA_MATRIX,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.CODE_93,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.AZTEC,
    ZXing.BarcodeFormat.PDF_417
  ]);
  
  codeReader.decodeFromVideoDevice(null, videoElem, (result, err) => {
    if (result) {
      handleScanSuccess(result.text);
    }
    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.error("Scan error:", err);
      showScannerError();
    }
  }, {
    hints: hints
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
    alert("الرجاء مسح باركود صالح يحتوي على رقم طاولة");
    initializeScanner();
    return;
  }

  const tableNum = parseInt(tableNumber);
  if (tableNum < 1 || tableNum > 100) {
    alert("رقم الطاولة يجب أن يكون بين 1 و 100");
    initializeScanner();
    return;
  }

  currentTable = tableNum;
  showMenuSection();
  loadMenu();
}

function showMenuSection() {
  document.getElementById('table-input').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.getElementById('scanned-table-number').textContent = currentTable;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// إدارة القائمة
function loadMenu() {
  db.ref("menu").on("value", (snapshot) => {
    const items = snapshot.val();
    const itemsDiv = document.getElementById('menu-items');
    
    if (!items || Object.keys(items).length === 0) {
      itemsDiv.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف متاحة حالياً</p>
        </div>
      `;
      return;
    }
    
    renderMenuItems(items, itemsDiv);
    setupQuantityControls();
  });
}

function renderMenuItems(items, container) {
  const fragment = document.createDocumentFragment();
  
  Object.entries(items).forEach(([key, item]) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'menu-item';
    itemElement.dataset.itemId = key;
    itemElement.innerHTML = `
      <div class="item-info">
        <h3>${item.name}</h3>
        <div class="item-price">${parseFloat(item.price).toFixed(2)} جنيه</div>
      </div>
      <div class="item-controls">
        <div class="quantity-selector">
          <button class="qty-btn minus-btn" aria-label="تقليل الكمية">
            <i class="fas fa-minus"></i>
          </button>
          <span class="qty-value">0</span>
          <button class="qty-btn plus-btn" aria-label="زيادة الكمية">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <textarea class="item-note" placeholder="أضف ملاحظاتك هنا..."></textarea>
      </div>
    `;
    fragment.appendChild(itemElement);
  });
  
  container.innerHTML = '';
  container.appendChild(fragment);
}

function setupQuantityControls() {
  document.getElementById('menu-items').addEventListener('click', (e) => {
    const qtyElement = e.target.closest('.quantity-selector')?.querySelector('.qty-value');
    if (!qtyElement) return;
    
    let currentQty = parseInt(qtyElement.textContent) || 0;
    
    if (e.target.closest('.minus-btn')) {
      if (currentQty > 0) qtyElement.textContent = currentQty - 1;
    } else if (e.target.closest('.plus-btn')) {
      qtyElement.textContent = currentQty + 1;
    }
  });
}

// إدارة الطلبات
function submitOrder() {
  if (!currentTable) {
    alert("الرجاء تحديد رقم الطاولة أولاً");
    return;
  }

  const orderItems = collectOrderItems();
  
  if (orderItems.length === 0) {
    alert("الرجاء إضافة أصناف إلى الطلب");
    return;
  }

  submitOrderToFirebase(orderItems);
}

function collectOrderItems() {
  const items = [];
  
  document.querySelectorAll('.menu-item').forEach(item => {
    const qty = parseInt(item.querySelector('.qty-value').textContent) || 0;
    if (qty > 0) {
      items.push({
        name: item.querySelector('h3').textContent,
        price: parseFloat(item.querySelector('.item-price').textContent),
        qty: qty,
        note: item.querySelector('.item-note').value.trim()
      });
    }
  });
  
  return items;
}

function submitOrderToFirebase(items) {
  const order = { 
    table: currentTable, 
    items: items,
    status: "pending",
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };
  
  // عرض تحميل أثناء الإرسال
  const submitBtn = document.querySelector('.btn-large');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...';
  submitBtn.disabled = true;
  
  db.ref("orders").push(order)
    .then(() => {
      showOrderSummary(order);
    })
    .catch(error => {
      console.error("خطأ في إرسال الطلب:", error);
      alert("حدث خطأ أثناء إرسال الطلب، الرجاء المحاولة مرة أخرى");
    })
    .finally(() => {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    });
}

// عرض ملخص الطلب
function showOrderSummary(order) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  document.getElementById('menu').style.display = 'none';
  document.getElementById('order-summary').style.display = 'block';
  
  renderOrderDetails(order);
}

function renderOrderDetails(order) {
  document.getElementById('summary-table').textContent = order.table;
  
  let html = '<strong>تفاصيل الطلب:</strong><br><br>';
  let total = 0;
  
  order.items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    html += `
      <div class="summary-item">
        ${item.qty} × ${item.name} - ${itemTotal.toFixed(2)} جنيه
        ${item.note ? `<div class="summary-note">ملاحظة: ${item.note}</div>` : ''}
      </div>
    `;
  });
  
  html += `<br><div class="summary-total">المجموع: ${total.toFixed(2)} جنيه</div>`;
  document.getElementById('summary-items').innerHTML = html;
}

// العودة إلى المسح الضوئي
function goBack() {
  resetScanner();
  resetMenu();
}

// بدء طلب جديد
function newOrder() {
  document.getElementById('order-summary').style.display = 'none';
  resetScanner();
  showScannerSection();
}

// إعادة تعيين القائمة
function resetMenu() {
  document.getElementById('menu').style.display = 'none';
  showScannerSection();
  currentTable = null;
}

// عرض قسم الماسح الضوئي
function showScannerSection() {
  document.getElementById('table-input').style.display = 'block';
  initializeScanner();
}

// إدخال رقم الطاولة يدوياً
function enterTableManually() {
  const tableNumber = document.getElementById('tableNumber').value.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء إدخال رقم طاولة صحيح بين 1 و 100");
    return;
  }

  const tableNum = parseInt(tableNumber);
  if (tableNum < 1 || tableNum > 100) {
    alert("رقم الطاولة يجب أن يكون بين 1 و 100");
    return;
  }

  handleTableScanned(tableNumber);
  document.getElementById('tableNumber').value = '';
}

// تصدير الدوال للوصول إليها من HTML
window.enterTableManually = enterTableManually;
window.submitOrder = submitOrder;
window.goBack = goBack;
window.newOrder = newOrder;
window.initializeScanner = initializeScanner;
