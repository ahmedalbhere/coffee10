const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let html5QrCode = null;
let isScannerActive = false;
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
      const cameraId = devices[0].id;
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
      ).catch(error => {
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

// إدارة القائمة
function loadMenu() {
  db.ref("menu").on("value", (snapshot) => {
    const items = snapshot.val();
    const itemsDiv = document.getElementById('menu-items');
    
    if (!items || Object.keys(items).length === 0) {
      itemsDiv.innerHTML = '<div class="empty-menu"><i class="fas fa-utensils"></i><p>لا توجد أصناف متاحة</p></div>';
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
        <textarea class="item-note" placeholder="ملاحظات"></textarea>
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
    alert("الرجاء إضافة عناصر للطلب");
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
  
  db.ref("orders").push(order)
    .then(() => {
      showOrderSummary(order);
    })
    .catch(error => {
      console.error("Order submission error:", error);
      alert("حدث خطأ أثناء إرسال الطلب");
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
        ${item.note ? `<div class="summary-note">${item.note}</div>` : ''}
      </div>
    `;
  });
  
  html += `<br><div class="summary-total">المجموع: ${total.toFixed(2)} جنيه</div>`;
  document.getElementById('summary-items').innerHTML = html;
}

// التنقل بين الصفحات
function goBack() {
  resetScanner();
  resetMenu();
}

function newOrder() {
  document.getElementById('order-summary').style.display = 'none';
  resetScanner();
  showScannerSection();
}

function resetMenu() {
  document.getElementById('menu').style.display = 'none';
  showScannerSection();
  currentTable = null;
}

function showScannerSection() {
  document.getElementById('table-input').style.display = 'block';
  initializeScanner();
}

function resetScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      html5QrCode = null;
      isScannerActive = false;
    }).catch(console.error);
  }
}

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
});

// الدوال العامة
function enterTableManually() {
  const tableNumber = document.getElementById('tableNumber').value.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    alert("الرجاء إدخال رقم طاولة صحيح");
    return;
  }
  
  handleTableScanned(tableNumber);
  document.getElementById('tableNumber').value = '';
}
