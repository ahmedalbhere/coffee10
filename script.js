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
let currentStream = null;
let flashTimer = null; // مؤقت الفلاش
const SCANNER_RETRY_DELAY = 30000; // 30 ثانية
const FLASH_TIMEOUT = 10000; // 10 ثواني
const VALID_TABLE_NUMBER_REGEX = /^\d{1,3}$/;

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
    await html5QrCode.start(
      { facingMode: "environment" },
      config,
      handleScanSuccess,
      handleScanError
    );
    
    isScannerActive = true;
    
    setTimeout(() => {
      const videoElement = document.querySelector('#scanner video');
      if (videoElement) {
        currentStream = videoElement.srcObject;
        checkFlashSupport();
      }
    }, 1000);
    
  } catch (firstError) {
    console.log("فشل بدء التشغيل بـ facingMode، جارٍ المحاولة بقائمة الأجهزة...", firstError);
    
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        const backCamera = findBackCamera(devices);
        currentCameraId = backCamera ? backCamera.id : devices[0].id;
        
        await html5QrCode.start(
          currentCameraId,
          config,
          handleScanSuccess,
          handleScanError
        );
        
        isScannerActive = true;
        
        setTimeout(() => {
          const videoElement = document.querySelector('#scanner video');
          if (videoElement) {
            currentStream = videoElement.srcObject;
            checkFlashSupport();
          }
        }, 1000);
        
      } else {
        throw new Error("No cameras found");
      }
    } catch (secondError) {
      console.error("خطأ في تهيئة الماسح:", secondError);
      handleScanError(secondError);
    }
  }
}

function findBackCamera(devices) {
  const backKeywords = ['back', 'rear', 'environment', 'external', '1', 'primary', 'bck', 'main', 'cam1'];
  const frontKeywords = ['front', 'selfie', 'user', 'face', '0', 'secondary', 'internal'];
  
  const environmentCamera = devices.find(device => 
    device.label.toLowerCase().includes('environment')
  );
  
  if (environmentCamera) return environmentCamera;
  
  const explicitBackCamera = devices.find(device => 
    backKeywords.some(keyword => device.label.toLowerCase().includes(keyword))
  );
  
  if (explicitBackCamera) return explicitBackCamera;
  
  const nonFrontCamera = devices.find(device => 
    !frontKeywords.some(keyword => device.label.toLowerCase().includes(keyword))
  );
  
  return nonFrontCamera || devices[0];
}

function checkFlashSupport() {
  if (!currentStream) return;
  
  try {
    const tracks = currentStream.getVideoTracks();
    if (tracks.length === 0) return;
    
    const track = tracks[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    
    if ('torch' in capabilities) {
      flashToggle.style.display = 'flex';
      flashToggle.innerHTML = `<i class="fas fa-bolt"></i>`;
    } else {
      flashToggle.style.display = 'none';
      console.log("الكاميرا لا تدعم الفلاش");
    }
  } catch (error) {
    console.error("Error checking flash support:", error);
    flashToggle.style.display = 'none';
  }
}

async function toggleFlash() {
  if (!currentStream) return;
  
  try {
    const tracks = currentStream.getVideoTracks();
    if (tracks.length === 0) return;
    
    const track = tracks[0];
    const constraints = {
      advanced: [{ torch: !isFlashOn }]
    };
    
    await track.applyConstraints(constraints);
    
    isFlashOn = !isFlashOn;
    flashToggle.classList.toggle('active', isFlashOn);
    flashToggle.innerHTML = `<i class="fas fa-bolt"></i>`;
    
    // إدارة مؤقت الفلاش
    if (isFlashOn) {
      // بدء المؤقت لـ 10 ثواني
      flashTimer = setTimeout(async () => {
        if (isFlashOn) {
          await toggleFlash();
        }
      }, FLASH_TIMEOUT);
    } else {
      // إلغاء المؤقت عند إيقاف الفلاش
      if (flashTimer) {
        clearTimeout(flashTimer);
        flashTimer = null;
      }
    }
    
  } catch (error) {
    console.error("Error toggling flash:", error);
    
    try {
      const track = currentStream.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !isFlashOn }]
      });
      
      isFlashOn = !isFlashOn;
      flashToggle.classList.toggle('active', isFlashOn);
    } catch (secondError) {
      console.error("Failed to toggle flash:", secondError);
      flashToggle.style.display = 'none';
    }
  }
}

async function handleScanSuccess(decodedText) {
  try {
    if (!VALID_TABLE_NUMBER_REGEX.test(decodedText)) {
      console.log("تم تجاهل كود غير صالح:", decodedText);
      return;
    }
    
    await html5QrCode.pause();
    
    if (isFlashOn) {
      await toggleFlash();
    }
    
    handleTableScanned(decodedText);
  } catch (error) {
    console.error("Error pausing scanner:", error);
  }
}

function handleScanError(error) {
  console.error("Scan error:", error);
  isScannerActive = false;
  
  document.querySelector('.fallback-input').style.display = 'block';
  
  setTimeout(() => {
    if (scannerSection.style.display !== 'none') {
      initializeScanner();
    }
  }, SCANNER_RETRY_DELAY);
}

function handleTableScanned(tableNumber) {
  tableNumber = tableNumber.trim();
  
  if (!VALID_TABLE_NUMBER_REGEX.test(tableNumber)) {
    alert("الرجاء مسح باركود صالح لرقم الطاولة");
    html5QrCode.resume().catch(console.error);
    return;
  }

  currentTable = tableNumber;
  showMenuSection();
  loadMenu();
}

function showMenuSection() {
  tableInputSection.style.display = 'none';
  menuSection.style.display = 'block';
  scannedTableNumber.textContent = `طاولة ${currentTable}`;
}

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

function goBack() {
  resetScanner();
  resetMenu();
}

function newOrder() {
  orderSummarySection.style.display = 'none';
  resetScanner();
  showScannerSection();
}

function resetMenu() {
  menuSection.style.display = 'none';
  showScannerSection();
  currentTable = null;
}

function showScannerSection() {
  tableInputSection.style.display = 'block';
  initializeScanner();
}

async function resetScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      html5QrCode = null;
      isScannerActive = false;
      isFlashOn = false;
      currentStream = null;
      flashToggle.classList.remove('active');
      
      if (flashTimer) {
        clearTimeout(flashTimer);
        flashTimer = null;
      }
    } catch (error) {
      console.error("Error resetting scanner:", error);
    }
  }
}

function enterTableManually() {
  const tableNumber = tableNumberInput.value.trim();
  
  if (!VALID_TABLE_NUMBER_REGEX.test(tableNumber)) {
    alert("الرجاء إدخال رقم طاولة صحيح (1-3 أرقام)");
    return;
  }
  
  handleTableScanned(tableNumber);
  tableNumberInput.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  initializeScanner();
  
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
  
  document.getElementById('submit-order')?.addEventListener('click', submitOrder);
  document.getElementById('back-btn')?.addEventListener('click', goBack);
  document.getElementById('new-order-btn')?.addEventListener('click', newOrder);
});
