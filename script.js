const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let isScannerActive = false;
let scannerRetryTimer = null;
const SCANNER_RETRY_DELAY = 30000; // 30 ثانية لإعادة المحاولة

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// ==================== إدارة الماسح الضوئي ====================
function initializeScanner() {
  if (isScannerActive) return;
  isScannerActive = true;

  // تنظيف الماسح السابق إذا كان موجوداً
  if (scanner) {
    scanner.clear().catch(error => {
      console.error("Error clearing previous scanner:", error);
    });
  }

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
        handleScanSuccess(decodedText);
      },
      (error) => {
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
  console.log("تم مسح الباركود بنجاح:", decodedText);
  showLoadingIndicator(true);
  
  if (scanner) {
    scanner.pause().then(() => {
      cleanUpScanner();
      handleTableScanned(decodedText);
    }).catch(error => {
      console.error("Error pausing scanner:", error);
      cleanUpScanner();
      handleTableScanned(decodedText);
    });
  } else {
    handleTableScanned(decodedText);
  }
}

function handleScanError(error) {
  console.error("خطأ في الماسح الضوئي:", error);
  showError("حدث خطأ في الماسح. جاري إعادة المحاولة...");
  scheduleScannerRetry();
}

function cleanUpScanner() {
  if (scanner) {
    scanner.clear().then(() => {
      console.log("تم إيقاف الماسح بنجاح");
      scanner = null;
      isScannerActive = false;
      cancelScannerRetry();
    }).catch(error => {
      console.error("Error cleaning up scanner:", error);
      scanner = null;
      isScannerActive = false;
    });
  }
}

function scheduleScannerRetry() {
  cancelScannerRetry();
  if (document.getElementById('scanner-section').style.display !== 'none') {
    scannerRetryTimer = setTimeout(() => {
      initializeScanner();
    }, SCANNER_RETRY_DELAY);
  }
}

function cancelScannerRetry() {
  if (scannerRetryTimer) {
    clearTimeout(scannerRetryTimer);
    scannerRetryTimer = null;
  }
}

function toggleFlash() {
  if (!scanner) return;
  
  scanner.getRunningTrackCapabilities().then(capabilities => {
    if (capabilities.torch) {
      const flashBtn = document.getElementById('flash-toggle');
      const isActive = flashBtn.classList.contains('active');
      
      scanner.applyVideoConstraints({
        advanced: [{torch: !isActive}]
      }).then(() => {
        flashBtn.classList.toggle('active');
      }).catch(console.error);
    }
  }).catch(console.error);
}

// ==================== إدارة الطاولات والطلبات ====================
function handleTableScanned(tableNumber) {
  tableNumber = tableNumber.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    showError("الرجاء مسح باركود صالح");
    initializeScanner();
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

function loadMenu() {
  showLoadingIndicator(true);
  
  db.ref("menu").once("value").then((snapshot) => {
    const items = snapshot.val();
    const itemsDiv = document.getElementById('menu-items');
    itemsDiv.innerHTML = '';
    
    if (!items || Object.keys(items).length === 0) {
      itemsDiv.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف متاحة</p>
        </div>
      `;
      return;
    }
    
    renderMenuItems(items, itemsDiv);
    showLoadingIndicator(false);
  }).catch(error => {
    console.error("Error loading menu:", error);
    showError("حدث خطأ في تحميل القائمة");
    showLoadingIndicator(false);
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
  
  container.appendChild(fragment);
  setupQuantityControls();
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

function submitOrder() {
  if (!currentTable) {
    showError("الرجاء تحديد رقم الطاولة أولاً");
    return;
  }

  const orderItems = collectOrderItems();
  
  if (orderItems.length === 0) {
    showError("الرجاء إضافة عناصر للطلب");
    return;
  }

  showLoadingIndicator(true);
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
      showLoadingIndicator(false);
    })
    .catch(error => {
      console.error("Order submission error:", error);
      showError("حدث خطأ أثناء إرسال الطلب");
      showLoadingIndicator(false);
    });
}

function showOrderSummary(order) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  document.getElementById('menu').style.display = 'none';
  document.getElementById('order-summary').style.display = 'block';
  
  renderOrderDetails(order);
}

function renderOrderDetails(order) {
  document.getElementById('summary-table').textContent = order.table;
  
  let html = '';
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
  
  html += `<div class="summary-total">المجموع: ${total.toFixed(2)} جنيه</div>`;
  document.getElementById('summary-items').innerHTML = html;
}

// ==================== إدارة الواجهة ====================
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

function enterTableManually() {
  const tableNumber = document.getElementById('tableNumber').value.trim();
  
  if (!tableNumber || isNaN(tableNumber)) {
    showError("الرجاء إدخال رقم طاولة صحيح");
    return;
  }
  
  handleTableScanned(tableNumber);
  document.getElementById('tableNumber').value = '';
}

function goBack() {
  cleanUpScanner();
  resetMenu();
}

function newOrder() {
  document.getElementById('order-summary').style.display = 'none';
  cleanUpScanner();
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

function showLoadingIndicator(show) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = show ? 'block' : 'none';
  }
}

function showError(message) {
  const errorElement = document.getElementById('input-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

// ==================== تهيئة الصفحة ====================
document.addEventListener('DOMContentLoaded', () => {
  // إضافة عنصر تحميل إذا لم يكن موجوداً
  if (!document.getElementById('loader')) {
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.style.display = 'none';
    loader.innerHTML = `
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <p>جاري التحميل...</p>
      </div>
    `;
    document.body.appendChild(loader);
  }

  initializeScanner();
  
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
