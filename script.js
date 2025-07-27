const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// متغيرات التطبيق
let currentTable = null;
let html5QrCode = null;
let isScannerActive = false;
let isFlashOn = false;
let currentCameraId = null;
const SCANNER_RETRY_DELAY = 30000; // 30 ثانية لإعادة المحاولة

// عناصر واجهة المستخدم
const tableInputSection = document.getElementById('table-input');
const menuSection = document.getElementById('menu');
const orderSummarySection = document.getElementById('order-summary');
const menuItemsContainer = document.getElementById('menu-items');
const scannedTableNumber = document.getElementById('scanned-table-number');
const summaryTable = document.getElementById('summary-table');
const summaryItems = document.getElementById('summary-items');
const scannerSection = document.getElementById('scanner-section');
const manualInputSection = document.getElementById('manual-input-section');
const tableNumberInput = document.getElementById('tableNumber');
const scanModeBtn = document.getElementById('scan-mode-btn');
const manualModeBtn = document.getElementById('manual-mode-btn');
const flashToggle = document.getElementById('flash-toggle');

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// إدارة الماسح الضوئي
async function initializeScanner() {
  if (isScannerActive) return;
  
  // تنظيف الماسح السابق إذا كان موجوداً
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop().catch(console.error);
  }

  html5QrCode = new Html5Qrcode("scanner");
  
  const config = {
    fps: 30,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
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
      Html5QrcodeSupportedFormats.PDF_417
    ]
  };

  try {
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length) {
      // تحديد الكاميرا الخلفية مباشرةً
      currentCameraId = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') || 
        device.label.toLowerCase().includes('1')
      )?.id || devices[0].id;
      
      await html5QrCode.start(
        currentCameraId,
        config,
        handleScanSuccess,
        handleScanError
      );
      
      isScannerActive = true;
      
      // التحقق من دعم الفلاش
      checkFlashSupport();
    } else {
      throw new Error("No cameras found");
    }
  } catch (error) {
    console.error("Scanner initialization error:", error);
    handleScanError(error);
  }
}

// التحقق من دعم الفلاش
async function checkFlashSupport() {
  try {
    const capabilities = await html5QrCode.getRunningTrackCapabilities();
    if (capabilities.torch) {
      flashToggle.style.display = 'flex';
    } else {
      flashToggle.style.display = 'none';
    }
  } catch (error) {
    console.error("Error checking flash support:", error);
    flashToggle.style.display = 'none';
  }
}

// تبديل المصباح (الفلاش)
async function toggleFlash() {
  if (!html5QrCode || !html5QrCode.isScanning) return;
  
  isFlashOn = !isFlashOn;
  
  try {
    await html5QrCode.applyVideoConstraints({
      advanced: [{ torch: isFlashOn }]
    });
    
    flashToggle.classList.toggle('active', isFlashOn);
    flashToggle.innerHTML = `<i class="fas fa-lightbulb"></i>`;
  } catch (error) {
    console.error("Error toggling flash:", error);
    isFlashOn = !isFlashOn; // التراجع عن التغيير
  }
}

// معالجة مسح الباركود بنجاح
async function handleScanSuccess(decodedText) {
  try {
    await html5QrCode.pause();
    handleTableScanned(decodedText);
  } catch (error) {
    console.error("Error pausing scanner:", error);
  }
}

// معالجة أخطاء الماسح
function handleScanError(error) {
  console.error("Scan error:", error);
  isScannerActive = false;
  
  // إظهار خيار الإدخال اليدوي
  document.querySelector('.fallback-input').style.display = 'block';
  
  // إعادة المحاولة بعد 30 ثانية
  setTimeout(() => {
    if (scannerSection.style.display !== 'none') {
      initializeScanner();
    }
  }, SCANNER_RETRY_DELAY);
}

// معالجة رقم الطاولة الممسوحة
function handleTableScanned(tableNumber) {
  tableNumber = tableNumber.trim();
  
  // التحقق من صحة رقم الطاولة
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء مسح باركود صالح");
    html5QrCode.resume().catch(console.error);
    return;
  }

  currentTable = tableNumber;
  showMenuSection();
  loadMenu();
}

// عرض قسم القائمة
function showMenuSection() {
  tableInputSection.style.display = 'none';
  menuSection.style.display = 'block';
  scannedTableNumber.textContent = `طاولة ${currentTable}`;
}

