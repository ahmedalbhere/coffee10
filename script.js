const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentTable = null;
let scanner = null;
let isScannerActive = false;
const SCANNER_RETRY_DELAY = 30000; // 30 ثانية لإعادة المحاولة

// تهيئة السنة في التذييل
document.getElementById('year').textContent = new Date().getFullYear();

// إدارة الماسح الضوئي (معدّل للباركود فقط)
function initializeScanner() {
  if (isScannerActive) return;
  isScannerActive = true;

  // تنظيف الماسح السابق إذا كان موجوداً
  if (scanner) {
    scanner.clear().catch(console.error);
  }

  try {
    scanner = new Html5QrcodeScanner(
      "scanner",
      {
        fps: 30,
        qrbox: { width: 250, height: 100 }, // حجم مناسب للباركود
        aspectRatio: 1.0,
        disableFlip: false,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
        formatsToSupport: [ Html5QrcodeSupportedFormats.CODE_128 ] // دعم باركود CODE_128 فقط
      },
      false
    );

    scanner.render(
      (decodedText) => {
        handleScanSuccess(decodedText);
      },
      (error) => {
        handleScanError(error);
      },
      {
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128] // تحديد دعم الباركود فقط
      }
    );
  } catch (error) {
    console.error("فشل تهيئة الماسح:", error);
    handleScanError(error);
  }
}

// معالجة المسح الناجح (مع تحقق من صحة الباركود)
function handleScanSuccess(decodedText) {
  // تحقق من أن الباركود يحتوي على أرقام فقط
  if (!/^\d+$/.test(decodedText)) {
    alert("الرجاء مسح باركود صالح (يجب أن يحتوي على أرقام فقط)");
    scanner.resume().catch(console.error);
    return;
  }

  scanner.pause().then(() => {
    handleTableScanned(decodedText);
  }).catch(console.error);
}

function handleScanError(error) {
  console.error("خطأ في المسح:", error);
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
    alert("الرجاء مسح باركود صالح (يجب أن يكون رقمًا)");
    scanner.resume().catch(console.error);
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
      console.error("خطأ في إرسال الطلب:", error);
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
  if (scanner) {
    scanner.clear().then(() => {
      scanner = null;
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

// تصدير الدوال للوصول إليها من HTML
window.enterTableManually = enterTableManually;
window.goBack = goBack;
window.newOrder = newOrder;
window.submitOrder = submitOrder;
