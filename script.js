const firebaseConfig = {
  databaseURL: "https://coffee-dda5d-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Global variables
let currentTable = null;
let scanner = null;
let isScannerActive = false;
let flashEnabled = false;
let currentStream = null;

// Initialize the page
document.getElementById('year').textContent = new Date().getFullYear();

/**
 * Initialize the barcode scanner
 */
async function initializeScanner() {
  if (isScannerActive) {
    console.log('Scanner is already active');
    return;
  }

  const scannerElement = document.getElementById('scanner');
  scannerElement.innerHTML = '<div class="scanner-loading"><i class="fas fa-spinner fa-spin"></i> جارٍ تهيئة الماسح...</div>';

  try {
    // Check camera permissions first
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    currentStream = stream;
    
    // Stop any existing tracks
    stream.getTracks().forEach(track => track.stop());

    const formatsToSupport = [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.ITF
    ];

    scanner = new Html5QrcodeScanner(
      "scanner",
      {
        fps: 10,
        qrbox: 250,
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: formatsToSupport,
        rememberLastUsedCamera: true
      },
      false
    );

    const successCallback = async (decodedText) => {
      if (!isScannerActive) return;
      
      console.log('Barcode scanned:', decodedText);
      await stopScanner();
      handleTableScanned(decodedText);
    };

    const errorCallback = (error) => {
      console.error('Scanner error:', error);
      if (!error.message.includes('NotFoundException')) {
        showScannerError(error);
      }
    };

    await scanner.render(successCallback, errorCallback);
    isScannerActive = true;
    console.log('Scanner initialized successfully');
    
  } catch (error) {
    console.error('Scanner initialization failed:', error);
    showScannerError(error);
  }
}

/**
 * Stop the scanner and clean up resources
 */
async function stopScanner() {
  if (!scanner || !isScannerActive) return;
  
  console.log('Stopping scanner...');
  isScannerActive = false;
  flashEnabled = false;
  document.getElementById('flash-toggle')?.classList.remove('active');

  try {
    await scanner.clear();
    scanner = null;
    
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
    }
    
    console.log('Scanner stopped successfully');
  } catch (err) {
    console.error('Failed to stop scanner:', err);
    throw err;
  }
}

/**
 * Show scanner error message
 */
function showScannerError(error) {
  const scannerElement = document.getElementById('scanner');
  scannerElement.innerHTML = `
    <div class="scanner-error">
      <i class="fas fa-exclamation-triangle"></i>
      <p>تعذر تشغيل الماسح الضوئي</p>
      <p>${error.message || 'حدث خطأ غير متوقع'}</p>
      <button onclick="retryScanner()" class="btn-secondary">
        <i class="fas fa-redo"></i> إعادة المحاولة
      </button>
    </div>
  `;
  document.querySelector('.fallback-input').style.display = 'block';
}

/**
 * Retry initializing the scanner
 */
async function retryScanner() {
  document.querySelector('.fallback-input').style.display = 'none';
  await stopScanner();
  initializeScanner();
}

/**
 * Toggle camera flash
 */
async function toggleFlash() {
  if (!scanner || !isScannerActive) {
    alert("يجب تشغيل الماسح أولاً");
    return;
  }

  const flashBtn = document.getElementById('flash-toggle');
  
  try {
    flashEnabled = !flashEnabled;
    
    if (flashEnabled) {
      await scanner.applyVideoConstraints({ advanced: [{torch: true}] });
      flashBtn.classList.add('active');
    } else {
      await scanner.applyVideoConstraints({ advanced: [{torch: false}] });
      flashBtn.classList.remove('active');
    }
  } catch (error) {
    console.error("Flash control error:", error);
    alert("هذا المتصفح أو الجهاز لا يدعم تشغيل الفلاش");
    flashEnabled = false;
    flashBtn.classList.remove('active');
  }
}

/**
 * Handle scanned table number
 */
function handleTableScanned(tableNumber) {
  if (!tableNumber || isNaN(tableNumber)) {
    alert("باركود غير صالح، الرجاء المحاولة مرة أخرى");
    initializeScanner();
    return;
  }
  
  currentTable = tableNumber;
  document.getElementById('table-input').style.display = 'none';
  document.getElementById('menu').style.display = 'block';
  document.getElementById('scanned-table-number').textContent = tableNumber;
  
  loadMenu();
}

/**
 * Enter table number manually
 */
