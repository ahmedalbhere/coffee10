const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// عناصر واجهة المستخدم
const tableInputSection = document.getElementById('table-input');
const menuSection = document.getElementById('menu');
const orderSummarySection = document.getElementById('order-summary');
const menuItemsContainer = document.getElementById('menu-items');
const scannedTableNumber = document.getElementById('scanned-table-number');
const summaryTable = document.getElementById('summary-table');
const summaryItems = document.getElementById('summary-items');
const inputError = document.getElementById('input-error');
const scannerSection = document.getElementById('scanner-section');
const manualInputSection = document.getElementById('manual-input-section');
const tableNumberInput = document.getElementById('tableNumber');
const scanModeBtn = document.getElementById('scan-mode-btn');
const manualModeBtn = document.getElementById('manual-mode-btn');
const flashToggle = document.getElementById('flash-toggle');

// متغيرات التطبيق
let currentTable = null;
let html5QrCode = null;
let flashOn = false;
let selectedItems = [];

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  
  // تعيين وضع الإدخال الافتراضي (المسح الضوئي)
  setInputMode('scan');
  
  // تحميل قائمة الطعام
  loadMenuItems();
});

// تعيين وضع الإدخال (مسح ضوئي أو يدوي)
function setInputMode(mode) {
  if (mode === 'scan') {
    scannerSection.style.display = 'block';
    manualInputSection.style.display = 'none';
    scanModeBtn.classList.add('active');
    manualModeBtn.classList.remove('active');
    initScanner();
  } else {
    scannerSection.style.display = 'none';
    manualInputSection.style.display = 'block';
    scanModeBtn.classList.remove('active');
    manualModeBtn.classList.add('active');
    if (html5QrCode) {
      html5QrCode.stop().catch(error => {
        console.error("Error stopping scanner:", error);
      });
    }
  }
}

// تهيئة ماسح الباركود
function initScanner() {
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("scanner");
  }
  
  const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    handleTableScan(decodedText);
  };
  
  const config = { 
    fps: 10,
    qrbox: { width: 250, height: 250 },
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
  };
  
  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length) {
      const cameraId = devices[0].id;
      html5QrCode.start(
        cameraId,
        config,
        qrCodeSuccessCallback,
        error => {
          console.error("QR Code scan error:", error);
          showError("تعذر الوصول إلى الكاميرا. يرجى التأكد من السماح بالوصول إلى الكاميرا.");
        }
      ).catch(error => {
        console.error("Scanner start error:", error);
        showError("تعذر تشغيل الماسح الضوئي. يرجى المحاولة لاحقاً.");
      });
    } else {
      showError("لم يتم العثور على كاميرا متاحة.");
    }
  }).catch(error => {
    console.error("Camera access error:", error);
    showError("تعذر الوصول إلى الكاميرا. يرجى التأكد من السماح بالوصول إلى الكاميرا.");
  });
}

// تبديل الفلاش
function toggleFlash() {
  if (!html5QrCode) return;
  
  flashOn = !flashOn;
  flashToggle.classList.toggle('active', flashOn);
  
  html5QrCode.applyVideoConstraints({
    torch: flashOn
  }).catch(error => {
    console.error("Error toggling flash:", error);
    flashOn = !flashOn;
    flashToggle.classList.toggle('active', flashOn);
  });
}

// معالجة مسح باركود الطاولة
function handleTableScan(decodedText) {
  // التحقق من أن النص الممسوح يحتوي على رقم طاولة صالح
  const tableNumber = parseInt(decodedText);
  if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 100) {
    showError("رقم الطاولة غير صالح. يرجى مسح باركود صحيح.");
    return;
  }
  
  // إيقاف الماسح الضوئي
  html5QrCode.stop().then(() => {
    console.log("QR Code scanning stopped.");
    setTableNumber(tableNumber);
  }).catch(error => {
    console.error("Error stopping scanner:", error);
    setTableNumber(tableNumber);
  });
}

