// script.js - نظام طلبات الكافيه

// تهيئة Firebase
const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// عناصر واجهة المستخدم
const tableInputSection = document.getElementById('table-input');
const menuSection = document.getElementById('menu');
const orderSummarySection = document.getElementById('order-summary');
const scannerSection = document.getElementById('scanner-section');
const manualInputSection = document.getElementById('manual-input-section');
const errorMessage = document.getElementById('input-error');
const menuItemsContainer = document.getElementById('menu-items');
const scannedTableNumber = document.getElementById('scanned-table-number');
const summaryTable = document.getElementById('summary-table');
const summaryItems = document.getElementById('summary-items');
const tableNumberInput = document.getElementById('tableNumber');
const flashToggle = document.getElementById('flash-toggle');
const scanModeBtn = document.getElementById('scan-mode-btn');
const manualModeBtn = document.getElementById('manual-mode-btn');

// متغيرات التطبيق
let currentTable = null;
let scanner = null;
let selectedItems = [];
let isFlashOn = false;
let isManualMode = false;

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  
  // تعيين وضع الإدخال الافتراضي (الماسح الضوئي)
  setInputMode('scan');
  
  // تحميل قائمة الطعام
  loadMenuItems();
});

// تعيين وضع إدخال رقم الطاولة
function setInputMode(mode) {
  if (mode === 'scan') {
    isManualMode = false;
    scannerSection.style.display = 'block';
    manualInputSection.style.display = 'none';
    scanModeBtn.classList.add('active');
    manualModeBtn.classList.remove('active');
    initScanner();
  } else {
    isManualMode = true;
    scannerSection.style.display = 'none';
    manualInputSection.style.display = 'block';
    scanModeBtn.classList.remove('active');
    manualModeBtn.classList.add('active');
    if (scanner) {
      scanner.clear().catch(error => console.error("Failed to clear scanner:", error));
    }
    tableNumberInput.focus();
  }
}

// تهيئة ماسح الباركود
function initScanner() {
  if (!scanner && !isManualMode) {
    scanner = new Html5QrcodeScanner("scanner", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
    }, false);
    
    scanner.render(
      qrCodeSuccessCallback,
      qrCodeErrorCallback
    );
  }
}

// تبديل وضع الفلاش
function toggleFlash() {
  if (!scanner) return;
  
  isFlashOn = !isFlashOn;
  flashToggle.classList.toggle('active', isFlashOn);
  
  // هذه الميزة تتطلب دعم المتصفح للتحكم في الفلاش
  // وقد لا تعمل في جميع المتصفحات
  scanner.applyVideoConstraints({
    advanced: [{ torch: isFlashOn }]
  }).then(() => {
    console.log("Flash toggled:", isFlashOn);
  }).catch(err => {
    console.error("Failed to toggle flash:", err);
    flashToggle.style.display = 'none'; // إخفاء الزر إذا لم يكن مدعوماً
  });
}