function enterTableManually() {
  const table = document.getElementById('tableNumber').value;
  if (table) {
    handleTableScanned(table);
  } else {
    alert("الرجاء إدخال رقم الطاولة");
  }
}

/**
 * Load menu items from Firebase
 */
function loadMenu() {
  db.ref("menu").on("value", snapshot => {
    const itemsDiv = document.getElementById('menu-items');
    itemsDiv.innerHTML = '';
    const items = snapshot.val();
    
    if (!items || Object.keys(items).length === 0) {
      itemsDiv.innerHTML = `
        <div class="empty-menu">
          <i class="fas fa-utensils"></i>
          <p>لا توجد أصناف متاحة حالياً</p>
        </div>
      `;
      return;
    }
    
    for (let key in items) {
      const item = items[key];
      const itemElement = document.createElement('div');
      itemElement.className = 'menu-item';
      itemElement.innerHTML = `
        <div class="item-info">
          <h3>${item.name}</h3>
          <div class="item-price">${item.price} جنيه</div>
        </div>
        <div class="item-controls">
          <div class="quantity-selector">
            <button onclick="decrementQuantity('${key}')" class="qty-btn">
              <i class="fas fa-minus"></i>
            </button>
            <span id="qty-value-${key}" class="qty-value">0</span>
            <button onclick="incrementQuantity('${key}')" class="qty-btn">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <textarea id="note-${key}" class="item-note" placeholder="ملاحظات خاصة"></textarea>
        </div>
      `;
      itemsDiv.appendChild(itemElement);
    }
  });
}

/**
 * Increase item quantity
 */
function incrementQuantity(itemId) {
  const qtyElement = document.getElementById(`qty-value-${itemId}`);
  let currentQty = parseInt(qtyElement.textContent) || 0;
  qtyElement.textContent = currentQty + 1;
}

/**
 * Decrease item quantity
 */
function decrementQuantity(itemId) {
  const qtyElement = document.getElementById(`qty-value-${itemId}`);
  let currentQty = parseInt(qtyElement.textContent) || 0;
  if (currentQty > 0) {
    qtyElement.textContent = currentQty - 1;
  }
}

/**
 * Submit order to Firebase
 */
async function submitOrder() {
  const order = { 
    table: currentTable, 
    items: [],
    status: "pending",
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };
  
  const snapshot = await db.ref("menu").once("value");
  const items = snapshot.val();
  let hasItems = false;
  
  for (let key in items) {
    const qty = parseInt(document.getElementById(`qty-value-${key}`).textContent) || 0;
    const note = document.getElementById(`note-${key}`).value;
    if (qty > 0) {
      hasItems = true;
      order.items.push({
        name: items[key].name,
        price: parseFloat(items[key].price),
        qty: qty,
        note: note
      });
    }
  }
  
  if (!hasItems) {
    alert("الرجاء إضافة كمية لعنصر واحد على الأقل");
    return;
  }
  
  await db.ref("orders").push(order);
  showOrderSummary(order);
}

/**
 * Show order confirmation
 */
function showOrderSummary(order) {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('summary-table').textContent = order.table;
  
  const itemsDiv = document.getElementById('summary-items');
  itemsDiv.innerHTML = '<strong>تفاصيل الطلب:</strong><br><br>';
  
  let total = 0;
  order.items.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    itemsDiv.innerHTML += `
      <div class="summary-item">
        ${item.qty} × ${item.name} - ${itemTotal.toFixed(2)} جنيه
        ${item.note ? `<div class="summary-note">ملاحظات: ${item.note}</div>` : ''}
      </div>
    `;
  });
  
  itemsDiv.innerHTML += `<br><div class="summary-total">المجموع: ${total.toFixed(2)} جنيه</div>`;
  document.getElementById('order-summary').style.display = 'block';
}

/**
 * Go back to scanner
 */
async function goBack() {
  await stopScanner();
  document.getElementById('menu').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  document.querySelector('.fallback-input').style.display = 'none';
  currentTable = null;
  initializeScanner();
}

/**
 * Start a new order
 */
async function newOrder() {
  await stopScanner();
  document.getElementById('order-summary').style.display = 'none';
  document.getElementById('table-input').style.display = 'block';
  currentTable = null;
  initializeScanner();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
  document.getElementById('tableNumber').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      enterTableManually();
    }
  });
});

// Clean up on page exit
window.addEventListener('beforeunload', async () => {
  await stopScanner();
});