// إدخال رقم الطاولة يدوياً
function enterTableManually() {
  const tableNumber = parseInt(tableNumberInput.value);
  
  if (isNaN(tableNumber) {
    showError("الرجاء إدخال رقم طاولة صحيح");
    return;
  }
  
  if (tableNumber < 1 || tableNumber > 100) {
    showError("رقم الطاولة يجب أن يكون بين 1 و 100");
    return;
  }
  
  setTableNumber(tableNumber);
}

// تعيين رقم الطاولة وتحميل القائمة
function setTableNumber(tableNumber) {
  currentTable = tableNumber;
  scannedTableNumber.textContent = `طاولة ${currentTable}`;
  summaryTable.textContent = currentTable;
  
  // الانتقال إلى شاشة القائمة
  tableInputSection.style.display = 'none';
  menuSection.style.display = 'block';
  
  // إخفاء أي رسائل خطأ
  hideError();
}

// العودة إلى شاشة إدخال الطاولة
function goBack() {
  currentTable = null;
  selectedItems = [];
  
  menuSection.style.display = 'none';
  orderSummarySection.style.display = 'none';
  tableInputSection.style.display = 'block';
  
  // إعادة تعيين الماسح الضوئي إذا كان في وضع المسح
  if (scanModeBtn.classList.contains('active')) {
    initScanner();
  }
}

// تحميل قائمة الطعام من قاعدة البيانات
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

// إنشاء عنصر قائمة طعام
function createMenuItemElement(key, item) {
  const itemElement = document.createElement('div');
  itemElement.className = 'menu-item';
  
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
      <textarea class="item-note" id="note-${key}" placeholder="ملاحظات خاصة (اختياري)"></textarea>
    </div>
  `;
  
  return itemElement;
}

// تحديث كمية الصنف
function updateQuantity(itemId, change) {
  const qtyElement = document.getElementById(`qty-${itemId}`);
  let currentQty = parseInt(qtyElement.textContent) || 0;
  currentQty += change;
  
  if (currentQty < 0) currentQty = 0;
  
  qtyElement.textContent = currentQty;
  
  // تحديث قائمة العناصر المحددة
  const existingItemIndex = selectedItems.findIndex(item => item.id === itemId);
  
  if (currentQty > 0) {
    const note = document.getElementById(`note-${itemId}`).value;
    
    if (existingItemIndex !== -1) {
      selectedItems[existingItemIndex].qty = currentQty;
      selectedItems[existingItemIndex].note = note;
    } else {
      const itemName = document.querySelector(`#qty-${itemId}`).parentNode.parentNode.parentNode.querySelector('h3').textContent;
      const itemPrice = parseFloat(document.querySelector(`#qty-${itemId}`).parentNode.parentNode.parentNode.querySelector('.item-price').textContent.split(' ')[0]);
      
      selectedItems.push({
        id: itemId,
        name: itemName,
        price: itemPrice,
        qty: currentQty,
        note: note
      });
    }
  } else if (existingItemIndex !== -1) {
    selectedItems.splice(existingItemIndex, 1);
  }
}

// إرسال الطلب
async function submitOrder() {
  if (!currentTable) {
    showError("لم يتم تحديد رقم الطاولة");
    return;
  }
  
  if (selectedItems.length === 0) {
    showError("الرجاء اختيار صنف واحد على الأقل");
    return;
  }
  
  try {
    // إنشاء الطلب في قاعدة البيانات
    const newOrderRef = await db.ref("orders").push({
      table: currentTable,
      items: selectedItems,
      status: "pending",
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // الانتقال إلى شاشة تأكيد الطلب
    showOrderSummary(selectedItems);
    
    // إعادة تعيين العناصر المحددة
    selectedItems = [];
    
    // إعادة تعيين الكميات في الواجهة
    document.querySelectorAll('.qty-value').forEach(el => {
      el.textContent = '0';
    });
    
    // إعادة تعيين الملاحظات
    document.querySelectorAll('.item-note').forEach(el => {
      el.value = '';
    });
    
  } catch (error) {
    console.error("Error submitting order:", error);
    showError("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.");
  }
}

// عرض ملخص الطلب
function showOrderSummary(items) {
  menuSection.style.display = 'none';
  orderSummarySection.style.display = 'block';
  
  let itemsHTML = '';
  let total = 0;
  
  items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    
    itemsHTML += `
      <div class="summary-item">
        <p>
          <strong>${item.name}</strong>
          <span>${item.qty} × ${item.price} ج = ${itemTotal.toFixed(2)} ج</span>
        </p>
        ${item.note ? `<p class="summary-note">${item.note}</p>` : ''}
      </div>
    `;
  });
  
  itemsHTML += `
    <div class="summary-total">
      <p>المجموع الكلي: ${total.toFixed(2)} جنيه</p>
    </div>
  `;
  
  summaryItems.innerHTML = itemsHTML;
}

// بدء طلب جديد
function newOrder() {
  orderSummarySection.style.display = 'none';
  tableInputSection.style.display = 'block';
  
  // إعادة تشغيل الماسح الضوئي إذا كان في وضع المسح
  if (scanModeBtn.classList.contains('active')) {
    initScanner();
  }
}

// عرض رسالة خطأ
function showError(message) {
  inputError.textContent = message;
  inputError.style.display = 'block';
  setTimeout(() => {
    inputError.classList.add('show');
  }, 10);
}

// إخفاء رسالة الخطأ
function hideError() {
  inputError.classList.remove('show');
  setTimeout(() => {
    inputError.style.display = 'none';
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