// رد فعل عند قراءة الباركود بنجاح
function qrCodeSuccessCallback(decodedText) {
  if (!decodedText) return;
  
  const tableNumber = parseInt(decodedText);
  if (!isNaN(tableNumber) {
    handleTableNumber(tableNumber);
  } else {
    showError("باركود غير صالح. الرجاء مسح باركود الطاولة.");
  }
}

// رد فعل عند حدوث خطأ في الماسح الضوئي
function qrCodeErrorCallback(error) {
  console.error("QR Scanner error:", error);
  if (error.includes('NotAllowedError')) {
    showError("تم رفض إذن الكاميرا. الرجاء السماح باستخدام الكاميرا.");
  }
}

// إدخال رقم الطاولة يدوياً
function enterTableManually() {
  const tableNumber = parseInt(tableNumberInput.value);
  
  if (!tableNumber || isNaN(tableNumber) {
    showError("الرجاء إدخال رقم طاولة صحيح بين 1 و 100");
    return;
  }
  
  if (tableNumber < 1 || tableNumber > 100) {
    showError("رقم الطاولة يجب أن يكون بين 1 و 100");
    return;
  }
  
  handleTableNumber(tableNumber);
}

// معالجة رقم الطاولة
function handleTableNumber(tableNumber) {
  currentTable = tableNumber;
  scannedTableNumber.textContent = `الطاولة: ${tableNumber}`;
  tableInputSection.style.display = 'none';
  menuSection.style.display = 'block';
  hideError();
  
  // إيقاف الماسح الضوئي إذا كان يعمل
  if (scanner && !isManualMode) {
    scanner.clear().catch(error => console.error("Failed to clear scanner:", error));
  }
}

// العودة إلى إدخال رقم الطاولة
function goBack() {
  currentTable = null;
  menuSection.style.display = 'none';
  tableInputSection.style.display = 'block';
  selectedItems = [];
  updateOrderButton();
  
  // إعادة تشغيل الماسح الضوئي إذا كان في وضع المسح
  if (!isManualMode) {
    initScanner();
  }
}

// تحميل أصناف القائمة من قاعدة البيانات
function loadMenuItems() {
  db.ref("menu").on("value", snapshot => {
    menuItemsContainer.innerHTML = '';
    const items = snapshot.val();
    
    if (!items) {
      menuItemsContainer.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف في القائمة حالياً</p>
        </div>
      `;
      return;
    }
    
    for (const [key, item] of Object.entries(items)) {
      const itemElement = createMenuItemElement(key, item);
      menuItemsContainer.appendChild(itemElement);
    }
  });
}

// إنشاء عنصر صنف في القائمة
function createMenuItemElement(key, item) {
  const itemElement = document.createElement('div');
  itemElement.className = 'menu-item';
  
  const itemObj = {
    id: key,
    name: item.name,
    price: parseFloat(item.price),
    qty: 0,
    note: ''
  };
  
  itemElement.innerHTML = `
    <div class="item-info">
      <h3>${item.name}</h3>
      <div class="item-price">${item.price} جنيه</div>
    </div>
    <div class="item-controls">
      <div class="quantity-selector">
        <button class="qty-btn minus" onclick="updateQuantity('${key}', -1)">
          <i class="fas fa-minus"></i>
        </button>
        <span class="qty-value" id="qty-${key}">0</span>
        <button class="qty-btn plus" onclick="updateQuantity('${key}', 1)">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <textarea class="item-note" id="note-${key}" 
                placeholder="ملاحظات خاصة (اختياري)"></textarea>
    </div>
  `;
  
  return itemElement;
}

// تحديث كمية الصنف
function updateQuantity(itemId, change) {
  const qtyElement = document.getElementById(`qty-${itemId}`);
  let currentQty = parseInt(qtyElement.textContent) || 0;
  let newQty = currentQty + change;
  
  if (newQty < 0) newQty = 0;
  
  qtyElement.textContent = newQty;
  
  // تحديث selectedItems
  const existingItemIndex = selectedItems.findIndex(item => item.id === itemId);
  
  if (newQty > 0) {
    const noteElement = document.getElementById(`note-${itemId}`);
    const note = noteElement ? noteElement.value.trim() : '';
    
    const menuItemRef = db.ref(`menu/${itemId}`);
    menuItemRef.once('value').then(snapshot => {
      const menuItem = snapshot.val();
      
      if (existingItemIndex >= 0) {
        // تحديث الصنف الموجود
        selectedItems[existingItemIndex].qty = newQty;
        selectedItems[existingItemIndex].note = note;
      } else {
        // إضافة صنف جديد
        selectedItems.push({
          id: itemId,
          name: menuItem.name,
          price: parseFloat(menuItem.price),
          qty: newQty,
          note: note
        });
      }
      
      updateOrderButton();
    });
  } else if (existingItemIndex >= 0) {
    // إزالة الصنف إذا كانت الكمية صفر
    selectedItems.splice(existingItemIndex, 1);
    updateOrderButton();
  }
}

// تحديث حالة زر تأكيد الطلب
function updateOrderButton() {
  const orderButton = document.querySelector('.btn-large');
  if (!orderButton) return;
  
  const totalItems = selectedItems.reduce((sum, item) => sum + item.qty, 0);
  
  if (totalItems > 0) {
    orderButton.disabled = false;
    orderButton.innerHTML = `<i class="fas fa-paper-plane"></i> تأكيد الطلب (${totalItems})`;
  } else {
    orderButton.disabled = true;
    orderButton.innerHTML = `<i class="fas fa-paper-plane"></i> تأكيد الطلب`;
  }
}

// إرسال الطلب إلى قاعدة البيانات
function submitOrder() {
  if (!currentTable || selectedItems.length === 0) return;
  
  // تصفية الأصناف ذات الكمية أكبر من صفر
  const itemsToOrder = selectedItems.filter(item => item.qty > 0);
  
  if (itemsToOrder.length === 0) {
    showError("الرجاء إضافة أصناف إلى الطلب");
    return;
  }
  
  const orderData = {
    table: currentTable,
    items: itemsToOrder.map(item => ({
      name: item.name,
      price: item.price,
      qty: item.qty,
      note: item.note
    })),
    status: "pending",
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };
  
  // إرسال الطلب إلى Firebase
  db.ref("orders").push(orderData)
    .then(() => {
      showOrderSummary(itemsToOrder);
    })
    .catch(error => {
      console.error("Error submitting order:", error);
      showError("حدث خطأ أثناء إرسال الطلب. الرجاء المحاولة مرة أخرى.");
    });
}

// عرض ملخص الطلب
function showOrderSummary(items) {
  menuSection.style.display = 'none';
  orderSummarySection.style.display = 'block';
  
  summaryTable.textContent = currentTable;
  
  let itemsHTML = '';
  let total = 0;
  
  items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    
    itemsHTML += `
      <div class="summary-item">
        <div class="item-name">${item.name}</div>
        <div class="item-details">
          <span class="item-qty">${item.qty} ×</span>
          <span class="item-price">${item.price} ج</span>
          <span class="item-total">${itemTotal.toFixed(2)} ج</span>
        </div>
        ${item.note ? `<div class="summary-note">${item.note}</div>` : ''}
      </div>
    `;
  });
  
  itemsHTML += `
    <div class="summary-total">المجموع الكلي: ${total.toFixed(2)} جنيه</div>
  `;
  
  summaryItems.innerHTML = itemsHTML;
}

// بدء طلب جديد
function newOrder() {
  currentTable = null;
  selectedItems = [];
  orderSummarySection.style.display = 'none';
  tableInputSection.style.display = 'block';
  
  // إعادة تعيين الكميات والملاحظات
  document.querySelectorAll('.qty-value').forEach(el => {
    el.textContent = '0';
  });
  
  document.querySelectorAll('.item-note').forEach(el => {
    el.value = '';
  });
  
  // إعادة تشغيل الماسح الضوئي إذا كان في وضع المسح
  if (!isManualMode) {
    initScanner();
  }
}

// عرض رسالة خطأ
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.classList.add('show');
  }, 10);
}

// إخفاء رسالة الخطأ
function hideError() {
  errorMessage.classList.remove('show');
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 300);
}

// تصدير الدوال للوصول إليها من HTML
window.setInputMode = setInputMode;
window.toggleFlash = toggleFlash;
window.enterTableManually = enterTableManually;
window.goBack = goBack;
window.updateQuantity = updateQuantity;
window.submitOrder = submitOrder;
window.newOrder = newOrder;