// تحميل قائمة الطعام
function loadMenu() {
  db.ref("menu").on("value", (snapshot) => {
    const items = snapshot.val();
    menuItemsContainer.innerHTML = '';
    
    if (!items || Object.keys(items).length === 0) {
      menuItemsContainer.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف متاحة حالياً</p>
        </div>
      `;
      return;
    }
    
    renderMenuItems(items);
  });
}

// عرض أصناف القائمة
function renderMenuItems(items) {
  const fragment = document.createDocumentFragment();
  
  Object.entries(items).forEach(([key, item]) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'menu-item';
    itemElement.dataset.itemId = key;
    itemElement.innerHTML = `
      <div class="item-info">
        <h3>${item.name}</h3>
        <div class="item-price">${item.price} جنيه</div>
      </div>
      <div class="item-controls">
        <div class="quantity-selector">
          <button class="qty-btn minus-btn">
            <i class="fas fa-minus"></i>
          </button>
          <span class="qty-value">0</span>
          <button class="qty-btn plus-btn">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <textarea class="item-note" placeholder="ملاحظات (اختياري)"></textarea>
      </div>
    `;
    fragment.appendChild(itemElement);
  });
  
  menuItemsContainer.appendChild(fragment);
  setupQuantityControls();
}

// إعداد عناصر التحكم بالكمية
function setupQuantityControls() {
  menuItemsContainer.addEventListener('click', (e) => {
    const minusBtn = e.target.closest('.minus-btn');
    const plusBtn = e.target.closest('.plus-btn');
    
    if (!minusBtn && !plusBtn) return;
    
    const qtyElement = e.target.closest('.quantity-selector').querySelector('.qty-value');
    let currentQty = parseInt(qtyElement.textContent) || 0;
    
    if (minusBtn && currentQty > 0) {
      qtyElement.textContent = currentQty - 1;
    } else if (plusBtn) {
      qtyElement.textContent = currentQty + 1;
    }
  });
}

// جمع عناصر الطلب
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

// إرسال الطلب إلى Firebase
async function submitOrderToFirebase(items) {
  try {
    const orderRef = await db.ref("orders").push({
      table: currentTable,
      items: items,
      status: "pending",
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    showOrderSummary(orderRef.key, items);
  } catch (error) {
    console.error("Order submission error:", error);
    alert("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.");
  }
}

// عرض ملخص الطلب
function showOrderSummary(orderId, items) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  menuSection.style.display = 'none';
  orderSummarySection.style.display = 'block';
  
  summaryTable.textContent = currentTable;
  
  let html = '';
  let total = 0;
  
  items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    html += `
      <div class="summary-item">
        <strong>${item.qty} × ${item.name}</strong>
        <span>${itemTotal.toFixed(2)} جنيه</span>
        ${item.note ? `<div class="summary-note">${item.note}</div>` : ''}
      </div>
    `;
  });
  
  html += `
    <div class="summary-total">
      <strong>المجموع الكلي:</strong>
      <span>${total.toFixed(2)} جنيه</span>
    </div>
    <div class="order-id">رقم الطلب: #${orderId.substring(0, 6)}</div>
  `;
  
  summaryItems.innerHTML = html;
}

// إرسال الطلب
function submitOrder() {
  if (!currentTable) {
    alert("الرجاء تحديد رقم الطاولة أولاً");
    return;
  }

  const orderItems = collectOrderItems();
  
  if (orderItems.length === 0) {
    alert("الرجاء إضافة عناصر للطلب");
    return;
  }

  submitOrderToFirebase(orderItems);
}

// العودة إلى المسح الضوئي
function goBack() {
  resetScanner();
  resetMenu();
}

// بدء طلب جديد
function newOrder() {
  orderSummarySection.style.display = 'none';
  resetScanner();
  showScannerSection();
}

// إعادة تعيين القائمة
function resetMenu() {
  menuSection.style.display = 'none';
  showScannerSection();
  currentTable = null;
}

// عرض قسم الماسح الضوئي
function showScannerSection() {
  tableInputSection.style.display = 'block';
  initializeScanner();
}

// إعادة تعيين الماسح الضوئي
async function resetScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      html5QrCode = null;
      isScannerActive = false;
      isFlashOn = false;
      flashToggle.classList.remove('active');
    } catch (error) {
      console.error("Error resetting scanner:", error);
    }
  }
}

// إدخال رقم الطاولة يدوياً
function enterTableManually() {
  const tableNumber = tableNumberInput.value.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء إدخال رقم طاولة صحيح");
    return;
  }
  
  handleTableScanned(tableNumber);
  tableNumberInput.value = '';
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
  // أحداث الأزرار
  manualModeBtn?.addEventListener('click', () => {
    scannerSection.style.display = 'none';
    manualInputSection.style.display = 'block';
    resetScanner();
  });
  
  scanModeBtn?.addEventListener('click', () => {
    scannerSection.style.display = 'block';
    manualInputSection.style.display = 'none';
    initializeScanner();
  });
  
  tableNumberInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enterTableManually();
  });
  
  flashToggle?.addEventListener('click', toggleFlash);
  
  // أحداث الأزرار الأخرى
  document.getElementById('submit-order')?.addEventListener('click', submitOrder);
  document.getElementById('back-btn')?.addEventListener('click', goBack);
  document.getElementById('new-order-btn')?.addEventListener('click', newOrder);
});
