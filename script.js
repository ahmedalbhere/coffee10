const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// متغيرات التطبيق
let currentTable = null;
let scanner = null;
let isScannerActive = false;
let currentFlashState = false;
const SCANNER_RETRY_DELAY = 30000; // 30 ثانية لإعادة المحاولة

// تهيئة الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  // تعيين السنة الحالية في التذييل
  document.getElementById('year').textContent = new Date().getFullYear();
  
  // تهيئة الماسح الضوئي
  initializeScanner();
  
  // إعداد مستمعات الأحداث
  setupEventListeners();
});

// إعداد مستمعات الأحداث
function setupEventListeners() {
  // أحداث محول نمط الإدخال
  document.getElementById('manual-mode-btn')?.addEventListener('click', () => {
    switchToManualInput();
  });
  
  document.getElementById('scan-mode-btn')?.addEventListener('click', () => {
    switchToScannerInput();
  });
  
  // حدث لإدخال رقم الطاولة يدوياً عند الضغط على Enter
  document.getElementById('tableNumber')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      enterTableManually();
    }
  });
  
  // حدث لتبديل وضع الفلاش
  document.getElementById('flash-toggle')?.addEventListener('click', toggleFlash);
}

// تهيئة الماسح الضوئي
function initializeScanner() {
  if (isScannerActive || !Html5QrcodeScanner) return;
  
  isScannerActive = true;

  // تنظيف الماسح السابق إذا كان موجوداً
  if (scanner) {
    scanner.clear().catch(handleScannerError);
  }

  try {
    scanner = new Html5QrcodeScanner(
      "scanner",
      {
        fps: 30,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true
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
  } catch (error) {
    console.error("فشل تهيئة الماسح الضوئي:", error);
    handleScanError(error);
  }
}

// التعامل مع مسح الباركود بنجاح
function handleScanSuccess(decodedText) {
  scanner.pause().then(() => {
    handleTableScanned(decodedText);
  }).catch(handleScannerError);
}

// التعامل مع أخطاء الماسح الضوئي
function handleScanError(error) {
  console.error("خطأ في المسح الضوئي:", error);
  isScannerActive = false;
  
  // إعادة المحاولة بعد فترة
  setTimeout(() => {
    if (document.getElementById('scanner-section').style.display !== 'none') {
      initializeScanner();
    }
  }, SCANNER_RETRY_DELAY);
}

// تبديل وضع الفلاش
function toggleFlash() {
  if (!scanner || !scanner.getState || scanner.getState() !== Html5QrcodeScannerState.SCANNING) return;
  
  currentFlashState = !currentFlashState;
  const flashBtn = document.getElementById('flash-toggle');
  
  scanner.toggleFlash().then(() => {
    flashBtn.classList.toggle('active', currentFlashState);
  }).catch(err => {
    console.error("خطأ في تبديل الفلاش:", err);
    flashBtn.classList.remove('active');
    currentFlashState = false;
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

// إعادة تعيين الماسح الضوئي
function resetScanner() {
  if (scanner) {
    scanner.clear().then(() => {
      scanner = null;
      isScannerActive = false;
      currentFlashState = false;
      document.getElementById('flash-toggle').classList.remove('active');
    }).catch(handleScannerError);
  }
}

// التعامل مع مسح رقم الطاولة
function handleTableScanned(tableNumber) {
  tableNumber = tableNumber.trim();
  
  // التحقق من صحة رقم الطاولة
  if (!tableNumber || isNaN(tableNumber) {
    alert("الرجاء مسح باركود صالح");
    scanner.resume().catch(handleScannerError);
    return;
  }

  const tableNum = parseInt(tableNumber);
  if (tableNum < 1 || tableNum > 100) {
    alert("رقم الطاولة يجب أن يكون بين 1 و 100");
    scanner.resume().catch(handleScannerError);
    return;
  }

  currentTable = tableNum;
  showMenuSection();
  loadMenu();
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

// عرض قسم القائمة
function showMenuSection() {
  document.getElementById('table-input').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.getElementById('scanned-table-number').textContent = currentTable;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// تحميل قائمة الطعام من Firebase
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

// عرض أصناف القائمة
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

// إعداد عناصر التحكم في الكمية
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

// إرسال الطلب
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

// جمع أصناف الطلب
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

// عرض تفاصيل الطلب
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

// تصدير الدوال للوصول إليها من HTML
window.enterTableManually = enterTableManually;
window.setInputMode = function(mode) {
  if (mode === 'scan') {
    switchToScannerInput();
  } else {
    switchToManualInput();
  }
};
window.submitOrder = submitOrder;
window.goBack = goBack;
window.newOrder = newOrder;
